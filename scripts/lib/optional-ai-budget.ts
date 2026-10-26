import { mkdir,readdir,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";
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
export async function claimInsightAttempt(root:string,inputSha256:string,now=new Date()) {
  if(!/^[a-f0-9]{64}$/.test(inputSha256))throw Error("Invalid AI input hash");
  const directory=join(root,inputSha256);await mkdir(directory,{recursive:true});
  if(await readFile(join(directory,"attempt.json")).then(()=>true,error=>{if(error.code!=="ENOENT")throw error;return false;}))return {status:"UNCHANGED_INPUT" as const};
  try{
    await writeFile(join(root,`attempt-${now.toISOString().slice(0,10)}.json`),JSON.stringify({inputSha256}),{flag:"wx"});
    await writeFile(join(directory,"attempt.json"),JSON.stringify({at:now.toISOString()}),{flag:"wx"});
    return {status:"RESERVED" as const,directory};
  }catch(error){if(error&&typeof error==="object"&&"code" in error&&error.code==="EEXIST")return {status:"DAILY_BUDGET_OR_INFLIGHT" as const};throw error;}
}
