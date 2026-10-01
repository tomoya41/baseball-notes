import { mkdir,writeFile,readFile } from "node:fs/promises";
import { openDataClient,type DataClient } from "../src/data/database";
import { readNpbGameIndex } from "../src/data/npb-game-index-repository";
import { npbSeasonPayloadSchema } from "../src/application/npb-season-payload";
import { buildNpbRecords } from "../src/application/npb-records-payload";
import { npbPlayerDirectorySchema } from "../src/domain/npb-player-directory";
import { npbHotPayloadSchema } from "../src/application/npb-hot-payload";
import { buildNpbCatalog,buildNpbCapabilities } from "../src/application/npb-product-payload";
import { reviewedMeasurements } from "../src/data/npb-reviewed-measurements";
import supplement from "../src/data/npb-reviewed-profile-supplement.json";
import { supplementNpbDirectory, supplementNpbMeasurements } from "../src/application/npb-profile-supplement";
import { buildNpbSeasonMilestones } from "../src/application/npb-season-milestones";
import { readNpbTeamSeason } from "../src/data/npb-team-season-repository";
import { z } from "zod";
const url=process.env.TURSO_DATABASE_URL,token=process.env.TURSO_AUTH_TOKEN;
if(!url||url.startsWith("file:")||!token)throw Error("Remote read-only connection required");
const source=openDataClient(url,token),root=process.argv.find(a=>a.startsWith("--payload-root="))?.slice(15)??".data/publish";
let queries=0;const started=performance.now();
const client=new Proxy(source,{get(target,key){if(key==="execute")return async(statement:Parameters<DataClient["execute"]>[0])=>{
  const sql=typeof statement==="string"?statement:statement.sql;if(!/^\s*SELECT\b/i.test(sql))throw Error("Read-only Game projection required");
  queries++;return target.execute(statement);};const value=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;}}) as DataClient;
try {const latest=await client.execute("SELECT MAX(snapshot_date) AS date FROM standings_daily WHERE league='NPB'");
  const requestedDate=process.argv.find(a=>a.startsWith("--date="))?.slice(7);
  const effectiveDate=z.iso.date().parse(requestedDate ?? (latest.rows[0]?.date?String(latest.rows[0].date):null));
  const index=await readNpbGameIndex(client,effectiveDate),path=`${root}/data/npb/games`;await mkdir(`${path}/dates`,{recursive:true});
  let bytes=0;for(const d of index.days){const json=JSON.stringify(d);bytes+=Buffer.byteLength(json);await writeFile(`${path}/dates/${d.date}.json`,json);}
  await writeFile(`${path}/manifest.json`,JSON.stringify({schemaVersion:1,league:"NPB",from:index.from,to:index.to,effectiveDate,generatedAt:index.generatedAt}));
  await writeFile(`${path}/recent.json`,JSON.stringify({schemaVersion:1,league:"NPB",effectiveDate,generatedAt:index.generatedAt,games:index.recent}));
  const season=npbSeasonPayloadSchema.parse(JSON.parse(await readFile(`${root}/data/npb/season/2026/latest.json`,"utf8")));
  // Reuse existing Season aggregates; do not publish internal candidates while gate is closed.
  const records=buildNpbRecords(season);
  const recordPath=`${root}/data/npb/records/2026`;await mkdir(recordPath,{recursive:true});const recordJson=JSON.stringify(records);await writeFile(`${recordPath}/latest.json`,recordJson);
  const directory=npbPlayerDirectorySchema.parse(JSON.parse(await readFile(`${root}/data/npb/players/latest.json`,"utf8")));
  const hotBody=await readFile(".data/hot-diagnostics/npb-hot-7d.json","utf8").catch((error:NodeJS.ErrnoException)=>{
    if(error.code!=="ENOENT")throw error;
    return readFile(`${root}/data/npb/hot/latest.json`,"utf8");
  });
  const hot=npbHotPayloadSchema.parse(JSON.parse(hotBody));
  if(directory.effectiveDate!==effectiveDate || season.effectiveDate!==effectiveDate || hot.effectiveDate!==effectiveDate)
    throw Error("Product projections require matching effective dates");
  const enriched=supplementNpbDirectory(directory,supplement);
  const catalog=buildNpbCatalog(enriched.directory,reviewedMeasurements,supplementNpbMeasurements(reviewedMeasurements,supplement));
  const teamSeason=await readNpbTeamSeason(client,catalog,index.coverage);
  const capabilities=buildNpbCapabilities(catalog,season,hot.readiness);
  const milestones=buildNpbSeasonMilestones(season,catalog);
  const productFiles={"players/latest.json":enriched.directory,"catalog/latest.json":catalog,"teams/season/2026/latest.json":teamSeason,"capabilities.json":capabilities,
    [`milestones/${season.season}/latest.json`]:milestones};
  const productBytes:Record<string,number>={};
  for(const [file,value] of Object.entries(productFiles)){
    const parts=file.split("/");parts.pop();await mkdir(`${root}/data/npb/${parts.join("/")}`,{recursive:true});
    const body=JSON.stringify(value);await writeFile(`${root}/data/npb/${file}`,body);productBytes[file]=Buffer.byteLength(body);
  }
  const profileCoverage=Object.fromEntries(Object.keys(catalog.players[0]?.profile??{}).filter(k=>!["careerHistory"].includes(k))
    .map(k=>[k,catalog.players.filter(p=>p.profile[k as keyof typeof p.profile]!==null).length]));
  console.log(JSON.stringify({queries,rows:index.rows,dates:index.days.length,readMs:index.readMs,generationMs:performance.now()-started,indexBytes:bytes,
    maxDateBytes:Math.max(...index.days.map(d=>Buffer.byteLength(JSON.stringify(d)))),recordsQueries:0,recordsBytes:Buffer.byteLength(recordJson),coverage:index.coverage.summary,
    productQueries:3,productBytes,profileCoverage,uniformNumberKnown:catalog.players.filter(p=>p.membership.uniformNumber!==null).length,
    capabilityCounts:Object.fromEntries([...new Set(Object.values(capabilities.data).map(c=>c.status))].map(s=>[s,Object.values(capabilities.data).filter(c=>c.status===s).length])),
    canonicalWrites:0,profileConflicts:enriched.conflicts,milestoneQueries:0,milestonePlayers:milestones.players.length,
    teamSeason:teamSeason.teams.map(t=>({teamId:t.teamId,G:t.G,W:t.W,L:t.L,T:t.T,runsFor:t.runsFor,runsAgainst:t.runsAgainst}))}));
} finally {source.close();}
