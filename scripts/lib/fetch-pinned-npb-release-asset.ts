const transientGatewayStatuses = new Set([502, 503, 504]);

export async function fetchPinnedNpbReleaseAsset(
  url: string,
  timeoutMs: number,
  request: typeof fetch = fetch,
  wait: (ms: number) => Promise<void> = ms => new Promise(resolve => setTimeout(resolve, ms)),
) {
  const load = () => request(url, { signal: AbortSignal.timeout(timeoutMs) });
  const response = await load();
  if (!transientGatewayStatuses.has(response.status) || response.headers.has("retry-after")) {
    return { response, requests: 1 };
  }

  await response.body?.cancel().catch(() => undefined);
  await wait(2_000);
  return { response: await load(), requests: 2 };
}
