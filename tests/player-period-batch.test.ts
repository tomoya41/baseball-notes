import { afterEach, describe, expect, it, vi } from "vitest";
import { PlayerPeriodBatchService, countBatchCoverage } from "../src/application/player-period-batch";
import { PlayerPeriodService } from "../src/application/player-period";
import { openDataClient, migrateData, type DataClient } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import { evaluatePeriodCoverage, periodDates } from "../src/domain/period-coverage";
import { playerGameBattingSchema, playerGamePitchingSchema } from "../src/domain/game-facts";
import type { PlayerGameBatting, PlayerGamePitching } from "../src/domain/game-facts";
import type { PeriodWindow } from "../src/domain/player-period";

const now = new Date("2026-09-25T00:00:00Z");
const source = { sourceKey: "nf3", sourceRecordId: "source-row", collectedAt: now.toISOString() };
const query = { asOfDate: "2026-09-24", period: "7d" } as const;
function batting(playerId: string, gameId: string, changes: Record<string, unknown> = {}): PlayerGameBatting {
  return playerGameBattingSchema.parse({ ...source, playerId, gameId, teamId: "team", opponentTeamId: "opponent",
    battingOrder: 1, pa: 5, ab: 4, runs: 1, hits: 2, doubles: 1, triples: 0, homeRuns: 0,
    rbi: 1, walks: 1, hbp: 0, sacrificeHits: 0, sacrificeFlies: 0, strikeouts: 1,
    stolenBases: null, caughtStealing: null, starter: true, ...changes });
}
function pitching(playerId: string, gameId: string, changes: Record<string, unknown> = {}): PlayerGamePitching {
  return playerGamePitchingSchema.parse({ ...source, id: `${gameId}:${playerId}`, playerId, gameId,
    teamId: "team", opponentTeamId: "opponent", role: "reliever", starter: false,
    appearanceOrder: null, inningsPitchedOuts: 2, battersFaced: 3, hits: 1, homeRuns: 0,
    walks: null, hitBatters: null, walksAndHitBatters: 1, strikeouts: 1, runs: 0,
    earnedRuns: 0, pitches: 12, catcherId: null, decision: "none", ...changes });
}
function reader(battingRows: PlayerGameBatting[], pitchingRows: PlayerGamePitching[]) {
  return {
    findPeriodPlayerIds: vi.fn(async () => ({ batters: [...new Set(battingRows.map((row) => row.playerId))].sort(),
      pitchers: [...new Set(pitchingRows.map((row) => row.playerId))].sort() })),
    findBattingByPeriod: vi.fn(async (_from: string, _to: string, ids: readonly string[] | null) =>
      battingRows.filter((row) => !ids || ids.includes(row.playerId))),
    findPitchingByPeriod: vi.fn(async (_from: string, _to: string, ids: readonly string[] | null) =>
      pitchingRows.filter((row) => !ids || ids.includes(row.playerId))),
    findBattingByPlayer: vi.fn(async (id: string) => battingRows.filter((row) => row.playerId === id)),
    findPitchingByPlayer: vi.fn(async (id: string) => pitchingRows.filter((row) => row.playerId === id)),
  };
}
function coverage(window: PeriodWindow, kind: "complete" | "partial" | "unknown" | "unavailable") {
  if (kind === "unavailable") throw new Error("coverage unavailable");
  const days = periodDates(window).map((date) => ({ date, dayStatus: "no_games" as const,
    gamesStageStatus: "complete", finalGames: 0, completeGames: 0, partialGames: 0, failedGames: 0 }));
  if (kind === "partial") days[0] = { ...days[0]!, dayStatus: "partial" as never };
  if (kind === "unknown") days.shift();
  return evaluatePeriodCoverage(window, days, []);
}

