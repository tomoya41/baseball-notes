import { readFile,writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { npbHistoricalDatasetSchema,type NpbHistoricalRow } from "../src/domain/npb-historical";

// Independent offline protection check; no remote SQL or provider requests.
const [beforeFile,afterFile,reportFile]=process.argv.slice(2);
if(!beforeFile||!afterFile)throw Error("Usage: verify-npb-historical-expansion before.json.gz after.json.gz [report.json]");
const read=async(path:string)=>{const bytes=await readFile(path);return {sha256:createHash("sha256").update(bytes).digest("hex"),data:npbHistoricalDatasetSchema.parse(JSON.parse(gunzipSync(bytes,{maxOutputLength:10_000_000}).toString("utf8")))};};
const before=await read(beforeFile),after=await read(afterFile);
const key=(r:NpbHistoricalRow)=>`${r.playerId}:${r.season}:${r.role}:${r.teamId}`;
const previous=new Map(before.data.rows.map(r=>[key(r),r])),current=new Map(after.data.rows.map(r=>[key(r),r]));
const missing=before.data.rows.filter(r=>!current.has(key(r))),changed=before.data.rows.filter(r=>current.has(key(r))&&JSON.stringify(current.get(key(r))!.metrics)!==JSON.stringify(r.metrics));
const identityChanges=before.data.players.filter(p=>!after.data.players.some(q=>p.playerId===q.playerId&&p.npbId===q.npbId&&p.wikidataId===q.wikidataId));
if(missing.length||changed.length||identityChanges.length)throw Error(`Existing accepted rows/identities changed: ${missing.length}/${changed.length}/${identityChanges.length}`);
const added=after.data.rows.filter(r=>!previous.has(key(r))),obIds=new Set(after.data.players.filter(p=>p.identityScope==="historical_only").map(p=>p.playerId));
const report={beforeSha256:before.sha256,afterSha256:after.sha256,players:after.data.players.length,rows:after.data.rows.length,batting:after.data.rows.filter(r=>r.role==="batting").length,pitching:after.data.rows.filter(r=>r.role==="pitching").length,addedPlayers:after.data.players.length-before.data.players.length,addedRows:added.length,newHistoricalOnly:obIds.size,historicalOnlyRows:after.data.rows.filter(r=>obIds.has(r.playerId)).length,unchangedRows:previous.size,changedRows:changed.length,missingRows:missing.length,identityChanges:identityChanges.length,
  years:[...new Set(after.data.rows.map(r=>r.season))].sort((a,b)=>a-b).map(season=>({season,before:before.data.rows.filter(r=>r.season===season).length,after:after.data.rows.filter(r=>r.season===season).length,battingAdded:added.filter(r=>r.season===season&&r.role==="batting").length,pitchingAdded:added.filter(r=>r.season===season&&r.role==="pitching").length})),coverage:after.data.coverage,canonicalWrites:0};
if(reportFile)await writeFile(reportFile,JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
