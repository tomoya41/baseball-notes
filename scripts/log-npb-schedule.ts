import { scheduleObservation } from "../src/application/npb-schedule-observability";
import { jstToday, addDays } from "../src/data/npb-collector";
const started=process.env.NPB_RUNNER_STARTED_AT;
if(!started)throw Error("Runner start timestamp required");
const response=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,{
  headers:{Authorization:`Bearer ${process.env.GITHUB_TOKEN}`,Accept:"application/vnd.github+json"}});
if(!response.ok)throw Error("Run metadata unavailable");
const run=await response.json() as {created_at:string;event:string};
const target=process.env.NPB_TARGET_DATE??addDays(jstToday(new Date(started)),process.env.NPB_TARGET_DATE_MODE==="today"?0:-1);
console.log(JSON.stringify(run.event==="schedule"?scheduleObservation({workflowName:process.env.GITHUB_WORKFLOW??"NPB",
  cron:process.env.NPB_CRON??"",runCreatedAt:run.created_at,runnerStartedAt:started,targetDate:target,
  timezone:process.env.NPB_SCHEDULE_TIMEZONE==="Asia/Tokyo"?"Asia/Tokyo":"UTC"}):
  {event:run.event,runnerStartedAt:started,runCreatedAt:run.created_at,targetJstDate:target,scheduledProof:false}));
if(process.env.GITHUB_ENV) {
  const {appendFile}=await import("node:fs/promises");
  await appendFile(process.env.GITHUB_ENV,`NPB_RUN_CREATED_AT=${run.created_at}\n`);
}
