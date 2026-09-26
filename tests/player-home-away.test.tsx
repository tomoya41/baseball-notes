import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PlayerHomeAwayService } from "../src/application/player-home-away";
import { playerGameBattingSchema, playerGamePitchingSchema } from "../src/domain/game-facts";
import { gameContext } from "../src/domain/player-game-log";
import { partitionHomeAway, type SituatedFact } from "../src/domain/player-home-away";
import { aggregateBatting, aggregatePitching, resolvePlayerPeriod } from "../src/domain/player-period";
import { unavailablePeriodCoverage } from "../src/domain/period-coverage";
import { HttpPlayerHomeAwayRepository } from "../src/infrastructure/providers/http-player-home-away-repository";
import { NpbPlayerHomeAwaySection } from "../src/ui/npb-player-analysis";

const playerId = "06a3e027-7a73-4792-9c91-8ecc3c1da36a";
const asOfDate = "2026-09-25";
const now = new Date("2026-09-26T00:00:00.000Z");
const home = "npb:team:eagles", away = "npb:team:fighters";
const source = { playerId, teamId: home, opponentTeamId: away,
  sourceKey: "nf3", sourceRecordId: "row", collectedAt: now.toISOString() };
const player = { id: playerId, name: "中島大輔", teamId: home, teamName: "楽天" };

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
  homeTeamId: string | null = home, awayTeamId: string | null = away): SituatedFact<T> {
  return { date, fact, homeTeamId, awayTeamId };
}
function setup(battingRows: SituatedFact<ReturnType<typeof batting>>[] = [],
  pitchingRows: SituatedFact<ReturnType<typeof pitching>>[] = [], status: "complete" | "partial" | "unknown" = "unknown") {
  const facts = { findPlayerIdentity: vi.fn(async () => player),
    findSituatedBattingByPlayer: vi.fn(async () => battingRows),
    findSituatedPitchingByPlayer: vi.fn(async () => pitchingRows) };
  const coverage = { findPeriodCoverage: vi.fn(async (window: ReturnType<typeof resolvePlayerPeriod>) =>
    ({ ...unavailablePeriodCoverage(window), status })) };
  return { facts, coverage, service: new PlayerHomeAwayService(facts, coverage, () => now) };
}

