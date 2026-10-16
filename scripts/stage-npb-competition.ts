import { mkdir,readFile,writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { dirname,join } from "node:path";
import pin from "../src/data/npb-postseason-release.json";
import { npbPostseasonAggregateDatasetSchema } from "../src/domain/npb-competition";
import { assertHistoricalBridge } from "../src/infrastructure/providers/npb-historical-admission";
export async function stageNpbCompetition(root="dist/data/npb/competitions") {
  const cache=join(".data/npb-history-release",`${pin.sha256}.gz`);
  let bytes=await readFile(cache).catch(()=>null);
  if(!bytes||createHash("sha256").update(bytes).digest("hex")!==pin.sha256){const r=await fetch(pin.assetUrl,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(`Pinned competition HTTP ${r.status}`);bytes=Buffer.from(await r.arrayBuffer());}
  if(bytes.length>125000||createHash("sha256").update(bytes).digest("hex")!==pin.sha256)throw Error("Competition archive mismatch");
  const body=gunzipSync(bytes,{maxOutputLength:125000});
  if(body.length!==pin.bytes||createHash("sha256").update(body).digest("hex")!==pin.bodySha256)throw Error("Competition projection mismatch");
  const d=npbPostseasonAggregateDatasetSchema.parse(JSON.parse(body.toString()));for(const p of d.players)assertHistoricalBridge(p,p);
  if(d.inputSha256!==pin.inputSha256)throw Error("Unadmitted competition archive");
  const destination=join(root,pin.sha256,"postseason.json");await mkdir(dirname(destination),{recursive:true});await writeFile(destination,body);await mkdir(dirname(cache),{recursive:true});await writeFile(cache,bytes);
  return {files:1,bytes:body.length,rows:d.rows.length,players:d.players.length};
}
