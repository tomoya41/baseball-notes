import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import pin from "../src/data/npb-game-date-index-release.json";
import retained from "../src/data/npb-game-date-index-retained-releases.json";
import { validateGameDateLookup } from "../src/domain/npb-game-index";

export async function stageNpbGameDateIndex(root:string) {
  const reports=[];
  for(const release of [...retained as (typeof pin)[],pin]) {
    const cache=join(".data/npb-game-retrieval",`${release.sha256}.json`);
    let body=await readFile(cache).catch(()=>null);
    if(!body||createHash("sha256").update(body).digest("hex")!==release.sha256) {
      const response=await fetch(release.assetUrl,{signal:AbortSignal.timeout(30_000)});
      if(!response.ok)throw Error(`Game date index release HTTP ${response.status}`);
      body=Buffer.from(await response.arrayBuffer());
    }
    if(body.length!==release.bytes||body.length>64_000||createHash("sha256").update(body).digest("hex")!==release.sha256)
      throw Error("Game date index archive mismatch");
    validateGameDateLookup(JSON.parse(body.toString("utf8")),release);
    const target=join(root,"index",release.sha256);
    await mkdir(target,{recursive:true});await writeFile(join(target,"dates.json"),body);
    await mkdir(".data/npb-game-retrieval",{recursive:true});await writeFile(cache,body);
    reports.push({games:release.games,bytes:body.length});
  }
  return {files:reports.length,bytes:reports.reduce((n,p)=>n+p.bytes,0),games:pin.games,canonicalWrites:0};
}
