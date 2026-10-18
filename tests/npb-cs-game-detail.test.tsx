// @vitest-environment jsdom
import {act} from "react";
import {createRoot} from "react-dom/client";
import {MemoryRouter,Route,Routes} from "react-router-dom";
import {afterEach,expect,it,vi} from "vitest";
import {NpbCsGameDetail} from "../src/ui/npb-cs";
import {NpbGameDetailScreen} from "../src/ui/npb-game-detail";
import {readNpbCs} from "../src/application/npb-cs-reader";
import {canonicalDeepLink,parentNativeRoute} from "../src/domain/native-navigation";
import {portableRoute} from "../src/domain/product-sharing";
import {csGameFixture,csGameId} from "./fixtures/npb-cs";
vi.mock("../src/application/npb-cs-reader",()=>({readNpbCs:vi.fn(),admittedCsGameIds:["npb:game:"+"a".repeat(20)]}));
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals();});
async function mount(query="?competition=postseason&stage=npb_cs_final",id=csGameId,wrapper=false,failed=false){
 vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.mocked(readNpbCs).mockImplementation(async()=>{if(failed)throw Error("offline");return csGameFixture();});
 const host=document.createElement("div"),root=createRoot(host),repository={find:vi.fn().mockResolvedValue(null)};document.body.append(host);
 await act(async()=>root.render(<MemoryRouter initialEntries={[`/NPB/games/${encodeURIComponent(id)}${query}`]}><Routes><Route path="/NPB/games/:gameId" element={wrapper?<NpbGameDetailScreen repository={repository}/>:<NpbCsGameDetail/>}/></Routes></MemoryRouter>));
 return {host,repository,close:async()=>{await act(async()=>root.unmount());host.remove();}};
}
it("uses shared scoreboard styling, explicit postseason scope and exact single-game batting/pitching, not stage totals",async()=>{
 const f=await mount();try{
  expect(f.host.textContent).toContain("ポストシーズン · CS ファイナル");expect(f.host.textContent).toContain("一部収録");
  expect(f.host.querySelector('[aria-label="DeNAの投球成績"]')?.textContent).toContain("0.1");
  const row=f.host.querySelector('[aria-label="DeNAの投球成績"] tbody tr');expect(Array.from(row!.querySelectorAll("td")).map(td=>td.textContent)).toEqual(["投球回0.1","SO2","R0","ER0"]);
  expect(f.host.querySelector('a[href*="oldid=200"]')).not.toBeNull();expect(Array.from(f.host.querySelectorAll("a")).map(a=>a.getAttribute("href"))).toEqual(expect.arrayContaining([expect.stringContaining("role=pitching")]));
  expect(f.host.textContent).not.toMatch(/NaN|Infinity/);
 }finally{await f.close();}
});
it.each(["?competition=regular","?season=2025","?stage=japan_series"])("rejects incompatible scope before fetching: %s",async query=>{
 const f=await mount(query);try{expect(readNpbCs).not.toHaveBeenCalled();expect(f.host.textContent).toContain("大会条件");}finally{await f.close();}
});
it("keeps direct/reloaded CS IDs on the postseason reader and never falls back to Regular",async()=>{
 const f=await mount("",csGameId,true);try{expect(f.repository.find).not.toHaveBeenCalled();expect(f.host.textContent).toContain("ポストシーズン");}finally{await f.close();}
 const missing=await mount("?competition=postseason","npb:game:"+"c".repeat(20),true);try{expect(missing.repository.find).not.toHaveBeenCalled();expect(missing.host.textContent).toContain("未収録");}finally{await missing.close();}
 const regular=await mount("","npb:game:"+"c".repeat(20),true);try{expect(regular.repository.find).toHaveBeenCalledTimes(1);}finally{await regular.close();}
});
it("retains loading-error retry and distinguishes a mismatched stage from a game without observations",async()=>{
 const f=await mount("?competition=postseason",csGameId,false,true);try{expect(f.host.textContent).toContain("取得できません");expect(f.host.textContent).toContain("再試行");}finally{await f.close();}
 const wrong=await mount("?competition=postseason&stage=npb_cs_first");try{expect(wrong.host.textContent).toContain("一致しません");}finally{await wrong.close();}
});
it("preserves competition/stage in native/share URLs and the direct-link Android Back destination",()=>{
 const path=`/NPB/games/${encodeURIComponent(csGameId)}`,search="competition=postseason&stage=npb_cs_final";
 expect(portableRoute(path,search)).toContain("stage=npb_cs_final");expect(canonicalDeepLink("baseballnotes:/"+path+"?"+search)).toContain("competition=postseason");
 expect(parentNativeRoute(path+"?"+search)).toBe("/NPB/cs?season=2026&stage=npb_cs_final");
 expect(portableRoute(path,"competition=postseason&stage=japan_series")).toBeNull();
});
