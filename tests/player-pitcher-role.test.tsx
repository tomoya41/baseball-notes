import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerPitcherRoleService } from "../src/application/player-pitcher-role";
import { PlayerAnalysisBundleService } from "../src/application/player-analysis-bundle";
import { evaluateHotCandidates } from "../src/application/npb-hot-candidates";
import type { PlayerPeriodBatchResult } from "../src/application/player-period-batch";
import { playerGamePitchingSchema } from "../src/domain/game-facts";
import { classifyPitcherRole, partitionPitcherRoles } from "../src/domain/player-pitcher-role";
import { aggregatePitching, resolvePlayerPeriod } from "../src/domain/player-period";
import { unavailablePeriodCoverage } from "../src/domain/period-coverage";
import type { SituatedFact } from "../src/domain/player-home-away";
import { NpbPlayerPitcherRoleSection } from "../src/ui/npb-player-analysis";

const playerId = "6bf4b271-e16c-43f9-9142-8c7ca7de9887";
const date = "2026-09-25";
const now = new Date("2026-09-26T00:00:00Z");
const player = { id: playerId, name: "上原健太", teamId: "npb:team:fighters", teamName: "日本ハム" };
function fact(gameId: string, role: "starter" | "reliever" | "unknown", patch: Record<string, unknown> = {}) {
  return playerGamePitchingSchema.parse({ id: gameId, gameId, playerId,
    teamId: player.teamId, opponentTeamId: "npb:team:eagles", role,
    starter: role === "unknown" ? null : role === "starter", appearanceOrder: null,
    inningsPitchedOuts: 4, battersFaced: 6, hits: 2, homeRuns: 0, walks: null,
    hitBatters: null, walksAndHitBatters: 1, strikeouts: 2, runs: 0, earnedRuns: 0,
    pitches: 27, catcherId: null, decision: "none", sourceKey: "nf3",
    sourceRecordId: gameId, collectedAt: now.toISOString(), ...patch });
}
function situated(dateValue: string, pitching: ReturnType<typeof fact>): SituatedFact<ReturnType<typeof fact>> {
  return { date: dateValue, fact: pitching, homeTeamId: player.teamId,
    awayTeamId: "npb:team:eagles" };
}
function setup(rows: SituatedFact<ReturnType<typeof fact>>[]) {
  const facts = { findPlayerIdentity: vi.fn(async () => player),
    findSituatedBattingByPlayer: vi.fn(async () => []),
    findSituatedPitchingByPlayer: vi.fn(async () => rows) };
  const coverage = { findPeriodCoverage: vi.fn(async (window: ReturnType<typeof resolvePlayerPeriod>) =>
    ({ ...unavailablePeriodCoverage(window), status: "unknown" as const })),
  findPeriodCoverages: vi.fn(async (windows: ReturnType<typeof resolvePlayerPeriod>[]) =>
    windows.map((window) => ({ ...unavailablePeriodCoverage(window), status: "unknown" as const }))) };
  return { facts, coverage, service: new PlayerPitcherRoleService(facts, coverage, () => now) };
}

