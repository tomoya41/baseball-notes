import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerPeriodComparisonService } from "../src/application/player-period-comparison";
import { PlayerPeriodService } from "../src/application/player-period";
import { NpbPeriodCoverageRepository } from "../src/data/npb-period-coverage-repository";
import type { DataClient } from "../src/data/database";
import { playerGameBattingSchema, playerGamePitchingSchema } from "../src/domain/game-facts";
import { resolvePlayerPeriod } from "../src/domain/player-period";
import { unavailablePeriodCoverage } from "../src/domain/period-coverage";
import { comparisonPeriods, type PlayerPeriodComparison } from "../src/domain/player-period-comparison";
import { playerRecentResponseSchema } from "../src/domain/player-recent";
import { HttpPlayerPeriodComparisonRepository } from "../src/infrastructure/providers/http-player-period-comparison-repository";
import { NpbPlayerAnalysisScreen } from "../src/ui/npb-player-analysis";

const playerId = "06a3e027-7a73-4792-9c91-8ecc3c1da36a";
const asOfDate = "2026-09-25";
const now = new Date("2026-09-26T00:00:00.000Z");
const source = { playerId, teamId: "npb:team:eagles", opponentTeamId: "npb:team:fighters",
  sourceKey: "nf3", sourceRecordId: "row", collectedAt: now.toISOString() };
const player = { id: playerId, name: "中島大輔", teamId: source.teamId, teamName: "楽天" };
function batting(gameId: string, patch: Record<string, unknown> = {}) {
  return playerGameBattingSchema.parse({ ...source, gameId, battingOrder: 1, pa: 5, ab: 4, runs: 1,
    hits: 2, doubles: 1, triples: 0, homeRuns: 0, rbi: 1, walks: 1, hbp: 0,
    sacrificeHits: 0, sacrificeFlies: 0, strikeouts: 1, stolenBases: 0, caughtStealing: 0,
    starter: true, ...patch });
}
function pitching(gameId: string, patch: Record<string, unknown> = {}) {
  return playerGamePitchingSchema.parse({ ...source, id: gameId, gameId, role: "reliever", starter: false,
    appearanceOrder: null, inningsPitchedOuts: 4, battersFaced: 6, hits: 2, homeRuns: 0,
    walks: null, hitBatters: null, walksAndHitBatters: 1, strikeouts: 2, runs: 0,
    earnedRuns: 0, pitches: 27, catcherId: null, decision: "none", ...patch });
}
const battingRows = [
  { date: "2026-09-24", fact: batting("new") },
  { date: "2026-09-16", fact: batting("middle", { pa: 4, ab: 3, hits: 1, doubles: 0, walks: 1 }) },
  { date: "2026-08-30", fact: batting("old", { pa: 5, ab: 5, hits: 1, doubles: 0, walks: 0 }) },
];
const pitchingRows = [
  { date: "2026-09-24", fact: pitching("new") },
  { date: "2026-09-16", fact: pitching("middle", { inningsPitchedOuts: 3, battersFaced: 5,
    earnedRuns: 1, runs: 1, strikeouts: 0 }) },
  { date: "2026-08-30", fact: pitching("old", { inningsPitchedOuts: 6, battersFaced: 8,
    earnedRuns: 2, runs: 2, strikeouts: 4 }) },
];
function setup(coverageStatuses: readonly ("complete" | "partial" | "unknown" | "unavailable")[] = ["complete", "unknown", "partial"]) {
  const facts = { findPlayerIdentity: vi.fn(async () => player),
    findDatedBattingByPlayer: vi.fn(async () => battingRows),
    findDatedPitchingByPlayer: vi.fn(async () => pitchingRows) };
  const coverage = { findPeriodCoverages: vi.fn(async (windows: Parameters<NpbPeriodCoverageRepository["findPeriodCoverages"]>[0]) =>
    windows.map((window, index) => ({ ...unavailablePeriodCoverage(window), status: coverageStatuses[index]! }))) };
  return { facts, coverage, service: new PlayerPeriodComparisonService(facts, coverage, () => now) };
}

