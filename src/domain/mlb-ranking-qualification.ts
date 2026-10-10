import { battingAggregate } from "./mlb-historical-aggregate";
import type { DatedBatter } from "./mlb-historical-aggregate";
import type { AggregateMetric } from "./player-period";

// Verified scheduled-league denominators, not observed completed Game counts.
// Provenance and the revised 2020 schedule are in docs/mlb-ranking-rule-2026-09-30.md.
export const historicalQualificationSeasons: Readonly<Record<number, { scheduledGames: number; source: string }>> = {
  2016: { scheduledGames: 162, source: "https://www.mlb.com/rockies/news/colorado-rockies-2016-schedule-announced/c-148078084" },
  2017: { scheduledGames: 162, source: "https://www.mlb.com/news/mlb-releases-2017-sf-giants-schedule-c201353174" },
  2018: { scheduledGames: 162, source: "https://www.mlb.com/press-release/game-times-announced-for-tigers-2018-schedule-264536196" },
  2019: { scheduledGames: 162, source: "https://www.mlb.com/press-release/colorado-rockies-2019-schedule-announced-291431288" },
  2020: { scheduledGames: 60, source: "https://www.mlb.com/news/2020-major-league-baseball-schedule-released" },
  2021: { scheduledGames: 162, source: "https://www.mlb.com/press-release/press-release-mlb-announces-2021-regular-season-schedule" },
  2022: { scheduledGames: 162, source: "https://www.mlb.com/news/mlb-mlbpa-agree-to-cba" },
  2023: { scheduledGames: 162, source: "https://www.mlb.com/news/2023-mlb-schedule" },
  2024: { scheduledGames: 162, source: "https://www.mlb.com/press-release/royals-announce-2024-regular-season-schedule" },
  2025: { scheduledGames: 162, source: "https://www.mlb.com/press-release/press-release-mlb-announces-2025-regular-season-schedule" },
};
export function scheduledMlbGames(season: number): number | null {
  return historicalQualificationSeasons[season]?.scheduledGames ?? null;
}
export type Qualification = "qualified" | "qualified_by_exception" | "unqualified" | "unknown";
export function mlbBattingQualification(season: number, pa: number | null): Qualification {
  const games = scheduledMlbGames(season);
  if (games === null || pa === null) return "unknown";
  return pa >= Math.round(games * 3.1) ? "qualified" : "unqualified";
}
export function mlbPitchingQualification(season: number, outsRecorded: number | null): Qualification {
  const games = scheduledMlbGames(season);
  if (games === null || outsRecorded === null) return "unknown";
  return outsRecorded >= games * 3 ? "qualified" : "unqualified";
}
export function pitchingRateQualification(season: number, metrics: Record<string, AggregateMetric>, metric: "ERA" | "K9",
  coverageComplete: boolean): Qualification {
  if (!coverageComplete || metrics.outsRecorded?.status !== "complete") return "unknown";
  const state = mlbPitchingQualification(season, metrics.outsRecorded.value);
  return state === "qualified" && (metrics[metric]?.value === null || metrics[metric]?.status !== "complete") ? "unknown" : state;
}

export type BattingRateMetric = "AVG" | "OBP" | "SLG" | "OPS";
export type QualificationResult = { state: Qualification; requiredPa: number | null; missingPa: number | null;
  adjustedValue: number | null; reason: string };
/** The exception is a league-title comparison, not blanket eligibility for every
 * short-sample player. OPS is an app sample-qualified statistic, not a 9.22 title. */
export function battingRateQualification(season: number, metrics: Record<string, AggregateMetric>,
  metric: BattingRateMetric, coverageComplete: boolean, qualifiedLeagueLeader: number | null): QualificationResult {
  const games = scheduledMlbGames(season), pa = metrics.PA?.value ?? null;
  const requiredPa = games === null ? null : Math.round(games * 3.1);
  const common = { requiredPa, missingPa: requiredPa === null || pa === null ? null : Math.max(0, requiredPa - pa) };
  const unknown = { ...common, state: "unknown" as const, adjustedValue: null, reason: "coverage_or_metric_unknown" };
  if (!coverageComplete || requiredPa === null || pa === null || metrics.PA?.status !== "complete") return unknown;
  if (pa === 0) return { ...common, state: "unqualified", adjustedValue: null, reason: "zero_pa" };
  if (pa >= requiredPa) {
    if (metrics[metric]?.status !== "complete" || metrics[metric]?.value === null) return unknown;
    return { ...common, state: "qualified", adjustedValue: metrics[metric]!.value, reason: "ordinary_scheduled_league_threshold" };
  }
  if (metric === "OPS") return { ...common, state: "unqualified", adjustedValue: null, reason: "no_official_ops_title_exception" };
  if (qualifiedLeagueLeader === null) return unknown;
  const required = metric === "AVG" ? ["AB", "H"] : metric === "OBP" ? ["AB", "H", "BB", "HBP", "SF"] : ["AB", "H", "2B", "3B", "HR"];
  if (required.some(key => metrics[key]?.status !== "complete" || metrics[key]?.value === null)) return unknown;
  // A hypothetical read-model line reuses the existing rate formulas. Stored
  // canonical Facts and displayed original counts are never altered.
  const get = (key: string) => metrics[key]?.value ?? null;
  const hypothetical: DatedBatter = { playerId: "qualification-read-model", gameId: "qualification-read-model",
    teamId: "qualification-read-model", opponentTeamId: "qualification-read-model", date: `${season}-01-01`, season, home: false,
    battingOrder: null, appearanceOrder: null, starter: null, pa: requiredPa, ab: get("AB")! + common.missingPa!,
    hits: get("H"), doubles: get("2B"), triples: get("3B"), homeRuns: get("HR"), bb: get("BB"), hbp: get("HBP"),
    sf: get("SF"), sh: get("SH"), runs: null, rbi: null, so: null, sb: null, cs: null };
  const adjustedValue = battingAggregate(hypothetical.playerId, [hypothetical], hypothetical.date, hypothetical.date).metrics[metric].value;
  if (adjustedValue === null) return unknown;
  return { ...common, adjustedValue, state: adjustedValue >= qualifiedLeagueLeader ? "qualified_by_exception" : "unqualified",
    reason: adjustedValue >= qualifiedLeagueLeader ? "9.22a_title_after_hypothetical_hitless_at_bats" : "exception_below_qualified_league_leader" };
}
