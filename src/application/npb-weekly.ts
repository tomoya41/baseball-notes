import { calendarWeek,collectedWeeks,summarizeWeek,calendarMonth,collectedMonths,summarizeMonth,type WeeklyGame,type WeekCoverage } from "../domain/weekly-analysis";
import { readNpbJapanSeries } from "./npb-japan-series-reader";
import { readNpbCs } from "./npb-cs-reader";
import { gameManifestSchema,gameDateIndexSchema,shiftGameDate,type GameManifest,type GameDateIndex } from "../domain/npb-game-index";
import { npbTeamShortName } from "../presentation/npb-team-names";

export type NpbWeeklyStage="regular"|"npb_cs_first"|"npb_cs_final"|"japan_series";
type Surface={manifest():Promise<GameManifest>;date(date:string):Promise<GameDateIndex>};
export class NpbWeeklyRangeUnavailable extends Error {constructor(){super("Week outside saved NPB range");}}
export type NpbWeeklySources={cs:()=>ReturnType<typeof readNpbCs>;japanSeries:()=>ReturnType<typeof readNpbJapanSeries>};
export async function readNpbWeekly(stage:NpbWeeklyStage,date:string|undefined,surface:Surface,readers:NpbWeeklySources={cs:()=>readNpbCs(),japanSeries:()=>readNpbJapanSeries()},period:"week"|"month"="week") {
  const range=period==="month"?calendarMonth:calendarWeek,collected=period==="month"?collectedMonths:collectedWeeks;
  let games:WeeklyGame[]=[],weeks:string[],asOf:string,updatedAt:string,coverage:WeekCoverage="partial",previousCoverage:WeekCoverage="partial";
  let attribution:string,sources:{url:string;label:string}[]=[],names=new Map<string,string>();
  const missingResultDates:string[]=[];
  if(stage==="regular"){
    const manifest=gameManifestSchema.parse(await surface.manifest());
    const week=range(date??manifest.effectiveDate);weeks=collected(manifest.from,manifest.to);
    if(!weeks.includes(week.from))throw new NpbWeeklyRangeUnavailable();
    const days:GameDateIndex[]=[],expected:string[]=[];
    for(let d=week.previous.from;d<=week.to;d=shiftGameDate(d,1))if(d>=manifest.from&&d<=manifest.to)expected.push(d);
    for(let i=0;i<expected.length;i+=4)await Promise.all(expected.slice(i,i+4).map(async day=>{
      try{const p=gameDateIndexSchema.parse(await surface.date(day));if(p.date!==day)throw Error("NPB weekly date mismatch");days.push(p);}catch{/* A missing day stays partial; never synthesize no_games. */}
    }));
    if(!days.length)throw Error("NPB weekly results unavailable");
    days.sort((a,b)=>a.date.localeCompare(b.date));
    const covered=(from:string,to:string)=>{const selected=days.filter(d=>d.date>=from&&d.date<=to);return selected.length===Math.round((Date.parse(to)-Date.parse(from))/86400000)+1&&selected.every(d=>d.coverage==="no_games"?d.games.length===0:d.coverage==="complete"&&d.games.every(g=>g.status==="final"&&g.completeness==="complete"&&g.home.score!==null&&g.away.score!==null));};
    coverage=covered(week.from,week.to)?"complete":"partial";previousCoverage=covered(week.previous.from,week.previous.to)?"complete":"partial";
    for(const day of days)for(const g of day.games){names.set(g.home.id,g.home.name);names.set(g.away.id,g.away.name);
      if(g.status==="final"&&(g.home.score===null||g.away.score===null)){missingResultDates.push(g.date);continue;}
      games.push({id:g.gameId,date:g.date,homeId:g.home.id,awayId:g.away.id,homeRuns:g.home.score,awayRuns:g.away.score,status:g.status});}
    asOf=manifest.effectiveDate;updatedAt=[manifest.generatedAt,...days.map(d=>d.generatedAt)].sort()[0]!;
    attribution="nf3の保存済み公開試合データ。選手成績の週間評価とは別集計。";
  }else{
    const data=stage==="japan_series"?await readers.japanSeries():await readers.cs();
    updatedAt=data.observedAt;attribution="Wikipediaの収録済み試合結果を集計・表記整理。CC BY-SA 4.0。";
    sources=data.sources.map(s=>({url:`https://ja.wikipedia.org/w/index.php?curid=${s.pageId}&oldid=${s.revision}`,label:`Wikipedia「${s.title}」の執筆者`}));
    if("series" in data){games=data.series.games.map(g=>{const r=data.results.find(r=>r.gameId===g.gameId);return {id:g.gameId,date:g.date,homeId:g.homeTeamId,awayId:g.awayTeamId,homeRuns:g.homeRuns,awayRuns:g.awayRuns,status:g.status,
      ...(r?{innings:{away:r.awayInnings,home:r.homeInnings,...(r.homeLastInning?{homeLastInning:r.homeLastInning}:{})}}:{})};});}
    else games=data.games.filter(g=>g.stage===stage).map(g=>({id:g.id,date:g.date,homeId:g.homeTeamId,awayId:g.awayTeamId,homeRuns:g.homeScore,awayRuns:g.awayScore,status:g.status}));
    const dates=games.map(g=>g.date).sort();if(!dates.length)throw Error("No admitted games in this stage");
    weeks=collected(dates[0]!,dates.at(-1)!);asOf=games.filter(g=>g.status==="final").map(g=>g.date).sort().at(-1)??dates[0]!;
    names=new Map(games.flatMap(g=>[g.homeId,g.awayId]).map(id=>[id,npbTeamShortName(id)]));
  }
  const week=range(date??asOf);if(!weeks.includes(week.from))throw new NpbWeeklyRangeUnavailable();
  games.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const summary=(period==="month"?summarizeMonth:summarizeWeek)(games,week.from,names,{league:"NPB",season:2026,competition:stage==="regular"?"regular":"postseason",...(stage==="regular"?{}:{stage})},coverage,previousCoverage);
  const missingResults={current:missingResultDates.filter(d=>d>=week.from&&d<=week.to).length,previous:missingResultDates.filter(d=>d>=week.previous.from&&d<=week.previous.to).length};
  return {summary,weeks,asOf,updatedAt,attribution,sources,names,missingResults,playerEvaluation:"gate_closed" as const};
}
