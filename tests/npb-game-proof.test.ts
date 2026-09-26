import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { load } from "cheerio";
import { openDataClient, migrateData, type DataClient } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import { verifiedNf3Identities } from "../src/data/npb-verified-nf3-identities";
import { parseInningsOuts, type NpbGame } from "../src/data/npb-nf3";
import { findRosterPlayer, parseNf3BattingRoster, parseNf3GameBattingRow,
  parseNf3GamePitchingRow, parseNf3PitchUsage, parseNf3StartingLineup,
  hasNf3BattingGameRow,nf3ProfileParameter } from "../src/data/npb-game-source";
import { controlledGameTargets, hasPlausibleFinalOuts, validateNpbGameFacts } from "../src/data/npb-game-collector";
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
  it("does not degrade authoritative batting and pitching facts when limited collection revisits a game", async () => {
    const client = await db(); const repository = new NpbRepository(client);
    await repository.saveGames([game],date,false);
    const playerId = await repository.resolveVerifiedPlayer("2026:M:uniform:10","上田希由翔",game.sourceUrl,game.homeTeamId,at,false);
    const full = parseNf3GameBattingRow(fixture("batting-m10"),date,"M",playerId,"2026:M:uniform:10",game.sourceUrl,at).row;
    const fact = { ...full.fact, gameId, pa: 0, ab: 0, doubles: 2, triples: 1, walks: 1,
      hbp: 1, sacrificeHits: 1, sacrificeFlies: 1, battingOrder: 3, starter: true };
    await repository.saveBatting([{ ...full, fact }],date,false,false);
    const limited = { ...full, fact: { ...fact, pa: null, doubles: null, triples: null, walks: null,
      hbp: null, sacrificeHits: null, sacrificeFlies: null, battingOrder: null, starter: null,
      hits: 0, strikeouts: 0 } };
    await repository.saveBatting([limited],date,false,false,"limited");
    expect((await repository.findBattingByGame(gameId))[0]).toMatchObject({ pa: 0, doubles: 2,
      triples: 1, walks: 1, hbp: 1, sacrificeHits: 1, sacrificeFlies: 1,
      battingOrder: 3, starter: true });
    await repository.saveBatting([limited],date,false,false,"limited");
    expect(await repository.findBattingByGame(gameId)).toHaveLength(1);
    const pitcherId = await repository.resolveVerifiedPlayer("2026:M:uniform:18","石垣元気",game.sourceUrl,game.homeTeamId,at,false);
    const pitch = parseNf3GamePitchingRow(fixture("pitching-m18"),date,"M",pitcherId,"2026:M:uniform:18",game.sourceUrl,at);
    await repository.savePitching([pitch],date,false,false);
    await repository.savePitching([{ ...pitch, fact: { ...pitch.fact, inningsPitchedOuts: null,
      battersFaced: null, pitches: null, walksAndHitBatters: null } }],date,false,false,"limited");
    expect((await repository.findPitchingByGame(gameId))[0]).toMatchObject({
      inningsPitchedOuts: pitch.fact.inningsPitchedOuts, battersFaced: pitch.fact.battersFaced,
      pitches: pitch.fact.pitches, walksAndHitBatters: pitch.fact.walksAndHitBatters });
  });
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
    const unknown=parseNf3GameBattingRow($.html(),date,"M","player-10","source-10",game.sourceUrl,at);
    expect(unknown.row.fact.pa).toBeNull();
    expect(unknown.unsupportedPaEvents).toContain("不明");
  });

  it("preserves combined pitcher walks+HBP without inventing separate counts", () => {
    const pitcher = parseNf3GamePitchingRow(fixture("pitching-m18"),date,"M","pitcher-18","source-18",game.sourceUrl,at).fact;
    expect(pitcher).toMatchObject({ role: "reliever", walks: null, hitBatters: null,
      walksAndHitBatters: expect.any(Number), pitches: expect.any(Number) });
    const starter = parseNf3GamePitchingRow(fixture("pitching-b22"),date,"B","pitcher-22","source-22",game.sourceUrl,at).fact;
    expect(starter.role).toBe("starter");
    expect(parseInningsOuts("0.1")).toBe(1);
    expect(parseInningsOuts("0.2")).toBe(2);
    const $ = load(fixture("primary-pitching-g41"));
    $("table.Base").filter((_,element)=>$(element).find("caption").text().includes("全投球成績"))
      .find("tr[onmouseover]").filter((_,element)=>$(element).children("td").first().text().trim()==="9/23")
      .first().children("td").eq(8).text("?");
    expect(()=>parseNf3GamePitchingRow($.html(),date,"G","pitcher","source",game.sourceUrl,at))
      .toThrow(/Unknown nf3 pitcher result marker/);
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

describe("2026-09-25 Tigers intentional-walk regression", () => {
  it("counts the real 敬遠 token as one walk only when nf3's combined column agrees", () => {
    const html = fixture("repair-batting-t12");
    const parsed = parseNf3GameBattingRow(html,"2026-09-25","T","player-12","source-12",game.sourceUrl,at);
    expect(parsed.detail).toEqual(["遊ゴロ","敬遠","空三振"]);
    expect(parsed.unsupportedPaEvents).toEqual([]);
    expect(parsed.row.fact).toMatchObject({ ab: 2, walks: 1, hbp: 0, sacrificeHits: 0,
      sacrificeFlies: 0, pa: 3, hits: 0, strikeouts: 1 });
    const $ = load(html);
    $("tr[onmouseover]").children("td").eq(16).text("2");
    expect(parseNf3GameBattingRow($.html(),"2026-09-25","T","player-12","source-12",game.sourceUrl,at)
      .row.fact).toMatchObject({ walks: null, hbp: null, pa: null });
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
    expect(validateNpbGameFacts(edgeGame,18,batters,2,pitchers,18,2).gameStatus).toBe("complete");
    expect(hasPlausibleFinalOuts(edgeGame,27,24)).toBe(true);
    expect(hasPlausibleFinalOuts(edgeGame,27,25)).toBe(true);
    expect(hasPlausibleFinalOuts(edgeGame,27,26)).toBe(true);
    expect(hasPlausibleFinalOuts(edgeGame,27,27)).toBe(false);
    expect(hasPlausibleFinalOuts(edgeGame,24,24)).toBe(false);
    expect(hasPlausibleFinalOuts({ ...edgeGame, homeScore: 1, awayScore: 2 },27,27)).toBe(true);
    expect(hasPlausibleFinalOuts({ ...edgeGame, homeScore: 1, awayScore: 2 },30,30)).toBe(true);
    expect(validateNpbGameFacts(edgeGame,18,batters.slice(1),2,pitchers,17,2).gameStatus).toBe("partial");
    expect(validateNpbGameFacts(edgeGame,18,batters,2,pitchers.slice(1),18,1).gameStatus).toBe("partial");
    const impossibleDouble = [{ ...batters[0]!, hits: 0, doubles: 1 }, ...batters.slice(1)];
    expect(validateNpbGameFacts(edgeGame,18,impossibleDouble,2,pitchers,18,2).gameStatus).toBe("partial");
  });
});

describe("2026-09-23 additional controlled game edge cases", () => {
  const batter = (name: string, team: string) => parseNf3GameBattingRow(
    fixture(name),date,team,`player-${name}`,`source-${name}`,game.sourceUrl,at);
  const pitcher = (name: string, team: string) => parseNf3GamePitchingRow(
    fixture(name),date,team,`player-${name}`,`source-${name}`,game.sourceUrl,at);

  it("reads real triple, HBP and sacrifice-hit tokens without counting them as AB", () => {
    expect(batter("supp-batting-db00","DB")).toMatchObject({
      detail: ["空三振","中３","中飛","二ゴロ","三ゴロ"], row: { fact: { pa: 5, ab: 5, triples: 1 } } });
    expect(batter("supp-batting-db25","DB")).toMatchObject({
      detail: ["二ゴロ","三ゴロ","空三振","死球"], row: { fact: { pa: 4, ab: 3, hbp: 1, walks: 0 } } });
    expect(batter("supp-batting-d9","D").row.fact).toMatchObject({ pa: 5, ab: 4, hbp: 1 });
    expect(batter("primary-batting-c19","C")).toMatchObject({
      detail: ["捕犠打","三ゴロ"], row: { fact: { pa: 2, ab: 1, sacrificeHits: 1, sacrificeFlies: 0 } } });
  });

  it("reads real fractional innings, hold, save, zero-out relief and combined four-dead-ball counts", () => {
    expect(pitcher("primary-pitching-g21","G").fact).toMatchObject({
      inningsPitchedOuts: 17, decision: "win", walks: null, hitBatters: null,
      walksAndHitBatters: 2, pitches: 89, appearanceOrder: null });
    expect(pitcher("primary-pitching-g41","G").fact).toMatchObject({
      inningsPitchedOuts: 1, role: "reliever", decision: "hold", pitches: 13 });
    expect(pitcher("primary-pitching-g92","G").fact).toMatchObject({
      inningsPitchedOuts: 3, decision: "save", pitches: 12 });
    expect(pitcher("primary-pitching-g91","G").fact).toMatchObject({
      inningsPitchedOuts: 0, role: "reliever", walksAndHitBatters: 1, pitches: 4 });
  });

  it("accepts extra-inning home wins and rejects incomplete defensive-out shapes", () => {
    const target = controlledGameTargets.supplemental;
    const final: NpbGame = { ...game, id: target.id, homeTeamId: target.home, awayTeamId: target.away,
      homeScore: target.homeScore, awayScore: target.awayScore };
    expect(hasPlausibleFinalOuts(final,36,33)).toBe(true);
    expect(hasPlausibleFinalOuts(final,36,34)).toBe(true);
    expect(hasPlausibleFinalOuts(final,36,35)).toBe(true);
    expect(hasPlausibleFinalOuts(final,36,30)).toBe(false);
    expect(hasPlausibleFinalOuts(final,35,33)).toBe(false);
  });

  it("accepts a source profile suffix but still rejects a wrong team or malformed path", () => {
    const html = fixture("roster-m").replace(/\/f\/(\d+)_stat\.htm/, "/f/$1ff_stat.htm");
    expect(parseNf3BattingRoster(html,"M")).toHaveLength(parseNf3BattingRoster(fixture("roster-m"),"M").length);
    expect(() => parseNf3BattingRoster(html,"B")).toThrow(/Unexpected nf3 player profile/);
    expect(nf3ProfileParameter("https://nf3.sakura.ne.jp/Central/S/f/13ff_stat.htm","S","13")).toBe("13ff");
    expect(() => nf3ProfileParameter("https://nf3.sakura.ne.jp/Central/S/f/13ff_stat.htm","T","13"))
      .toThrow(/Unexpected nf3 player profile ID/);
    expect(hasNf3BattingGameRow(fixture("primary-batting-c19"),date)).toBe(true);
    expect(hasNf3BattingGameRow(fixture("primary-batting-c19"),"2026-09-22")).toBe(false);
  });

  it("resolves a same-team curated role ID as a verified uniform alias without merging homonyms",async()=>{
    const client=await db(); const repository=new NpbRepository(client);
    await client.batch([
      {sql:"INSERT INTO source_entity_mappings VALUES ('nf3','player',?,?,?,?,?)",
        args:["2026:T:f:5","known-player","https://nf3.sakura.ne.jp/php/stat_disp/stat_disp.php?y=0&leg=0&fpnum=5&tm=T&mon=9&vst=all",at,at]},
      {sql:"INSERT INTO master_history VALUES (?,?,?,?,?,?,?)",args:["player","known-player","2026-01-01",
        JSON.stringify({name:"近本光司",teamId:"npb:team:tigers"}),"nf3","2026:T:f:5",at]},
    ],"write");
    const alias="2026:T:uniform:5";
    const profile="https://nf3.sakura.ne.jp/Central/T/f/5_stat.htm";
    let aliasCandidates=0;
    expect(await repository.resolveVerifiedPlayer(alias,"近本光司",profile,"npb:team:tigers",at,true,
      ()=>{aliasCandidates++;})).toBe("known-player");
    expect(aliasCandidates).toBe(1);
    expect(await client.execute({sql:"SELECT * FROM source_entity_mappings WHERE source_entity_id=?",args:[alias]}))
      .toMatchObject({rows:[]});
    await expect(repository.resolveVerifiedPlayer(alias,"同名別人",profile,"npb:team:tigers",at,true))
      .rejects.toThrow(/Unverified existing player alias/);
    expect(await repository.resolveVerifiedPlayer(alias,"近本光司",profile,"npb:team:tigers",at,false)).toBe("known-player");
    const rows=await client.execute({sql:"SELECT * FROM source_entity_mappings WHERE source_entity_id=?",args:[alias]});
    expect(rows.rows).toHaveLength(1);
  });

  it("keeps the reviewed Hawks R. Osuna separate from the Swallows J. Osuna", async () => {
    const client = await db();
    const repository = new NpbRepository(client);
    const identity = verifiedNf3Identities[0];
    const swallowsId = "c3fc5eab-2404-42e1-9e67-9682c114de9c";
    await client.batch([
      { sql: "INSERT INTO source_entity_mappings VALUES ('nf3','player',?,?,?,?,?)",
        args: ["2026:S:uniform:13",swallowsId,"https://nf3.sakura.ne.jp/Central/S/f/13_stat.htm",at,at] },
      { sql: "INSERT INTO master_history VALUES (?,?,?,?,?,?,?)",
        args: ["player",swallowsId,"2026-01-01",JSON.stringify({name:"オスナ",teamId:"npb:team:swallows"}),
          "nf3","2026:S:uniform:13",at] },
    ], "write");
    let wouldCreate = 0;
    expect(await repository.resolveVerifiedPlayer(identity.sourceId,identity.name,identity.profileUrl,
      identity.teamId,at,true,() => { wouldCreate++; })).toBe(identity.playerId);
    expect(wouldCreate).toBe(1);
    expect((await client.execute("SELECT COUNT(*) AS n FROM master_history WHERE entity_kind='player'")).rows[0]?.n).toBe(1);
    await expect(repository.resolveVerifiedPlayer(identity.sourceId,identity.name,identity.profileUrl,
      "npb:team:swallows",at,true)).rejects.toThrow(/identity mismatch/);
    await expect(repository.resolveVerifiedPlayer(identity.sourceId,identity.name,
      "https://nf3.sakura.ne.jp/Pacific/H/p/54ff_stat.htm",identity.teamId,at,true))
      .rejects.toThrow(/identity mismatch/);
    await expect(repository.resolveVerifiedPlayer(identity.sourceId,"別人",identity.profileUrl,identity.teamId,at,true))
      .rejects.toThrow(/identity mismatch/);
    await expect(repository.resolveVerifiedPlayer("2026:M:uniform:54","オスナ",identity.profileUrl,
      "npb:team:marines",at,true)).rejects.toThrow(/Unresolved possible existing\/transferred player/);
    expect(await repository.resolveVerifiedPlayer(identity.sourceId,identity.name,identity.profileUrl,
      identity.teamId,at,false)).toBe(identity.playerId);
    expect(await repository.resolveVerifiedPlayer(identity.sourceId,identity.name,identity.profileUrl,
      identity.teamId,at,false)).toBe(identity.playerId);
    const mappings = await client.execute("SELECT source_entity_id,internal_entity_id FROM source_entity_mappings WHERE entity_kind='player'");
    expect(mappings.rows).toHaveLength(2);
    expect(mappings.rows.find((row) => row.source_entity_id === identity.sourceId)?.internal_entity_id).toBe(identity.playerId);
    expect(mappings.rows.find((row) => row.source_entity_id === "2026:S:uniform:13")?.internal_entity_id).toBe(swallowsId);
  });

  it("corrects observed edge fields by upsert without duplicate facts", async () => {
    const target = controlledGameTargets.supplemental;
    const supplemental: NpbGame = { ...game, id: target.id, homeTeamId: target.home, awayTeamId: target.away,
      homeScore: target.homeScore, awayScore: target.awayScore };
    const client = await db(); const repository = new NpbRepository(client);
    await repository.saveGames([supplemental],date,false);
    const trip = batter("supp-batting-db00","DB").row;
    const hbp = batter("supp-batting-db25","DB").row;
    await repository.saveBatting([trip,hbp],date,false,false);
    await repository.saveBatting([trip,hbp],date,false,false);
    expect(await repository.findBattingByGame(target.id)).toHaveLength(2);
    await repository.saveBatting([{ ...trip, fact: { ...trip.fact, triples: 0, sacrificeHits: 1,
      sacrificeFlies: 1 } },{ ...hbp, fact: { ...hbp.fact, hbp: 0 } }],date,false,false);
    const corrected = await repository.findBattingByGame(target.id);
    expect(corrected.find((row) => row.playerId === trip.fact.playerId))
      .toMatchObject({ triples: 0, sacrificeHits: 1, sacrificeFlies: 1 });
    expect(corrected.find((row) => row.playerId === hbp.fact.playerId)?.hbp).toBe(0);
    const hold = pitcher("primary-pitching-g41","G");
    const primary = controlledGameTargets.primary;
    await repository.saveGames([{ ...game, id: primary.id, homeTeamId: primary.home,
      awayTeamId: primary.away, homeScore: primary.homeScore, awayScore: primary.awayScore }],date,false);
    await repository.savePitching([hold],date,false,false);
    await repository.savePitching([hold],date,false,false);
    await repository.savePitching([{ ...hold, fact: { ...hold.fact, decision: "save", pitches: 14 } }],date,false,false);
    expect(await repository.findPitchingByGame(primary.id)).toMatchObject([{ decision: "save", pitches: 14 }]);
  });
});
