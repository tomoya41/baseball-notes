// @vitest-environment jsdom
import { act } from "react";
import { createRoot,type Root } from "react-dom/client";
import { MemoryRouter,useLocation } from "react-router-dom";
import { beforeEach,afterEach,it,expect,vi } from "vitest";
import { MlbWeeklyScreen,NpbWeeklyScreen } from "../src/ui/weekly-analysis";
import { MonthlyScreen } from "../src/ui/monthly-analysis";
import { HistoricalCompetitionContext,historicalRouteCompetition } from "../src/ui/historical-competition-context";

it("passes a monthly Postseason URL through the production route's competition resolver",async()=>{
 const f=weeklyFixture("postseason"),original=await vi.importActual<typeof import("../src/application/mlb-weekly")>("../src/application/mlb-weekly");
 state.mlb.mockResolvedValue(await original.readMlbWeekly(f.manifest,2025,"2025-09-01","postseason",f.read,"month"));
 function Route(){const location=useLocation();return <HistoricalCompetitionContext.Provider value={historicalRouteCompetition(location.pathname,location.search)}><MonthlyScreen league="MLB" manifest={f.manifest}/></HistoricalCompetitionContext.Provider>;}
 await act(async()=>root.render(<MemoryRouter initialEntries={["/MLB/monthly?season=2025&month=2025-09&competition=postseason"]}><Route/></MemoryRouter>));
 expect(state.mlb.mock.calls[0]?.[3]).toBe("postseason");expect(container.textContent).toContain("ポストシーズン");expect(container.textContent).not.toContain("月間の打者");
 const select=container.querySelector<HTMLSelectElement>('select[aria-label="集計対象"]')!;
 await act(async()=>{select.value="regular";select.dispatchEvent(new Event("change",{bubbles:true}));});
 expect(state.mlb.mock.calls.at(-1)?.[3]).toBe("regular");expect(state.mlb.mock.calls.at(-1)?.[2]).toBe(f.manifest.seasons[0]!.lastDate);
});

