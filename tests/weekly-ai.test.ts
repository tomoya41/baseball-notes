import { it,expect,vi } from "vitest";
import { mkdtemp,rm,readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join,resolve } from "node:path";
import { readMlbWeekly } from "../src/application/mlb-weekly";
import { prepareWeeklyAiInput,validateWeeklyAiSelection,generateWeeklyAiSelection } from "../src/data/weekly-ai-insights";
import { claimInsightAttempt } from "../scripts/lib/optional-ai-budget";
import { weeklyFixture } from "./fixtures/weekly-analysis";

const config={accountId:"a".repeat(32),token:"private-test-token",freePlanReviewed:true,termsReviewed:true};
async function setup(){const f=weeklyFixture(),r=await readMlbWeekly(f.manifest,2025,"2025-09-22","regular",f.read);return {f,r,input:prepareWeeklyAiInput(r)};}
function pick(){return {picks:[{candidateRef:"C1",reason:"batting_impact",metricIds:["OPS","PA"]}]};}
it("keeps hash/canonical IDs/exact values in program control, not model transcription",async()=>{
  const {f,r,input}=await setup();expect(prepareWeeklyAiInput(r).inputSha256).toBe(input.inputSha256);
  const request=vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true,result:{response:JSON.stringify(pick())}})));
  const result=await generateWeeklyAiSelection(input,config,request);expect(result.status).toBe("CANDIDATE_REQUIRES_REVIEW");
  const body=JSON.parse(request.mock.calls[0]![1].body),user=body.messages.find((m:{role:string})=>m.role==="user").content;
  expect(user).not.toContain(input.inputSha256);expect(user).not.toContain(f.ids[0]);expect(user).not.toContain('"subjectId"');
  const selection=validateWeeklyAiSelection(pick(),input);expect(selection.picks[0]).toMatchObject({subjectId:f.ids[0],metrics:{OPS:2.25,PA:28}});expect(selection.publiclyAdmitted).toBe(false);
});
it("returns bounded safe rejection codes instead of opaque failures or arbitrary model/error text",async()=>{
  const {input}=await setup();
  const cases=[{value:{picks:[{...pick().picks[0],candidateRef:"C99"}]},code:"UNKNOWN_CANDIDATE"},
    {value:{picks:[{...pick().picks[0],reason:"pitching_impact"}]},code:"UNSUPPORTED_REASON"},
    {value:{picks:[{...pick().picks[0],metricIds:["OPS","invented"]}]},code:"UNSUPPORTED_METRIC"},
    {value:{picks:[pick().picks[0],pick().picks[0]]},code:"DUPLICATE_SELECTION"},
    {value:{...pick(),headline:"unverified text"},code:"SCHEMA_MISMATCH"}];
  for(const c of cases){const request=vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true,result:{response:JSON.stringify(c.value)}})));
    const result=await generateWeeklyAiSelection(input,config,request);expect(result).toMatchObject({status:"INVALID_OR_UNAVAILABLE_CANDIDATE",rejectionCode:c.code,requests:1,publiclyAdmitted:false});expect(request).toHaveBeenCalledOnce();expect(JSON.stringify(result)).not.toContain("unverified text");}
});
it("accepts a single exact JSON fence but rejects prose/unknown values without retrying",async()=>{
  const {input}=await setup();
  for(const [response,status,code] of [["```json\n"+JSON.stringify(pick())+"\n```","CANDIDATE_REQUIRES_REVIEW",undefined],
    ["Explanation: "+JSON.stringify(pick()),"INVALID_OR_UNAVAILABLE_CANDIDATE","INVALID_JSON"],["{","INVALID_OR_UNAVAILABLE_CANDIDATE","INVALID_JSON"]] as const){
    const request=vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true,result:{response}}))),result=await generateWeeklyAiSelection(input,config,request);
    expect(result.status).toBe(status);if(code)expect(result).toHaveProperty("rejectionCode",code);expect(request).toHaveBeenCalledOnce();
  }
});
it("never offers NPB player HOT behind another name, and skips empty evidence",async()=>{
  const {r}=await setup();
  expect(()=>prepareWeeklyAiInput({...r,summary:{...r.summary,scope:{league:"NPB",season:2026,competition:"regular"}}})).toThrow("gate closed");
  const input=prepareWeeklyAiInput({...r,hot:{},rising:[],summary:{...r.summary,games:[],highlights:[],teams:[]}}),request=vi.fn();
  expect((await generateWeeklyAiSelection(input,config,request)).status).toBe("NO_SUPPORTED_CANDIDATES");expect(request).not.toHaveBeenCalled();
});
it("shares one UTC-day reservation across legacy/weekly, failed attempts, reruns and next-day unchanged input",async()=>{
  const root=await mkdtemp(join(tmpdir(),"weekly-ai-test-"));
  if(!resolve(root).startsWith(resolve(tmpdir())+"\\weekly-ai-test-")&&!resolve(root).startsWith(resolve(tmpdir())+"/weekly-ai-test-"))throw Error("Unsafe test cleanup");
  try{
    const now=new Date("2026-10-25T23:59:59Z"),hash="a".repeat(64),other="b".repeat(64);
    const results=await Promise.all([claimInsightAttempt(root,hash,now),claimInsightAttempt(root,other,now)]);
    expect(results.filter(r=>r.status==="RESERVED")).toHaveLength(1);expect(results.filter(r=>r.status==="DAILY_BUDGET_OR_INFLIGHT")).toHaveLength(1);
    const used=JSON.parse(await readFile(join(root,"attempt-2026-10-25.json"),"utf8")).inputSha256 as string;
    expect((await claimInsightAttempt(root,used,new Date("2026-10-26T00:00:00Z"))).status).toBe("UNCHANGED_INPUT");
    expect((await claimInsightAttempt(root,used===hash?other:hash,new Date("2026-10-26T00:00:00Z"))).status).toBe("RESERVED");
  }finally{await rm(root,{recursive:true,force:true});}
});
