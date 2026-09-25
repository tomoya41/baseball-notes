import { afterEach, describe, expect, it, vi } from "vitest";
import { openDataClient, migrateData, type DataClient } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import { NpbPeriodCoverageRepository } from "../src/data/npb-period-coverage-repository";
import { PlayerPeriodService } from "../src/application/player-period";
import { aggregateBatting, aggregatePitching, resolvePlayerPeriod } from "../src/domain/player-period";
import { evaluatePeriodCoverage, periodDates, type DayCoverageEvidence, type GameCoverageEvidence } from "../src/domain/period-coverage";
import { playerGameBattingSchema, playerGamePitchingSchema } from "../src/domain/game-facts";

const query = { playerId: "p", asOfDate: "2026-09-24", period: "7d" } as const;
const at = "2026-09-25T00:00:00.000Z";
const source = { sourceKey: "nf3", sourceRecordId: "row", collectedAt: at };
function batting(gameId: string, changes: Record<string, unknown> = {}) {
  return playerGameBattingSchema.parse({ ...source, gameId, playerId: "p", teamId: "team", opponentTeamId: "opponent",
    battingOrder: 1, pa: 5, ab: 4, runs: 2, hits: 2, doubles: 1, triples: 0, homeRuns: 1,
    rbi: 2, walks: 1, hbp: 0, sacrificeHits: 0, sacrificeFlies: 0, strikeouts: 1,
    stolenBases: 0, caughtStealing: 0, starter: true, ...changes });
}
function pitching(gameId: string, changes: Record<string, unknown> = {}) {
  return playerGamePitchingSchema.parse({ ...source, id: gameId, gameId, playerId: "p", teamId: "team",
    opponentTeamId: "opponent", role: "reliever", starter: false, appearanceOrder: null,
    inningsPitchedOuts: 2, battersFaced: 3, hits: 1, homeRuns: 0, walks: null, hitBatters: null,
    walksAndHitBatters: 1, strikeouts: 1, runs: 0, earnedRuns: 0, pitches: 12, catcherId: null,
    decision: "hold", ...changes });
}

