import type { PlayerPeriodBatchResult } from "./player-period-batch";
import type { AggregateMetric, BattingPeriodResult, PitchingPeriodResult } from "../domain/player-period";

export type HotRole = "batter" | "starter" | "reliever" | "unclassified_pitcher";
export type HotDivision = "Central" | "Pacific";
export type HotCandidateMetadata = { displayName?: string; teamId?: string; division?: HotDivision; position?: string };
export type HotEligibilityReason = "coverage_not_complete" | "insufficient_sample" |
  "metric_partial" | "metric_unavailable";

// Initial, reviewable sample policy. No composite score or league percentile is implied.
export const DEFAULT_HOT_SAMPLE_POLICY = Object.freeze({ batterPa: 20, starterGs: 1,
  starterOuts: 15, relieverAppearances: 2, relieverOuts: 6 });
export type HotSamplePolicy = Readonly<{ batterPa: number; starterGs: number; starterOuts: number;
  relieverAppearances: number; relieverOuts: number }>;

export type HotRankInputs = { primary: number | null; first: number | null; second: number | null;
  third: number | null; playerId: string };
type HotCandidateBase = {
  playerId: string; role: HotRole; period: "7d"; from: string; to: string;
  coverage: BattingPeriodResult["coverage"];
  eligibility: "eligible" | "ineligible";
  eligibilityReasons: HotEligibilityReason[];
  primaryMetric: { id: "OPS" | "ERA"; metric: AggregateMetric };
  rankInputs: HotRankInputs;
  reason: string | null;
  metadata?: HotCandidateMetadata;
};
export type BatterHotCandidate = HotCandidateBase & { role: "batter"; stats: BattingPeriodResult;
  sample: { games: number; pa: number | null; ab: number | null } };
export type PitcherHotCandidate = HotCandidateBase & { role: "starter" | "reliever" | "unclassified_pitcher";
  stats: PitchingPeriodResult; sample: { appearances: number | null; starts: number | null;
    reliefAppearances: number | null; bf: number | null; outsRecorded: number | null } };
export type HotCandidate = BatterHotCandidate | PitcherHotCandidate;
export type RankedHotRole = "batter" | "starter" | "reliever";
export type HotCandidateResult = {
  period: "7d"; from: string; to: string;
  candidates: HotCandidate[];
  top: Record<RankedHotRole, HotCandidate[]>;
  eligibleCounts: Record<RankedHotRole, number>;
  coverageComplete: Record<RankedHotRole, number>;
  productionGate: { ready: boolean; roleReady: Record<RankedHotRole, boolean>;
    reason: "ready" | "no_eligible_candidates" };
};
export type HotCandidateOptions = { limit?: number; division?: "NPB" | HotDivision;
  metadata?: ReadonlyMap<string, HotCandidateMetadata>; samplePolicy?: HotSamplePolicy };

