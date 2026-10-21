import {assertDraftSnapshotAdvance,draftPredictionComparison,draftExpandedPredictionOutcome,type DraftEvent} from "../domain/npb-draft-event";

/** Offline review aid, never source admission or publication authorization. */
export function draftUpdateReport(previous:DraftEvent,next:DraftEvent){
  assertDraftSnapshotAdvance(previous,next);
  const oldSelections=new Set(previous.selections.map(s=>JSON.stringify(s)));
  return {status:"REVIEW_REQUIRED" as const,forecastUnchanged:true,coverage:next.coverage,eventState:next.eventState,
    addedCandidateIds:next.candidates.filter(c=>!previous.candidates.some(p=>p.id===c.id)).map(c=>c.id),
    addedSelections:next.selections.filter(s=>!oldSelections.has(JSON.stringify(s))),
    lotteryChanges:next.lotteries.filter(l=>!previous.lotteries.some(p=>JSON.stringify(p)===JSON.stringify(l))),
    comparisons:next.forecast.predictions.map(p=>draftPredictionComparison(next,p.teamId)),expandedForecastUnchanged:previous.expandedForecast?JSON.stringify(previous.expandedForecast)===JSON.stringify(next.expandedForecast):null,
    expandedComparisons:next.expandedForecast?.predictions.map(p=>({teamId:p.teamId,round:p.round,outcome:draftExpandedPredictionOutcome(next,p.teamId,p.round)}))??[],canonicalWrites:0,sourceRequests:0};
}
