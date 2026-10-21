import {expect,it} from "vitest";
import {japanFixture} from "./fixtures/npb-japan-series";
import {buildWikipediaJapanSeries,japanGameId} from "../src/infrastructure/providers/wikipedia-npb-japan-series";
import {assertJapanSeriesAdvance,npbJapanSeriesSchema,type NpbJapanSeries} from "../src/domain/npb-japan-series";

// Explicitly synthetic future snapshots, never acquisition evidence or public data.
const bay="npb:team:baystars",hawks="npb:team:hawks";
const splitSeven=[bay,hawks,bay,hawks,bay,hawks,null];
function snapshot(outcomes:readonly (string|null)[]=splitSeven,total=outcomes.length){
  const f=japanFixture(),d=buildWikipediaJapanSeries(f.archive,f.cs,"b".repeat(64),f.admission);
  d.observedAt="2026-11-04T10:00:00Z";d.review={reviewedBy:"synthetic fixture",reviewedAt:d.observedAt};d.series.effectiveDate="2026-11-04";
  for(let n=8;n<=total;n++){
    const home=n===8?bay:hawks,away=home===bay?hawks:bay,gameId=japanGameId(n);
    d.series.games.push({gameId,gameNumber:n,date:`2026-11-${String(n===8?2:n-5).padStart(2,"0")}`,homeTeamId:home,awayTeamId:away,homeRuns:null,awayRuns:null,status:"scheduled",scheduledAt:null,winnerId:null});
    d.venues[gameId]=home===bay?"横浜スタジアム":"みずほPayPayドーム福岡";
  }
  outcomes.forEach((winner,i)=>{
    const g=d.series.games[i]!;g.status="final";g.winnerId=winner;g.homeRuns=winner===g.homeTeamId?1:0;g.awayRuns=winner===g.awayTeamId?1:0;
    const innings=winner===null?12:g.gameNumber>=8?13:9,awayInnings=Array<number>(innings).fill(0),homeInnings=Array<number>(innings).fill(0);
    awayInnings[g.gameNumber>=8?innings-1:0]=g.awayRuns;homeInnings[g.gameNumber>=8?innings-1:0]=g.homeRuns;
    d.results.push({gameId:g.gameId,awayInnings,homeInnings,durationMinutes:240,homeLastInning:winner===g.homeTeamId?(innings===9?"not_played":"walk_off"):"completed",sourcePageId:5306035,evidenceSha256:"f".repeat(64)});
  });
  for(const t of d.series.teams){t.playedWins=d.series.games.filter(g=>g.winnerId===t.teamId).length;t.seriesTotal=t.playedWins;}
  const winner=d.series.teams.find(t=>t.playedWins===4);d.series.clinched=!!winner;d.series.status=winner?"complete":"in_progress";d.series.winnerId=winner?.teamId??null;
  return d;
}
const valid=(d:NpbJapanSeries)=>npbJapanSeriesSchema.safeParse(d).success;