describe("read-only period batch", () => {
  it("handles empty, one-player, separate roles, and the same player in both roles", async () => {
    const empty = reader([], []);
    const none = await new PlayerPeriodBatchService(empty, { findPeriodCoverage: async (window) => coverage(window, "complete") }, () => now)
      .aggregate(query);
    expect(none.summary).toMatchObject({ uniquePlayers: 0, battingFacts: 0, pitchingFacts: 0 });
    expect(empty.findBattingByPeriod).not.toHaveBeenCalled();
    expect(empty.findPitchingByPeriod).not.toHaveBeenCalled();

    const rows = reader([batting("a", "g1"), batting("dual", "g1"), batting("dual", "g2")],
      [pitching("p", "g1"), pitching("dual", "g2")]);
    const result = await new PlayerPeriodBatchService(rows,
      { findPeriodCoverage: async (window) => coverage(window, "complete") }, () => now).aggregate(query);
    expect(result.summary).toMatchObject({ batterPlayers: 2, pitcherPlayers: 2, uniquePlayers: 3,
      battingFacts: 3, pitchingFacts: 2, coverage: { complete: 4 } });
    expect(result.batters.find((row) => row.playerId === "dual")?.metrics.G.value).toBe(2);
    expect(result.pitchers.find((row) => row.playerId === "dual")?.metrics.G.value).toBe(1);
    expect(rows.findPeriodPlayerIds).toHaveBeenCalledTimes(1);
    expect(rows.findBattingByPeriod).toHaveBeenCalledTimes(1);
    expect(rows.findPitchingByPeriod).toHaveBeenCalledTimes(1);
    expect(rows.findBattingByPlayer).not.toHaveBeenCalled();
  });

  it("reuses individual formulas and preserves nullable metrics and WHIP policy", async () => {
    const rows = reader([batting("b", "g1"), batting("b", "g2", { strikeouts: null })],
      [pitching("p", "g1"), pitching("p", "g2", { pitches: null })]);
    const coverageReader = { findPeriodCoverage: async (window: PeriodWindow) => coverage(window, "unknown") };
    const batch = await new PlayerPeriodBatchService(rows, coverageReader, () => now).aggregate(query);
    const individual = new PlayerPeriodService(rows, () => now, coverageReader);
    expect(batch.batters[0]).toEqual(await individual.batting({ ...query, playerId: "b" }));
    expect(batch.pitchers[0]).toEqual(await individual.pitching({ ...query, playerId: "p" }));
    expect(batch.batters[0]?.metrics.SO).toMatchObject({ status: "partial", value: null });
    expect(batch.pitchers[0]?.metrics.pitchCount).toMatchObject({ status: "partial", value: null });
    expect(batch.pitchers[0]?.metrics.WHIP).toMatchObject({ status: "unavailable", value: null });
    expect(batch.summary.coverage.unknown).toBe(2);
  });

  it("uses the same bounded reads for 7d, 14d, 30d and limited stages", async () => {
    const rows = reader(Array.from({ length: 60 }, (_, i) => batting(`b${String(i).padStart(2, "0")}`, "g1")),
      Array.from({ length: 60 }, (_, i) => pitching(`p${String(i).padStart(2, "0")}`, "g1")));
    const service = new PlayerPeriodBatchService(rows, { findPeriodCoverage: async (window) => coverage(window, "partial") });
    for (const period of ["7d", "14d", "30d"] as const) {
      const value = await service.aggregate({ asOfDate: query.asOfDate, period, maxBatters: 10, maxPitchers: 0 });
      expect(value.batters).toHaveLength(10);
      expect(value.pitchers).toHaveLength(0);
      expect(value.coverage.status).toBe("partial");
      expect(value.batters[0]?.from).toBe({ "7d": "2026-09-18", "14d": "2026-09-11", "30d": "2026-08-26" }[period]);
    }
    expect(rows.findBattingByPeriod).toHaveBeenCalledTimes(3);
    expect(rows.findPitchingByPeriod).not.toHaveBeenCalled();
    const fifty = await service.aggregate({ ...query, maxBatters: 50, maxPitchers: 50 });
    expect(fifty.summary.uniquePlayers).toBe(100);
    expect(rows.findBattingByPeriod).toHaveBeenLastCalledWith("2026-09-18", "2026-09-24",
      expect.arrayContaining(["b00", "b49"]), undefined);
    const all = await service.aggregate(query);
    expect(all.summary.uniquePlayers).toBe(120);
    expect(rows.findBattingByPeriod).toHaveBeenLastCalledWith("2026-09-18", "2026-09-24", null, undefined);
  });

  it("counts mixed coverage without turning missing proof into complete", async () => {
    const rows = reader([batting("b", "g1")], [pitching("p", "g1")]);
    const service = new PlayerPeriodBatchService(rows, { findPeriodCoverage: async (window) => coverage(window, "unavailable") });
    const unavailable = await service.aggregate(query);
    expect(unavailable.summary.coverage.unavailable).toBe(2);
    const complete = { ...unavailable.batters[0]!, coverage: { ...unavailable.coverage, status: "complete" as const } };
    const partial = { ...unavailable.pitchers[0]!, coverage: { ...unavailable.coverage, status: "partial" as const } };
    expect(countBatchCoverage([complete, partial, unavailable.batters[0]!]))
      .toEqual({ complete: 1, partial: 1, unknown: 0, unavailable: 1 });
  });
});

let db: DataClient | undefined;
afterEach(() => { db?.close(); db = undefined; });
describe("SQLite batch repository", () => {
  it("selects a Fact-based universe and reads both roles with one query each", async () => {
    db = openDataClient("file::memory:");
    await migrateData(db);
    const game = "g";
    await db.execute({ sql: "INSERT INTO npb_games VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      args: [game,2026,"2026-09-24","home","away",1,null,null,"final",1,0,"nf3","source", "https://nf3.sakura.ne.jp/",now.toISOString(),"hash"] });
    await db.execute({ sql: `INSERT INTO player_game_batting
      (game_id,player_id,team_id,opponent_team_id,batting_order,pa,ab,hits,doubles,triples,home_runs,rbi,walks,strikeouts,hbp,sb,cs,source_key,source_record_id,collected_at,runs,starter,source_url,sacrifice_hits,sacrifice_flies)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [game,"b","home","away",1,5,4,2,1,0,0,1,1,1,0,null,null,"nf3","source",now.toISOString(),1,1,"https://nf3.sakura.ne.jp/",0,0] });
    await db.execute({ sql: `INSERT INTO player_game_pitching
      (fact_id,game_id,player_id,team_id,opponent_team_id,role,appearance_order,ip_outs,batters_faced,hits,home_runs,walks,strikeouts,runs,earned_runs,pitches,catcher_id,source_key,source_record_id,collected_at,starter,decision,source_url,hit_batters,walks_and_hit_batters)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: ["p:g",game,"p","away","home","reliever",null,2,3,1,0,null,1,0,0,12,null,"nf3","source",now.toISOString(),0,"none","https://nf3.sakura.ne.jp/",null,1] });
    const repo = new NpbRepository(db);
    expect(await repo.findPeriodPlayerIds("2026-09-18", "2026-09-24")).toEqual({ batters: ["b"], pitchers: ["p"] });
    const service = new PlayerPeriodBatchService(repo);
    const result = await service.aggregate(query);
    expect(result.summary).toMatchObject({ uniquePlayers: 2, battingFacts: 1, pitchingFacts: 1 });
    expect(result.batters[0]?.metrics.AVG.value).toBe(.5);
    expect(result.pitchers[0]?.metrics.WHIP.status).toBe("unavailable");
    expect((await db.execute("SELECT COUNT(*) AS n FROM player_game_batting")).rows[0]?.n).toBe(1);
  });
});
