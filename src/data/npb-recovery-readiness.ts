import type { InStatement } from "@libsql/client";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { DataClient } from "./database";
import { readNpbGameIndex } from "./npb-game-index-repository";
import { inspectNpbCalendar } from "./npb-season-lifecycle";

export function assertRecoveryQuota(raw:unknown,now:number){
  const q=z.strictObject({plan:z.literal("Free"),monthlyRowsReadLimit:z.literal(500000000),rowsReadUsed:z.number().int().nonnegative().max(400000000),observedAt:z.iso.datetime()}).parse(raw);
  const age=now-Date.parse(q.observedAt);if(age<0||age>86400000)throw Error("Recent owner-console quota evidence required");return q;
}
export function recoveryAbortFetch(signal:AbortSignal,request:typeof fetch=fetch):typeof fetch{
  return(input,init)=>{const r=new Request(input,init);return request(r,{signal:AbortSignal.any([signal,r.signal])});};
}
/** Manual bounded inspection, never collection, publication, backup or scheduled proof. */
export async function verifyRecoveryReadiness(source:DataClient,options:{mode:"connection"|"projection";asOfDate:string;now:number;quota?:unknown;cancelReads?:()=>void}){
  const started=performance.now(),queries:{sha256:string;rowsReturned:number;durationMs:number}[]=[];
  let attempted=0;const pending=new Set<Promise<unknown>>();
  if(!z.iso.date().safeParse(options.asOfDate).success||!options.asOfDate.startsWith("2026-"))throw Error("Reviewed 2026 date required");
  if(options.mode==="projection")assertRecoveryQuota(options.quota,options.now);
  let expired=false;
  const cancel=()=>{if(!expired){expired=true;try{options.cancelReads?.();}finally{source.close();}}};
  let timer:ReturnType<typeof setTimeout>;
  const deadline=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{try{cancel();}catch{/* Report the bounded failure even if cleanup fails. */}reject(Error("Recovery deadline exceeded"));},30000);});
  const read=async(statement:string|InStatement)=>{
    const sql=typeof statement==="string"?statement:statement.sql;
    if(expired||!/^\s*SELECT\b/i.test(sql)||sql.includes(";")||attempted>=8||performance.now()-started>=30000)throw Error("Read-only recovery budget exceeded");
    attempted++;const at=performance.now(),result=await Promise.race([source.execute(statement),deadline]);
    if(expired||performance.now()-started>=30000){cancel();throw Error("Recovery deadline exceeded");}
    if(result.rows.length>10000)throw Error("Recovery result budget exceeded");
    queries.push({sha256:createHash("sha256").update(sql).digest("hex"),rowsReturned:result.rows.length,durationMs:Math.round(performance.now()-at)});return result;
  };
  const client=new Proxy(source,{get(target,key){
    if(key==="execute")return(statement:string|InStatement)=>{const p=read(statement);pending.add(p);void p.then(()=>pending.delete(p),()=>pending.delete(p));return p;};
    if(["batch","executeMultiple","transaction","migrate","sync","close"].includes(String(key)))return()=>{throw Error("Recovery prohibits writes and client mutation");};
    const value:unknown=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;
  }}) as DataClient;
  try{
    await client.execute("SELECT 1");
    if(options.mode==="projection"){
      const index=await readNpbGameIndex(client,options.asOfDate);
      const lifecycle=await inspectNpbCalendar(client,options.asOfDate);
      return {status:"readable" as const,queries,attempted,writes:0,scannedRows:"not_exposed_by_client",integrityVerified:false,scheduledEvidence:false,rows:index.rows,pendingSavedGames:lifecycle.pendingSavedGames,coverage:index.coverage.status};
    }
    return {status:"readable" as const,queries,attempted,writes:0,tableScans:0,scannedRows:"not_exposed_by_client",integrityVerified:false,scheduledEvidence:false};
  }catch(error){
    return {status:error instanceof Error&&/SQL read operations are forbidden/i.test(error.message)?"reads_blocked" as const:"verification_failed" as const,queries,attempted,writes:0,scannedRows:"unknown",integrityVerified:false,scheduledEvidence:false};
  }finally{await Promise.allSettled([...pending]);clearTimeout(timer!);}
}
