import { createHash } from "node:crypto";
import type { DataClient } from "./database";
import { protectedTables } from "./npb-backup";
import type { ExpectedHistoricalGame } from "./npb-historical-backfill";
import { NpbRepository } from "./npb-repository";
import { validateNpbGameFacts } from "./npb-game-collector";

// Operator-reviewed scope, not fabricated Game/Player Facts. Both schedules and
// the saved canonical Games must independently match this before any mutation.
export const recoveryDate="2026-09-28";
export const recoveryGames = [
  {id:"npb:game:5956839637147e5631b2",homeTeamId:"npb:team:lions",awayTeamId:"npb:team:eagles",homeScore:2,awayScore:4,sourceRecordId:"2026-09-28:L:E:1",venue:"ベルーナドーム",batters:18,pitchers:12},
  {id:"npb:game:7978b5cc540f0334e2d7",homeTeamId:"npb:team:baystars",awayTeamId:"npb:team:carp",homeScore:3,awayScore:4,sourceRecordId:"2026-09-28:DB:C:1",venue:"横浜",batters:34,pitchers:9},
  {id:"npb:game:fd5f433285c5557b67a6",homeTeamId:"npb:team:marines",awayTeamId:"npb:team:fighters",homeScore:3,awayScore:8,sourceRecordId:"2026-09-28:M:F:1",venue:"ZOZOマリン",batters:28,pitchers:9},
] as const;
export const expectedRecoveryGames: readonly ExpectedHistoricalGame[] = recoveryGames.map(g=>({...g,season:2026,date:recoveryDate,
  gameNumber:1,scheduledTime:"18:00",status:"final"}));
export function assertRecoveryRange(from:string,to:string) {
  if(from!==recoveryDate||to!==recoveryDate) throw Error("Controlled recovery permits September 28 only");
}
export async function recoverySnapshot(client:DataClient) {
  const entries=await Promise.all(protectedTables.map(async table=>[table,(await client.execute(`SELECT * FROM ${table} ORDER BY rowid`)).rows] as const));
  return Object.fromEntries(entries) as unknown as Record<typeof protectedTables[number],Record<string,unknown>[]>;
}
type Snapshot=Awaited<ReturnType<typeof recoverySnapshot>>;
const hash=(rows:readonly Record<string,unknown>[])=>createHash("sha256").update(JSON.stringify(rows)).digest("hex");
const completeRepairDay=(r:Record<string,unknown>)=>r.target_date===recoveryDate&&r.trigger_kind==="repair"&&r.day_status==="complete"&&
  r.scheduled_games===3&&r.final_games===3&&r.complete_games===3&&r.partial_games===0&&r.failed_games===0&&r.batter_rows===80&&r.pitcher_rows===30&&r.mapping_created===0;
