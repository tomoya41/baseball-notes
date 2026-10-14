import { mkdir,mkdtemp,writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { openDataClient } from "../src/data/database";
import { exportNpbBackup,restoreNpbBackup,verifyRestoredNpbRepository } from "../src/data/npb-backup";
import { recoverySnapshot } from "../src/data/npb-controlled-recovery";
import { createNf3DryRunSession } from "../src/data/npb-day-dry-run";
import { auditShortenedCandidates,selectOnlyClient } from "../src/data/npb-shortened-readiness";

const url=process.env.TURSO_DATABASE_URL,token=process.env.TURSO_AUTH_TOKEN;
if(!url||url.startsWith("file:")||!token)throw Error("Remote read-only connection required");
const output=".data/shortened-readiness",start=performance.now();
await mkdir(output,{recursive:true});const privateRoot=await mkdtemp(join(output,"private-"));
const remote=selectOnlyClient(openDataClient(url,token)),scratch=openDataClient(`file:${join(privateRoot,"scratch.db")}`);
const digest=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
const summary=(v:Awaited<ReturnType<typeof recoverySnapshot>>)=>Object.fromEntries(Object.entries(v).map(([k,rows])=>[k,{count:rows.length,sha256:digest(rows)}]));
let results:Awaited<ReturnType<typeof auditShortenedCandidates>>=[],failure:string|null=null;
const session=createNf3DryRunSession(1000),capturedUrls=new Set<string>();
const request=async(u:string)=>{
  // Existing transport allows at most two attempts. Reserve that retry budget;
  // cached reads remain available after exhaustion and add no HTTP traffic.
  if(session.metrics.httpRequests>=499&&!capturedUrls.has(u))throw Error("Bounded Source request budget exhausted");
  const html=await session.request(u);capturedUrls.add(u);return html;
};
try {
  const before=summary(await recoverySnapshot(remote));
  await exportNpbBackup(remote,join(privateRoot,"export"),"canonical-read-only");
  await restoreNpbBackup(scratch,join(privateRoot,"export"));const restored=await verifyRestoredNpbRepository(scratch);
  if(JSON.stringify(summary(await recoverySnapshot(scratch)))!==JSON.stringify(before))throw Error("Restored snapshot differs from protected baseline");
  try{results=await auditShortenedCandidates(selectOnlyClient(scratch),request);}catch(e){failure=String(e);}
  const after=summary(await recoverySnapshot(remote)),scratchAfter=summary(await recoverySnapshot(scratch));
  const unchanged=JSON.stringify(before)===JSON.stringify(after)&&JSON.stringify(before)===JSON.stringify(scratchAfter);
  const report={observedAt:new Date().toISOString(),mode:"read-only-scratch-dry-run",canonicalWrites:0,
    sourceRequests:session.metrics,requestBudget:500,elapsedMs:performance.now()-start,restored,before,after,unchanged,results,failure};
  await writeFile(join(output,"report.json"),JSON.stringify(report,null,2));
  console.log(JSON.stringify({games:results.length,unchanged,failure,sourceRequests:session.metrics,elapsedMs:report.elapsedMs}));
  if(!unchanged||failure)throw Error("Shortened audit could not complete safely; bounded report retained");
}finally{scratch.close();remote.close();}