describe("NPB Player Analysis from saved Game Facts", () => {
  it("reads 30 days once per role and reuses the same aggregators for nested 7/14/30 calendar periods", async () => {
    const { facts, coverage, service } = setup();
    const response = (await service.find(playerId, asOfDate))!.payload;
    expect(facts.findDatedBattingByPlayer).toHaveBeenCalledOnce();
    expect(facts.findDatedPitchingByPlayer).toHaveBeenCalledOnce();
    expect(facts.findDatedBattingByPlayer).toHaveBeenCalledWith(playerId, "2026-08-27", asOfDate);
    expect(coverage.findPeriodCoverages).toHaveBeenCalledOnce();
    expect(comparisonPeriods.map((period) => response.periods[period].batting?.factCount)).toEqual([1, 2, 3]);
    expect(comparisonPeriods.map((period) => response.periods[period].pitching?.factCount)).toEqual([1, 2, 3]);
    expect(response.periods["7d"].batting).toMatchObject({ from: "2026-09-19", to: asOfDate,
      metrics: { PA: { value: 5 }, AVG: { value: 0.5 }, OBP: { value: 0.6 }, SLG: { value: 0.75 }, OPS: { value: 1.35 } } });
    expect(response.periods["14d"].batting).toMatchObject({ from: "2026-09-12", metrics: { PA: { value: 9 }, H: { value: 3 } } });
    expect(response.periods["30d"].batting!.metrics.AVG!.value!).toBeCloseTo(4 / 12);
    expect(response.periods["7d"].pitching).toMatchObject({ metrics: { outsRecorded: { value: 4 },
      BF: { value: 6 }, ERA: { value: 0 }, K9: { value: 13.5 }, WHIP: { value: null, status: "unavailable" } } });
    expect(response.periods["14d"].pitching!.metrics.ERA!.value!).toBeCloseTo(27 / 7);
    expect(response.periods["30d"].pitching!.metrics.K9!.value!).toBeCloseTo(6 * 27 / 13);
    expect(comparisonPeriods.map((period) => response.periods[period].coverage.status)).toEqual(["complete", "unknown", "partial"]);
  });

  it("matches Player Recent for the same facts, window and Coverage, including both roles", async () => {
    const { service } = setup();
    const analysis = (await service.find(playerId, asOfDate))!.payload;
    const recentFacts = { findBattingByPlayer: async (_id: string, from: string, to: string) =>
      battingRows.filter((row) => row.date >= from && row.date <= to).map((row) => row.fact),
    findPitchingByPlayer: async (_id: string, from: string, to: string) =>
      pitchingRows.filter((row) => row.date >= from && row.date <= to).map((row) => row.fact) };
    const recentCoverage = { findPeriodCoverage: async (window: ReturnType<typeof resolvePlayerPeriod>) =>
      ({ ...unavailablePeriodCoverage(window), status: window.from === "2026-09-19" ? "complete" as const :
        window.from === "2026-09-12" ? "unknown" as const : "partial" as const }) };
    const recent = new PlayerPeriodService(recentFacts, () => now, recentCoverage);
    for (const period of comparisonPeriods) {
      const query = { playerId, asOfDate, period };
      const recentBatting = await recent.batting(query);
      const recentPitching = await recent.pitching(query);
      const serialized = playerRecentResponseSchema.parse({ player, asOfDate, period,
        batting: recentBatting, pitching: recentPitching });
      expect(analysis.periods[period].batting).toEqual(serialized.batting);
      expect(analysis.periods[period].pitching).toEqual(serialized.pitching);
    }
  });

  it("keeps partial metrics missing rather than zero, and handles no-Fact players and corrected Facts", async () => {
    const { service, facts } = setup();
    facts.findDatedBattingByPlayer.mockResolvedValueOnce([
      { date: "2026-09-24", fact: batting("new", { walks: null }) },
      { date: "2026-09-23", fact: batting("second") },
    ]);
    const partial = (await service.find(playerId, asOfDate))!.payload;
    expect(partial.periods["7d"].batting?.metrics.OPS).toMatchObject({ status: "partial", value: null });
    const before = (await service.find(playerId, asOfDate))!.payload;
    facts.findDatedBattingByPlayer.mockResolvedValueOnce(battingRows.map((row, index) =>
      index === 0 ? { ...row, fact: { ...row.fact, hits: 3 } } : row));
    const after = (await service.find(playerId, asOfDate))!.payload;
    expect(after.periods["7d"].batting!.metrics.H!.value).toBe((before.periods["7d"].batting!.metrics.H!.value ?? 0) + 1);
    facts.findDatedBattingByPlayer.mockResolvedValueOnce([]);
    facts.findDatedPitchingByPlayer.mockResolvedValueOnce([]);
    const empty = (await service.find(playerId, asOfDate))!.payload;
    expect(empty.periods["30d"]).toMatchObject({ batting: null, pitching: null });
  });

  it("returns the same values for all periods when only one saved day exists, including 敬遠 as the recorded BB", async () => {
    const { service, facts } = setup(["unknown", "unknown", "unknown"]);
    facts.findDatedBattingByPlayer.mockResolvedValue([{ date: "2026-09-25", fact: batting("sakamoto", {
      pa: 3, ab: 2, hits: 0, doubles: 0, walks: 1, rbi: 0, runs: 0,
    }) }]);
    facts.findDatedPitchingByPlayer.mockResolvedValue([]);
    const value = (await service.find(playerId, asOfDate))!.payload;
    expect(comparisonPeriods.map((period) => value.periods[period].batting?.metrics.PA?.value)).toEqual([3, 3, 3]);
    expect(comparisonPeriods.map((period) => value.periods[period].batting?.metrics.AB?.value)).toEqual([2, 2, 2]);
    expect(comparisonPeriods.map((period) => value.periods[period].batting?.metrics.BB?.value)).toEqual([1, 1, 1]);
    expect(comparisonPeriods.map((period) => value.periods[period].batting?.metrics.OBP?.value)).toEqual([1 / 3, 1 / 3, 1 / 3]);
  });

  it("shares three Coverage SQL reads across all three periods", async () => {
    const sql: string[] = [];
    const client = { execute: vi.fn(async (input: string | { sql: string }) => {
      sql.push(typeof input === "string" ? input : input.sql);
      return { rows: [] };
    }) } as unknown as DataClient;
    const windows = comparisonPeriods.map((period) => resolvePlayerPeriod({ playerId, asOfDate, period }));
    const values = await new NpbPeriodCoverageRepository(client).findPeriodCoverages(windows);
    expect(sql).toHaveLength(3);
    expect(values.map((value) => value.status)).toEqual(["unknown", "unknown", "unknown"]);
    expect(values.map((value) => value.summary.dates)).toEqual([7, 14, 30]);
  });
});

