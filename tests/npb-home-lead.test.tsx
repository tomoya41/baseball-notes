// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { Services } from "../src/app/services";
import type { Favorite } from "../src/domain/models";
import { NpbHome } from "../src/ui/npb-product";
import { NpbHomeLead } from "../src/ui/npb-home-lead";
import { readNpbJapanSeries } from "../src/application/npb-japan-series-reader";
import { readNpbPlayerEvents } from "../src/application/npb-player-events-reader";
import { eventFixture } from "./fixtures/npb-player-events";
import { japanResultFixture } from "./fixtures/npb-japan-series";
import { buildWikipediaJapanSeries } from "../src/infrastructure/providers/wikipedia-npb-japan-series";
vi.mock("../src/application/npb-japan-series-reader",()=>({readNpbJapanSeries:vi.fn()}));
vi.mock("../src/application/npb-player-events-reader",()=>({readNpbPlayerEvents:vi.fn()}));
vi.mock("../src/ui/daily-dashboard",()=>({NpbSavedGames:()=> <p data-saved-games>保存済み試合</p>,NpbToday:()=> <p>フォローの試合</p>,NpbPersonalDashboard:()=>null}));
vi.mock("../src/ui/npb-my",()=>({NpbSavedPlayers:()=>null}));
vi.mock("../src/ui/npb-hot",()=>({NpbHotSection:()=> <p>HOT未公開</p>}));
vi.mock("../src/ui/signature",()=>({HomeDiscover:()=>null,HomeSearchEntry:()=> <p>選手を探す</p>,TeamRecord:()=>null}));
vi.mock("../src/ui/data-explorer",()=>({ExplorerLinks:()=>null}));

const now = Date.parse("2026-10-30T03:00:00Z");
function series() { const f = japanResultFixture(); return buildWikipediaJapanSeries(f.archive,f.cs,"b".repeat(64),f.admission,f.review,f.now); }
function events() { const d=eventFixture();d.observedAt="2026-10-29T23:56:00Z";d.events[0]!.recordedDate="2026-10-29";return d; }
let root: Root, host: HTMLDivElement;
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.spyOn(Date,"now").mockReturnValue(now);host=document.createElement("div");document.body.append(host);root=createRoot(host);vi.mocked(readNpbJapanSeries).mockResolvedValue(series());vi.mocked(readNpbPlayerEvents).mockResolvedValue(events());});
afterEach(async()=>{await act(async()=>root.unmount());host.remove();vi.restoreAllMocks();vi.clearAllMocks();vi.unstubAllGlobals();});
const toggle=async(el:HTMLDetailsElement)=>act(async()=>{el.open=!el.open;el.dispatchEvent(new Event("toggle"));});
const click=async(el:HTMLElement)=>act(async()=>el.click());
const select=async(value:string)=>act(async()=>{const el=host.querySelector("select")!;el.value=value;el.dispatchEvent(new Event("change",{bubbles:true}));});
function Location(){const l=useLocation();return <output>{l.search}</output>;}
const services={hot:{},standings:{findLatestNpb:async()=>null}} as unknown as Services;
const home=(url="/NPB/home?season=2026")=><MemoryRouter initialEntries={[url]}><NpbHome services={services} favorites={[]} toggle={()=>{}} saving={false}/><Location/></MemoryRouter>;