export async function recoveryBackupRun(client:DataClient,runId?:string):Promise<string> {
  const result=await client.execute(runId?{sql:"SELECT * FROM npb_day_runs WHERE run_id=? AND target_date=?",args:[runId,recoveryDate]}:
    {sql:"SELECT * FROM npb_day_runs WHERE target_date=? ORDER BY started_at DESC,run_id DESC LIMIT 1",args:[recoveryDate]});
  const row=result.rows[0] as unknown as Record<string,unknown>|undefined;
  if(!row||!completeRepairDay(row))throw Error("Only the validated complete target repair Day may acknowledge backup");
  return String(row.run_id);
}
export function assertRecoveryDiff(before:Snapshot,after:Snapshot,acknowledgedRunId?:string) {
  const target=(r:Record<string,unknown>)=>recoveryGames.some(g=>g.id===r.game_id);
  const stage=(r:Record<string,unknown>)=>r.target_date===recoveryDate&&r.stage==="games";
  return protectedTables.map(table=>{
    const old=new Set(before[table].map(r=>JSON.stringify(r))),next=new Set(after[table].map(r=>JSON.stringify(r)));
    const removed=before[table].filter(r=>!next.has(JSON.stringify(r))),added=after[table].filter(r=>!old.has(JSON.stringify(r)));
    const backupAck=(r:Record<string,unknown>)=>table==="npb_day_runs"&&r.run_id===acknowledgedRunId&&completeRepairDay(r)&&
      ["pending","failed"].includes(String(r.backup_status))&&after[table].some(n=>JSON.stringify(n)===JSON.stringify({...r,backup_status:"exported"}));
    if(removed.some(r=> !(table==="npb_ingestion_stages"&&stage(r)) && !backupAck(r)&&
      !(table==="npb_game_completeness"&&target(r)&&["partial","failed"].includes(String(r.game_status)))))
      throw Error(`Recovery changed/deleted protected ${table}`);
    if(added.some(r=> {
      if(["player_game_batting","player_game_pitching"].includes(table))return !target(r);
      if(table==="npb_game_completeness")return !target(r)||r.game_status!=="complete"||r.batting_status!=="complete"||r.pitching_status!=="complete";
      if(table==="npb_ingestion_stages")return !stage(r)||r.status!=="complete"||r.record_count!==3;
      if(table==="ingestion_runs")return r.target_date!==recoveryDate||r.source_key!=="nf3"||r.status!=="succeeded";
      if(table==="npb_day_runs")return !completeRepairDay(r);
      return true;
    }))throw Error(`Recovery added out-of-scope ${table}`);
    return {table,beforeCount:before[table].length,afterCount:after[table].length,beforeHash:hash(before[table]),afterHash:hash(after[table]),added:added.length,removed:removed.length};
  });
}
export async function recoveryReadback(client:DataClient, requireComplete:boolean) {
  const repo=new NpbRepository(client),result=[];
  for(const g of recoveryGames){
    const game=(await repo.findGamesByDate(recoveryDate)).find(r=>r.id===g.id);
    if(!game)throw Error("Recovery Game missing");
    const [b,p,e]=await Promise.all([repo.findBattingByGame(g.id),repo.findPitchingByGame(g.id),repo.findGameCompleteness(g.id)]);
    // A rolled-back Game transaction may leave a failed/partial proof but no
    // Facts. Preserve that pre-write evidence in the encrypted baseline, then
    // allow the established writer to replace it only after fresh validation.
    // Existing partial Facts or a broken claimed-complete proof remain blocked.
    const emptyRetry=!requireComplete&&!b.length&&!p.length&&e&&["partial","failed"].includes(e.gameStatus);
    if(!emptyRetry && (b.length||p.length||e||requireComplete)){
      const proof=validateNpbGameFacts(game,g.batters,b,g.pitchers,p,b.length,p.length);
      if(proof.gameStatus!=="complete"||e?.gameStatus!=="complete"||e.battingStatus!=="complete"||e.pitchingStatus!=="complete"||b.length!==g.batters||p.length!==g.pitchers||
        e.expectedBatters!==b.length||e.collectedBatters!==b.length||e.mappedBatters!==b.length||
        e.expectedPitchers!==p.length||e.collectedPitchers!==p.length||e.mappedPitchers!==p.length||e.issues.length||
        Object.keys(proof.checks).some(k=>e.checks[k]!==true))
        throw Error(`Existing/candidate Recovery Facts incomplete: ${g.id}`);
    }
    result.push({gameId:g.id,batting:b.length,pitching:p.length,completeness:e?.gameStatus??null,
      battingHash:hash(b.map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>k!=="collectedAt")))),
      pitchingHash:hash(p.map(r=>Object.fromEntries(Object.entries(r).filter(([k])=>k!=="collectedAt")))),
      homeOuts:p.length?p.filter(r=>r.teamId===g.homeTeamId).reduce((n,r)=>n+(r.inningsPitchedOuts??0),0):null,
      awayOuts:p.length?p.filter(r=>r.teamId===g.awayTeamId).reduce((n,r)=>n+(r.inningsPitchedOuts??0),0):null});
  }return result;
}
