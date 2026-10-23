// Replaced by the build script. Only application files, never baseball data/API responses.
const build = /*__WEB_SHELL__*/ null;
const scope = self.registration.scope;
const prefix = `baseball-web-shell-v1:${encodeURIComponent(scope)}:`;
const cacheName = prefix + build.version;
const entries = new Map(build.files.map(file => [new URL(file.path, scope).href, file]));
const indexUrl = new URL("index.html", scope).href;

async function verifiedFile(url, entry) {
  const response = await fetch(url, { cache: "no-cache", redirect: "error", signal: AbortSignal.timeout(15000) });
  if (!response.ok || response.type === "opaque") throw Error("App file unavailable");
  const bytes = await response.clone().arrayBuffer();
  if (bytes.byteLength !== entry.bytes) throw Error("App file size mismatch");
  const hash = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))].map(n => n.toString(16).padStart(2, "0")).join("");
  if (hash !== entry.sha256) throw Error("App file version mismatch");
  return response;
}

self.addEventListener("install", event => event.waitUntil((async () => {
  const cache = await caches.open(cacheName), files = [...entries];
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const [url, entry] = files[next++];
      await cache.put(url, await verifiedFile(url, entry));
    }
  };
  const results = await Promise.allSettled(Array.from({ length: 4 }, worker));
  if (results.some(result => result.status === "rejected")) {
    await caches.delete(cacheName);
    throw Error("Offline app installation incomplete");
  }
  // Updates wait until all old pages close, or the user explicitly chooses Update.
})()));

self.addEventListener("activate", event => event.waitUntil((async () => {
  const previous = (await caches.keys()).filter(name => name.startsWith(prefix) && name !== cacheName);
  // One previous complete shell keeps lazy imports in an already-open old tab usable.
  await Promise.all(previous.slice(0, -1).map(name => caches.delete(name)));
  await self.clients.claim();
})()));

self.addEventListener("message", event => {
  if (event.data?.type === "ACTIVATE_WEB_UPDATE") event.waitUntil(self.skipWaiting());
});

self.addEventListener("fetch", event => {
  const request = event.request, url = new URL(request.url), base = new URL(scope);
  if (request.method !== "GET" || url.origin !== base.origin || !url.pathname.startsWith(base.pathname)) return;
  const navigation = request.mode === "navigate" && (url.pathname === base.pathname || url.href.split("?")[0] === indexUrl);
  const key = navigation ? indexUrl : url.href;
  const entry = entries.get(key);
  // Leave all JSON, API, raw, external and unknown requests to the existing validated readers.
  const oldAsset = !url.search && /^assets\/[\w-]+\.(js|css)$/.test(url.pathname.slice(base.pathname.length));
  if (!entry && !oldAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(cacheName), saved = await cache.match(key);
    if (saved) return saved;
    if (oldAsset && !entry) {
      for (const name of (await caches.keys()).filter(name => name.startsWith(prefix) && name !== cacheName)) {
        const previous = await (await caches.open(name)).match(key);
        if (previous) return previous;
      }
      return fetch(request);
    }
    // Storage eviction must not prevent an online fresh launch. No response is silently stored here.
    if (navigation) return fetch(request).catch(() => new Response(
      '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Baseball Notes</title><h1>アプリを読み込めません</h1><p>通信が戻ってから再読み込みしてください。保存データは変更していません。</p></html>',
      { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
    ));
    return verifiedFile(key, entry);
  })());
});
