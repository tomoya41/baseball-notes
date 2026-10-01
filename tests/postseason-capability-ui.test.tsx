// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { MlbHistoricalRoutes } from "../src/ui/mlb-historical";
import { postseasonCapabilities } from "../src/domain/postseason-capabilities";
import { historicalId, historicalTeamId } from "../src/data/mlb-historical";

const { fetchData, remember } = vi.hoisted(() => ({fetchData:vi.fn(),remember:vi.fn()}));
vi.mock("../src/app/mobile-services", () => ({publicDataFetch:fetchData,rememberPublicResponse:remember}));
const home = historicalTeamId("ATL"), away = historicalTeamId("HOU");
const manifest = {schemaVersion:1,league:"MLB",current2026:"unavailable",teams:[{id:home,name:"Home"}],seasons:[{season:2025,firstDate:"2025-10-01",lastDate:"2025-10-01",games:1,coverage:"complete",playerCount:0}]};
const released = () => ({...postseasonCapabilities,leagues:{...postseasonCapabilities.leagues,MLB:{...postseasonCapabilities.leagues.MLB,historical:{status:"available",reason:null},historicalSeasons:[2025]}}});
const gameId = historicalId("game","ui-audit"), date = "2025-10-01";
const hub = {schemaVersion:1,league:"MLB",competitionType:"postseason",season:2025,coverage:"complete",effectiveDate:date,generatedAt:"2026-10-01T00:00:00Z",games:1,battingFacts:0,pitchingFacts:0,
  playerStats:{status:"available",reason:null},analysis:{status:"not_ready",reason:"pending"},provenance:{provider:"Retrosheet",archiveSha256:"a".repeat(64),verifiedAt:"2026-10-01T00:00:00Z"},
  series:[{id:historicalId("series","ui-audit"),league:"MLB",season:2025,competitionType:"postseason",round:"world_series",name:"Series",bestOf:1,winsRequired:1,
    teams:[{teamId:home,playedWins:1,advantageWins:0,seriesTotal:1},{teamId:away,playedWins:0,advantageWins:0,seriesTotal:0}],
    games:[{gameId,date,gameNumber:1,homeTeamId:home,awayTeamId:away,homeRuns:1,awayRuns:0,status:"final",scheduledAt:null,winnerId:home}],status:"complete",winnerId:home,clinched:true,advancesToSeriesId:null,effectiveDate:date}]};
let root:Root, container:HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
  container=document.createElement("div");document.body.append(container);root=createRoot(container);
  fetchData.mockReset();remember.mockReset();
  fetchData.mockImplementation(async (url:string) => {
    if(url.endsWith("data/postseason/capabilities.json"))return Response.json(postseasonCapabilities);
    if(url.endsWith("postseason/hub/2025.json.gz"))return Response.json(hub);
    if(url.endsWith("manifest.json.gz"))return Response.json(manifest);
    if(url.endsWith("players/index.json.gz"))return Response.json({schemaVersion:1,league:"MLB",players:[]});
    return new Response(null,{status:404});
  });
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
async function mount(path:string){await act(async()=>root.render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/MLB/*" element={<MlbHistoricalRoutes favorites={[]} saving={false} toggle={()=>{}} />} /></Routes></MemoryRouter>));}
const postseasonRequests=()=>fetchData.mock.calls.map(([url])=>String(url)).filter(url=>url.includes("historical/postseason/"));

describe("published Postseason UI capability admission",()=>{
  it.each(["/MLB/postseason?season=2025","/MLB/search?competition=postseason&season=2025","/MLB/players/id?competition=postseason&season=2025"])("shows explicit preparation and never requests missing historical payloads at %s",async path=>{
    await mount(path);expect(container.textContent).toContain("Postseasonは公開準備中");expect(postseasonRequests()).toEqual([]);
  });
  it.each(["/MLB/home","/MLB/explore"])("hides the unreleased historical entry at %s",async path=>{
    await mount(path);expect(container.querySelector('a[href*="/postseason"]')).toBeNull();expect(postseasonRequests()).toEqual([]);
  });
  it("uses only published historical seasons and enables their Hub",async()=>{
    fetchData.mockImplementation(async(url:string)=>Response.json(url.endsWith("capabilities.json")?released():url.includes("hub/")?hub:manifest));
    await mount("/MLB/postseason?season=2025");
    expect(container.textContent).toContain("ワールドシリーズ");expect([...container.querySelectorAll("select option")].map(o=>o.textContent)).toEqual(["2025"]);
    expect(postseasonRequests()).toHaveLength(1);
  });
  it("does not fetch Historical data as a Current fallback",async()=>{
    await mount("/MLB/postseason?season=2026");expect(container.textContent).toContain("Source rights pending");expect(postseasonRequests()).toEqual([]);
  });
  it("offers a retry when capability verification cannot load",async()=>{
    fetchData.mockResolvedValue(new Response(null,{status:503}));await mount("/MLB/postseason?season=2025");expect(container.textContent).toContain("利用状況を確認できません");expect(container.textContent).toContain("再読み込み");expect(postseasonRequests()).toEqual([]);
  });
});
