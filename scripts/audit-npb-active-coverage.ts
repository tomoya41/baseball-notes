import { readFile,writeFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { coverageArchiveSchema,regularGapIssuesSchema,csGapIssuesSchema,classifyNpbCoverageGaps } from "./lib/npb-coverage-gaps";
import { historicalCurrentBridges as bridges } from "../src/infrastructure/providers/npb-historical-admission";
import { npbPlayerDirectorySchema } from "../src/domain/npb-player-directory";
import { npbCatalogSchema } from "../src/domain/npb-product-contract";
import { npbHistoricalDatasetSchema } from "../src/domain/npb-historical";
const [directoryPath,catalogPath,historyPath,output]=process.argv.slice(2);
if(!directoryPath||!catalogPath||!historyPath||!output||!resolve(output).startsWith(resolve(".data")+(process.platform==="win32"?"\\":"/")))throw Error("Usage: audit-npb-active-coverage.ts directory.json catalog.json history.gz .data/report.json");
const primaryBytes=await Promise.all([directoryPath,catalogPath,historyPath].map(path=>readFile(path)));
const directory=npbPlayerDirectorySchema.parse(JSON.parse(primaryBytes[0]!.toString())),catalog=npbCatalogSchema.parse(JSON.parse(primaryBytes[1]!.toString())),history=npbHistoricalDatasetSchema.parse(JSON.parse(gunzipSync(primaryBytes[2]!).toString()));
const option=(name:string)=>process.argv.find(v=>v.startsWith(`--${name}=`))?.slice(name.length+3);
const optionalPaths=[option("identity-archive"),option("regular-quarantine"),option("cs-quarantine")];
if(optionalPaths.some(Boolean)&&!optionalPaths.every(Boolean))throw Error("Gap classification requires identity archive, Regular quarantine and CS quarantine together");
const optionalBytes=await Promise.all(optionalPaths.filter((p):p is string=>!!p).map(p=>readFile(p)));
if(optionalBytes.length&&createHash("sha256").update(optionalBytes[0]!).digest("hex")!==history.inputSha256)throw Error("Identity archive does not match the supplied historical dataset input");
const indexed=new Map<string,Set<number>>();for(const r of history.rows){if(!indexed.has(r.playerId))indexed.set(r.playerId,new Set());indexed.get(r.playerId)!.add(r.season);}
const details=directory.players.map(p=>({id:p.playerId,name:p.displayName,team:p.teamId,position:p.position,playerType:p.playerType,battingAvailable:p.battingAvailable,pitchingAvailable:p.pitchingAvailable,years:[...(indexed.get(p.playerId)??[])].sort((a,b)=>a-b),bridge:bridges.some(b=>b.playerId===p.playerId)}));
const gapAudit=optionalBytes.length?classifyNpbCoverageGaps(details,bridges,coverageArchiveSchema.parse(JSON.parse(optionalBytes[0]!.toString())),regularGapIssuesSchema.parse(JSON.parse(optionalBytes[1]!.toString())),csGapIssuesSchema.parse(JSON.parse(optionalBytes[2]!.toString()))):undefined;
const inputFiles=[directoryPath,catalogPath,historyPath,...optionalPaths.filter((p):p is string=>!!p)];
const inputBytes=[...primaryBytes,...optionalBytes];
const inputs=inputFiles.map((path,i)=>({path,sha256:createHash("sha256").update(inputBytes[i]!).digest("hex")}));
const inputSha256=createHash("sha256").update(JSON.stringify({auditVersion:1,inputs:inputs.map(p=>p.sha256),bridges:[...bridges].sort((a,b)=>a.playerId.localeCompare(b.playerId))})).digest("hex");
const count=(players:typeof details)=>({players:players.length,historical:players.filter(p=>p.years.length).length,noHistory:players.filter(p=>!p.years.length).length,oneYear:players.filter(p=>p.years.length===1).length,multipleYears:players.filter(p=>p.years.length>1).length});
const profileKeys=["birthDate","position","bats","throws","heightCm","weightKg","draftYear","draftRound","careerHistory","schools","affiliations"] as const;
const report={checkedAt:new Date().toISOString(),inputSha256,inputs,sourceRequests:0,canonicalReads:0,canonicalWrites:0,gapAudit,directoryEffectiveDate:directory.effectiveDate,sourceArchiveObservedAt:history.observedAt,registrationEvidence:"unknown: directory represents latest stored affiliation; no independent 2026 registration proof in these inputs",...count(details),unbridged:details.filter(p=>!p.bridge).length,
  teams:directory.teams.map(t=>({team:t.id,...count(details.filter(p=>p.team===t.id))})),roles:["pitcher","fielder",null].map(role=>({role,...count(details.filter(p=>p.playerType===role))})),
  profileAvailable:Object.fromEntries(profileKeys.map(key=>[key,catalog.players.filter(p=>directory.players.some(d=>d.playerId===p.playerId)&&p.profile[key]!=null&&(!Array.isArray(p.profile[key])||p.profile[key].length>0)).length])),uniformNumber:catalog.players.filter(p=>p.membership.uniformNumber!==null).length,details};
await writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify({...report,gapAudit:gapAudit?{...gapAudit,details:undefined}:undefined,details:undefined}));
