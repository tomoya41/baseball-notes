import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { backupSizeBytes, exportNpbBackup, restoreNpbBackup, verifyRestoredNpbRepository } from "../src/data/npb-backup";
import { migrateData, openDataClient } from "../src/data/database";
import { previousJstDate, recordDayBackup, runNpbDayFacts } from "../src/data/npb-day-collector";

const args=new Set(process.argv.slice(2));
const value=(key:string)=>[...args].find((arg)=>arg.startsWith(`${key}=`))?.slice(key.length+1);
const targetDate=value("--date")??previousJstDate();
const dryRun=args.has("--dry-run");
const controlledHistory=args.has("--controlled-history");
if(controlledHistory && targetDate!=="2026-09-23") throw new Error("Controlled-history bypass only permits 2026-09-23");
if(!dryRun && !args.has("--fetch")) throw new Error("Real ingestion requires --fetch");
const trigger=value("--trigger")??"manual";
if(trigger!=="manual" && trigger!=="scheduled" && trigger!=="repair") throw new Error("Invalid trigger");
const url=process.env.TURSO_DATABASE_URL??"file:.data/baseball.db";
if(args.has("--require-remote") && (url.startsWith("file:") || !process.env.TURSO_AUTH_TOKEN))
  throw new Error("Remote Turso URL and token required");
await mkdir(".data",{recursive:true});
const client=openDataClient(url,process.env.TURSO_AUTH_TOKEN);
try {
  if(!dryRun) await migrateData(client);
  const result=await runNpbDayFacts(client,{targetDate,trigger,dryRun,
    rawRoot:args.has("--reuse-local-raw")?".data/raw":undefined,
    requireCompleteGameStage:!controlledHistory});
  process.stdout.write(`${JSON.stringify(result,null,2)}\n`);
  if(result.status==="partial" || result.status==="failed") process.exitCode=1;
  if(!dryRun && result.completeGames>0) {
    const root=value("--backup-root")??join(".data",`npb-day-backup-${targetDate}-${result.runId}`);
    try {
      await mkdir(root,{recursive:true});
      const backup=join(root,"export");
      const manifest=await exportNpbBackup(client,backup,url.startsWith("file:")?"local":"turso-remote");
      const scratch=openDataClient(`file:${join(root,"restore-check.db")}`);
      try {
        await restoreNpbBackup(scratch,backup);
        await verifyRestoredNpbRepository(scratch);
      } finally {scratch.close();}
      await recordDayBackup(client,result.runId,true);
      process.stdout.write(`${JSON.stringify({backup:"PASS",root,compressedBytes:await backupSizeBytes(backup),
        schemaVersion:manifest.schemaVersion},null,2)}\n`);
    } catch(error) {
      await recordDayBackup(client,result.runId,false,error);
      process.stderr.write(`Backup warning: ${String(error)}\n`);
      process.exitCode=1;
    }
  }
} finally {client.close();}
