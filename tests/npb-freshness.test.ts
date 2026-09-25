import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { migrateData, openDataClient, type DataClient } from "../src/data/database";
import { parseNf3Standings } from "../src/data/npb-nf3";
import { checkPublishedNpbFreshness, diagnoseNpbIngestion, evaluateNpbDailyHealth,
  expectedNpbEffectiveDate, freshnessDeadlinePassed, inspectLatestScheduledAction,
  type DayRunHealth, type IngestionHealth, type PublishedFreshness } from "../src/data/npb-freshness";
import type { NpbLatestStandings } from "../src/domain/standings";

const fixture=readFileSync(fileURLToPath(new URL("./fixtures/nf3/standings.html",import.meta.url)),"utf8");
const now=new Date("2026-09-26T03:17:00Z"); // 12:17 JST
const at="2026-09-26T00:00:00Z";
const clients:DataClient[]=[];
afterEach(()=>{for(const client of clients.splice(0)) client.close();});

function payload(date:string):NpbLatestStandings {
  const standings=parseNf3Standings(fixture,date,at);
  return {schemaVersion:1,league:"NPB",throughDate:date,effectiveDate:date,generatedAt:at,
    collectedAt:at,sourceUpdatedAt:null,sourceKey:"nf3",attribution:"nf3",
    teams:Object.fromEntries(standings.map((row)=>[row.teamId,{name:row.teamId,short:row.teamId}])),standings};
}
function response(value:unknown,status=200):typeof fetch {
  return (async()=>new Response(JSON.stringify(value),{status})) as typeof fetch;
}
function day(overrides:Partial<DayRunHealth>={}):DayRunHealth {
  return {runId:"run",targetDate:"2026-09-25",trigger:"scheduled",dayStatus:"complete",
    operationalStatus:"succeeded",finalGames:6,completeGames:6,partialGames:0,failedGames:0,
    batterRows:180,pitcherRows:60,backupStatus:"exported",finishedAt:at,...overrides};
}
function ingestion(run:DayRunHealth|null=day()):IngestionHealth {
  return {latestScheduledRun:run,latestDayRun:run,targetDayRun:run,
    latestSuccessfulTargetDate:run?.targetDate??null,latestStandingsDate:"2026-09-25"};
}
function fresh():PublishedFreshness {
  return {status:"fresh",expectedEffectiveDate:"2026-09-25",publishedEffectiveDate:"2026-09-25",
    checkedAtUtc:now.toISOString(),checkedAtJst:"2026-09-26 12:17:00",deadlineHourJst:12,
    deadlinePassed:true,httpStatus:200,error:null};
}

describe("NPB published freshness",()=>{
  it("uses JST across the UTC boundary and accepts delayed execution",()=>{
    expect(expectedNpbEffectiveDate(new Date("2026-09-25T16:00:00Z"))).toBe("2026-09-25");
    expect(expectedNpbEffectiveDate(now)).toBe("2026-09-25");
    expect(freshnessDeadlinePassed(new Date("2026-09-26T02:59:59Z"),12)).toBe(false);
    expect(freshnessDeadlinePassed(now,12)).toBe(true);
    expect(()=>freshnessDeadlinePassed(now,24)).toThrow(/deadline hour/);
  });
  it("checks actual JSON and bypasses intermediary cache",async()=>{
    let requested="";let cache="";
    const request=(async(input:RequestInfo|URL,init?:RequestInit)=>{
      requested=String(input);cache=String(init?.cache);
      return new Response(JSON.stringify(payload("2026-09-25")));
    }) as typeof fetch;
    const result=await checkPublishedNpbFreshness("https://example.test/latest.json",{now,request});
    expect(result).toMatchObject({status:"fresh",expectedEffectiveDate:"2026-09-25",
      publishedEffectiveDate:"2026-09-25",deadlinePassed:true});
    expect(requested).toContain("npb_freshness_check=");
    expect(cache).toBe("no-store");
  });
  it("separates stale, future, missing date, invalid JSON and HTTP failure",async()=>{
    const check=(request:typeof fetch)=>checkPublishedNpbFreshness("https://example.test/latest.json",{now,request});
    expect((await check(response(payload("2026-09-24")))).status).toBe("stale");
    expect((await check(response(payload("2026-09-26")))).status).toBe("future_date");
    const missing={...payload("2026-09-25"),effectiveDate:undefined};
    expect((await check(response(missing))).status).toBe("invalid_payload");
    expect((await check((async()=>new Response("broken json")) as typeof fetch)).status).toBe("invalid_payload");
    expect((await check(response({},503))).status).toBe("unreachable");
    expect((await check((async()=>{throw new Error("offline");}) as typeof fetch)).status).toBe("unreachable");
  });
});

