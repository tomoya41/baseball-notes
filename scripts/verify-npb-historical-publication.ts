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
import csPin from "../src/data/npb-cs-release.json";
import retainedCs from "../src/data/npb-cs-retained-releases.json";
import { npbCsDatasetSchema } from "../src/domain/npb-cs-observations";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import eventsPin from "../src/data/npb-player-events-release.json";
import retainedEvents from "../src/data/npb-player-events-retained-releases.json";
import { npbPlayerEventsSchema } from "../src/domain/npb-player-events";
import seriesPin from "../src/data/npb-series-release.json";
import { assertCsSeriesSnapshot, npbPostseasonSeriesSchema } from "../src/domain/npb-postseason-series";
import japanPin from "../src/data/npb-japan-series-release.json";
import retainedJapan from "../src/data/npb-japan-series-retained-releases.json";
import { npbJapanSeriesSchema, assertJapanSeriesAdvancement } from "../src/domain/npb-japan-series";
import draftPin from "../src/data/npb-draft-2026-release.json";
import retainedDrafts from "../src/data/npb-draft-retained-releases.json";
import { draftEventSchema } from "../src/domain/npb-draft-event";
import finalDraftPin from "../src/data/npb-draft-final-release.json";
import { finalDraftForecastSchema, assertFinalDraftBase } from "../src/domain/npb-draft-final";

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
  for(const p of d.players){assertHistoricalBridge(p,p);if(!manifest.players.some(m=>m.playerId===p.playerId&&m.identityScope===p.identityScope&&m.birthDate===p.birthDate&&m.seasons.includes(year.season)))throw Error("Historical canonical bridge mismatch");players.add(p.playerId);}
  rows+=d.rows.length;
}
if(players.size!==manifest.players.length)throw Error("Historical directory mismatch");
const competitionBytes=await load(`../competitions/${competitionPin.sha256}/postseason.json`);
if(competitionBytes.length!==competitionPin.bytes||createHash("sha256").update(competitionBytes).digest("hex")!==competitionPin.bodySha256)throw Error("Competition publication mismatch");
const competition=npbPostseasonAggregateDatasetSchema.parse(JSON.parse(competitionBytes.toString("utf8")));
if(competition.inputSha256!==competitionPin.inputSha256||competition.rows.length!==competitionPin.rows)throw Error("Competition generation mismatch");
for(const p of competition.players)assertHistoricalBridge(p,p);
const csBytes=await load(`../competitions/${csPin.sha256}/cs-2026.json`);
const retainedCsFiles=await verifyRetainedFiles(load,Object.fromEntries(retainedCs.map(p=>[`../competitions/${p.sha256}/cs-2026.json`,{bytes:p.bytes,sha256:p.bodySha256}])));
if(csBytes.length!==csPin.bytes||createHash("sha256").update(csBytes).digest("hex")!==csPin.bodySha256)throw Error("CS publication mismatch");
const cs=npbCsDatasetSchema.parse(JSON.parse(csBytes.toString()));
const seriesBytes=await load(`../competitions/${seriesPin.sha256}/series-2026.json`);
if(seriesBytes.length!==seriesPin.bytes||createHash("sha256").update(seriesBytes).digest("hex")!==seriesPin.bodySha256)throw Error("Series publication mismatch");
const series=npbPostseasonSeriesSchema.parse(JSON.parse(seriesBytes.toString()));
if(series.baseBodySha256!==seriesPin.baseBodySha256||series.baseBodySha256!==csPin.bodySha256)throw Error("Series publication base mismatch");
assertCsSeriesSnapshot(series,cs);
const japanBytes=await load(`../competitions/${japanPin.sha256}/japan-series-2026.json`);
if(japanBytes.length!==japanPin.bytes||createHash("sha256").update(japanBytes).digest("hex")!==japanPin.bodySha256)throw Error("Japan Series publication mismatch");
const japan=npbJapanSeriesSchema.parse(JSON.parse(japanBytes.toString()));
const retainedJapanFiles=await verifyRetainedFiles(load,Object.fromEntries((retainedJapan as (typeof japanPin)[]).map(p=>[`../competitions/${p.sha256}/japan-series-2026.json`,{bytes:p.bytes,sha256:p.bodySha256}])));
for(const pin of [...retainedDrafts,draftPin] as (typeof draftPin)[]){
  const bytes=await load(`../draft/${pin.sha256}/draft-2026.json`),data=draftEventSchema.parse(JSON.parse(bytes.toString()));
  if(bytes.length!==pin.bytes||createHash("sha256").update(bytes).digest("hex")!==pin.bodySha256||createHash("sha256").update(JSON.stringify(data.forecast)).digest("hex")!==pin.forecastSha256)throw Error("Draft publication mismatch");
}
const finalDraftBytes=await load(`../draft/${finalDraftPin.sha256}/final-2026.json`);
if(finalDraftBytes.length!==finalDraftPin.bytes||createHash("sha256").update(finalDraftBytes).digest("hex")!==finalDraftPin.bodySha256)throw Error("Final draft publication mismatch");
const finalDraft=finalDraftForecastSchema.parse(JSON.parse(finalDraftBytes.toString()));
const draftBase=draftEventSchema.parse(JSON.parse((await load(`../draft/${draftPin.sha256}/draft-2026.json`)).toString()));
assertFinalDraftBase(finalDraft,draftBase);
if(japan.csSeriesBodySha256!==japanPin.csSeriesBodySha256||japan.csSeriesBodySha256!==seriesPin.bodySha256||japan.series.id!==japanPin.seriesId||JSON.stringify(japan.series.games.map(g=>g.gameId))!==JSON.stringify(japanPin.gameIds))throw Error("Japan Series publication identity mismatch");
assertJapanSeriesAdvancement(japan,series);
if(cs.inputSha256!==csPin.inputSha256||cs.games.length!==csPin.games||cs.rows.length!==csPin.rows||cs.players.length!==csPin.players)throw Error("CS publication generation mismatch");
for(const p of cs.players)assertHistoricalBridge(p,p);
const eventBytes=await load(`../events/${eventsPin.sha256}/2026.json`);
const retainedEventFiles=await verifyRetainedFiles(load,Object.fromEntries((retainedEvents as (typeof eventsPin)[]).map(p=>[`../events/${p.sha256}/2026.json`,{bytes:p.bytes,sha256:p.bodySha256}])));
if(eventBytes.length!==eventsPin.bytes||createHash("sha256").update(eventBytes).digest("hex")!==eventsPin.bodySha256)throw Error("Event publication hash/size mismatch");
const events=npbPlayerEventsSchema.parse(JSON.parse(eventBytes.toString()));
if(events.events.length!==eventsPin.events||events.players.length!==eventsPin.players||events.source.revision!==eventsPin.sourceRevision||events.identityInputSha256!==eventsPin.identityInputSha256)throw Error("Event publication generation mismatch");
for(const p of events.players)assertHistoricalBridge(p);
console.log(JSON.stringify({status:"PASS",retainedFiles,retainedCsFiles,retainedEventFiles,retainedJapanFiles,seasons:manifest.seasons.map(s=>s.season),players:players.size,rows,competitionRows:competition.rows.length,csGames:cs.games.length,csRows:cs.rows.length,playerEvents:events.events.length,coverage:manifest.coverage,canonicalWrites:0,httpFetches:fetches}));
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
