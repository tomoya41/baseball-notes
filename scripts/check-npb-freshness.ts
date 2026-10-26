import { openDataClient } from "../src/data/database";
import { checkPublishedNpbFreshness, evaluateNpbDailyHealth,
  inspectLatestScheduledAction, failsRequiredNpbHealth } from "../src/data/npb-freshness";
import { canRetainNpbSnapshot } from "../src/data/npb-season-lifecycle";
import { inspectNpbDatabaseDiagnostics } from "../src/data/npb-freshness-diagnostics";
import { inspectReadSuspension,recordReadSuspension } from "./lib/npb-db-read-suspension";
import { writeFile } from "node:fs/promises";

const publishedUrl=process.env.NPB_FRESHNESS_PAYLOAD_URL ??
  "https://tomoya41.github.io/baseball-notes/data/standings/npb/latest.json";
const deadlineHourJst=Number(process.env.NPB_FRESHNESS_DEADLINE_HOUR_JST ?? "12");
const freshness=await checkPublishedNpbFreshness(publishedUrl,{deadlineHourJst});
const dbUrl=process.env.TURSO_DATABASE_URL;
const dbToken=process.env.TURSO_AUTH_TOKEN;
const suspension=await inspectReadSuspension();
const { ingestion, ingestionError, lifecycle, lifecycleError } = dbUrl && dbToken ?
  await inspectNpbDatabaseDiagnostics(freshness.expectedEffectiveDate, () => openDataClient(dbUrl, dbToken),undefined,suspension.status) :
  { ingestion:null, ingestionError:null, lifecycle:null, lifecycleError:null };
if(suspension.status==="open"&&(ingestionError?.code==="BLOCKED"||lifecycleError?.code==="BLOCKED"))await recordReadSuspension({code:"BLOCKED"},{readOnly:true,runId:process.env.GITHUB_RUN_ID,envFile:process.env.GITHUB_ENV});
if(process.env.GITHUB_OUTPUT)await writeFile(process.env.GITHUB_OUTPUT,`db_diagnostics_available=${!!ingestion&&!ingestionError&&!lifecycleError}\n`,{flag:"a"});
let scheduledAction=null;
let scheduledActionError:string|null=null;
try {
  scheduledAction=await inspectLatestScheduledAction(process.env.GITHUB_REPOSITORY ?? "tomoya41/baseball-notes",
    process.env.GITHUB_TOKEN);
} catch(error) { scheduledActionError=String(error); }
const summary=evaluateNpbDailyHealth(freshness,ingestion,scheduledAction);
const retainedSnapshot=canRetainNpbSnapshot(freshness,ingestion,scheduledAction,lifecycle);
process.stdout.write(`${JSON.stringify({...summary,ingestionError,scheduledActionError,lifecycle,lifecycleError,dbReadSuspension:suspension,
  retentionVerified:retainedSnapshot,
  operationMode:lifecycle?.calendar.skip ? "outside_reviewed_calendar" : "daily_freshness_required",
  lifecycleNote:retainedSnapshot ? "DB/public saved snapshot agreement verified; Current freshness and health failures still apply. Not no-game, confirmed season end or Scheduled proof." :
    lifecycle?.calendar.skip ? "Outside reviewed acquisition calendar; saved snapshot retention has not been verified. Current freshness and health failures still apply." : null},null,2)}\n`);
if(process.argv.includes("--require-healthy") && failsRequiredNpbHealth(summary,Boolean(ingestionError || scheduledActionError || lifecycleError))) process.exitCode=1;
