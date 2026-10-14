import { appendFile, mkdir, mkdtemp, readFile, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { openDataClient, type DataClient } from "../src/data/database";
import { exportNpbBackup, restoreNpbBackup, verifyRestoredNpbRepository } from "../src/data/npb-backup";
import { backfillDates, remainingReviewedDates, runHistoricalBackfill } from "../src/data/npb-historical-backfill";
import { NpbPeriodCoverageRepository } from "../src/data/npb-period-coverage-repository";
import { resolvePlayerPeriod } from "../src/domain/player-period";
import { findNpbRegularSeason } from "../src/data/npb-season-metadata";
import { createNf3DryRunSession } from "../src/data/npb-day-dry-run";
import { recordDayBackup } from "../src/data/npb-day-collector";
import { assertRecoveryRange, assertRecoveryDiff, expectedRecoveryGames, recoveryReadback, recoverySnapshot } from "../src/data/npb-controlled-recovery";
import type { BackupManifest } from "../src/data/npb-backup";

const arg = (name:string) => process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const from=arg("from") ?? "2026-03-27", to=arg("to") ?? "2026-09-26", mode=arg("mode") ?? "inventory";
const controlled=process.argv.includes("--controlled-sep28");
if(controlled) {assertRecoveryRange(from,to);if(mode==="inventory")throw Error("Controlled recovery needs dry-run or ingest");}
const dates=backfillDates(from,to);
if(!["inventory","dry-run","ingest"].includes(mode)) throw new Error("Unknown backfill mode");
const url=process.env.TURSO_DATABASE_URL;
if(!url || url.startsWith("file:") || !process.env.TURSO_AUTH_TOKEN) throw new Error("Remote connection required");
await mkdir(".data/batch-b",{recursive:true});
const root=await mkdtemp(".data/batch-b/private-");
const remote=openDataClient(url,process.env.TURSO_AUTH_TOKEN);
const db={selects:0,writeStatements:0,affectedRows:0,readMs:0,writeMs:0};
function trace(raw:DataClient):DataClient {
  const count=(statement:Parameters<DataClient["execute"]>[0])=>{
    const sql=typeof statement==="string"?statement:statement.sql;
    if(/^\s*SELECT\b/i.test(sql)) db.selects++; else db.writeStatements++;
  };
  return new Proxy(raw,{get(target,key){
    if(key==="execute")return async(statement:Parameters<DataClient["execute"]>[0])=>{
      count(statement);const started=performance.now();const result=await target.execute(statement);
      const sql=typeof statement==="string"?statement:statement.sql;
      if(/^\s*SELECT\b/i.test(sql))db.readMs+=performance.now()-started;else db.writeMs+=performance.now()-started;
      db.affectedRows+=result.rowsAffected;return result;};
    if(key==="batch")return async(...args:Parameters<DataClient["batch"]>)=>{
      args[0].forEach(count);const started=performance.now();const result=await target.batch(...args);
      db.writeMs+=performance.now()-started;db.affectedRows+=result.reduce((n,r)=>n+r.rowsAffected,0);return result;};
    if(key==="transaction")return async(...args:Parameters<DataClient["transaction"]>)=>
      trace(await target.transaction(...args) as unknown as DataClient);
    const value=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;
  }}) as DataClient;
}
const countsSql=`SELECT (SELECT count(*) FROM npb_games) games,
 (SELECT count(*) FROM player_game_batting) batting,(SELECT count(*) FROM player_game_pitching) pitching,
 (SELECT count(*) FROM source_entity_mappings) mappings,(SELECT count(*) FROM npb_game_completeness) completeness,
 (SELECT count(*) FROM npb_day_runs) days,(SELECT count(*) FROM player_game_batting WHERE pa IS NULL) paUnknown`;
const window=resolvePlayerPeriod({playerId:"audit",period:"season",asOfDate:to},findNpbRegularSeason(to)!);
const factFingerprint=async()=>{
  const rows=await Promise.all(["npb_games","player_game_batting","player_game_pitching","source_entity_mappings"].map(table=>
    remote.execute(`SELECT * FROM ${table} ORDER BY rowid`)));
  return createHash("sha256").update(JSON.stringify(rows.map(r=>r.rows))).digest("hex");
};
try {
  const before=(await remote.execute(countsSql)).rows[0];
  const beforeCoverage=await new NpbPeriodCoverageRepository(remote).findPeriodCoverage(window);
  let result:Awaited<ReturnType<typeof runHistoricalBackfill>>|null=null, replay:unknown=null, backup:unknown=null;
  let recovery:Record<string,unknown>|null=null;
  if(mode!=="inventory") {
    // Existing writer is reused. Controlled mode adds preflight/backup admission,
    // not a parallel Fact-writing implementation or a scheduled proof.
    const protectedBefore=controlled?await recoverySnapshot(remote):null;
    const captured=createNf3DryRunSession(1000);
    const pages=new Map<string,string>();
    const capture=async(url:string)=>{const html=await captured.request(url);pages.set(url,html);return html;};
    const cached=async(url:string)=>{const html=pages.get(url);if(html===undefined)throw Error("Unvalidated Source request during recovery");return html;};
    const expected=controlled?{expectedGames:expectedRecoveryGames}:{};
    let candidate:Awaited<ReturnType<typeof recoveryReadback>>|null=null;
    if(controlled) {
      await recoveryReadback(remote,false); // Reject existing partial/conflicting rows.
      const manifest=await exportNpbBackup(remote,join(root,"baseline"),"turso-remote");
      if(mode==="ingest") {
        const baseline=process.env.NPB_RECOVERY_BASELINE_DIR;
        if(!baseline)throw Error("Verified uploaded pre-recovery encrypted backup is required");
        const protectedManifest=JSON.parse(await readFile(join(baseline,"manifest.json"),"utf8")) as BackupManifest;
        if(JSON.stringify(manifest.tables.map(t=>[t.name,t.rows,t.dataSha256]))!==
           JSON.stringify(protectedManifest.tables.map(t=>[t.name,t.rows,t.dataSha256])))throw Error("Canonical DB changed since uploaded backup");
      }
      const scratch=openDataClient(`file:${join(root,"controlled-preflight.db")}`);
      try {
        await restoreNpbBackup(scratch,join(root,"baseline"));
        const preflight=await runHistoricalBackfill(scratch,{from,to,dryRun:true,scratch:true,request:capture,...expected});
        await writeFile(".data/batch-b/preflight.json",JSON.stringify(preflight,null,2));
        const day=preflight.reports[0]?.result as {mappingCreated?:number;games?:{gameId:string;status:string;expectedBatters:number;expectedPitchers:number}[]}|undefined;
        if(preflight.reports.length!==1|| (preflight.reports[0]?.status!=="skipped_verified" &&
          (preflight.reports[0]?.status!=="complete"||day?.mappingCreated!==0||day.games?.length!==3||
          day.games.some(g=>!expectedRecoveryGames.some(e=>e.id===g.gameId)||g.status!=="complete"))))throw Error("Controlled dry-run changed or failed validation");
        const shadow=await runHistoricalBackfill(scratch,{from,to,request:cached,...expected});
        if(shadow.reports[0]?.status!=="complete"&&shadow.reports[0]?.status!=="skipped_verified")throw Error("Shadow ingestion failed");
        candidate=await recoveryReadback(scratch,true);
        assertRecoveryDiff(protectedBefore!,await recoverySnapshot(scratch));
        // Independent restore + shadow validates every value using the same captured pages.
        const remoteNow=await recoverySnapshot(remote);
        if(JSON.stringify(protectedBefore)!==JSON.stringify(remoteNow))throw Error("Canonical state changed during preflight");
        recovery={preflight,candidate,sourceHttp:captured.metrics,canonicalWritesBeforeAdmission:0};
      } finally {scratch.close();}
    }
    let target=remote;
    if(mode==="dry-run") {
      await exportNpbBackup(remote,join(root,"dry-baseline"),"turso-remote");
      target=openDataClient(`file:${join(root,"scratch.db")}`);
      await restoreNpbBackup(target,join(root,"dry-baseline"));
    }
    try {
      let pass=1;
      const progress=async (day:unknown)=>{
        await writeFile(".data/batch-b/checkpoint.tmp",JSON.stringify(day));
        await rename(".data/batch-b/checkpoint.tmp",".data/batch-b/checkpoint.json");
        await appendFile(".data/batch-b/progress.jsonl",JSON.stringify({pass,day})+"\n");
      };
      result=await runHistoricalBackfill(trace(target),{from,to,dryRun:mode==="dry-run",scratch:mode==="dry-run",progress,...expected,
        ...(controlled?{request:cached}:{})});
      if(mode==="ingest") {
        if(controlled) {
          if(result.reports[0]?.status!=="complete"&&result.reports[0]?.status!=="skipped_verified")throw Error("Recovery incomplete; do not publish");
          const readback=await recoveryReadback(remote,true);
          if(JSON.stringify(readback)!==JSON.stringify(candidate))throw Error("Canonical values differ from validated shadow");
          recovery={...recovery,readback,scopeDiff:assertRecoveryDiff(protectedBefore!,await recoverySnapshot(remote))};
        }
        const first=(await remote.execute(countsSql)).rows[0];
        // Keep first-pass evidence even if later replay/backup verification fails.
        const firstCoverage=await new NpbPeriodCoverageRepository(remote).findPeriodCoverage(window);
        await writeFile(".data/batch-b/report.json",JSON.stringify({mode,from,to,targetDates:dates.length,
          before,after:first,beforeCoverage:beforeCoverage.summary,coverage:firstCoverage,result,replay:null,backup:null,
          db,verification:"pending"},null,2));
        const values=await factFingerprint();
        pass=2;
        const second=await runHistoricalBackfill(trace(target),{from,to,progress,...expected,...(controlled?{request:cached}:{})});
        const next=(await remote.execute(countsSql)).rows[0]!;
        const countsUnchanged=["games","batting","pitching","mappings"].every(k=>first?.[k]===next[k]);
        const valuesUnchanged=values===await factFingerprint();
        replay={countsUnchanged,valuesUnchanged,
          statuses:second.reports.map(d=>({date:d.date,status:d.status})),http:second.http};
        if(!countsUnchanged || !valuesUnchanged) throw new Error("Backfill replay changed canonical Facts or mappings");
        const manifest=await exportNpbBackup(remote,join(root,"export"),"turso-remote");
        const scratch=openDataClient(`file:${join(root,"restored.db")}`);
        try { await restoreNpbBackup(scratch,join(root,"export"));
          const readback=await verifyRestoredNpbRepository(scratch);
          const countsMatch=JSON.stringify((await remote.execute(countsSql)).rows[0])===JSON.stringify((await scratch.execute(countsSql)).rows[0]);
          if(controlled&&!countsMatch)throw Error("Restored counts differ from canonical DB");
          backup={directory:join(root,"export"),schemaVersion:manifest.schemaVersion,countsMatch,readback};
          if(controlled) {
            const restored=await recoveryReadback(scratch,true);
            if(JSON.stringify(restored)!==JSON.stringify(candidate))throw Error("Restored values differ from validated candidates");
            const repaired=result.reports[0]?.result as {runId?:string}|undefined;
            if(repaired?.runId)await recordDayBackup(remote,repaired.runId,true);
            // Include the recorded repair-backup status in the final retained export.
            const finalDir=join(root,"final-export");
            await exportNpbBackup(remote,finalDir,"turso-remote");
            const finalScratch=openDataClient(`file:${join(root,"final-restore.db")}`);
            try {await restoreNpbBackup(finalScratch,finalDir);
              if(JSON.stringify(await recoveryReadback(finalScratch,true))!==JSON.stringify(candidate))throw Error("Final backup readback mismatch");
            }finally{finalScratch.close();}
            backup={directory:finalDir,schemaVersion:manifest.schemaVersion,countsMatch,readback};
            recovery={...recovery,restored,finalDiff:assertRecoveryDiff(protectedBefore!,await recoverySnapshot(remote))};
          }
        } finally {scratch.close();}
      }
    } finally { if(target!==remote) target.close(); }
  }
  const after=(await remote.execute(countsSql)).rows[0];
  if(mode!=="ingest" && JSON.stringify(before)!==JSON.stringify(after)) throw new Error("Read-only counts changed");
  const coverage=await new NpbPeriodCoverageRepository(remote).findPeriodCoverage(window);
  const report={mode,from,to,targetDates:dates.length,futureDates:remainingReviewedDates(to),
    before,after,beforeCoverage:beforeCoverage.summary,coverage,result,replay,backup,db,recovery};
  await writeFile(".data/batch-b/report.json",JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
} finally {remote.close();}
