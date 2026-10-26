import { appendFile,readFile,writeFile } from "node:fs/promises";
import { restoredInsightHistory } from "./lib/optional-ai-budget";

const root=".data/npb-ai-insights",available=await restoredInsightHistory(root,process.env.RESTORED_AI_CACHE_KEY);
if(!process.env.GITHUB_OUTPUT)throw Error("Actions output path required");
await appendFile(process.env.GITHUB_OUTPUT,`available=${available}\n`);
if(!available&&process.env.GENERATE_AI==="true"){
  const path=`${root}/review.json`,report=JSON.parse(await readFile(path,"utf8")) as Record<string,unknown>;
  await writeFile(path,JSON.stringify({...report,status:"BUDGET_STATE_UNAVAILABLE",requests:0,publiclyAdmitted:false},null,2));
}
console.log(JSON.stringify({restoredAttemptHistory:available,requests:0}));
