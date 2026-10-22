import {draftResearchedPredictionOutcome} from "../domain/npb-draft-research";
import {assertDraftSnapshotAdvance,draftPredictionComparison,draftExpandedPredictionOutcome,type DraftEvent} from "../domain/npb-draft-event";
import {draftForecastAdmission} from "../domain/npb-draft-eligibility";
import finalJson from "../data/npb-draft-2026-final-forecast.json";
import {finalDraftForecastSchema,finalDraftOutcome,finalResultBridgesSchema} from "../domain/npb-draft-final";
import finalBridgeJson from "../data/npb-draft-final-result-bridges.json";

/** Offline review aid, never source admission or publication authorization. */
export function draftUpdateReport(previous:DraftEvent,next:DraftEvent){
  assertDraftSnapshotAdvance(previous,next);
  const oldSelections=new Set(previous.selections.map(s=>JSON.stringify(s)));
  const admitted=(candidateId:string)=>{const c=next.candidates.find(c=>c.id===candidateId);return !!c&&draftForecastAdmission(c,next.candidateGroups?.find(g=>g.candidateId===candidateId)?.group).admitted;};
  const final=finalDraftForecastSchema.parse(finalJson);
  return {status:"REVIEW_REQUIRED" as const,forecastUnchanged:true,coverage:next.coverage,eventState:next.eventState,
    finalForecastId:final.id,finalForecastFrozenAt:final.frozenAt,
    finalComparisons:final.predictions.map(p=>({teamId:p.teamId,round:p.round,outcome:finalDraftOutcome(final,next,p.teamId,p.round,finalResultBridgesSchema.parse(finalBridgeJson))})),
    addedCandidateIds:next.candidates.filter(c=>!previous.candidates.some(p=>p.id===c.id)).map(c=>c.id),
    addedSelections:next.selections.filter(s=>!oldSelections.has(JSON.stringify(s))),
    lotteryChanges:next.lotteries.filter(l=>!previous.lotteries.some(p=>JSON.stringify(p)===JSON.stringify(l))),
    researchedForecastUnchanged:previous.researchedForecast?JSON.stringify(previous.researchedForecast)===JSON.stringify(next.researchedForecast):null,researchedComparisons:next.researchedForecast?.predictions.map(p=>({teamId:p.teamId,round:p.round,outcome:admitted(p.candidateId)?draftResearchedPredictionOutcome(next,p.teamId,p.round):"withheld"}))??[],comparisons:next.forecast.predictions.map(p=>({...draftPredictionComparison(next,p.teamId),...(!admitted(p.candidateId)?{outcome:"withheld"}: {})})),expandedForecastUnchanged:previous.expandedForecast?JSON.stringify(previous.expandedForecast)===JSON.stringify(next.expandedForecast):null,
    expandedComparisons:next.expandedForecast?.predictions.map(p=>({teamId:p.teamId,round:p.round,outcome:admitted(p.candidateId)?draftExpandedPredictionOutcome(next,p.teamId,p.round):"withheld"}))??[],canonicalWrites:0,sourceRequests:0};
}
