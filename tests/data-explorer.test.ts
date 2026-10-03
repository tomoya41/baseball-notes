import { describe, expect, it, vi } from "vitest";
import { boundedExplorerRead, cachedExplorerRead, exploreRows, explorerInputErrors, explorerQuery, readableMetric, selectedRecentPlayers, type ExplorerRow } from "../src/domain/data-explorer";
import { metricHelp, glossaryKeys } from "../src/presentation/metric-help";
import { historicalRouteCompetition } from "../src/ui/historical-competition-context";
import { leagueSwitchPath } from "../src/domain/cross-league";
import { readNpbExplorerSeason } from "../src/application/explorer-readers";

const metric = (value: number | null) => ({ value });
const rows: ExplorerRow[] = [
  { playerId: "a", name: "選手A", aliases: ["Verified A"], teamId: "one", batting: { PA: metric(500), OPS: metric(.95), AVG: metric(.31), HR: metric(25) }, pitching: null },
  { playerId: "b", name: "選手B", teamId: "one", batting: { PA: metric(400), OPS: metric(.95), AVG: metric(.28), HR: metric(30) }, pitching: null },
  { playerId: "c", name: "選手C", teamId: "two", batting: { PA: metric(10), OPS: metric(1.1), AVG: metric(.4), HR: metric(2) }, pitching: null },
  { playerId: "d", name: "投手", teamId: "one", batting: null, pitching: { outsRecorded: metric(300), ERA: metric(2.4), K9: metric(10) } },
  { playerId: "e", name: "欠測", teamId: "one", batting: { PA: metric(400), OPS: metric(null), AVG: metric(null), HR: metric(null) }, pitching: null },
];
const query = (value = "") => explorerQuery(new URLSearchParams(value));
describe("saved-data exploration", () => {
  it("combines two numeric conditions and a minimum sample without modifying rows", () => {
    const before = structuredClone(rows);
    expect(exploreRows(rows, query("metric1=OPS&value1=.9&metric2=HR&value2=20&minimum=100")).map(p => p.playerId)).toEqual(["a", "b"]);
    expect(rows).toEqual(before);
  });
  it("sorts by two metrics and keeps missing values last in either direction", () => {
    expect(exploreRows(rows, query("sort1=OPS&sort2=HR")).map(p => p.playerId)).toEqual(["c", "b", "a", "e"]);
    expect(exploreRows(rows, query("sort1=OPS&dir1=asc&sort2=HR")).map(p => p.playerId)).toEqual(["b", "a", "c", "e"]);
  });
  it("keeps team, pitching role and lower-is-better conditions separate", () => {
    expect(exploreRows(rows, query("role=pitching&team=one&metric1=ERA&op1=lte&value1=2.5&metric2=K9&value2=9")).map(p => p.playerId)).toEqual(["d"]);
    expect(exploreRows(rows, query("team=two&minimum=20"))).toEqual([]);
  });
  it("searches supplied verified aliases without merging identities", () => {
    expect(exploreRows(rows, query("q=verified%20a"))[0]?.playerId).toBe("a");
    const sameName = rows.map(p => ({ ...p, name: "同名" }));
    expect(new Set(exploreRows(sameName, query()).map(p => p.playerId)).size).toBe(4);
  });
  it("never treats unknown or unavailable as zero", () => {
    expect(readableMetric({ value: 12, status: "unavailable" })).toBeNull();
    expect(readableMetric(metric(Number.NaN))).toBeNull();
    expect(readableMetric(metric(0))).toBe(0);
    expect(exploreRows(rows, query("metric1=OPS&op1=lte&value1=0"))).toEqual([]);
  });
  it("reports unfinished filters, ignores malformed sort and handles empty results", () => {
    expect(explorerInputErrors(new URLSearchParams("metric1=OPS&minimum=-2"))).toHaveLength(2);
    expect(explorerQuery(new URLSearchParams("role=pitching&sort1=OPS&metric1=OPS&value1=.9")).sorts).toEqual([]);
    expect(exploreRows([], query())).toEqual([]);
  });
  it("deduplicates and bounds explicit known recent selections", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `id${i}`);
    expect(selectedRecentPlayers(new URLSearchParams({ recentPlayers: ["unknown", "id0", ...ids].join(",") }), new Set(ids))).toEqual(ids.slice(0, 12));
  });
  it("limits concurrent individual reads to three and reports failures without zero rows", async () => {
    let active = 0, maximum = 0;
    const read = async (id: string) => {
      active++; maximum = Math.max(maximum, active);
      await Promise.resolve(); active--;
      if (id === "bad") throw Error("HTTP failure");
      return id;
    };
    expect(await boundedExplorerRead(["a", "b", "bad", "d"], read)).toEqual({ values: ["a", "b", "d"], failed: ["bad"] });
    expect(maximum).toBe(3);
    await expect(boundedExplorerRead(Array(13).fill("a"), read)).rejects.toThrow("bounded");
  });
  it("reuses selected responses per period but permits explicit retry after failure", async () => {
    const fetch = vi.fn(async (id: string, days: number) => { if (id === "bad") throw Error("temporary"); return `${id}:${days}`; });
    const read = cachedExplorerRead(fetch);
    expect(await Promise.all([read("a", 7), read("a", 7)])).toEqual(["a:7", "a:7"]);
    await read("a", 14); expect(fetch).toHaveBeenCalledTimes(2);
    await expect(read("bad", 7)).rejects.toThrow(); await expect(read("bad", 7)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(4);
  });
  it("keeps discovery competition and league-switch calendars isolated", () => {
    for (const route of ["data", "history", "glossary"]) {
      expect(historicalRouteCompetition(`/MLB/${route}`, "?competition=postseason&season=2020")).toBe("postseason");
      expect(leagueSwitchPath(`/MLB/${route}`, "?season=2025&competition=postseason", "NPB")).toBe(`/NPB/${route}`);
    }
  });
});
describe("only existing metrics are explained", () => {
  it("provides accessible definitions for every listed glossary key", () => {
    for (const key of glossaryKeys) expect(metricHelp(key)?.interpretation).toBeTruthy();
    expect(glossaryKeys).not.toContain("WHIP"); expect(glossaryKeys).not.toContain("xwOBA");
  });
  it("explains rate formulas, scope and non-decimal innings", () => {
    expect(metricHelp("OPS")?.formula).toBe("OBP ＋ SLG");
    expect(metricHelp("ERA")?.formula).toContain("27");
    expect(metricHelp("K/9")?.sample).toContain("短い");
    expect(metricHelp("outsRecorded")?.sample).toContain("6回と1アウト");
    expect(metricHelp("AVG")?.scope).toContain("別集計");
  });
});
describe("NPB season read boundary", () => {
  it("rejects unsupported years before any request", async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    await expect(readNpbExplorerSeason(2025, fetch)).rejects.toThrow("unavailable"); expect(fetch).not.toHaveBeenCalled();
  });
  it("rejects HTTP errors and malformed payload rather than exposing raw values", async () => {
    await expect(readNpbExplorerSeason(2026, async () => new Response(null, { status: 503 }))).rejects.toThrow("503");
    await expect(readNpbExplorerSeason(2026, async () => Response.json({ season: 2026, players: [] }))).rejects.toThrow();
  });
});
