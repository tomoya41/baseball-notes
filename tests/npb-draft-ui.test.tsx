// @vitest-environment jsdom
import { afterEach,it,expect,vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { NpbDraftEventScreen } from "../src/ui/npb-draft-event";
import { readNpbDraftEvent } from "../src/application/npb-draft-event-reader";
import { draftFixture,expandedDraftFixture,researchedDraftFixture } from "./fixtures/npb-draft";
import { draftEventQuery } from "../src/domain/npb-draft-query";
import { portableRoute } from "../src/domain/product-sharing";
import { canonicalDeepLink,parentNativeRoute } from "../src/domain/native-navigation";
vi.mock("../src/application/npb-draft-event-reader",()=>({readNpbDraftEvent:vi.fn()}));
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals();});
async function mount(query="",fail=false,modify?:(data:ReturnType<typeof draftFixture>)=>void){
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);const data=draftFixture();modify?.(data);vi.mocked(readNpbDraftEvent).mockImplementation(async()=>{if(fail)throw Error("offline");return data;});
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  await act(async()=>root.render(<MemoryRouter initialEntries={["/NPB/talent/2026"+query]}><NpbDraftEventScreen/></MemoryRouter>));
  return {host,data,close:async()=>{await act(async()=>root.unmount());host.remove();}};
}
it("shows 12 hypotheses, source/time and no fabricated results",async()=>{const f=await mount();try{expect(f.host.querySelectorAll("article")).toHaveLength(12);expect(f.host.textContent).toContain("志望届・指名資格は未確認");expect(f.host.textContent).toContain("AIで作成");expect(f.host.textContent).toContain("答え合わせ待ち");expect(f.host.querySelectorAll('a[href*="oldid="]')).toHaveLength(1);expect(readNpbDraftEvent).toHaveBeenCalledTimes(1);}finally{await f.close();}});
it("filters candidates without fetching Current Player profiles",async()=>{const f=await mount("?view=candidates&q=not-collected");try{expect(f.host.textContent).toContain("この条件の選手は未収録");await act(async()=>{const input=f.host.querySelector("input")!;Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value")!.set!.call(input,"");input.dispatchEvent(new Event("input",{bubbles:true}));});expect(readNpbDraftEvent).toHaveBeenCalledTimes(1);}finally{await f.close();}});
it("keeps missing results distinct from no selection and draws no fake lottery",async()=>{const f=await mount("?view=results");try{expect(f.host.textContent).toContain("未収録は未指名・指名終了を意味しません");expect(f.host.textContent).toContain("独自案の重複を実際の競合とは扱いません");expect(f.host.querySelectorAll("article")).toHaveLength(0);}finally{await f.close();}});
it("separates regular/developmental and keeps scope on URL",async()=>{const f=await mount("?view=results&type=developmental",false,d=>{d.observedAt="2026-10-22T10:00:00Z";d.eventState="in_progress";d.coverage="partial";d.review={reviewedBy:"fixture reviewer",reviewedAt:"2026-10-22T10:01:00Z"};d.selections=[{teamId:"npb:team:tigers",candidateId:d.candidates[0]!.id,type:"developmental",round:1,status:"confirmed",sourcePageId:5209342,evidenceSha256:"c".repeat(64)}];});try{expect(f.host.textContent).toContain("育成1位");expect(f.host.textContent).toContain("最終確認");expect(f.host.querySelectorAll("article")).toHaveLength(1);expect(f.host.textContent).not.toContain("支配下1位 · 確認済み");}finally{await f.close();}});
it("retries source failure and rejects malformed URLs without requests",async()=>{const f=await mount(undefined,true);try{expect(f.host.textContent).toContain("再試行");vi.mocked(readNpbDraftEvent).mockResolvedValue(f.data);await act(async()=>f.host.querySelector("button")!.click());expect(f.host.querySelectorAll("article")).toHaveLength(12);}finally{await f.close();}vi.clearAllMocks();const bad=await mount("?view=prospects");try{expect(bad.host.textContent).toContain("未対応");expect(readNpbDraftEvent).not.toHaveBeenCalled();}finally{await bad.close();}});
it("keeps deep link/share/native Back scoped and strips unknown keys",()=>{const route="/NPB/talent/2026",q="view=results&type=developmental&private=never";expect(portableRoute(route,q)).toBe(route+"?view=results&type=developmental");expect(canonicalDeepLink("baseballnotes://NPB/talent/2026?"+q)).toBe(route+"?view=results&type=developmental");expect(parentNativeRoute(route+"?"+q)).toBe("/NPB/talent");for(const invalid of ["view=bad","team=unknown","type=rookie","page=0","q="+"x".repeat(81)])expect(draftEventQuery(new URLSearchParams(invalid)).valid).toBe(false);});
it("clears candidate-only search on result navigation and shows scoped lottery empty",async()=>{
  const f=await mount("?view=candidates&q=not-collected");try{expect(f.host.querySelector('a[href*="view=results"]')!.getAttribute("href")).not.toContain("q=");}finally{await f.close();}
  const g=await mount("?view=results&team=npb:team:hawks&q=not-collected",false,d=>{d.observedAt="2026-10-22T10:00:00Z";d.eventState="in_progress";d.coverage="partial";d.review={reviewedBy:"fixture",reviewedAt:"2026-10-22T10:01:00Z"};d.selections=[{teamId:"npb:team:hawks",candidateId:d.candidates[0]!.id,type:"regular",round:1,status:"confirmed",sourcePageId:5209342,evidenceSha256:"c".repeat(64)}];d.lotteries=[{attempt:1,candidateId:d.candidates[0]!.id,teamIds:["npb:team:giants","npb:team:tigers"],winnerId:"npb:team:tigers",sourcePageId:5209342,evidenceSha256:"d".repeat(64)}];});try{expect(g.host.querySelectorAll("article")).toHaveLength(1);expect(g.host.textContent).toContain("この条件の競合・抽選結果は未収録");}finally{await g.close();}
});
it("does not mix regular first-pick lotteries into developmental results",async()=>{
  const f=await mount("?view=results&type=developmental",false,d=>{d.observedAt="2026-10-22T10:00:00Z";d.eventState="in_progress";d.coverage="partial";d.review={reviewedBy:"fixture",reviewedAt:"2026-10-22T10:01:00Z"};d.lotteries=[{attempt:1,candidateId:d.candidates[0]!.id,teamIds:["npb:team:tigers","npb:team:giants"],winnerId:"npb:team:tigers",sourcePageId:5209342,evidenceSha256:"d".repeat(64)}];});try{expect(f.host.querySelectorAll("article")).toHaveLength(0);expect(f.host.textContent).toContain("支配下1位の抽選は指名区分を切り替えて");expect(f.host.textContent).not.toContain("当選確認");}finally{await f.close();}
});
it("shows the saved scenario and actual final first selection together without rewriting the prediction",async()=>{
  const f=await mount(undefined,false,d=>{const c={...d.candidates[0]!,id:"npb:draft:2026:"+"e".repeat(24),article:"架空の別選手",name:"実指名の架空選手",affiliation:"別の架空大学"};d.candidates.push(c);d.observedAt="2026-10-22T10:00:00Z";d.eventState="ended";d.review={reviewedBy:"fixture",reviewedAt:"2026-10-22T10:01:00Z"};d.coverage="partial";d.selections=[{teamId:"npb:team:tigers",candidateId:c.id,type:"regular",round:1,status:"confirmed",sourcePageId:5209342,evidenceSha256:"f".repeat(64)}];});
  try{expect(f.host.textContent).toContain("保存した独自案");expect(f.host.textContent).toContain("収録済みの支配下1位");expect(f.host.textContent).toContain("実指名の架空選手");expect(f.host.textContent).toContain("候補案と異なります");expect(f.data.forecast.predictions[0]!.candidateId).toBe(draftFixture().candidates[0]!.id);}finally{await f.close();}
});

it("shows the new three-round edition and preserves the original saved forecast",async()=>{
  const f=await mount(undefined,false,d=>Object.assign(d,expandedDraftFixture()));try{expect(f.host.querySelectorAll("article")).toHaveLength(36);expect(f.host.textContent).toContain("12球団の1〜3位予想");expect(f.host.textContent).toContain("独立リーグ");expect(f.host.textContent).toContain("3位の理由・答え合わせ");}finally{await f.close();}
  const g=await mount("?forecast=original",false,d=>Object.assign(d,expandedDraftFixture()));try{expect(g.host.querySelectorAll("article")).toHaveLength(12);expect(g.host.textContent).toContain("12球団の1位候補案");}finally{await g.close();}
});
it("filters amateur categories and teams and preserves the new conditions in shared/native URLs",async()=>{
  const f=await mount("?view=candidates&group=independent",false,d=>Object.assign(d,expandedDraftFixture()));try{expect(f.host.querySelectorAll("article")).toHaveLength(9);expect((f.host.querySelector("select") as HTMLSelectElement).value).toBe("independent");}finally{await f.close();}
  const g=await mount("?team=npb:team:giants",false,d=>Object.assign(d,expandedDraftFixture()));try{expect(g.host.querySelectorAll("article")).toHaveLength(3);}finally{await g.close();}
  const h=await mount("?team=npb:team:giants&forecast=original",false,d=>Object.assign(d,expandedDraftFixture()));try{expect(h.host.querySelectorAll("article")).toHaveLength(1);}finally{await h.close();}
  const route="/NPB/talent/2026?view=candidates&group=high_school&forecast=original";expect(portableRoute("/NPB/talent/2026",route.split("?")[1])).toBe(route);expect(canonicalDeepLink("baseballnotes:/"+route)).toBe(route);
  expect(draftEventQuery(new URLSearchParams("group=pro" )).valid).toBe(false);expect(draftEventQuery(new URLSearchParams("forecast=edited")).valid).toBe(false);
});

it("prioritizes researched club forecasts with attributed opinion links, preserving both earlier editions",async()=>{
  const f=await mount("?team=npb:team:giants",false,d=>Object.assign(d,researchedDraftFixture()));try{
    expect(f.host.querySelectorAll("article")).toHaveLength(3);expect(f.host.textContent).toContain("球団事情から考える1〜3位予想");expect(f.host.textContent).toContain("1位・初回入札予想");expect(f.host.textContent).toContain("2位・残っている場合");expect(f.host.textContent).toContain("論評・提案（球団の意向とは別）");expect(f.host.textContent).toContain("最終的な1位指名からは判定しません");expect(f.host.querySelector('a[href="https://sportiva.shueisha.co.jp/clm/baseball/fixture/"]')).not.toBeNull();expect(readNpbDraftEvent).toHaveBeenCalledTimes(1);
  }finally{await f.close();}
  const g=await mount("?forecast=expanded",false,d=>Object.assign(d,researchedDraftFixture()));try{expect(g.host.querySelectorAll("article")).toHaveLength(36);expect(g.host.textContent).toContain("12球団の1〜3位予想");expect(g.host.textContent).not.toContain("球団事情から考える1〜3位予想");}finally{await g.close();}
});
