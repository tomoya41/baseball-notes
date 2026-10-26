export type AiRejectionCode="INVALID_JSON"|"SCHEMA_MISMATCH"|"UNKNOWN_CANDIDATE"|"DUPLICATE_SELECTION"|"UNSUPPORTED_REASON"|"UNSUPPORTED_METRIC"|"EVIDENCE_MISMATCH"|"UNSUPPORTED_NUMBER"|"CREDENTIAL_REFLECTION"|"RESPONSE_LIMIT"|"PROVIDER_RESPONSE";
export class AiCandidateRejection extends Error {
  constructor(readonly code:AiRejectionCode){super(code);}
}

// Never retain Zod messages, unexpected keys, received values or provider text.
const fields=new Set(["picks","candidateRef","reason","metricIds","schemaVersion","inputSha256","kind","headline","body","factIds"]);
const codes=new Set(["invalid_type","invalid_value","too_small","too_big","unrecognized_keys","invalid_format","custom","invalid_union"]);
export function safeAiValidationIssues(issues:readonly {path:readonly PropertyKey[];code:string}[]) {
  return issues.slice(0,5).map(issue=>({
    path:issue.path.slice(0,4).map(p=>typeof p==="number"&&Number.isSafeInteger(p)&&p>=0&&p<=20?String(p):typeof p==="string"&&fields.has(p)?p:"field").join(".")||"root",
    code:codes.has(issue.code)?issue.code:"schema_error",
  }));
}
