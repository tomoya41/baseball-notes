import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { npbHistoricalDatasetSchema, npbHistoricalManifestSchema } from "../src/domain/npb-historical";
import release from "../src/data/npb-historical-release.json";
import legacy from "../src/data/npb-historical-legacy-release.json";
import retainedReleases from "../src/data/npb-historical-retained-releases.json";
import { assertHistoricalBridge } from "../src/infrastructure/providers/npb-historical-admission";
import { stageNpbCompetition } from "./stage-npb-competition";
import { stageNpbCs } from "./stage-npb-cs";

const local=process.argv.find(a=>a.startsWith("--input="))?.slice(8), target=process.argv.find(a=>a.startsWith("--output="))?.slice(9) ?? "dist/data/npb/historical";
const started=performance.now();
async function stage(pin:typeof release, destination:string, input?:string) {
const cache=join(".data","npb-history-release",`${pin.sha256}.gz`);
const saved=input?null:await readFile(cache).catch(()=>null);
const validSaved=saved&&createHash("sha256").update(saved).digest("hex")===pin.sha256?saved:null;
const response=input||validSaved ? null : await fetch(pin.assetUrl,{signal:AbortSignal.timeout(30000)});
if(response && !response.ok) throw Error(`Pinned NPB Historical release HTTP ${response.status}`);
const bytes=input ? await readFile(input) : validSaved ?? Buffer.from(await response!.arrayBuffer());
if(bytes.length>2_000_000 || createHash("sha256").update(bytes).digest("hex")!==pin.sha256) throw Error("NPB Historical release hash/size mismatch");
const dataset=npbHistoricalDatasetSchema.parse(JSON.parse(gunzipSync(bytes,{maxOutputLength:10_000_000}).toString("utf8")));
if(dataset.inputSha256!==pin.inputSha256)throw Error("Unadmitted archive");
for(const p of dataset.players)assertHistoricalBridge(p,p);
await mkdir(join(".data","npb-history-release"),{recursive:true});await writeFile(cache,bytes);
const seasons=[];
await mkdir(destination,{recursive:true});
for(const season of [...new Set(dataset.rows.map(r=>r.season))].sort((a,b)=>a-b)) {
  const rows=dataset.rows.filter(r=>r.season===season),ids=new Set(rows.map(r=>r.playerId));
  const body=JSON.stringify(npbHistoricalDatasetSchema.parse({...dataset,rows,players:dataset.players.filter(p=>ids.has(p.playerId))}));
  const sha256=createHash("sha256").update(body).digest("hex");
  seasons.push({season,rows:rows.length,players:ids.size,sha256,bytes:Buffer.byteLength(body)});
  await writeFile(join(destination,`${season}.json`),body);
}
const manifest=npbHistoricalManifestSchema.parse({schemaVersion:1,league:"NPB",competition:"regular",temporalScope:"historical",coverage:"partial",license:dataset.license,inputSha256:dataset.inputSha256,observedAt:dataset.observedAt,seasons,
  players:dataset.players.map(p=>({playerId:p.playerId,name:p.name,...(p.identityScope?{identityScope:p.identityScope}:{}),...(p.birthDate?{birthDate:p.birthDate}:{}),seasons:[...new Set(dataset.rows.filter(r=>r.playerId===p.playerId).map(r=>r.season))].sort((a,b)=>a-b)}))});
await writeFile(join(destination,"manifest.json"),JSON.stringify(manifest));
return {generation:pin.sha256,historicalFiles:seasons.length+1,archiveBytes:bytes.length,publicBytes:seasons.reduce((s,y)=>s+y.bytes,Buffer.byteLength(JSON.stringify(manifest))),maxPayload:Math.max(...seasons.map(s=>s.bytes)),generationMs:Math.round(performance.now()-started),canonicalWrites:0,sourceRequests:response?1:0};
}
const retained=await stage(legacy,target);
for(const pin of retainedReleases) await stage(pin,join(target,pin.sha256));
const current=await stage(release,join(target,release.sha256),local);
const competition=await stageNpbCompetition(join(target,"..","competitions"));
const cs=await stageNpbCs(join(target,"..","competitions"));
const { stageNpbSeries } = await import("./stage-npb-series");
const series = await stageNpbSeries(join(target,"..","competitions"));
const { stageNpbJapanSeries } = await import("./stage-npb-japan-series");
const japan = await stageNpbJapanSeries(join(target,"..","competitions"));
const { stageNpbDraft } = await import("./stage-npb-draft");
const draft = await stageNpbDraft(join(target,"..","draft"));
const { stageNpbFinalDraft } = await import("./stage-npb-draft-final");
const finalDraft = await stageNpbFinalDraft(join(target,"..","draft"));
const { stageNpbPlayerEvents } = await import("./stage-npb-player-events");
const events = await stageNpbPlayerEvents(join(target,"..","events"));
console.log(JSON.stringify({retained,current,competition,cs,series,japan,draft,finalDraft,events}));
