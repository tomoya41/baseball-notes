import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { buildWikipediaJapanSeries } from "../src/infrastructure/providers/wikipedia-npb-japan-series";
import { japanResultFixture } from "./fixtures/npb-japan-series";
import { prepareNpbAiEvidence, validateNpbAiDraft } from "../src/data/npb-ai-insights";
import { generateNpbAiCandidate, insightModel } from "../src/infrastructure/providers/cloudflare-ai-insights";
import { buildNpbAiReview } from "../src/data/npb-ai-review";

function input(){const f=japanResultFixture(),data=buildWikipediaJapanSeries(f.archive,f.cs,"b".repeat(64),f.admission,f.review,f.now),body=Buffer.from(JSON.stringify(data));
  return {body,pin:{bodySha256:createHash("sha256").update(body).digest("hex"),seriesId:data.series.id,gameIds:data.series.games.map(g=>g.gameId)}};}
const evidence=()=>{const i=input();return prepareNpbAiEvidence(i.body,i.pin);};
const draft=()=>({schemaVersion:1,inputSha256:evidence().inputSha256,kind:"review",headline:"収録済みの第1戦を振り返る",body:"収録済み結果についての非公開編集候補。",factIds:[evidence().evidence.facts[0]!.id]});
const config={accountId:"a".repeat(32),token:"private-test-token",freePlanReviewed:true,termsReviewed:true};

