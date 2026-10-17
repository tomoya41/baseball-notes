import { readFile,writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { resolve } from "node:path";
import { historicalCurrentBridges as bridges } from "../src/infrastructure/providers/npb-historical-admission";
import { npbPlayerDirectorySchema } from "../src/domain/npb-player-directory";
import { npbCatalogSchema } from "../src/domain/npb-product-contract";
import { npbHistoricalDatasetSchema } from "../src/domain/npb-historical";
const [directoryPath,catalogPath,historyPath,output]=process.argv.slice(2);
if(!directoryPath||!catalogPath||!historyPath||!output||!resolve(output).startsWith(resolve(".data")+(process.platform==="win32"?"\\":"/")))throw Error("Usage: audit-npb-active-coverage.ts directory.json catalog.json history.gz .data/report.json");
const directory=npbPlayerDirectorySchema.parse(JSON.parse(await readFile(directoryPath,"utf8"))),catalog=npbCatalogSchema.parse(JSON.parse(await readFile(catalogPath,"utf8"))),history=npbHistoricalDatasetSchema.parse(JSON.parse(gunzipSync(await readFile(historyPath)).toString()));
const indexed=new Map<string,Set<number>>();for(const r of history.rows){if(!indexed.has(r.playerId))indexed.set(r.playerId,new Set());indexed.get(r.playerId)!.add(r.season);}
const details=directory.players.map(p=>({id:p.playerId,name:p.displayName,team:p.teamId,position:p.position,playerType:p.playerType,battingAvailable:p.battingAvailable,pitchingAvailable:p.pitchingAvailable,years:[...(indexed.get(p.playerId)??[])].sort((a,b)=>a-b),bridge:bridges.some(b=>b.playerId===p.playerId)}));
const count=(players:typeof details)=>({players:players.length,historical:players.filter(p=>p.years.length).length,noHistory:players.filter(p=>!p.years.length).length,oneYear:players.filter(p=>p.years.length===1).length,multipleYears:players.filter(p=>p.years.length>1).length});
const profileKeys=["birthDate","position","bats","throws","heightCm","weightKg","draftYear","draftRound","careerHistory","schools","affiliations"] as const;
const report={checkedAt:new Date().toISOString(),directoryEffectiveDate:directory.effectiveDate,sourceArchiveObservedAt:history.observedAt,registrationEvidence:"unknown: directory represents latest stored affiliation; no independent 2026 registration proof in these inputs",...count(details),unbridged:details.filter(p=>!p.bridge).length,
  teams:directory.teams.map(t=>({team:t.id,...count(details.filter(p=>p.team===t.id))})),roles:["pitcher","fielder",null].map(role=>({role,...count(details.filter(p=>p.playerType===role))})),
  profileAvailable:Object.fromEntries(profileKeys.map(key=>[key,catalog.players.filter(p=>directory.players.some(d=>d.playerId===p.playerId)&&p.profile[key]!=null&&(!Array.isArray(p.profile[key])||p.profile[key].length>0)).length])),uniformNumber:catalog.players.filter(p=>p.membership.uniformNumber!==null).length,details};
await writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,details:undefined}));
