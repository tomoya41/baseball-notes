import { mkdir, mkdtemp, rename, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { openDataClient } from "../src/data/database";
import { exportNpbBackup, restoreNpbBackup, verifyRestoredNpbRepository } from "../src/data/npb-backup";
import { backfillDates, runHistoricalBackfill } from "../src/data/npb-historical-backfill";
import { NpbPeriodCoverageRepository } from "../src/data/npb-period-coverage-repository";
import { resolvePlayerPeriod } from "../src/domain/player-period";
import { findNpbRegularSeason } from "../src/data/npb-season-metadata";

const arg = (name:string) => process.argv.find(a=>a.startsWith(`--${name}=`))?.slice(name.length+3);
const from=arg("from") ?? "2026-03-27", to=arg("to") ?? "2026-09-26", mode=arg("mode") ?? "inventory";
const dates=backfillDates(from,to);
if(!["inventory","dry-run","ingest"].includes(mode)) throw new Error("Unknown backfill mode");
const url=process.env.TURSO_DATABASE_URL;
if(!url || url.startsWith("file:") || !process.env.TURSO_AUTH_TOKEN) throw new Error("Remote connection required");
await mkdir(".data/batch-b",{recursive:true});
const root=await mkdtemp(".data/batch-b/private-");
const remote=openDataClient(url,process.env.TURSO_AUTH_TOKEN);
const countsSql=`SELECT (SELECT count(*) FROM npb_games) games,
 (SELECT count(*) FROM player_game_batting) batting,(SELECT count(*) FROM player_game_pitching) pitching,
 (SELECT count(*) FROM source_entity_mappings) mappings,(SELECT count(*) FROM npb_game_completeness) completeness,
 (SELECT count(*) FROM npb_day_runs) days,(SELECT count(*) FROM player_game_batting WHERE pa IS NULL) paUnknown`;
const window=resolvePlayerPeriod({playerId:"audit",period:"season",asOfDate:to},findNpbRegularSeason(to)!);
try {
  const before=(await remote.execute(countsSql)).rows[0];
  const beforeCoverage=await new NpbPeriodCoverageRepository(remote).findPeriodCoverage(window);
  let result:unknown=null, replay:unknown=null, backup:unknown=null;
  if(mode!=="inventory") {
    let target=remote;
    if(mode==="dry-run") {
      await exportNpbBackup(remote,join(root,"baseline"),"turso-remote");
      target=openDataClient(`file:${join(root,"scratch.db")}`);
      await restoreNpbBackup(target,join(root,"baseline"));
    }
    try {
      const progress=async (day:unknown)=>{
        await writeFile(".data/batch-b/checkpoint.tmp",JSON.stringify(day));
        await rename(".data/batch-b/checkpoint.tmp",".data/batch-b/checkpoint.json");
      };
      result=await runHistoricalBackfill(target,{from,to,dryRun:mode==="dry-run",scratch:mode==="dry-run",progress});
      if(mode==="ingest") {
        const first=(await remote.execute(countsSql)).rows[0];
        const second=await runHistoricalBackfill(target,{from,to,progress});
        replay={countsUnchanged:JSON.stringify(first)===JSON.stringify((await remote.execute(countsSql)).rows[0]),
          statuses:second.reports.map(d=>({date:d.date,status:d.status})),http:second.http};
        const manifest=await exportNpbBackup(remote,join(root,"export"),"turso-remote");
        const scratch=openDataClient(`file:${join(root,"restored.db")}`);
        try { await restoreNpbBackup(scratch,join(root,"export"));
          const readback=await verifyRestoredNpbRepository(scratch);
          backup={schemaVersion:manifest.schemaVersion,countsMatch:JSON.stringify((await remote.execute(countsSql)).rows[0])===
            JSON.stringify((await scratch.execute(countsSql)).rows[0]),readback};
        } finally {scratch.close();}
      }
    } finally { if(target!==remote) target.close(); }
  }
  const after=(await remote.execute(countsSql)).rows[0];
  if(mode!=="ingest" && JSON.stringify(before)!==JSON.stringify(after)) throw new Error("Read-only counts changed");
  const coverage=await new NpbPeriodCoverageRepository(remote).findPeriodCoverage(window);
  const report={mode,from,to,targetDates:dates.length,futureDates:Math.max(0, Math.round((Date.parse("2026-10-07")-Date.parse(to))/86400000)),
    before,after,beforeCoverage:beforeCoverage.summary,coverage,result,replay,backup};
  await writeFile(".data/batch-b/report.json",JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
} finally {remote.close();}