describe("seven JST calendar days from saved game facts", () => {
  it("includes asOfDate and both endpoints across month/year boundaries", () => {
    expect(resolvePlayerPeriod(query)).toEqual({ from: "2026-09-18", to: "2026-09-24", timeZone: "Asia/Tokyo" });
    expect(resolvePlayerPeriod({ ...query, asOfDate: "2026-10-03" }).from).toBe("2026-09-27");
    expect(resolvePlayerPeriod({ ...query, asOfDate: "2027-01-03" }).from).toBe("2026-12-28");
    expect(() => resolvePlayerPeriod({ ...query, asOfDate: "2026-02-30" })).toThrow();
  });

  it("sums multiple games, a no-game day, 0 AB, BB/HBP/SH/SF and extra-base hits", () => {
    const result = aggregateBatting(query, [batting("g1"), batting("g2", {
      pa: 5, ab: 2, runs: 1, hits: 1, doubles: 0, triples: 1, homeRuns: 0, rbi: 1,
      walks: 0, hbp: 1, sacrificeHits: 1, sacrificeFlies: 1, strikeouts: 0,
    }), batting("g3", { pa: 0, ab: 0, runs: 0, hits: 0, doubles: 0, homeRuns: 0, walks: 0 })], new Date(at));
    expect(result).toMatchObject({ from: "2026-09-18", to: "2026-09-24", games: 3, factCount: 3 });
    expect(result.metrics.G.value).toBe(3);
    expect(result.metrics.PA.value).toBe(10);
    expect(result.metrics.AB.value).toBe(6);
    expect(result.metrics.H.value).toBe(3);
    expect(result.metrics["2B"].value).toBe(1);
    expect(result.metrics["3B"].value).toBe(1);
    expect(result.metrics.HR.value).toBe(1);
    expect(result.metrics.BB.value).toBe(1);
    expect(result.metrics.HBP.value).toBe(1);
    expect(result.metrics.SH.value).toBe(1);
    expect(result.metrics.SF.value).toBe(1);
    expect(result.metrics.AVG.value).toBe(0.5);
    expect(result.metrics.OBP.value).toBeCloseTo(5 / 9);
    expect(result.metrics.SLG.value).toBe(1.5);
    expect(result.metrics.OPS.value).toBeCloseTo(1.5 + 5 / 9);
  });

  it("never turns unknown counts into zero or produces a false rate", () => {
    const result = aggregateBatting(query, [batting("g1"), batting("g2", { walks: null, doubles: null })]);
    expect(result.metrics.BB).toMatchObject({ status: "partial", value: null, observedFacts: 1, factCount: 2 });
    expect(result.metrics.OBP).toMatchObject({ status: "partial", value: null });
    expect(result.metrics.SLG).toMatchObject({ status: "partial", value: null });
    expect(result.metrics.OPS).toMatchObject({ status: "partial", value: null });
    expect(result.dataStatus).toBe("partial");
    expect(aggregateBatting(query, [batting("g0", { pa: 0, ab: 0, hits: 0, walks: 0, hbp: 0, sacrificeFlies: 0 })]).metrics.AVG.status)
      .toBe("unavailable");
    expect(aggregateBatting(query, [batting("invalid", { hits: 1, doubles: 1, homeRuns: 1 })]).metrics.SLG.status)
      .toBe("unavailable");
    expect(aggregateBatting(query, []).dataStatus).toBe("unavailable");
  });

  it("keeps doubleheader games separate and recalculates after a source correction", () => {
    const first = batting("first");
    const second = batting("second");
    expect(aggregateBatting(query, [first, second]).games).toBe(2);
    expect(aggregateBatting(query, [first, { ...second, hits: 3 }]).metrics.H.value).toBe(5);
  });

  it("uses integer outs, counts decisions, and never treats combined 四死 as BB for WHIP", () => {
    const result = aggregatePitching(query, [
      pitching("g1", { role: "starter", starter: true, inningsPitchedOuts: 17, battersFaced: 22,
        hits: 4, homeRuns: 1, strikeouts: 5, runs: 2, earnedRuns: 2, pitches: 90, decision: "win" }),
      pitching("g2"), pitching("g3", { inningsPitchedOuts: 3, battersFaced: 4, hits: 0,
        walksAndHitBatters: 0, strikeouts: 1, pitches: 15, decision: "save" }),
      pitching("g4", { inningsPitchedOuts: 0, battersFaced: 2, hits: 0,
        walksAndHitBatters: 0, strikeouts: 0, pitches: 5, decision: "loss" }),
    ]);
    expect(result.games).toBe(4);
    expect(result.metrics.G.value).toBe(4);
    expect(result.metrics.appearances.value).toBe(4);
    expect(result.metrics.GS.value).toBe(1);
    expect(result.metrics.outsRecorded.value).toBe(22);
    expect(result.metrics.BF.value).toBe(31);
    expect(result.metrics.H.value).toBe(5);
    expect(result.metrics.HR.value).toBe(1);
    expect(result.metrics.SO.value).toBe(7);
    expect(result.metrics.R.value).toBe(2);
    expect(result.metrics.ER.value).toBe(2);
    expect(result.metrics.pitchCount.value).toBe(122);
    expect(result.metrics.W.value).toBe(1);
    expect(result.metrics.L.value).toBe(1);
    expect(result.metrics.HLD.value).toBe(1);
    expect(result.metrics.SV.value).toBe(1);
    expect(result.metrics.ERA.value).toBeCloseTo(54 / 22);
    expect(result.metrics.K9.value).toBeCloseTo(189 / 22);
    expect(result.metrics.BB.status).toBe("unavailable");
    expect(result.metrics.WHIP).toMatchObject({ value: null, status: "unavailable" });
    expect(result.metrics.walksAndHitByPitch.value).toBe(2);
  });

  it("marks missing pitch count partial, zero-outs rates unavailable, and standalone-BB WHIP only when present", () => {
    const partial = aggregatePitching(query, [pitching("g1"), pitching("g2", { pitches: null })]);
    expect(partial.metrics.pitchCount).toMatchObject({ status: "partial", value: null, observedFacts: 1 });
    const zero = aggregatePitching(query, [pitching("g0", { inningsPitchedOuts: 0, walks: 0 })]);
    expect(zero.metrics.ERA.status).toBe("unavailable");
    expect(zero.metrics.K9.status).toBe("unavailable");
    expect(zero.metrics.WHIP.status).toBe("unavailable");
    expect(aggregatePitching(query, [pitching("g1", { walks: 2 })]).metrics.WHIP.value).toBe(4.5);
    expect(aggregatePitching(query, []).dataStatus).toBe("unavailable");
  });

  it("requests each player/range once from a read-only port", async () => {
    const reader = { findBattingByPlayer: vi.fn(async () => [batting("g1")]),
      findPitchingByPlayer: vi.fn(async () => [pitching("g1")]) };
    const service = new PlayerPeriodService(reader, () => new Date(at));
    await service.batting(query);
    await service.pitching(query);
    expect(reader.findBattingByPlayer).toHaveBeenCalledWith("p", "2026-09-18", "2026-09-24");
    expect(reader.findPitchingByPlayer).toHaveBeenCalledWith("p", "2026-09-18", "2026-09-24");
    expect(reader.findBattingByPlayer).toHaveBeenCalledTimes(1);
    expect(reader.findPitchingByPlayer).toHaveBeenCalledTimes(1);
  });

  it("matches hand totals from four read-only Turso fact rows captured on 2026-09-25", () => {
    const batterId = "06a3e027-7a73-4792-9c91-8ecc3c1da36a"; // 中島大輔
    const batterQuery = { ...query, playerId: batterId };
    const battingRows = [
      batting("npb:game:783c5ce3c354796fb0ca", { playerId: batterId, pa: 7, ab: 7,
        runs: 0, hits: 1, doubles: 0, triples: 0, homeRuns: 0, rbi: 1, walks: 0,
        hbp: 0, sacrificeHits: 0, sacrificeFlies: 0, strikeouts: 1, stolenBases: 0, caughtStealing: 0 }),
      batting("npb:game:e6c9b17088ec6c575234", { playerId: batterId, pa: 5, ab: 4,
        runs: 1, hits: 1, doubles: 0, triples: 0, homeRuns: 0, rbi: 0, walks: 1,
        hbp: 0, sacrificeHits: 0, sacrificeFlies: 0, strikeouts: 1, stolenBases: 0, caughtStealing: 1 }),
    ];
    const b = aggregateBatting(batterQuery, battingRows);
    expect(b.dataStatus).toBe("complete");
    expect([b.games,b.metrics.PA.value,b.metrics.AB.value,b.metrics.H.value,b.metrics.HR.value,b.metrics.BB.value])
      .toEqual([2,12,11,2,0,1]);
    expect(b.metrics.AVG.value).toBeCloseTo(2 / 11);
    expect(b.metrics.OBP.value).toBeCloseTo(3 / 12);
    expect(b.metrics.SLG.value).toBeCloseTo(2 / 11);
    expect(b.metrics.OPS.value).toBeCloseTo(3 / 12 + 2 / 11);

    const pitcherId = "6bf4b271-e16c-43f9-9142-8c7ca7de9887"; // 上原健太
    const pitcherQuery = { ...query, playerId: pitcherId };
    const pitchingRows = [
      pitching("npb:game:783c5ce3c354796fb0ca", { playerId: pitcherId,
        inningsPitchedOuts: 3, battersFaced: 4, hits: 1, homeRuns: 0, strikeouts: 1,
        runs: 0, earnedRuns: 0, pitches: 18, walksAndHitBatters: 0, decision: "none" }),
      pitching("npb:game:e6c9b17088ec6c575234", { playerId: pitcherId,
        inningsPitchedOuts: 1, battersFaced: 2, hits: 1, homeRuns: 0, strikeouts: 1,
        runs: 0, earnedRuns: 0, pitches: 9, walksAndHitBatters: 0, decision: "none" }),
    ];
    const p = aggregatePitching(pitcherQuery, pitchingRows);
    expect([p.games,p.metrics.outsRecorded.value,p.metrics.BF.value,p.metrics.H.value,p.metrics.HR.value,
      p.metrics.SO.value,p.metrics.R.value,p.metrics.ER.value,p.metrics.pitchCount.value])
      .toEqual([2,4,6,2,0,2,0,0,27]);
    expect(p.metrics.ERA.value).toBe(0);
    expect(p.metrics.K9.value).toBe(13.5);
    expect(p.metrics.WHIP).toMatchObject({ status: "unavailable", value: null });
    for (const period of ["14d", "30d"] as const) {
      const bLong = aggregateBatting({ ...batterQuery, period }, battingRows);
      const pLong = aggregatePitching({ ...pitcherQuery, period }, pitchingRows);
      expect([bLong.games,bLong.metrics.PA.value,bLong.metrics.AVG.value,bLong.metrics.OPS.value])
        .toEqual([2,12,b.metrics.AVG.value,b.metrics.OPS.value]);
      expect([pLong.games,pLong.metrics.outsRecorded.value,pLong.metrics.K9.value])
        .toEqual([2,4,13.5]);
      expect(evaluatePeriodCoverage(resolvePlayerPeriod({ ...batterQuery, period }), [], []).status)
        .toBe("unknown");
    }
  });
});

