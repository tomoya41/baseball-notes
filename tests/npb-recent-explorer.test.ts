import { describe, expect, it, vi } from "vitest";
import { PlayerPeriodBatchService } from "../src/application/player-period-batch";
import { buildNpbRecentExplorer, npbRecentExplorerSchema } from "../src/application/npb-recent-explorer";
import { readNpbRecentExplorer } from "../src/application/explorer-readers";
import { playerGameBattingSchema, playerGamePitchingSchema } from "../src/domain/game-facts";
import type { NpbPlayerDirectory } from "../src/domain/npb-player-directory";
import { evaluatePeriodCoverage, periodDates } from "../src/domain/period-coverage";
import { explorerQuery, exploreRows } from "../src/domain/data-explorer";
const id = "00000000-0000-4000-8000-000000000001";
const source = { sourceKey: "nf3", sourceRecordId: "private", collectedAt: "2026-10-04T00:00:00Z" };
const b = playerGameBattingSchema.parse({ ...source, playerId: id, gameId: "game", teamId: "team", opponentTeamId: "other", battingOrder: 1, pa: 5, ab: 4, runs: 1, hits: 2, doubles: 1, triples: 0, homeRuns: 0, rbi: 1, walks: 1, hbp: 0, sacrificeHits: 0, sacrificeFlies: 0, strikeouts: 1, stolenBases: null, caughtStealing: null, starter: true });
const p = playerGamePitchingSchema.parse({ ...source, id: "p", playerId: id, gameId: "game", teamId: "team", opponentTeamId: "other", role: "reliever", starter: false, appearanceOrder: null, inningsPitchedOuts: 2, battersFaced: 3, hits: 1, homeRuns: 0, walks: null, hitBatters: null, walksAndHitBatters: 1, strikeouts: 1, runs: 0, earnedRuns: 0, pitches: 12, catcherId: null, decision: "none" });
const directory = { effectiveDate: "2026-10-03", players: [{ playerId: id, displayName: "選手", teamId: "team" }] } as NpbPlayerDirectory;
async function build(days: 7 | 14 | 30) {
  const facts = { findPeriodPlayerIds: vi.fn(async () => ({ batters: [id], pitchers: [id] })), findBattingByPeriod: vi.fn(async () => [b]), findPitchingByPeriod: vi.fn(async () => [p]) };
  const batch = await new PlayerPeriodBatchService(facts, { findPeriodCoverage: async w => evaluatePeriodCoverage(w, periodDates(w).map((date, i) => ({ date, dayStatus: i === 0 ? "partial" : "no_games", gamesStageStatus: "complete", finalGames: 0, completeGames: 0, partialGames: 0, failedGames: 0 })), []) }).aggregate({ asOfDate: directory.effectiveDate, period: `${days}d` });
  return { batch, facts, payload: buildNpbRecentExplorer(batch, directory) };
}
describe("coordinated all-player Recent projection", () => {
  it.each([7, 14, 30] as const)("projects %s calendar days through bulk reads without ranking or provider IDs", async days => {
    const { payload, facts } = await build(days);
    expect(payload.period.to).toBe(directory.effectiveDate); expect(payload.coverage.summary.dates).toBe(days); expect(payload.coverage.status).toBe("partial");
    expect(payload.players).toHaveLength(1); expect(payload.players[0]!.batting!.metrics.PA!.value).toBe(5);
    expect(payload.players[0]!.batting!.metrics.SB!.value).toBeNull(); expect(payload.players[0]!.pitching!.metrics.outsRecorded!.value).toBe(2);
    expect(payload.players[0]!.pitching!.metrics).not.toHaveProperty("WHIP"); expect(JSON.stringify(payload)).not.toContain("private"); expect(payload).not.toHaveProperty("rankings");
    expect(facts.findBattingByPeriod).toHaveBeenCalledExactlyOnceWith(payload.period.from, payload.period.to, null, undefined);
    expect(facts.findPitchingByPeriod).toHaveBeenCalledTimes(1);
  });
  it("rejects shifted dates, duplicated identities, incorrect coverage and missing display metadata", async () => {
    const { batch, payload } = await build(14);
    expect(() => buildNpbRecentExplorer(batch, { ...directory, effectiveDate: "2026-10-02" })).toThrow();
    expect(() => buildNpbRecentExplorer(batch, { ...directory, players: [] })).toThrow();
    expect(npbRecentExplorerSchema.safeParse({ ...payload, period: { ...payload.period, from: "2026-09-01" } }).success).toBe(false);
    expect(npbRecentExplorerSchema.safeParse({ ...payload, players: [...payload.players, ...payload.players] }).success).toBe(false);
    expect(npbRecentExplorerSchema.safeParse({ ...payload, coverage: { ...payload.coverage, status: "complete" } }).success).toBe(false);
  });
  it("fetches one period file and rejects stale generation without substituting Season results", async () => {
    const { payload } = await build(7); const fetcher = vi.fn<typeof fetch>(async () => new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } }));
    expect((await readNpbRecentExplorer(7, "2026-10-03", fetcher)).players).toHaveLength(1); expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("explorer/recent/7.json");
    await expect(readNpbRecentExplorer(7, "2026-10-02", fetcher)).rejects.toThrow("generation");
    await expect(readNpbRecentExplorer(14, "2026-10-03", fetcher)).rejects.toThrow("generation");
  });
  it("supports appearance sample limits, preserves zero-outs and null metrics", () => {
    const row = { playerId: id, name: "投手", batting: null, pitching: { G: { value: 3 }, outsRecorded: { value: 0 }, ERA: { value: null } } };
    expect(exploreRows([row], explorerQuery(new URLSearchParams("role=pitching&sample=G&minimum=3")))).toHaveLength(1);
    expect(exploreRows([row], explorerQuery(new URLSearchParams("role=pitching&minimum=1")))).toHaveLength(0);
    expect(exploreRows([row], explorerQuery(new URLSearchParams("role=pitching&metric1=ERA&op1=lte&value1=3")))).toHaveLength(0);
  });
});
