import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { npbHistoricalDatasetSchema, npbHistoricalManifestSchema } from "../src/domain/npb-historical";
import release from "../src/data/npb-historical-release.json";
import bridges from "../src/data/npb-free-profile-identities.json";

const local=process.argv.find(a=>a.startsWith("--input="))?.slice(8), target=process.argv.find(a=>a.startsWith("--output="))?.slice(9) ?? "dist/data/npb/historical";
const started=performance.now();
const cache=join(".data","npb-history-release",`${release.sha256}.gz`);
const saved=local?null:await readFile(cache).catch(()=>null);
const validSaved=saved&&createHash("sha256").update(saved).digest("hex")===release.sha256?saved:null;
const response=local||validSaved ? null : await fetch(release.assetUrl,{signal:AbortSignal.timeout(30000)});
if(response && !response.ok) throw Error(`Pinned NPB Historical release HTTP ${response.status}`);
const bytes=local ? await readFile(local) : validSaved ?? Buffer.from(await response!.arrayBuffer());
if(bytes.length>2_000_000 || createHash("sha256").update(bytes).digest("hex")!==release.sha256) throw Error("NPB Historical release hash/size mismatch");
const dataset=npbHistoricalDatasetSchema.parse(JSON.parse(gunzipSync(bytes,{maxOutputLength:10_000_000}).toString("utf8")));
if(dataset.inputSha256!==release.inputSha256 || dataset.players.some(p=>!bridges.some(b=>b.playerId===p.playerId&&b.npbId===p.npbId&&b.wikidataId===p.wikidataId))) throw Error("Unverified NPB Historical canonical identity");
await mkdir(join(".data","npb-history-release"),{recursive:true});await writeFile(cache,bytes);
const seasons=[];
await mkdir(target,{recursive:true});
for(const season of [...new Set(dataset.rows.map(r=>r.season))].sort((a,b)=>a-b)) {
  const rows=dataset.rows.filter(r=>r.season===season),ids=new Set(rows.map(r=>r.playerId));
  const body=JSON.stringify(npbHistoricalDatasetSchema.parse({...dataset,rows,players:dataset.players.filter(p=>ids.has(p.playerId))}));
  const sha256=createHash("sha256").update(body).digest("hex");
  seasons.push({season,rows:rows.length,players:ids.size,sha256,bytes:Buffer.byteLength(body)});
  await writeFile(join(target,`${season}.json`),body);
}
const manifest=npbHistoricalManifestSchema.parse({schemaVersion:1,league:"NPB",competition:"regular",temporalScope:"historical",coverage:"partial",license:dataset.license,inputSha256:dataset.inputSha256,observedAt:dataset.observedAt,seasons,
  players:dataset.players.map(p=>({playerId:p.playerId,name:p.name,seasons:[...new Set(dataset.rows.filter(r=>r.playerId===p.playerId).map(r=>r.season))].sort((a,b)=>a-b)}))});
await writeFile(join(target,"manifest.json"),JSON.stringify(manifest));
console.log(JSON.stringify({historicalFiles:seasons.length+1,archiveBytes:bytes.length,publicBytes:seasons.reduce((s,y)=>s+y.bytes,Buffer.byteLength(JSON.stringify(manifest))),maxPayload:Math.max(...seasons.map(s=>s.bytes)),generationMs:Math.round(performance.now()-started),canonicalWrites:0,sourceRequests:0}));
