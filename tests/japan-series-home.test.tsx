// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { afterEach, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { japanFixture, japanResultFixture } from "./fixtures/npb-japan-series";
import { buildWikipediaJapanSeries } from "../src/infrastructure/providers/wikipedia-npb-japan-series";
import { japanSeriesFeaturedPlayers, japanSeriesHomePeriod, japanSeriesHomeSummary } from "../src/presentation/japan-series-home";
import { JapanSeriesHomeContent, NpbJapanSeriesHome } from "../src/ui/npb-japan-series-home";
import { readNpbJapanSeries } from "../src/application/npb-japan-series-reader";
import { readNpbCs } from "../src/application/npb-cs-reader";
vi.mock("../src/application/npb-japan-series-reader",()=>({readNpbJapanSeries:vi.fn()}));
vi.mock("../src/application/npb-cs-reader",()=>({readNpbCs:vi.fn(()=>new Promise(()=>{}))}));
afterEach(()=>{vi.clearAllMocks();vi.unstubAllGlobals();});
const now=Date.parse("2026-10-25T00:05:00Z");
function finalData(){const f=japanResultFixture();return buildWikipediaJapanSeries(f.archive,f.cs,"b".repeat(64),f.admission,f.review,f.now);}
const html=(d:ReturnType<typeof finalData>)=>renderToStaticMarkup(<MemoryRouter><JapanSeriesHomeContent data={d} now={now}/></MemoryRouter>);
it("shows an admitted final before the next schedule, scopes every Game link and never invents starters or starts",()=>{
  const d=finalData(),s=html(d),m=japanSeriesHomeSummary(d,now);
  expect(m.latest?.gameNumber).toBe(1);expect(m.next?.gameNumber).toBe(2);expect(m.standingCompleteThroughLatest).toBe(true);
  expect(s.indexOf("japan-home-result")).toBeLessThan(s.indexOf("次の予定"));expect(s).toContain("1勝");expect(s).toContain("10/25 · 第2戦");
  expect(s).toContain("予告先発");expect(s).toContain("未収録");expect(s).toContain("開始時刻未収録");expect(s).not.toContain("18:00");
  expect(s).toContain("competition=postseason&amp;stage=japan_series");expect(s).toContain("https://npb.jp/announcement/starter/");
  expect(s).not.toContain('class="spotlight-card"');expect(s.match(/oldid=/g)).toHaveLength(2);
});
it("keeps Home readings closed and unfetched until requested, with dated photo navigation still reachable",async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
  const host=document.createElement('div'),root=createRoot(host);document.body.append(host);
  try {
    await act(async()=>root.render(<MemoryRouter><JapanSeriesHomeContent data={finalData()} now={now}/></MemoryRouter>));
    const details=host.querySelector<HTMLDetailsElement>('.japan-home-explore')!;
    expect(details.open).toBe(false);expect(readNpbCs).not.toHaveBeenCalled();expect(host.querySelector('.japan-home-players')).toBeNull();
    expect(host.querySelector('.japan-home-result')?.getAttribute('href')).toContain('stage=japan_series');
    await act(async()=>{details.open=true;details.dispatchEvent(new Event('toggle'));});
    expect(readNpbCs).toHaveBeenCalledOnce();expect(host.querySelectorAll('.japan-home-player-link')).toHaveLength(3);
    expect(host.textContent).toContain('2021年撮影');expect(host.textContent).toContain('2023年撮影');
    expect(host.querySelector('a[href="https://npb.jp/announcement/starter/"]')).not.toBeNull();
    await act(async()=>{details.open=false;details.dispatchEvent(new Event('toggle'));});
    expect(host.querySelector('.postseason-spotlight')).toBeNull();
  } finally {await act(async()=>root.unmount());host.remove();}
});
it("does not fabricate 0–0 standings, a next Game after a clinch, or a completed series from missing past results",()=>{
  const f=japanFixture(),d=buildWikipediaJapanSeries(f.archive,f.cs,"b".repeat(64),f.admission);
  expect(html(d)).toContain("シリーズ勝敗");expect(html(d)).not.toContain("0勝");expect(japanSeriesHomeSummary(d,Date.parse('2026-11-10')).next).toBeNull();
  const incomplete=finalData();incomplete.series.games[0]!.status="scheduled";incomplete.series.games[1]!.status="final";
  expect(japanSeriesHomeSummary(incomplete,now).standingCompleteThroughLatest).toBe(false);
  d.series.clinched=true;expect(japanSeriesHomeSummary(d,now).next).toBeNull();expect(html(d)).not.toContain('class="japan-home-starters"');
});
it("skips postponed/cancelled schedule rows and keeps a tie separate from played wins",()=>{
  const f=japanResultFixture("0",0,0,12),d=buildWikipediaJapanSeries(f.archive,f.cs,"b".repeat(64),f.admission,f.review,f.now);
  d.series.games[1]!.status="postponed";d.series.games[2]!.status="cancelled";
  expect(japanSeriesHomeSummary(d,now).next?.gameNumber).toBe(4);expect(d.series.teams.map(t=>t.playedWins)).toEqual([0,0]);
});
it("uses JST only for editorial prominence, including November dates, and independently verified photo identities",()=>{
  expect(japanSeriesHomePeriod(Date.parse('2026-10-23T14:59Z'))).toBe(false);expect(japanSeriesHomePeriod(Date.parse('2026-10-23T15:00Z'))).toBe(true);
  expect(japanSeriesHomePeriod(Date.parse('2026-11-01T00:00Z'))).toBe(true);expect(japanSeriesHomePeriod(Date.parse('2027-10-25T00:00Z'))).toBe(false);
  const identities=JSON.parse(readFileSync('src/data/npb-free-profile-identities.json','utf8'));
  for(const p of japanSeriesFeaturedPlayers)expect(identities.find((i:{playerId:string})=>i.playerId===p.id)).toMatchObject({teamId:p.teamId,verificationStatus:'source_verified'});
});
it("interprets exact reviewed bold and winner-color markup without accepting unknown team/attribute text",()=>{
  const f=japanResultFixture("0",0,1),pages=f.archive.response.query.pages;
  pages[1]!.revisions[0]!.slots.main.content=pages[1]!.revisions[0]!.slots.main.content.replace('||福岡ソフトバンクホークス|| 1 - 0 ||','||style="background:#FBC700; color:#000000;"|\'\'\'福岡ソフトバンクホークス\'\'\'|| \'\'\'1\'\'\' - 0 ||');
  pages[0]!.revisions[0]!.slots.main.content=pages[0]!.revisions[0]!.slots.main.content.replace('|Road=ソフトバンク',"|Road='''ソフトバンク'''");
  f.review.games[0]!.linescore=f.block.replace('|Road=ソフトバンク',"|Road='''ソフトバンク'''");
  const refresh=()=>{for(const p of pages)f.admission.find(a=>a.pageId===p.pageid)!.contentSha256=createHash('sha256').update(p.revisions[0]!.slots.main.content).digest('hex');};refresh();
  expect(buildWikipediaJapanSeries(f.archive,f.cs,'b'.repeat(64),f.admission,f.review,f.now).series.teams[1]!.playedWins).toBe(1);
  pages[1]!.revisions[0]!.slots.main.content=pages[1]!.revisions[0]!.slots.main.content.replace('background:#FBC700','unknown:#FBC700');refresh();
  expect(()=>buildWikipediaJapanSeries(f.archive,f.cs,'b'.repeat(64),f.admission,f.review,f.now)).toThrow('identity');
});
it("fetches only the bounded static reader and keeps a usable series destination on failure",async()=>{
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);vi.mocked(readNpbJapanSeries).mockRejectedValue(Error('unavailable'));
  const host=document.createElement('div'),root=createRoot(host);document.body.append(host);
  try{await act(async()=>root.render(<MemoryRouter><NpbJapanSeriesHome now={now}/></MemoryRouter>));expect(readNpbJapanSeries).toHaveBeenCalledTimes(1);expect(host.textContent).toContain('収録情報を読み込めません');expect(host.querySelector('a')!.getAttribute('href')).toContain('/NPB/postseason/series/');}
  finally{await act(async()=>root.unmount());host.remove();}
});
