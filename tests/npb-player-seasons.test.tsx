// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach,beforeEach,describe,expect,it,vi } from "vitest";
import { MemoryRouter,Route,Routes,useLocation } from "react-router-dom";
import { NpbPlayerSeasons } from "../src/ui/npb-historical";
import { readNpbHistoricalManifest,readNpbHistoricalSeason } from "../src/application/npb-historical-reader";
import { readNpbPostseasonAggregates } from "../src/application/npb-competition-reader";
import { canonicalDeepLink, parentNativeRoute } from "../src/domain/native-navigation";
import { portableRoute } from "../src/domain/product-sharing";
import { historicalPitchingKeys } from "../src/domain/npb-historical";
vi.mock("../src/application/npb-historical-reader",()=>({readNpbHistoricalManifest:vi.fn(),readNpbHistoricalSeason:vi.fn()}));
vi.mock("../src/application/npb-competition-reader",()=>({admittedNpbPostseasonScopes:[{playerId:"00000000-0000-4000-8000-000000000001",season:2025,competition:"postseason",stage:"npb_cs_final"}],readNpbPostseasonAggregates:vi.fn()}));
const id="00000000-0000-4000-8000-000000000001",metadata={playerId:id,name:"架空のとても長いテスト選手名",wikidataId:"Q123",npbId:"12345",article:"架空テスト選手",revision:123,revisionAt:"2026-01-01T00:00:00Z",contentSha256:"b".repeat(64)};
const m={schemaVersion:1 as const,league:"NPB" as const,competition:"regular" as const,temporalScope:"historical" as const,coverage:"partial" as const,license:"CC-BY-SA-4.0" as const,inputSha256:"a".repeat(64),observedAt:"2026-10-02T00:00:00Z",seasons:[{season:2025,rows:1,players:1,sha256:"b".repeat(64),bytes:100}],players:[{playerId:id,name:metadata.name,seasons:[2025]}]};
const row={playerId:id,season:2025,teamId:"npb:team:tigers" as const,role:"pitching" as const,metrics:Object.fromEntries(historicalPitchingKeys.map(k=>[k,null]))};
const regular={schemaVersion:1 as const,league:"NPB" as const,temporalScope:"historical" as const,competition:"regular" as const,granularity:"season_aggregate" as const,license:"CC-BY-SA-4.0" as const,observedAt:m.observedAt,inputSha256:m.inputSha256,transformation:"Test only",coverage:"partial" as const,players:[metadata],rows:[row]};
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.mocked(readNpbHistoricalManifest).mockResolvedValue(m);vi.mocked(readNpbHistoricalSeason).mockResolvedValue(regular);vi.mocked(readNpbPostseasonAggregates).mockResolvedValue({schemaVersion:1,provider:"Wikipedia",license:"CC-BY-SA-4.0",temporalScope:"historical",coverage:"partial",granularity:"season_stage_aggregate",observedAt:m.observedAt,inputSha256:m.inputSha256,transformation:"Test only",players:[metadata],rows:[{...row,scope:{league:"NPB",season:2025,temporalScope:"historical",competition:"postseason",stage:"npb_cs_final"}}]});});
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals();});
function Location(){return <output>{useLocation().search}</output>;}
async function mount(query:string){const div=document.createElement("div");document.body.append(div);const root=createRoot(div);await act(async()=>root.render(<MemoryRouter initialEntries={[`/NPB/players/${id}/seasons${query}`]}><Location/><Routes><Route path="/NPB/players/:playerId/seasons" element={<NpbPlayerSeasons/>}/></Routes></MemoryRouter>));return{div,close:async()=>{await act(async()=>root.unmount());div.remove();}};}
describe("NPB player year/competition entry",()=>{
  it("preserves a canonical NPB stage through share and native deep links without broadening MLB routes",()=>{
    const path=`/NPB/players/${id}/seasons`,query="season=2025&competition=postseason&stage=npb_cs_final&role=pitching&years=2025&privateKey=discard";
    const route=portableRoute(path,query)!;expect(route).toContain("stage=npb_cs_final");expect(route).not.toContain("privateKey");
    expect(canonicalDeepLink(`baseballnotes://NPB/players/${id}/seasons?${query}`)).toBe(route);
    expect(canonicalDeepLink(`https://tomoya41.github.io/baseball-notes/#${path}?${query}`)).toBe(route);
    expect(portableRoute(path,"competition=postseason&stage=world_series")).toBeNull();
    expect(canonicalDeepLink(`baseballnotes://NPB/players/${id}/seasons?season=bad`)).toBeNull();
    expect(portableRoute(path,"role=unknown")).toBeNull();
    expect(portableRoute(path.replace("NPB","MLB"),query)).toBeNull();
    expect(parentNativeRoute(path+"?season=2025")).toContain("/NPB/history?player="+id+"&season=2025");
  });
  it("opens historical-only identities in their admitted year without a Current link",async()=>{vi.mocked(readNpbHistoricalManifest).mockResolvedValue({...m,players:[{...m.players[0]!,identityScope:"historical_only"}]});const {div,close}=await mount("");try{expect(div.querySelector('select[aria-label="選手成績の年度"]')?.textContent).not.toContain("2026");expect(div.querySelector(`a[href$="${id}"]`)).toBeNull();expect(readNpbHistoricalSeason).toHaveBeenCalledWith(2025,expect.anything());}finally{await close();}});
  it("does not fetch historical stats for the Current entry or offer uncollected 2026 competitions",async()=>{const {div,close}=await mount("");try{expect(div.querySelector('a[href$="'+id+'"]')).not.toBeNull();expect(readNpbHistoricalSeason).not.toHaveBeenCalled();expect(readNpbPostseasonAggregates).not.toHaveBeenCalled();expect(div.querySelectorAll('select[aria-label="選手成績の大会"] option:disabled')).toHaveLength(4);}finally{await close();}});
  it("reloads exact scoped URLs, preserves source credits and does not silently show regular",async()=>{const {div,close}=await mount("?season=2025&role=pitching&competition=postseason&stage=npb_cs_final");try{expect(div.textContent).toContain("2025年 · CS ファイナル");expect(div.querySelector('a[href*="oldid=123"]')).not.toBeNull();expect(readNpbHistoricalSeason).not.toHaveBeenCalled();expect(readNpbPostseasonAggregates).toHaveBeenCalledTimes(1);expect(div.querySelector("dd")?.textContent).toBe("—");}finally{await close();}});
  it.each(["?season=2026&competition=preseason","?season=2025&competition=postseason&stage=japan_series","?season=bad"])("rejects unsupported %s without data fetch",async query=>{const {div,close}=await mount(query);try{expect(div.textContent).toContain("未収録");expect(readNpbHistoricalSeason).not.toHaveBeenCalled();expect(readNpbPostseasonAggregates).not.toHaveBeenCalled();}finally{await close();}});
  it("keeps year, role and competition in URL with a bounded initial regular read",async()=>{const {div,close}=await mount("?season=2025&role=pitching");try{expect(readNpbHistoricalSeason).toHaveBeenCalledTimes(1);const select=div.querySelector('select[aria-label="選手成績の大会"]') as HTMLSelectElement;await act(async()=>{select.value="npb_cs_final";select.dispatchEvent(new Event("change",{bubbles:true}));});expect(div.querySelector("output")?.textContent).toContain("competition=postseason&stage=npb_cs_final");expect(div.textContent).toContain("2025年 · CS ファイナル");}finally{await close();}});
});
