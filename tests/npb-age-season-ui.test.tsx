// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { NpbAgeSeason } from "../src/ui/npb-age-season";
import { readNpbHistoricalSeason } from "../src/application/npb-historical-reader";
import { cohortFixture, cohortId } from "./fixtures/npb-cohort";
vi.mock("../src/application/npb-historical-reader", () => ({ readNpbHistoricalSeason: vi.fn() }));
beforeEach(() => { vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); });
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });
function Navigation() { const location=useLocation(),go=useNavigate();return <><output>{location.search}</output><button onClick={()=>go(-1)}>テストの戻る</button></>; }
async function mount(extra="", fail2024=false, count=7) {
  const f=cohortFixture(count);f.catalog.players[1]!.profile.birthDate="1998-01-01";
  f.manifest.seasons.push({...f.manifest.seasons[0]!,season:2024});f.manifest.players.forEach(p=>p.seasons=[2024,2025]);
  const earlier={...f.data,rows:f.data.rows.map(r=>({...r,season:2024}))};
  vi.mocked(readNpbHistoricalSeason).mockImplementation(async year=>{if(year===2024&&fail2024)throw Error("offline");return year===2024?earlier:f.data;});
  const repository={catalog:vi.fn().mockResolvedValue(f.catalog)},host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  const params=new URLSearchParams(`cohort=ageSeason&age=26&recentPlayers=${cohortId(0)},${cohortId(1)}`);new URLSearchParams(extra).forEach((value,key)=>params.set(key,value));
  await act(async()=>root.render(<MemoryRouter initialEntries={[`/NPB/history?${params}`]}><Navigation/><NpbAgeSeason manifest={f.manifest} repository={repository}/></MemoryRouter>));
  return {...f,host,repository,close:async()=>{await act(async()=>root.unmount());host.remove();}};
}
it("compares different years at the same year-end age, recomputes split-team rates and retains sample/credits", async()=>{
  const f=await mount();try {
    expect(readNpbHistoricalSeason).toHaveBeenCalledTimes(2);expect(f.repository.catalog).toHaveBeenCalledTimes(1);
    expect(f.host.textContent).toContain("2025年 · 年末26歳");expect(f.host.textContent).toContain("2024年 · 年末26歳");
    expect(f.host.textContent).toContain("114");expect(f.host.textContent).toContain("102");
    expect(f.host.querySelector('[aria-label="同年齢の比較結果"]')).not.toBeNull();
    expect(f.host.querySelector('a[href*="oldid=100"]')).not.toBeNull();expect(f.host.querySelector('a[href="https://example.com/identity/0"]')).not.toBeNull();
    const metric=f.host.querySelector('[aria-label="同年齢の比較結果"] select') as HTMLSelectElement;
    await act(async()=>{metric.value="AVG";metric.dispatchEvent(new Event("change",{bubbles:true}));});
    expect(f.host.textContent).toContain("0.227");expect(readNpbHistoricalSeason).toHaveBeenCalledTimes(2);
    await act(async()=>f.host.querySelector('button[aria-label$="年齢比較から外す"]')!.dispatchEvent(new MouseEvent("click",{bubbles:true})));
    await act(async()=>Array.from(f.host.querySelectorAll("button")).find(b=>b.textContent==="テストの戻る")!.click());
    expect(f.host.querySelector('[aria-label="同年齢の比較結果"]')).not.toBeNull();expect(readNpbHistoricalSeason).toHaveBeenCalledTimes(2);
  }finally{await f.close();}
});
it("keeps successful peers visible when one year fails and retries only the failed year",async()=>{
  const f=await mount("",true);try{
    expect(f.host.textContent).toContain("2025年 · 年末26歳");expect(f.host.textContent).toContain("年度成績を取得できません");
    expect(f.host.textContent).toContain("114");
    vi.mocked(readNpbHistoricalSeason).mockResolvedValueOnce({...f.data,rows:f.data.rows.map(r=>({...r,season:2024}))});
    await act(async()=>Array.from(f.host.querySelectorAll("button")).find(b=>b.textContent==="取得できなかった年度を再試行")!.click());
    expect(vi.mocked(readNpbHistoricalSeason).mock.calls.map(([y])=>y)).toEqual([2024,2025,2024]);
    expect(f.host.querySelector('[aria-label="同年齢の比較結果"]')).not.toBeNull();
  }finally{await f.close();}
});
it("does not fetch unadmitted years or unknown birthdays and rejects other competitions before Catalog fetch",async()=>{
  const f=await mount("&age=99");try{expect(readNpbHistoricalSeason).not.toHaveBeenCalled();expect(f.host.textContent).toContain("未収録");}finally{await f.close();}
  vi.clearAllMocks();const bad=await mount("&competition=postseason");try{expect(bad.repository.catalog).not.toHaveBeenCalled();expect(readNpbHistoricalSeason).not.toHaveBeenCalled();expect(bad.host.textContent).toContain("条件を初期化");}finally{await bad.close();}
});
it("shares one annual read and preserves unknown DOB, missing role and zero-outs metrics without invented rates",async()=>{
  const f=await mount(`&role=pitching&recentPlayers=${cohortId(0)},${cohortId(2)},${cohortId(6)}`);try{
    expect(readNpbHistoricalSeason).toHaveBeenCalledTimes(1);expect(f.host.textContent).toContain("生年月日が未確認");expect(f.host.textContent).toContain("この役割の成績は未収録");
    const values=Array.from(f.host.querySelectorAll("dd")).map(e=>e.textContent);expect(values).toContain("0.0");expect(values).toContain("—");expect(f.host.textContent).not.toMatch(/NaN|Infinity/);
  }finally{await f.close();}
});
it("bounds discovery to 30 candidates and removes the picker at four selections",async()=>{
  const f=await mount("",false,40);try{expect(f.host.querySelectorAll("button.player-row")).toHaveLength(30);}finally{await f.close();}
  const full=await mount(`&recentPlayers=${[0,1,3,5].map(cohortId).join(",")}`);try{expect(full.host.querySelector('input[type="search"]')).toBeNull();expect(full.host.textContent).toContain("比較 4/4人");}finally{await full.close();}
});
it("loads collected-year totals only after an explicit action, shares annual reads and retains nulls and exact scope",async()=>{
 const f=await mount("ageMode=collected");try{
   expect(readNpbHistoricalSeason).not.toHaveBeenCalled();expect(f.host.textContent).toContain("約2KB");
   await act(async()=>Array.from(f.host.querySelectorAll("button")).find(b=>b.textContent==="収録分の合計を読み込む")!.click());
   expect(readNpbHistoricalSeason).toHaveBeenCalledTimes(2);expect(f.host.textContent).toContain("合計対象：2024・2025年");
   expect(f.host.textContent).toContain("228");expect(f.host.textContent).toContain("記録への歩み");expect(f.host.textContent).toContain("完全なキャリアではありません");
 }finally{await f.close();}
});
it("does not publish a silently incomplete sum when any selected annual request fails",async()=>{
 const f=await mount("ageMode=collected",true);try{
   await act(async()=>Array.from(f.host.querySelectorAll("button")).find(b=>b.textContent==="収録分の合計を読み込む")!.click());
   expect(f.host.textContent).toContain("合計は表示しません");expect(f.host.textContent).not.toContain("記録への歩み");
   expect(f.host.querySelector('[aria-label="同年齢の比較結果"]')).toBeNull();
 }finally{await f.close();}
});