describe("shared calendar period resolver and aggregation", () => {
  it("resolves inclusive 7/14/30 day windows across month, year and leap boundaries", () => {
    expect(resolvePlayerPeriod({ ...query, period: "14d" }).from).toBe("2026-09-11");
    expect(resolvePlayerPeriod({ ...query, period: "30d" }).from).toBe("2026-08-26");
    const leap = resolvePlayerPeriod({ ...query, asOfDate: "2028-03-01", period: "7d" });
    expect(leap.from).toBe("2028-02-24");
    expect(periodDates(leap)).toHaveLength(7);
    expect(resolvePlayerPeriod({ ...query, asOfDate: "2027-01-03", period: "30d" }).from).toBe("2026-12-05");
  });

  it("uses the same sum-then-rate engine for each period and incorporates older facts", async () => {
    const dates = new Map([["new", "2026-09-24"], ["middle", "2026-09-12"], ["old", "2026-08-27"]]);
    const reader = {
      findBattingByPlayer: vi.fn(async (_id: string, from: string, to: string) =>
        [...dates].filter(([, date]) => date >= from && date <= to).map(([id]) =>
          batting(id, id === "new" ? { ab: 2, hits: 1, doubles: 0, homeRuns: 0, pa: 3 } :
            { ab: 8, hits: 1, doubles: 0, homeRuns: 0, pa: 9 }))),
      findPitchingByPlayer: vi.fn(async (_id: string, from: string, to: string) =>
        [...dates].filter(([, date]) => date >= from && date <= to).map(([id]) =>
          pitching(id, id === "new" ? { inningsPitchedOuts: 3, earnedRuns: 1 } :
            { inningsPitchedOuts: 6, earnedRuns: 0 }))),
    };
    const service = new PlayerPeriodService(reader, () => new Date(at));
    const [b7, b14, b30] = await Promise.all([
      service.batting(query), service.batting({ ...query, period: "14d" }),
      service.batting({ ...query, period: "30d" }),
    ]);
    expect([b7.games, b14.games, b30.games]).toEqual([1, 2, 3]);
    expect([b7.metrics.AVG.value, b14.metrics.AVG.value, b30.metrics.AVG.value])
      .toEqual([1 / 2, 2 / 10, 3 / 18]);
    const [p7, p14, p30] = await Promise.all([
      service.pitching(query), service.pitching({ ...query, period: "14d" }),
      service.pitching({ ...query, period: "30d" }),
    ]);
    expect([p7.metrics.ERA.value, p14.metrics.ERA.value, p30.metrics.ERA.value])
      .toEqual([9, 3, 1.8]);
    expect(p30.metrics.WHIP.status).toBe("unavailable");
    expect(reader.findBattingByPlayer).toHaveBeenCalledTimes(3);
    expect(reader.findPitchingByPlayer).toHaveBeenCalledTimes(3);
  });

  it("propagates missing older Fact values only to dependent metrics", () => {
    const result = aggregateBatting({ ...query, period: "30d" }, [batting("new"), batting("old", { doubles: null })]);
    expect(result.metrics.AVG.status).toBe("complete");
    expect(result.metrics.SLG.status).toBe("partial");
    expect(result.metrics.OPS.status).toBe("partial");
  });
});

