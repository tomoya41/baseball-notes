import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { DatabaseSync } from "node:sqlite";
import { resolve, join } from "node:path";
import { parseWikipediaHistorical } from "../src/infrastructure/providers/wikipedia-npb-historical";
import { npbHistoricalDatasetSchema, npbHistoricalRowSchema } from "../src/domain/npb-historical";
import { assertHistoricalBridge } from "../src/infrastructure/providers/npb-historical-admission";
import { z } from "zod";
import { historicalImportYears, yearsForSavedIdentity } from "../src/data/npb-historical-years";
import { npbPlayerDirectorySchema } from "../src/domain/npb-player-directory";
import historicalRegistry from "../src/data/npb-historical-only-identities.json";

// Offline-only replay of documented MediaWiki API archives. No collector, remote DB or identity mutation.
const [input, output] = process.argv.slice(2);
if (!input || !output || !resolve(output).startsWith(`${resolve(".data")}/`.replaceAll("/", process.platform === "win32" ? "\\" : "/"))) throw Error("Usage: import-npb-historical-wikipedia.ts archive.json .data/output-directory");
const started = performance.now(), bytes = await readFile(input), inputSha256 = createHash("sha256").update(bytes).digest("hex");
const archive = z.object({ observedAt:z.iso.datetime(), pages:z.record(z.string(),z.unknown()),titles:z.array(z.object({ playerId:z.uuid(),npbId:z.string(),wikidataId:z.string(),title:z.string(),identityScope:z.literal("historical_only").optional(),sourceObservedAt:z.iso.datetime().optional() })) }).parse(JSON.parse(bytes.toString("utf8")));
const directoryFile=process.argv.find(a=>a.startsWith("--current-directory="))?.slice(20);
const directory=directoryFile?npbPlayerDirectorySchema.parse(JSON.parse(await readFile(directoryFile,"utf8"))):null;
const directoryIds=new Set(directory?.players.map(p=>p.playerId)??[]);
// Explicit opt-in for already admitted identities only; no new OB namespace/identity is minted.
const historicalIds=new Set(process.argv.includes("--include-registered-history")?historicalRegistry.players.map(p=>p.playerId):[]);
const years = historicalImportYears(Number(process.argv.find(a=>a.startsWith("--from-year="))?.slice(12)??2015),!!directory), players=[], rows=[], issues=[];
for (const link of archive.titles) {
  assertHistoricalBridge(link);
  try {
    const parsed = parseWikipediaHistorical(archive.pages[link.title],link,yearsForSavedIdentity(years,link.playerId,link.identityScope==="historical_only",directoryIds,historicalIds));
    const identity=historicalRegistry.players.find(p=>p.playerId===link.playerId);
    if(identity&&historicalIds.has(identity.playerId))Object.assign(parsed.player,{birthDate:identity.birthDate});
    assertHistoricalBridge(link,parsed.player);
    if (parsed.rows.length) { players.push(parsed.player); rows.push(...parsed.rows); }
    issues.push(...parsed.issues.map(issue=>({playerId:link.playerId,title:link.title,...issue})));
  } catch(e) { issues.push({playerId:link.playerId,title:link.title,reason:(e as Error).message}); }
}
const dataset = npbHistoricalDatasetSchema.parse({schemaVersion:1,league:"NPB",temporalScope:"historical",competition:"regular",granularity:"season_aggregate",license:"CC-BY-SA-4.0",observedAt:archive.observedAt,inputSha256,
  transformation:"NPB season tables only; exact existing bridges or separately verified historical-only NPB-ID/QID/article/DOB identities; normalized counts and baseball innings; zero-decision .000 WPCT unavailable; ambiguous rows quarantined; no article career totals, prose, media, Game Facts or current metadata",coverage:"partial",players,rows});
await mkdir(output,{recursive:true});
// A fresh in-memory scratch DB with readback and idempotent replay, not the production DB.
const db = new DatabaseSync(":memory:");
db.exec("CREATE TABLE npb_historical_aggregates(player_id TEXT NOT NULL, season INTEGER NOT NULL, competition TEXT NOT NULL CHECK(competition='regular'), role TEXT NOT NULL, team_id TEXT NOT NULL, metrics TEXT NOT NULL, PRIMARY KEY(player_id,season,competition,role,team_id))");
const insert = db.prepare("INSERT INTO npb_historical_aggregates VALUES(?,?,'regular',?,?,?) ON CONFLICT DO NOTHING");
for(let replay=0;replay<2;replay++) for(const row of dataset.rows) insert.run(row.playerId,row.season,row.role,row.teamId,JSON.stringify(row.metrics));
const readback = db.prepare("SELECT player_id,season,role,team_id,metrics FROM npb_historical_aggregates ORDER BY player_id,season,role,team_id").all();
const canonical = (data:typeof dataset.rows) => data.map(r=>JSON.stringify([r.playerId,r.season,r.role,r.teamId,r.metrics])).sort();
if(JSON.stringify(canonical(readback.map(r=>npbHistoricalRowSchema.parse({playerId:String(r.player_id),season:Number(r.season),role:r.role,teamId:String(r.team_id),metrics:JSON.parse(String(r.metrics))}))))!==JSON.stringify(canonical(dataset.rows))) throw Error("Scratch replay/readback mismatch");
db.close();
const json=JSON.stringify(dataset), compressed=gzipSync(json,{level:9}), outputPath=join(output,"npb-historical-wikipedia.json.gz");
await writeFile(outputPath,compressed);
await writeFile(join(output,"quarantine.json"),JSON.stringify(issues,null,2));
const report={inputSha256,archiveObservedAt:dataset.observedAt,players:players.length,rows:rows.length,seasons:years.map(season=>({season,batting:rows.filter(r=>r.season===season&&r.role==="batting").length,pitching:rows.filter(r=>r.season===season&&r.role==="pitching").length})),issues:issues.length,bytes:Buffer.byteLength(json),gzipBytes:compressed.length,sha256:createHash("sha256").update(compressed).digest("hex"),scratchReadback:true,idempotentReplay:true,canonicalWrites:0,sourceRequests:0,durationMs:Math.round(performance.now()-started)};
await writeFile(join(output,"report.json"),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
