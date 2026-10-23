// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useNavigate, useSearchParams } from "react-router-dom";
import { GameBoxScore, GameJumpNav } from "../src/ui/game-box-score";

let host: HTMLDivElement, root: Root;
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);host=document.createElement("div");document.body.append(host);root=createRoot(host);});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();vi.restoreAllMocks();});
function RoutedBox(){
  const [params,setParams]=useSearchParams(),navigate=useNavigate();
  return <><output>{params.toString()}</output><button onClick={()=>navigate(-1)}>戻る</button><GameBoxScore
    away={{name:"長いビジター球団名",content:<a href="#/away">打者 0安打</a>}}
    home={{name:"ホーム",content:<a href="#/home">投手 —回</a>}}
    selectedSide={params.get("boxSide")==="home"?"home":"away"}
    onSideChange={side=>{const next=new URLSearchParams(params);next.set("boxSide",side);setParams(next,{preventScrollReset:true});}}/></>;
}
describe("game results to box score",()=>{
  it("restores the selected side from a deep link, preserves scope, and Back restores the other side",async()=>{
    await act(async()=>root.render(<MemoryRouter initialEntries={["/game?season=2024&competition=postseason&boxSide=home"]}><RoutedBox/></MemoryRouter>));
    const tabs=[...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
    expect(host.querySelectorAll('[role="tabpanel"]:not([hidden])')).toHaveLength(1);
    await act(async()=>tabs[0]!.click());
    expect(host.querySelector("output")?.textContent).toBe("season=2024&competition=postseason&boxSide=away");
    await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==="戻る")!.click());
    expect(tabs[1]?.getAttribute("aria-selected")).toBe("true");
    expect(host.textContent).toContain("0安打");expect(host.textContent).toContain("—回");
  });
  it("supports keyboard arrows with focus and a single visible panel",async()=>{
    await act(async()=>root.render(<GameBoxScore away={{name:"A",content:"away"}} home={{name:"H",content:"home"}}/>));
    const tabs=[...host.querySelectorAll<HTMLButtonElement>('[role="tab"]')];tabs[0]!.focus();
    await act(async()=>tabs[0]!.dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true})));
    expect(document.activeElement).toBe(tabs[1]);expect(tabs[1]!.tabIndex).toBe(0);
    const panel=host.querySelector('[role="tabpanel"]:not([hidden])');expect(panel?.textContent).toBe("home");
    expect(panel?.getAttribute("aria-labelledby")).toBe(tabs[1]!.id);
  });
  it("jumps to the actual section and transfers focus without hiding information",async()=>{
    const scroll=vi.fn();vi.stubGlobal("HTMLElement",window.HTMLElement);window.HTMLElement.prototype.scrollIntoView=scroll;
    await act(async()=>root.render(<div className="game-detail"><GameJumpNav/><section data-game-section="recap" tabIndex={-1}>概要</section><GameBoxScore away={{name:"A",content:"成績"}} home={{name:"H",content:"成績"}}/></div>));
    await act(async()=>[...host.querySelectorAll('button')].find(b=>b.textContent==="選手成績")!.click());
    expect(document.activeElement).toBe(host.querySelector('[data-game-section="box"]'));expect(scroll).toHaveBeenCalledOnce();
    expect(host.querySelector('[data-game-section="recap"]')?.textContent).toBe("概要");
  });
});
