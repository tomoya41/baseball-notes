import { describe, expect, it } from "vitest";
import { evaluateHotCandidates, compareHotCandidates } from "../src/application/npb-hot-candidates";
import type { PlayerPeriodBatchResult } from "../src/application/player-period-batch";
import { aggregateBatting, aggregatePitching } from "../src/domain/player-period";
import type { BattingPeriodResult, PitchingPeriodResult } from "../src/domain/player-period";
import { unavailablePeriodCoverage } from "../src/domain/period-coverage";
import type { PeriodCoverageStatus } from "../src/domain/period-coverage";
import { playerGameBattingSchema, playerGamePitchingSchema } from "../src/domain/game-facts";

const window = { from: "2026-09-18", to: "2026-09-24", timeZone: "Asia/Tokyo" as const };
const query = { asOfDate: window.to, period: "7d" as const };
const now = new Date("2026-09-25T00:00:00Z");
const source = { sourceKey: "nf3", sourceRecordId: "fixture", collectedAt: now.toISOString() };
function coverage(status: PeriodCoverageStatus) {
  return { ...unavailablePeriodCoverage(window), status };
}
function batter(playerId: string, ops: number, pa: number, status: PeriodCoverageStatus = "complete",
  homeRuns = 0, hits = 2): BattingPeriodResult {
  const fact = playerGameBattingSchema.parse({ ...source, gameId: playerId, playerId, teamId: "T",
    opponentTeamId: "G", battingOrder: 1, pa, ab: Math.max(pa - 1, hits), runs: 1,
    hits, doubles: 0, triples: 0, homeRuns, rbi: 1, walks: 1, hbp: 0,
    sacrificeHits: 0, sacrificeFlies: 0, strikeouts: 1, stolenBases: null,
    caughtStealing: null, starter: true });
  const result = aggregateBatting({ ...query, playerId }, [fact], now, coverage(status));
  return { ...result, metrics: { ...result.metrics, OPS: { ...result.metrics.OPS, value: ops } } };
}
function pitcher(playerId: string, era: number, k9: number, outs: number, starts: number,
  appearances: number, status: PeriodCoverageStatus = "complete"): PitchingPeriodResult {
  const facts = Array.from({ length: appearances }, (_, index) => playerGamePitchingSchema.parse({
    ...source, id: `${playerId}:${index}`, gameId: `${playerId}:${index}`, playerId,
    teamId: "T", opponentTeamId: "G", role: index < starts ? "starter" : "reliever",
    starter: index < starts, appearanceOrder: null,
    inningsPitchedOuts: index === 0 ? outs : 0, battersFaced: index === 0 ? Math.max(outs, 1) : 1,
    hits: 0, homeRuns: 0, walks: null, hitBatters: null, walksAndHitBatters: 0,
    strikeouts: index === 0 ? Math.round(k9 * outs / 27) : 0,
    runs: 0, earnedRuns: 0, pitches: 10, catcherId: null,
    decision: index === 0 ? "hold" : "save",
  }));
  const result = aggregatePitching({ ...query, playerId }, facts, now, coverage(status));
  return { ...result, metrics: { ...result.metrics,
    ERA: { ...result.metrics.ERA, value: era, status: "complete" },
    K9: { ...result.metrics.K9, value: k9, status: "complete" } } };
}
function batch(batters: BattingPeriodResult[], pitchers: PitchingPeriodResult[] = []): PlayerPeriodBatchResult {
  return { period: "7d", window, coverage: coverage("complete"), batters, pitchers,
    summary: { batterPlayers: batters.length, pitcherPlayers: pitchers.length,
      uniquePlayers: new Set([...batters, ...pitchers].map((row) => row.playerId)).size,
      battingFacts: batters.length, pitchingFacts: pitchers.length,
      coverage: { complete: 0, partial: 0, unknown: 0, unavailable: 0 } },
    timings: { dbReadMs: 0, aggregationMs: 0, totalMs: 0 } };
}

