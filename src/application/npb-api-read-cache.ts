/** Anonymous, validated public API reads only. Never used by collectors or gates. */
export function createNpbApiReadCache(now: () => number = Date.now) {
  type Entry = { response: Response; expires: number; bytes: number };
  const cache = new Map<string, Entry>(), pending = new Map<string, Promise<Response>>();
  const maxEntries = 32, maxBytes = 8 * 1024 * 1024;
  let blockedUntil = 0, bytes = 0;
  const unavailable = (error: string, retry: number, headers: HeadersInit) => {
    const responseHeaders = new Headers(headers);
    responseHeaders.set("Cache-Control", "no-store"); responseHeaders.set("Retry-After", String(retry));
    return new Response(JSON.stringify({ error }), { status: 503, headers: responseHeaders });
  };
  function failure(error: unknown, code: string, headers: HeadersInit) {
    // An ordinary SQL, network or credential error must not trip the quota circuit.
    if (error instanceof Error && /SQL read operations are forbidden/i.test(error.message)) blockedUntil = now() + 30_000;
    return unavailable(code, blockedUntil > now() ? Math.ceil((blockedUntil - now()) / 1000) : 1, headers);
  }
  async function read(key: string, headers: HeadersInit, load: () => Promise<Response>, ttlMs = 30_000) {
    const time = now();
    for (const [id, entry] of cache) if (entry.expires <= time) { cache.delete(id); bytes -= entry.bytes; }
    const hit = cache.get(key);
    if (hit) return hit.response.clone();
    const existing = pending.get(key);
    if (existing) return (await existing).clone();
    if (blockedUntil > time) return unavailable("source_read_blocked", Math.ceil((blockedUntil - time) / 1000), headers);
    if (pending.size >= maxEntries) return unavailable("service_busy", 1, headers);
    const task = (async () => {
      const response = await load().catch(error => failure(error, "service_unavailable", headers));
      if (!response.ok) { response.headers.set("Cache-Control", "no-store"); return response; }
      const body = await response.clone().arrayBuffer();
      if (body.byteLength <= 2 * 1024 * 1024) {
        while (cache.size && (cache.size >= maxEntries || bytes + body.byteLength > maxBytes)) {
          const oldest = cache.keys().next().value!; bytes -= cache.get(oldest)!.bytes; cache.delete(oldest);
        }
        cache.set(key, { response: new Response(body, { status: response.status, headers: response.headers }),
          expires: now() + Math.min(ttlMs, 60_000), bytes: body.byteLength }); bytes += body.byteLength;
      }
      return response;
    })();
    pending.set(key, task);
    try { return (await task).clone(); } finally { pending.delete(key); }
  }
  return { read, failure };
}
export const npbApiReadCache = createNpbApiReadCache();