describe("optional AI evidence and review boundary",()=>{
  it("uses only an admitted immutable snapshot and does not change its bytes",()=>{
    const {body,pin}=input(),before=Buffer.from(body),a=prepareNpbAiEvidence(body,pin);
    expect(body).toEqual(before);expect(a.inputSha256).toBe(prepareNpbAiEvidence(body,pin).inputSha256);
    expect(()=>prepareNpbAiEvidence(Buffer.from(body.toString()+" "),pin)).toThrow("Unadmitted");
    expect(()=>prepareNpbAiEvidence(body,{...pin,seriesId:"wrong"})).toThrow("identity");
    expect(()=>prepareNpbAiEvidence(body,{...pin,gameIds:[]})).toThrow("identity");
  });
  it("preserves unknown scheduled scores and separate scope, provenance and unavailable player data",()=>{
    const a=evidence();expect(a.evidence.scope).toBe("NPB/2026/japan_series");expect(a.evidence.coverage).toBe("partial");
    expect(a.evidence.facts.filter(f=>f.kind==="confirmed_result")).toHaveLength(1);
    for(const f of a.evidence.facts.slice(1)){expect(f.awayRuns).toBeNull();expect(f.homeRuns).toBeNull();expect(f.innings).toBeNull();}
    expect(a.evidence.sources).toHaveLength(2);expect(a.evidence.sources[0]?.url).toContain("oldid=");
    expect(a.evidence.license).toBe("CC-BY-SA-4.0");expect(JSON.stringify(a)).not.toContain('"playerId"');
  });
  it("validates exact evidence references but always requires human prose review",()=>{
    const result=validateNpbAiDraft(draft(),evidence());expect(result.publiclyAdmitted).toBe(false);expect(result.narrativeReviewRequired).toBe(true);
    // Shape/references cannot establish the truth of arbitrary natural language.
    expect(validateNpbAiDraft({...draft(),body:"未確認の主張を含む文。"},evidence()).status).toBe("CANDIDATE_REQUIRES_REVIEW");
    for(const bad of [{...draft(),inputSha256:"f".repeat(64)},{...draft(),factIds:["invented"]},{...draft(),factIds:[draft().factIds[0],draft().factIds[0]]},
      {...draft(),kind:"review",factIds:[evidence().evidence.facts[1]!.id]},{...draft(),kind:"preview"},{...draft(),body:"<script>run()</script>"},{...draft(),publish:true},
      {...draft(),body:"99点を記録した。"},{...draft(),body:"９９点を記録した。"}])
      expect(()=>validateNpbAiDraft(bad,evidence())).toThrow();
  });
  it("makes zero requests if credentials or separate free-plan/terms review are missing",async()=>{
    const request=vi.fn();
    for(const c of [{...config,token:undefined},{...config,freePlanReviewed:false},{...config,termsReviewed:false}]){
      expect((await generateNpbAiCandidate(evidence(),c,request)).status).toBe("DISABLED_OWNER_SETUP_REQUIRED");}
    expect(request).not.toHaveBeenCalled();
  });
  it("uses a single fixed provider/model request with bounded output and no source article body",async()=>{
    const request=vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true,result:{response:JSON.stringify(draft())}})));
    const result=await generateNpbAiCandidate(evidence(),config,request);
    expect(request).toHaveBeenCalledOnce();expect(request.mock.calls[0]![0]).toBe(`https://api.cloudflare.com/client/v4/accounts/${config.accountId}/ai/run/${insightModel}`);
    const options=request.mock.calls[0]![1],payload=JSON.parse(options.body);
    expect(options.redirect).toBe("error");expect(payload.max_tokens).toBe(512);expect(payload.stream).toBe(false);expect(payload.tools).toBeUndefined();
    expect(result.status).toBe("CANDIDATE_REQUIRES_REVIEW");expect(result.publiclyAdmitted).toBe(false);expect(JSON.stringify(result)).not.toContain(config.token);
  });
  it("stops on quota, HTTP failure, redirect/network error and invalid JSON without retries or secret output",async()=>{
    for(const [response,status] of [[new Response("secret",{status:429}),"QUOTA_EXHAUSTED"],[new Response("secret",{status:503}),"PROVIDER_UNAVAILABLE"],
      [new Response("bad JSON"),"INVALID_OR_UNAVAILABLE_CANDIDATE"],[new Response(JSON.stringify({success:true,result:{response:JSON.stringify({...draft(),factIds:["invented"]})}})),"INVALID_OR_UNAVAILABLE_CANDIDATE"]] as const){
      const request=vi.fn().mockResolvedValue(response),result=await generateNpbAiCandidate(evidence(),config,request);
      expect(request).toHaveBeenCalledOnce();expect(result.status).toBe(status);expect(JSON.stringify(result)).not.toContain("secret");expect(result.publiclyAdmitted).toBe(false);
    }
    const request=vi.fn().mockRejectedValue(new Error("Authorization Bearer private-test-token"));
    expect((await generateNpbAiCandidate(evidence(),config,request)).status).toBe("INVALID_OR_UNAVAILABLE_CANDIDATE");expect(request).toHaveBeenCalledOnce();
  });
  it("bounds the actual response body even without Content-Length",async()=>{
    const request=vi.fn().mockResolvedValue(new Response("x".repeat(20_001)));
    expect((await generateNpbAiCandidate(evidence(),config,request)).status).toBe("INVALID_OR_UNAVAILABLE_CANDIDATE");expect(request).toHaveBeenCalledOnce();
  });
  it("distinguishes request, response and draft failures without exporting exception text",async()=>{
    const cases=[{request:vi.fn().mockRejectedValue(new Error("private transport error")),stage:"request"},
      {request:vi.fn().mockResolvedValue(new Response("not JSON")),stage:"response"},
      {request:vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true,result:{response:JSON.stringify({...draft(),factIds:["invented"]})}}))),stage:"draft"}];
    for(const {request,stage} of cases){
      const report=buildNpbAiReview(evidence(),await generateNpbAiCandidate(evidence(),config,request));
      expect(report.failureStage).toBe(stage);expect(JSON.stringify(report)).not.toContain("private transport error");
    }
  });
  it("retains only consistent reported token counts, never invented quota consumption",async()=>{
    for(const [usage,expected] of [[{prompt_tokens:100,completion_tokens:50,total_tokens:150,private_metadata:"do not retain"},
      {prompt_tokens:100,completion_tokens:50,total_tokens:150}],
      [{prompt_tokens:100,completion_tokens:50,total_tokens:149},null],
      [{prompt_tokens:-1,completion_tokens:50,total_tokens:49},null],[{neurons:0},null],[undefined,null]] as const){
      const request=vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true,result:{response:JSON.stringify(draft()),usage}})));
      const result=await generateNpbAiCandidate(evidence(),config,request),report=buildNpbAiReview(evidence(),result);
      expect(report.usage).toEqual(expected);expect(report.measuredNeurons).toBeNull();expect(report.httpStatus).toBe(200);
      expect(JSON.stringify(report)).not.toContain("private_metadata");expect(report.humanReview.factsAndReferences).toBe("NOT_RUN");
    }
  });
  it("exports only validated prose for review and distinguishes absent output from a successful candidate",async()=>{
    const a=evidence();
    const pending=buildNpbAiReview(a,{status:"INPUT_PREPARED",requests:0,publiclyAdmitted:false});
    expect(pending.requests).toBe(0);expect(pending.candidate).toBeNull();expect(pending.publiclyAdmitted).toBe(false);
    const interrupted=buildNpbAiReview(a,{status:"ATTEMPT_STARTED",requests:null,publiclyAdmitted:false});
    expect(interrupted.requests).toBeNull();expect(interrupted.candidate).toBeNull();
    const failed=await generateNpbAiCandidate(a,config,vi.fn().mockResolvedValue(new Response("private error details",{status:403})));
    const report=buildNpbAiReview(a,failed);expect(report.httpStatus).toBe(403);expect(report.candidate).toBeNull();
    expect(JSON.stringify(report)).not.toContain("private error details");expect(report.usage).toBeNull();
    const success=await generateNpbAiCandidate(a,config,vi.fn().mockResolvedValue(new Response(JSON.stringify({success:true,result:{response:JSON.stringify(draft())}}))));
    expect(buildNpbAiReview(a,success).candidate?.draft).toEqual(draft());
  });
  it("rejects reflected credentials before saving even otherwise valid candidate prose",async()=>{
    const echoed={...draft(),body:`収録済みの結果。${config.token}`};
    for(const response of [JSON.stringify({success:true,result:{response:JSON.stringify(echoed)}}),
      JSON.stringify({success:true,result:{response:JSON.stringify(echoed)}}).replaceAll("private-test-token",String.raw`private-test-\u0074oken`)]){
      const result=await generateNpbAiCandidate(evidence(),config,vi.fn().mockResolvedValue(new Response(response)));
      expect(result.status).toBe("INVALID_OR_UNAVAILABLE_CANDIDATE");expect(JSON.stringify(result)).not.toContain(config.token);
      expect(buildNpbAiReview(evidence(),result).candidate).toBeNull();
    }
  });
});