it("uses bounded fresh records ahead of the archived series and lazily keeps regular results, source credits and destinations",async()=>{
  await act(async()=>root.render(home()));
  expect(host.querySelector("[data-home-focus]")?.getAttribute("data-home-focus")).toBe("moves");
  expect(host.querySelector("[data-saved-games]")).toBeNull();
  expect(host.querySelector(".japan-home-result")).toBeNull();
  expect(host.querySelector(".player-row")?.getAttribute("href")).toBe(`/NPB/moves?player=${events().players[0]!.playerId}`);
  expect(host.querySelector('a[href*="oldid="]')).not.toBeNull();
  expect(host.querySelector('a[href="https://creativecommons.org/licenses/by-sa/4.0/"]')).not.toBeNull();
  expect(host.querySelector('a[href="/NPB/moves?kind=contract_renewal"]')?.textContent).toContain("未収録");
  const saved=Array.from(host.querySelectorAll("details")).find(d=>d.querySelector("summary")?.textContent==="公式戦の保存済み結果")!;
  await toggle(saved);expect(host.querySelector("[data-saved-games]")).not.toBeNull();
  await toggle(host.querySelector("[data-japan-home-archive]")!);
  expect(host.querySelector(".japan-home-result")?.getAttribute("href")).toContain("stage=japan_series");
  expect(host.querySelector(".japan-home-heading h2")).not.toBeNull();
  expect(host.textContent).toContain("結果未収録");
  expect(host.textContent).toContain("HOT未公開");
  expect(readNpbJapanSeries).toHaveBeenCalledOnce();expect(readNpbPlayerEvents).toHaveBeenCalledOnce();
});
it("honors explicit viewing mode in the URL, preserves other queries and prevents the series from taking over follow/standings",async()=>{
  await act(async()=>root.render(home()));
  await select("regular");expect(host.querySelector("output")?.textContent).toBe("?season=2026&homeSeason=regular");
  expect(host.querySelector("[data-home-focus]")).toBeNull();expect(host.querySelector("[data-saved-games]")).not.toBeNull();
  await select("auto");expect(host.querySelector("output")?.textContent).toBe("?season=2026");
  const button=(label:string)=>Array.from(host.querySelectorAll<HTMLButtonElement>(".home-mode-nav button")).find(b=>b.textContent===label)!;
  await click(button("フォロー"));expect(host.querySelector("[data-home-focus]")).toBeNull();expect(host.textContent).toContain("フォローの試合");
  await click(button("順位表"));expect(host.querySelector("[data-home-focus]")).toBeNull();expect(host.textContent).toContain("ペナントレース");
  await click(button("トップ"));expect(host.querySelector("[data-home-focus]")?.getAttribute("data-home-focus")).toBe("moves");
  expect(readNpbJapanSeries).toHaveBeenCalledOnce();expect(readNpbPlayerEvents).toHaveBeenCalledOnce();
});
it("skips unrelated static payloads in spring and regular, and does not load anything for a hidden lead",async()=>{
  const render=async(requested:string,visible=true)=>act(async()=>root.render(<MemoryRouter><NpbHomeLead now={now} requested={requested} visible={visible} favorites={[]}/></MemoryRouter>));
  await render("regular");await render("spring");await render("winter",false);
  expect(readNpbJapanSeries).not.toHaveBeenCalled();expect(readNpbPlayerEvents).not.toHaveBeenCalled();
  await render("winter");expect(readNpbPlayerEvents).toHaveBeenCalledOnce();
});
it("keeps independent movement content if the series fails and gives a safe retry when neither source loads",async()=>{
  vi.mocked(readNpbJapanSeries).mockRejectedValue(Error("unavailable"));
  vi.mocked(readNpbPlayerEvents).mockRejectedValueOnce(Error("unavailable"));
  await act(async()=>root.render(home()));
  expect(host.querySelector('[role="status"]')?.textContent).toContain("読み込めません");
  expect(host.textContent).not.toContain("試合なし");
  await click(host.querySelector('[role="status"] button')!);
  expect(host.querySelector("[data-home-focus]")?.getAttribute("data-home-focus")).toBe("moves");
  expect(readNpbPlayerEvents).toHaveBeenCalledTimes(2);
});
it("personalizes from saved UUIDs without treating photos or a text name as evidence",async()=>{
  const d=events(),p={...d.players[0]!,playerId:"22222222-2222-4222-8222-222222222222",name:"架空次郎"};
  d.players.push(p);d.events.push({...d.events[0]!,id:"second",playerId:p.playerId,recordedDate:"2026-10-28"});vi.mocked(readNpbPlayerEvents).mockResolvedValue(d);
  const favorites=[{league:"NPB",kind:"player",entityId:p.playerId}] as Favorite[];
  await act(async()=>root.render(<MemoryRouter><NpbHomeLead now={now} requested="winter" visible favorites={favorites}/></MemoryRouter>));
  expect(host.querySelector(".player-row strong")?.textContent).toBe(p.name);
  expect(host.querySelector(".player-row small")?.textContent).toContain("フォロー");
});