const completeDay = (date: string, finalGames: number): DayCoverageEvidence => ({ date,
  dayStatus: finalGames ? "complete" : "no_games", gamesStageStatus: "complete",
  finalGames, completeGames: finalGames, partialGames: 0, failedGames: 0 });
const completeGame = (date: string, gameId: string): GameCoverageEvidence => ({
  date, gameId, gameStatus: "complete", battingStatus: "complete", pitchingStatus: "complete" });

describe("period collection coverage is distinct from metric quality", () => {
  const window = resolvePlayerPeriod(query);
  const dates = periodDates(window);
  const days = dates.map((date) => completeDay(date, date === "2026-09-24" ? 1 : 0));
  const games = [completeGame("2026-09-24", "g1")];

  it("proves all complete days, including no-games days and a player who did not appear", () => {
    const coverage = evaluatePeriodCoverage(window, days, games);
    expect(coverage.status).toBe("complete");
    expect(coverage.noGameDates).toHaveLength(6);
    expect(aggregateBatting(query, [], new Date(at), coverage)).toMatchObject({
      dataStatus: "unavailable", coverage: { status: "complete" }, games: 0 });
  });

  it("marks partial days, failed games and missing Game completeness as partial", () => {
    expect(evaluatePeriodCoverage(window, days.map((day) => day.date === "2026-09-20" ?
      { ...day, dayStatus: "partial" } : day), games).status).toBe("partial");
    expect(evaluatePeriodCoverage(window, days, [{ ...games[0]!, gameStatus: "failed" }]).status).toBe("partial");
    expect(evaluatePeriodCoverage(window, days, [{ ...games[0]!, pitchingStatus: null }]).status).toBe("partial");
  });

  it("does not mistake missing day metadata for a rest day", () => {
    const coverage = evaluatePeriodCoverage(window, days.filter((day) => day.date !== "2026-09-19"), games);
    expect(coverage).toMatchObject({ status: "unknown", unknownDates: ["2026-09-19"] });
    const battingResult = aggregateBatting(query, [batting("g1")], new Date(at), coverage);
    expect(battingResult.metrics.OPS.status).toBe("complete");
    expect(battingResult.coverage.status).toBe("unknown");
  });

  it("keeps complete coverage separate from unavailable WHIP and partial coverage from complete OPS", () => {
    const complete = evaluatePeriodCoverage(window, days, games);
    expect(aggregatePitching(query, [pitching("g1")], new Date(at), complete))
      .toMatchObject({ coverage: { status: "complete" }, metrics: { WHIP: { status: "unavailable" } } });
    const partial = evaluatePeriodCoverage(window, [{ ...days[0]!, dayStatus: "failed" }, ...days.slice(1)], games);
    expect(aggregateBatting(query, [batting("g1")], new Date(at), partial))
      .toMatchObject({ coverage: { status: "partial" }, metrics: { OPS: { status: "complete" } } });
  });

  it("returns calculated Facts with unavailable coverage when metadata cannot be read", async () => {
    const facts = { findBattingByPlayer: async () => [batting("g1")],
      findPitchingByPlayer: async () => [pitching("g1")] };
    const coverageReader = { findPeriodCoverage: async () => { throw new Error("metadata offline"); } };
    const result = await new PlayerPeriodService(facts, () => new Date(at), coverageReader).batting(query);
    expect(result).toMatchObject({ coverage: { status: "unavailable" }, metrics: { OPS: { status: "complete" } } });
  });
});

