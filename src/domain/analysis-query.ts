import { analysisQuerySchema } from "./analysis";
import type {
  AnalysisCapabilities,
  AnalysisQuery,
  CapabilityId,
} from "./analysis";

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function dateInZone(now: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (name: string) =>
    parts.find((item) => item.type === name)?.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
export function resolveAnalysisWindow(
  input: AnalysisQuery,
  now = Date.now(),
): { startDate: string; endDate: string } | null {
  const q = analysisQuerySchema.parse(input);
  if (q.asOfDate > dateInZone(now, q.timeZone))
    throw new Error("Future reference day");
  const cutoff = shiftDate(q.asOfDate, -1);
  let startDate: string;
  let endDate = cutoff;
  switch (q.period.kind) {
    case "season":
      startDate = `${q.period.year}-01-01`;
      endDate = [`${q.period.year}-12-31`, cutoff].sort()[0]!;
      break;
    case "last-days":
      startDate = shiftDate(cutoff, 1 - q.period.days);
      break;
    case "current-month":
      startDate = `${q.asOfDate.slice(0, 7)}-01`;
      break;
    case "previous-month":
      endDate = shiftDate(`${q.asOfDate.slice(0, 7)}-01`, -1);
      startDate = `${endDate.slice(0, 7)}-01`;
      break;
    case "custom":
      startDate = q.period.startDate;
      endDate = q.period.endDate;
      if (endDate > cutoff)
        throw new Error("Analysis excludes the reference day and future days");
      break;
  }
  return startDate > endDate ? null : { startDate, endDate };
}

const groupRequirements: Record<AnalysisQuery["groupBy"], CapabilityId[]> = {
  none: [],
  handedness: ["handednessSplit"],
  "home-away": ["homeAwaySplit"],
  inning: ["inningSplit"],
  count: ["countSplit"],
  bases: ["baseSplit"],
  outs: ["outsSplit"],
  "pitch-type": ["pitchMix"],
  catcher: ["catcherSplit"],
  velocity: ["pitchVelocity"],
  zone: ["heatmap"],
};
export function requiredCapabilities(q: AnalysisQuery): CapabilityId[] {
  const result: CapabilityId[] = [
    "basicStats",
    ...groupRequirements[q.groupBy],
  ];
  const f = q.filters;
  if (q.period.kind === "last-days") result.push("recentForm");
  if (q.period.kind === "current-month" || q.period.kind === "previous-month")
    result.push("monthlySplit");
  if (q.period.kind === "custom") result.push("dateRange");
  if (
    q.subject.kind === "matchup" ||
    f.opponent.kind === "pitcher" ||
    f.opponent.kind === "batter"
  )
    result.push("matchup");
  if (f.opponent.kind === "handedness") result.push("handednessSplit");
  if (f.bases !== "all") result.push("baseSplit");
  if (f.outs !== null) result.push("outsSplit");
  if (f.count.kind !== "all" || q.population !== "plate-appearances")
    result.push("countSplit");
  if (f.pitchType !== null) result.push("pitchMix");
  if (f.velocity !== null) result.push("pitchVelocity");
  if (f.catcherId !== null) result.push("catcherSplit");
  if (f.homeAway !== "all") result.push("homeAwaySplit");
  if (f.score !== "all") result.push("scoreSplit");
  if (f.inning !== null) result.push("inningSplit");
  return [...new Set(result)].sort();
}
export type QueryAssessment =
  | { enabled: true }
  | {
      enabled: false;
      reason: string;
      status: "unavailable" | "not-implemented";
    };
export function assessAnalysisQuery(
  input: AnalysisQuery,
  manifest: AnalysisCapabilities,
  now = Date.now(),
): QueryAssessment {
  const q = analysisQuerySchema.parse(input);
  const denied = (reason: string): QueryAssessment => ({
    enabled: false,
    reason,
    status: "unavailable",
  });
  if (q.league !== manifest.league)
    return denied("提供元の対象リーグと一致しません");
  if (
    !manifest.subjects.includes(q.subject.kind) ||
    !manifest.seasonTypes.includes(q.seasonType)
  )
    return denied("この分析対象またはシーズン種別は未対応です");
  const window = resolveAnalysisWindow(q, now);
  if (!window) return denied("この期間には前日までに完了した日がありません");
  if (
    !manifest.coverage ||
    window.startDate < manifest.coverage.from ||
    window.endDate > manifest.coverage.through
  )
    return denied("提供元の対象期間外です");
  const needed = requiredCapabilities(q);
  for (const metric of q.metricIds) {
    const extra = Object.hasOwn(manifest.metricRequirements, metric)
      ? manifest.metricRequirements[metric]
      : undefined;
    if (!extra) return denied(`指標 ${metric} はこの提供元で利用できません`);
    needed.push(...extra);
  }
  const features = [...new Set(needed)].sort();
  // Check data/permission first; never hide a terms block behind an implementation label.
  for (const feature of features) {
    const capability = manifest.features[feature];
    if (capability.status !== "available") return denied(capability.reason);
  }
  for (const feature of features)
    if (manifest.features[feature].implementation !== "implemented")
      return {
        enabled: false,
        status: "not-implemented",
        reason: manifest.features[feature].reason,
      };
  if (
    !manifest.periods.includes(q.period.kind) ||
    !manifest.populations.includes(q.population)
  )
    return denied("この期間または集計母集団は未対応です");
  if (
    !manifest.supportedCombinations.some(
      (combo) => [...new Set(combo)].sort().join("|") === features.join("|"),
    )
  )
    return denied("この条件の組み合わせは提供元で検証されていません");
  return { enabled: true };
}

// One deterministic identity for future aggregate caches; no lossy filter omissions.
export function analysisQueryKey(input: AnalysisQuery): string {
  const q = analysisQuerySchema.parse(input);
  return JSON.stringify({ ...q, metricIds: [...q.metricIds].sort() });
}
