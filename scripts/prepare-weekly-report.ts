import { mkdir,readFile,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prepareNpbWeeklyReport } from "../src/data/weekly-report-preparation";
import { readNpbWeekly } from "../src/application/npb-weekly";
import { readNpbCs } from "../src/application/npb-cs-reader";
import { readNpbJapanSeries } from "../src/application/npb-japan-series-reader";
import { StaticGameSurfaceRepository } from "../src/infrastructure/providers/static-game-surface-repository";

const root=".data/weekly-reports",base="https://tomoya41.github.io/baseball-notes/";
const request:typeof fetch=(url,init)=>fetch(url,{...init,redirect:"error",signal:AbortSignal.timeout(15000)});
const surface=new StaticGameSurfaceRepository(base,request);
let cs:ReturnType<typeof readNpbCs>|undefined,japan:ReturnType<typeof readNpbJapanSeries>|undefined;
const sources={cs:()=>cs??=readNpbCs(request,base),japanSeries:()=>japan??=readNpbJapanSeries(request,base)};
const value=await prepareNpbWeeklyReport((stage,week)=>readNpbWeekly(stage,week,surface,sources),new Date(),process.env.WEEKLY_REPORT_WEEK?.trim()||undefined);
await mkdir(join(root,"reports"),{recursive:true});
let status:string=value.status;
if(value.status==="REPORT_PREPARED"){
  const directory=join(root,"reports",value.contentSha256);await mkdir(directory,{recursive:true});
  const path=join(directory,"report.json"),body=JSON.stringify(value.report);
  try{await writeFile(path,body,{flag:"wx"});}catch(error){if(!error||typeof error!=="object"||!("code" in error)||error.code!=="EEXIST")throw error;
    if(await readFile(path,"utf8")!==body)throw Error("Weekly report cache conflict",{cause:error});status="UNCHANGED_VERIFIED_REPORT";}
}
await writeFile(join(root,"review.json"),JSON.stringify({...value,status,preparedAt:new Date().toISOString()},null,2));
console.log(JSON.stringify({status,week:value.week.from,contentSha256:"contentSha256" in value?value.contentSha256:null,aiRequests:0,canonicalWrites:0,publiclyAdmitted:false}));
if(status==="SOURCE_UNAVAILABLE")process.exitCode=1;