const clients: DataClient[] = [];
afterEach(() => { for (const client of clients.splice(0)) client.close(); });
describe("NPB SQL fact reader integration", () => {
  it("reads inclusive dates and two games on the same day without mutating facts", async () => {
    const db = openDataClient("file::memory:"); clients.push(db); await migrateData(db);
    const games: [string, string][] = [["before", "2026-09-17"], ["first", "2026-09-18"],
      ["second", "2026-09-18"], ["last", "2026-09-24"], ["after", "2026-09-25"]];
    for (const [gameId, date] of games) {
      await db.execute({ sql: `INSERT INTO npb_games VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [gameId,2026,date,
        "team","opponent",gameId === "second" ? 2 : 1,null,null,"final",0,0,"nf3",gameId,"https://nf3.sakura.ne.jp/",at,gameId] });
      await db.execute({ sql: `INSERT INTO player_game_batting (game_id,player_id,team_id,pa,ab,hits,doubles,triples,home_runs,walks,hbp,sacrifice_flies,source_key,source_record_id,collected_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, args: [gameId,"p","team",1,1,1,0,0,0,0,0,0,"nf3",gameId,at] });
      await db.execute({ sql: `INSERT INTO player_game_pitching (fact_id,game_id,player_id,team_id,role,ip_outs,walks,source_key,source_record_id,collected_at)
        VALUES (?,?,?,?,?,?,?,?,?,?)`, args: [gameId,gameId,"p","team","reliever",1,null,"nf3",gameId,at] });
    }
    const countBefore = await db.execute("SELECT COUNT(*) AS n FROM player_game_batting");
    const service = new PlayerPeriodService(new NpbRepository(db), () => new Date(at));
    expect((await service.batting(query)).metrics.H.value).toBe(3);
    expect((await service.pitching(query)).metrics.outsRecorded.value).toBe(3);
    expect((await service.batting(query)).games).toBe(3);
    expect((await db.execute("SELECT COUNT(*) AS n FROM player_game_batting")).rows[0]?.n).toBe(countBefore.rows[0]?.n);
  });

  it("reads day runs, enumeration stages and final Game gates in bulk without writes", async () => {
    const db = openDataClient("file::memory:"); clients.push(db); await migrateData(db);
    for (const [date, status, finalGames] of [["2026-09-23", "no_games", 0], ["2026-09-24", "complete", 1]] as const) {
      await db.execute({ sql: `INSERT INTO npb_ingestion_stages VALUES (?,'games','complete',0,?,NULL)`, args: [date, at] });
      await db.execute({ sql: `INSERT INTO npb_day_runs
        (run_id,target_date,trigger_kind,started_at,finished_at,day_status,operational_status,
          scheduled_games,final_games,complete_games,partial_games,failed_games,batter_rows,pitcher_rows,
          mapping_created,requests,retries,backup_status,error_summary)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        args: [date,date,"scheduled",at,at,status,"succeeded",finalGames,finalGames,finalGames,
          0,0,0,0,0,0,0,"exported",null] });
    }
    await db.execute({ sql: `INSERT INTO npb_games VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: ["g1",2026,"2026-09-24","team","opponent",1,null,null,"final",1,0,"nf3","g1",
        "https://nf3.sakura.ne.jp/",at,"g1"] });
    await db.execute({ sql: `INSERT INTO npb_game_completeness VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: ["g1","complete","complete","complete",1,1,1,1,1,1,"{}","[]","nf3",at] });
    const reader = new NpbPeriodCoverageRepository(db);
    const window = { from: "2026-09-23", to: "2026-09-24", timeZone: "Asia/Tokyo" } as const;
    const before = Number((await db.execute("SELECT COUNT(*) AS n FROM npb_day_runs")).rows[0]?.n);
    expect(await reader.findPeriodCoverage(window)).toMatchObject({ status: "complete",
      completeGameDates: ["2026-09-24"], noGameDates: ["2026-09-23"] });
    await db.execute({ sql: "UPDATE npb_game_completeness SET pitching_status='failed' WHERE game_id='g1'" });
    expect((await reader.findPeriodCoverage(window)).status).toBe("partial");
    expect(Number((await db.execute("SELECT COUNT(*) AS n FROM npb_day_runs")).rows[0]?.n)).toBe(before);
  });
});
