import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerOpponentService } from "../src/application/player-opponent";
import { playerGameBattingSchema, playerGamePitchingSchema } from "../src/domain/game-facts";
import { gameContext } from "../src/domain/player-game-log";
import { partitionHomeAway, type SituatedFact } from "../src/domain/player-home-away";
import { opponentChoice, partitionByOpponent } from "../src/domain/player-opponent";
import { aggregateBatting, aggregatePitching, resolvePlayerPeriod } from "../src/domain/player-period";
import { unavailablePeriodCoverage } from "../src/domain/period-coverage";
import { HttpPlayerOpponentRepository } from "../src/infrastructure/providers/http-player-opponent-repository";
import { NpbPlayerOpponentSection } from "../src/ui/npb-player-analysis";

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
function pitching(gameId: string, patch: Record<string, unknown> = {}) {
  return playerGamePitchingSchema.parse({ ...source, id: gameId, gameId, role: "reliever",
    starter: false, appearanceOrder: null, inningsPitchedOuts: 4, battersFaced: 6,
    hits: 2, homeRuns: 0, walks: null, hitBatters: null, walksAndHitBatters: 1,
    strikeouts: 2, runs: 0, earnedRuns: 0, pitches: 27, catcherId: null,
    decision: "none", ...patch });
}
function situated<T extends { teamId: string; opponentTeamId: string | null }>(date: string, fact: T,
  homeTeamId: string | null = eagles, awayTeamId: string | null = fighters): SituatedFact<T> {
  return { date, fact, homeTeamId, awayTeamId };
}
function setup(battingRows: SituatedFact<ReturnType<typeof batting>>[] = [],
  pitchingRows: SituatedFact<ReturnType<typeof pitching>>[] = []) {
  const facts = { findPlayerIdentity: vi.fn(async () => player),
    findSituatedBattingByPlayer: vi.fn(async () => battingRows),
    findSituatedPitchingByPlayer: vi.fn(async () => pitchingRows) };
  const coverage = { findPeriodCoverage: vi.fn(async (window: ReturnType<typeof resolvePlayerPeriod>) =>
    ({ ...unavailablePeriodCoverage(window), status: "unknown" as const })) };
  return { facts, coverage, service: new PlayerOpponentService(facts, coverage, () => now) };
}
const teamNames = new Map([[eagles, "楽天"], [fighters, "日本ハム"], [baystars, "DeNA"]]);

