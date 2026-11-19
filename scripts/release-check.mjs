import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { cp, mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const site = join(root, "site");
const release = JSON.parse(await readFile(join(root, "releases.json"), "utf8"));
const releases = { release, videoRelease: release.video };
const assets = Object.values(releases).flatMap(({ assets }) => Object.values(assets));
const local = process.argv.includes("--local");

async function digest(file) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest("hex");
}

async function checkLinks(folder, publicDownloads = new Set()) {
  const entries = await readdir(folder);
  for (const name of entries.filter((name) => name.endsWith(".html"))) {
    const markup = await readFile(join(folder, name), "utf8");
    const ids = new Set(Array.from(markup.matchAll(/\bid="([^"]+)"/g), ([, id]) => id));
    for (const [, link] of markup.matchAll(/\b(?:src|href)="([^"]+)"/g)) {
      if (link.startsWith("https://")) {
        if (link.includes("/releases/download/")) assert.ok(publicDownloads.has(link), name + " -> " + link);
        continue;
      }
      if (link.startsWith("#")) {
        assert.ok(ids.has(link.slice(1)), name + " -> " + link);
        continue;
      }
      const [relative, anchor] = link.split("#");
      const target = join(folder, relative.split("?")[0]);
      assert.ok((await stat(target)).isFile(), name + " -> " + link);
      if (anchor) {
        const targetMarkup = await readFile(target, "utf8");
        assert.ok(targetMarkup.includes('id="' + anchor + '"'), name + " -> " + link);
      }
    }
  }
}

if (local) {
  await checkLinks(site);
  for (const asset of assets) {
    const file = join(site, "downloads", asset.name);
    assert.equal((await stat(file)).size, asset.size, asset.name + " tamaño");
    assert.equal(await digest(file), asset.sha256, asset.name + " SHA-256");
    console.log(asset.name + " · tamaño y SHA-256 correctos");
  }
  console.log("HTML, anclas y recursos locales correctos.");
} else {
  const repository = process.env.GITHUB_REPOSITORY || release.repository;
  assert.match(repository, /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/);
  const config = { comments: null };
  const publicDownloads = new Set();
  let html = await readFile(join(site, "index.html"), "utf8");
  for (const [key, { tag, assets: group }] of Object.entries(releases)) {
    assert.match(tag, /^[a-z0-9.-]+$/);
    const api = "https://api.github.com/repos/" + repository + "/releases/tags/" + tag;
    const response = await fetch(api, { headers: { Accept: "application/vnd.github+json" }, signal: AbortSignal.timeout(12000) });
    assert.ok(response.ok, tag + " · release pública pendiente (HTTP " + response.status + ").");
    const releaseData = await response.json();
    assert.equal(releaseData.draft, false);
    const origin = "https://github.com/" + repository + "/releases/download/" + tag + "/";
    config[key] = { api, assets: {} };
    for (const [platform, asset] of Object.entries(group)) {
      const remote = releaseData.assets.find((file) => file.name === asset.name);
      const url = origin + encodeURIComponent(asset.name);
      assert.equal(remote?.state, "uploaded", asset.name + " subida");
      assert.equal(remote.browser_download_url, url, asset.name + " URL");
      assert.equal(remote.size, asset.size, asset.name + " tamaño");
      assert.equal(remote.digest, "sha256:" + asset.sha256, asset.name + " huella");
      const download = await fetch(url, { headers: { Range: "bytes=0-3" }, signal: AbortSignal.timeout(20000) });
      assert.equal(download.status, 206, asset.name + " descarga pública parcial");
      assert.equal(download.headers.get("content-range"), "bytes 0-3/" + asset.size);
      assert.equal(Buffer.from(await download.arrayBuffer()).toString("hex"), "504b0304");
      config[key].assets[platform] = { name: asset.name, url };
      publicDownloads.add(url);
      const localHref = 'href="downloads/' + asset.name + '" download';
      assert.ok(html.includes(localHref), asset.name + " enlace");
      html = html.replaceAll(localHref, 'href="' + url + '"');
      console.log(asset.name + " · descarga pública, tamaño y SHA-256 correctos");
    }
  }
  const endpoint = process.env.PITER_COMMENTS_ENDPOINT;
  const sitekey = process.env.PITER_TURNSTILE_SITEKEY;
  if (endpoint || sitekey) {
    assert.ok(endpoint && sitekey, "El foro necesita ambas variables públicas.");
    const commentUrl = new URL(endpoint);
    assert.equal(commentUrl.protocol, "https:");
    assert.equal(commentUrl.pathname, "/comments");
    assert.ok(!commentUrl.username && !commentUrl.password && !commentUrl.search && !commentUrl.hash);
    assert.match(sitekey, /^[a-zA-Z0-9_-]{12,80}$/);
    config.comments = { endpoint: commentUrl.href, sitekey };
  }
  const output = join(root, "public");
  await mkdir(output, { recursive: true });
  assert.ok(!(await readdir(output)).length, "public debe estar vacío antes de generar el sitio.");
  for (const name of ["assets", "analytics.js", "app.js", "background-music.js", "cassette-catalog.js", "cassette-demo.js", "creditos.html", "guia-windows.html", "styles.css", "video-demo.js"]) {
    await cp(join(site, name), join(output, name), { recursive: true });
  }
  await writeFile(join(output, "index.html"), html);
  await writeFile(join(output, "config.js"), "window.PITER_CONFIG = " + JSON.stringify(config) + ";\n");
  await writeFile(join(output, ".nojekyll"), "");
  await checkLinks(output, publicDownloads);
}
