import { readHistoricalProduct } from "../infrastructure/providers/historical-product-reader";
import { formIndexSchema,formMonthSchema,formMonths,evaluateHistoricalForm,type FormCategory,type FormEntry } from "../domain/historical-form";
import { historicalChronologySchema } from "../domain/game-chronology";
import { historicalScheduleSchema,validStaticPayload } from "../domain/mlb-historical-public";
import { summarizeWeek,calendarWeek,calendarMonth,summarizeMonth,type WeeklyGame } from "../domain/weekly-analysis";
import { RETROSHEET_ATTRIBUTION } from "../data/source-registry";

export type WeeklyManifest={seasons:{season:number;firstDate:string;lastDate:string;games:number;coverage:string}[];teams:{id:string;name:string}[]};
export async function readMlbWeekly(manifest:WeeklyManifest,season:number,date:string,competition:"regular"|"postseason",read=readHistoricalProduct,period:"week"|"month"="week") {
  const descriptor=manifest.seasons.find(s=>s.season===season);if(!descriptor)throw Error("Weekly season unavailable");
  const monthly=period==="month",week=(monthly?calendarMonth:calendarWeek)(date);if(week.from>descriptor.lastDate||week.to<descriptor.firstDate)throw Error("Week outside saved season");
  const prefix=competition==="postseason"?"postseason/":"";
  const [rawIndex,rawChronology,directory]=await Promise.all([read<unknown>(`${prefix}exploration/form/${season}/index.json`),
    read<unknown>(`${prefix}chronology/${season}.json`),read<{players:{id:string;name:string;seasons:number[]}[]}>(`${prefix}players/index.json`)]);
  const index=formIndexSchema.parse(rawIndex),chronology=historicalChronologySchema.parse(rawChronology);
  const chronologyDates=chronology.games.map(g=>g.date).sort();
  if(!validStaticPayload(`${prefix}players/index.json`,directory)||index.season!==season||index.competitionType!==competition||chronology.season!==season||chronology.competitionType!==competition||
    index.gameCount!==descriptor.games||chronology.games.length!==descriptor.games||index.firstDate!==descriptor.firstDate||index.lastDate!==descriptor.lastDate||index.coverage!==descriptor.coverage||chronologyDates[0]!==index.firstDate||chronologyDates.at(-1)!==index.lastDate)throw Error("Weekly snapshot scope mismatch");
  const names=new Map(directory.players.filter(p=>p.seasons.includes(season)).map(p=>[p.id,p.name])),teamNames=new Map(manifest.teams.map(t=>[t.id,t.name]));
  const expected=chronology.games.filter(g=>g.date>=week.previous.from&&g.date<=week.to),dates=[...new Set(expected.map(g=>g.date))].sort();
  const games:WeeklyGame[]=[],incompleteDates=new Set<string>();
  // Explicit report only: <=14 weekly / <=62 monthly date files, four in flight.
  if(dates.length>(monthly?62:14))throw Error("Report date fetch budget exceeded");
  for(let i=0;i<dates.length;i+=4)await Promise.all(dates.slice(i,i+4).map(async day=>{
    const data=historicalScheduleSchema.parse(await read(`${prefix}schedule/${season}/${day}.json`));
    const ids=expected.filter(g=>g.date===day).map(g=>g.gameId).sort();
    if(data.date!==day||data.season!==season||JSON.stringify(data.games.map(g=>g.id).sort())!==JSON.stringify(ids))throw Error("Weekly schedule/chronology mismatch");
    for(const g of data.games){if(!g.complete)incompleteDates.add(day);games.push({id:g.id,date:day,homeId:g.homeTeamId,awayId:g.awayTeamId,homeRuns:g.homeRuns,awayRuns:g.awayRuns,status:g.status});}
  }));
  games.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const complete=(from:string,to:string)=>index.coverage==="complete"&&![...incompleteDates].some(d=>d>=from&&d<=to)&&from>=index.firstDate&&to<=index.lastDate;
  const covered=complete(week.from,week.to),priorCovered=complete(week.previous.from,week.previous.to);
  const summary=(monthly?summarizeMonth:summarizeWeek)(games,week.from,teamNames,{league:"MLB",season,competition},covered?"complete":"partial",priorCovered?"complete":"partial");
  const eligible=covered&&(!monthly||competition==="regular");
  const monthsNeeded=eligible?index.months.filter(m=>m.month>=week.previous.from.slice(0,7)&&m.month<=week.to.slice(0,7)):[];
  if(monthsNeeded.length>3)throw Error("Weekly form fetch budget exceeded");
  const months=await Promise.all(monthsNeeded.map(async m=>formMonthSchema.parse(await read(`${prefix}exploration/form/${season}/${m.month}.json`))));
  const hot={batting:[] as FormEntry[],starters:[] as FormEntry[],relievers:[] as FormEntry[]},rising=[] as (FormEntry&{category:FormCategory})[];
  if(eligible)for(const category of ["batting","starters","relievers"] as const){
    const needed=formMonths(index,week.to,7,monthly?"monthly":"hot"),recent=months.filter(m=>needed.includes(m.month));
    const result=evaluateHistoricalForm(index,recent,names,week.to,7,monthly?"monthly":"hot",category);
    hot[category]=result.entries.slice(0,3);
    if(priorCovered){const needed=formMonths(index,week.to,7,monthly?"monthly-change":"change");
      const change=evaluateHistoricalForm(index,months.filter(m=>needed.includes(m.month)),names,week.to,7,monthly?"monthly-change":"change",category);
      hot[category]=hot[category].map(e=>{const prior=change.entries.find(p=>p.playerId===e.playerId);return prior?{...e,previous:prior.previous,delta:prior.delta,change:prior.change,...(prior.previousSample!==undefined?{previousSample:prior.previousSample}:{})}:e;});
      rising.push(...change.entries.filter(e=>e.change==="rising").slice(0,2).map(e=>({...e,category})));}
  }
  return {summary,hot,rising,names:teamNames,sourceFingerprint:index.sourceFingerprint,asOf:descriptor.lastDate,
    attribution:RETROSHEET_ATTRIBUTION,fetches:3+dates.length+monthsNeeded.length,playerEvaluation:eligible?"available" as const:"incomplete_week" as const};
}
