import {expect,it} from "vitest";
import {draftFixture} from "./fixtures/npb-draft";
import {draftEventSchema,draftPredictionComparison} from "../src/domain/npb-draft-event";
import {draftUpdateReport} from "../src/application/npb-draft-update-report";
const update=()=>{const d=draftFixture();d.observedAt="2026-10-22T10:00:00Z";d.review={reviewedBy:"fixture",reviewedAt:"2026-10-22T10:01:00Z"};d.eventState="ended";d.coverage="partial";d.selections=[{teamId:"npb:team:tigers",type:"regular",round:1,status:"confirmed",candidateId:d.candidates[0]!.id,sourcePageId:5209342,evidenceSha256:"c".repeat(64)}];return d;};
it("rehearses selection deltas and all twelve comparisons without editing frozen forecasts or publishing",()=>{
  const previous=draftFixture(),next=draftEventSchema.parse(update()),r=draftUpdateReport(previous,next);
  expect(r.addedSelections).toHaveLength(1);expect(r.comparisons).toHaveLength(12);expect(r.comparisons.find(p=>p.teamId==="npb:team:tigers")?.outcome).toBe("match");expect(r.comparisons.filter(p=>p.outcome==="unavailable")).toHaveLength(11);
  expect(next.forecast).toEqual(previous.forecast);expect(previous.selections).toHaveLength(0);expect(draftUpdateReport(next,next).addedSelections).toHaveLength(0);
  const changed=structuredClone(next);changed.forecast.predictions[0]!.reason="後から書き換え";expect(()=>draftUpdateReport(previous,changed)).toThrow("immutable");
});
it("keeps affiliation/name ambiguities unverified and ignores developmental first selections",()=>{
  const d=update(),candidate={...d.candidates[0]!,id:"npb:draft:2026:"+"c".repeat(24),affiliation:"別大学"};d.candidates.push(candidate);d.selections[0]!.candidateId=candidate.id;
  const pair=draftPredictionComparison(d,"npb:team:tigers");expect(pair.outcome).toBe("unverified");expect(pair.expected?.affiliation).not.toBe(pair.actual?.affiliation);
  d.selections[0]!.type="developmental";expect(draftPredictionComparison(d,"npb:team:tigers").actual).toBeUndefined();
});
