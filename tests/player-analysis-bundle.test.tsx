import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerAnalysisBundleService } from "../src/application/player-analysis-bundle";
import { PlayerHomeAwayService } from "../src/application/player-home-away";
import { PlayerOpponentService } from "../src/application/player-opponent";
import { PlayerBatterRoleService } from "../src/application/player-batter-role";
import { PlayerPeriodComparisonService } from "../src/application/player-period-comparison";
import { battingOrderChoice, partitionByBattingOrder } from "../src/domain/player-batting-order";
import { partitionBatterRoles } from "../src/domain/player-batter-role";
import { playerGameBattingSchema, playerGamePitchingSchema, type PlayerGameBatting } from "../src/domain/game-facts";
import type { SituatedFact } from "../src/domain/player-home-away";
import { resolvePlayerPeriod, aggregateBatting } from "../src/domain/player-period";
import { unavailablePeriodCoverage } from "../src/domain/period-coverage";
import { HttpPlayerAnalysisBundleRepository } from "../src/infrastructure/providers/http-player-analysis-bundle-repository";
import { NpbPlayerBattingOrderSection, NpbPlayerBatterRoleSection } from "../src/ui/npb-player-analysis";
import { battingFact, situatedBattingFact } from "../src/data/npb-repository";

const playerId = "06a3e027-7a73-4792-9c91-8ecc3c1da36a";
const asOfDate = "2026-09-25";
const now = new Date("2026-09-26T00:00:00.000Z");
const eagles = "npb:team:eagles", fighters = "npb:team:fighters", baystars = "npb:team:baystars";
const player = { id: playerId, name: "中島大輔", teamId: eagles, teamName: "楽天" };
const source = { playerId, teamId: eagles, opponentTeamId: fighters,
  sourceKey: "nf3", sourceRecordId: "row", collectedAt: now.toISOString() };
function batting(gameId: string, patch: Record<string, unknown> = {}) {
  return playerGameBattingSchema.parse({ ...source, gameId, battingOrder: 1, pa: 5, ab: 4,
    runs: 1, hits: 2, doubles: 1, triples: 0, homeRuns: 0, rbi: 1, walks: 1,
    hbp: 0, sacrificeHits: 0, sacrificeFlies: 0, strikeouts: 1, stolenBases: 0,
    caughtStealing: 0, starter: true, ...patch });
}
function pitching(gameId: string) {
  return playerGamePitchingSchema.parse({ ...source, id: gameId, gameId, role: "reliever",
    starter: false, appearanceOrder: null, inningsPitchedOuts: 4, battersFaced: 6,
    hits: 2, homeRuns: 0, walks: null, hitBatters: null, walksAndHitBatters: 1,
    strikeouts: 2, runs: 0, earnedRuns: 0, pitches: 27, catcherId: null, decision: "none" });
}
function situated<T extends { teamId: string; opponentTeamId: string | null }>(date: string, fact: T,
  homeTeamId: string | null = eagles, awayTeamId: string | null = fighters): SituatedFact<T> {
  return { date, fact, homeTeamId, awayTeamId };
}
function setup(battingRows: SituatedFact<ReturnType<typeof batting>>[] = [],
  pitchingRows: SituatedFact<ReturnType<typeof pitching>>[] = []) {
  const facts = { findPlayerIdentity: vi.fn(async () => player),
    findSituatedBattingByPlayer: vi.fn(async () => battingRows),
    findSituatedPitchingByPlayer: vi.fn(async () => pitchingRows),
    findDatedBattingByPlayer: vi.fn(async () => battingRows.map(({ date, fact }) => ({ date, fact }))),
    findDatedPitchingByPlayer: vi.fn(async () => pitchingRows.map(({ date, fact }) => ({ date, fact }))) };
  const coverage = { findPeriodCoverages: vi.fn(async (windows: ReturnType<typeof resolvePlayerPeriod>[]) =>
    windows.map((window) => ({ ...unavailablePeriodCoverage(window), status: "unknown" as const }))),
  findPeriodCoverage: vi.fn(async (window: ReturnType<typeof resolvePlayerPeriod>) =>
    ({ ...unavailablePeriodCoverage(window), status: "unknown" as const })) };
  return { facts, coverage, bundle: new PlayerAnalysisBundleService(facts, coverage, () => now) };
}

