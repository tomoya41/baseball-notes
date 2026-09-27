import { mkdir, rename, writeFile, readFile } from "node:fs/promises";
import { dirname } from "node:path";
import { openDataClient, type DataClient } from "../src/data/database";
import { NpbRepository } from "../src/data/npb-repository";
import { NpbPeriodCoverageRepository } from "../src/data/npb-period-coverage-repository";
import { NpbPlayerDirectoryRepository } from "../src/data/npb-player-directory";
import { PlayerPeriodBatchService } from "../src/application/player-period-batch";
import { buildNpbSeasonPayload, npbSeasonPayloadSchema, seasonRankingReadModel } from "../src/application/npb-season-payload";
import { readSeasonQualifierContext } from "../src/data/npb-season-qualifier";
const url=process.env.TURSO_DATABASE_URL;
if(!url || url.startsWith("file:") || !process.env.TURSO_AUTH_TOKEN) throw new Error("Read-only remote connection required");
const source=openDataClient(url,process.env.TURSO_AUTH_TOKEN);
let queries=0;
const client=new Proxy(source,{get(target,key){
  if(key==="execute") return async (statement:Parameters<DataClient["execute"]>[0])=>{
    const sql=typeof statement==="string"?statement:statement.sql;
    if(!/^\s*SELECT\b/i.test(sql)) throw new Error("Non-read SQL prohibited");
    queries++; return target.execute(statement);
  };
  const value=Reflect.get(target,key);return typeof value==="function"?value.bind(target):value;
}}) as DataClient;
try {
  const repository=new NpbRepository(client);
  const date=process.argv.find(a=>a.startsWith("--date="))?.slice(7) ?? (await repository.findLatestStandings())[0]?.date;
  if(!date) throw new Error("Missing effective date");
  const start=performance.now();
  const batch=await new PlayerPeriodBatchService(repository,new NpbPeriodCoverageRepository(client)).aggregate({asOfDate:date,period:"season"});
  const directory=await new NpbPlayerDirectoryRepository(client).read();
  const payload=buildNpbSeasonPayload(batch,directory);
  const serializeStart=performance.now(),json=JSON.stringify(payload),serializationMs=performance.now()-serializeStart;
  const root=process.argv.find(a=>a.startsWith("--payload-root="))?.slice(15) ?? ".data/publish";
  const path=`${root}/data/npb/season/2026/latest.json`;
  await mkdir(dirname(path),{recursive:true});await writeFile(`${path}.tmp`,json);
  npbSeasonPayloadSchema.parse(JSON.parse(await readFile(`${path}.tmp`,"utf8")));await rename(`${path}.tmp`,path);
  const rankings=seasonRankingReadModel(batch,directory,await readSeasonQualifierContext(client,batch.window.from,batch.window.to));
  console.log(JSON.stringify({schemaVersion:1,effectiveDate:date,readiness:payload.readiness,coverage:payload.coverage,
    playerCount:payload.players.length,summary:batch.summary,queries,timings:{...batch.timings,serializationMs,totalMs:performance.now()-start},
    bytes:Buffer.byteLength(json),internalCountingCandidates:Object.fromEntries(Object.entries(rankings.counting.batting).map(([k,v])=>[k,v.length])),
    rankingReadiness:rankings.readiness,qualifierCounts:Object.fromEntries(Object.entries(rankings.qualifications).map(([role,players])=>
      [role,Object.fromEntries(["qualified","unqualified","unknown"].map(status=>[status,players.filter(p=>p.status===status).length]))])),
    qualifierReasons:Object.fromEntries(Object.entries(rankings.qualifications).map(([role,players])=>
      [role,Object.fromEntries([...new Set(players.map(p=>p.reason ?? "none"))].map(reason=>
        [reason,players.filter(p=>(p.reason ?? "none")===reason).length]))])),
    countingMetricReadiness:rankings.countingReadiness,rateMetricReadiness:rankings.rates.metricReadiness,
    rateReadinessReason:rankings.rates.reason,
    qualifiedRateCounts:Object.fromEntries(Object.entries(rankings.rates.qualified).map(([key,players])=>[key,players.length])),
    sample:payload.players.filter(p=>["中島大輔","上原健太","坂本誠志郎","佐藤輝明","早川隆久"].includes(p.displayName))}));
} finally {source.close();}