describe("Player Home/Away Analysis", () => {
  it("uses the same canonical team-side rule as Game Log and keeps same-date games separate", () => {
    const homeFact = situated("2026-09-24", batting("first"));
    const awayFact = situated("2026-09-24", batting("second"), away, home);
    const split = partitionHomeAway([homeFact, awayFact]);
    expect(split.home.map((row) => row.gameId)).toEqual(["first"]);
    expect(split.away.map((row) => row.gameId)).toEqual(["second"]);
    for (const row of [homeFact, awayFact]) {
      const context = gameContext({ gameId: row.fact.gameId, date: row.date, gameNumber: 1,
        status: "final", homeTeamId: row.homeTeamId!, awayTeamId: row.awayTeamId!,
        homeScore: 3, awayScore: 2 }, row.fact.teamId, row.fact.opponentTeamId);
      expect(split[context.side]).toContain(row.fact);
    }
  });

  it("quarantines unknown teams, missing metadata and conflicting opponents", () => {
    const rows = [situated("2026-09-24", batting("unknown-team", { teamId: "other" })),
      situated("2026-09-24", batting("missing"), null, away),
      situated("2026-09-24", batting("conflict", { opponentTeamId: "other" }))];
    const split = partitionHomeAway(rows);
    expect(split.home).toHaveLength(0);
    expect(split.away).toHaveLength(0);
    expect(split.unknown.map((fact) => fact.gameId)).toEqual(["unknown-team", "missing", "conflict"]);
  });

  it("reuses aggregation and preserves counting totals, sample and independent nullable status", async () => {
    const homeRows = [situated("2026-09-24", batting("home")),
      situated("2026-09-23", batting("running", { pa: 0, ab: 0, hits: 0, walks: 0,
        doubles: 0, triples: 0, homeRuns: 0, strikeouts: 0 }))];
    const awayRow = situated("2026-09-20", batting("away", {
      pa: 4, ab: 4, hits: 1, doubles: 0, walks: null }), away, home);
    const { service, facts, coverage } = setup([...homeRows, awayRow]);
    const response = (await service.find(playerId, asOfDate))!.payload;
    expect(facts.findSituatedBattingByPlayer).toHaveBeenCalledOnce();
    expect(facts.findSituatedPitchingByPlayer).toHaveBeenCalledOnce();
    expect(facts.findSituatedBattingByPlayer).toHaveBeenCalledWith(playerId, "2026-08-27", asOfDate);
    expect(coverage.findPeriodCoverage).toHaveBeenCalledOnce();
    expect(response.batting.home?.metrics).toMatchObject({ G: { value: 2 }, PA: { value: 5 },
      OPS: { value: 1.35 }, AVG: { value: 0.5 } });
    expect(response.batting.away?.metrics).toMatchObject({ PA: { value: 4 }, BB: { status: "unavailable", value: null },
      OPS: { status: "unavailable", value: null } });
    expect(response.coverage.status).toBe("unknown");
    expect(response.batting.unknownFactCount).toBe(0);
    const total = aggregateBatting({ playerId, asOfDate, period: "30d" }, [...homeRows, awayRow].map((row) => row.fact));
    expect(response.batting.home!.metrics.PA!.value! + response.batting.away!.metrics.PA!.value!).toBe(total.metrics.PA.value);
    expect(response.batting.home!.metrics.G!.value! + response.batting.away!.metrics.G!.value!).toBe(total.metrics.G.value);
  });

  it("keeps zero-out pitching appearances and derives each side with existing ERA/K9 rules", async () => {
    const rows = [situated("2026-09-24", pitching("home")),
      situated("2026-09-23", pitching("zero", { inningsPitchedOuts: 0,
        battersFaced: 1, hits: 1, strikeouts: 0, pitches: 5 })),
      situated("2026-09-20", pitching("away", {
        inningsPitchedOuts: 2, battersFaced: 4, hits: 0, strikeouts: 1 }), away, home)];
    const response = (await setup([], rows, "complete").service.find(playerId, asOfDate))!.payload;
    expect(response.pitching.home?.metrics).toMatchObject({ appearances: { value: 2 }, outsRecorded: { value: 4 },
      BF: { value: 7 }, ERA: { value: 0 }, K9: { value: 13.5 }, WHIP: { status: "unavailable" } });
    expect(response.pitching.away?.metrics).toMatchObject({ appearances: { value: 1 }, outsRecorded: { value: 2 },
      K9: { value: 13.5 } });
    const total = aggregatePitching({ playerId, asOfDate, period: "30d" }, rows.map((row) => row.fact));
    expect(response.pitching.home!.metrics.outsRecorded!.value! + response.pitching.away!.metrics.outsRecorded!.value!)
      .toBe(total.metrics.outsRecorded.value);
  });

  it("shows one-sided, unknown-only and fact-free states without inventing zeros", async () => {
    const one = (await setup([situated("2026-09-24", batting("home"))]).service.find(playerId, asOfDate))!.payload;
    expect(one.batting.away).toBeNull();
    expect(renderToStaticMarkup(<NpbPlayerHomeAwaySection payload={one} state="ready" />)).toContain("保存済みビジター成績なし");
    const awayOnly = (await setup([situated("2026-09-24", batting("away"), away, home)])
      .service.find(playerId, asOfDate))!.payload;
    expect(renderToStaticMarkup(<NpbPlayerHomeAwaySection payload={awayOnly} state="ready" />)).toContain("保存済みホーム成績なし");
    const unknown = (await setup([situated("2026-09-24", batting("unknown", { teamId: "other" }))])
      .service.find(playerId, asOfDate))!.payload;
    expect(unknown.capability).toBe("unavailable");
    expect(unknown.batting.unknownFactCount).toBe(1);
    const empty = (await setup().service.find(playerId, asOfDate))!.payload;
    expect(renderToStaticMarkup(<NpbPlayerHomeAwaySection payload={empty} state="ready" />))
      .toContain("分析できる試合データがまだありません");
  });

  it("renders accessible side, sample and coverage text; handles loading/error and omits WHIP", async () => {
    const value = (await setup([situated("2026-09-24", batting("home"))],
      [situated("2026-09-24", pitching("home"))], "partial").service.find(playerId, asOfDate))!.payload;
    const html = renderToStaticMarkup(<NpbPlayerHomeAwaySection payload={value} state="ready" />);
    expect(html).toContain("打撃 ホーム");
    expect(html).toContain("投球 ビジター");
    expect(html).toContain("IP");
    expect(html).toContain("一部データ未収集");
    expect(html).not.toContain("WHIP");
    expect(renderToStaticMarkup(<NpbPlayerHomeAwaySection payload={null} state="loading" />)).toContain("skeleton");
    expect(renderToStaticMarkup(<NpbPlayerHomeAwaySection payload={null} state="error" />))
      .toContain("ホーム・ビジター成績を取得できませんでした");
  });

  it("validates HTTP responses without a mock fallback and reflects corrected Fact on next read", async () => {
    const fixture = setup([situated("2026-09-24", batting("home"))]);
    const before = (await fixture.service.find(playerId, asOfDate))!.payload;
    fixture.facts.findSituatedBattingByPlayer.mockResolvedValueOnce([
      situated("2026-09-24", batting("home", { hits: 3 }))]);
    const after = (await fixture.service.find(playerId, asOfDate))!.payload;
    expect(after.batting.home!.metrics.H!.value).toBe(before.batting.home!.metrics.H!.value! + 1);
    const reader = new HttpPlayerHomeAwayRepository("https://example.test/", async () =>
      new Response(JSON.stringify(after), { status: 200 }));
    expect((await reader.find(playerId))?.batting.home?.metrics.H?.value).toBe(3);
    await expect(reader.find("11111111-1111-4111-8111-111111111111")).rejects.toThrow("identity mismatch");
    const broken = new HttpPlayerHomeAwayRepository("https://example.test/", async () => new Response("{}"));
    await expect(broken.find(playerId)).rejects.toThrow();
  });
});
