// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildNpbCatalog } from "../src/application/npb-product-payload";
import { npbTeams } from "../src/data/npb-nf3";
import { lifecycleCoverage, lifecyclePlayers, lifecycleQuery, playerSchools, validateLifecycleStats } from "../src/domain/npb-lifecycle";
import type { ExplorerRow } from "../src/domain/data-explorer";
import { LifecycleWorkspace, PlayerLifecycle } from "../src/ui/npb-lifecycle";
import { NpbRoutes } from "../src/ui/npb-routes";
import { services } from "../src/app/services";

const readers = vi.hoisted(() => ({ season: vi.fn(), recent: vi.fn() }));
vi.mock("../src/application/explorer-readers", () => ({ readNpbExplorerSeason: readers.season, readNpbRecentExplorer: readers.recent }));
const team = "npb:team:tigers", date = "2026-10-07";
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12,"0")}`;
const catalog = buildNpbCatalog({ schemaVersion:2, league:"NPB", effectiveDate:date, generatedAt:"2026-10-08T00:00:00Z",
  teams:npbTeams.map(t=>({id:t.id,name:t.name,shortName:t.short})),
  players:Array.from({length:35},(_,i)=>({playerId:id(i),displayName:`選手${String(i).padStart(2,"0")}`,teamId:team,
    position:i===0?"P" as const:"OF" as const,playerType:null,birthDate:i===1?null:"2003-10-08",birthPlace:null,nationality:null,bats:null,throws:null,
    battingAvailable:i!==0,pitchingAvailable:i===0,recentAvailable:true})) },{observedAt:"2026-10-08T00:00:00Z",effectiveDate:date,players:[]});
catalog.players.forEach((p,i)=>Object.assign(p.profile,{draftYear:i===1?null:i===2?2020:2022,draftRound:i===1?null:"1位",
  draftType:i===1?null:"regular",draftTeamId:i===0?team:null,draftTeamName:i===2?"阪神タイガース":null,
  schools:i<2?["同名大学"]:[],amateurHistory:i===2?[{name:"同名大",category:"university",from:null,to:null}]:[],
  debutYear:2019,joinedYear:null,npbDebutYear:null}));
const rows: ExplorerRow[] = catalog.players.map((p,i)=>({playerId:p.playerId,name:p.displayName,teamId:team,
  batting:i===0?null:{PA:{value:i===1?null:50,status:i===1?"unavailable":"partial"},OPS:{value:.9,status:"partial"},HR:{value:0,status:"partial"}},
  pitching:i===0?{outsRecorded:{value:30,status:"complete"}}:null}));
const payload = {effectiveDate:date,coverage:{status:"partial"},players:rows.map(r=>({playerId:r.playerId,displayName:r.name,teamId:r.teamId ?? null,
  batting:r.batting?{metrics:r.batting}:null,pitching:r.pitching?{metrics:r.pitching}:null}))};
const query = (s="")=>lifecycleQuery(new URLSearchParams(s),catalog);
const ids = (s="", values:ExplorerRow[]=[])=>lifecyclePlayers(catalog,query(s),values).map(p=>p.playerId);

describe("verified saved player discovery semantics",()=>{
  it("does not interpret missing Draft as undrafted, and explicitly opts into unknown years",()=>{
    expect(ids()).not.toContain(id(1)); expect(ids("unknown=1")).toContain(id(1));
    expect(ids("unknown=1&round=unknown&type=unknown")).toEqual([id(1)]);
  });
  it("combines a Draft class/range, exact round, position, saved team and role",()=>{
    expect(ids(`year=2022&round=1位&position=P&team=${team}&role=pitching`)).toEqual([id(0)]);
    expect(ids("from=2020&to=2021")).toEqual([id(2)]);
  });
  it("only uses canonical matched Draft teams, not raw matching team names",()=>{
    expect(ids(`draftTeam=${team}`)).toEqual([id(0)]);
    expect(lifecycleCoverage(catalog).draftTeam).toBe(1);
  });
  it("computes birthday age at the specified saved reference date, without using device year",()=>{
    expect(ids("view=young&ageMax=22")).toHaveLength(34);
    expect(ids("view=young&ageMax=21")).toEqual([]);
    expect(ids("view=young&asOf=2025-10-07&ageMax=21")).toHaveLength(34);
    expect(ids("view=young")).not.toContain(id(1));
  });
  it("preserves school labels without canonical merging or graduation inference",()=>{
    expect(playerSchools(catalog.players[0]!)).toEqual(["同名大学"]);
    expect(ids("view=school&school=同名大")).toEqual([id(0),id(1),id(2)]);
  });
  it("enforces known metric samples including partial values; unknown is not zero",()=>{
    expect(ids("view=young&role=batting&minimum=50",rows)).toHaveLength(33);
    expect(ids("unknown=1&role=batting&minimum=51",rows)).toEqual([]);
    expect(ids("role=pitching&minimum=30",rows)).toEqual([id(0)]);
    expect(ids("role=pitching&minimum=31",rows)).toEqual([]);
  });
  it.each(["asOf=2026-02-30","asOf=2030-01-01","competition=postseason","season=2025","period=0","view=rookie","team=missing","round=never","from=2023&to=2020","ageMin=30&ageMax=20","ageMax=-1","minimum=10"])("rejects invalid or unsupported URL %s",s=>{
    expect(query(s).errors.length).toBeGreaterThan(0);expect(ids(s,rows)).toEqual([]);
  });
  it("rejects mixed generation, name, canonical identity and membership",()=>{
    expect(()=>validateLifecycleStats(catalog,payload)).not.toThrow();
    expect(()=>validateLifecycleStats(catalog,{...payload,effectiveDate:"2026-10-06"})).toThrow();
    for(const change of [{playerId:id(999)},{displayName:"別人"},{teamId:"npb:team:giants"}])
      expect(()=>validateLifecycleStats(catalog,{...payload,players:[{...payload.players[0]!,...change}]})).toThrow();
  });
  it("does not mutate the master or statistics while filtering",()=>{
    const before=structuredClone(catalog), beforeStats=structuredClone(rows);
    ids("role=batting&minimum=50&ageMax=25",rows);
    expect(catalog).toEqual(before);expect(rows).toEqual(beforeStats);
  });
});

let element:HTMLDivElement, root:Root;
function Location(){const v=useLocation(), navigate=useNavigate();return <><output data-testid="url">{v.pathname}{v.search}</output><button onClick={()=>navigate('/NPB/talent?role=batting&ageMin=30&ageMax=20')}>Invalid metadata test</button><button onClick={()=>navigate('/NPB/talent?role=batting&ageMin=20&ageMax=30')}>Correct metadata test</button><button onClick={()=>navigate('/NPB/talent?role=batting&period=7')}>Recent period test</button><button onClick={()=>navigate('/NPB/talent?role=batting')}>Season period test</button></>;}
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);readers.season.mockReset().mockResolvedValue(payload);readers.recent.mockReset().mockResolvedValue(payload);element=document.createElement("div");document.body.append(element);root=createRoot(element);});
afterEach(async()=>{await act(async()=>{root.unmount();});element.remove();vi.unstubAllGlobals();});
async function mount(path="/NPB/talent",lifecycle=false){await act(async()=>root.render(<MemoryRouter initialEntries={[path]}>{lifecycle?<PlayerLifecycle player={catalog.players[0]!}/>:<LifecycleWorkspace catalog={catalog}/>}<Location/></MemoryRouter>));}
describe("Draft discovery integration and recovery",()=>{
  it("direct loads class filters, bounds rendering to 30 and preserves partial coverage",async()=>{
    await mount("/NPB/talent?year=2022&role=batting");
    expect(element.querySelector("h1")?.textContent).toBe("2022年 ドラフト同期");
    expect(element.querySelectorAll(".lifecycle-result")).toHaveLength(30);
    expect(element.textContent).toContain("一部未確認");
    expect(readers.season).toHaveBeenCalledTimes(1);expect(readers.recent).not.toHaveBeenCalled();
    await act(async()=>{[...element.querySelectorAll("button")].find(b=>b.textContent==="次へ")!.click();});
    expect(element.querySelectorAll(".lifecycle-result")).toHaveLength(2);expect(readers.season).toHaveBeenCalledTimes(1);
  });
  it("requests one bulk Recent projection with catalog identity, no individual profile reads",async()=>{
    await mount("/NPB/talent?view=young&role=pitching&period=14");
    expect(readers.recent).toHaveBeenCalledTimes(1);expect(readers.recent.mock.calls[0]?.[0]).toBe(14);
    expect(readers.recent.mock.calls[0]?.[1].players).toHaveLength(35);expect(readers.season).not.toHaveBeenCalled();
  });
  it.each(["HTTP","generation"])("preserves profiles and announces %s statistic failures without fake zero",async failure=>{
    readers.season.mockImplementation(()=>failure==="HTTP"?Promise.reject(Error("network")):Promise.resolve({...payload,effectiveDate:"2026-10-06"}));
    await mount("/NPB/talent?role=batting");
    expect(element.textContent).toContain("成績を読み込めません");expect(element.textContent).toContain("選手02");
    expect([...element.querySelectorAll(".explorer-metrics dd")].every(v=>v.textContent==="—")).toBe(true);
  });
  it.each([['unknown','収録範囲未確認'],['unavailable','収録範囲を確認できません']])("distinguishes %s coverage from partial",async(status,label)=>{
    readers.season.mockResolvedValue({...payload,coverage:{status}});await mount('/NPB/talent?role=batting');
    expect(element.textContent).toContain(label);expect(element.textContent).not.toContain('一部未確認');
  });
  it("does not report an empty sample search until loading completes",async()=>{
    let resolve!:(value:typeof payload)=>void;readers.season.mockReturnValue(new Promise(done=>resolve=done));
    await mount("/NPB/talent?role=batting&minimum=100");
    expect(element.textContent).not.toContain("条件に合う選手がいません");
    await act(async()=>resolve(payload));expect(element.textContent).toContain("条件に合う選手がいません");
  });
  it("selects at most four same-role players and hands period and identities to existing Compare",async()=>{
    await mount("/NPB/talent?year=2022&role=batting&period=14");
    const checks=[...element.querySelectorAll<HTMLInputElement>('input[aria-label$="同期比較に選択"]')];
    for(const c of checks.slice(0,4))await act(async()=>c.click());
    expect(checks[4]?.disabled).toBe(true);
    const link=[...element.querySelectorAll<HTMLAnchorElement>("a")].find(a=>a.textContent==="同期を比較 →")!;
    const url=new URL(link.href);expect(url.searchParams.get("players")?.split(",")).toHaveLength(4);
    expect(url.searchParams.get("condition")).toBe("14d");expect(url.searchParams.get("role")).toBe("batting");
  });
  it("invalid direct URLs remain explicit and do not fetch incompatible data",async()=>{
    await mount("/NPB/talent?competition=postseason");
    expect(element.querySelector('[role="alert"]')).not.toBeNull();expect(readers.season).not.toHaveBeenCalled();expect(element.querySelectorAll(".lifecycle-result")).toHaveLength(0);
  });
  it("reuses successful statistics after temporarily invalid metadata instead of losing them on a second fetch",async()=>{
    await mount('/NPB/talent?role=batting');readers.season.mockRejectedValue(Error('would fail'));
    const button=(text:string)=>[...element.querySelectorAll('button')].find(b=>b.textContent===text)!;
    await act(async()=>button('Invalid metadata test').click());
    expect(element.textContent).toContain('条件の下限は上限以下');
    await act(async()=>button('Correct metadata test').click());
    expect(readers.season).toHaveBeenCalledTimes(1);
    expect(element.textContent).not.toContain('成績を読み込めません');
    expect(element.querySelectorAll('.lifecycle-result')).toHaveLength(30);
    expect(element.querySelector('.explorer-metrics dd')?.textContent).toBe('50 一部');
  });
  it("an explicit retry still reads again and recovers after a statistics failure",async()=>{
    readers.season.mockRejectedValueOnce(Error('network')).mockResolvedValue(payload);
    await mount('/NPB/talent?role=batting');
    await act(async()=>{[...element.querySelectorAll('button')].find(b=>b.textContent==='成績を再読み込み')!.click();});
    expect(readers.season).toHaveBeenCalledTimes(2);expect(element.textContent).not.toContain('成績を読み込めません');
    expect(element.querySelectorAll('.lifecycle-result')).toHaveLength(30);
  });
  it("restores the last successful period after another period failed, without refetch or perpetual loading",async()=>{
    await mount('/NPB/talent?role=batting');readers.recent.mockRejectedValue(Error('network'));
    await act(async()=>{[...element.querySelectorAll('button')].find(b=>b.textContent==='Recent period test')!.click();});
    expect(element.textContent).toContain('成績を読み込めません');
    await act(async()=>{[...element.querySelectorAll('button')].find(b=>b.textContent==='Season period test')!.click();});
    expect(readers.season).toHaveBeenCalledTimes(1);expect(readers.recent).toHaveBeenCalledTimes(1);
    expect(element.textContent).not.toContain('成績を読み込めません');
    expect(element.querySelector('.explorer-metrics dd')?.textContent).toBe('50 一部');
  });
  it("retrying a failed Recent period does not invalidate successful Season statistics",async()=>{
    await mount('/NPB/talent?role=batting');
    readers.season.mockRejectedValue(Error('ongoing outage'));
    readers.recent.mockRejectedValue(Error('network'));
    const button=(text:string)=>[...element.querySelectorAll('button')].find(b=>b.textContent===text)!;
    await act(async()=>button('Recent period test').click());
    await act(async()=>button('成績を再読み込み').click());
    expect(readers.recent).toHaveBeenCalledTimes(2);
    await act(async()=>button('Season period test').click());
    expect(readers.season).toHaveBeenCalledTimes(1);
    expect(element.textContent).not.toContain('成績を読み込めません');
    expect(element.querySelector('.explorer-metrics dd')?.textContent).toBe('50 一部');
  });
  it("Lifecycle omits unsupported joined/NPB debut and keeps school, draft class and saved Season links",async()=>{
    await mount("/NPB/players/example/more",true);
    expect(element.textContent).toContain("2022年 ドラフト");expect(element.textContent).toContain("2026 シーズン");
    expect(element.textContent).not.toContain("2019");expect(element.querySelector(".lifecycle-timeline")?.textContent).not.toContain("入団年");expect(element.querySelector("details")?.textContent).toContain("推定しません");
    expect(element.querySelector('a[href="/NPB/talent?year=2022"]')).not.toBeNull();
    expect(element.textContent).toContain("完全なCareer");
  });
  it("preserves the legacy Prospects tab as unavailable, without fetching a Draft database",async()=>{
    await act(async()=>root.render(<MemoryRouter initialEntries={["/NPB/talent?tab=1"]}><Routes><Route path="/NPB/*" element={<NpbRoutes services={services} favorites={[]} toggle={()=>{}} saving={false}/>}/></Routes></MemoryRouter>));
    expect(element.textContent).toContain("COMING SOON");expect(element.querySelector('a[aria-current="page"]')?.textContent).toBe("プロスペクト");
    expect(readers.season).not.toHaveBeenCalled();expect(readers.recent).not.toHaveBeenCalled();
  });
});
