import { expect,test } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { assertRecoveryRange,assertRecoveryDiff,recoveryGames,recoverySnapshot,recoveryReadback,recoveryBackupRun } from "../src/data/npb-controlled-recovery";
import { protectedTables } from "../src/data/npb-backup";
import { migrateData,openDataClient } from "../src/data/database";
import { runHistoricalBackfill } from "../src/data/npb-historical-backfill";
import { expectedRecoveryGames } from "../src/data/npb-controlled-recovery";
import { NpbRepository } from "../src/data/npb-repository";

const empty=()=>Object.fromEntries(protectedTables.map(t=>[t,[]])) as unknown as Awaited<ReturnType<typeof recoverySnapshot>>;
test("controlled recovery refuses every range except the approved single date",()=>{
  expect(()=>assertRecoveryRange("2026-09-28","2026-09-28")).not.toThrow();
  expect(()=>assertRecoveryRange("2026-09-27","2026-09-28")).toThrow();
  expect(()=>assertRecoveryRange("2026-09-28","2026-09-29")).toThrow();
});
test("scope diff allows only target inserts and games-stage correction, never identities or old Day rewrite",()=>{
  const before=empty(),after=empty();
  before.npb_day_runs=[{run_id:"legacy",target_date:"2026-09-28",day_status:"partial"}];
  after.npb_day_runs=[...before.npb_day_runs,{run_id:"repair",target_date:"2026-09-28",trigger_kind:"repair",day_status:"complete",scheduled_games:3,final_games:3,complete_games:3,partial_games:0,failed_games:0,batter_rows:80,pitcher_rows:30,mapping_created:0}];
  after.player_game_batting=[{game_id:recoveryGames[0].id}];
  expect(assertRecoveryDiff(before,after).find(r=>r.table==="player_game_batting")?.added).toBe(1);
  after.player_game_pitching=[{game_id:"outside"}];expect(()=>assertRecoveryDiff(before,after)).toThrow("out-of-scope");
  after.player_game_pitching=[];after.source_entity_mappings=[{id:"new"}];expect(()=>assertRecoveryDiff(before,after)).toThrow("out-of-scope");
  after.source_entity_mappings=[];after.npb_day_runs[0]={...before.npb_day_runs[0],day_status:"complete"};
  expect(()=>assertRecoveryDiff(before,after)).toThrow("changed/deleted");
});
test("a retry may replace only a target failed/partial proof; complete proof and existing Facts stay protected",()=>{
  const before=empty(),after=empty();
  before.npb_game_completeness=[{game_id:recoveryGames[0].id,game_status:"failed"}];
  after.npb_game_completeness=[{game_id:recoveryGames[0].id,game_status:"complete",batting_status:"complete",pitching_status:"complete"}];
  expect(()=>assertRecoveryDiff(before,after)).not.toThrow();
  before.npb_game_completeness[0]!.game_status="complete";expect(()=>assertRecoveryDiff(before,after)).toThrow("changed/deleted");
  before.npb_game_completeness=[];after.npb_game_completeness=[];
  before.player_game_batting=[{game_id:recoveryGames[0].id,hits:1}];after.player_game_batting=[{game_id:recoveryGames[0].id,hits:2}];
  expect(()=>assertRecoveryDiff(before,after)).toThrow("changed/deleted");
});
test("verified retry may acknowledge only backup_status on its complete repair Day, never scheduled/history fields",()=>{
  const before=empty(),after=empty();const day={run_id:"prior-repair",target_date:"2026-09-28",trigger_kind:"repair",day_status:"complete",
    scheduled_games:3,final_games:3,complete_games:3,partial_games:0,failed_games:0,batter_rows:80,pitcher_rows:30,mapping_created:0,backup_status:"pending"};
  before.npb_day_runs=[day];after.npb_day_runs=[{...day,backup_status:"exported"}];
  expect(()=>assertRecoveryDiff(before,after,"prior-repair")).not.toThrow();
  expect(()=>assertRecoveryDiff(before,after)).toThrow("changed/deleted");
  after.npb_day_runs[0]!.trigger_kind="scheduled";expect(()=>assertRecoveryDiff(before,after,"prior-repair")).toThrow();
});
test("backup retry selects latest valid complete repair, not a newer manual/failed Day",async()=>{
  const db=openDataClient("file::memory:");try{
    await migrateData(db);
    for(const [id,trigger,status,time]of [["complete-repair","repair","complete","01"],["new-manual","manual","complete","02"],["new-failed","repair","failed","03"]])
      await db.execute({sql:`INSERT INTO npb_day_runs VALUES (?,'2026-09-28',?,?,?,?,'succeeded',3,3,3,0,0,80,30,0,0,0,'pending',NULL)`,
        args:[id!,trigger!,`2026-10-14T00:00:${time}Z`,`2026-10-14T00:00:${time}Z`,status!]});
    expect(await recoveryBackupRun(db)).toBe("complete-repair");
    await expect(recoveryBackupRun(db,"new-manual")).rejects.toThrow();
    await expect(recoveryBackupRun(db,"new-failed")).rejects.toThrow();
  }finally{db.close();}
});
test("rolled-back proof without Facts admits a fresh retry but is never accepted as complete readback",async()=>{
  const db=openDataClient("file::memory:");try{
    await migrateData(db);const repo=new NpbRepository(db);
    await repo.saveGames(expectedRecoveryGames.map(g=>({...g,sourceKey:"nf3",sourceUrl:"https://nf3.sakura.ne.jp/",collectedAt:"2026-10-14T00:00:00Z"})),"2026-09-28",false);
    const proof={gameId:recoveryGames[0].id,gameStatus:"failed" as const,battingStatus:"complete" as const,pitchingStatus:"complete" as const,
      expectedBatters:18,collectedBatters:18,mappedBatters:18,expectedPitchers:12,collectedPitchers:12,mappedPitchers:12,
      checks:{},issues:["Rolled back transaction"],sourceKey:"nf3",verifiedAt:"2026-10-14T00:00:00Z"};
    await repo.saveGameCompleteness(proof);await expect(recoveryReadback(db,false)).resolves.toHaveLength(3);
    await expect(recoveryReadback(db,true)).rejects.toThrow("incomplete");
    await repo.saveGameCompleteness({...proof,gameStatus:"complete"});
    await expect(recoveryReadback(db,false)).rejects.toThrow("incomplete");
  }finally{db.close();}
});
test("changed Source enumeration aborts before any saved Game/Day/Fact mutation",async()=>{
  const db=openDataClient("file::memory:");try{
    await migrateData(db);const before=await recoverySnapshot(db);
    const page='<table class="Base"><caption>試合日程・先発</caption><tr class="Index2"><th>スコア</th></tr></table>';
    const result=await runHistoricalBackfill(db,{from:"2026-09-28",to:"2026-09-28",now:new Date("2026-10-14T00:00:00Z"),
      expectedGames:expectedRecoveryGames,request:async()=>page});
    expect(result.reports[0]?.status).toBe("unknown");
    expect(await recoverySnapshot(db)).toEqual(before);
  }finally{db.close();}
});
test("controlled workflow uploads encrypted baseline before writer and retains verified encrypted result",()=>{
  const workflow=parse(readFileSync('.github/workflows/npb-historical-backfill.yml','utf8'));
  const steps=workflow.jobs.backfill.steps as {name?:string;uses?:string;with?:Record<string,unknown>;run?:string}[];
  const baseline=steps.findIndex(s=>s.name?.startsWith('Retain encrypted recovery baseline'));
  const writer=steps.findIndex(s=>s.name?.startsWith('Explicit historical range'));
  expect(baseline).toBeGreaterThan(0);expect(baseline).toBeLessThan(writer);
  expect(steps[baseline]?.with?.['if-no-files-found']).toBe('error');
  expect(steps.some(s=>s.run?.includes('cmp .data/batch-b/post-backup'))).toBe(true);
  expect(steps.filter(s=>s.uses?.startsWith('actions/upload-artifact')).every(s=>s.with?.['include-hidden-files']===true)).toBe(true);
});
