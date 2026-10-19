// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { NpbPostseasonScreen } from "../src/ui/npb-postseason";
import { readNpbCs } from "../src/application/npb-cs-reader";
import { readNpbSeries } from "../src/application/npb-series-reader";
import { buildWikipediaNpbSeries } from "../src/infrastructure/providers/wikipedia-npb-series";
import { seriesFixture } from "./fixtures/npb-series";
import { portableRoute } from "../src/domain/product-sharing";
import { canonicalDeepLink, parentNativeRoute } from "../src/domain/native-navigation";
vi.mock("../src/application/npb-cs-reader", () => ({ readNpbCs: vi.fn() }));
vi.mock("../src/application/npb-series-reader", () => ({ readNpbSeries: vi.fn() }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
async function mount(path = "/NPB/postseason?season=2026", failure = false) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
  const {archive,cs}=seriesFixture(), data=buildWikipediaNpbSeries(archive,cs,"b".repeat(64));
  vi.mocked(readNpbCs).mockResolvedValue(cs); vi.mocked(readNpbSeries).mockImplementation(async()=>{if(failure)throw Error("offline");return data;});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  await act(async()=>root.render(<MemoryRouter initialEntries={[path]}><Routes><Route path="/NPB/postseason" element={<NpbPostseasonScreen/>}/><Route path="/NPB/postseason/series/:seriesId" element={<NpbPostseasonScreen/>}/></Routes></MemoryRouter>));
  return {host,data,close:async()=>{await act(async()=>root.unmount());host.remove();}};
}
it("shows both leagues' advancement and separates Japan Series uncollected from CS outcomes",async()=>{
  const f=await mount();try{
    expect(f.host.querySelectorAll(".series-entry")).toHaveLength(4);
    expect(f.host.textContent).toContain("アドバンテージ2勝");expect(f.host.textContent).toContain("アドバンテージ1勝");
    expect(f.host.textContent).toContain("日本シリーズの試合・選手成績は未収録");expect(f.host.textContent).toContain("一部収録");
    expect(f.host.querySelectorAll('a[href*="oldid="]')).toHaveLength(2);
  }finally{await f.close();}
});
it("deep-linked series preserves exact score/Game/stage/player entry and independent advantage explanation",async()=>{
  const {archive,cs}=seriesFixture(),data=buildWikipediaNpbSeries(archive,cs,"b".repeat(64)),id=data.series[1]!.id;
  const f=await mount(`/NPB/postseason/series/${encodeURIComponent(id)}?season=2026`);try{
    expect(f.host.querySelectorAll(".scoreboard-row")).toHaveLength(3);
    expect(f.host.textContent).toContain("ソフトバンク · 日本シリーズ進出");
    expect(f.host.textContent).toContain("保存済みRegular成績から順位を推測していません");
    const href = f.host.querySelector(".scoreboard-row")!.getAttribute("href")!;
    expect(href).toContain("competition=postseason"); expect(href).toContain("stage=npb_cs_final");
    expect(f.host.querySelectorAll('a[href*="competition=regular"]')).toHaveLength(0);
  }finally{await f.close();}
});
it.each(["?season=2025","?competition=regular","?stage=japan_series"])("rejects unsupported conditions without any CS requests: %s",async query=>{
  const f=await mount("/NPB/postseason"+query);try{expect(readNpbCs).not.toHaveBeenCalled();expect(readNpbSeries).not.toHaveBeenCalled();expect(f.host.textContent).toContain("未対応");}finally{await f.close();}
});
it("retains retry/fallback and correct native Back/share semantics without permitting MLB IDs",async()=>{
  const f=await mount(undefined,true);try{expect(f.host.textContent).toContain("再試行");expect(f.host.querySelector('a[href="/NPB/cs?season=2026"]')).not.toBeNull();}finally{await f.close();}
  const id="npb:series:19106473-c7b5-5171-bf77-40b5d93190a0",path=`/NPB/postseason/series/${encodeURIComponent(id)}`;
  expect(portableRoute(path,"season=2026")).toBe(path+"?season=2026");
  expect(canonicalDeepLink("baseballnotes:/"+path+"?season=2026")).toBe(path+"?season=2026");
  expect(parentNativeRoute(path+"?season=2026")).toBe("/NPB/postseason?season=2026");
  expect(portableRoute(path,"season=2025")).toBeNull();expect(portableRoute(path.replace("npb%3Aseries","mlb%3Aseries"))).toBeNull();
});
