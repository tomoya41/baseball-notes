import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import pin from "../src/data/npb-japan-series-release.json";
import retained from "../src/data/npb-japan-series-retained-releases.json";
import csPin from "../src/data/npb-series-release.json";
import { npbJapanSeriesSchema, assertJapanSeriesAdvancement } from "../src/domain/npb-japan-series";
import { npbPostseasonSeriesSchema } from "../src/domain/npb-postseason-series";

export async function stageNpbJapanSeries(root:string){
  let bytes=0,compressedBytes=0,activeGames=0,activeResults=0;
  for(const release of [...retained,pin] as (typeof pin)[]){
  const hash=(b:Uint8Array)=>createHash("sha256").update(b).digest("hex"),cache=join(".data/npb-history-release",`${release.sha256}.gz`);
  let archive=await readFile(cache).catch(()=>null);
  if(!archive||hash(archive)!==release.sha256){const r=await fetch(release.assetUrl,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Japan Series release HTTP ${r.status}`);archive=Buffer.from(await r.arrayBuffer());}
  if(archive.length>50000||hash(archive)!==release.sha256)throw Error("Japan Series archive mismatch");
  const body=gunzipSync(archive,{maxOutputLength:50000}),csBody=await readFile(join(root,csPin.sha256,"series-2026.json"));
  if(body.length!==release.bytes||hash(body)!==release.bodySha256||hash(csBody)!==csPin.bodySha256||csPin.bodySha256!==release.csSeriesBodySha256)throw Error("Japan Series generation mismatch");
  const data=npbJapanSeriesSchema.parse(JSON.parse(body.toString()));
  if(data.csSeriesBodySha256!==release.csSeriesBodySha256||data.series.id!==release.seriesId||JSON.stringify(data.series.games.map(g=>g.gameId))!==JSON.stringify(release.gameIds))throw Error("Japan Series identity mismatch");
  assertJapanSeriesAdvancement(data,npbPostseasonSeriesSchema.parse(JSON.parse(csBody.toString())));
  await mkdir(join(root,release.sha256),{recursive:true});await writeFile(join(root,release.sha256,"japan-series-2026.json"),body);await writeFile(cache,archive);
  bytes+=body.length;compressedBytes+=archive.length;if(release.sha256===pin.sha256){activeGames=data.series.games.length;activeResults=data.results.length;}
  }
  return {files:retained.length+1,bytes,compressedBytes,games:activeGames,results:activeResults,canonicalWrites:0};
}