it("renders real calendar-month totals and never labels them weekly or calls Current MLB",async()=>{
 const f=weeklyFixture(),original=await vi.importActual<typeof import("../src/application/mlb-weekly")>("../src/application/mlb-weekly");
 state.mlb.mockResolvedValue(await original.readMlbWeekly(f.manifest,2025,"2025-09-01","regular",f.read,"month"));
 await act(async()=>root.render(<MemoryRouter initialEntries={["/MLB/monthly?season=2025&month=2025-09"]}><MonthlyScreen league="MLB" manifest={f.manifest}/></MemoryRouter>));
 expect(container.textContent).toContain("2025-09-01〜2025-09-30");expect(container.textContent).toContain("月間の打者");expect(container.textContent).not.toContain("この週のハイライト");expect(container.textContent).not.toContain("前$");
 expect(container.querySelector('.weekly-rising a')?.getAttribute("href")).toContain("mode=monthly&");expect(container.querySelector('.weekly-rising a')?.getAttribute("href")).not.toContain("monthly-change");
 expect(state.mlb.mock.calls[0]?.[5]).toBe("month");state.mlb.mockClear();
 await act(async()=>root.render(<MemoryRouter key="invalid-month" initialEntries={["/MLB/monthly?season=2026"]}><MonthlyScreen league="MLB" manifest={f.manifest}/></MemoryRouter>));
 expect(state.mlb).not.toHaveBeenCalled();expect(container.textContent).toContain("未収録");
});
import { weeklyFixture } from "./fixtures/weekly-analysis";
import type { Services } from "../src/app/services";
const state=vi.hoisted(()=>({mlb:vi.fn(),npb:vi.fn()}));
vi.mock("../src/application/mlb-weekly",async original=>({...await original<object>(),readMlbWeekly:(...args:unknown[])=>state.mlb(...args)}));
vi.mock("../src/application/npb-weekly",()=>({readNpbWeekly:(...args:unknown[])=>state.npb(...args)}));
let root:Root,container:HTMLDivElement;
beforeEach(()=>{vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);state.mlb.mockReset();state.npb.mockReset();container=document.createElement("div");document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();vi.unstubAllGlobals();});
it("shows real week, categories, samples and scoped player/game links with details closed",async()=>{
  const f=weeklyFixture(),original=await vi.importActual<typeof import("../src/application/mlb-weekly")>("../src/application/mlb-weekly"),report=await original.readMlbWeekly(f.manifest,2025,"2025-09-22","regular",f.read);
  state.mlb.mockResolvedValue(report);
  await act(async()=>root.render(<MemoryRouter initialEntries={["/MLB/weekly?season=2025&week=2025-09-22"]}><MlbWeeklyScreen manifest={f.manifest}/></MemoryRouter>));
  expect(container.textContent).toContain("2025-09-22〜2025-09-28");expect(container.textContent).toContain("HOT打者");expect(container.textContent).toContain("28");
  expect(container.querySelectorAll(".weekly-hot li")).toHaveLength(3);expect(container.querySelector<HTMLDetailsElement>(".weekly-method")?.open).toBe(false);
  expect([...container.querySelectorAll("a")].some(a=>a.href.includes("asOfDate=2025-09-28")&&a.href.includes(encodeURIComponent(f.ids[0]!)))).toBe(true);
  expect(container.querySelector("select[aria-label='対象週（月曜〜日曜）']")).not.toBeNull();
  expect(container.querySelector(".weekly-hot a button")).toBeNull();
});
it("rejects a contradictory NPB competition without reading or relabeling data",async()=>{
  await act(async()=>root.render(<MemoryRouter initialEntries={["/NPB/weekly?stage=japan_series&competition=regular"]}><NpbWeeklyScreen services={{gameSurface:{} as Services["gameSurface"]}}/></MemoryRouter>));
  expect(state.npb).not.toHaveBeenCalled();expect(container.textContent).toContain("この条件は未対応");
});
it("switches both NPB stage directions from explicitly scoped shared URLs",async()=>{
  state.npb.mockRejectedValue(new Error("Unavailable fixture source"));
  await act(async()=>root.render(<MemoryRouter initialEntries={["/NPB/weekly?stage=japan_series&competition=postseason&season=2026&week=2026-10-19"]}><NpbWeeklyScreen services={{gameSurface:{} as Services["gameSurface"]}}/></MemoryRouter>));
  const select=container.querySelector<HTMLSelectElement>('select[aria-label="集計対象"]')!;
  await act(async()=>{select.value="regular";select.dispatchEvent(new Event("change",{bubbles:true}));});
  expect(state.npb.mock.calls.at(-1)?.slice(0,2)).toEqual(["regular",undefined]);
  await act(async()=>{select.value="npb_cs_first";select.dispatchEvent(new Event("change",{bubbles:true}));});
  expect(state.npb.mock.calls.at(-1)?.slice(0,2)).toEqual(["npb_cs_first",undefined]);
  expect(state.npb).toHaveBeenCalledTimes(3);expect(container.textContent).not.toContain("この条件は未対応");
});
it("does not request MLB Current or display old results under an invalid selection",async()=>{
  const f=weeklyFixture();await act(async()=>root.render(<MemoryRouter initialEntries={["/MLB/weekly?season=2026"]}><MlbWeeklyScreen manifest={f.manifest}/></MemoryRouter>));
  expect(state.mlb).not.toHaveBeenCalled();expect(container.textContent).toContain("未収録");
});
it("explains a boundary week's held evaluation without claiming no players qualified",async()=>{
  const f=weeklyFixture(),original=await vi.importActual<typeof import("../src/application/mlb-weekly")>("../src/application/mlb-weekly"),report=await original.readMlbWeekly(f.manifest,2025,"2025-09-29","regular",f.read);
  state.mlb.mockResolvedValue(report);
  await act(async()=>root.render(<MemoryRouter initialEntries={["/MLB/weekly?season=2025&week=2025-09-29"]}><MlbWeeklyScreen manifest={f.manifest}/></MemoryRouter>));
  expect(container.textContent).toContain("シーズンの端を含む週");expect(container.textContent).toContain("選手評価は保留");
  expect(container.querySelectorAll(".weekly-hot")).toHaveLength(0);expect(container.textContent).not.toContain("上昇基準を満たす選手はいません");
});
it("retains Postseason in analysis links and keeps missing NPB player stats off the page",async()=>{
  const f=weeklyFixture("postseason"),original=await vi.importActual<typeof import("../src/application/mlb-weekly")>("../src/application/mlb-weekly"),report=await original.readMlbWeekly(f.manifest,2025,"2025-09-22","postseason",f.read);
  state.mlb.mockResolvedValue(report);await act(async()=>root.render(<MemoryRouter initialEntries={["/MLB/weekly?season=2025&competition=postseason&week=2025-09-22"]}><HistoricalCompetitionContext.Provider value="postseason"><MlbWeeklyScreen manifest={f.manifest}/></HistoricalCompetitionContext.Provider></MemoryRouter>));
  expect(container.querySelector(".weekly-hot a")?.getAttribute("href")).toContain("competition=postseason");
  state.npb.mockResolvedValue({summary:{...report.summary,scope:{league:"NPB",season:2026,competition:"postseason",stage:"japan_series"},coverage:"partial",games:[],highlights:[],teams:[]},weeks:["2025-09-22"],names:new Map(),asOf:"2026-10-24",updatedAt:"2026-10-25T00:00:00Z",attribution:"Wikipedia CC BY-SA",sources:[],missingResults:{current:1,previous:1},playerEvaluation:"gate_closed"});
  await act(async()=>root.render(<MemoryRouter key="npb" initialEntries={["/NPB/weekly?stage=japan_series"]}><NpbWeeklyScreen services={{gameSurface:{} as Services["gameSurface"]}}/></MemoryRouter>));
  expect(container.querySelectorAll(".weekly-hot")).toHaveLength(0);expect(container.textContent).toContain("未公開");expect(container.textContent).toContain("終了結果は未収録");expect(container.textContent).toContain("この週 1試合・前週 1試合");
});