describe("shared 30-day Player Analysis", () => {
  it("reads each role and coverage once, preserving existing comparison, Home/Away and Opponent results", async () => {
    const battingRows = [situated("2026-09-25", batting("new", { battingOrder: 3 })),
      situated("2026-09-16", batting("middle", { battingOrder: 1, pa: 4, ab: 4, walks: 0 }), eagles, baystars)];
    const pitchingRows = [situated("2026-09-25", pitching("p1"))];
    const fixture = setup(battingRows, pitchingRows);
    const result = (await fixture.bundle.find(playerId, asOfDate))!;
    expect(fixture.facts.findPlayerIdentity).toHaveBeenCalledOnce();
    expect(fixture.facts.findSituatedBattingByPlayer).toHaveBeenCalledOnce();
    expect(fixture.facts.findSituatedPitchingByPlayer).toHaveBeenCalledOnce();
    expect(fixture.facts.findDatedBattingByPlayer).not.toHaveBeenCalled();
    expect(fixture.coverage.findPeriodCoverages).toHaveBeenCalledOnce();
    expect(result.context.batting).toHaveLength(2);
    expect(result.payload.comparison.status).toBe("ready");
    expect(result.payload.homeAway.status).toBe("ready");
    expect(result.payload.opponent.status).toBe("ready");
    expect(result.payload.battingOrder.status).toBe("ready");
    expect(result.payload.batterRole.status).toBe("ready");
    const directComparison = (await new PlayerPeriodComparisonService(fixture.facts, fixture.coverage, () => now)
      .find(playerId, asOfDate))!.payload;
    const directHomeAway = (await new PlayerHomeAwayService(fixture.facts, fixture.coverage, () => now)
      .find(playerId, asOfDate))!.payload;
    const directOpponent = (await new PlayerOpponentService(fixture.facts, fixture.coverage, () => now)
      .find(playerId, asOfDate))!.payload;
    if (result.payload.comparison.status !== "ready" || result.payload.homeAway.status !== "ready" ||
      result.payload.opponent.status !== "ready") throw new Error("Unexpected section error");
    expect(result.payload.comparison.payload).toEqual(directComparison);
    expect(result.payload.homeAway.payload).toEqual(directHomeAway);
    expect(result.payload.opponent.payload).toEqual(directOpponent);
  });

  it("splits starter and substitute from the shared Facts while retaining zero-PA and unknown appearances", async () => {
    const rows = [situated("2026-09-25", batting("starter", { starter:true, pa:4, ab:3 })),
      situated("2026-09-24", batting("pinch", { starter:false, pa:0, ab:0, hits:0,
        doubles:0, triples:0, walks:0, hbp:0, sacrificeHits:0, sacrificeFlies:0 })),
      situated("2026-09-23", batting("unknown", { starter:null, pa:2, ab:2 }))];
    const fixture = setup(rows);
    const bundle = (await fixture.bundle.find(playerId,asOfDate))!.payload;
    expect(fixture.facts.findSituatedBattingByPlayer).toHaveBeenCalledOnce();
    expect(partitionBatterRoles(rows).unknown).toHaveLength(1);
    if (bundle.batterRole.status !== "ready") throw new Error("Unexpected section error");
    const role = bundle.batterRole.payload;
    expect(role).toMatchObject({ totalFactCount:3, unknownRoleFactCount:1,
      starter:{ metrics:{ G:{value:1},PA:{value:4} } },
      substitute:{ metrics:{ G:{value:1},PA:{value:0} } } });
    expect(role.starter!.metrics.PA!.value! + role.substitute!.metrics.PA!.value!)
      .toBe(role.classifiedTotal!.metrics.PA!.value);
    expect(role.starter).toEqual((await new PlayerBatterRoleService(fixture.facts,fixture.coverage,() => now)
      .find(playerId,asOfDate))?.starter);
    const html = renderToStaticMarkup(<NpbPlayerBatterRoleSection payload={role} state="ready" battingAvailable />);
    expect(html).toContain("途中出場");
    expect(html).toContain("打席");
    expect(html).not.toContain("得意");
    expect(renderToStaticMarkup(<NpbPlayerBatterRoleSection payload={null} state="loading" battingAvailable />))
      .toContain("skeleton");
    expect(renderToStaticMarkup(<NpbPlayerBatterRoleSection payload={null} state="error" battingAvailable />))
      .toContain("出場形態別成績を取得できませんでした");
    expect(renderToStaticMarkup(<NpbPlayerBatterRoleSection payload={null} state="loading" battingAvailable={false} />))
      .toBe("");
  });

  it("keeps one failed projection isolated from other sections", async () => {
    const fixture = setup([situated("2026-09-20bad", batting("a"))]);
    const result = (await fixture.bundle.find(playerId, asOfDate))!.payload;
    expect(result.comparison.status).toBe("ready");
    expect(result.homeAway.status).toBe("ready");
    expect(result.opponent.status).toBe("error");
    expect(result.battingOrder.status).toBe("error");
  });

  it("partitions 1–9, unknown/invalid, zero PA and doubleheader without inventing an order", async () => {
    const rows = [situated("2026-09-25", batting("g1", { battingOrder: 3 })),
      situated("2026-09-25", batting("g2", { battingOrder: 3, pa: 0, ab: 0, hits: 0,
        doubles: 0, walks: 0, strikeouts: 0 })),
      situated("2026-09-24", batting("g3", { battingOrder: 1 })),
      situated("2026-09-23", batting("g4", { battingOrder: 9 })),
      situated("2026-09-22", batting("g5", { battingOrder: null, pa: 4 })),
      situated("2026-09-21", { ...batting("g6"), battingOrder: 10 } as PlayerGameBatting)];
    const partition = partitionByBattingOrder(rows);
    expect([...partition.groups.keys()]).toEqual([3, 1, 9]);
    expect(partition.groups.get(3)?.facts).toHaveLength(2);
    expect(partition.unknown.map((fact) => fact.gameId)).toEqual(["g5", "g6"]);
    const valid = rows.slice(0, 5);
    const result = (await setup(valid).bundle.find(playerId, asOfDate))!.payload;
    if (result.battingOrder.status !== "ready") throw new Error("Unexpected section error");
    const order = result.battingOrder.payload;
    expect(order.totalFactCount).toBe(5);
    expect(order.unknownBattingOrderFactCount).toBe(1);
    expect(order.unknownBattingOrderPa).toBe(4);
    expect(order.orders.map((item) => item.battingOrder)).toEqual([1, 3, 9]);
    expect(order.orders.find((item) => item.battingOrder === 3)?.stats?.metrics).toMatchObject({
      G: { value: 2 }, PA: { value: 5 }, OPS: { value: 1.35 },
    });
    expect(order.orders.reduce((sum, item) => sum + item.stats!.metrics.PA!.value!, 0))
      .toBe(order.classifiedTotal!.metrics.PA!.value);
    expect(order.classifiedTotal!.metrics.PA!.value! + order.unknownBattingOrderPa!)
      .toBe(aggregateBatting({ playerId, asOfDate, period: "30d" }, valid.map((row) => row.fact)).metrics.PA.value);
    expect(battingOrderChoice(order)).toMatchObject({ defaultOrder: 3 });
    const everySlot = Array.from({ length: 9 }, (_, index) =>
      situated("2026-09-20", batting(`slot${index + 1}`, { battingOrder: index + 1 })));
    expect([...partitionByBattingOrder(everySlot).groups.keys()]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("treats an invalid stored slot as unknown for read-only Analysis", () => {
    const row = { game_id: "game", player_id: playerId, team_id: eagles, opponent_team_id: fighters,
      batting_order: 10, pa: 3, ab: 2, hits: 1, doubles: 0, triples: 0,
      home_runs: 0, rbi: 0, walks: 1, strikeouts: 0, hbp: 0, sb: 0, cs: 0,
      runs: 0, sacrifice_hits: 0, sacrifice_flies: 0, starter: 0,
      source_key: "nf3", source_record_id: "row", collected_at: now.toISOString() };
    expect(() => battingFact(row)).toThrow();
    expect(situatedBattingFact(row)).toMatchObject({ battingOrder: null, pa: 3, ab: 2 });
  });

  it("preserves nullable metric status per order", async () => {
    const rows = [situated("2026-09-25", batting("a", { battingOrder: 2, doubles: null })),
      situated("2026-09-24", batting("b", { battingOrder: 3 }))];
    const result = (await setup(rows).bundle.find(playerId, asOfDate))!.payload;
    if (result.battingOrder.status !== "ready") throw new Error("Unexpected section error");
    expect(result.battingOrder.payload.orders.find((row) => row.battingOrder === 2)?.stats?.metrics.OPS)
      .toMatchObject({ value: null, status: "unavailable" });
    expect(result.battingOrder.payload.orders.find((row) => row.battingOrder === 3)?.stats?.metrics.OPS)
      .toMatchObject({ value: 1.35, status: "complete" });
  });

  it("renders one/multiple/unknown/no-data/loading/error and hides pitcher-only section", async () => {
    const one = (await setup([situated("2026-09-25", batting("a"))]).bundle.find(playerId, asOfDate))!.payload;
    if (one.battingOrder.status !== "ready") throw new Error("Unexpected section error");
    const html = renderToStaticMarkup(<NpbPlayerBattingOrderSection payload={one.battingOrder.payload}
      state="ready" battingAvailable />);
    expect(html).toContain("打順：");
    expect(html).not.toContain("<select");
    const multi = (await setup([situated("2026-09-25", batting("a")),
      situated("2026-09-24", batting("b", { battingOrder: 3 }))]).bundle.find(playerId, asOfDate))!.payload;
    if (multi.battingOrder.status !== "ready") throw new Error("Unexpected section error");
    const multiHtml = renderToStaticMarkup(<NpbPlayerBattingOrderSection payload={multi.battingOrder.payload}
      state="ready" battingAvailable />);
    expect(multiHtml).toContain("<select");
    expect(multiHtml).toContain("30日全体");
    expect(multiHtml).not.toContain("得意");
    const unknown = (await setup([situated("2026-09-25", batting("a", { battingOrder: null }))])
      .bundle.find(playerId, asOfDate))!.payload;
    if (unknown.battingOrder.status !== "ready") throw new Error("Unexpected section error");
    expect(renderToStaticMarkup(<NpbPlayerBattingOrderSection payload={unknown.battingOrder.payload}
      state="ready" battingAvailable />)).toContain("打順を判定できる記録がありません");
    expect(renderToStaticMarkup(<NpbPlayerBattingOrderSection payload={null} state="loading"
      battingAvailable />)).toContain("skeleton");
    expect(renderToStaticMarkup(<NpbPlayerBattingOrderSection payload={null} state="error"
      battingAvailable />)).toContain("打順別成績を取得できませんでした");
    expect(renderToStaticMarkup(<NpbPlayerBattingOrderSection payload={null} state="loading"
      battingAvailable={false} />)).toBe("");
    const empty = (await setup().bundle.find(playerId, asOfDate))!.payload;
    if (empty.battingOrder.status !== "ready") throw new Error("Unexpected section error");
    expect(renderToStaticMarkup(<NpbPlayerBattingOrderSection payload={empty.battingOrder.payload}
      state="ready" battingAvailable />)).toBe("");
  });

  it("validates a bundled HTTP response without exposing raw Game Facts", async () => {
    const payload = (await setup([situated("2026-09-25", batting("a"))]).bundle.find(playerId, asOfDate))!.payload;
    const reader = new HttpPlayerAnalysisBundleRepository("https://example.test/", async () =>
      new Response(JSON.stringify(payload), { status: 200 }));
    expect((await reader.find(playerId))?.battingOrder.status).toBe("ready");
    await expect(reader.find("11111111-1111-4111-8111-111111111111")).rejects.toThrow("identity mismatch");
    expect(JSON.stringify(payload)).not.toMatch(/sourceRecordId|sourceUrl|WHIP/);
  });
});
