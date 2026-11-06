import { describe, expect, it, vi } from "vitest";
import { fetchNpbPublicGameSurface } from "../scripts/lib/fetch-npb-public-game-surface";

const path = "games/dates/2026-09-25.json";
describe("preserving published NPB game files", () => {
  it("retries the same temporarily unavailable file once and returns the recovered body", async () => {
    const request = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("unavailable", { status: 503 }))
      .mockResolvedValueOnce(Response.json({ date: "2026-09-25" }));
    const wait = vi.fn(async () => {});
    const result = await fetchNpbPublicGameSurface(path, request, wait);
    expect(await result.json()).toEqual({ date: "2026-09-25" });
    expect(request.mock.calls.map(([url]) => url)).toEqual(Array(2).fill(`https://tomoya41.github.io/baseball-notes/data/npb/${path}`));
    expect(wait).toHaveBeenCalledExactlyOnceWith(2_000);
  });

  it("returns the second 503 to the existing publication gate", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }));
    const result = await fetchNpbPublicGameSurface(path, request, async () => {});
    expect(result.status).toBe(503);
    expect(request).toHaveBeenCalledTimes(2);
  });

  it.each([
    new Response(null, { status: 404 }),
    new Response(null, { status: 429 }),
    new Response(null, { status: 503, headers: { "Retry-After": "30" } }),
  ])("returns HTTP $status without a retry when missing or told to wait", async response => {
    const request = vi.fn<typeof fetch>().mockResolvedValue(response);
    const wait = vi.fn(async () => {});
    expect(await fetchNpbPublicGameSurface(path, request, wait)).toBe(response);
    expect(request).toHaveBeenCalledTimes(1);
    expect(wait).not.toHaveBeenCalled();
  });
});
