// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import { NpbHistoricalHistory } from "../src/ui/npb-historical";
import { npbHistoricalDatasetSchema, npbHistoricalManifestSchema, historicalBattingKeys } from "../src/domain/npb-historical";
import { readNpbHistoricalManifest, readNpbHistoricalSeason } from "../src/application/npb-historical-reader";
vi.mock("../src/application/npb-historical-reader",()=>({readNpbHistoricalManifest:vi.fn(),readNpbHistoricalSeason:vi.fn()}));
const id="00000000-0000-4000-8000-000000000001";
const dataset=npbHistoricalDatasetSchema.parse({schemaVersion:1,league:"NPB",temporalScope:"historical",competition:"regular",granularity:"season_aggregate",license:"CC-BY-SA-4.0",observedAt:"2026-10-02T00:00:00Z",inputSha256:"a".repeat(64),transformation:"Synthetic fixture only",coverage:"partial",players:[{playerId:id,name:"架空の長い選手名",wikidataId:"Q123",npbId:"12345",article:"架空テスト選手",revision:123,revisionAt:"2026-01-01T00:00:00Z",contentSha256:"b".repeat(64)}],rows:[{playerId:id,season:2025,teamId:"npb:team:tigers",role:"batting",metrics:Object.fromEntries(historicalBattingKeys.map(k=>[k,null]))}]});
const manifest=npbHistoricalManifestSchema.parse({schemaVersion:1,league:"NPB",competition:"regular",temporalScope:"historical",coverage:"partial",license:"CC-BY-SA-4.0",inputSha256:"a".repeat(64),observedAt:dataset.observedAt,seasons:[{season:2025,rows:1,players:1,sha256:"b".repeat(64),bytes:100}],players:[{playerId:id,name:"架空の長い選手名",seasons:[2025]}]});
function Location(){return <output>{useLocation().search}</output>;}
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.mocked(readNpbHistoricalManifest).mockResolvedValue(manifest);vi.mocked(readNpbHistoricalSeason).mockResolvedValue(dataset);});
afterEach(()=>{vi.unstubAllGlobals();vi.clearAllMocks();});
async function mount(search:string){const div=document.createElement("div");document.body.append(div);const root=createRoot(div);await act(async()=>{root.render(<MemoryRouter initialEntries={[`/NPB/history${search}`]}><Location/><NpbHistoricalHistory current={<p>2026 Current</p>}/></MemoryRouter>);});return{div,close:async()=>{await act(async()=>root.unmount());div.remove();}};}
describe("NPB Historical integrated UI",()=>{
  it("keeps team-season rows, nullable headline metrics and full attribution reachable in a compact directory",async()=>{
    vi.mocked(readNpbHistoricalSeason).mockResolvedValue({...dataset,rows:[dataset.rows[0]!,{...dataset.rows[0]!,teamId:"npb:team:giants"}]});
    const {div,close}=await mount("?season=2025");try{
      const article=div.querySelector('.historical-player-list article')!;
      expect(article.querySelectorAll('.historical-row-summary')).toHaveLength(2);
      expect(article.querySelectorAll('.historical-row-summary dd')).toHaveLength(6);
      expect([...article.querySelectorAll('.historical-row-summary dd')].every(d=>d.textContent==="—")).toBe(true);
      const detail=article.querySelector<HTMLDetailsElement>('.historical-player-details')!;
      expect(detail.open).toBe(false);
      await act(async()=>{detail.open=true;detail.dispatchEvent(new Event('toggle'));});
      expect(detail.textContent).toContain('年度推移・収録年合計');
      expect(detail.querySelector('a[href*="oldid=123"]')).not.toBeNull();
    }finally{await close();}
  });
  it("finds a retired player's admitted years from the index without fetching every season",async()=>{
    vi.mocked(readNpbHistoricalManifest).mockResolvedValue({...manifest,seasons:[...manifest.seasons,{...manifest.seasons[0]!,season:2015}],players:[{...manifest.players[0]!,identityScope:"historical_only",seasons:[2015]}]});
    vi.mocked(readNpbHistoricalSeason).mockResolvedValue({...dataset,players:[],rows:[]});
    const {div,close}=await mount("?season=2025&q=架空");try{
      expect(div.textContent).toContain("別の年度に収録されている選手");expect(div.querySelector('a[href*="season=2015"]')).not.toBeNull();expect(readNpbHistoricalSeason).toHaveBeenCalledTimes(1);
    }finally{await close();}
  });
  it("keeps a historical-only profile in History and preserves its per-revision attribution",async()=>{
    vi.mocked(readNpbHistoricalManifest).mockResolvedValue({...manifest,players:[{...manifest.players[0]!,identityScope:"historical_only"}]});
    vi.mocked(readNpbHistoricalSeason).mockResolvedValue({...dataset,players:[{...dataset.players[0]!,identityScope:"historical_only",sourceObservedAt:"2026-10-02T00:00:00Z"}]});
    const {div,close}=await mount(`?season=2025&player=${id}`);try{
      expect(div.querySelector('a[href*="/NPB/players/"]')).toBeNull();expect(div.textContent).toContain("現在の登録や所属を示しません");
      expect(div.querySelector('a[href*="oldid=123"]')).not.toBeNull();expect(div.textContent).toContain("原本取得 2026-10-02");
    }finally{await close();}
  });
  it("anchors default comparison years to the opened historical season rather than the latest years",async()=>{
    const years=[2015,2016,2017,2023,2024,2025];
    vi.mocked(readNpbHistoricalManifest).mockResolvedValue({...manifest,seasons:years.map(season=>({...manifest.seasons[0]!,season})),players:[{...manifest.players[0]!,seasons:years}]});
    vi.mocked(readNpbHistoricalSeason).mockImplementation(async season=>({...dataset,rows:[{...dataset.rows[0]!,season}]}));
    const {div,close}=await mount(`?season=2015&player=${id}`);try{
      expect(div.textContent).toContain("2015年の収録行合計");
      const selected=Array.from(div.querySelectorAll('fieldset input:checked')).map(n=>n.parentElement?.textContent?.trim());
      expect(selected).toEqual(["2015"]);
    }finally{await close();}
  });
  it("refreshes the manifest as well as annual data after a publication-generation failure",async()=>{
    const corrected={...manifest,seasons:[{...manifest.seasons[0]!,sha256:"c".repeat(64)}]};
    vi.mocked(readNpbHistoricalManifest).mockResolvedValueOnce(manifest).mockResolvedValueOnce(corrected);
    vi.mocked(readNpbHistoricalSeason).mockRejectedValueOnce(new Error("hash mismatch")).mockResolvedValueOnce(dataset);
    const {div,close}=await mount("?season=2025");try{
      expect(div.textContent).toContain("年度別成績を取得できません");
      await act(async()=>{Array.from(div.querySelectorAll("button")).find(b=>b.textContent==="再試行")!.click();});
      expect(readNpbHistoricalManifest).toHaveBeenCalledTimes(2);
      expect(readNpbHistoricalSeason).toHaveBeenCalledTimes(2);
      expect(vi.mocked(readNpbHistoricalSeason).mock.calls.at(-1)?.[1]).toEqual(corrected);
      expect(div.textContent).toContain("架空の長い選手名");expect(div.textContent).not.toContain("年度別成績を取得できません");
    }finally{await close();}
  });
  it("shows the admitted year and partial coverage; unknown metrics are not zero",async()=>{const {div,close}=await mount("?season=2025");try{
    expect(div.textContent).toContain("全選手の成績・ランキングではありません");expect(div.textContent).toContain("架空の長い選手名");expect(div.querySelector("dd")?.textContent).toBe("—");expect(div.querySelector('a[href*="oldid=123"]')).not.toBeNull();expect(div.querySelector('a[href*="/players/"]')?.textContent).toContain("2026年");
  }finally{await close();}});
  it("changes years through URL state and does not relabel Current as historical",async()=>{const {div,close}=await mount("?season=2026");try{
    expect(div.textContent).toContain("2026 Current");expect(readNpbHistoricalSeason).not.toHaveBeenCalled();
    await act(async()=>{const select=div.querySelector('select[aria-label="NPB履歴の年度"]') as HTMLSelectElement;select.value="2025";select.dispatchEvent(new Event("change",{bubbles:true}));});
    expect(div.querySelector("output")?.textContent).toContain("season=2025");expect(div.textContent).not.toContain("2026 Current");
  }finally{await close();}});
  it.each(["?season=bad","?season=2024","?season=2025&competition=postseason"])("rejects unsupported scope %s without reading wrong year",async query=>{const {div,close}=await mount(query);try{expect(div.textContent).toMatch(/未収録/);expect(readNpbHistoricalSeason).not.toHaveBeenCalled();expect(div.textContent).not.toContain("2026 Current");}finally{await close();}});
  it("restores selected canonical player/year and keeps collection/Favorite storage untouched",async()=>{localStorage.setItem("qa-preserved","sentinel");const {div,close}=await mount(`?season=2025&player=${id}&years=2025&recentPlayers=${id}&role=batting`);try{
    expect(div.textContent).toContain("収録済み年度の比較");expect(div.textContent).toContain("2025年の収録行合計");expect(div.querySelector('input[type="checkbox"]:checked')).not.toBeNull();expect(localStorage.getItem("qa-preserved")).toBe("sentinel");
  }finally{await close();localStorage.removeItem("qa-preserved");}});
  it("does not use another player's data for an invalid canonical ID",async()=>{const {div,close}=await mount("?season=2025&player=unknown");try{expect(div.textContent).toContain("指定した選手の過去年度成績は未収録");expect(div.textContent).not.toContain("収録済み年度の比較");}finally{await close();}});
  it("credits selected-player comparisons even when the query hides every result card",async()=>{const {div,close}=await mount(`?season=2025&q=unmatched&recentPlayers=${id}`);try{
    expect(div.querySelectorAll("article")).toHaveLength(0);expect(div.querySelector('[aria-label="選手比較データの出典"] a[href*="oldid=123"]')).not.toBeNull();
  }finally{await close();}});
  it("credits every revision represented by another-year comparison without a visible current-year player card",async()=>{
    vi.mocked(readNpbHistoricalManifest).mockResolvedValue({...manifest,seasons:[...manifest.seasons,{...manifest.seasons[0]!,season:2024}],players:[{...manifest.players[0]!,seasons:[2024,2025]}]});
    vi.mocked(readNpbHistoricalSeason).mockImplementation(async year=>year===2025?{...dataset,players:[],rows:[]}:{...dataset,players:[{...dataset.players[0]!,revision:456}],rows:[{...dataset.rows[0]!,season:2024}]});
    const {div,close}=await mount(`?season=2025&player=${id}&years=2024`);try{
      expect(div.querySelectorAll("article")).toHaveLength(0);expect(div.textContent).toContain("2024年の収録行合計");expect(div.querySelector('[aria-label="年度比較・合計データの出典"] a[href*="oldid=456"]')).not.toBeNull();
    }finally{await close();}
  });
  it("distinguishes a network failure from an empty historical season",async()=>{vi.mocked(readNpbHistoricalSeason).mockRejectedValue(new Error("offline"));const {div,close}=await mount("?season=2025");try{expect(div.textContent).toContain("年度別成績を取得できません");expect(div.textContent).not.toContain("条件に一致する収録データがありません");}finally{await close();}});
});
