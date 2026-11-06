const base = "https://tomoya41.github.io/baseball-notes/data/npb/";

export async function fetchNpbPublicGameSurface(
  path: string,
  request: typeof fetch = fetch,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
) {
  const load = () => request(base + path, { cache: "no-cache", signal: AbortSignal.timeout(15_000) });
  const response = await load();
  if (response.status !== 503 || response.headers.has("retry-after")) return response;
  await response.body?.cancel().catch(() => undefined);
  await wait(2_000);
  return load();
}
