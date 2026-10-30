import { expect, it } from "vitest";
import { japanCompletedFixture } from "./fixtures/npb-japan-completed";
import { allJapanSeriesSources, appendReviewedJapanFinals, japanResultSource } from "../src/domain/npb-japan-series";
import { japanSeriesUpdateReport } from "../src/domain/npb-japan-series-update";

it("admits a compact completed table only with four reviewed wins and matching champion, retaining old conditional identities on append",()=>{
  const before=japanCompletedFixture(false,3).build(),fresh=japanCompletedFixture().build();
  expect(fresh.series.games).toHaveLength(4);expect(fresh.series).toMatchObject({clinched:true,winnerId:"npb:team:hawks",status:"complete"});
  const after=appendReviewedJapanFinals(before,fresh),report=japanSeriesUpdateReport(before,after);
  expect(after.results.slice(0,3)).toEqual(before.results);
  for(const g of before.series.games.slice(0,3)){expect(after.series.games.find(p=>p.gameId===g.gameId)).toEqual(g);expect(japanResultSource(after,g.gameId)).toEqual(japanResultSource(before,g.gameId));}
  expect(after.series.games.map(g=>g.gameId)).toEqual(before.series.games.map(g=>g.gameId));
  expect(after.series.games.slice(4).every(g=>g.status==="cancelled"&&g.homeRuns===null&&g.awayRuns===null&&g.winnerId===null)).toBe(true);
  expect(after.series.games.slice(4).map(g=>g.date)).toEqual(before.series.games.slice(4).map(g=>g.date));
  expect(allJapanSeriesSources(after)).toHaveLength(4);
  expect(report).toMatchObject({resultsBefore:3,resultsAfter:4,clinched:true,coverage:"partial",playerStats:"unavailable"});
  expect(report.addedResults.map(g=>g.gameNumber)).toEqual([4]);expect(report.scheduleChanges).toHaveLength(3);
});
it.each(["no champion","wrong champion","unplayed row","only three finals"])("holds a shortened table without complete independent evidence: %s",kind=>{
  const f=japanCompletedFixture(),p=f.archive.response.query.pages[1]!.revisions[0]!.slots.main;
  if(kind==="no champion")p.content=p.content.replace('優勝：福岡ソフトバンクホークス','優勝：');
  if(kind==="wrong champion")p.content=p.content.replace('優勝：福岡ソフトバンクホークス','優勝：横浜DeNAベイスターズ');
  if(kind==="unplayed row")p.content=p.content.replace('2 - 4','-');
  if(kind==="only three finals")f.review.games.pop();
  f.refresh();expect(()=>f.build()).toThrow();
});
it("does not silently delete an independently postponed game, or replace an old final/citation",()=>{
  const before=japanCompletedFixture(false,3).build(),fresh=japanCompletedFixture().build();
  before.series.games[4]!.status="postponed";expect(()=>appendReviewedJapanFinals(before,fresh)).toThrow("deletion");
  before.series.games[4]!.status="scheduled";before.results[0]!.durationMinutes++;
  expect(()=>appendReviewedJapanFinals(before,fresh)).toThrow("correction");
});
it("marks still-listed conditional dates unneeded after a verified clinch without inventing scores",()=>{
  const d=japanCompletedFixture(false).build();
  expect(d.series.clinched).toBe(true);expect(d.series.games.slice(4).map(g=>[g.status,g.awayRuns,g.homeRuns])).toEqual(Array.from({length:3},()=>["cancelled",null,null]));
});
