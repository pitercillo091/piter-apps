const maximumBytes = 6144;
const cooldown = 5 * 60 * 1000;
const siteverify = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin");
    if (new URL(request.url).pathname !== "/comments" || (origin && origin !== env.PUBLIC_ORIGIN)) {
      return new Response(null, { status: 404 });
    }
    const headers = {
      "Content-Type": "application/json; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": env.PUBLIC_ORIGIN,
      "Vary": "Origin"
    };
    const json = (body, status = 200) => Response.json(body, { status, headers });
    try {
      if (request.method === "OPTIONS") {
        return new Response(null, { status: 204, headers: {
          ...headers, "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "600"
        } });
      }
      if (request.method === "GET") {
        const { results } = await env.COMMENTS.prepare(
          "SELECT name,message,created FROM comments WHERE approved=1 ORDER BY id DESC LIMIT 50"
        ).all();
        return json({ comments: results });
      }
      if (request.method !== "POST") return json({ error: "method" }, 405);
      if (origin !== env.PUBLIC_ORIGIN) return json({ error: "origin" }, 403);
      if (!request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json")) return json({ error: "type" }, 415);

      const data = await readData(request);
      const name = clean(data?.name);
      const message = clean(data?.message);
      if (name.length < 2 || name.length > 40 || /[\r\n]/.test(name) ||
          message.length < 5 || message.length > 600 || data?.website ||
          typeof data?.token !== "string" || !data.token || data.token.length > 2048) {
        return json({ error: "fields" }, 400);
      }
      const ip = request.headers.get("CF-Connecting-IP");
      if (!ip || !env.RATE_SECRET || !env.TURNSTILE_SECRET) return json({ error: "unavailable" }, 503);
      const visitor = await fingerprint(env.RATE_SECRET, ip);
      const now = Date.now();
      const existing = await env.COMMENTS.prepare("SELECT expires FROM limits WHERE visitor=?").bind(visitor).first();
      if (existing?.expires > now) return json({ error: "rate" }, 429);
      const response = await fetch(siteverify, {
        method: "POST",
        body: new URLSearchParams({ secret: env.TURNSTILE_SECRET, response: data.token }),
        signal: AbortSignal.timeout(5500)
      });
      if (!response.ok) return json({ error: "validation-unavailable" }, 503);
      const result = await response.json();
      if (!result.success || result.action !== "comment" || result.hostname !== new URL(env.PUBLIC_ORIGIN).hostname) {
        return json({ error: "verification" }, 403);
      }
      // Atomically reserve the cooldown and insert the comment. The INSERT
      // is conditional on the preceding reservation succeeding.
      const ticket = now + cooldown;
      const created = new Date(now).toISOString();
      const operations = await env.COMMENTS.batch([
        env.COMMENTS.prepare("DELETE FROM limits WHERE expires<=?").bind(now),
        env.COMMENTS.prepare("INSERT INTO limits(visitor,expires) VALUES(?,?) ON CONFLICT DO NOTHING").bind(visitor, ticket),
        env.COMMENTS.prepare("INSERT INTO comments(name,message,created) SELECT ?,?,? WHERE changes()=1").bind(name, message, created)
      ]);
      if (operations[2].meta.changes !== 1) return json({ error: "rate" }, 429);
      return json({ pending: true }, 201);
    } catch (error) {
      if (error instanceof RequestBodyError) return json({ error: "body" }, error.status);
      return json({ error: "unavailable" }, 503);
    }
  },
  async scheduled(_event, env) {
    await env.COMMENTS.prepare("DELETE FROM limits WHERE expires<=?").bind(Date.now()).run();
  }
};

class RequestBodyError extends Error {
  constructor(status) {
    super("Invalid request body");
    this.status = status;
  }
}

async function readData(request) {
  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError(400);
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        await reader.cancel();
        throw new RequestBodyError(413);
      }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof RequestBodyError) throw error;
    throw new RequestBodyError(400);
  } finally {
    reader.releaseLock();
  }
}

function clean(value) {
  return typeof value === "string" ? value.normalize("NFC").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim() : "";
}

async function fingerprint(secret, ip) {
  const encode = (value) => new TextEncoder().encode(value);
  const key = await crypto.subtle.importKey("raw", encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encode(ip));
  return Array.from(new Uint8Array(signature), (value) => value.toString(16).padStart(2, "0")).join("");
}
