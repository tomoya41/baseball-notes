import { openDataClient } from "../src/data/database";
import { checkPublishedNpbFreshness, diagnoseNpbIngestion, evaluateNpbDailyHealth,
  inspectLatestScheduledAction } from "../src/data/npb-freshness";
import { inspectNpbCalendar, canRetainNpbSnapshot } from "../src/data/npb-season-lifecycle";

const publishedUrl=process.env.NPB_FRESHNESS_PAYLOAD_URL ??
  "https://tomoya41.github.io/baseball-notes/data/standings/npb/latest.json";
const deadlineHourJst=Number(process.env.NPB_FRESHNESS_DEADLINE_HOUR_JST ?? "12");
const freshness=await checkPublishedNpbFreshness(publishedUrl,{deadlineHourJst});
const dbUrl=process.env.TURSO_DATABASE_URL;
const dbToken=process.env.TURSO_AUTH_TOKEN;
let ingestion=null;
let lifecycle: Awaited<ReturnType<typeof inspectNpbCalendar>> | null = null;
let lifecycleError: string | null = null;
if(dbUrl && dbToken) {
  const client=openDataClient(dbUrl,dbToken);
  try {
    ingestion=await diagnoseNpbIngestion(client,freshness.expectedEffectiveDate);
    try { lifecycle=await inspectNpbCalendar(client,freshness.expectedEffectiveDate); }
    catch(error) { lifecycleError=error instanceof Error?error.message:"Lifecycle diagnostics unavailable"; }
  }
  finally { client.close(); }
}
let scheduledAction=null;
let scheduledActionError:string|null=null;
try {
  scheduledAction=await inspectLatestScheduledAction(process.env.GITHUB_REPOSITORY ?? "tomoya41/baseball-notes",
    process.env.GITHUB_TOKEN);
} catch(error) { scheduledActionError=String(error); }
const summary=evaluateNpbDailyHealth(freshness,ingestion,scheduledAction);
const retainedSnapshot=canRetainNpbSnapshot(freshness,ingestion,scheduledAction,lifecycle);
process.stdout.write(`${JSON.stringify({...summary,scheduledActionError,lifecycle,lifecycleError,
  operationMode:retainedSnapshot ? "retained_saved_snapshot" : "daily_freshness_required",
  lifecycleNote:lifecycle?.calendar.skip ? "Outside reviewed acquisition calendar; saved snapshot retained. Not no-game, confirmed season end, fresh Current data or Scheduled proof. Existing partial coverage and health failures remain visible." : null},null,2)}\n`);
if(process.argv.includes("--require-healthy") && (scheduledActionError || lifecycleError || (!retainedSnapshot && (
  (freshness.status!=="fresh" && (freshness.deadlinePassed || freshness.status!=="stale")) ||
  (freshness.status==="fresh" && summary.health!=="healthy"))))) process.exitCode=1;
