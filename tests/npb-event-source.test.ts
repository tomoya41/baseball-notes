import { expect, it, vi } from "vitest";
import { fetchNpbEventSource } from "../src/infrastructure/providers/wikipedia-npb-event-source";
it("uses one documented, anonymous, identified API request with maxlag and no media endpoints", async () => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ query: { pages: [] } })));
  const result = await fetchNpbEventSource(request, () => new Date("2026-10-19T00:00:00Z"));
  const [input, init] = request.mock.calls[0]!; const url = new URL(String(input));
  expect(url.origin + url.pathname).toBe("https://ja.wikipedia.org/w/api.php"); expect(url.searchParams.get("pageids")).toBe("5145794"); expect(url.searchParams.get("maxlag")).toBe("5");
  expect(init?.headers).toMatchObject({ "User-Agent": expect.stringContaining("BaseballNotes-sourced-events") });
  expect(result.observedAt).toBe("2026-10-19T00:00:00.000Z"); expect(request).toHaveBeenCalledTimes(1);
});
it.each([429, 503, 403])("stops at HTTP %s without retries, alternate sources or paid fallback", async status => {
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response("unavailable", { status }));
  await expect(fetchNpbEventSource(request)).rejects.toThrow(); expect(request).toHaveBeenCalledTimes(1);
});
it("rejects API errors, malformed data and oversized declared/streamed responses", async () => {
  for (const response of [new Response('{"error":{"code":"maxlag"}}'), new Response("not JSON"), new Response("{}", { headers: { "content-length": "2000001" } }), new Response("x".repeat(2000001))]) {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response); await expect(fetchNpbEventSource(request)).rejects.toThrow(); expect(request).toHaveBeenCalledTimes(1);
  }
});
