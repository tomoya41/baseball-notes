import { openDataClient } from "../src/data/database";
import { checkPublishedNpbFreshness, diagnoseNpbIngestion, evaluateNpbDailyHealth,
  inspectLatestScheduledAction } from "../src/data/npb-freshness";

const publishedUrl=process.env.NPB_FRESHNESS_PAYLOAD_URL ??
  "https://tomoya41.github.io/baseball-notes/data/standings/npb/latest.json";
const deadlineHourJst=Number(process.env.NPB_FRESHNESS_DEADLINE_HOUR_JST ?? "12");
const freshness=await checkPublishedNpbFreshness(publishedUrl,{deadlineHourJst});
const dbUrl=process.env.TURSO_DATABASE_URL;
const dbToken=process.env.TURSO_AUTH_TOKEN;
let ingestion=null;
if(dbUrl && dbToken) {
  const client=openDataClient(dbUrl,dbToken);
  try { ingestion=await diagnoseNpbIngestion(client,freshness.expectedEffectiveDate); }
  finally { client.close(); }
}
let scheduledAction=null;
let scheduledActionError:string|null=null;
try {
  scheduledAction=await inspectLatestScheduledAction(process.env.GITHUB_REPOSITORY ?? "tomoya41/baseball-notes",
    process.env.GITHUB_TOKEN);
} catch(error) { scheduledActionError=String(error); }
const summary=evaluateNpbDailyHealth(freshness,ingestion,scheduledAction);
process.stdout.write(`${JSON.stringify({...summary,scheduledActionError},null,2)}\n`);
if(process.argv.includes("--require-healthy") &&
  (scheduledActionError || (freshness.deadlinePassed && summary.health!=="healthy"))) process.exitCode=1;
