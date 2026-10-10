// @vitest-environment jsdom
import { act,type ReactNode } from "react";
import { createRoot,type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach,beforeEach,describe,it,expect,vi } from "vitest";
import { MlbMatchup,MlbSeasonMilestones,SavedSeasonTimeline,SeasonCheckpointSummary } from "../src/ui/mlb-historical-expansion";
import { HistoricalCompetitionContext } from "../src/ui/historical-competition-context";
import { StatGlossary } from "../src/ui/stat-glossary";
const payloads=vi.hoisted(()=>new Map<string,unknown>());
const reads=vi.hoisted(()=>vi.fn());
vi.mock("../src/ui/use-mlb-historical",()=>({useHistoricalStatic:(path:string|null)=>{if(path)reads(path);return {status:path&&payloads.has(path)?"ready":"missing",value:path?payloads.get(path):null,retry:vi.fn()};}}));
const batter="mlb:player:00000000-0000-4000-8000-000000000001",pitcher="mlb:player:00000000-0000-4000-8000-000000000002",t1="mlb:team:00000000-0000-4000-8000-000000000010",t2="mlb:team:00000000-0000-4000-8000-000000000011";
const manifest={seasons:[{season:2020,firstDate:"2020-07-23",lastDate:"2020-09-27",coverage:"complete"},{season:2025,firstDate:"2025-03-18",lastDate:"2025-09-28",coverage:"complete"}],teams:[{id:t1,name:"球団一"},{id:t2,name:"球団二"}]};
const directory={players:[{id:batter,name:"打者",positions:["DH"],seasons:[2020,2025],teamIds:[t1,t2]},{id:pitcher,name:"投手",positions:["P"],seasons:[2025],teamIds:[t1]}]};
const metrics={PA:3,AB:2,H:1,"2B":0,"3B":0,HR:1,BB:1,HBP:0,SO:1,SH:0,SF:0,AVG:.5,OBP:2/3,SLG:2,OPS:8/3};
const counts={H:{value:197,status:"complete" as const},HR:{value:20,status:"complete" as const},RBI:{value:null,status:"unavailable" as const}};
let el:HTMLDivElement,root:Root;
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);payloads.clear();reads.mockClear();el=document.createElement("div");document.body.append(el);root=createRoot(el);payloads.set("players/index.json",directory);});
afterEach(async()=>{await act(async()=>root.unmount());el.remove();vi.unstubAllGlobals();});
async function mount(child:ReactNode,path:string,scope:"regular"|"postseason"="regular"){await act(async()=>root.render(<MemoryRouter initialEntries={[path]}><HistoricalCompetitionContext.Provider value={scope}>{child}</HistoricalCompetitionContext.Provider></MemoryRouter>));}
const path=`advanced/2025/${batter.replaceAll(":","_")}.json`;
describe("MLB Historical Product Track 2 UI",()=>{
  it.each(["regular","postseason"] as const)("shows only admitted exact BvP with scope and PA for %s",async scope=>{
    payloads.set(path,{playerId:batter,scope:"2025",directBvp:"ready",batting:{opponents:[{playerId:pitcher,name:"投手",metrics}]},pitching:{opponents:[]}});
    await mount(<MlbMatchup manifest={manifest} />,`/MLB/matchup?season=2025&batter=${batter}&pitcher=${pitcher}`,scope);
    expect(el.textContent).toContain("対象 3打席");expect(el.textContent).toContain(scope==="postseason"?"Postseason":"Regular Season");expect(el.textContent).toContain("少数打席");expect(reads.mock.calls.flat().some(p=>String(p).startsWith("players/mlb"))).toBe(false);
  });
  it("does not infer a matchup from directory/co-presence and swaps roles without retaining old results",async()=>{
    payloads.set(path,{playerId:batter,scope:"2025",directBvp:"ready",batting:{opponents:[]},pitching:{opponents:[]}});
    await mount(<MlbMatchup manifest={manifest} />,`/MLB/matchup?season=2025&batter=${batter}&pitcher=${pitcher}`);
    expect(el.textContent).toContain("直接対戦は収録されていません");expect(el.textContent).not.toContain("対象 0打席");
    await act(async()=>[...el.querySelectorAll("button")].find(b=>b.textContent==="打者・投手を入れ替える")!.click());
    expect(reads).toHaveBeenCalledWith(`advanced/2025/${pitcher.replaceAll(":","_")}.json`);expect(el.textContent).toContain("対戦データを取得できません");
  });
  it("does not fetch advanced payloads for unknown canonical identities",async()=>{await mount(<MlbMatchup manifest={manifest} />,"/MLB/matchup?season=2025&batter=name-only&pitcher=bad");expect(reads.mock.calls.flat().some(p=>String(p).startsWith("advanced/"))).toBe(false);expect(el.textContent).toContain("未収録");});
  it("fails closed for an unmatched season or BvP gate",async()=>{
    payloads.set(path,{playerId:batter,scope:"2024",directBvp:"ready",batting:{opponents:[{playerId:pitcher,name:"投手",metrics}]},pitching:{opponents:[]}});
    await mount(<MlbMatchup manifest={manifest} />,`/MLB/matchup?season=2025&batter=${batter}&pitcher=${pitcher}`);expect(el.textContent).toContain("利用できません");expect(el.textContent).not.toContain("対象 3打席");
  });
  it.each(["near","achieved"])("uses shared season checkpoints in %s mode",async mode=>{
    payloads.set("seasons/2025.json",{season:2025,firstDate:manifest.seasons[1]!.firstDate,lastDate:manifest.seasons[1]!.lastDate,coverage:"complete",players:[{playerId:batter,batting:counts,pitching:null}]});
    await mount(<MlbSeasonMilestones manifest={manifest} />,`/MLB/milestones?season=2025&mode=${mode}`);
    expect(el.textContent).toContain(mode==="near"?"200まであと3":"150到達");expect(el.textContent).toContain("通算・歴代記録ではありません");expect(reads.mock.calls.flat().some(p=>String(p).startsWith("players/mlb"))).toBe(false);
  });
  it("shows missing Season as unavailable instead of fabricated checkpoints",async()=>{await mount(<MlbSeasonMilestones manifest={manifest} />,`/MLB/milestones?season=2025`);expect(el.textContent).toContain("成績を取得できません");expect(el.querySelectorAll(".checkpoint-row")).toHaveLength(0);});
  it("renders multi-team years and skips uncollected years with scoped navigation",async()=>{
    const p={player:{id:batter,name:"打者",seasons:[2020,2025]},seasonTotals:{"2025":{batting:counts,pitching:null}},batting:[{season:2025,teamId:t1},{season:2025,teamId:t2}],pitching:[]} as unknown as Parameters<typeof SavedSeasonTimeline>[0]["profile"];
    await mount(<SavedSeasonTimeline profile={p} manifest={manifest} competition="postseason" />,`/MLB/players/${batter}/more`);
    expect(el.querySelectorAll(".lifecycle-timeline li")).toHaveLength(2);expect(el.textContent).toContain("球団一");expect(el.textContent).toContain("球団二");expect(el.textContent).not.toContain("2021");expect(el.querySelector('a[href*="game-log"]')?.getAttribute("href")).toContain("competition=postseason");expect(el.querySelector('a[href*="postseason?season=2025"]')).not.toBeNull();
  });
  it("keeps unsupported/unknown checkpoints absent from the Profile summary",async()=>{await mount(<SeasonCheckpointSummary batting={counts} pitching={null} season={2025} playerId={batter} competition="regular" />,`/MLB/players/${batter}`);expect(el.querySelectorAll(".checkpoint-row")).toHaveLength(2);expect(el.textContent).not.toContain("打点");});
  it("keeps added pitcher metrics out of the NPB glossary",async()=>{await mount(<StatGlossary league="NPB" />, "/NPB/glossary");expect(el.textContent).not.toContain("WHIP");expect(el.textContent).not.toContain("BB/9");});
});
