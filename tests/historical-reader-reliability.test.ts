import { gzipSync } from "node:zlib";
import { describe, expect, it, vi } from "vitest";
import { HistoricalProductHttpError, readHistoricalProduct } from "../src/infrastructure/providers/historical-product-reader";

const directory = { schemaVersion: 1, league: "MLB", players: [] };
describe("historical acquisition reliability", () => {
  it("shares in-flight gzip decoding and validation, but sees later corrections", async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async () => new Response(gzipSync(JSON.stringify(directory))));
    const [first, second] = await Promise.all([
      readHistoricalProduct("players/index.json", request), readHistoricalProduct("players/index.json", request),
    ]);
    expect(request).toHaveBeenCalledTimes(1); expect(first).toBe(second);
    request.mockResolvedValueOnce(new Response(JSON.stringify({ ...directory, revision: "corrected" })));
    expect(await readHistoricalProduct("players/index.json", request)).toMatchObject({ revision: "corrected" });
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("does not retain rejected reads or confuse 404 with network/validation failure", async () => {
    const request = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValueOnce(new Response('{"league":"NPB"}')).mockResolvedValueOnce(new Response(JSON.stringify(directory)));
    await expect(readHistoricalProduct("players/index.json", request)).rejects.toEqual(new HistoricalProductHttpError(404));
    await expect(readHistoricalProduct("players/index.json", request)).rejects.toThrow("Invalid historical");
    expect(await readHistoricalProduct("players/index.json", request)).toMatchObject(directory);
    expect(request).toHaveBeenCalledTimes(3);
  });
  it("isolates regular and postseason acquisition and validation", async () => {
    const request = vi.fn<typeof fetch>().mockImplementation(async url => new Response(JSON.stringify(
      String(url).includes("postseason/") ? { ...directory, competitionType: "postseason" } : directory)));
    const [regular, postseason] = await Promise.all([
      readHistoricalProduct("players/index.json", request), readHistoricalProduct("postseason/players/index.json", request),
    ]);
    expect(request).toHaveBeenCalledTimes(2); expect(regular).not.toHaveProperty("competitionType");
    expect(postseason).toHaveProperty("competitionType", "postseason");
    request.mockResolvedValueOnce(new Response(JSON.stringify({ ...directory, competitionType: "postseason" })));
    await expect(readHistoricalProduct("players/index.json", request)).rejects.toThrow("Invalid historical");
  });
});
