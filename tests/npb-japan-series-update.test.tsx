// @vitest-environment jsdom
import {expect,it} from "vitest";
import {renderToStaticMarkup} from "react-dom/server";
import {MemoryRouter} from "react-router-dom";
import {buildWikipediaJapanSeries} from "../src/infrastructure/providers/wikipedia-npb-japan-series";
import {npbJapanSeriesSchema,type NpbJapanSeries} from "../src/domain/npb-japan-series";
import {japanSeriesUpdateReport} from "../src/domain/npb-japan-series-update";
import {japanSeriesHomeSummary} from "../src/presentation/japan-series-home";
import {JapanSeriesHomeContent} from "../src/ui/npb-japan-series-home";
import {japanResultFixture} from "./fixtures/npb-japan-series";
function initial(){const f=japanResultFixture("0",0,1);return buildWikipediaJapanSeries(f.archive,f.cs,"b".repeat(64),f.admission,f.review,f.now);}
/** Independent synthetic final; no fixture is bundled in the public app. */
function finish(d:NpbJapanSeries,index:number,tie=false){
  const g=d.series.games[index]!;g.status="final";g.awayRuns=tie?0:1;g.homeRuns=0;g.winnerId=tie?null:g.awayTeamId;
  const innings=tie?12:9;d.results.push({gameId:g.gameId,awayInnings:[g.awayRuns,...Array(innings-1).fill(0)],homeInnings:Array(innings).fill(0),durationMinutes:180,homeLastInning:"completed",sourcePageId:5306035,evidenceSha256:"d".repeat(64)});
  for(const t of d.series.teams){t.playedWins=d.series.games.filter(g=>g.winnerId===t.teamId).length;t.seriesTotal=t.playedWins;}
  const winner=d.series.teams.find(t=>t.playedWins===4);d.series.clinched=!!winner;d.series.winnerId=winner?.teamId??null;d.series.status=winner?"complete":"in_progress";
  d.observedAt=`${g.date}T12:00:00Z`;d.review!.reviewedAt=`${g.date}T12:01:00Z`;d.series.effectiveDate=g.date;
  return npbJapanSeriesSchema.parse(d);
}
const html=(d:NpbJapanSeries,now:number)=>renderToStaticMarkup(<MemoryRouter><JapanSeriesHomeContent data={d} now={now}/></MemoryRouter>);
it("switches the hero, standings and next Game together after a validated second final",()=>{
  const before=initial(),after=finish(structuredClone(before),1),now=Date.parse(after.observedAt);
  const diff=japanSeriesUpdateReport(before,after),summary=japanSeriesHomeSummary(after,now),s=html(after,now);
  expect(diff).toMatchObject({requiresPublication:true,resultsBefore:1,resultsAfter:2,canonicalWrites:0,sourceRequests:0});
  expect(diff.addedResults.map(g=>g.gameNumber)).toEqual([2]);expect(diff.scheduleChanges).toEqual([]);
  expect(summary.latest?.gameNumber).toBe(2);expect(summary.next?.gameNumber).toBe(3);expect(summary.standingCompleteThroughLatest).toBe(true);
  expect(s).toContain('第2戦');expect(s).toContain('2勝');expect(s).toContain('10/27');expect(s).not.toContain('第1戦 · 終了');expect(before.results).toHaveLength(1);
});
it("does not request a result release for timestamp/source-only changes or idempotent replay",()=>{
  const before=initial(),after=structuredClone(before);after.observedAt="2026-10-25T01:00:00Z";after.review!.reviewedAt="2026-10-25T01:01:00Z";after.sources[0]!.revision++;
  expect(japanSeriesUpdateReport(before,after)).toMatchObject({requiresPublication:false,addedResults:[],scheduleChanges:[]});
  expect(japanSeriesUpdateReport(before,before).requiresPublication).toBe(false);
});
it("rejects corrections, deletions, identity changes and source regression before publication",()=>{
  const before=initial();
  const changed=structuredClone(before);changed.results[0]!.durationMinutes++;expect(()=>japanSeriesUpdateReport(before,changed)).toThrow('correction');
  const missing=structuredClone(before);missing.series.games.shift();delete missing.venues[before.series.games[0]!.gameId];missing.results=[];expect(()=>japanSeriesUpdateReport(before,missing)).toThrow();
  const identity=structuredClone(before);identity.series.id+='x';expect(()=>japanSeriesUpdateReport(before,identity)).toThrow();
  for(const edit of [(d:NpbJapanSeries)=>d.sources[0]!.revision--,(d:NpbJapanSeries)=>{d.sources[0]!.contentSha256='e'.repeat(64);}]){
    const d=structuredClone(before);edit(d);expect(()=>japanSeriesUpdateReport(before,d)).toThrow('source regression');
  }
});
it("keeps ties distinct from wins and shows overdue unrecorded results without guessing a final",()=>{
  const d=finish(initial(),1,true),now=Date.parse('2026-10-26T03:00:00Z');
  expect(html(d,now)).toContain('引き分け');expect(html(d,now)).toContain('1分');expect(d.series.teams.map(t=>t.playedWins)).toEqual([0,1]);
  const pending=initial(),s=japanSeriesHomeSummary(pending,now);expect(s.awaitingResult?.gameNumber).toBe(2);expect(s.next?.gameNumber).toBe(3);
  expect(html(pending,now)).toContain('第2戦 · 結果未収録');expect(pending.series.games[1]!.awayRuns).toBeNull();
  pending.series.games[1]!.status='postponed';expect(japanSeriesHomeSummary(pending,now).awaitingResult).toBeNull();
});
it("shows a confirmed champion without next-game or probable-starter claims",()=>{
  let d=initial();for(let i=1;i<7;i++)d=finish(d,i);
  expect(d.series.clinched).toBe(true);const s=html(d,Date.parse(d.observedAt));expect(s).toContain('ソフトバンク 優勝');expect(s).not.toContain('次の収録予定');expect(s).not.toContain('class="japan-home-starters"');expect(japanSeriesHomeSummary(d,Date.parse(d.observedAt)).next).toBeNull();
});
it("reports explicit postponements separately from confirmed results",()=>{
  const before=initial(),after=structuredClone(before);after.series.games[1]!.status="postponed";
  expect(japanSeriesUpdateReport(before,after)).toMatchObject({requiresPublication:true,addedResults:[],scheduleChanges:[{gameId:after.series.games[1]!.gameId,status:"postponed"}],resultsBefore:1,resultsAfter:1});
});
