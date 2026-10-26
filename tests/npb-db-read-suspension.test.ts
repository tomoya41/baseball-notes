import { it,expect,vi } from "vitest";
import { mkdtemp,readFile,writeFile,mkdir,rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join,resolve } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { parse } from "yaml";
import { inspectReadSuspension,recordReadSuspension } from "../scripts/lib/npb-db-read-suspension";
import { inspectNpbDatabaseDiagnostics } from "../src/data/npb-freshness-diagnostics";
import { planNpbWatchCalendar } from "../src/data/npb-season-lifecycle";
import type { DataClient } from "../src/data/database";

const at=new Date("2026-10-26T01:00:00Z"),blocked={code:"BLOCKED",message:"private SQL and credentials must not be retained"};
it("reserves one fixed 24h read suspension, retaining neither error text nor deferred extensions",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"npb-read-state-")),path=join(dir,"state.json"),envFile=join(dir,"env");
 try{
  expect(await inspectReadSuspension(path,at)).toMatchObject({status:"open",probeDue:false});
  expect(await recordReadSuspension(blocked,{readOnly:false,path,now:at})).toBe(false);
  expect(await recordReadSuspension({code:"UNAUTHORIZED"},{readOnly:true,path,now:at})).toBe(false);
  const results=await Promise.all([1,2].map(n=>recordReadSuspension(blocked,{readOnly:true,path,now:at,runId:String(n),envFile})));
  expect(results).toEqual([true,false]);const original=await readFile(path,"utf8");
  expect(original).not.toMatch(/private|credentials|SQL and/);expect(await readFile(envFile,"utf8")).toBe("NPB_DB_READ_BLOCKED_RECORDED=true\n");
  expect(await inspectReadSuspension(path,new Date("2026-10-27T00:59:59Z"))).toMatchObject({status:"deferred"});
  expect(await recordReadSuspension(blocked,{readOnly:true,path,now:new Date("2026-10-26T23:00:00Z")})).toBe(false);
  expect(await readFile(path,"utf8")).toBe(original);
  expect(await inspectReadSuspension(path,new Date("2026-10-27T01:00:00Z"))).toMatchObject({status:"open",probeDue:true});
  expect(await recordReadSuspension(blocked,{readOnly:true,path,now:new Date("2026-10-27T01:01:00Z")})).toBe(true);
 }finally{await rm(dir,{recursive:true,force:true});}
});
it("fails closed on corrupted, future or arbitrarily extended cache state",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"npb-read-invalid-")),path=join(dir,"state.json");
 try{
  for(const value of [{schemaVersion:1}, {schemaVersion:1,reason:"DATABASE_READ_BLOCKED",runId:"1",observedAt:at.toISOString(),retryAfter:"2026-10-29T01:00:00Z"}]){
   await writeFile(path,JSON.stringify(value));expect((await inspectReadSuspension(path,at)).status).toBe("invalid");
  }
  await writeFile(path,JSON.stringify({schemaVersion:1,reason:"DATABASE_READ_BLOCKED",runId:"1",observedAt:"2026-10-27T01:00:00Z",retryAfter:"2026-10-28T01:00:00Z"}));
  expect((await inspectReadSuspension(path,at)).status).toBe("invalid");
 }finally{await rm(dir,{recursive:true,force:true});}
});
it("keeps independent Freshness diagnosis available without opening a blocked database",async()=>{
 const open=vi.fn(()=>{throw Error("Must not connect");});
 for(const permission of ["deferred","invalid"] as const){const r=await inspectNpbDatabaseDiagnostics("2026-10-26",open,undefined,permission);expect(r.ingestion).toBe(null);expect(r.lifecycle).toBe(null);expect(r.ingestionError?.code).toBe(permission==="deferred"?"BLOCKED":"UNAVAILABLE");}
 expect(open).not.toHaveBeenCalled();
});
it("does not enumerate in-range Games twice, and never ignores a saved out-of-calendar fixture",async()=>{
 const execute=vi.fn().mockResolvedValue({rows:[{count:0}]}),client={execute} as unknown as DataClient;
 expect(await planNpbWatchCalendar(client,"2026-09-27")).toMatchObject({skip:false});expect(execute).not.toHaveBeenCalled();
 expect(await planNpbWatchCalendar(client,"2026-10-26")).toMatchObject({skip:true});expect(execute).toHaveBeenCalledOnce();
 execute.mockResolvedValue({rows:[{count:1}]});await expect(planNpbWatchCalendar(client,"2026-10-26")).rejects.toThrow("metadata review");
 execute.mockClear();await expect(planNpbWatchCalendar(client,"2027-03-01")).rejects.toThrow("metadata unavailable");expect(execute).not.toHaveBeenCalled();
});
it("the actual watcher CLI defers before opening a client and creates no collection/publication proof",async()=>{
 const dir=await mkdtemp(join(tmpdir(),"npb-read-cli-"));
 try{
  await mkdir(join(dir,".data"));await recordReadSuspension(blocked,{readOnly:true,path:join(dir,".data/npb-db-read-suspension.json"),now:new Date()});
  await expect(promisify(execFile)(process.execPath,["--import",import.meta.resolve("tsx"),resolve("scripts/npb-eod.ts"),"--action=watch","--date=2026-10-26"],{cwd:dir,env:{...process.env,TURSO_DATABASE_URL:"libsql://127.0.0.1:1",TURSO_AUTH_TOKEN:"private-test-token"},timeout:15000})).rejects.toMatchObject({code:1});
  const r=JSON.parse(await readFile(join(dir,".data/eod/watch.json"),"utf8"));expect(r).toMatchObject({dbReads:0,dbWrites:0,http:{httpRequests:0},scheduledFactEvidence:false,result:{mode:"unavailable",publishRequired:false,publishPerformed:false}});
  expect(JSON.stringify(r)).not.toMatch(/private-test-token|no_games|healthy|127\.0\.0\.1/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
it("production workflows share main-scoped bounded state; dry-run/normal skips avoid connection probes",()=>{
 for(const name of ["npb-eod-watcher","npb-schedule-sync","daily-collector","npb-freshness"]){
  const w=parse(readFileSync(`.github/workflows/${name}.yml`,"utf8")),steps=Object.values(w.jobs).flatMap((j)=>((j as {steps:Record<string,unknown>[]}).steps??[]));
  expect(steps.some(s=>s.uses==="actions/cache/restore@v4"&&(s.with as {path:string}).path===".data/npb-db-read-suspension.json")).toBe(true);
  expect(steps.some(s=>s.uses==="actions/cache/save@v4"&&String(s.if).includes("NPB_DB_READ_BLOCKED_RECORDED"))).toBe(true);
  expect(steps.some(s=>s.name==="Production DB operations require the main branch"&&String(s.if).includes("refs/heads/main"))).toBe(true);
 }
 const daily=parse(readFileSync(".github/workflows/daily-collector.yml","utf8"));expect(daily.jobs.collect.steps.find((s:{name:string})=>s.name==="Verify remote DB connection without writing").if).toContain("inputs.mode != 'dry-run'");
});