describe("transparent 7d HOT candidates", () => {
  it("ranks qualified batters by OPS, PA, HR, H, then canonical ID", () => {
    const result = evaluateHotCandidates(batch([
      batter("b-low-pa", 1.3, 8), batter("b-partial", 1.4, 30, "partial"),
      batter("b-second", .98, 30), batter("b-best", 1.2, 28),
      batter("z-id", 1.0, 28, "complete", 1, 3),
      batter("a-id", 1.0, 28, "complete", 1, 3),
      batter("h-more", 1.0, 28, "complete", 1, 4),
      batter("hr-more", 1.0, 28, "complete", 2, 3),
      batter("pa-more", 1.0, 29),
    ]), { limit: 5 });
    expect(result.top.batter.map((row) => row.playerId))
      .toEqual(["b-best", "pa-more", "hr-more", "h-more", "a-id"]);
    expect(result.eligibleCounts.batter).toBe(7);
    expect(result.candidates.find((row) => row.playerId === "b-low-pa")?.eligibilityReasons)
      .toContain("insufficient_sample");
    expect(result.candidates.find((row) => row.playerId === "b-partial")?.eligibilityReasons)
      .toContain("coverage_not_complete");
    expect(result.top.batter[0]?.reason).toBe("直近7日 OPS 1.200");
    expect(result.top.batter[0]?.rankInputs.primary).toBe(1.2);
    expect(result.top.batter[0]?.rankInputs.first).toBe(28);
    expect(result.top.batter[0]?.rankInputs.playerId).toBe("b-best");
    expect(result.candidates.find((row) => row.playerId === "z-id")?.eligibility).toBe("eligible");
  });

  it("gates incomplete ranking metrics separately from collection coverage", () => {
    const partial = batter("partial", 1.2, 28);
    partial.metrics.OPS = { ...partial.metrics.OPS, value: null, status: "partial" };
    const missing = batter("missing", 1.2, 28);
    missing.metrics.OPS = { ...missing.metrics.OPS, value: null, status: "unavailable" };
    const missingTie = batter("missing-tie", 1.2, 28);
    missingTie.metrics.HR = { ...missingTie.metrics.HR, value: null, status: "unavailable" };
    const result = evaluateHotCandidates(batch([partial, missing, missingTie]));
    expect(result.top.batter).toEqual([]);
    expect(result.candidates.map((row) => row.eligibilityReasons)).toEqual([
      ["metric_partial"], ["metric_unavailable"], ["metric_unavailable"]]);
    expect(result.coverageComplete.batter).toBe(3);
    expect(result.productionGate.ready).toBe(false);
  });

  it("separates starters and relievers, applies outs/appearance gates, and breaks ERA ties by K/9", () => {
    const result = evaluateHotCandidates(batch([], [
      pitcher("starter-best", .75, 10, 36, 1, 1),
      pitcher("starter-short", 0, 20, 6, 1, 1),
      pitcher("starter-next", 1.2, 11, 39, 1, 1),
      pitcher("reliever-one", 0, 20, 6, 0, 1),
      pitcher("reliever-short", 0, 18, 5, 0, 2),
      pitcher("reliever-k9", 0, 13.5, 6, 0, 2),
      pitcher("reliever-k9-low", 0, 9, 9, 0, 2),
    ]));
    expect(result.top.starter.map((row) => row.playerId)).toEqual(["starter-best", "starter-next"]);
    expect(result.top.reliever.map((row) => row.playerId)).toEqual(["reliever-k9", "reliever-k9-low"]);
    expect(result.candidates.find((row) => row.playerId === "starter-short")?.eligibilityReasons)
      .toContain("insufficient_sample");
    expect(result.candidates.find((row) => row.playerId === "reliever-one")?.eligibilityReasons)
      .toContain("insufficient_sample");
    expect(result.candidates.find((row) => row.playerId === "reliever-short")?.eligibilityReasons)
      .toContain("insufficient_sample");
    expect(result.top.reliever[0]?.primaryMetric.id).toBe("ERA");
    const topReliever = result.top.reliever[0];
    expect(topReliever?.role).toBe("reliever");
    if (topReliever?.role === "reliever") expect(topReliever.stats.metrics.WHIP.status).toBe("unavailable");
  });

  it("keeps HLD/SV out of rank inputs, handles zero outs, and has stable identity ties", () => {
    const zero = pitcher("zero", 0, 0, 0, 0, 2);
    zero.metrics.ERA = { ...zero.metrics.ERA, value: null, status: "unavailable" };
    const a = pitcher("a", 0, 9, 6, 0, 2);
    const z = pitcher("z", 0, 9, 6, 0, 2);
    a.metrics.HLD.value = 0; a.metrics.SV.value = 0;
    z.metrics.HLD.value = 2; z.metrics.SV.value = 2;
    const one = evaluateHotCandidates(batch([], [z, zero, a]));
    const two = evaluateHotCandidates(batch([], [a, z, zero]));
    expect(one.top.reliever.map((row) => row.playerId)).toEqual(["a", "z"]);
    expect(two.top.reliever.map((row) => row.playerId)).toEqual(["a", "z"]);
    expect(one.candidates.find((row) => row.playerId === "zero")?.eligibilityReasons)
      .toContain("insufficient_sample");
    expect(Object.keys(one.top.reliever[0]!.rankInputs)).not.toContain("WHIP");
    const otherRole = evaluateHotCandidates(batch([batter("b", 1, 28)])).top.batter[0]!;
    expect(() => compareHotCandidates(one.top.reliever[0]!, otherRole)).toThrow();
  });

  it("keeps all excluded candidates for diagnostics and closes production with zero eligible", () => {
    const result = evaluateHotCandidates(batch([batter("unknown", 1.5, 30, "unknown")],
      [pitcher("partial", 0, 10, 18, 1, 1, "partial")]));
    expect(result.candidates).toHaveLength(2);
    expect(result.eligibleCounts).toEqual({ batter: 0, starter: 0, reliever: 0 });
    expect(result.productionGate).toEqual({ ready: false,
      roleReady: { batter: false, starter: false, reliever: false }, reason: "no_eligible_candidates" });
    expect(evaluateHotCandidates(batch([])).productionGate.ready).toBe(false);
    expect(() => evaluateHotCandidates(batch([]), { limit: -1 })).toThrow();
    expect(() => evaluateHotCandidates({ ...batch([]), period: "14d" })).toThrow();
  });

  it("opens the three-role gate only for complete, qualified fixtures", () => {
    const ready = evaluateHotCandidates(batch([batter("b", 1.2, 28)], [
      pitcher("s", .75, 10, 36, 1, 1), pitcher("r", 0, 13.5, 6, 0, 2),
    ]));
    expect(ready.productionGate.ready).toBe(true);
    expect(ready.eligibleCounts).toEqual({ batter: 1, starter: 1, reliever: 1 });
    const inaccessible = evaluateHotCandidates(batch([batter("b", 1.2, 28, "unavailable")]));
    expect(inaccessible.candidates[0]?.eligibilityReasons).toContain("coverage_not_complete");
    expect(inaccessible.productionGate.ready).toBe(false);
  });

  it("requires verified division metadata, filters by division, and accepts a configurable sample policy", () => {
    const rows = batch([batter("central", 1.1, 18), batter("pacific", 1.2, 30)]);
    expect(() => evaluateHotCandidates(rows, { division: "Central" })).toThrow();
    const metadata = new Map([["central", { division: "Central" as const, teamId: "T" }],
      ["pacific", { division: "Pacific" as const, teamId: "H" }]]);
    const result = evaluateHotCandidates(rows, { division: "Central", metadata,
      samplePolicy: { batterPa: 18, starterGs: 1, starterOuts: 15, relieverAppearances: 2, relieverOuts: 6 } });
    expect(result.candidates.map((row) => row.playerId)).toEqual(["central"]);
    expect(result.top.batter[0]?.metadata?.teamId).toBe("T");
    expect(result.top.batter[0]?.sample).toMatchObject({ pa: 18, ab: 17 });
  });
});