it("permits an explicitly scheduled eighth Game only after seven reviewed finals including a tie, without generating a result",()=>{
  const d=snapshot(splitSeven,8);expect(valid(d)).toBe(true);expect(d.series.teams.map(t=>t.playedWins)).toEqual([3,3]);
  expect(d.series.games[7]).toMatchObject({gameNumber:8,status:"scheduled",homeRuns:null,awayRuns:null,winnerId:null});expect(d.results).toHaveLength(7);
  const incomplete=structuredClone(d),g=incomplete.series.games[6]!;g.status="scheduled";g.homeRuns=null;g.awayRuns=null;incomplete.results=incomplete.results.filter(r=>r.gameId!==g.gameId);expect(valid(incomplete)).toBe(false);
  expect(valid(snapshot([],8))).toBe(false);
});
it("accepts independently recorded eighth/ninth finals beyond twelve innings and never adds a CS advantage",()=>{
  const eighth=snapshot([...splitSeven,bay]);expect(valid(eighth)).toBe(true);expect(eighth.series.winnerId).toBe(bay);expect(eighth.results[7]?.awayInnings).toHaveLength(13);
  const ninth=snapshot([bay,hawks,bay,hawks,bay,null,null,hawks,bay]);expect(valid(ninth)).toBe(true);expect(ninth.series.teams.map(t=>t.playedWins)).toEqual([4,3]);
  expect(ninth.series.teams.every(t=>t.advantageWins===0)).toBe(true);
  expect(()=>assertJapanSeriesAdvance(snapshot(splitSeven),eighth)).not.toThrow();
});
it("rejects additional finals or schedules after a four-win clinch",()=>{
  expect(valid(snapshot([bay,hawks,bay,hawks,bay,hawks,bay,hawks]))).toBe(false);
  expect(valid(snapshot([bay,hawks,bay,hawks,bay,hawks,bay],8))).toBe(false);
});
it("requires the eighth Game at the seventh Game's venue and a travel day before the ninth",()=>{
  const eighth=snapshot(splitSeven,8);eighth.venues[japanGameId(8)]="みずほPayPayドーム福岡";expect(valid(eighth)).toBe(false);
  const ninth=snapshot([bay,hawks,bay,hawks,bay,null,null,hawks,bay]);ninth.series.games[8]!.date="2026-11-03";expect(valid(ninth)).toBe(false);
});
it.each([8,9])("holds reversed home clubs or an unproved venue for extra Game %s",n=>{
  const before=n===8?splitSeven:[bay,hawks,bay,hawks,bay,null,null,hawks];
  const d=snapshot(before,n),g=d.series.games[n-1]!;expect(valid(d)).toBe(true);
  const reversed=structuredClone(d),r=reversed.series.games[n-1]!;[r.homeTeamId,r.awayTeamId]=[r.awayTeamId,r.homeTeamId];expect(valid(reversed)).toBe(false);
  d.venues[g.gameId]=n===8?"みずほPayPayドーム福岡":"横浜スタジアム";expect(valid(d)).toBe(false);
});
it("does not permit an innings-limit tie from the eighth Game onward",()=>{
  expect(valid(snapshot([...splitSeven,null]))).toBe(false);
  const d=snapshot([...splitSeven,bay]),g=d.series.games[7]!,r=d.results[7]!;
  g.homeRuns=0;g.awayRuns=0;g.winnerId=null;r.homeInnings.fill(0);r.awayInnings.fill(0);r.homeLastInning="completed";
  d.series.teams[0]!.playedWins=3;d.series.teams[0]!.seriesTotal=3;d.series.clinched=false;d.series.status="in_progress";d.series.winnerId=null;expect(valid(d)).toBe(false);
});
it("requires every completed inning before an extra inning to have remained tied",()=>{
  const d=snapshot([...splitSeven,bay]),r=d.results[7]!;r.homeInnings[0]=1;r.homeInnings[12]=0;r.homeLastInning="not_played";
  expect(valid(d)).toBe(false);
  const tie=snapshot(),t=tie.results[6]!;t.homeInnings[0]=1;t.awayInnings[11]=1;tie.series.games[6]!.homeRuns=1;tie.series.games[6]!.awayRuns=1;
  expect(valid(tie)).toBe(false);
});
it("preserves a postponed Game's identity through a reviewed reschedule and final readback",()=>{
  const before=snapshot([]),first=before.series.games[0]!;first.status="postponed";
  const moved=structuredClone(before);moved.series.games.forEach((g,i)=>{g.date=`2026-11-0${i+1}`;});
  moved.observedAt="2026-11-08T10:00:00Z";moved.review!.reviewedAt=moved.observedAt;moved.series.effectiveDate="2026-11-08";
  expect(valid(moved)).toBe(true);expect(()=>assertJapanSeriesAdvance(before,moved)).not.toThrow();
  const final=structuredClone(moved),g=final.series.games[0]!;g.status="final";g.homeRuns=1;g.awayRuns=0;g.winnerId=bay;
  final.series.teams[0]!.playedWins=1;final.series.teams[0]!.seriesTotal=1;
  final.results.push({gameId:g.gameId,awayInnings:Array<number>(9).fill(0),homeInnings:[1,0,0,0,0,0,0,0,0],durationMinutes:180,homeLastInning:"not_played",sourcePageId:5306035,evidenceSha256:"a".repeat(64)});
  expect(valid(final)).toBe(true);expect(()=>assertJapanSeriesAdvance(before,final)).not.toThrow();expect(npbJapanSeriesSchema.parse(JSON.parse(JSON.stringify(final)))).toEqual(final);
  const changed=structuredClone(final);changed.series.games[0]!.date="2026-10-31";expect(()=>assertJapanSeriesAdvance(final,changed)).toThrow("correction");
});
it.each(["same day","earlier day","suspended"])("holds unproven scheduling or forbidden suspension: %s",kind=>{
  const d=snapshot([]);if(kind==="same day")d.series.games[1]!.date=d.series.games[0]!.date;
  if(kind==="earlier day")d.series.games[1]!.date="2026-10-23";if(kind==="suspended")d.series.games[0]!.status="suspended";
  expect(valid(d)).toBe(false);
});
