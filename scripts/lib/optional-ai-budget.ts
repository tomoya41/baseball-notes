import { mkdir,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";
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
