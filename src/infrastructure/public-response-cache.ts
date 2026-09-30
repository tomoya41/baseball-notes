// Public aggregate responses only. No database, provider raw data, or credentials.
export type CachedResponse = { url: string; body: ArrayBuffer; contentType: string; savedAt: number; bytes: number };
export interface ResponseStore { get(url: string): Promise<CachedResponse | undefined>; put(row: CachedResponse): Promise<void>; remove(url: string): Promise<void> }
export class PublicResponseStore implements ResponseStore {
  constructor(private readonly name = "baseball-public-responses-v1", private readonly maxBytes = 64 * 1024 * 1024) {}
  private open(): Promise<IDBDatabase> {
    return new Promise<IDBDatabase>((resolve, reject) => {
      const r = indexedDB.open(this.name, 1);
      r.onupgradeneeded = () => r.result.createObjectStore("responses", { keyPath: "url" });
      r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
      r.onblocked = () => reject(Error("Response cache unavailable"));
    });
  }
  private async run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    const db = await this.open();
    try { return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction("responses", mode), r = action(tx.objectStore("responses"));
      tx.oncomplete = () => resolve(r.result); tx.onabort = tx.onerror = () => reject(tx.error);
    }); } finally { db.close(); }
  }
  get(url: string) { return this.run<CachedResponse | undefined>("readonly", s => s.get(url)); }
  async remove(url: string) { await this.run("readwrite", s => s.delete(url)); }
  async put(row: CachedResponse) {
    // Bound both a response and the whole cache. PA/event archives are never eligible.
    if (row.bytes > 2 * 1024 * 1024) return;
    await this.run("readwrite", s => s.put(row));
    // Keep metadata only while evicting; never materialize 64 MiB of response bodies.
    const db = await this.open();
    const rows = await new Promise<Pick<CachedResponse, "url" | "savedAt" | "bytes">[]>((resolve, reject) => {
      const metadata: Pick<CachedResponse, "url" | "savedAt" | "bytes">[] = [];
      const tx = db.transaction("responses", "readonly"), cursor = tx.objectStore("responses").openCursor();
      cursor.onsuccess = () => { const item = cursor.result;
        if (item) { const value = item.value as CachedResponse; metadata.push({ url: value.url, savedAt: value.savedAt, bytes: value.bytes }); item.continue(); } };
      tx.oncomplete = () => resolve(metadata); tx.onerror = tx.onabort = () => reject(tx.error);
    }).finally(() => db.close());
    rows.sort((a, b) => b.savedAt - a.savedAt);
    let size = 0;
    for (let i = 0; i < rows.length; i++) { const item = rows[i]!; size += item.bytes;
      if (size > this.maxBytes || i >= 400) await this.remove(item.url);
    }
  }
}
let stale = false;
let needsRefresh = false;
let nativeOnline: boolean | undefined;
export function publicNetworkOnline() { return nativeOnline ?? (typeof navigator === "undefined" || navigator.onLine !== false); }
export function setPublicNetworkOnline(online: boolean) { nativeOnline = online; }
export function hasSavedResponseFallback() { return stale; }
export function needsPublicDataRefresh() { return needsRefresh || stale; }
export function clearSavedResponseFallback() { stale = false; needsRefresh = false; }
function indicateSaved() { stale = true; if (typeof window !== "undefined") window.dispatchEvent(new Event("baseball:saved-data")); }
const candidates = new WeakMap<Response, () => Promise<void>>();
export async function rememberPublicResponse(response: Response) { await candidates.get(response)?.().catch(() => undefined); }

export function createPublicFetch(store: ResponseStore, request: typeof fetch = fetch,
  online: () => boolean = publicNetworkOnline): typeof fetch {
  const pending = new Map<string, Promise<Response>>();
  return async (input, init) => {
    const rawUrl = input instanceof Request ? input.url : String(input);
    const url = new URL(rawUrl, typeof location === "undefined" ? "https://localhost/" : location.href).href;
    if ((init?.method ?? "GET") !== "GET" || /\/(raw|plays|plate-appearances|pa)\//i.test(url)) return request(input, init);
    let task = pending.get(url);
    if (!task) {
      task = (async () => {
        try {
          if (!online()) throw Error("Offline");
          const response = await request(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(12000) });
          if (response.status >= 500 || response.status === 429) throw Error("Temporarily unavailable");
          if (response.status === 404) await store.remove(url).catch(() => undefined);
          return response;
        } catch (error) {
          needsRefresh = true;
          const saved = await store.get(url).catch(() => undefined);
          if (!saved) throw error;
          indicateSaved();
          return new Response(saved.body.slice(0), { headers: { "Content-Type": saved.contentType, "X-Baseball-Saved": "true" } });
        }
      })().finally(() => { pending.delete(url); });
      pending.set(url, task);
    }
    const result = (await task).clone();
    if (result.ok && !result.headers.has("X-Baseball-Saved")) {
      const copy = result.clone();
      // Repository calls commit only after schema AND identity validation.
      candidates.set(result, async () => { const body = await copy.arrayBuffer(); await store.put({ url, body,
        bytes: body.byteLength, contentType: copy.headers.get("Content-Type") ?? "application/json", savedAt: Date.now() }); });
    }
    return result;
  };
}
export const publicDataFetch = createPublicFetch(new PublicResponseStore(), (u, i) => fetch(u, i));