describe("NPB daily health",()=>{
  it("keeps freshness and completeness separate",()=>{
    expect(evaluateNpbDailyHealth(fresh(),ingestion()).health).toBe("healthy");
    expect(evaluateNpbDailyHealth(fresh(),ingestion(day({dayStatus:"partial",completeGames:5,partialGames:1}))).health).toBe("warning");
    expect(evaluateNpbDailyHealth(fresh(),ingestion(day({backupStatus:"failed",operationalStatus:"completed_with_warning"}))).health).toBe("warning");
    expect(evaluateNpbDailyHealth({...fresh(),status:"stale",publishedEffectiveDate:"2026-09-24"},ingestion()).health).toBe("unhealthy");
    expect(evaluateNpbDailyHealth({...fresh(),status:"stale"},ingestion()).likelyFault).toBe("publish");
    expect(evaluateNpbDailyHealth({...fresh(),status:"stale"},{...ingestion(),latestStandingsDate:"2026-09-24"}).likelyFault).toBe("collector");
    expect(evaluateNpbDailyHealth({...fresh(),status:"stale",deadlinePassed:false},ingestion()).health).toBe("warning");
  });
  it("treats a no-games day as healthy without a Fact backup",()=>{
    expect(evaluateNpbDailyHealth(fresh(),ingestion(day({dayStatus:"no_games",finalGames:0,
      completeGames:0,batterRows:0,pitcherRows:0,backupStatus:"pending"}))).health).toBe("healthy");
  });
  it("warns when the relevant scheduled encrypted artifact is missing",()=>{
    const action={runId:1,startedAt:at,conclusion:"success",url:"https://example.test/run",
      inferredTargetDate:"2026-09-25",encryptedBackupArtifact:"missing" as const};
    expect(evaluateNpbDailyHealth(fresh(),ingestion(),action).health).toBe("warning");
  });
  it("reads day-run metadata from SQLite without changing it",async()=>{
    const client=openDataClient("file::memory:");clients.push(client);await migrateData(client);
    await client.execute({sql:`INSERT INTO npb_day_runs VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args:["run","2026-09-25","scheduled",at,at,"complete","succeeded",6,6,6,0,0,180,60,0,286,0,"exported",null]});
    const result=await diagnoseNpbIngestion(client,"2026-09-25");
    expect(result.targetDayRun).toMatchObject({trigger:"scheduled",dayStatus:"complete",batterRows:180,pitcherRows:60});
    expect(result.latestSuccessfulTargetDate).toBe("2026-09-25");
    expect(result.latestStandingsDate).toBeNull();
  });
  it("finds the scheduled Action and its encrypted Artifact",async()=>{
    const request=(async(input:RequestInfo|URL)=>new Response(JSON.stringify(String(input).includes("/artifacts?") ?
      {artifacts:[{name:"npb-facts-encrypted-42",expired:false}]} :
      {workflow_runs:[{id:42,run_started_at:"2026-09-26T00:00:00Z",conclusion:"success",html_url:"https://example.test/42"}]}))) as typeof fetch;
    expect(await inspectLatestScheduledAction("owner/repo",undefined,request)).toMatchObject({runId:42,
      inferredTargetDate:"2026-09-25",encryptedBackupArtifact:"present"});
  });
});
