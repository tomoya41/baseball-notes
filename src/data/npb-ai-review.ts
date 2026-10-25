import type { NpbAiEvidence } from "./npb-ai-insights";
import type { generateNpbAiCandidate } from "../infrastructure/providers/cloudflare-ai-insights";

type Outcome=Awaited<ReturnType<typeof generateNpbAiCandidate>>|{
  status:"INPUT_PREPARED"|"UNCHANGED_INPUT"|"DAILY_BUDGET_OR_INFLIGHT";
  requests:0;publiclyAdmitted:false;
}|{status:"ATTEMPT_STARTED";requests:null;publiclyAdmitted:false};

/** Explicit allowlist for a downloadable review artifact, never an app payload. */
export function buildNpbAiReview(input:NpbAiEvidence,outcome:Outcome,now=new Date()) {
  return {schemaVersion:1,preparedAt:now.toISOString(),status:outcome.status,requests:outcome.requests,
    publiclyAdmitted:false,narrativeReviewRequired:true,input,
    httpStatus:"httpStatus" in outcome?outcome.httpStatus:null,
    failureStage:"failureStage" in outcome?outcome.failureStage:null,
    usage:"usage" in outcome?outcome.usage:null,
    // Tokens are provider-reported. Neurons need an independent dashboard measurement.
    measuredNeurons:null,
    candidate:outcome.status==="CANDIDATE_REQUIRES_REVIEW"?{
      draft:outcome.draft,provider:outcome.provider,model:outcome.model,generatedAt:outcome.generatedAt,
    }:null,
    humanReview:{japanese:"NOT_RUN",baseballTerminology:"NOT_RUN",factsAndReferences:"NOT_RUN",
      scopeAndUnknowns:"NOT_RUN",sourceAttribution:"NOT_RUN"},
  };
}
