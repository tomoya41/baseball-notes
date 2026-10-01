import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { strToU8, zipSync } from "fflate";
import { buildPostseasonHub, mlbPostseasonBestOf } from "../src/data/mlb-postseason";
import { historicalId, historicalTeamId, importHistoricalSeason, retrosheetRound, type HistoricalGame } from "../src/data/mlb-historical";
import { competitionFromSearch, postseasonHubSchema, seriesSchema, seriesStanding, type PostseasonRound } from "../src/domain/competition";
import { postseasonCapabilities, capabilitiesForVerifiedPostseason } from "../src/domain/postseason-capabilities";
import { historicalRouteCompetition, historicalSearchPath } from "../src/ui/historical-competition-context";
import { validStaticPayload } from "../src/domain/mlb-historical-public";
import { PostseasonBracket, PostseasonUnavailable } from "../src/ui/postseason";
import { canonicalDeepLink, parentNativeRoute } from "../src/domain/native-navigation";
import { historicalAdvancedGate } from "../src/domain/mlb-pa-analysis";
import { leagueSwitchPath } from "../src/domain/cross-league";
import { mergeHistoricalDirectory, type HistoricalDirectoryPlayer } from "../src/domain/historical-directory";
import { readFileSync } from "node:fs";
import { parse } from "yaml";

