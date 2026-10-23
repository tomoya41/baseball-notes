import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

export async function buildWebOffline(root = "dist") {
  const source = await readFile(new URL("../src/app/web-offline-worker.js", import.meta.url), "utf8");
  const paths = ["index.html", "manifest.webmanifest", "icons/baseball-notes-192.png", "icons/baseball-notes-512.png", "icons/baseball-notes-maskable-512.png",
    ...(await readdir(join(root, "assets"))).filter(name => /^[\w-]+\.(js|css)$/.test(name)).map(name => `assets/${name}`)].sort();
  const hash = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
  const files = await Promise.all(paths.map(async path => { const body = await readFile(join(root, path)); return { path, bytes: body.length, sha256: hash(body) }; }));
  const bytes = files.reduce((sum, file) => sum + file.bytes, 0);
  if (files.length > 100 || bytes > 8 * 1024 * 1024 || !files.some(file => file.path.endsWith(".js"))) throw Error("Offline app exceeds bounds");
  const version = hash(source + JSON.stringify(files));
  const worker = source.replace("/*__WEB_SHELL__*/ null", JSON.stringify({ version, files }));
  await writeFile(join(root, "sw.js"), worker);
  return { files: files.length, bytes, version, workerBytes: Buffer.byteLength(worker), dataFiles: 0 };
}

// Deploy this at the same worker URL before removing this feature during rollback.
export async function retireWebOffline(root = "dist") {
  const worker = `self.addEventListener("install",e=>e.waitUntil(self.skipWaiting()));self.addEventListener("activate",e=>e.waitUntil((async()=>{const p="baseball-web-shell-v1:"+encodeURIComponent(self.registration.scope)+":";await Promise.all((await caches.keys()).filter(n=>n.startsWith(p)).map(n=>caches.delete(n)));await self.registration.unregister();})()));`;
  await writeFile(join(root, "sw.js"), worker);
  return { retired: true, workerBytes: Buffer.byteLength(worker) };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) console.log(JSON.stringify(await (process.argv.includes("--retire") ? retireWebOffline() : buildWebOffline())));
