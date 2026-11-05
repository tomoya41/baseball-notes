// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter,Routes,Route } from "react-router-dom";
import { afterEach,expect,it,vi } from "vitest";
import { japanCompletedFixture } from "./fixtures/npb-japan-completed";
import { japanSeriesRecap,japanGameNotRequired } from "../src/presentation/japan-series-recap";
import { appendReviewedJapanFinals } from "../src/domain/npb-japan-series";
import { JapanSeriesRecap } from "../src/ui/japan-series-recap";
import { NpbJapanSeriesScreen } from "../src/ui/npb-japan-series";
import { readNpbJapanSeries } from "../src/application/npb-japan-series-reader";
import { readNpbCs } from "../src/application/npb-cs-reader";
import { readNpbWeekly } from "../src/application/npb-weekly";
vi.mock("../src/application/npb-japan-series-reader",()=>({readNpbJapanSeries:vi.fn()}));
vi.mock("../src/application/npb-cs-reader",()=>({readNpbCs:vi.fn(()=>new Promise(()=>{}))}));
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals();});
const closed=()=>appendReviewedJapanFinals(japanCompletedFixture(false,3).build(),japanCompletedFixture().build());

it("counts all admitted finals, excludes unneeded dates and skips the unplayed bottom inning",()=>{
  const d=closed(),before=JSON.stringify(d),r=japanSeriesRecap(d)!;
  expect(r).toMatchObject({winnerId:"npb:team:hawks",games:4,wins:4,losses:0,ties:0,winnerRuns:7,opponentRuns:2,extraInningGames:0,oneRunGames:3,
    firstScore:{teamId:"npb:team:baystars",inning:1,half:"表",runs:2},turn:{teamId:"npb:team:hawks",inning:4,half:"裏",runs:3},following:[{inning:6,runs:1}]});
  expect(japanGameNotRequired(d,d.series.games[4]!)).toBe(true);expect(japanGameNotRequired(d,d.series.games[3]!)).toBe(false);
  expect(JSON.stringify(d)).toBe(before);
  const html=renderToStaticMarkup(<MemoryRouter><JapanSeriesRecap data={d}/></MemoryRouter>);
  expect(html).toContain("4連勝で日本一");expect(html).toContain("4回裏の3得点で逆転");expect(html).toContain("6回裏に1点");expect(html).toContain("個人成績は未収録");
  expect(html).not.toContain("先発");expect(html).not.toContain("MVP");expect(html).not.toContain("9回裏");
});
it("does not summarize an unfinished or gapped result set, or turn zero missing values into a championship",()=>{
  const d=closed();d.results.splice(1,1);expect(japanSeriesRecap(d)).toBeNull();
  const p=closed();p.series.games[1]!.status="scheduled";p.series.games[1]!.awayRuns=null;p.series.games[1]!.homeRuns=null;expect(japanSeriesRecap(p)).toBeNull();
  expect(japanSeriesRecap(japanCompletedFixture(false,3).build())).toBeNull();
});
it("separates an all-series recap from weekly/monthly aggregates and leaves NPB player evaluation gated",async()=>{
  const d=closed(),surface={manifest:vi.fn(),date:vi.fn()},sources={japanSeries:async()=>d,cs:vi.fn()};
  const week=await readNpbWeekly("japan_series","2026-10-28",surface,sources);
  expect(week.summary.games).toHaveLength(2);expect(week.summary.pending).toBe(0);expect(week.playerEvaluation).toBe("gate_closed");
  const month=await readNpbWeekly("japan_series","2026-10-28",surface,sources,"month");
  expect(month.summary.games).toHaveLength(4);expect(month.summary.pending).toBe(0);expect(month.summary.teams[0]).toMatchObject({wins:4,runsFor:7,runsAgainst:2});
  expect(month.summary.coverage).toBe("partial");expect(surface.manifest).not.toHaveBeenCalled();expect(surface.date).not.toHaveBeenCalled();
});
it("shows the recap and precise closed-game states on existing routes, without a future outlook or fabricated box score",async()=>{
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT",true);vi.mocked(readNpbJapanSeries).mockResolvedValue(closed());
  const host=document.createElement("div"),root=createRoot(host);document.body.append(host);
  try{
    await act(async()=>root.render(<MemoryRouter initialEntries={["/NPB/postseason?stage=japan_series"]}><Routes><Route path="/NPB/postseason" element={<NpbJapanSeriesScreen/>}/><Route path="/NPB/games/:gameId" element={<NpbJapanSeriesScreen gameDetail/>}/></Routes></MemoryRouter>));
    expect(host.querySelector(".series-recap")).not.toBeNull();expect(host.querySelectorAll('.scoreboard-row[aria-label$="開催不要"]')).toHaveLength(3);
    const csReads=vi.mocked(readNpbCs).mock.calls.length;
    const unneeded=host.querySelector<HTMLAnchorElement>('.scoreboard-row[aria-label$="開催不要"]')!;
    await act(async()=>unneeded.dispatchEvent(new MouseEvent("click",{bubbles:true,button:0,cancelable:true})));
    expect(host.textContent).toContain("開催不要となった試合");expect(host.textContent).toContain("当初予定");expect(host.querySelector("table")).toBeNull();expect(host.querySelector(".game-mvp")).toBeNull();
    expect(host.textContent).not.toContain("まだ収録していません");expect(host.textContent).not.toContain("0–0");expect(readNpbCs).toHaveBeenCalledTimes(csReads);
  }finally{await act(async()=>root.unmount());host.remove();}
});
