import { readFile,readdir,writeFile } from "node:fs/promises";
import { join,relative } from "node:path";
import { createHash } from "node:crypto";
export async function verifyFormPreservation(before:string,after:string) {
  let files=0,bytes=0;const failures:string[]=[];
  async function walk(dir:string){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await walk(path);else {const key=relative(before,path);if(key.replaceAll("\\","/").includes("exploration/form/"))continue;const old=await readFile(path);let current:Buffer;try{current=await readFile(join(after,key));}catch{failures.push(key);continue;}if(createHash("sha256").update(old).digest("hex")!==createHash("sha256").update(current).digest("hex"))failures.push(key);files++;bytes+=old.length;}}}
  await walk(before);if(failures.length)throw Error(`Protected Historical payload changed: ${failures.slice(0,5).join(",")}`);
  return {result:"PASS",files,bytes,changed:0,canonicalWrites:0};
}
if(process.argv[1]?.replaceAll("\\","/").endsWith("verify-form-preservation.ts")){if(!process.argv[2]||!process.argv[3])throw Error("Explicit baseline and staged roots required");const report=await verifyFormPreservation(process.argv[2],process.argv[3]);await writeFile(process.argv[4]??".data/form-preservation.json",JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