describe("Player Opponent Analysis", () => {
  it("uses Game Log's canonical IDs for home, away and a transferred player; keeps doubleheader rows", () => {
    const rows = [situated("2026-09-25", batting("home")),
      situated("2026-09-25", batting("away"), fighters, eagles),
      situated("2026-09-24", batting("transfer", { teamId: baystars, opponentTeamId: eagles }),
        eagles, baystars)];
    const groups = partitionByOpponent(rows).groups;
    expect(groups.get(fighters)?.facts.map((fact) => fact.gameId)).toEqual(["home", "away"]);
    expect(groups.get(eagles)?.facts.map((fact) => fact.gameId)).toEqual(["transfer"]);
    for (const row of rows) {
      const log = gameContext({ gameId: row.fact.gameId, date: row.date, gameNumber: 1,
        status: "final", homeTeamId: row.homeTeamId!, awayTeamId: row.awayTeamId!,
        homeScore: 2, awayScore: 1 }, row.fact.teamId, row.fact.opponentTeamId);
      expect(groups.get(log.opponentTeamId)?.facts).toContain(row.fact);
    }
    expect(partitionHomeAway(rows).home).toHaveLength(1);
    expect(partitionHomeAway(rows).away).toHaveLength(2);
  });

  it("quarantines missing, inconsistent, conflicting and same-team Game metadata", () => {
    const rows = [situated("2026-09-25", batting("missing"), null, fighters),
      situated("2026-09-25", batting("not-in-game", { teamId: baystars })),
      situated("2026-09-25", batting("conflict", { opponentTeamId: baystars })),
      situated("2026-09-25", batting("same-team"), eagles, eagles)];
    expect(partitionByOpponent(rows).unknown.map((fact) => fact.gameId))
      .toEqual(["missing", "not-in-game", "conflict", "same-team"]);
    expect(partitionByOpponent(rows).groups.size).toBe(0);
  });

  it("groups batting by opponent, preserves zero PA and nullable metrics, and matches classified totals", async () => {
    const rows = [situated("2026-09-25", batting("f1")),
      situated("2026-09-24", batting("f2", { pa: 0, ab: 0, hits: 0, walks: 0,
        doubles: 0, triples: 0, homeRuns: 0, strikeouts: 0 })),
      situated("2026-09-23", batting("b1", { opponentTeamId: baystars,
        pa: 4, ab: 4, hits: 1, doubles: null, walks: 0 }), eagles, baystars),
      situated("2026-09-22", batting("unknown"), null, fighters)];
    const { service, facts, coverage } = setup(rows);
    const payload = (await service.find(playerId, asOfDate))!.payload;
    expect(facts.findSituatedBattingByPlayer).toHaveBeenCalledOnce();
    expect(facts.findSituatedPitchingByPlayer).toHaveBeenCalledOnce();
    expect(facts.findSituatedBattingByPlayer).toHaveBeenCalledWith(playerId, "2026-08-27", asOfDate);
    expect(coverage.findPeriodCoverage).toHaveBeenCalledOnce();
    expect(payload.batting.unknownOpponentFactCount).toBe(1);
    expect(payload.batting.totalFactCount).toBe(4);
    const fightersResult = payload.opponents.find((item) => item.teamId === fighters)!.batting!;
    const baystarsResult = payload.opponents.find((item) => item.teamId === baystars)!.batting!;
    expect(fightersResult.metrics).toMatchObject({ G: { value: 2 }, PA: { value: 5 }, OPS: { value: 1.35 } });
    expect(baystarsResult.metrics).toMatchObject({ PA: { value: 4 }, SLG: { value: null, status: "unavailable" },
      OPS: { value: null, status: "unavailable" } });
    expect(fightersResult.metrics.PA!.value! + baystarsResult.metrics.PA!.value!)
      .toBe(payload.batting.classifiedTotal!.metrics.PA!.value);
    const classified = aggregateBatting({ playerId, asOfDate, period: "30d" }, rows.slice(0, 3).map((row) => row.fact));
    expect(payload.batting.classifiedTotal!.metrics.G!.value).toBe(classified.metrics.G.value);
    expect(aggregateBatting({ playerId, asOfDate, period: "30d" }, rows.map((row) => row.fact)).metrics.PA.value)
      .toBe(payload.batting.classifiedTotal!.metrics.PA!.value! + 5);
    expect(payload.coverage.status).toBe("unknown");
  });

  it("groups zero-out and fractional pitching without inventing WHIP", async () => {
    const rows = [situated("2026-09-25", pitching("f1")),
      situated("2026-09-24", pitching("f2", { inningsPitchedOuts: 0, battersFaced: 1, strikeouts: 0 })),
      situated("2026-09-23", pitching("b1", { opponentTeamId: baystars,
        inningsPitchedOuts: 2, battersFaced: 4, strikeouts: 1 }), eagles, baystars)];
    const payload = (await setup([], rows).service.find(playerId, asOfDate))!.payload;
    const f = payload.opponents.find((item) => item.teamId === fighters)!.pitching!;
    const b = payload.opponents.find((item) => item.teamId === baystars)!.pitching!;
    expect(f.metrics).toMatchObject({ appearances: { value: 2 }, outsRecorded: { value: 4 },
      BF: { value: 7 }, ERA: { value: 0 }, K9: { value: 13.5 } });
    expect(f.metrics.WHIP).toBeUndefined();
    expect(b.metrics).toMatchObject({ outsRecorded: { value: 2 }, K9: { value: 13.5 } });
    expect(f.metrics.outsRecorded!.value! + b.metrics.outsRecorded!.value!)
      .toBe(payload.pitching.classifiedTotal!.metrics.outsRecorded!.value);
    const total = aggregatePitching({ playerId, asOfDate, period: "30d" }, rows.map((row) => row.fact));
    expect(payload.pitching.classifiedTotal!.metrics.BF!.value).toBe(total.metrics.BF.value);
  });

  it("chooses latest opponent, breaks same-day ties by Team display order, never by performance", async () => {
    const rows = [situated("2026-09-25", batting("f")),
      situated("2026-09-25", batting("b", { opponentTeamId: baystars }), eagles, baystars)];
    const payload = (await setup(rows).service.find(playerId, asOfDate))!.payload;
    const choice = opponentChoice(payload, [baystars, fighters]);
    expect(choice.options.map((item) => item.teamId)).toEqual([baystars, fighters]);
    expect(choice.defaultTeamId).toBe(baystars);
    expect(opponentChoice(payload, [fighters, baystars]).defaultTeamId).toBe(fighters);
  });

  it("renders one or multiple opponents, independent states and unknown-only/no-fact states", async () => {
    const one = (await setup([situated("2026-09-25", batting("f"))]).service.find(playerId, asOfDate))!.payload;
    const oneHtml = renderToStaticMarkup(<NpbPlayerOpponentSection payload={one} state="ready"
      teamNames={teamNames} teamOrder={[fighters]} />);
    expect(oneHtml).toContain("対戦相手：");
    expect(oneHtml).toContain("日本ハム");
    expect(oneHtml).not.toContain("<select");
    const two = (await setup([situated("2026-09-25", batting("f")),
      situated("2026-09-24", batting("b", { opponentTeamId: baystars }), eagles, baystars)])
      .service.find(playerId, asOfDate))!.payload;
    const html = renderToStaticMarkup(<NpbPlayerOpponentSection payload={two} state="ready"
      teamNames={teamNames} teamOrder={[fighters, baystars]} />);
    expect(html).toContain("<select");
    expect(html).toContain("対日本ハム");
    expect(html).toContain("30日全体");
    expect(html).toContain("一部期間の収集状況を確認できません");
    expect(html).not.toContain("WHIP");
    const unknown = (await setup([situated("2026-09-25", batting("bad"), null, fighters)])
      .service.find(playerId, asOfDate))!.payload;
    expect(renderToStaticMarkup(<NpbPlayerOpponentSection payload={unknown} state="ready"
      teamNames={teamNames} teamOrder={[]} />)).toContain("対戦相手を判定できる記録がありません");
    const empty = (await setup().service.find(playerId, asOfDate))!.payload;
    expect(renderToStaticMarkup(<NpbPlayerOpponentSection payload={empty} state="ready"
      teamNames={teamNames} teamOrder={[]} />)).toContain("分析できる試合データがまだありません");
    expect(renderToStaticMarkup(<NpbPlayerOpponentSection payload={null} state="loading"
      teamNames={teamNames} teamOrder={[]} />)).toContain("skeleton");
    expect(renderToStaticMarkup(<NpbPlayerOpponentSection payload={null} state="error"
      teamNames={teamNames} teamOrder={[]} />)).toContain("対戦相手別成績を取得できませんでした");
  });

  it("validates HTTP results and reflects corrected Facts on next read", async () => {
    const fixture = setup([situated("2026-09-25", batting("f"))]);
    const before = (await fixture.service.find(playerId, asOfDate))!.payload;
    fixture.facts.findSituatedBattingByPlayer.mockResolvedValueOnce([
      situated("2026-09-25", batting("f", { hits: 3 }))]);
    const after = (await fixture.service.find(playerId, asOfDate))!.payload;
    expect(after.opponents[0]!.batting!.metrics.H!.value).toBe(before.opponents[0]!.batting!.metrics.H!.value! + 1);
    const reader = new HttpPlayerOpponentRepository("https://example.test/", async () =>
      new Response(JSON.stringify(after), { status: 200 }));
    expect((await reader.find(playerId))?.opponents[0]?.batting?.metrics.H!.value).toBe(3);
    await expect(reader.find("11111111-1111-4111-8111-111111111111")).rejects.toThrow("identity mismatch");
    const broken = new HttpPlayerOpponentRepository("https://example.test/", async () => new Response("{}"));
    await expect(broken.find(playerId)).rejects.toThrow();
  });
});
