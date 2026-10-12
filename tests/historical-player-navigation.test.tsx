// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { MlbHistoricalPlayer } from "../src/ui/mlb-historical";
import { HistoricalCompetitionContext, historicalRouteCompetition } from "../src/ui/historical-competition-context";
import { PostseasonAvailabilityContext } from "../src/ui/postseason-availability";
import { postseasonCapabilities } from "../src/domain/postseason-capabilities";

const id = "mlb:player:e70b8d12-aa41-50c0-9c1b-d468d451355f";
const absent = vi.hoisted(()=>({scope:"" as string,status:"missing" as "missing"|"loading"|"error"}));
vi.mock("../src/ui/use-mlb-historical", async () => {
  const {useHistoricalCompetition}=await import("../src/ui/historical-competition-context");
  return {
  useHistoricalStatic: () => { const scope=useHistoricalCompetition();return absent.scope===scope ? {status:absent.status,retry:()=>{},value:null} : ({ status: "ready", retry: () => {}, value: {
    player: { id: "mlb:player:e70b8d12-aa41-50c0-9c1b-d468d451355f", name: "大谷翔平", seasons: [2020, 2025], positions: [], teamIds: [], bats: null, throws: null },
    batting: [], pitching: [], seasonTotals: {}, collectedRange: "2020–2025", collectedRangeTotals: { batting: null, pitching: null },
  } });},
};});
const manifest = { schemaVersion: 1 as const, league: "MLB" as const, current2026: "unavailable" as const, teams: [],
  seasons: [2020, 2025].map(season => ({ season, firstDate: `${season}-07-01`, lastDate: `${season}-10-01`, games: 0, coverage: "complete" as const, playerCount: 1 })) };
