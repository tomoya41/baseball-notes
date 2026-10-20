import { mkdir,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import pin from "../src/data/npb-draft-2026-release.json";
import retained from "../src/data/npb-draft-retained-releases.json";
import { draftEventSchema } from "../src/domain/npb-draft-event";

const hash=(b:Uint8Array|string)=>createHash("sha256").update(b).digest("hex");
export async function stageNpbDraft(root:string){
  let files=0,bytes=0;
  for(const release of [...retained,pin] as (typeof pin)[]){
    const cache=join(".data/npb-draft-release",`${release.sha256}.gz`);
    let compressed=await readFile(cache).catch(()=>null);
    if(!compressed||hash(compressed)!==release.sha256){const r=await fetch(release.assetUrl,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Draft asset HTTP ${r.status}`);compressed=Buffer.from(await r.arrayBuffer());}
    if(compressed.length>100000||hash(compressed)!==release.sha256)throw Error("Draft archive mismatch");
    const body=gunzipSync(compressed,{maxOutputLength:250000}),data=draftEventSchema.parse(JSON.parse(body.toString()));
    if(body.length!==release.bytes||hash(body)!==release.bodySha256||hash(JSON.stringify(data.forecast))!==release.forecastSha256)throw Error("Draft generation mismatch");
    const destination=join(root,release.sha256);await mkdir(destination,{recursive:true});await writeFile(join(destination,"draft-2026.json"),body);await mkdir(".data/npb-draft-release",{recursive:true});await writeFile(cache,compressed);
    files++;bytes+=body.length;
  }
  return {files,bytes,canonicalWrites:0};
}