function bracket() {
  let serial = 0;
  const rounds: [PostseasonRound, string, string][] = [
    ["wild_card","BOS","NYA"], ["wild_card","LAN","SLN"], ["division_series","BOS","TBA"],
    ["division_series","HOU","CHA"], ["division_series","ATL","MIL"], ["division_series","LAN","SFN"],
    ["alcs","HOU","BOS"], ["nlcs","ATL","LAN"], ["world_series","ATL","HOU"],
  ];
  const games: HistoricalGame[] = rounds.flatMap(([round, winner, loser]) => Array.from({ length: Math.floor(mlbPostseasonBestOf(2021, round) / 2) + 1 }, () => ({
    id: historicalId("game", `test-${++serial}`), season: 2021, competitionType: "postseason", postseasonRound: round,
    date: `2021-10-${String(serial).padStart(2,"0")}`, homeTeamId: historicalTeamId(winner), awayTeamId: historicalTeamId(loser),
    homeRuns: 1, awayRuns: 0, innings: 9, number: 0, batting: [], pitching: [], validationIssues: [],
  })));
  return buildPostseasonHub(games, "a".repeat(64), "2026-10-01T00:00:00.000Z");
}
describe("first-class competition and versioned series rules", () => {
  it.each([2020,2021,2022,2023,2024,2025])("uses reviewed %i Wild Card format", year => {
    expect(mlbPostseasonBestOf(year,"wild_card")).toBe(year === 2021 ? 1 : 3);
    expect(mlbPostseasonBestOf(year,"division_series")).toBe(5);
    expect(mlbPostseasonBestOf(year,"alcs")).toBe(7);
    expect(mlbPostseasonBestOf(year,"world_series")).toBe(7);
  });
  it("rejects unreviewed formats and unknown source game types", () => {
    expect(() => mlbPostseasonBestOf(2026,"wild_card")).toThrow();
    expect(() => retrosheetRound("playoff","BOS")).toThrow();
    expect(retrosheetRound("lcs","HOU")).toBe("alcs");
    expect(retrosheetRound("lcs","ATL")).toBe("nlcs");
  });
  it("defaults legacy routes to regular and does not interpret all/bad values as postseason", () => {
    for (const query of ["", "competition=all", "competition=bad"]) expect(competitionFromSearch(new URLSearchParams(query))).toBe("regular");
    expect(competitionFromSearch(new URLSearchParams("competition=postseason"))).toBe("postseason");
  });
  it("connects actual winners into a complete bracket without inventing bye Games", () => {
    const h = bracket();
    expect(h.series).toHaveLength(9); expect(h.series.filter(s => s.advancesToSeriesId)).toHaveLength(8);
    expect(h.series.find(s => s.round === "world_series")?.winnerId).toBe(historicalTeamId("ATL"));
    expect(h.series.every(s => s.clinched)).toBe(true);
    expect(h.series.flatMap(s => s.games)).toHaveLength(h.games);
  });
  it("fails closed on incomplete, duplicate or cross-league bracket references", () => {
    const h = bracket();
    expect(postseasonHubSchema.safeParse({ ...h, games: h.games + 1 }).success).toBe(false);
    expect(postseasonHubSchema.safeParse({ ...h, series: [...h.series,h.series[0]] }).success).toBe(false);
    expect(postseasonHubSchema.safeParse({ ...h, series: h.series.map(s => ({ ...s, advancesToSeriesId: "missing" })) }).success).toBe(false);
  });
  it("keeps an NPB advantage separate from played wins and supports draw-rule clinches", () => {
    expect(seriesStanding(3,1)).toEqual({ playedWins:3, advantageWins:1, seriesTotal:4 });
    expect(() => seriesStanding(-1,1)).toThrow();
    const base = bracket().series[0]!;
    const draw = { ...base, id:base.id.replace("mlb:","npb:"), league:"NPB", round:"npb_cs_final", bestOf:6, winsRequired:4,
      games:base.games.map(g => ({ ...g, gameId:g.gameId.replace("mlb:game:",""), homeTeamId:g.homeTeamId.replace("mlb:team:",""), awayTeamId:g.awayTeamId.replace("mlb:team:",""), homeRuns:0, awayRuns:0, winnerId:null })), teams:base.teams.map((t,i) => ({ ...t, teamId:t.teamId.replace("mlb:team:",""), ...seriesStanding(0,i === 0 ? 1 : 0) })),
      winnerId:base.teams[0]!.teamId.replace("mlb:team:",""), advancesToSeriesId:null, clinchReason:"competition_rule" };
    expect(seriesSchema.safeParse(draw).success).toBe(true);
    expect(draw.games).toHaveLength(base.games.length);
  });
  it("validates result winners and rejects unverified league/round combinations", () => {
    const s = bracket().series[0]!;
    expect(seriesSchema.safeParse({ ...s, round:"japan_series" }).success).toBe(false);
    expect(seriesSchema.safeParse({ ...s, games:s.games.map(g => ({ ...g, awayRuns:3 })) }).success).toBe(false);
    const scheduled = { ...s, teams:s.teams.map(t => ({ ...t, playedWins:0, seriesTotal:0 })), status:"in_progress", clinched:false, winnerId:null,
      games:s.games.map(g => ({ ...g, status:"scheduled", homeRuns:null, awayRuns:null, winnerId:null })) };
    expect(seriesSchema.safeParse(scheduled).success).toBe(true);
    expect(seriesSchema.safeParse({ ...scheduled, winnerId:s.winnerId }).success).toBe(false);
  });
});
describe("scope isolation and capabilities", () => {
  it("admits only explicit Retrosheet postseason types; regular normalization remains byte-identical", () => {
    const text = (name: string) => strToU8(name);
    const zip = zipSync({
      "2025gameinfo.csv":text("gid,season,gametype,date,hometeam,visteam,hruns,vruns,number\nregular,2025,regular,20250901,BOS,NYA,1,0,0\npost,2025,wildcard,20251001,BOS,NYA,1,0,0\nallstar,2025,allstar,20250701,BOS,NYA,1,0,0\n"),
      "2025allplayers.csv":text("id,first,last\n"), "2025batting.csv":text("gid,id,team\n"),
      "2025pitching.csv":text("gid,id,team\n"), "2025teamstats.csv":text("gid,team\n"),
    });
    const legacy = importHistoricalSeason(zip,2025,new Map()), regular = importHistoricalSeason(zip,2025,new Map(),"regular"), post = importHistoricalSeason(zip,2025,new Map(),"postseason");
    expect(JSON.stringify(legacy)).toBe(JSON.stringify(regular));
    expect(regular.games.map(g => g.id)).toEqual([historicalId("game","regular")]);
    expect(regular.games[0]?.competitionType).toBeUndefined();
    expect(post.games.map(g => g.id)).toEqual([historicalId("game","post")]);
    expect(post.games[0]?.competitionType).toBe("postseason");
  });
  it("rejects a postseason payload at a regular endpoint and requires an explicit scope marker", () => {
    const h = bracket(); expect(validStaticPayload("postseason/hub/2021.json",h)).toBe(true);
    expect(validStaticPayload("postseason/hub/2020.json",h)).toBe(false);
    expect(validStaticPayload("postseason/hub/2021.json",{ ...h, competitionType:undefined })).toBe(false);
    const payload = { schemaVersion:1,league:"MLB",season:2021,date:"2021-10-01",games:[],competitionType:"postseason" };
    expect(validStaticPayload("schedule/2021/2021-10-01.json",payload)).toBe(false);
    expect(validStaticPayload("postseason/schedule/2021/2021-10-01.json",payload)).toBe(true);
  });
  it("keeps Current rights and historical analysis admission independent", () => {
    expect(postseasonCapabilities.leagues.NPB.current.status).toBe("unavailable");
    expect(postseasonCapabilities.leagues.MLB.current.reason).toBe("Source rights pending");
    expect(postseasonCapabilities.leagues.MLB.historical.status).toBe("not_ready");
    expect(postseasonCapabilities.leagues.MLB.historicalSeasons).toEqual([]);
    expect(historicalAdvancedGate([]).directBvp).toBe("not_ready");
  });
  it("keeps the directory redirect, search filters and profile-list return in the selected competition", () => {
    const query = "?competition=postseason&season=2025&focus=japan";
    expect(historicalSearchPath(query)).toBe(`/MLB/search${query}`);
    for (const path of ["/MLB/players", "/MLB/search", "/MLB/players/id/analysis"])
      expect(historicalRouteCompetition(path, query)).toBe("postseason");
    expect(historicalRouteCompetition("/MLB/search", "?season=2025")).toBe("regular");
    expect(historicalRouteCompetition("/MLB/home", query)).toBe("regular");
  });
  it("advertises only a complete verified release and keeps analysis/current gates independent", () => {
    expect(capabilitiesForVerifiedPostseason([]).leagues.MLB.postseasonGames.status).toBe("not_ready");
    expect(() => capabilitiesForVerifiedPostseason([bracket()])).toThrow("Incomplete");
    const hubs = [2020,2021,2022,2023,2024,2025].map(season => {
      const h = bracket();
      return { ...h, season, series: h.series.map(s => ({ ...s, season, games: s.games.map(g => ({ ...g, date: `${season}${g.date.slice(4)}` })) })),
        analysis: { status: "available" as const, reason: null } };
    });
    const cap = capabilitiesForVerifiedPostseason(hubs).leagues.MLB;
    expect(cap.historicalSeasons).toEqual([2020,2021,2022,2023,2024,2025]);
    expect(cap.postseasonPlayerStats.status).toBe("available"); expect(cap.current.status).toBe("unavailable");
    expect(capabilitiesForVerifiedPostseason(hubs.map(h => ({ ...h, analysis: { status:"not_ready", reason:"pending" } }))).leagues.MLB.postseasonAnalysis.status).toBe("not_ready");
    expect(() => capabilitiesForVerifiedPostseason(hubs.map(h => ({ ...h, coverage:"partial" })))).toThrow("Incomplete");
  });
  it("maintains canonical deep-link/Back scope and does not carry IDs across leagues", () => {
    const id = historicalId("player","example");
    expect(canonicalDeepLink(`baseballnotes://MLB/players/${encodeURIComponent(id)}/analysis?season=2020&competition=postseason`)).toContain("competition=postseason");
    expect(parentNativeRoute(`/MLB/players/${encodeURIComponent(id)}/analysis?season=2020&competition=postseason`)).toContain("competition=postseason&season=2020");
    expect(parentNativeRoute(`/MLB/players/${encodeURIComponent(id)}?season=2025&competition=postseason`)).toBe("/MLB/search?competition=postseason&season=2025");
    expect(parentNativeRoute(`/MLB/players/${encodeURIComponent(id)}?season=2025`)).toBe("/MLB/search");
    expect(leagueSwitchPath("/MLB/postseason/series/id","?season=2020","NPB")).toBe("/NPB/postseason");
  });
  it("shows released series links and never emits fabricated Current scores", () => {
    const html = renderToStaticMarkup(<MemoryRouter><PostseasonBracket hub={bracket()} /></MemoryRouter>);
    expect(html).toContain("/MLB/postseason/series/"); expect(html).toContain("Best of 1");
    const unavailable = renderToStaticMarkup(<MemoryRouter><PostseasonUnavailable league="NPB" /></MemoryRouter>);
    expect(unavailable).toContain("Source rights pending"); expect(unavailable).not.toContain("scoreboard-row");
  });
  it("unions canonical identities without modifying regular seasons or duplicating shared Players", () => {
    const row: HistoricalDirectoryPlayer = { id:historicalId("player","shared"), name:"Player", positions:["1"], seasons:[2021], teamIds:[historicalTeamId("ATL")] };
    const extra = { ...row, id:historicalId("player","post-only"), seasons:[2025] };
    const snapshot = JSON.stringify(row), merged = mergeHistoricalDirectory([row],[{ ...row, seasons:[2021,2025] },extra]);
    expect(merged).toHaveLength(2); expect(merged[0]).toBe(row); expect(JSON.stringify(row)).toBe(snapshot);
    expect(merged[0]?.seasons).toEqual([2021]); expect(merged[1]?.postseasonOnly).toBe(true);
  });
  it("publishes Postseason only through a guarded whole-site release with regular byte preservation", () => {
    const path = new URL("../.github/workflows/mlb-historical-publish.yml",import.meta.url);
    const text = readFileSync(path,"utf8"), workflow = parse(text);
    expect(workflow.on.workflow_dispatch.inputs.mode.options).toContain("postseason");
    expect(workflow.on.schedule).toBeUndefined();
    expect(workflow.concurrency.group).toBe("daily-npb-collector-and-pages");
    expect(text).toContain("verify-postseason-preservation.ts before"); expect(text).toContain("verify-postseason-preservation.ts after");
    expect(text).toContain("verify-npb-publication.ts dist"); expect(text).toContain("verify-published-postseason.ts");
    expect(text.indexOf("Stage compressed Historical")).toBeLessThan(text.indexOf("Retain Postseason publication evidence"));
  });
});
