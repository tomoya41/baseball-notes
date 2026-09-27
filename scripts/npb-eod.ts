import { mkdir, writeFile } from "node:fs/promises";
import { openDataClient, migrateData, type DataClient } from "../src/data/database";
import { jstToday } from "../src/data/npb-collector";
import { createNf3DryRunSession } from "../src/data/npb-day-dry-run";
import { scheduleRange, syncNpbSchedule, runEodWatcher, captureEodStandings, eodEvent, readEodEvent } from "../src/data/npb-eod";
import { scheduleObservation } from "../src/application/npb-schedule-observability";
import { npbLatestStandingsSchema } from "../src/domain/standings";
import { NpbRepository } from "../src/data/npb-repository";
import { currentGameComplete } from "../src/data/npb-eod";

const option=(key:string)=>process.argv.find(a=>a.startsWith(`${key}=`))?.slice(key.length+1);
const action=option("--action")??"watch",date=option("--date")??jstToday();
const url=process.env.TURSO_DATABASE_URL,token=process.env.TURSO_AUTH_TOKEN;
if(!url||url.startsWith("file:")||!token)throw Error("Remote connection required");
const source=openDataClient(url,token);let dbWrites=0,dbReads=0;
const redact=(text:string)=>text.replaceAll(url,"[database]").replaceAll(token,"[credential]");
const client=new Proxy(source,{get(target,key){
  if(key==="execute")return async(s:Parameters<DataClient["execute"]>[0])=>{
    const sql=typeof s==="string"?s:s.sql;if(/^\s*SELECT\b/i.test(sql))dbReads++;else dbWrites++;
    return target.execute(s);
  };
  if(key==="batch")return async(s:Parameters<DataClient["batch"]>[0],mode:Parameters<DataClient["batch"]>[1])=>{
    for(const item of s){const sql=typeof item==="string"?item:item.sql;if(/^\s*SELECT\b/i.test(sql))dbReads++;else dbWrites++;}
    return target.batch(s,mode);
  };
  if(key==="transaction")return async(mode:Parameters<DataClient["transaction"]>[0])=>{
    const tx=await target.transaction(mode);
    return new Proxy(tx,{get(t,k){
      if(k==="execute")return async(s:Parameters<typeof tx.execute>[0])=>{
        const sql=typeof s==="string"?s:s.sql;if(/^\s*SELECT\b/i.test(sql))dbReads++;else dbWrites++;
        return t.execute(s);
      };
      if(k==="batch")return async(s:Parameters<typeof tx.batch>[0])=>{
        for(const item of s){const sql=typeof item==="string"?item:item.sql;if(/^\s*SELECT\b/i.test(sql))dbReads++;else dbWrites++;}
        return t.batch(s);
      };
      const value=Reflect.get(t,k);return typeof value==="function"?value.bind(t):value;
    }});
  };
  const value=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;
}}) as DataClient;
const started=performance.now();let sourceCheckStartedAt:string|null=null;
const session=createNf3DryRunSession(1000);
const request=async(u:string)=>{sourceCheckStartedAt??=new Date().toISOString();return session.request(u);};
let result:unknown;
async function saveReport(error?:unknown) {
  await mkdir(".data/eod",{recursive:true});
  const report={action,date,eventName:process.env.GITHUB_EVENT_NAME??"local",result,error:error instanceof Error?error.message:error?String(error):null,
    http:session.metrics,dbReads,dbWrites,sourceCheckStartedAt,finishedAt:new Date().toISOString(),elapsedMs:performance.now()-started,
    runnerStartedAt:process.env.NPB_RUNNER_STARTED_AT??null,
    observation:process.env.NPB_RUN_CREATED_AT&&process.env.NPB_RUNNER_STARTED_AT&&process.env.NPB_CRON?
      scheduleObservation({workflowName:process.env.GITHUB_WORKFLOW??"NPB EOD",cron:process.env.NPB_CRON,
        runCreatedAt:process.env.NPB_RUN_CREATED_AT,runnerStartedAt:process.env.NPB_RUNNER_STARTED_AT,targetDate:date}):null};
  await writeFile(`.data/eod/${action}.json`,redact(JSON.stringify(report,null,2)));console.log(redact(JSON.stringify(report)));
}
try {
  if(action==="safety-check") {
    const published=await readEodEvent(client,"eod-published",date);
    const repo=new NpbRepository(client),games=await repo.findGamesByDate(date);
    let skip=Boolean(published);
    for(const game of games)if(!["final","postponed","canceled"].includes(game.status)||
      (game.status==="final"&&!await currentGameComplete(repo,game)))skip=false;
    result={skip,date};
    if(process.env.GITHUB_OUTPUT)await writeFile(process.env.GITHUB_OUTPUT,`skip=${skip}\ntarget_date=${date}\n`,{flag:"a"});
  } else if(action==="sync") {
    const mode=option("--range")??"daily";
    if(!["season","monthly","weekly","daily"].includes(mode))throw Error("Invalid range mode");
    await migrateData(client);
    result=await syncNpbSchedule(client,request,scheduleRange(mode as "season"|"monthly"|"weekly"|"daily",date));
  } else if(action==="watch") {
    result=await runEodWatcher(client,request,date,new Date(),Number(process.env.NPB_MONITOR_OFFSET_MINUTES??120),
      process.env.GITHUB_EVENT_NAME==="schedule"?"scheduled":"manual");
    const report=result as {publishRequired:boolean};
    if(report.publishRequired) {
      // If source standings lag, retain collected Facts and retry publication next watcher.
      await captureEodStandings(client,request,date);
    }
    if(process.env.GITHUB_OUTPUT)await writeFile(process.env.GITHUB_OUTPUT,
      `publish=${report.publishRequired}\ntarget_date=${date}\n`,{flag:"a"});
  } else if(action==="mark-published") {
    const publicUrl="https://tomoya41.github.io/baseball-notes/data/standings/npb/latest.json";
    const response=await fetch(`${publicUrl}?verify=${Date.now()}`);
    if(!response.ok)throw Error("Published HTTP failed");
    const payload=npbLatestStandingsSchema.parse(await response.json());
    if(payload.throughDate!==date)throw Error("Published effective date mismatch");
    const repo=new NpbRepository(client),games=await repo.findGamesByDate(date);
    for(const game of games) {
      if(!["final","postponed","canceled"].includes(game.status)||
        (game.status==="final"&&!await currentGameComplete(repo,game)))throw Error("Published Day is not currently valid");
    }
    await eodEvent(client,"eod-published",date,{publishedAt:new Date().toISOString(),runId:process.env.GITHUB_RUN_ID,publicUrl});
    result={publishPerformed:true,date};
  } else throw Error("Unknown EOD action");
  await saveReport();
} catch(error) {await saveReport(error);throw new Error("NPB EOD operation failed",{
  // eslint-disable-next-line preserve-caught-error -- An original cause may contain the connection URL/token; retain only its redacted message.
  cause:redact(error instanceof Error?error.message:String(error))});
} finally {source.close();}
