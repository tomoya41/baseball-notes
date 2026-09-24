import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { load } from "cheerio";
import { openDataClient, migrateData, type DataClient } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import { parseInningsOuts, type NpbGame } from "../src/data/npb-nf3";
import { findRosterPlayer, parseNf3BattingRoster, parseNf3GameBattingRow,
  parseNf3GamePitchingRow, parseNf3PitchUsage, parseNf3StartingLineup } from "../src/data/npb-game-source";
import { controlledGameTargets, validateNpbGameFacts } from "../src/data/npb-game-collector";
import { playerGameBattingSchema, playerGamePitchingSchema } from "../src/domain/game-facts";

const date = "2026-09-23";
const at = "2026-09-24T00:00:00.000Z";
const gameId = "npb:game:31c350227cecf978f3e8";
const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/npb-game/${name}.html`, import.meta.url)), "utf8");
const game: NpbGame = { id: gameId, season: 2026, date,
  homeTeamId: "npb:team:marines", awayTeamId: "npb:team:buffaloes", gameNumber: 1,
  venue: "ZOZOマリン", scheduledTime: "18:00", status: "final", homeScore: 0, awayScore: 1,
  sourceKey: "nf3", sourceRecordId: "proof", sourceUrl: "https://nf3.sakura.ne.jp/", collectedAt: at };
const clients: DataClient[] = [];
async function db(): Promise<DataClient> {
  const client = openDataClient("file::memory:"); clients.push(client); await migrateData(client); return client;
}
afterEach(() => { for (const client of clients.splice(0)) client.close(); });

describe("2026-09-23 controlled NPB game proof", () => {
  it("discovers nine starters, a substitute, and all three Marines pitchers from independent page types", () => {
    const starters = parseNf3StartingLineup(fixture("lineup-m"), date, "M");
    const roster = parseNf3BattingRoster(fixture("roster-m"), "M");
    const usage = parseNf3PitchUsage(fixture("usage-m"), date, "M");
    expect(starters).toHaveLength(9);
    expect(starters.map((item) => item.battingOrder)).toEqual([1,2,3,4,5,6,7,8,9]);
    expect(findRosterPlayer(roster,"安田尚憲").number).toBe("5");
    expect(usage.map((item) => item.number)).toEqual(["18","47","48"]);
    expect(() => parseNf3StartingLineup(fixture("lineup-m").replace("９番","九番"),date,"M")).toThrow(/schema changed/);
  });

  it("derives PA and extra-base hits only when plate-appearance detail reconciles", () => {
    const starter = parseNf3GameBattingRow(fixture("batting-m10"),date,"M","player-10","source-10",game.sourceUrl,at);
    const substitute = parseNf3GameBattingRow(fixture("batting-m5"),date,"M","player-5","source-5",game.sourceUrl,at);
    expect(starter.substitutions).toContain("安田尚憲");
    expect(starter.row.fact).toMatchObject({ pa: expect.any(Number), doubles: expect.any(Number), triples: expect.any(Number) });
    expect(substitute.row.fact.ab).toBe(1);
    const zeroAb = parseNf3GameBattingRow(fixture("batting-b8"),date,"B","player-8","source-8",game.sourceUrl,at);
    expect(zeroAb.row.fact.ab).toBe(0);
    expect(zeroAb.row.fact.pa).toBe(0);
    const $ = load(fixture("batting-m10"));
    $("tr[onmouseover]").first().children("td").eq(25).append(" 不明");
    expect(parseNf3GameBattingRow($.html(),date,"M","player-10","source-10",game.sourceUrl,at).row.fact.pa).toBeNull();
  });

  it("preserves combined pitcher walks+HBP without inventing separate counts", () => {
    const pitcher = parseNf3GamePitchingRow(fixture("pitching-m18"),date,"M","pitcher-18","source-18",game.sourceUrl,at).fact;
    expect(pitcher).toMatchObject({ role: "reliever", walks: null, hitBatters: null,
      walksAndHitBatters: expect.any(Number), pitches: expect.any(Number) });
    const starter = parseNf3GamePitchingRow(fixture("pitching-b22"),date,"B","pitcher-22","source-22",game.sourceUrl,at).fact;
    expect(starter.role).toBe("starter");
    expect(parseInningsOuts("0.1")).toBe(1);
    expect(parseInningsOuts("0.2")).toBe(2);
  });

  it("requires independent roster and box-score checks before declaring complete", () => {
    const batting = [game.homeTeamId,game.awayTeamId].flatMap((teamId) => Array.from({ length: 9 }, (_, index) =>
      playerGameBattingSchema.parse({ gameId, playerId: `${teamId}:${index}`, teamId,
        opponentTeamId: teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId,
        battingOrder: index+1, starter: true, pa: teamId === game.awayTeamId && index === 0 ? 4 : 3,
        ab: teamId === game.awayTeamId && index === 0 ? 4 : 3,
        hits: teamId === game.awayTeamId && index === 0 ? 1 : 0,
        homeRuns: teamId === game.awayTeamId && index === 0 ? 1 : 0,
        runs: teamId === game.awayTeamId && index === 0 ? 1 : 0,
        doubles: 0, triples: 0, rbi: 0, walks: 0, strikeouts: 0, hbp: 0,
        stolenBases: 0, caughtStealing: 0, sourceKey: "nf3", sourceRecordId: `${teamId}:${index}`, collectedAt: at })));
    const pitching = [game.homeTeamId,game.awayTeamId].map((teamId) => playerGamePitchingSchema.parse({
      id: `${teamId}:pitcher`, gameId, playerId: `${teamId}:pitcher`, teamId,
      opponentTeamId: teamId === game.homeTeamId ? game.awayTeamId : game.homeTeamId,
      role: "starter", starter: true, appearanceOrder: null, inningsPitchedOuts: 27,
      battersFaced: teamId === game.homeTeamId ? 28 : 27, hits: teamId === game.homeTeamId ? 1 : 0,
      homeRuns: teamId === game.homeTeamId ? 1 : 0, runs: teamId === game.homeTeamId ? 1 : 0,
      earnedRuns: 1, walks: null, strikeouts: 0, pitches: 90, catcherId: null,
      sourceKey: "nf3", sourceRecordId: `${teamId}:pitcher`, collectedAt: at }));
    const complete = validateNpbGameFacts(game,18,batting,2,pitching,18,2);
    expect(complete.gameStatus).toBe("complete");
    expect(validateNpbGameFacts(game,18,batting.slice(1),2,pitching,17,2).gameStatus).toBe("partial");
    expect(validateNpbGameFacts(game,18,batting,2,pitching.slice(1),18,1).gameStatus).toBe("partial");
    expect(validateNpbGameFacts(game,18,batting,2,pitching,17,2).gameStatus).toBe("partial");
    expect(validateNpbGameFacts(game,18,batting,2,pitching,18,2,["parser partial"]).gameStatus).toBe("partial");
  });

  it("maps a verified player once and upserts corrected facts without duplicate rows", async () => {
    const client = await db(); const repository = new NpbRepository(client);
    await repository.saveGames([game],date,false);
    const sourceId = "2026:M:uniform:10";
    const playerId = await repository.resolveVerifiedPlayer(sourceId,"上田希由翔",game.sourceUrl,game.homeTeamId,at,false);
    expect(await repository.resolveVerifiedPlayer(sourceId,"上田希由翔",game.sourceUrl,game.homeTeamId,at,false)).toBe(playerId);
    await expect(repository.resolveVerifiedPlayer(sourceId,"別人",game.sourceUrl,game.homeTeamId,at,false)).rejects.toThrow(/identity changed/);
    await expect(repository.resolveVerifiedPlayer("2026:B:uniform:99","上田希由翔",game.sourceUrl,game.awayTeamId,at,false))
      .rejects.toThrow(/possible existing\/transferred/);
    const parsed = parseNf3GameBattingRow(fixture("batting-m10"),date,"M",playerId,sourceId,game.sourceUrl,at);
    const row = { ...parsed.row, fact: { ...parsed.row.fact, gameId, battingOrder: 2, starter: true } };
    await repository.saveBatting([row],date,false,false);
    await repository.saveBatting([row],date,false,false);
    expect(await repository.findBattingByGame(gameId)).toHaveLength(1);
    await repository.saveBatting([{ ...row, fact: { ...row.fact,
      hits: (row.fact.hits ?? 0)+1, doubles: (row.fact.doubles ?? 0)+1 } }],date,false,false);
    expect((await repository.findBattingByGame(gameId))[0]).toMatchObject({ hits: 1, doubles: 1 });
    const otherPlayer = await repository.resolveVerifiedPlayer("2026:B:uniform:8","麦谷祐介",game.sourceUrl,game.awayTeamId,at,false);
    expect(otherPlayer).not.toBe(playerId);
    const pitcherId = await repository.resolveVerifiedPlayer("2026:M:uniform:18","石垣元気",game.sourceUrl,game.homeTeamId,at,false);
    const pitcher = parseNf3GamePitchingRow(fixture("pitching-m18"),date,"M",pitcherId,"2026:M:uniform:18",game.sourceUrl,at);
    const pitchingRow = { ...pitcher, fact: { ...pitcher.fact, gameId } };
    await repository.savePitching([pitchingRow],date,false,false);
    await repository.savePitching([pitchingRow],date,false,false);
    expect(await repository.findPitchingByGame(gameId)).toHaveLength(1);
    await repository.savePitching([{ ...pitchingRow, fact: { ...pitchingRow.fact, pitches: (pitchingRow.fact.pitches ?? 0)+1 } }],date,false,false);
    expect((await repository.findPitchingByGame(gameId))[0]?.pitches).toBe((pitchingRow.fact.pitches ?? 0)+1);
  });
});

describe("Hawks 10–3 Lions edge-game regression", () => {
  const edge = controlledGameTargets.edge;
  const batting = (name: string, team: "H" | "L") => parseNf3GameBattingRow(
    fixture(name),date,team,`player-${name}`,`source-${name}`,game.sourceUrl,at).row.fact;
  const pitching = (name: string, team: "H" | "L") => parseNf3GamePitchingRow(
    fixture(name),date,team,`player-${name}`,`source-${name}`,game.sourceUrl,at).fact;

  it("counts real nonzero doubles from explicit plate-appearance tokens and reconciles PA with walks", () => {
    expect(batting("edge-batting-h32","H")).toMatchObject({ ab: 5, hits: 3, doubles: 1, triples: 0, pa: 5 });
    expect(batting("edge-batting-l39","L")).toMatchObject({ ab: 4, hits: 1, doubles: 1, triples: 0, pa: 4 });
    expect(batting("edge-batting-h3","H")).toMatchObject({ ab: 4, walks: 1, hbp: 0, pa: 5 });
    expect(batting("edge-batting-h44","H")).toMatchObject({ ab: 0, walks: 1, pa: 1 });
    expect(batting("edge-batting-l68","L")).toMatchObject({ ab: 0, pa: 0, runs: 1 });
  });

  it("rejects uncertain PA or extra-base decomposition, while preserving synthetic HBP/SH/SF parsing", () => {
    const $ = load(fixture("edge-batting-h44"));
    const cells = $("tr[onmouseover]").first().children("td");
    cells.eq(16).text("1");
    cells.eq(25).text("死球");
    expect(parseNf3GameBattingRow($.html(),date,"H","p","s",game.sourceUrl,at).row.fact)
      .toMatchObject({ pa: 1, ab: 0, walks: 0, hbp: 1 });
    cells.eq(16).text("0");
    cells.eq(25).text("犠打 犠飛");
    expect(parseNf3GameBattingRow($.html(),date,"H","p","s",game.sourceUrl,at).row.fact)
      .toMatchObject({ pa: 2, sacrificeHits: 1, sacrificeFlies: 1 });
    cells.eq(25).text("不明");
    expect(parseNf3GameBattingRow($.html(),date,"H","p","s",game.sourceUrl,at).row.fact.pa).toBeNull();
  });

  it("preserves real relief use, W/L and combined pitcher four-dead-ball count", () => {
    expect(pitching("edge-pitching-h10","H")).toMatchObject({ role: "starter", inningsPitchedOuts: 18,
      battersFaced: 22, pitches: 91, decision: "win", walks: null, hitBatters: null, walksAndHitBatters: 2,
      appearanceOrder: null });
    expect(pitching("edge-pitching-l21","L")).toMatchObject({ role: "starter", inningsPitchedOuts: 12,
      pitches: 88, decision: "loss", walks: null, hitBatters: null, walksAndHitBatters: 1 });
    const $ = load(fixture("edge-pitching-h10"));
    const cells = $("tr[onmouseover]").first().children("td");
    cells.eq(8).text("Ｈ");
    expect(parseNf3GamePitchingRow($.html(),date,"H","p","s",game.sourceUrl,at).fact.decision).toBe("hold");
    cells.eq(8).text("Ｓ");
    expect(parseNf3GamePitchingRow($.html(),date,"H","p","s",game.sourceUrl,at).fact.decision).toBe("save");
    expect(parseInningsOuts("0.1")).toBe(1);
    expect(parseInningsOuts("0.2")).toBe(2);
  });

  it("accepts the reviewed home-win 27/24-out shape and rejects missing facts", () => {
    const edgeGame: NpbGame = { ...game, id: edge.id, homeTeamId: edge.home, awayTeamId: edge.away,
      homeScore: edge.homeScore, awayScore: edge.awayScore };
    const batters = [edge.home,edge.away].flatMap((teamId) => Array.from({ length: 9 }, (_, index) =>
      playerGameBattingSchema.parse({ gameId: edge.id, playerId: `${teamId}:${index}`, teamId,
        opponentTeamId: teamId === edge.home ? edge.away : edge.home,
        battingOrder: index+1, starter: true, pa: teamId === edge.home && index < 6 ? 5 : 4,
        ab: teamId === edge.home && index < 6 ? 5 : 4, hits: 0, doubles: 0, triples: 0,
        homeRuns: 0, runs: teamId === edge.home && index === 0 ? 10 : teamId === edge.away && index === 0 ? 3 : 0,
        rbi: 0, walks: 0, strikeouts: 0, hbp: 0, stolenBases: 0, caughtStealing: 0,
        sourceKey: "nf3", sourceRecordId: `${teamId}:${index}`, collectedAt: at })));
    const pitchers = [edge.home,edge.away].map((teamId) => playerGamePitchingSchema.parse({
      id: `${teamId}:pitcher`, gameId: edge.id, playerId: `${teamId}:pitcher`, teamId,
      opponentTeamId: teamId === edge.home ? edge.away : edge.home,
      role: "starter", starter: true, appearanceOrder: null,
      inningsPitchedOuts: teamId === edge.home ? 27 : 24,
      battersFaced: teamId === edge.home ? 36 : 42, hits: 0, homeRuns: 0,
      runs: teamId === edge.home ? 3 : 10, earnedRuns: 0, walks: null, strikeouts: 0,
      pitches: 90, catcherId: null, sourceKey: "nf3", sourceRecordId: `${teamId}:pitcher`, collectedAt: at }));
    const outs = { [edge.home]: 27, [edge.away]: 24 };
    expect(validateNpbGameFacts(edgeGame,18,batters,2,pitchers,18,2,[],outs).gameStatus).toBe("complete");
    expect(validateNpbGameFacts(edgeGame,18,batters.slice(1),2,pitchers,17,2,[],outs).gameStatus).toBe("partial");
    expect(validateNpbGameFacts(edgeGame,18,batters,2,pitchers.slice(1),18,1,[],outs).gameStatus).toBe("partial");
  });
});
