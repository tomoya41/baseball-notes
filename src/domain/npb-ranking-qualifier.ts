import type { AggregateMetric } from "./player-period";

// NPB 2026 stats pages / official rule 9.22. See docs/npb-ranking-qualifiers.md.
export const npbQualifierPolicy = {season:2026,verifiedAt:"2026-09-27",battingPaPerGame:3.1,pitchingOutsPerGame:3} as const;
export type Qualification = {status:"qualified"|"unqualified"|"unknown";threshold:number|null;reason:string|null};
export function qualifyNpbSeason(input:{role:"batting"|"pitching";coverageComplete:boolean;
  teamGames:number|null;playerTeamIds:readonly string[];displayTeamId:string|null;sample:AggregateMetric}):Qualification {
  if (!input.coverageComplete) return {status:"unknown",threshold:null,reason:"season_coverage_not_complete"};
  const teams=[...new Set(input.playerTeamIds)];
  if (teams.length!==1 || teams[0]!==input.displayTeamId)
    return {status:"unknown",threshold:null,reason:"player_team_context_unverified"};
  if (input.teamGames===null || !Number.isInteger(input.teamGames) || input.teamGames<=0)
    return {status:"unknown",threshold:null,reason:"team_games_unverified"};
  const threshold=input.role==="batting"?Math.floor((input.teamGames*31+5)/10):input.teamGames*3;
  if (input.sample.status!=="complete" || input.sample.value===null)
    return {status:"unknown",threshold,reason:"sample_metric_incomplete"};
  return {status:input.sample.value>=threshold?"qualified":"unqualified",threshold,reason:null};
}