function Location() { const location = useLocation(); return <output>{location.pathname}{location.search}</output>; }
beforeEach(() => { absent.scope="";absent.status="missing";vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true); HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open",""); }; });
afterEach(() => { vi.unstubAllGlobals(); });
describe("historical player navigation context", () => {
  it.each(["advanced", "obsolete"])("keeps the selected year and as-of date through %s fallback", async section => {
    vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
    const element = document.createElement("div"); document.body.append(element);
    const root = createRoot(element);
    try {
      await act(async () => root.render(<MemoryRouter initialEntries={[`/MLB/players/${encodeURIComponent(id)}/${section}?season=2020&asOfDate=2020-08-01`]}>
        <Location /><Routes><Route path="/MLB/players/:playerId/:section?" element={<MlbHistoricalPlayer manifest={manifest} favorites={[]} saving={false} toggle={() => {}} />} /></Routes>
      </MemoryRouter>));
      expect(element.querySelector("output")?.textContent).toBe(`/MLB/players/${encodeURIComponent(id)}${section === "advanced" ? "/analysis" : ""}?season=2020&asOfDate=2020-08-01`);
      expect(element.querySelector('a[aria-label="選手一覧に戻る"]')?.getAttribute("href")).toBe("/MLB/search?season=2020");
    } finally { await act(async () => root.unmount()); element.remove(); }
  });
});

it("keeps the HOT window through player tabs and the disclosed action menu",async()=>{
  const element=document.createElement("div");document.body.append(element);const root=createRoot(element);
  try { await act(async()=>root.render(<MemoryRouter initialEntries={[`/MLB/players/${encodeURIComponent(id)}?season=2020&asOfDate=2020-08-01&period=7`]}><Routes><Route path="/MLB/players/:playerId/:section?" element={<MlbHistoricalPlayer manifest={manifest} favorites={[]} saving={false} toggle={()=>{}}/>}/></Routes></MemoryRouter>));
    const links=Array.from(element.querySelectorAll('nav[aria-label="選手ページ"] a'));
    expect(links.length).toBeGreaterThan(0);for(const link of links)expect(link.getAttribute("href")).toContain("period=7");
    expect(element.querySelector(".player-tools-disclosure")).toBeNull();
    await act(async()=>element.querySelector<HTMLButtonElement>('button[aria-label="選手の操作"]')!.click());
    const dialog=document.querySelector('dialog[aria-label="比較・推移・保存"]')!;
    expect(Array.from(dialog.querySelectorAll("a")).find(a=>a.textContent==="HOT・月間候補")?.getAttribute("href")).toContain("period=7");
    expect(dialog.textContent).toContain("推移・連続記録");expect(dialog.textContent).toContain("年度別履歴");
  } finally { await act(async()=>root.unmount());element.remove(); }
});

function ScopedPlayer() {
  const location=useLocation();
  const value={...postseasonCapabilities,leagues:{...postseasonCapabilities.leagues,MLB:{...postseasonCapabilities.leagues.MLB,historical:{status:"available" as const,reason:null},historicalSeasons:[2020,2025]}}};
  return <HistoricalCompetitionContext.Provider value={historicalRouteCompetition(location.pathname,location.search)}><PostseasonAvailabilityContext.Provider value={{status:"ready",value,retry:()=>{}}}><MlbHistoricalPlayer manifest={manifest} favorites={[]} saving={false} toggle={()=>{}} /></PostseasonAvailabilityContext.Provider></HistoricalCompetitionContext.Provider>;
}
it("puts year/scope before identity and keeps section, tabs and URL synchronized after switching",async()=>{
  const element=document.createElement("div"),root=createRoot(element);document.body.append(element);
  try { await act(async()=>root.render(<MemoryRouter initialEntries={[`/MLB/players/${encodeURIComponent(id)}/analysis?season=2020&asOfDate=2020-08-01&period=7`]}><Location/><Routes><Route path="/MLB/players/:playerId/:section?" element={<ScopedPlayer/>}/></Routes></MemoryRouter>));
    const bar=element.querySelector(".player-context-bar")!,hero=element.querySelector(".player-identity")!;
    expect(bar.compareDocumentPosition(hero)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const select=bar.querySelectorAll("select")[0]!;
    await act(async()=>{select.value="2025";select.dispatchEvent(new Event("change",{bubbles:true}));});
    expect(element.querySelector("output")?.textContent).toContain("/analysis?season=2025&period=7");
    expect(element.querySelector(".player-identity")?.textContent).toContain("2025 MLB");
    for(const tab of element.querySelectorAll('.player-section-tabs a'))expect(tab.getAttribute("href")).toContain("season=2025");
    const scope=element.querySelector<HTMLSelectElement>('select[aria-label="集計対象"]')!;
    await act(async()=>{scope.value="postseason";scope.dispatchEvent(new Event("change",{bubbles:true}));});
    expect(element.querySelector("output")?.textContent).toContain("competition=postseason");
    expect(element.querySelector(".player-identity")?.textContent).toContain("ポストシーズン");
    for(const tab of element.querySelectorAll('.player-section-tabs a'))expect(tab.getAttribute("href")).toContain("competition=postseason");
  } finally { await act(async()=>root.unmount());element.remove(); }
});

it("pins the displayed default year when changing competition from a URL without season",async()=>{
  const element=document.createElement("div"),root=createRoot(element);document.body.append(element);
  try { await act(async()=>root.render(<MemoryRouter initialEntries={[`/MLB/players/${encodeURIComponent(id)}/stats`]}><Location/><Routes><Route path="/MLB/players/:playerId/:section?" element={<ScopedPlayer/>}/></Routes></MemoryRouter>));
    const scope=element.querySelector<HTMLSelectElement>('select[aria-label="集計対象"]')!;
    await act(async()=>{scope.value="postseason";scope.dispatchEvent(new Event("change",{bubbles:true}));});
    expect(element.querySelector("output")?.textContent).toContain("/stats?season=2025&competition=postseason");
    expect(element.querySelector(".player-identity")?.textContent).toContain("2025 MLB · ポストシーズン");
  } finally { await act(async()=>root.unmount());element.remove(); }
});

it.each(["regular","postseason"] as const)("recovers from a player profile absent in %s without browser Back",async missingScope=>{
  absent.scope=missingScope;
  const initialScope=missingScope==="regular"?"postseason":"regular";
  const element=document.createElement("div"),root=createRoot(element);document.body.append(element);
  try { await act(async()=>root.render(<MemoryRouter initialEntries={[`/MLB/players/${encodeURIComponent(id)}/analysis?season=2020${initialScope==="postseason"?"&competition=postseason":""}`]}><Location/><Routes><Route path="/MLB/players/:playerId/:section?" element={<ScopedPlayer/>}/></Routes></MemoryRouter>));
    await act(async()=>{const scope=element.querySelector<HTMLSelectElement>('select[aria-label="集計対象"]')!;scope.value=missingScope;scope.dispatchEvent(new Event("change",{bubbles:true}));});
    expect(element.textContent).toContain("選手が見つかりません");expect(element.querySelector('button[aria-label="選手の操作"]')).toBeNull();
    const scope=element.querySelector<HTMLSelectElement>('select[aria-label="集計対象"]')!;
    expect(scope.value).toBe(missingScope);expect(element.querySelector<HTMLSelectElement>('.player-context-controls select')?.value).toBe("2020");
    await act(async()=>{scope.value=initialScope;scope.dispatchEvent(new Event("change",{bubbles:true}));});
    expect(element.querySelector("output")?.textContent).toContain("/analysis?season=2020");expect(element.querySelector(".player-identity")?.textContent).toContain("大谷翔平");expect(element.textContent).not.toContain("選手が見つかりません");
  } finally {await act(async()=>root.unmount());element.remove();}
});
it.each(["error","loading"] as const)("retains scope recovery during profile %s",async status=>{
  absent.scope="postseason";absent.status=status;
  const element=document.createElement("div"),root=createRoot(element);document.body.append(element);
  try {await act(async()=>root.render(<MemoryRouter initialEntries={[`/MLB/players/${encodeURIComponent(id)}/stats?season=2020&competition=postseason`]}><Location/><Routes><Route path="/MLB/players/:playerId/:section?" element={<ScopedPlayer/>}/></Routes></MemoryRouter>));
    const scope=element.querySelector<HTMLSelectElement>('select[aria-label="集計対象"]')!;expect(scope.value).toBe("postseason");
    await act(async()=>{scope.value="regular";scope.dispatchEvent(new Event("change",{bubbles:true}));});
    expect(element.querySelector("output")?.textContent).toBe(`/MLB/players/${encodeURIComponent(id)}/stats?season=2020`);expect(element.querySelector(".player-identity")?.textContent).toContain("大谷翔平");
  } finally {await act(async()=>root.unmount());element.remove();}
});
