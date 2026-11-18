import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { dirname, extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../site");
const port = Number(process.env.PITER_PREVIEW_PORT || 8736);
const types = new Map(Object.entries({
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".jpg": "image/jpeg", ".png": "image/png", ".ico": "image/x-icon", ".mp3": "audio/mpeg", ".wav": "audio/wav",
  ".zip": "application/zip", ".apk": "application/vnd.android.package-archive"
}));

const server = createServer(async (req, res) => {
  try {
    if (!["GET", "HEAD"].includes(req.method)) return res.writeHead(405, { Allow: "GET, HEAD" }).end();
    const raw = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    const file = resolve(root, "." + (raw === "/" ? "/index.html" : raw));
    if (!file.startsWith(root + sep) || !types.has(extname(file))) return res.writeHead(404).end();
    const entry = await stat(file);
    if (!entry.isFile()) return res.writeHead(404).end();
    const headers = { "Content-Type": types.get(extname(file)), "Accept-Ranges": "bytes", "X-Content-Type-Options": "nosniff" };
    let start = 0;
    let end = entry.size - 1;
    const range = req.headers.range;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (match?.[1]) {
        start = Number(match[1]);
        if (match[2]) end = Math.min(end, Number(match[2]));
      } else if (match?.[2]) {
        start = Math.max(0, entry.size - Number(match[2]));
      } else {
        start = entry.size;
      }
      if (!Number.isSafeInteger(start) || start > end) return res.writeHead(416, { "Content-Range": "bytes */" + entry.size }).end();
      headers["Content-Range"] = "bytes " + start + "-" + end + "/" + entry.size;
    }
    headers["Content-Length"] = end - start + 1;
    res.writeHead(range ? 206 : 200, headers);
    if (req.method === "HEAD") return res.end();
    const stream = createReadStream(file, { start, end });
    stream.on("error", () => res.destroy());
    res.on("close", () => stream.destroy());
    stream.pipe(res);
  } catch (error) {
    if (!res.headersSent) res.writeHead(error.code === "ENOENT" || error instanceof URIError ? 404 : 500);
    res.end();
  }
});

server.listen(port, "127.0.0.1", () => console.log("PITER MUSIC · http://127.0.0.1:" + port + "/"));
