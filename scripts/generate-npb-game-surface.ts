import { mkdir,writeFile,readFile } from "node:fs/promises";
import { openDataClient,type DataClient } from "../src/data/database";
import { readNpbGameIndex } from "../src/data/npb-game-index-repository";
import { npbSeasonPayloadSchema } from "../src/application/npb-season-payload";
import { recordsSchema } from "../src/domain/npb-records";
const url=process.env.TURSO_DATABASE_URL,token=process.env.TURSO_AUTH_TOKEN;
if(!url||url.startsWith("file:")||!token)throw Error("Remote read-only connection required");
const source=openDataClient(url,token),root=process.argv.find(a=>a.startsWith("--payload-root="))?.slice(15)??".data/publish";
let queries=0;const started=performance.now();
const client=new Proxy(source,{get(target,key){if(key==="execute")return async(statement:Parameters<DataClient["execute"]>[0])=>{
  const sql=typeof statement==="string"?statement:statement.sql;if(!/^\s*SELECT\b/i.test(sql))throw Error("Read-only Game projection required");
  queries++;return target.execute(statement);};const value=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;}}) as DataClient;
try {const latest=await client.execute("SELECT MAX(snapshot_date) AS date FROM standings_daily WHERE league='NPB'");
  const effectiveDate=latest.rows[0]?.date?String(latest.rows[0].date):null;if(!effectiveDate)throw Error("Missing completed date");
  const index=await readNpbGameIndex(client,effectiveDate),path=`${root}/data/npb/games`;await mkdir(`${path}/dates`,{recursive:true});
  let bytes=0;for(const d of index.days){const json=JSON.stringify(d);bytes+=Buffer.byteLength(json);await writeFile(`${path}/dates/${d.date}.json`,json);}
  await writeFile(`${path}/manifest.json`,JSON.stringify({schemaVersion:1,league:"NPB",from:index.from,to:index.to,effectiveDate,generatedAt:index.generatedAt}));
  await writeFile(`${path}/recent.json`,JSON.stringify({schemaVersion:1,league:"NPB",effectiveDate,generatedAt:index.generatedAt,games:index.recent}));
  const season=npbSeasonPayloadSchema.parse(JSON.parse(await readFile(`${root}/data/npb/season/2026/latest.json`,"utf8")));
  // Reuse existing Season aggregates; do not publish internal candidates while gate is closed.
  const categories=([['batting','HR'],['batting','H'],['batting','RBI'],['batting','SB'],['pitching','SO'],['pitching','W'],['pitching','SV'],['pitching','HLD']] as const)
    .map(([role,metric])=>{const entries=season.readiness.status==="ready"?season.players.filter(p=>p[role]?.metrics[metric]?.status==="complete")
      .map(p=>({playerId:p.playerId,displayName:p.displayName,value:p[role]!.metrics[metric]!.value!})).sort((a,b)=>b.value-a.value||a.playerId.localeCompare(b.playerId)):[];
      return {role,metric,rows:entries.map(p=>({...p,rank:1+entries.filter(x=>x.value>p.value).length}))};});
  const records=recordsSchema.parse({schemaVersion:1,league:"NPB",season:2026,effectiveDate:season.effectiveDate,
    coverage:season.coverage.status,readiness:season.readiness.status,qualifierStatus:season.readiness.rateQualifier,reasons:season.readiness.reasons,categories});
  const recordPath=`${root}/data/npb/records/2026`;await mkdir(recordPath,{recursive:true});const recordJson=JSON.stringify(records);await writeFile(`${recordPath}/latest.json`,recordJson);
  console.log(JSON.stringify({queries,rows:index.rows,dates:index.days.length,readMs:index.readMs,generationMs:performance.now()-started,indexBytes:bytes,
    maxDateBytes:Math.max(...index.days.map(d=>Buffer.byteLength(JSON.stringify(d)))),recordsQueries:0,recordsBytes:Buffer.byteLength(recordJson),coverage:index.coverage.summary}));
} finally {source.close();}
