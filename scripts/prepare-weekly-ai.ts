import { mkdir,writeFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { readMlbWeekly,type WeeklyManifest } from "../src/application/mlb-weekly";
import { prepareWeeklyAiInput,generateWeeklyAiSelection } from "../src/data/weekly-ai-insights";
import { weeklyPublicReader } from "./lib/weekly-public-reader";
import { claimInsightAttempt } from "./lib/optional-ai-budget";

const season=z.coerce.number().int().min(2014).max(2025).parse(process.env.WEEKLY_SEASON??"2025"),
  week=z.iso.date().parse(process.env.WEEKLY_WEEK??"2025-09-22"),competition=z.enum(["regular","postseason"]).parse(process.env.WEEKLY_COMPETITION??"regular");
const reader=weeklyPublicReader(),prefix=competition==="postseason"?"postseason/":"",
  manifest=await reader.read<WeeklyManifest>(`${prefix}manifest.json`),report=await readMlbWeekly(manifest,season,week,competition,reader.read),input=prepareWeeklyAiInput(report);
const root=".data/npb-ai-insights",directory=join(root,input.inputSha256);await mkdir(directory,{recursive:true});
await mkdir(".data/weekly-analysis/reports",{recursive:true});
await writeFile(`.data/weekly-analysis/reports/${season}-${competition}-${report.summary.week.from}.json`,JSON.stringify({...report,names:[...report.names]},null,2));
await writeFile(join(directory,"weekly-evidence.json"),JSON.stringify(input,null,2));
async function record(outcome:object){
  await writeFile(join(root,"review.json"),JSON.stringify({schemaVersion:1,preparedAt:new Date().toISOString(),kind:"weekly_selection",input,
    humanReview:{relevance:"NOT_RUN",factsAndReferences:"NOT_RUN",japanese:"NOT_RUN"},measuredNeurons:null,...outcome,publiclyAdmitted:false},null,2));
  const safe=outcome as Record<string,unknown>;
  console.log(JSON.stringify({status:safe.status,requests:safe.requests,httpStatus:safe.httpStatus,rejectionCode:safe.rejectionCode,usage:safe.usage,inputSha256:input.inputSha256,publiclyAdmitted:false}));
}
if(!process.argv.includes("--generate"))await record({status:"INPUT_PREPARED",requests:0,candidates:input.candidates.length,staticReads:reader.stats()});
else{
  const config={accountId:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_AI_TOKEN,freePlanReviewed:process.env.NPB_AI_FREE_PLAN_REVIEWED==="true",termsReviewed:process.env.NPB_AI_TERMS_REVIEWED==="true"};
  if(!config.accountId||!config.token||!config.freePlanReviewed||!config.termsReviewed)await record({status:"DISABLED_OWNER_SETUP_REQUIRED",requests:0});
  else if(!input.candidates.length)await record({status:"NO_SUPPORTED_CANDIDATES",requests:0});
  else{
    const budget=await claimInsightAttempt(root,input.inputSha256);
    if(budget.status!=="RESERVED")await record({status:budget.status,requests:0});
    else{await record({status:"ATTEMPT_STARTED",requests:null});const outcome=await generateWeeklyAiSelection(input,config);
      await writeFile(join(directory,"weekly-candidate.json"),JSON.stringify(outcome,null,2));await record(outcome);}
  }
}
