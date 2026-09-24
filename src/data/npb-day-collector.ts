import { randomUUID } from "node:crypto";
import type { DataClient } from "./database";
import { addDays, jstToday } from "./npb-collector";
import { createNf3DryRunSession } from "./npb-day-dry-run";
import { runNpbGameProof, type NpbGameProofResult } from "./npb-game-collector";
import type { NpbGame } from "./npb-nf3";
import { NpbRepository } from "./npb-repository";

export type DayStatus = "complete" | "partial" | "no_games" | "failed";
export type DayTrigger = "manual" | "scheduled" | "repair";
export const previousJstDate = (now = new Date()) => addDays(jstToday(now),-1);
export type DayGameResult = { gameId:string; status:"complete"|"partial"|"failed";
  expectedBatters:number; storedBatters:number; expectedPitchers:number; storedPitchers:number; issues:string[] };
export type NpbDayResult = {runId:string;targetDate:string;trigger:DayTrigger;status:DayStatus;
  scheduledGames:number;finalGames:number;completeGames:number;partialGames:number;failedGames:number;
  expectedBatters:number;storedBatters:number;expectedPitchers:number;storedPitchers:number;
  mappingCreated:number;newBatting:number;newPitching:number;httpRequests:number;uniquePages:number;
  retries:number;durationMs:number;games:DayGameResult[] };

export function classifyDay(games:readonly DayGameResult[],scheduledGames:number,finalGames:number,
  enumerationOk=true):DayStatus {
  if (!enumerationOk) return "failed";
  if (finalGames===0) return "no_games";
  if (games.length!==finalGames || games.some((game)=>game.status!=="complete")) return "partial";
  if (scheduledGames<finalGames) return "failed";
  return "complete";
}

export async function runNpbDayFacts(client:DataClient,options:{targetDate:string;trigger:DayTrigger;
  dryRun?:boolean;request?:(url:string)=>Promise<string>;rawRoot?:string;delayMs?:number;
  runGame?:(game:NpbGame,request:(url:string)=>Promise<string>)=>Promise<NpbGameProofResult>;
  requireCompleteGameStage?:boolean}):Promise<NpbDayResult> {
  const {targetDate,trigger,dryRun=false}=options;
  if (!/^2026-\d{2}-\d{2}$/.test(targetDate) || targetDate>previousJstDate())
    throw new Error("Target must be a completed 2026 JST date");
  const repository=new NpbRepository(client);
  if (options.requireCompleteGameStage) {
    const stage=await client.execute({sql:"SELECT status FROM npb_ingestion_stages WHERE target_date=? AND stage='games'",
      args:[targetDate]});
    if (String(stage.rows[0]?.status)!=="complete") throw new Error("Game enumeration stage is not complete");
  }
  const scheduled=await repository.findGamesByDate(targetDate);
  const finalGames=scheduled.filter((game)=>game.status==="final");
  const session=createNf3DryRunSession(options.delayMs,options.request,options.rawRoot,targetDate);
  const runId=randomUUID(),startedAt=new Date().toISOString(),start=Date.now();
  const games:DayGameResult[]=[];
  let mappingCreated=0,newBatting=0,newPitching=0;
  for(const game of finalGames) {
    try {
      const result=await (options.runGame ? options.runGame(game,session.request) :
        runNpbGameProof(client,{gameId:game.id,targetDate,dryRun,scope:"day-ingest",
          request:session.request,persistRawManifest:false}));
      const status=result.report.gameStatus==="complete" ? "complete" :
        result.report.gameStatus==="failed" ? "failed" : "partial";
      let storedBatters=0,storedPitchers=0;
      if(status==="complete" && !dryRun) {
        const [batting,pitching,completeness]=await Promise.all([
          repository.findBattingByGame(game.id),repository.findPitchingByGame(game.id),
          repository.findGameCompleteness(game.id)]);
        storedBatters=batting.length;storedPitchers=pitching.length;
        if(storedBatters!==result.report.expectedBatters ||
          storedPitchers!==result.report.expectedPitchers || completeness?.gameStatus!=="complete")
          throw new Error("Remote Repository readback did not match complete game");
      } else if(dryRun) {
        storedBatters=result.battingFacts;storedPitchers=result.pitchingFacts;
      }
      if(status==="complete") mappingCreated+=result.wouldCreateMappings.length;
      newBatting+=result.insertedBatting;
      newPitching+=result.insertedPitching;
      games.push({gameId:game.id,status,expectedBatters:result.report.expectedBatters,
        storedBatters,expectedPitchers:result.report.expectedPitchers,storedPitchers,issues:result.report.issues});
    } catch(error) {
      games.push({gameId:game.id,status:"failed",expectedBatters:0,storedBatters:0,
        expectedPitchers:0,storedPitchers:0,issues:[String(error)]});
    }
  }
  const status=classifyDay(games,scheduled.length,finalGames.length);
  const result:NpbDayResult={runId,targetDate,trigger,status,scheduledGames:scheduled.length,
    finalGames:finalGames.length,completeGames:games.filter((game)=>game.status==="complete").length,
    partialGames:games.filter((game)=>game.status==="partial").length,
    failedGames:games.filter((game)=>game.status==="failed").length,
    expectedBatters:games.reduce((sum,game)=>sum+game.expectedBatters,0),
    storedBatters:games.reduce((sum,game)=>sum+game.storedBatters,0),
    expectedPitchers:games.reduce((sum,game)=>sum+game.expectedPitchers,0),
    storedPitchers:games.reduce((sum,game)=>sum+game.storedPitchers,0),
    mappingCreated,newBatting,newPitching,httpRequests:session.metrics.httpRequests,
    uniquePages:session.metrics.uniquePages,retries:session.metrics.retries,durationMs:Date.now()-start,games};
  if(!dryRun) await client.execute({sql:`INSERT INTO npb_day_runs
    (run_id,target_date,trigger_kind,started_at,finished_at,day_status,operational_status,scheduled_games,
      final_games,complete_games,partial_games,failed_games,batter_rows,pitcher_rows,mapping_created,
      requests,retries,backup_status,error_summary) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args:[runId,targetDate,trigger,startedAt,new Date().toISOString(),status,
      status==="failed"?"failed":"succeeded",result.scheduledGames,result.finalGames,result.completeGames,
      result.partialGames,result.failedGames,result.storedBatters,result.storedPitchers,mappingCreated,
      result.httpRequests,result.retries,"pending",games.flatMap((game)=>game.issues).join(" | ").slice(0,500)||null]});
  return result;
}

export async function recordDayBackup(client:DataClient,runId:string,ok:boolean,error?:unknown):Promise<void> {
  await client.execute({sql:`UPDATE npb_day_runs SET backup_status=?,
    operational_status=CASE WHEN ?=1 THEN operational_status ELSE 'completed_with_warning' END,
    error_summary=CASE WHEN ?=1 THEN error_summary ELSE substr(coalesce(error_summary||' | ','')||?,1,500) END
    WHERE run_id=?`,args:[ok?"exported":"failed",ok?1:0,ok?1:0,String(error??"Backup export failed"),runId]});
}
