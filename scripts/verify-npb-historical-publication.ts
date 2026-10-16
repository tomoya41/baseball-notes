import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { npbHistoricalDatasetSchema, npbHistoricalManifestSchema } from "../src/domain/npb-historical";
import release from "../src/data/npb-historical-release.json";
import { assertHistoricalBridge } from "../src/infrastructure/providers/npb-historical-admission";
import legacy from "../src/data/npb-historical-legacy-release.json";
import retainedReleases from "../src/data/npb-historical-retained-releases.json";
import competitionPin from "../src/data/npb-postseason-release.json";
import { npbPostseasonAggregateDatasetSchema } from "../src/domain/npb-competition";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export async function verifyRetainedFiles(read:(path:string)=>Promise<Uint8Array>,files:Record<string,{bytes:number;sha256:string}>) {
  for(const [file,expected] of Object.entries(files)) {
    const bytes=await read(file);
    if(bytes.length!==expected.bytes||createHash("sha256").update(bytes).digest("hex")!==expected.sha256)throw Error(`Retained Historical hash/size mismatch: ${file}`);
  }
  return Object.keys(files).length;
}

async function main() {

const online=process.argv.includes("--public"),root=process.argv.find(a=>a.startsWith("--root="))?.slice(7)??"dist/data/npb/historical";
let fetches=0;
async function load(file:string) {
  if(!online)return readFile(join(root,file));
  fetches++;const response=await fetch(`https://tomoya41.github.io/baseball-notes/data/npb/historical/${file}?verify=${Date.now()}`,{signal:AbortSignal.timeout(30000),cache:"no-store"});
  if(!response.ok)throw Error(`Historical publication HTTP ${response.status}: ${file}`);
  return Buffer.from(await response.arrayBuffer());
}
let retainedFiles=await verifyRetainedFiles(load,legacy.files);
for(const pin of retainedReleases) retainedFiles+=await verifyRetainedFiles(file=>load(`${pin.sha256}/${file}`),pin.files);
const current=(file:string)=>load(`${release.sha256}/${file}`);
const manifest=npbHistoricalManifestSchema.parse(JSON.parse((await current("manifest.json")).toString("utf8")));
if(manifest.inputSha256!==release.inputSha256)throw Error("Unexpected Historical input generation");
const players=new Set<string>();let rows=0;
for(const year of manifest.seasons) {
  const bytes=await current(`${year.season}.json`);
  if(bytes.length!==year.bytes||createHash("sha256").update(bytes).digest("hex")!==year.sha256)throw Error("Historical year hash/size mismatch");
  const d=npbHistoricalDatasetSchema.parse(JSON.parse(bytes.toString("utf8")));
  if(d.inputSha256!==manifest.inputSha256||d.observedAt!==manifest.observedAt||d.rows.length!==year.rows||d.players.length!==year.players||d.rows.some(r=>r.season!==year.season))throw Error("Historical family mismatch");
  for(const p of d.players){assertHistoricalBridge(p,p);if(!manifest.players.some(m=>m.playerId===p.playerId&&m.identityScope===p.identityScope&&m.seasons.includes(year.season)))throw Error("Historical canonical bridge mismatch");players.add(p.playerId);}
  rows+=d.rows.length;
}
if(players.size!==manifest.players.length)throw Error("Historical directory mismatch");
const competitionBytes=await load(`../competitions/${competitionPin.sha256}/postseason.json`);
if(competitionBytes.length!==competitionPin.bytes||createHash("sha256").update(competitionBytes).digest("hex")!==competitionPin.bodySha256)throw Error("Competition publication mismatch");
const competition=npbPostseasonAggregateDatasetSchema.parse(JSON.parse(competitionBytes.toString("utf8")));
if(competition.inputSha256!==competitionPin.inputSha256||competition.rows.length!==competitionPin.rows)throw Error("Competition generation mismatch");
for(const p of competition.players)assertHistoricalBridge(p,p);
console.log(JSON.stringify({status:"PASS",retainedFiles,seasons:manifest.seasons.map(s=>s.season),players:players.size,rows,competitionRows:competition.rows.length,coverage:manifest.coverage,canonicalWrites:0,httpFetches:fetches}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
