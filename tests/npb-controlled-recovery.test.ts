import { expect,test } from "vitest";
import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { assertRecoveryRange,assertRecoveryDiff,recoveryGames,recoverySnapshot } from "../src/data/npb-controlled-recovery";
import { protectedTables } from "../src/data/npb-backup";
import { migrateData,openDataClient } from "../src/data/database";
import { runHistoricalBackfill } from "../src/data/npb-historical-backfill";
import { expectedRecoveryGames } from "../src/data/npb-controlled-recovery";

const empty=()=>Object.fromEntries(protectedTables.map(t=>[t,[]])) as unknown as Awaited<ReturnType<typeof recoverySnapshot>>;
test("controlled recovery refuses every range except the approved single date",()=>{
  expect(()=>assertRecoveryRange("2026-09-28","2026-09-28")).not.toThrow();
  expect(()=>assertRecoveryRange("2026-09-27","2026-09-28")).toThrow();
  expect(()=>assertRecoveryRange("2026-09-28","2026-09-29")).toThrow();
});
test("scope diff allows only target inserts and games-stage correction, never identities or old Day rewrite",()=>{
  const before=empty(),after=empty();
  before.npb_day_runs=[{run_id:"legacy",target_date:"2026-09-28",day_status:"partial"}];
  after.npb_day_runs=[...before.npb_day_runs,{run_id:"repair",target_date:"2026-09-28",trigger_kind:"repair",day_status:"complete",final_games:3,complete_games:3,partial_games:0,failed_games:0}];
  after.player_game_batting=[{game_id:recoveryGames[0].id}];
  expect(assertRecoveryDiff(before,after).find(r=>r.table==="player_game_batting")?.added).toBe(1);
  after.player_game_pitching=[{game_id:"outside"}];expect(()=>assertRecoveryDiff(before,after)).toThrow("out-of-scope");
  after.player_game_pitching=[];after.source_entity_mappings=[{id:"new"}];expect(()=>assertRecoveryDiff(before,after)).toThrow("out-of-scope");
  after.source_entity_mappings=[];after.npb_day_runs[0]={...before.npb_day_runs[0],day_status:"complete"};
  expect(()=>assertRecoveryDiff(before,after)).toThrow("changed/deleted");
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
