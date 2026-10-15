import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { npbHistoricalDatasetSchema, npbHistoricalManifestSchema } from "../src/domain/npb-historical";
import release from "../src/data/npb-historical-release.json";
import bridges from "../src/data/npb-free-profile-identities.json";

const online=process.argv.includes("--public"),root=process.argv.find(a=>a.startsWith("--root="))?.slice(7)??"dist/data/npb/historical";
let fetches=0;
async function load(file:string) {
  if(!online)return readFile(join(root,file));
  fetches++;const response=await fetch(`https://tomoya41.github.io/baseball-notes/data/npb/historical/${file}?verify=${Date.now()}`,{signal:AbortSignal.timeout(30000),cache:"no-store"});
  if(!response.ok)throw Error(`Historical publication HTTP ${response.status}: ${file}`);
  return Buffer.from(await response.arrayBuffer());
}
const manifest=npbHistoricalManifestSchema.parse(JSON.parse((await load("manifest.json")).toString("utf8")));
if(manifest.inputSha256!==release.inputSha256)throw Error("Unexpected Historical input generation");
const players=new Set<string>();let rows=0;
for(const year of manifest.seasons) {
  const bytes=await load(`${year.season}.json`);
  if(bytes.length!==year.bytes||createHash("sha256").update(bytes).digest("hex")!==year.sha256)throw Error("Historical year hash/size mismatch");
  const d=npbHistoricalDatasetSchema.parse(JSON.parse(bytes.toString("utf8")));
  if(d.inputSha256!==manifest.inputSha256||d.observedAt!==manifest.observedAt||d.rows.length!==year.rows||d.players.length!==year.players||d.rows.some(r=>r.season!==year.season))throw Error("Historical family mismatch");
  for(const p of d.players){if(!bridges.some(b=>b.playerId===p.playerId&&b.npbId===p.npbId&&b.wikidataId===p.wikidataId)||!manifest.players.some(m=>m.playerId===p.playerId&&m.seasons.includes(year.season)))throw Error("Historical canonical bridge mismatch");players.add(p.playerId);}
  rows+=d.rows.length;
}
if(players.size!==manifest.players.length)throw Error("Historical directory mismatch");
console.log(JSON.stringify({status:"PASS",seasons:manifest.seasons.map(s=>s.season),players:players.size,rows,coverage:manifest.coverage,canonicalWrites:0,httpFetches:fetches}));
