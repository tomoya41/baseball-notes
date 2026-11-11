import { describe, expect, it, vi } from "vitest";
import { fetchPinnedNpbReleaseAsset } from "../scripts/lib/fetch-pinned-npb-release-asset";

const url = "https://example.test/release.gz";

describe("pinned NPB release download", () => {
  it.each([502, 503, 504])("retries HTTP %i once", async status => {
    const first = new Response("gateway error", { status });
    const second = new Response("pinned bytes");
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    const wait = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);

    expect(await fetchPinnedNpbReleaseAsset(url, 15_000, request, wait)).toEqual({
      response: second,
      requests: 2,
    });
    expect(first.bodyUsed).toBe(true);
    expect(wait).toHaveBeenCalledExactlyOnceWith(2_000);
    expect(request.mock.calls.map(([target]) => target)).toEqual([url, url]);
    const [initialSignal, retrySignal] = request.mock.calls.map(([, init]) => init?.signal);
    expect(initialSignal).toBeInstanceOf(AbortSignal);
    expect(retrySignal).toBeInstanceOf(AbortSignal);
    expect(initialSignal).not.toBe(retrySignal);
  });

  it.each([200, 403, 404, 429, 500])("returns HTTP %i without retry", async status => {
    const response = new Response(null, { status });
    const request = vi.fn<typeof fetch>().mockResolvedValue(response);
    const wait = vi.fn<(ms: number) => Promise<void>>();
    expect(await fetchPinnedNpbReleaseAsset(url, 15_000, request, wait)).toEqual({
      response,
      requests: 1,
    });
    expect(request).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });

  it("respects Retry-After and never retries the second response", async () => {
    const directed = new Response(null, { status: 503, headers: { "retry-after": "60" } });
    const failed = new Response(null, { status: 504 });
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(directed).mockResolvedValue(failed);
    const wait = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);

    expect(await fetchPinnedNpbReleaseAsset(url, 15_000, request, wait)).toEqual({
      response: directed,
      requests: 1,
    });
    expect(await fetchPinnedNpbReleaseAsset(url, 15_000, request, wait)).toEqual({
      response: failed,
      requests: 2,
    });
    expect(request).toHaveBeenCalledTimes(3);
    expect(wait).toHaveBeenCalledTimes(1);
  });
});
