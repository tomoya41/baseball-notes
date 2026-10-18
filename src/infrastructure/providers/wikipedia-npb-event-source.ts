/** One documented API request per check. No media/news-body retrieval or paid fallback. */
export async function fetchNpbEventSource(request: typeof fetch = fetch, now: () => Date = () => new Date(), revision?: number) {
  const url = new URL("https://ja.wikipedia.org/w/api.php");
  for (const [key, value] of Object.entries({ action: "query", format: "json", formatversion: "2", prop: "revisions", rvprop: "ids|timestamp|content", rvslots: "main", pageids: "5145794", maxlag: "5" })) url.searchParams.set(key, value);
  if (revision !== undefined) {
    if (!Number.isSafeInteger(revision) || revision < 1) throw Error("Invalid pinned event revision");
    url.searchParams.delete("pageids"); url.searchParams.set("revids", String(revision));
  }
  const response = await request(url, { headers: { "User-Agent": "BaseballNotes-sourced-events/1.0 (https://github.com/tomoya41/baseball-notes)" }, signal: AbortSignal.timeout(60000) });
  if (!response.ok) throw Error(`Wikipedia event source HTTP ${response.status}; keep the published snapshot`);
  if (Number(response.headers.get("content-length")) > 2000000) throw Error("Event source response exceeds the request budget");
  const reader = response.body?.getReader(); if (!reader) throw Error("Empty event source response");
  const chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > 2000000) throw Error("Event source response exceeds the request budget"); chunks.push(part.value); } }
  finally { await reader.cancel(); }
  const bytes = Buffer.concat(chunks), data: unknown = JSON.parse(bytes.toString());
  if (!data || typeof data !== "object" || "error" in data) throw Error("Wikipedia API rejected the request; no retry or alternate source");
  return { observedAt: now().toISOString(), response: data };
}
