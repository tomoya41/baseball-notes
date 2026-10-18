// @vitest-environment jsdom
import {act} from "react";
import {createRoot} from "react-dom/client";
import {MemoryRouter,useLocation,useNavigate} from "react-router-dom";
import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {NpbHistoricalCohort} from "../src/ui/npb-historical-cohort";
import {NpbHistoricalHistory} from "../src/ui/npb-historical";
import {readNpbHistoricalManifest,readNpbHistoricalSeason} from "../src/application/npb-historical-reader";
import {cohortFixture,cohortId} from "./fixtures/npb-cohort";
import {PersonalLibrary} from "../src/application/personal-library";
import {PersonalLibraryProvider} from "../src/ui/library-provider";
vi.mock("../src/application/npb-historical-reader",()=>({readNpbHistoricalManifest:vi.fn(),readNpbHistoricalSeason:vi.fn()}));
const fixture=cohortFixture();
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.mocked(readNpbHistoricalManifest).mockResolvedValue(fixture.manifest);vi.mocked(readNpbHistoricalSeason).mockResolvedValue(fixture.data);});
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
function State(){const l=useLocation(),go=useNavigate();return <><output>{l.search}</output><button onClick={()=>go(-1)}>テストの戻る</button></>;}
async function mount(search:string,history=false,large=false){
 const f=large?cohortFixture(40):fixture,repository={catalog:vi.fn().mockResolvedValue(f.catalog)};
 vi.mocked(readNpbHistoricalSeason).mockResolvedValue(f.data);
 const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
 await act(async()=>root.render(<MemoryRouter initialEntries={[`/NPB/history?season=2025&${search}`]}><State/>{history?<NpbHistoricalHistory current={<p>2026 Current fixture</p>} cohortRepository={repository}/>:<NpbHistoricalCohort manifest={f.manifest} season={2025} repository={repository}/>}</MemoryRouter>));
 return {host,repository,close:async()=>{await act(async()=>root.unmount());host.remove();}};
}
it("compares 2–4 canonical peers, carries sources/sample and restores filters on Back without refetch",async()=>{
 const {host,repository,close}=await mount(`cohort=birthYear&peer=${cohortId(0)}&recentPlayers=${cohortId(0)},${cohortId(1)}`);
 try{
  expect(host.textContent).toContain("1999年生まれ");expect(host.querySelector('[aria-label="同期の成績比較"]')).not.toBeNull();
  expect(host.textContent).toContain("114");expect(host.querySelector('a[href*="oldid=100"]')).not.toBeNull();expect(host.querySelector('a[href="https://example.com/identity/0"]')).not.toBeNull();
  const change=host.querySelector("select")!;await act(async()=>{change.value="draftYear";change.dispatchEvent(new Event("change",{bubbles:true}));});
  expect(host.textContent).toContain("2017年指名");expect(host.querySelector("output")?.textContent).not.toContain("recentPlayers");
  await act(async()=>host.querySelector("button")!.click());expect(host.querySelector("output")?.textContent).toContain("cohort=birthYear");expect(host.querySelector('[aria-label="同期の成績比較"]')).not.toBeNull();
  expect(repository.catalog).toHaveBeenCalledTimes(1);expect(readNpbHistoricalSeason).toHaveBeenCalledTimes(1);
 }finally{await close();}
});
it("shows an explicit Japanese grade range and birthday, preserving calendar-year legacy URLs",async()=>{
 const {host,close}=await mount(`cohort=schoolYear&peer=${cohortId(0)}&recentPlayers=${cohortId(0)},${cohortId(1)}`);
 try{
  expect(host.textContent).toContain("1999年4月2日〜2000年4月1日生まれ");expect(host.textContent).toContain("2000-01-01生まれ");
  expect(host.querySelector('a[href="https://www.mext.go.jp/a_menu/shotou/shugaku/detail/1422233.htm"]')).not.toBeNull();
  const conditions=host.querySelector("select")!;expect(conditions.value).toBe("schoolYear");
  await act(async()=>{conditions.value="birthYear";conditions.dispatchEvent(new Event("change",{bubbles:true}));});
  expect(host.textContent).toContain("1999年生まれ");expect(host.textContent).not.toContain("2000-01-01生まれ");
 }finally{await close();}
});
it("keeps missing cohort fields unknown and fails metadata reads without silently showing all players",async()=>{
 const {host,close}=await mount(`cohort=birthYear&peer=${cohortId(2)}`);try{expect(host.textContent).toContain("同期条件は未確認");expect(host.querySelectorAll("article")).toHaveLength(0);}finally{await close();}
 const bad=await mount(`cohort=draftYear&peer=${cohortId(4)}`);try{expect(bad.host.textContent).toContain("同期条件は未確認");}finally{await bad.close();}
 vi.mocked(readNpbHistoricalSeason).mockRejectedValueOnce(Error("offline"));
 // mount supplies default data; explicitly reject the independent catalog instead below.
 const repository={catalog:vi.fn().mockRejectedValue(Error("offline"))},div=document.createElement("div"),root=createRoot(div);
 try{await act(async()=>root.render(<MemoryRouter initialEntries={[`?cohort=birthYear&peer=${cohortId(0)}`]}><NpbHistoricalCohort manifest={fixture.manifest} season={2025} repository={repository}/></MemoryRouter>));expect(div.textContent).toContain("取得できません");expect(div.querySelectorAll("article")).toHaveLength(0);}finally{await act(async()=>root.unmount());}
});
it("rejects other competition/role scopes before fetching and renders at most 30 rows",async()=>{
 const invalid=await mount(`cohort=birthYear&peer=${cohortId(0)}&competition=preseason`);try{expect(invalid.host.textContent).toContain("未対応");expect(invalid.repository.catalog).not.toHaveBeenCalled();expect(readNpbHistoricalSeason).not.toHaveBeenCalled();}finally{await invalid.close();}
 const {host,close}=await mount(`cohort=birthYear&peer=${cohortId(0)}`,false,true);try{expect(host.querySelectorAll("article")).toHaveLength(30);expect(host.querySelector('[aria-label="同期のページ"]')).not.toBeNull();}finally{await close();}
});
it("does not fetch cohort metadata or past facts for Current history",async()=>{
 const {host,repository,close}=await mount("cohort=birthYear",true);try{
  const year=host.querySelector("select")!;await act(async()=>{year.value="2026";year.dispatchEvent(new Event("change",{bubbles:true}));});
  expect(host.textContent).toContain("過去年を選んでください");expect(host.textContent).not.toContain("2026 Current fixture");
  const before=repository.catalog.mock.calls.length;expect(before).toBe(1);
  expect(vi.mocked(readNpbHistoricalSeason).mock.calls.every(([year])=>year===2025)).toBe(true);
 }finally{await close();}
});
it("offers explicit cohort saving while automatic Activity omits the reference and selection",async()=>{
 const storage=new Map<string,string>(),store=new PersonalLibrary({get:async k=>storage.get(k)??null,set:async(k,v)=>{storage.set(k,v);}});
 const host=document.createElement("div"),root=createRoot(host),params=`season=2025&role=batting&cohort=draftYear&peer=${cohortId(0)}&recentPlayers=${cohortId(0)},${cohortId(1)}`;
 try{
  await act(async()=>root.render(<MemoryRouter initialEntries={["/NPB/history?"+params]}><PersonalLibraryProvider store={store}><NpbHistoricalCohort manifest={fixture.manifest} season={2025} repository={{catalog:async()=>fixture.catalog}}/></PersonalLibraryProvider></MemoryRouter>));
  expect((await store.read()).activity.every(a=>!a.conditions.includes("cohort")&&!a.conditions.includes("peer"))).toBe(true);
  await act(async()=>Array.from(host.querySelectorAll("button")).find(b=>b.textContent==="この条件を保存")!.click());
  const input=host.querySelector('input[placeholder="例：阪神・直近14日"]')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,"ドラフト同期の比較");input.dispatchEvent(new Event("input",{bubbles:true}));});
  await act(async()=>host.querySelector("form")!.dispatchEvent(new Event("submit",{bubbles:true,cancelable:true})));
  const saved=new URLSearchParams((await store.read()).views[0]!.conditions);
  expect(saved.get("peer")).toBe(cohortId(0));expect(saved.get("cohort")).toBe("draftYear");expect(saved.get("recentPlayers")).toContain(cohortId(1));
  expect(host.textContent).toContain("保存しました");
 }finally{await act(async()=>root.unmount());}
});