function metricReasons(metrics: readonly AggregateMetric[]): HotEligibilityReason[] {
  const reasons: HotEligibilityReason[] = [];
  if (metrics.some((metric) => metric.status === "partial")) reasons.push("metric_partial");
  if (metrics.some((metric) => metric.status === "unavailable" ||
    (metric.status === "complete" && metric.value === null))) reasons.push("metric_unavailable");
  return reasons;
}
function eligibility(coverage: HotCandidateBase["coverage"], required: readonly AggregateMetric[],
  sampleSufficient: boolean): { eligibility: HotCandidateBase["eligibility"]; eligibilityReasons: HotEligibilityReason[] } {
  const reasons: HotEligibilityReason[] = [];
  if (coverage.status !== "complete") reasons.push("coverage_not_complete");
  reasons.push(...metricReasons(required));
  if (!sampleSufficient) reasons.push("insufficient_sample");
  return { eligibility: reasons.length ? "ineligible" : "eligible", eligibilityReasons: reasons };
}
function rankInputs(playerId: string, primary: AggregateMetric, first: AggregateMetric,
  second: AggregateMetric, third: AggregateMetric): HotRankInputs {
  return { primary: primary.value, first: first.value, second: second.value,
    third: third.value, playerId };
}
function batterCandidate(stats: BattingPeriodResult, policy: HotSamplePolicy,
  metadata?: HotCandidateMetadata): BatterHotCandidate {
  const { OPS, PA, AB, HR, H } = stats.metrics;
  return { playerId: stats.playerId, role: "batter", period: "7d", from: stats.from, to: stats.to,
    coverage: stats.coverage, stats, ...(metadata ? { metadata } : {}),
    sample: { games: stats.games, pa: PA.value, ab: AB.value },
    primaryMetric: { id: "OPS", metric: OPS }, rankInputs: rankInputs(stats.playerId, OPS, PA, HR, H),
    reason: OPS.value === null ? null : `直近7日 OPS ${OPS.value.toFixed(3)}`,
    ...eligibility(stats.coverage, [OPS, PA, HR, H], PA.value !== null && PA.value >= policy.batterPa) };
}
function pitcherCandidate(stats: PitchingPeriodResult, policy: HotSamplePolicy,
  metadata?: HotCandidateMetadata): PitcherHotCandidate {
  const { GS, appearances, outsRecorded, BF, ERA, K9 } = stats.metrics;
  const role: PitcherHotCandidate["role"] = GS.status !== "complete" || GS.value === null ?
    "unclassified_pitcher" : GS.value > 0 ? "starter" : "reliever";
  const reliefAppearances = appearances.value === null || GS.value === null ? null : appearances.value - GS.value;
  const required = role === "starter" ? [GS, outsRecorded, BF, ERA, K9] :
    role === "reliever" ? [GS, appearances, outsRecorded, ERA, K9] : [GS, ERA, K9];
  const sampleSufficient = role === "starter" ? GS.value !== null && GS.value >= policy.starterGs &&
      outsRecorded.value !== null && outsRecorded.value >= policy.starterOuts :
    role === "reliever" ? reliefAppearances !== null && reliefAppearances >= policy.relieverAppearances &&
      outsRecorded.value !== null && outsRecorded.value >= policy.relieverOuts : false;
  return { playerId: stats.playerId, role, period: "7d", from: stats.from, to: stats.to,
    coverage: stats.coverage, stats, ...(metadata ? { metadata } : {}),
    sample: { appearances: appearances.value, starts: GS.value, reliefAppearances,
      bf: BF.value, outsRecorded: outsRecorded.value },
    primaryMetric: { id: "ERA", metric: ERA },
    rankInputs: rankInputs(stats.playerId, ERA, K9,
      role === "starter" ? outsRecorded : appearances, role === "starter" ? BF : outsRecorded),
    reason: ERA.value === null ? null : `直近7日 防御率 ${ERA.value.toFixed(2)}`,
    ...eligibility(stats.coverage, required, sampleSufficient) };
}
function compareIds(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
// All ranked inputs are complete and non-null after the eligibility gate.
export function compareHotRankInputs(a: HotRankInputs, b: HotRankInputs, role: RankedHotRole): number {
  const ascending = role === "batter" ? -1 : 1;
  for (const [field, direction] of [["primary", ascending], ["first", -1], ["second", -1],
    ["third", -1]] as const) {
    const difference = (a[field]! - b[field]!) * direction;
    if (difference !== 0) return difference;
  }
  return compareIds(a.playerId, b.playerId);
}
export function compareHotCandidates(a: HotCandidate, b: HotCandidate): number {
  if (a.role !== b.role || a.role === "unclassified_pitcher")
    throw new Error("HOT ranks are compared only within the same classified role");
  return compareHotRankInputs(a.rankInputs, b.rankInputs, a.role);
}

export function evaluateHotCandidates(batch: PlayerPeriodBatchResult,
  options: HotCandidateOptions = {}): HotCandidateResult {
  if (batch.period !== "7d") throw new Error("Production HOT candidates currently require the 7d period");
  const limit = options.limit ?? 10;
  if (!Number.isSafeInteger(limit) || limit < 0) throw new Error("HOT limit must be a nonnegative integer");
  const policy = options.samplePolicy ?? DEFAULT_HOT_SAMPLE_POLICY;
  if (Object.values(policy).some((value) => !Number.isSafeInteger(value) || value < 0))
    throw new Error("HOT sample policy must contain nonnegative integers");
  const division = options.division ?? "NPB";
  const allIds = [...batch.batters, ...batch.pitchers].map((row) => row.playerId);
  if (division !== "NPB" && allIds.some((id) => !options.metadata?.get(id)?.division))
    throw new Error("A division filter requires verified metadata for every player");
  const matches = (id: string) => division === "NPB" || options.metadata?.get(id)?.division === division;
  const candidates: HotCandidate[] = [
    ...batch.batters.filter((row) => matches(row.playerId)).map((row) =>
      batterCandidate(row, policy, options.metadata?.get(row.playerId))),
    ...batch.pitchers.filter((row) => matches(row.playerId)).map((row) =>
      pitcherCandidate(row, policy, options.metadata?.get(row.playerId))),
  ];
  const roles = ["batter", "starter", "reliever"] as const;
  const top = {} as HotCandidateResult["top"];
  const eligibleCounts = {} as HotCandidateResult["eligibleCounts"];
  const coverageComplete = {} as HotCandidateResult["coverageComplete"];
  const roleReady = {} as HotCandidateResult["productionGate"]["roleReady"];
  for (const role of roles) {
    const roleCandidates = candidates.filter((row) => row.role === role);
    const eligible = roleCandidates.filter((row) => row.eligibility === "eligible").sort(compareHotCandidates);
    top[role] = eligible.slice(0, limit);
    eligibleCounts[role] = eligible.length;
    coverageComplete[role] = roleCandidates.filter((row) => row.coverage.status === "complete").length;
    roleReady[role] = eligible.length > 0;
  }
  const ready = roles.every((role) => roleReady[role]);
  return { period: "7d", from: batch.window.from, to: batch.window.to,
    candidates, top, eligibleCounts, coverageComplete,
    productionGate: { ready, roleReady, reason: ready ? "ready" : "no_eligible_candidates" } };
}
