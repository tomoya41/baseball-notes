import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { load } from "cheerio";
import { openDataClient, migrateData, type DataClient } from "../src/data/database";
import { parseNf3Standings, parseNf3TeamGames, parseNf3BattingLogs, parseNf3PitchingLogs, parseInningsOuts, resolveNpbTeam, normalizeNpbName } from "../src/data/npb-nf3";
import { NpbRepository } from "../src/data/npb-repository";
import { runNpbCollector, jstToday } from "../src/data/npb-collector";
import { npbLatestStandingsSchema } from "../src/domain/standings";
import { StaticStandingsRepository } from "../src/infrastructure/providers/static-standings-repository";
import { formatGamesBehind, formatWinningPercentage } from "../src/presentation/formatters";

const at = "2026-09-24T00:00:00.000Z";
const url = "https://nf3.sakura.ne.jp/Stats/Standing.htm";
const fixture = (name: string) => readFileSync(fileURLToPath(new URL(`./fixtures/nf3/${name}.html`, import.meta.url)),"utf8");
const clients: DataClient[] = [];
async function db() {
  const client = openDataClient("file::memory:");
  clients.push(client);
  await migrateData(client);
  return client;
}
afterEach(() => { for (const client of clients.splice(0)) client.close(); });

describe("nf3 normalized NPB data", () => {
  it("parses six Central and six Pacific standings including leader and half games", () => {
    const rows = parseNf3Standings(fixture("standings"),"2026-09-23",at);
    expect(rows).toHaveLength(12);
    expect(rows.filter((row) => row.competitionGroup === "Central")).toHaveLength(6);
    expect(rows.filter((row) => row.competitionGroup === "Pacific")).toHaveLength(6);
    expect(rows[0]).toMatchObject({ rank: 1, gamesBehindLeader: 0, wins: 75, losses: 58, ties: 1 });
    expect(rows[1]?.gamesBehindLeader).toBe(1.5);
    expect(rows[0]?.streak).toBe(4);
    expect(formatGamesBehind(0,1)).toBe("—");
    expect(formatGamesBehind(1.5,2)).toBe("1.5");
    expect(formatWinningPercentage(0.564)).toBe(".564");
    expect(() => parseNf3Standings(fixture("standings").replace("勝差","差なし"),"2026-09-23",at)).toThrow(/schema changed/);
    expect(() => parseNf3Standings(fixture("standings").replace("<td>75</td>","<td>175</td>"),"2026-09-23",at)).toThrow();
    expect(jstToday(new Date("2026-09-23T15:00:00.000Z"))).toBe("2026-09-24");
  });

  it("maps twelve teams without converting display names into source identity", () => {
    expect(resolveNpbTeam("ＤｅＮＡ").id).toBe("npb:team:baystars");
    expect(resolveNpbTeam("ソフトバンク").group).toBe("Pacific");
    expect(normalizeNpbName("髙橋　遥人")).toBe(normalizeNpbName("髙橋遥人"));
    expect(() => resolveNpbTeam("未知球団")).toThrow(/Unresolved/);
  });

  it("parses final/scheduled/postponed games and keeps doubleheaders separate", () => {
    const page = fixture("games");
    const games = parseNf3TeamGames(page,"T",2026,url,at);
    expect(games).toHaveLength(2);
    expect(games.find((game) => game.date === "2026-09-23")).toMatchObject({ status: "final", awayScore: 8, homeScore: 4 });
    expect(games.find((game) => game.date === "2026-09-25")?.status).toBe("scheduled");
    expect(parseNf3TeamGames(page.replace("8-4","中止"),"T",2026,url,at)[0]?.status).toBe("postponed");
    const $ = load(page);
    const table = $("table.Base");
    table.append(table.find("tr[onmouseover]").first().clone());
    const repeat = parseNf3TeamGames($.html(table),"T",2026,url,at);
    expect(repeat.filter((game) => game.date === "2026-09-23").map((game) => game.gameNumber)).toEqual([1,2]);
    expect(repeat[0]?.id).not.toBe(repeat[2]?.id);
  });

  it("parses batting values, zero AB/pinch cases and explicit nullable fields", () => {
    const rows = parseNf3BattingLogs(fixture("batting"),2026,"T","player-1",url,at);
    expect(rows).toHaveLength(2);
    expect(rows[1]?.fact).toMatchObject({ ab: 3, hits: 1, battingOrder: 3, runs: 2, pa: null });
    const $ = load(fixture("batting"));
    const cells = $("tr[onmouseover]").last().children("td");
    cells.eq(5).text("途中"); cells.eq(10).text("0"); cells.eq(12).text("0");
    cells.eq(13).text("0"); cells.eq(16).text("0"); cells.eq(25).text("");
    const pinch = parseNf3BattingLogs($.html(),2026,"T","player-1",url,at)[1]?.fact;
    expect(pinch).toMatchObject({ battingOrder: null, starter: false, ab: 0, hits: 0 });
  });

  it("stores baseball innings as integer outs for starter and reliever", () => {
    expect(parseInningsOuts("0.1")).toBe(1);
    expect(parseInningsOuts("0.2")).toBe(2);
    expect(parseInningsOuts("5.2")).toBe(17);
    expect(() => parseInningsOuts("5.3")).toThrow();
    const starter = parseNf3PitchingLogs(fixture("pitching-starter"),2026,"T","pitcher-1",url,at);
    const reliever = parseNf3PitchingLogs(fixture("pitching-reliever"),2026,"T","pitcher-2",url,at);
    expect(starter[0]?.fact).toMatchObject({ role: "starter", inningsPitchedOuts: 18, pitches: 93, decision: "win" });
    expect(reliever[0]?.fact).toMatchObject({ role: "reliever", inningsPitchedOuts: 2, pitches: 9 });
    const $ = load(fixture("pitching-reliever"));
    $("tr[onmouseover]").first().children("td").eq(8).text("Ｓ");
    expect(parseNf3PitchingLogs($.html(),2026,"T","pitcher-2",url,at)[0]?.fact.decision).toBe("save");
    expect(starter[0]?.fact.walks).toBeNull(); // Source supplies combined walks + HBP only.
  });

  it("upserts corrected facts, keeps daily snapshots, links player logs and supports history query", async () => {
    const client = await db();
    const repository = new NpbRepository(client);
    await repository.syncTeamMappings(at);
    expect(await repository.findTeams()).toHaveLength(12);
    const standings = parseNf3Standings(fixture("standings"),"2026-09-23",at);
    await repository.saveStandings(standings,false);
    await repository.saveStandings(standings,false);
    await repository.saveStandings(standings.map((row) => ({ ...row, date: "2026-09-24" })),false);
    expect(await repository.findStandingsByDate("2026-09-23")).toHaveLength(12);
    expect((await repository.findLatestStandings())[0]?.date).toBe("2026-09-24");
    const games = parseNf3TeamGames(fixture("games"),"T",2026,url,at);
    expect(await repository.saveGames(games,"2026-09-23",false)).toMatchObject({ inserted: 2 });
    expect(await repository.saveGames(games,"2026-09-23",false)).toMatchObject({ skipped: 2 });
    const corrected = parseNf3TeamGames(fixture("games").replace("8-4","8-5"),"T",2026,url,at);
    expect(await repository.saveGames(corrected,"2026-09-23",false)).toMatchObject({ updated: 1 });
    expect((await repository.findGamesByDate("2026-09-23"))[0]?.homeScore).toBe(5);
    const playerId = await repository.resolveCuratedPlayer("2026:T:f:1","森下翔太",url,"npb:team:tigers",at,false);
    expect(await repository.resolveCuratedPlayer("2026:T:f:1","森下翔太",url,"npb:team:tigers",at,false)).toBe(playerId);
    const batting = parseNf3BattingLogs(fixture("batting"),2026,"T",playerId,url,at).filter((row) => row.date === "2026-09-23");
    const pitching = parseNf3PitchingLogs(fixture("pitching-starter"),2026,"T","pitcher-1",url,at);
    await repository.saveBatting(batting,"2026-09-23",false);
    await repository.savePitching(pitching,"2026-09-23",false);
    expect((await repository.findBattingByPlayer(playerId,"2026-09-23","2026-09-23"))[0]?.hits).toBe(1);
    expect((await repository.findPitchingByPlayer("pitcher-1","2026-09-23","2026-09-23"))[0]?.inningsPitchedOuts).toBe(18);
    expect(Number((await client.execute("SELECT COUNT(*) AS n FROM player_game_batting")).rows[0]?.n)).toBe(1);
    expect(Number((await client.execute("SELECT COUNT(*) AS n FROM player_game_pitching")).rows[0]?.n)).toBe(1);
    expect((await client.execute("SELECT status FROM npb_ingestion_stages WHERE stage='batting'")).rows[0]?.status).toBe("partial");
  });

  it("preserves successful standings when later pages fail", async () => {
    const client = await db();
    const result = await runNpbCollector(client,{ targetDate: "2026-09-23", archivedCapture: true, dryRun: false,
      request: async (requested) => {
        if (requested.endsWith("Standing.htm")) return fixture("standings");
        throw new Error("test source unavailable");
      } });
    expect(result).toMatchObject({ status: "partial", standings: 12, games: 0 });
    expect(await new NpbRepository(client).findStandingsByDate("2026-09-23")).toHaveLength(12);
  });

  it("validates generated NPB payload through the browser repository", async () => {
    const standings = parseNf3Standings(fixture("standings"),"2026-09-23",at);
    const payload = npbLatestStandingsSchema.parse({ schemaVersion: 1, league: "NPB", throughDate: "2026-09-23",
      effectiveDate: "2026-09-23", generatedAt: at, collectedAt: at, sourceUpdatedAt: null,
      sourceKey: "nf3", attribution: "nf3",
      teams: Object.fromEntries(standings.map((row) => [row.teamId, { name: row.teamId, short: row.teamId }])), standings });
    const request = async () => new Response(JSON.stringify(payload),{ status: 200 });
    expect((await new StaticStandingsRepository("/",request as typeof fetch).findLatestNpb())?.standings).toHaveLength(12);
  });
});
