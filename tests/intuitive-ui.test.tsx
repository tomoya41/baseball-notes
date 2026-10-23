// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerListTools, PlayerQuickActions, HomeSearchEntry } from "../src/ui/signature";
import { MetricLabel } from "../src/ui/components";
import { GameRecap } from "../src/ui/game-story";
import { NpbSavedGames } from "../src/ui/daily-dashboard";
import { services } from "../src/app/services";
import type { GameIndexRow } from "../src/domain/npb-game-index";

let root: Root, host: HTMLDivElement;
beforeEach(()=>{
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);
  vi.useFakeTimers({toFake:["Date"]});vi.setSystemTime(new Date("2026-10-23T00:00:00Z"));
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};
  host=document.createElement("div");document.body.append(host);root=createRoot(host);
});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.useRealTimers();vi.unstubAllGlobals();});
async function render(content: React.ReactNode){await act(async()=>root.render(<MemoryRouter>{content}</MemoryRouter>));}

describe("result-first navigation",()=>{
  it("replaces the Home manifest request with one bounded feed and never invents Today or Day evidence",async()=>{
    const game:GameIndexRow={gameId:"npb:game:one",date:"2026-10-08",gameNumber:1,status:"final",scheduledTime:null,home:{id:"npb:team:tigers",name:"阪神",score:0},away:{id:"npb:team:swallows",name:"ヤクルト",score:4},completeness:"partial",battingAvailable:false,pitchingAvailable:false,detailAvailable:true};
    const reader={manifest:vi.fn(),date:vi.fn(),recent:vi.fn(async()=>({effectiveDate:"2026-10-12",games:[game,{...game,gameId:"npb:game:future",date:"2026-10-13"},{...game,gameId:"npb:game:scheduled",status:"scheduled" as const}]})),records:vi.fn()};
    await render(<NpbSavedGames services={{...services,gameSurface:reader as unknown as typeof services.gameSurface}} />);
    expect(reader.recent).toHaveBeenCalledTimes(1);expect(reader.manifest).not.toHaveBeenCalled();expect(reader.date).not.toHaveBeenCalled();expect(reader.records).not.toHaveBeenCalled();
    expect(host.querySelectorAll('.scoreboard-row')).toHaveLength(1);expect(host.querySelector('.scoreboard-row')?.textContent).toContain('0');
    expect(host.textContent).toContain('2026-10-12までの保存済み結果');expect(host.textContent).toContain('一部データ確認中');expect(host.textContent).not.toContain('今日は試合なし');
  });
  it("keeps scoped comparison/history and search directly reachable without a menu",async()=>{
    await render(<><PlayerQuickActions compareTo="/MLB/compare?season=2024&competition=postseason&players=one" historyTo="/MLB/history?season=2024&competition=postseason&player=one" /><HomeSearchEntry league="MLB" year={2024} /></>);
    expect([...host.querySelectorAll("a")].map(a=>a.getAttribute("href"))).toEqual(["/MLB/history?season=2024&competition=postseason&player=one","/MLB/compare?season=2024&competition=postseason&players=one","/MLB/search?season=2024"]);
  });
  it("discloses row operations and returns focus without hiding the player name in a crowded action row",async()=>{
    await render(<PlayerListTools name="非常に長い名前の選手"><a href="/NPB/compare?players=one">比較に追加</a><button>グループに保存</button></PlayerListTools>);
    expect(document.querySelector("dialog")).toBeNull();
    const trigger=host.querySelector("button")!;trigger.focus();
    await act(async()=>trigger.click());
    expect(document.querySelector('dialog[open] a')?.getAttribute("href")).toBe("/NPB/compare?players=one");
    expect(document.querySelector("dialog")?.textContent).toContain("グループに保存");
    await act(async()=>document.querySelector("dialog")!.dispatchEvent(new Event("close",{bubbles:true})));
    expect(document.activeElement).toBe(trigger);
  });
  it("opens the full explanation from the metric label without a repeated decorative info icon",async()=>{
    await render(<MetricLabel metric="AVG" label="打率" />);
    const trigger=host.querySelector("button")!;
    expect(trigger.textContent).toBe("打率");expect(trigger.getAttribute("aria-label")).toBe("AVGの説明");expect(trigger.querySelector("svg")).toBeNull();
    await act(async()=>trigger.click());
    expect(document.querySelector("dialog")?.textContent).toContain("計算式");
  });
  it("keeps every selected recap and favorite available while making the default summary compact",async()=>{
    const batting=Array.from({length:4},(_,i)=>({playerId:`p${i}`,teamId:"team",name:`選手${i}`,hits:4-i,homeRuns:1,rbi:1,pa:4}));
    await render(<GameRecap league="NPB" batting={batting} pitching={[]} complete favorites={[{league:"NPB",kind:"player",entityId:"p3",addedAt:"2026-10-23T00:00:00Z"}]} />);
    expect(host.querySelectorAll(".daily-recap-item")).toHaveLength(3);
    expect(host.querySelector('a[href="/NPB/players/p3"]')).not.toBeNull();
    const expand=[...host.querySelectorAll("button")].find(b=>b.textContent==="活躍選手をすべて見る")!;
    await act(async()=>expand.click());expect(host.querySelectorAll(".daily-recap-item")).toHaveLength(4);
  });
});
