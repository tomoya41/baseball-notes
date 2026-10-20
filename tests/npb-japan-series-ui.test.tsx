// @vitest-environment jsdom
import {act}from"react";import{createRoot}from"react-dom/client";import{MemoryRouter,Routes,Route}from"react-router-dom";import{afterEach,expect,it,vi}from"vitest";
import{NpbJapanSeriesScreen}from"../src/ui/npb-japan-series";import{NpbDiscovery}from"../src/ui/discovery";import{readNpbJapanSeries}from"../src/application/npb-japan-series-reader";import{readNpbCs}from"../src/application/npb-cs-reader";import{readNpbSeries}from"../src/application/npb-series-reader";import{japanFixture}from"./fixtures/npb-japan-series";import{buildWikipediaJapanSeries}from"../src/infrastructure/providers/wikipedia-npb-japan-series";import{portableRoute}from"../src/domain/product-sharing";import{canonicalDeepLink,parentNativeRoute}from"../src/domain/native-navigation";import type{Services}from"../src/app/services";
import {seriesFixture} from "./fixtures/npb-series";
vi.mock("../src/application/npb-japan-series-reader",()=>({readNpbJapanSeries:vi.fn()}));vi.mock("../src/application/npb-cs-reader",()=>({readNpbCs:vi.fn()}));vi.mock("../src/application/npb-series-reader",()=>({readNpbSeries:vi.fn()}));
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals();});
async function mount(path="/NPB/postseason?stage=japan_series",failed=false,update?:(data:ReturnType<typeof buildWikipediaJapanSeries>)=>void,csFails=false){
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);const f=japanFixture(),data=buildWikipediaJapanSeries(f.archive,f.cs,"b".repeat(64),f.admission);
  update?.(data);vi.mocked(readNpbJapanSeries).mockImplementation(async()=>{if(failed)throw Error("offline");return data;});
  vi.mocked(readNpbSeries).mockImplementation(async()=>{if(csFails)throw Error("CS offline");return f.cs;});vi.mocked(readNpbCs).mockImplementation(async()=>{if(csFails)throw Error("CS offline");return seriesFixture().cs;});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);const regular={directory:{findLatestNpb:vi.fn()},gameSurface:{manifest:vi.fn(),date:vi.fn()}};
  await act(async()=>root.render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/NPB/postseason" element={<NpbJapanSeriesScreen/>}/><Route path="/NPB/postseason/series/:seriesId" element={<NpbJapanSeriesScreen/>}/><Route path="/NPB/games/:gameId" element={<NpbJapanSeriesScreen gameDetail/>}/><Route path="/NPB/search" element={<NpbDiscovery services={regular as unknown as Services}/>}/></Routes></MemoryRouter>));
  return {host,data,regular,close:async()=>{await act(async()=>root.unmount());host.remove();}};
}
it("shows scheduled null scores, conditional dates, unavailable statistics and both attributed source revisions",async()=>{
  const f=await mount();try{expect(f.host.querySelectorAll(".scoreboard-row")).toHaveLength(7);expect(f.host.textContent).toContain("4勝先取");expect(f.host.textContent).toContain("取得時点で開幕前");expect(f.host.textContent).not.toContain("0勝");expect(f.host.querySelectorAll('a[href*="oldid="]')).toHaveLength(2);expect(f.host.textContent).toContain("第5戦以降は開催条件付き");
    await act(async()=>f.host.querySelector<HTMLAnchorElement>(".scoreboard-row")!.dispatchEvent(new MouseEvent("click",{bubbles:true,button:0,cancelable:true})));
    expect(f.host.textContent).toContain("第1戦 · ソフトバンク対DeNA");expect(f.host.textContent).toContain("結果・打撃・投球成績はまだ収録していません");expect(f.host.querySelectorAll("h1")).toHaveLength(1);expect(f.host.querySelectorAll("table")).toHaveLength(0);expect(f.host.textContent).toContain("横浜スタジアム");
  }finally{await f.close();}
});
it.each(["?season=2025","?competition=regular","?stage=npb_cs_final"])("rejects wrong scope without a fetch: %s",async q=>{const f=await mount("/NPB/postseason"+q);try{expect(readNpbJapanSeries).not.toHaveBeenCalled();expect(f.host.textContent).toContain("未対応");}finally{await f.close();}});
it("retries errors, retains CS fallback, and treats unknown Games as uncollected",async()=>{
  const f=await mount(undefined,true);try{expect(f.host.textContent).toContain("再試行");vi.mocked(readNpbJapanSeries).mockResolvedValue(f.data);await act(async()=>f.host.querySelector("button")!.click());expect(f.host.querySelectorAll(".scoreboard-row")).toHaveLength(7);}finally{await f.close();}
  const unknown=await mount("/NPB/games/npb:game:aaaaaaaaaaaaaaaaaaaa?competition=postseason&stage=japan_series");try{expect(unknown.host.textContent).toContain("この試合は未収録");}finally{await unknown.close();}
});
it.each(["series","game"])("discovers Japan Series %s independently of Current/CS repositories",async kind=>{
  const f=await mount(`/NPB/search?kind=${kind}&season=2026&competition=postseason&stage=japan_series${kind==="game"?"&date=2026-10-24":""}`);try{expect(f.host.querySelectorAll("a.player-row")).toHaveLength(1);expect(readNpbJapanSeries).toHaveBeenCalledTimes(1);expect(readNpbSeries).not.toHaveBeenCalled();expect(readNpbCs).not.toHaveBeenCalled();expect(f.regular.gameSurface.manifest).not.toHaveBeenCalled();expect(f.regular.directory.findLatestNpb).not.toHaveBeenCalled();if(kind==="game")expect(f.host.querySelector("a.player-row")!.getAttribute("href")).toContain("stage=japan_series");else expect(f.host.textContent).toContain("勝敗未収録");}finally{await f.close();}
});
it("preserves native/share scope and returns a cold Game to Japan Series rather than Regular or CS",()=>{
  const game="/NPB/games/npb%3Agame%3A9f6c547e7852f6c5a928",q="season=2026&competition=postseason&stage=japan_series";
  expect(portableRoute(game,q)).toBe(game+"?competition=postseason&stage=japan_series&season=2026");expect(canonicalDeepLink("baseballnotes:/"+game+"?"+q)).toContain("stage=japan_series");expect(parentNativeRoute(game+"?"+q)).toBe("/NPB/postseason?season=2026&stage=japan_series");expect(portableRoute("/NPB/cs","stage=japan_series")).toBeNull();
  expect(canonicalDeepLink("baseballnotes:/"+game)).toBe(game+"?competition=postseason&stage=japan_series&season=2026");expect(parentNativeRoute(game)).toBe("/NPB/postseason?season=2026&stage=japan_series");
});
it.each([["series",5],["game",19]] as const)("combines admitted CS and Japan Series in %s discovery without leaking into Regular",async(kind,count)=>{
  const f=await mount(`/NPB/search?kind=${kind}&season=2026&competition=postseason`);try{expect(f.host.querySelectorAll("a.player-row")).toHaveLength(count);expect(f.regular.gameSurface.date).not.toHaveBeenCalled();expect(f.host.textContent).toContain("未収録");}finally{await f.close();}
});
it("does not infer pre-opening or no-games from missing results after the scheduled opening, and uses JST observation dates",async()=>{
  const f=await mount(undefined,false,d=>{d.observedAt="2026-10-24T16:00:00Z";});try{expect(f.host.textContent).toContain("記事取得 2026-10-25時点");expect(f.host.textContent).not.toContain("取得時点で開幕前");expect(f.host.textContent).toContain("シリーズ勝敗は確認できません");}finally{await f.close();}
});
it.each(["series","game"])("keeps available Japan Series %s rows when the independent CS source fails",async kind=>{
  const f=await mount(`/NPB/search?kind=${kind}&competition=postseason`,false,undefined,true);try{expect(f.host.querySelectorAll("a.player-row")).toHaveLength(kind==="series"?1:7);expect(f.host.textContent).toContain("CSの追加情報を取得できません");expect(f.host.textContent).not.toContain("保存済みの大会記録を取得できません");expect(f.regular.gameSurface.manifest).not.toHaveBeenCalled();}finally{await f.close();}
});
it("keeps CS rows usable when Japan Series fails, with an explicit partial warning",async()=>{
  const f=await mount("/NPB/search?kind=series&competition=postseason",true);try{expect(f.host.querySelectorAll("a.player-row")).toHaveLength(4);expect(f.host.textContent).toContain("日本シリーズの追加情報を取得できません");}finally{await f.close();}
});
