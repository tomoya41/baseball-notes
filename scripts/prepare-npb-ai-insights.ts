import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prepareNpbAiEvidence } from "../src/data/npb-ai-insights";
import { generateNpbAiCandidate } from "../src/infrastructure/providers/cloudflare-ai-insights";
import { buildNpbAiReview } from "../src/data/npb-ai-review";
import { claimInsightAttempt } from "./lib/optional-ai-budget";
import pin from "../src/data/npb-japan-series-release.json";

// Only admitted releases; optional staging never contacts the original source or DB.
const root=".data/npb-ai-insights";
if(process.argv.includes("--stage")){
  const {stageNpbAiInputs}=await import("./stage-npb-ai-inputs");
  await stageNpbAiInputs();
}
const body=await readFile(`dist/data/npb/competitions/${pin.sha256}/japan-series-2026.json`);
const input=prepareNpbAiEvidence(body,pin),directory=join(root,input.inputSha256);
await mkdir(directory,{recursive:true});
await writeFile(join(directory,"evidence.json"),JSON.stringify(input,null,2));
async function record(outcome:Parameters<typeof buildNpbAiReview>[1]) {
  await writeFile(join(root,"review.json"),JSON.stringify(buildNpbAiReview(input,outcome),null,2));
  console.log(JSON.stringify({status:outcome.status,requests:outcome.requests,inputSha256:input.inputSha256,publiclyAdmitted:false}));
}
if(!process.argv.includes("--generate")) {
  await record({status:"INPUT_PREPARED",requests:0,publiclyAdmitted:false});
} else {
  const config={accountId:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_AI_TOKEN,
    freePlanReviewed:process.env.NPB_AI_FREE_PLAN_REVIEWED==="true",termsReviewed:process.env.NPB_AI_TERMS_REVIEWED==="true"};
  if(!config.accountId||!config.token||!config.freePlanReviewed||!config.termsReviewed){
    await record({status:"DISABLED_OWNER_SETUP_REQUIRED",requests:0,publiclyAdmitted:false});
  } else {
    const budget=await claimInsightAttempt(root,input.inputSha256);
    if(budget.status!=="RESERVED"){await record({status:budget.status,requests:0,publiclyAdmitted:false});}
    else {
    try {
      // If the process stops after dispatch, do not leave a misleading zero-call preflight report.
      await record({status:"ATTEMPT_STARTED",requests:null,publiclyAdmitted:false});
      const result=await generateNpbAiCandidate(input,config);
      await writeFile(join(directory,"candidate.json"),JSON.stringify(result,null,2));
      await record(result);
    } catch(error) {
      throw Error("Candidate preparation failed; retain existing app data",{cause:error});
    }
    }
  }
}
