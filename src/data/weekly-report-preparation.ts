import { createHash } from "node:crypto";
import { z } from "zod";
import { dateInZone } from "../domain/analysis-query";
import { calendarWeek } from "../domain/weekly-analysis";
import { NpbWeeklyRangeUnavailable,type NpbWeeklyStage,type readNpbWeekly } from "../application/npb-weekly";

export function lastCompletedWeek(now=new Date()) {
  const today=dateInZone(now.getTime(),"Asia/Tokyo");
  return calendarWeek(calendarWeek(today).previous.from);
}
export async function prepareNpbWeeklyReport(read:(stage:NpbWeeklyStage,week:string)=>ReturnType<typeof readNpbWeekly>,now=new Date(),selected?:string) {
  const current=calendarWeek(dateInZone(now.getTime(),"Asia/Tokyo")),week=selected?calendarWeek(z.iso.date().parse(selected)):lastCompletedWeek(now);
  if(selected&&selected!==week.from)throw Error("A Monday is required");
  if(week.from>=current.from)throw Error("Only completed calendar weeks can be prepared");
  if(!week.from.startsWith("2026-")&&!week.to.startsWith("2026-"))return {status:"NO_ADMITTED_YEAR" as const,week,aiRequests:0,canonicalWrites:0,publiclyAdmitted:false as const};
  const scopes=[];
  for(const stage of ["regular","npb_cs_first","npb_cs_final","japan_series"] as const){
    try{
      const r=await read(stage,week.from);
      if(r.playerEvaluation!=="gate_closed"||"hot" in r||r.summary.scope.league!=="NPB"||r.summary.scope.season!==2026||r.summary.week.from!==week.from||r.summary.scope.competition!==(stage==="regular"?"regular":"postseason")||(stage!=="regular"&&r.summary.scope.stage!==stage))throw Error("Invalid weekly report scope");
      scopes.push({stage,status:"RESULTS_COLLECTED" as const,summary:r.summary,teamNames:[...r.names],missingResults:r.missingResults,asOf:r.asOf,updatedAt:r.updatedAt,attribution:r.attribution,sources:r.sources,playerEvaluation:r.playerEvaluation});
    }catch(error){scopes.push({stage,status:error instanceof NpbWeeklyRangeUnavailable?"OUTSIDE_SAVED_RANGE" as const:"UNAVAILABLE" as const});}
  }
  const results=scopes.filter(s=>s.status==="RESULTS_COLLECTED").reduce((n,s)=>n+s.summary.games.length,0);
  if(!results)return {status:scopes.some(s=>s.status==="UNAVAILABLE")?"SOURCE_UNAVAILABLE" as const:"NO_NEW_VERIFIED_RESULTS" as const,week,scopes,aiRequests:0,canonicalWrites:0,publiclyAdmitted:false as const};
  const report={schemaVersion:1,league:"NPB",season:2026,week,scopes,aiRequests:0,canonicalWrites:0,publiclyAdmitted:false as const};
  const contentSha256=createHash("sha256").update(JSON.stringify(report)).digest("hex");
  return {status:"REPORT_PREPARED" as const,week,report,contentSha256,aiRequests:0,canonicalWrites:0,publiclyAdmitted:false as const};
}
