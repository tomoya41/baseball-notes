import type { DataClient } from "./database";
import type { InStatement,InArgs } from "@libsql/client";
import { npbTeams, parseNf3TeamGames } from "./npb-nf3";
import { createHistoricalPitcherDiscovery } from "./npb-historical-discovery";
import { reconcileHistoricalSchedules, recoveryGameFields } from "./npb-historical-backfill";
import { NpbRepository } from "./npb-repository";
import { runNpbGameProof } from "./npb-game-collector";
import { jstToday } from "./npb-collector";
import { sourceRegistry } from "./source-registry";

// Reviewed identity/scope only. No ending, outs or official-site values admitted.
export const shortenedTargets = [
  { id:"npb:game:2469292e18a73924f23c",date:"2026-04-09",home:"npb:team:tigers",away:"npb:team:swallows",homeScore:2,awayScore:0 },
  { id:"npb:game:99b0c4913966af7674ad",date:"2026-04-14",home:"npb:team:swallows",away:"npb:team:baystars",homeScore:5,awayScore:3 },
  { id:"npb:game:e9a705d2e3ddfe1dabe8",date:"2026-05-03",home:"npb:team:tigers",away:"npb:team:giants",homeScore:3,awayScore:0 },
  { id:"npb:game:b2f541664347c98a1f62",date:"2026-06-20",home:"npb:team:swallows",away:"npb:team:carp",homeScore:6,awayScore:8 },
  { id:"npb:game:51c3f0f8dba6a7bb710e",date:"2026-09-09",home:"npb:team:marines",away:"npb:team:eagles",homeScore:10,awayScore:4 },
  { id:"npb:game:645ed547effceffc5ca9",date:"2026-09-09",home:"npb:team:baystars",away:"npb:team:swallows",homeScore:9,awayScore:2 },
] as const;

// Only SQL SELECT is allowed on the remote connection. No migrations/transactions.
export function selectOnlyClient(client:DataClient):DataClient {
  return new Proxy(client,{get(target,key){
    if(key==="execute")return async(statement:InStatement,args?:InArgs)=>{
      const sql=typeof statement==="string"?statement:statement.sql;
      if(!/^\s*SELECT\b/i.test(sql)||sql.includes(";"))throw Error("Read-only shortened audit permits one SELECT only");
      return typeof statement==="string"?target.execute(statement,args):target.execute(statement);
    };
    const value=Reflect.get(target,key);
    if(typeof value==="function")return key==="close"?value.bind(target):()=>{throw Error("Read-only shortened audit forbids this DB operation");};
    return value;
  }}) as DataClient;
}

export async function auditShortenedCandidates(scratch:DataClient,request:(url:string)=>Promise<string>) {
  if(process.env.NPB_NF3_ENABLED==="false"||sourceRegistry.find(s=>s.key==="nf3")?.status!=="enabled-limited-public")
    throw Error("nf3 provider disabled; no readiness acquisition permitted");
  if(!jstToday().startsWith("2026-"))throw Error("nf3 y=0 cannot verify 2026 after the source year changes");
  const repo=new NpbRepository(scratch),saved=[];
  for(const t of shortenedTargets){
    const g=(await repo.findGamesByDate(t.date)).find(g=>g.id===t.id);
    if(!g||g.status!=="final"||g.homeTeamId!==t.home||g.awayTeamId!==t.away||g.homeScore!==t.homeScore||g.awayScore!==t.awayScore)
      throw Error("Reviewed shortened Game metadata differs: "+t.id);
    saved.push(g);
  }
  const pages=[];
  for(const team of npbTeams){
    const url=`https://nf3.sakura.ne.jp/php/stat_disp/stat_disp.php?y=0&leg=${team.group==="Central"?0:1}&mon=0&tm=${team.code}&vst=all`;
    pages.push(parseNf3TeamGames(await request(url),team.code,2026,url,new Date().toISOString(),true));
  }
  const reconciled=reconcileHistoricalSchedules(pages,saved),historicalPitchers=createHistoricalPitcherDiscovery(request),results=[];
  for(const g of saved){
    const source=reconciled.find(s=>s.id===g.id);
    if(!source||recoveryGameFields.some(k=>source[k]!==g[k]))throw Error("Source/saved identity or metadata conflict: "+g.id);
    const beforeB=await repo.findBattingByGame(g.id),beforeP=await repo.findPitchingByGame(g.id);
    const result=await runNpbGameProof(scratch,{gameId:g.id,targetDate:g.date,dryRun:true,scope:"day-ingest",request,historicalPitchers,persistRawManifest:false});
    if(!result.observed.ending)throw Error("Ending diagnostic missing");
    const disposition=result.wouldCreateMappings.length?"blocked_identity":!result.observed.ending.independentEvidencePresent?
      "blocked_independent_ending_evidence":result.report.gameStatus!=="complete"?"blocked_validation":"ready_for_controlled_recovery";
    results.push({game:g,saved:{batting:beforeB.length,pitching:beforeP.length},candidate:result,disposition,
      limitation:"Candidate pitching sums are not independent final inning/half/out evidence. No evidence or Facts are saved by this audit."});
  }
  return results;
}
