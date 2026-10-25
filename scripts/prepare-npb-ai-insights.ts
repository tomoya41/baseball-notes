import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prepareNpbAiEvidence } from "../src/data/npb-ai-insights";
import { generateNpbAiCandidate } from "../src/infrastructure/providers/cloudflare-ai-insights";
import pin from "../src/data/npb-japan-series-release.json";

// Only admitted releases; optional staging never contacts the original source or DB.
const root=".data/npb-ai-insights";
if(process.argv.includes("--stage")){
  const {stageNpbSeries}=await import("./stage-npb-series");
  const {stageNpbJapanSeries}=await import("./stage-npb-japan-series");
  const destination="dist/data/npb/competitions";
  await stageNpbSeries(destination);await stageNpbJapanSeries(destination);
}
const body=await readFile(`dist/data/npb/competitions/${pin.sha256}/japan-series-2026.json`);
const input=prepareNpbAiEvidence(body,pin),directory=join(root,input.inputSha256);
await mkdir(directory,{recursive:true});
await writeFile(join(directory,"evidence.json"),JSON.stringify(input,null,2));
if(!process.argv.includes("--generate")) {
  console.log(JSON.stringify({status:"INPUT_PREPARED",inputSha256:input.inputSha256,facts:input.evidence.facts.length,requests:0,publiclyAdmitted:false}));
} else {
  const config={accountId:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_AI_TOKEN,
    freePlanReviewed:process.env.NPB_AI_FREE_PLAN_REVIEWED==="true",termsReviewed:process.env.NPB_AI_TERMS_REVIEWED==="true"};
  if(!config.accountId||!config.token||!config.freePlanReviewed||!config.termsReviewed){
    console.log(JSON.stringify({status:"DISABLED_OWNER_SETUP_REQUIRED",requests:0,publiclyAdmitted:false}));
  } else if(await readFile(join(directory,"attempt.json")).then(()=>true,()=>false)){
    console.log(JSON.stringify({status:"UNCHANGED_INPUT",requests:0,publiclyAdmitted:false}));
  } else {
    // Exclusive markers precede network access. A failed request is not silently retried.
    const date=new Date().toISOString().slice(0,10);
    try {
      await writeFile(join(root,`attempt-${date}.json`),JSON.stringify({inputSha256:input.inputSha256}),{flag:"wx"});
      await writeFile(join(directory,"attempt.json"),JSON.stringify({at:new Date().toISOString()}),{flag:"wx"});
      const result=await generateNpbAiCandidate(input,config);
      await writeFile(join(directory,"candidate.json"),JSON.stringify(result,null,2));
      console.log(JSON.stringify({status:result.status,requests:result.requests,inputSha256:input.inputSha256,publiclyAdmitted:false}));
    } catch(error) {
      if(error&&typeof error==="object"&&"code" in error&&error.code==="EEXIST")console.log(JSON.stringify({status:"DAILY_BUDGET_OR_INFLIGHT",requests:0,publiclyAdmitted:false}));
      else throw Error("Candidate preparation failed; retain existing app data",{cause:error});
    }
  }
}