describe("30-day pitcher starter/reliever Analysis", () => {
  it("uses explicit role and leaves unknown or contradictory flags unclassified", () => {
    expect(classifyPitcherRole(fact("s", "starter"))).toBe("starter");
    expect(classifyPitcherRole(fact("r", "reliever"))).toBe("reliever");
    expect(classifyPitcherRole(fact("u", "unknown"))).toBe("unknown");
    expect(classifyPitcherRole(fact("bad", "starter", { starter: false }))).toBe("unknown");
    expect(classifyPitcherRole(fact("missing", "reliever", { starter: null }))).toBe("reliever");
    // The same helper is used for the Game Log label.
    expect(classifyPitcherRole({ role: "starter", starter: true })).toBe("starter");
  });

  it("keeps zero-out appearances and recomputes rates from counting stats in each role", async () => {
    const rows = [situated(date, fact("s", "starter", { inningsPitchedOuts: 17,
      battersFaced: 23, hits: 4, homeRuns: 1, strikeouts: 7, runs: 1, earnedRuns: 1,
      pitches: 86, decision: "win" })),
    situated("2026-09-24", fact("r1", "reliever", { inningsPitchedOuts: 2,
      battersFaced: 3, hits: 0, strikeouts: 1, pitches: 11, decision: "hold" })),
    situated("2026-09-23", fact("r0", "reliever", { inningsPitchedOuts: 0,
      battersFaced: 2, hits: 1, strikeouts: 0, runs: 1, earnedRuns: 1,
      pitches: 8, decision: "save" })),
    situated("2026-09-22", fact("u", "unknown", { inningsPitchedOuts: 1, battersFaced: 2 }))];
    const fixture = setup(rows);
    const result = (await fixture.service.find(playerId, date))!.payload;
    expect(fixture.facts.findSituatedPitchingByPlayer).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ totalFactCount: 4, unknownRoleAppearances: 1,
      unknownRoleOuts: 1, unknownRoleBf: 2, coverage: { status: "unknown" } });
    expect(result.starter?.metrics).toMatchObject({ appearances: { value: 1 }, GS: { value: 1 },
      outsRecorded: { value: 17 }, BF: { value: 23 }, W: { value: 1 },
      ERA: { value: 27 / 17 }, K9: { value: 189 / 17 }, WHIP: { status: "unavailable" } });
    expect(result.reliever?.metrics).toMatchObject({ appearances: { value: 2 }, GS: { value: 0 },
      outsRecorded: { value: 2 }, BF: { value: 5 }, HLD: { value: 1 }, SV: { value: 1 },
      pitchCount: { value: 19 }, ERA: { value: 13.5 }, K9: { value: 13.5 } });
    const classified = ["appearances", "outsRecorded", "BF", "H", "HR", "SO", "R", "ER", "pitchCount"] as const;
    for (const key of classified) expect(result.starter!.metrics[key]!.value! + result.reliever!.metrics[key]!.value!)
      .toBe(result.classifiedTotal!.metrics[key]!.value);
    expect(result.classifiedTotal!.metrics.ERA!.value).not.toBe(
      result.starter!.metrics.ERA!.value! + result.reliever!.metrics.ERA!.value!);
    expect(JSON.stringify(result)).not.toContain("sourceRecordId");
  });

  it("keeps nullable metrics independent and unknown data diagnosable", async () => {
    const rows = [situated(date, fact("s", "starter", { pitches: null })),
      situated("2026-09-24", fact("r", "reliever")),
      situated("2026-09-23", fact("u", "unknown", { battersFaced: null,
        inningsPitchedOuts: null }))];
    const result = (await setup(rows).service.find(playerId, date))!.payload;
    expect(result.starter?.metrics.pitchCount).toMatchObject({ status: "unavailable", value: null });
    expect(result.reliever?.metrics.pitchCount).toMatchObject({ status: "complete", value: 27 });
    expect(result).toMatchObject({ unknownRoleAppearances: 1, unknownRoleOuts: null, unknownRoleBf: null });
    expect(partitionPitcherRoles(rows).unknown).toHaveLength(1);
  });

  it("shares Bundle Facts and preserves other sections if role projection fails", async () => {
    const fixture = setup([situated(date, fact("s", "starter"))]);
    const bundle = (await new PlayerAnalysisBundleService(fixture.facts, fixture.coverage, () => now)
      .find(playerId, date))!;
    expect(fixture.facts.findSituatedPitchingByPlayer).toHaveBeenCalledOnce();
    expect(bundle.payload.pitcherRole.status).toBe("ready");
    expect(bundle.payload.comparison.status).toBe("ready");
    expect(bundle.payload.homeAway.status).toBe("ready");
    expect(bundle.payload.opponent.status).toBe("ready");
    expect(bundle.payload.battingOrder.status).toBe("ready");
    expect(bundle.payload.pitcherRole.status === "ready" && bundle.payload.pitcherRole.payload)
      .toEqual((await fixture.service.find(playerId, date))?.payload);
  });

  it("renders starter-only, reliever-only, both, unknown-only and isolated states", async () => {
    const render = async (rows: SituatedFact<ReturnType<typeof fact>>[]) => {
      const payload = (await setup(rows).service.find(playerId, date))!.payload;
      return renderToStaticMarkup(<NpbPlayerPitcherRoleSection payload={payload} state="ready" pitchingAvailable />);
    };
    const onlyStarter = await render([situated(date, fact("s", "starter"))]);
    expect(onlyStarter).toContain("保存済み救援登板なし");
    expect(onlyStarter).toContain("ERA");
    expect(onlyStarter).toContain("BF 6");
    expect(onlyStarter).not.toContain("WHIP");
    const onlyReliever = await render([situated(date, fact("r", "reliever"))]);
    expect(onlyReliever).toContain("保存済み先発登板なし");
    const both = await render([situated(date, fact("s", "starter")),
      situated("2026-09-24", fact("r", "reliever"))]);
    expect(both).toContain("先発投球成績");
    expect(both).toContain("救援投球成績");
    const unknown = await render([situated(date, fact("u", "unknown"))]);
    expect(unknown).toContain("役割不明の登板：");
    expect(unknown).toContain("保存済み先発登板なし");
    expect(renderToStaticMarkup(<NpbPlayerPitcherRoleSection payload={null} state="loading"
      pitchingAvailable />)).toContain("skeleton");
    expect(renderToStaticMarkup(<NpbPlayerPitcherRoleSection payload={null} state="error"
      pitchingAvailable />)).toContain("先発・救援別成績を取得できませんでした");
    expect(renderToStaticMarkup(<NpbPlayerPitcherRoleSection payload={null} state="loading"
      pitchingAvailable={false} />)).toBe("");
    expect(await render([])).toBe("");
  });

  it("matches HOT's GS-based role for consistent stored Facts", () => {
    const query = { playerId, asOfDate: date, period: "30d" as const };
    const rows = [fact("s", "starter"), fact("r", "reliever")];
    const parts = partitionPitcherRoles(rows.map((row) => situated(date, row)));
    expect(aggregatePitching(query, parts.starter).metrics.GS.value).toBe(1);
    expect(aggregatePitching(query, parts.reliever).metrics.GS.value).toBe(0);
    expect(aggregatePitching(query, rows).metrics.GS.value).toBe(1);
    const hotRole = (facts: ReturnType<typeof fact>[]) => {
      const result = aggregatePitching({ playerId, asOfDate: date, period: "7d" }, facts, now);
      const batch: PlayerPeriodBatchResult = { period: "7d", window: resolvePlayerPeriod({ playerId, asOfDate: date, period: "7d" }),
        coverage: result.coverage, batters: [], pitchers: [result], summary: { batterPlayers: 0,
          pitcherPlayers: 1, uniquePlayers: 1, battingFacts: 0, pitchingFacts: facts.length,
          coverage: { complete: 0, partial: 0, unknown: 0, unavailable: 1 } },
        timings: { dbReadMs: 0, aggregationMs: 0, totalMs: 0 } };
      return evaluateHotCandidates(batch).candidates[0]?.role;
    };
    expect(hotRole([fact("s", "starter")])).toBe("starter");
    expect(hotRole([fact("r", "reliever")])).toBe("reliever");
    expect(hotRole([fact("u", "unknown")])).toBe("unclassified_pitcher");
  });
});
