import { mkdir,readFile,writeFile,rename,unlink } from "node:fs/promises";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
import { z } from "zod";

export const readSuspensionPath=".data/npb-db-read-suspension.json";
const day=24*60*60*1000;
const schema=z.strictObject({schemaVersion:z.literal(1),reason:z.literal("DATABASE_READ_BLOCKED"),observedAt:z.iso.datetime(),retryAfter:z.iso.datetime(),runId:z.string().regex(/^(?:local|[1-9]\d*)$/)});
export async function inspectReadSuspension(path=readSuspensionPath,now=new Date()) {
  let raw:string;
  try{raw=await readFile(path,"utf8");}catch(error){
    if(error&&typeof error==="object"&&"code" in error&&error.code==="ENOENT")return {status:"open" as const,probeDue:false};
    return {status:"invalid" as const};
  }
  try{
    const state=schema.parse(JSON.parse(raw)),at=Date.parse(state.observedAt),until=Date.parse(state.retryAfter);
    if(at>now.getTime()||until-at!==day)return {status:"invalid" as const};
    return {status:until>now.getTime()?"deferred" as const:"open" as const,probeDue:until<=now.getTime(),state};
  }catch{return {status:"invalid" as const};}
}
type Context={readOnly:boolean;runId?:string|undefined;envFile?:string|undefined;path?:string;now?:Date};
let pending:Promise<unknown>=Promise.resolve();
/** Only a BLOCKED error returned by an actual read operation may create this state.
 * No exception text, SQL, URL, credentials, Facts or health evidence is persisted. */
export function recordReadSuspension(error:unknown,context:Context) {
  const result=pending.then(async()=>{
    if(!context.readOnly||!error||typeof error!=="object"||!("code" in error)||error.code!=="BLOCKED")return false;
    const path=context.path??readSuspensionPath,now=context.now??new Date(),existing=await inspectReadSuspension(path,now);
    if(existing.status==="deferred")return false; // Never extend a restored reservation.
    if(existing.status==="invalid")throw Error("Invalid database read suspension state");
    const state=schema.parse({schemaVersion:1,reason:"DATABASE_READ_BLOCKED",observedAt:now.toISOString(),retryAfter:new Date(now.getTime()+day).toISOString(),runId:context.runId??"local"});
    await mkdir(dirname(path),{recursive:true});const temp=`${path}.${randomUUID()}.tmp`;
    try{await writeFile(temp,JSON.stringify(state),{flag:"wx"});await rename(temp,path);}
    finally{await unlink(temp).catch(error=>{if(error.code!=="ENOENT")throw error;});}
    if(context.envFile)await writeFile(context.envFile,"NPB_DB_READ_BLOCKED_RECORDED=true\n",{flag:"a"});
    return true;
  });
  pending=result.then(()=>undefined,()=>undefined);return result;
}
