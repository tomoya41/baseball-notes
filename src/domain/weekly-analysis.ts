import { z } from "zod";
import { shiftGameDate } from "./npb-game-index";

export type WeeklyScope={league:"MLB"|"NPB";season:number;competition:"regular"|"postseason";stage?:string};
export type WeeklyGame={id:string;date:string;homeId:string;awayId:string;homeRuns:number|null;awayRuns:number|null;
  status:"final"|"scheduled"|"unknown"|"postponed"|"canceled"|"cancelled"|"suspended"|"in_progress";innings?:{away:number[];home:number[];homeLastInning?:string}};
export type WeekCoverage="complete"|"partial"|"unavailable";
export function calendarWeek(date:string) {
  z.iso.date().parse(date);
  const day=new Date(`${date}T00:00:00Z`).getUTCDay(),from=shiftGameDate(date,-((day+6)%7));
  return {from,to:shiftGameDate(from,6),previous:{from:shiftGameDate(from,-7),to:shiftGameDate(from,-1)}};
}
export function calendarMonth(date:string) {
  z.iso.date().parse(date);
  const from=`${date.slice(0,7)}-01`,last=new Date(`${from}T00:00:00Z`);
  last.setUTCMonth(last.getUTCMonth()+1);last.setUTCDate(0);
  const previousTo=shiftGameDate(from,-1);
  return {from,to:last.toISOString().slice(0,10),previous:{from:`${previousTo.slice(0,7)}-01`,to:previousTo}};
}
export function collectedMonths(first:string,last:string) {
  collectedWeeks(first,last);
  const rows:string[]=[];
  for(let date=calendarMonth(first).from;date<=last;date=shiftGameDate(calendarMonth(date).to,1))rows.push(date);
  return rows;
}
export function collectedWeeks(first:string,last:string) {
  z.iso.date().parse(first);z.iso.date().parse(last);
  if(first>last||Date.parse(last)-Date.parse(first)>370*86400000)throw Error("Invalid weekly saved range");
  const rows:string[]=[];for(let date=calendarWeek(first).from;date<=last;date=shiftGameDate(date,7))rows.push(date);
  return rows;
}
export type WeekTeam={teamId:string;name:string;games:number;wins:number;losses:number;ties:number;runsFor:number;runsAgainst:number;runsPerGame:number;
  previous:{games:number;runsPerGame:number|null}|null};
export function summarizeWeek(games:readonly WeeklyGame[],date:string,names:ReadonlyMap<string,string>,scope:WeeklyScope,
  coverage:WeekCoverage,previousCoverage:WeekCoverage) {
  return summarizeRange(games,calendarWeek(date),names,scope,coverage,previousCoverage);
}
export function summarizeMonth(games:readonly WeeklyGame[],date:string,names:ReadonlyMap<string,string>,scope:WeeklyScope,
  coverage:WeekCoverage,previousCoverage:WeekCoverage) {
  return summarizeRange(games,calendarMonth(date),names,scope,coverage,previousCoverage);
}
function summarizeRange(games:readonly WeeklyGame[],week:ReturnType<typeof calendarWeek>,names:ReadonlyMap<string,string>,scope:WeeklyScope,
  coverage:WeekCoverage,previousCoverage:WeekCoverage) {
  const prefix=scope.league.toLowerCase(),seen=new Set<string>();
  for(const g of games){
    z.iso.date().parse(g.date);
    if(!g.id.startsWith(`${prefix}:game:`)||!g.homeId.startsWith(`${prefix}:team:`)||!g.awayId.startsWith(`${prefix}:team:`)||g.homeId===g.awayId||
      !names.has(g.homeId)||!names.has(g.awayId)||seen.has(g.id)||Number(g.date.slice(0,4))!==scope.season||
      [g.homeRuns,g.awayRuns].some(n=>n!==null&&(!Number.isSafeInteger(n)||n<0))||g.status==="final"&&(g.homeRuns===null||g.awayRuns===null))throw Error("Invalid weekly Game identity/result");
    if(g.innings&&(g.status!=="final"||g.innings.away.length!==g.innings.home.length||g.innings.away.some(n=>!Number.isInteger(n)||n<0)||g.innings.home.some(n=>!Number.isInteger(n)||n<0)||
      g.innings.away.reduce((a,b)=>a+b,0)!==g.awayRuns||g.innings.home.reduce((a,b)=>a+b,0)!==g.homeRuns))throw Error("Invalid weekly inning evidence");
    seen.add(g.id);
  }
  const finals=(from:string,to:string)=>games.filter(g=>g.date>=from&&g.date<=to&&g.status==="final");
  const current=finals(week.from,week.to),previous=finals(week.previous.from,week.previous.to);
  const teamTotals=(rows:WeeklyGame[])=>{const map=new Map<string,Omit<WeekTeam,"previous">>();
    for(const g of rows)for(const home of [false,true]){const id=home?g.homeId:g.awayId,rf=(home?g.homeRuns:g.awayRuns)!,ra=(home?g.awayRuns:g.homeRuns)!;
      const t=map.get(id)??{teamId:id,name:names.get(id)!,games:0,wins:0,losses:0,ties:0,runsFor:0,runsAgainst:0,runsPerGame:0};
      t.games++;t.wins+=Number(rf>ra);t.losses+=Number(rf<ra);t.ties+=Number(rf===ra);t.runsFor+=rf;t.runsAgainst+=ra;t.runsPerGame=t.runsFor/t.games;map.set(id,t);}
    return map;};
  const prior=teamTotals(previous),teams=[...teamTotals(current).values()].map(t=>({...t,previous:coverage==="complete"&&previousCoverage==="complete"?
    {games:prior.get(t.teamId)?.games??0,runsPerGame:prior.get(t.teamId)?.runsPerGame??null}:null})).sort((a,b)=>b.wins-a.wins||b.runsFor-a.runsFor||a.teamId.localeCompare(b.teamId));
  const close=current.filter(g=>Math.abs(g.homeRuns!-g.awayRuns!)<=1),big=current.filter(g=>Math.max(g.homeRuns!,g.awayRuns!)>=10);
  const highlights=[...new Map([...close.slice().sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id)).slice(0,2),
    ...big.slice().sort((a,b)=>(b.homeRuns!+b.awayRuns!)-(a.homeRuns!+a.awayRuns!)||a.id.localeCompare(b.id)).slice(0,2)].map(g=>[g.id,g])).values()].slice(0,3);
  const innings=current.flatMap(g=>g.innings?[...g.innings.away.map((runs,i)=>({gameId:g.id,teamId:g.awayId,inning:i+1,half:"表" as const,runs})),
    ...g.innings.home.flatMap((runs,i)=>i===g.innings!.home.length-1&&g.innings!.homeLastInning==="not_played"?[]:[{gameId:g.id,teamId:g.homeId,inning:i+1,half:"裏" as const,runs}])].filter(r=>r.runs>=2):[])
    .sort((a,b)=>b.runs-a.runs||a.gameId.localeCompare(b.gameId)||a.inning-b.inning).slice(0,3);
  return {scope,week,coverage,previousCoverage,games:current,teams,highlights,innings,closeGames:close.length,bigGames:big.length,
    previousGames:previousCoverage==="complete"?previous.length:null,pending:games.filter(g=>g.date>=week.from&&g.date<=week.to&&!["final","canceled","cancelled"].includes(g.status)).length};
}
export type WeekSummary=ReturnType<typeof summarizeWeek>;
