// @vitest-environment jsdom
import { afterEach,it,expect,vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { NpbDraftEventScreen } from "../src/ui/npb-draft-event";
import { readNpbDraftEvent } from "../src/application/npb-draft-event-reader";
import { draftFixture } from "./fixtures/npb-draft";
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
it("separates regular/developmental and keeps scope on URL",async()=>{const f=await mount("?view=results&type=developmental",false,d=>{d.observedAt="2026-10-22T10:00:00Z";d.eventState="in_progress";d.coverage="partial";d.selections=[{teamId:"npb:team:tigers",candidateId:d.candidates[0]!.id,type:"developmental",round:1,status:"confirmed",sourcePageId:5209342,evidenceSha256:"c".repeat(64)}];});try{expect(f.host.textContent).toContain("育成1位");expect(f.host.querySelectorAll("article")).toHaveLength(1);expect(f.host.textContent).not.toContain("支配下1位 · 確認済み");}finally{await f.close();}});
it("retries source failure and rejects malformed URLs without requests",async()=>{const f=await mount(undefined,true);try{expect(f.host.textContent).toContain("再試行");vi.mocked(readNpbDraftEvent).mockResolvedValue(f.data);await act(async()=>f.host.querySelector("button")!.click());expect(f.host.querySelectorAll("article")).toHaveLength(12);}finally{await f.close();}vi.clearAllMocks();const bad=await mount("?view=prospects");try{expect(bad.host.textContent).toContain("未対応");expect(readNpbDraftEvent).not.toHaveBeenCalled();}finally{await bad.close();}});
it("keeps deep link/share/native Back scoped and strips unknown keys",()=>{const route="/NPB/talent/2026",q="view=results&type=developmental&private=never";expect(portableRoute(route,q)).toBe(route+"?view=results&type=developmental");expect(canonicalDeepLink("baseballnotes://NPB/talent/2026?"+q)).toBe(route+"?view=results&type=developmental");expect(parentNativeRoute(route+"?"+q)).toBe("/NPB/talent");for(const invalid of ["view=bad","team=unknown","type=rookie","page=0","q="+"x".repeat(81)])expect(draftEventQuery(new URLSearchParams(invalid)).valid).toBe(false);});
