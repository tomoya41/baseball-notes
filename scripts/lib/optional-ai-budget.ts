import { mkdir,readdir,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import ledger from "../../config/optional-ai-attempts.json";

const attempt=z.strictObject({inputSha256:z.string().regex(/^[a-f0-9]{64}$/),recordedAt:z.iso.datetime(),workflowRunId:z.number().int().positive(),workflowRunAttempt:z.number().int().positive(),httpStatus:z.number().int().min(100).max(599),outcome:z.enum(["INVALID_OR_UNAVAILABLE_CANDIDATE","CANDIDATE_REQUIRES_REVIEW","PROVIDER_UNAVAILABLE","QUOTA_EXHAUSTED"]),evidenceUrl:z.url()});
export const aiAttemptLedgerSchema=z.strictObject({schemaVersion:z.literal(1),attempts:z.array(attempt)}).superRefine((p,c)=>{
  if(new Set(p.attempts.map(a=>a.inputSha256)).size!==p.attempts.length||new Set(p.attempts.map(a=>a.recordedAt.slice(0,10))).size!==p.attempts.length||p.attempts.some(a=>a.evidenceUrl!==`https://github.com/tomoya41/baseball-notes/actions/runs/${a.workflowRunId}`))c.addIssue({code:"custom",message:"Conflicting AI attempt ledger"});
});
export const knownInsightAttempts=aiAttemptLedgerSchema.parse(ledger).attempts;
type KnownAttempt=Pick<(typeof knownInsightAttempts)[number],"inputSha256"|"recordedAt">;
/** A newly prepared empty cache must not masquerade as restored attempt history. */
export async function restoredInsightHistory(root:string,matchedKey:string|undefined) {
  if(!matchedKey?.startsWith("npb-ai-candidates-v1-"))return false;
  try{
    const markers=(await readdir(root)).filter(p=>/^attempt-\d{4}-\d{2}-\d{2}\.json$/.test(p));
    if(!markers.length)return false;
    for(const path of markers){const value:unknown=JSON.parse(await readFile(join(root,path),"utf8"));
      if(!value||typeof value!=="object"||!("inputSha256" in value)||typeof value.inputSha256!=="string"||!/^[a-f0-9]{64}$/.test(value.inputSha256))return false;}
    return true;
  }catch{return false;}
}
/** Shared by legacy prose and structured weekly trials. Failures consume the reservation. */
export async function claimInsightAttempt(root:string,inputSha256:string,now=new Date(),known:readonly KnownAttempt[]=knownInsightAttempts) {
  if(!/^[a-f0-9]{64}$/.test(inputSha256))throw Error("Invalid AI input hash");
  // A cache eviction or lost local file cannot re-authorize a reviewed real attempt.
  if(known.some(a=>a.inputSha256===inputSha256))return {status:"UNCHANGED_INPUT" as const};
  if(known.some(a=>a.recordedAt.slice(0,10)===now.toISOString().slice(0,10)))return {status:"DAILY_BUDGET_OR_INFLIGHT" as const};
  const directory=join(root,inputSha256);await mkdir(directory,{recursive:true});
  if(await readFile(join(directory,"attempt.json")).then(()=>true,error=>{if(error.code!=="ENOENT")throw error;return false;}))return {status:"UNCHANGED_INPUT" as const};
  try{
    await writeFile(join(root,`attempt-${now.toISOString().slice(0,10)}.json`),JSON.stringify({inputSha256}),{flag:"wx"});
    await writeFile(join(directory,"attempt.json"),JSON.stringify({at:now.toISOString()}),{flag:"wx"});
    return {status:"RESERVED" as const,directory};
  }catch(error){if(error&&typeof error==="object"&&"code" in error&&error.code==="EEXIST")return {status:"DAILY_BUDGET_OR_INFLIGHT" as const};throw error;}
}