describe("NPB Player Analysis UI", () => {
  const render = (payload: PlayerPeriodComparison | null, state: "loading" | "ready" | "missing" | "error" = "ready") =>
    renderToStaticMarkup(<NpbPlayerAnalysisScreen payload={payload} state={state} />);

  it("shows batter and pitcher period comparison with samples and Coverage, without WHIP", async () => {
    const payload = (await setup().service.find(playerId, asOfDate))!.payload;
    const html = render(payload);
    expect(html).toContain("OPSの期間比較");
    expect(html).toContain("ERAの期間比較");
    expect(html).toContain("7日");
    expect(html).toContain("14日");
    expect(html).toContain("30日");
    expect(html).toContain("集計対象と内訳");
    expect(html).toContain("一部期間の収集状況を確認できません");
    expect(html).toContain("一部データ未収集");
    expect(html).not.toContain("WHIP");
    expect(html).not.toContain("シーズン全体");
  });

  it("distinguishes loading, error, empty and unavailable metrics", async () => {
    expect(render(null, "loading")).toContain("skeleton");
    expect(render(null, "error")).toContain("分析データを取得できませんでした");
    expect(render(null, "missing")).toContain("分析できる試合データがまだありません");
    const { service, facts } = setup(["unavailable", "unavailable", "unavailable"]);
    facts.findDatedBattingByPlayer.mockResolvedValue([]);
    facts.findDatedPitchingByPlayer.mockResolvedValue([]);
    expect(render((await service.find(playerId, asOfDate))!.payload)).toContain("分析できる試合データがまだありません");
    const withNull = setup();
    withNull.facts.findDatedBattingByPlayer.mockResolvedValue([{ date: "2026-09-24", fact: batting("new", { walks: null }) }]);
    withNull.facts.findDatedPitchingByPlayer.mockResolvedValue([]);
    const html = render((await withNull.service.find(playerId, asOfDate))!.payload);
    expect(html).toContain("—");
    expect(html).toContain("収集確認済み");
  });

  it("validates HTTP analysis responses and rejects mismatched identity without a Mock fallback", async () => {
    const payload = (await setup().service.find(playerId, asOfDate))!.payload;
    const repository = new HttpPlayerPeriodComparisonRepository("https://example.test/", async () =>
      new Response(JSON.stringify(payload), { status: 200 }));
    expect((await repository.find(playerId))?.periods["7d"].batting?.metrics.PA?.value).toBe(5);
    await expect(repository.find("11111111-1111-4111-8111-111111111111")).rejects.toThrow("identity mismatch");
    const broken = new HttpPlayerPeriodComparisonRepository("https://example.test/", async () => new Response("{}"));
    await expect(broken.find(playerId)).rejects.toThrow();
  });
});
