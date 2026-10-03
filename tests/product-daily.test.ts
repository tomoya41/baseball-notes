import { describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { PublicResponseStore, createPublicFetch } from "../src/infrastructure/public-response-cache";
import { StaticGameSurfaceRepository } from "../src/infrastructure/providers/static-game-surface-repository";
import { dailyGames, recapNumbers, seriesAfterGame, tokyoToday, dailyProductCapabilities } from "../src/domain/product-daily";
import { readDailyDashboard } from "../src/application/daily-dashboard";
import { Favorites } from "../src/application/favorites";
import type { Favorite } from "../src/domain/models";
import type { GameDateIndex, GameIndexRow } from "../src/domain/npb-game-index";
import type { PostseasonSeries } from "../src/domain/competition";
const row = (id: string, date: string, status: GameIndexRow["status"] = "final", number = 1): GameIndexRow => ({ gameId: `npb:game:${id}`, date, status, gameNumber: number, scheduledTime: null, home: { id: "npb:team:tigers", name: "阪神", score: null }, away: { id: "npb:team:baystars", name: "DeNA", score: null }, completeness: null, battingAvailable: false, pitchingAvailable: false, detailAvailable: false });
const page = (date: string, games: GameIndexRow[] = [], coverage: GameDateIndex["coverage"] = "unknown"): GameDateIndex => ({ schemaVersion: 1, league: "NPB", date, games, coverage, generatedAt: "2026-10-03T00:00:00Z" });
describe("current daily semantics", () => {
  it("uses Tokyo midnight independently of UTC and the device timezone", () => { expect(tokyoToday(new Date("2026-10-02T14:59:59Z"))).toBe("2026-10-02"); expect(tokyoToday(new Date("2026-10-02T15:00:00Z"))).toBe("2026-10-03"); });
  it.each(["unknown", "partial", "failed", "complete"] as const)("does not turn empty %s into confirmed no games", status => { expect(dailyGames("2026-10-03", [page("2026-10-03", [], status)], "2026-10-02").todayState).toBe("unconfirmed"); });
  it("distinguishes confirmed no games from a missing current page", () => { expect(dailyGames("2026-10-03", [page("2026-10-03", [], "no_games")], "2026-10-02").todayState).toBe("no_games"); expect(dailyGames("2026-10-03", [], "2026-10-02").todayState).toBe("unavailable"); });
  it("does not relabel an old final as Today or expose future finals as recent", () => { const value = dailyGames("2026-10-03", [page("2026-10-02", [row("old", "2026-10-02")]), page("2026-10-04", [row("future", "2026-10-04")])], "2026-10-02"); expect(value.today).toEqual([]); expect(value.recent.map(r => r.gameId)).toEqual(["npb:game:old"]); expect(value.next).toEqual([]); });
  it("orders doubleheaders without mutating the source", () => { const games = [row("second", "2026-10-03", "scheduled", 2), row("first", "2026-10-03", "scheduled")]; expect(dailyGames("2026-10-03", [page("2026-10-03", games)], "2026-10-02").today[0]!.gameNumber).toBe(1); expect(games[0]!.gameNumber).toBe(2); });
  it("only lists explicitly scheduled future games", () => { const rows = [row("a", "2026-10-04", "postponed"), row("b", "2026-10-04", "unknown"), row("c", "2026-10-05", "scheduled")]; expect(dailyGames("2026-10-03", [page("2026-10-04", rows)], "2026-10-02").next.map(r => r.gameId)).toEqual(["npb:game:c"]); });
  it("clips lookaround to saved bounds, limits requests, and preserves failed-date state", async () => { const date = vi.fn(async (d: string) => { if (d === "2026-10-04") throw Error("offline"); return page(d); }); const reader = { manifest: async () => ({ schemaVersion: 1 as const, league: "NPB" as const, from: "2026-03-27", to: "2026-10-07", effectiveDate: "2026-10-02", generatedAt: "2026-10-03T00:00:00Z" }), date, recent: vi.fn(), records: vi.fn() }; const result = await readDailyDashboard(reader, "2026-10-03"); expect(date).toHaveBeenCalledTimes(12); expect(result.failedDates).toEqual(["2026-10-04"]); expect(reader.recent).not.toHaveBeenCalled(); });
  it("rejects misdated indexes rather than treating them as current evidence", async () => { const result = await readDailyDashboard({ manifest: async () => ({ schemaVersion: 1, league: "NPB", from: "2026-10-03", to: "2026-10-03", effectiveDate: "2026-10-02", generatedAt: "2026-10-03T00:00:00Z" }), date: async () => page("2026-10-02"), recent: vi.fn(), records: vi.fn() }, "2026-10-03"); expect(result.todayState).toBe("unavailable"); expect(result.failedDates).toHaveLength(1); });
  it("declares no MLB current Today/Preview capability", () => { expect(dailyProductCapabilities.MLB.today).toBe(false); expect(dailyProductCapabilities.MLB.preview).toBe(false); expect(dailyProductCapabilities.MLB.historicalOnly).toBe(true); });
});
describe("objective recap numbers", () => {
  const batter = { playerId: "a", name: "選手", teamId: "t", pa: 4, hits: 2, homeRuns: 0, rbi: null };
  const pitcher = { playerId: "p", name: "投手", teamId: "t", outs: 18, runs: 1, so: 7 };
  it("selects multi-hit and home-run games using known values", () => { expect(recapNumbers([batter, { ...batter, playerId: "b", hits: 1, homeRuns: 1 }], []).batting.map(p => p.playerId)).toEqual(["b", "a"]); });
  it("never treats missing runs/outs/hits as zero or success", () => { expect(recapNumbers([{ ...batter, hits: null, homeRuns: null }], [{ ...pitcher, runs: null }, { ...pitcher, outs: null }])).toEqual({ batting: [], pitching: [] }); });
  it.each([[18, 1, 1], [17, 1, 0], [3, 0, 1], [0, 0, 0], [21, 2, 0]])("pitching threshold outs %s runs %s => %s", (outs, runs, expected) => { expect(recapNumbers([], [{ ...pitcher, outs: outs!, runs: runs! }]).pitching).toHaveLength(expected!); });
});
describe("Series impact at the game, not eventual outcome", () => {
  const series = { teams: [{ teamId: "a", advantageWins: 1 }, { teamId: "b", advantageWins: 0 }], games: [{ gameId: "1", status: "final", winnerId: "b" }, { gameId: "2", status: "final", winnerId: "a" }, { gameId: "3", status: "final", winnerId: "a" }] } as PostseasonSeries;
  it("counts only the played prefix and separately retains the rule advantage", () => { expect(seriesAfterGame(series, "1")).toEqual([{ teamId: "a", played: 0, advantage: 1, total: 1 }, { teamId: "b", played: 1, advantage: 0, total: 1 }]); });
  it("does not fabricate results across an unconfirmed game", () => { expect(seriesAfterGame({ ...series, games: series.games.map((g, i) => i === 0 ? { ...g, status: "suspended" } : g) }, "2")).toBeNull(); expect(seriesAfterGame(series, "missing")).toBeNull(); });
});
describe("Team Favorites preserve the existing v1 player store", () => {
  it("supports duplicate-safe add/remove, both leagues, reload and offline without erasing players", async () => {
    const player: Favorite = { league: "NPB", kind: "player", entityId: "00000000-0000-4000-8000-000000000001", addedAt: "2026-10-03T00:00:00Z" };
    let raw = JSON.stringify({ version: 1, items: [player] }); const storage = { get: async () => raw, set: vi.fn(async (_key: string, data: string) => { raw = data; }) };
    const npb: Favorite = { ...player, kind: "team", entityId: "npb:team:tigers" }, mlb: Favorite = { ...npb, league: "MLB", entityId: "mlb:team:00000000-0000-4000-8000-000000000002" };
    const store = new Favorites(storage, () => Date.parse("2026-10-03T00:00:00Z")); await store.add(npb); await store.add(npb); await store.add(mlb);
    expect(storage.set).toHaveBeenCalledTimes(2); const reload = new Favorites(storage); expect((await reload.list()).map(f => ({...f,addedAt:player.addedAt}))).toEqual([player, npb, mlb]); await reload.remove(npb); expect((await reload.list()).map(f => ({...f,addedAt:player.addedAt}))).toEqual([player, mlb]);
  });
});
describe("daily data through the existing persistent cache", () => {
  it("restores validated dated indexes offline after repository/store restart", async () => {
    const name = "product-daily-persistent";
    const request = vi.fn<typeof fetch>(async url => String(url).endsWith("manifest.json") ? Response.json({ schemaVersion: 1, league: "NPB", from: "2026-10-02", to: "2026-10-03", effectiveDate: "2026-10-02", generatedAt: "2026-10-03T00:00:00Z" }) : String(url).includes("2026-10-02") ? Response.json(page("2026-10-02", [row("past", "2026-10-02")], "complete")) : Response.json(page("2026-10-03", [row("next", "2026-10-03", "scheduled")])));
    const online = new StaticGameSurfaceRepository("https://public.test/", createPublicFetch(new PublicResponseStore(name), request, () => true));
    const before = await readDailyDashboard(online, "2026-10-03");
    const offline = new StaticGameSurfaceRepository("https://public.test/", createPublicFetch(new PublicResponseStore(name), request, () => false));
    const after = await readDailyDashboard(offline, "2026-10-03"); expect(after).toEqual(before); expect(request).toHaveBeenCalledTimes(3);
  });
  it("does not fabricate a dashboard on uncached first launch offline", async () => {
    const request = vi.fn<typeof fetch>(); const reader = new StaticGameSurfaceRepository("https://empty.test/", createPublicFetch(new PublicResponseStore("product-daily-empty"), request, () => false));
    await expect(readDailyDashboard(reader, "2026-10-03")).rejects.toThrow("Offline"); expect(request).not.toHaveBeenCalled();
  });
});
