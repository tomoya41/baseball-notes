import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import pin from "../src/data/npb-japan-series-release.json";
import csPin from "../src/data/npb-series-release.json";
import { npbJapanSeriesSchema, assertJapanSeriesAdvancement } from "../src/domain/npb-japan-series";
import { npbPostseasonSeriesSchema } from "../src/domain/npb-postseason-series";

export async function stageNpbJapanSeries(root:string){
  const hash=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex"),cache=join(".data/npb-history-release",`${pin.sha256}.gz`);
  let archive=await readFile(cache).catch(()=>null);
  if(!archive||hash(archive)!==pin.sha256){const r=await fetch(pin.assetUrl,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Japan Series release HTTP ${r.status}`);archive=Buffer.from(await r.arrayBuffer());}
  if(archive.length>50000||hash(archive)!==pin.sha256)throw Error("Japan Series archive mismatch");
  const body=gunzipSync(archive,{maxOutputLength:50000}),csBody=await readFile(join(root,csPin.sha256,"series-2026.json"));
  if(body.length!==pin.bytes||hash(body)!==pin.bodySha256||hash(csBody)!==csPin.bodySha256||csPin.bodySha256!==pin.csSeriesBodySha256)throw Error("Japan Series generation mismatch");
  const data=npbJapanSeriesSchema.parse(JSON.parse(body.toString()));
  if(data.csSeriesBodySha256!==pin.csSeriesBodySha256||data.series.id!==pin.seriesId||JSON.stringify(data.series.games.map(g=>g.gameId))!==JSON.stringify(pin.gameIds))throw Error("Japan Series identity mismatch");
  assertJapanSeriesAdvancement(data,npbPostseasonSeriesSchema.parse(JSON.parse(csBody.toString())));
  await mkdir(join(root,pin.sha256),{recursive:true});await writeFile(join(root,pin.sha256,"japan-series-2026.json"),body);await writeFile(cache,archive);
  return {files:1,bytes:body.length,compressedBytes:archive.length,games:data.series.games.length,results:data.results.length,canonicalWrites:0};
}
