import type { AnalysisCapabilities, AnalysisQuery, SamplePolicy, SampleSize, Split } from "../domain/analysis";
import { analysisQuerySchema, sampleWarning } from "../domain/analysis";
import { dateInZone } from "../domain/analysis-query";
import { metrics } from "../domain/metrics";
import type { League } from "../domain/models";
import { formatDate, formatMetric, formatMovement, formatSample, formatTopPercentile, formatVelocity } from "./formatters";

export type AnalysisSubject = "batter" | "pitcher";
export type AnalysisCategory = "summary" | "pitch" | "count" | "situation" | "zone" | "batted" | "recent";
export type SituationGroup = "handedness" | "bases" | "outs" | "batting-order" |
  "score-differential" | "game-inning" | "appearance-inning";
export type CountMode = "reached" | "pitch";

export const analysisFilters: AnalysisQuery["filters"] = {
  opponent: { kind: "all" }, bases: "all", outs: null, count: { kind: "all" },
  pitchType: null, velocity: null, catcherId: null, homeAway: "all",
  battingOrder: null, scoreDifferential: { kind: "all" },
  gameInning: null, appearanceInning: null,
};
export const scoreLabels = {
  "lead-3-plus": "3点以上リード", "lead-1-2": "1〜2点リード", tied: "同点",
  "trail-1-2": "1〜2点ビハインド", "trail-3-plus": "3点以上ビハインド",
} as const;
export const situationGroups: Record<AnalysisSubject, readonly { id: SituationGroup; label: string }[]> = {
  batter: [
    { id: "handedness", label: "左右別" }, { id: "bases", label: "走者" },
    { id: "outs", label: "アウト" }, { id: "batting-order", label: "打順" },
    { id: "score-differential", label: "点差" }, { id: "game-inning", label: "試合イニング" },
  ],
  pitcher: [
    { id: "handedness", label: "左右別" }, { id: "bases", label: "走者" },
    { id: "outs", label: "アウト" }, { id: "score-differential", label: "点差" },
    { id: "game-inning", label: "試合イニング" },
    { id: "appearance-inning", label: "登板内イニング順" },
  ],
};
export const categoryLabels: Record<AnalysisSubject, readonly { id: AnalysisCategory; label: string }[]> = {
  batter: [
    { id: "summary", label: "概要" }, { id: "pitch", label: "球種" },
    { id: "count", label: "カウント" }, { id: "situation", label: "状況" },
    { id: "batted", label: "打球・コース" }, { id: "recent", label: "変化" },
  ],
  pitcher: [
    { id: "summary", label: "概要" }, { id: "pitch", label: "球種" },
    { id: "count", label: "配球" }, { id: "situation", label: "状況" },
    { id: "zone", label: "コース" }, { id: "recent", label: "変化" },
  ],
};

export function makeAnalysisQuery(input: {
  league: League; playerId: string; subject: AnalysisSubject;
  category: AnalysisCategory; situation: SituationGroup; countMode: CountMode;
  period: AnalysisQuery["period"]; filters: AnalysisQuery["filters"];
  manifest: AnalysisCapabilities; now?: number;
}): AnalysisQuery {
  const { league, playerId, subject, category, situation, countMode, period, filters, manifest } = input;
  const groupBy = category === "pitch" ? "pitch-type" : category === "count" ? "count"
    : category === "situation" ? situation : category === "zone" ? "zone"
      : category === "batted" ? "batted-ball" : "none";
  const candidates = category === "pitch" ? subject === "pitcher"
    ? ["usagePct", "avgVelocity", "maxVelocity", "whiffPct", "chasePct", "zonePct", "cswPct",
      "xwoba", "spinRate", "verticalMovement", "horizontalMovement", "opponentAvg", "opponentOps"]
    : ["avg", "slg", "ops", "hr", "kPct", "whiffPct", "xba", "xslg", "xwoba",
      "exitVelocity", "hardHitPct", "barrelPct"]
    : category === "count" ? countMode === "reached" ? subject === "batter"
      ? ["avg", "ops", "kPct"] : ["opponentAvg", "opponentOps", "kPct", "bbPct"]
      : ["swingPct", "whiffPct", "chasePct", "usagePct"]
    : category === "batted" ? ["hardHitPct", "barrelPct", "exitVelocity", "xwoba"]
    : category === "zone" ? ["whiffPct", "xwoba"]
    : subject === "batter" ? ["avg", "ops", "obp", "hr", "kPct", "bbPct", "hardHitPct", "barrelPct", "xwoba"]
      : ["era", "whip", "opponentAvg", "opponentOps", "kPct", "bbPct", "whiffPct", "avgVelocity", "xwoba"];
  const metricIds = candidates.filter((id) => Object.hasOwn(manifest.metricRequirements, id));
  return analysisQuerySchema.parse({
    version: 2, league, subject: { kind: subject, playerId },
    asOfDate: dateInZone(input.now ?? Date.now(), league === "NPB" ? "Asia/Tokyo" : "America/New_York"),
    timeZone: league === "NPB" ? "Asia/Tokyo" : "America/New_York",
    period, seasonType: "regular",
    population: category === "count" || filters.count.kind !== "all" ? countMode === "reached" ? "plate-appearance-reached-count" : "pitch-at-count"
      : subject === "batter" ? "plate-appearances" : "batters-faced",
    metricIds: metricIds.length ? metricIds : [candidates[0] ?? "avg"],
    groupBy, filters,
  });
}

export function formatFilterSummary(period: AnalysisQuery["period"], filters: AnalysisQuery["filters"]): string {
  let periodLabel: string;
  switch (period.kind) {
    case "season": periodLabel = `${period.year}年`; break;
    case "last-days": periodLabel = `直近${period.days}日`; break;
    case "current-month": periodLabel = "今月"; break;
    case "previous-month": periodLabel = "前月"; break;
    case "custom": periodLabel = `${formatDate(period.startDate, true)}〜${formatDate(period.endDate, true)}`; break;
  }
  const labels = [periodLabel];
  if (filters.opponent.kind === "handedness") labels.push(`対${filters.opponent.hand}`);
  if (filters.pitchType) labels.push("球種指定");
  if (filters.count.kind !== "all") labels.push(filters.count.kind === "exact"
    ? `${filters.count.state.balls}-${filters.count.state.strikes}` : "カウント指定");
  if (filters.bases !== "all") labels.push("走者指定");
  if (filters.outs !== null) labels.push(`${filters.outs}アウト`);
  if (filters.battingOrder !== null) labels.push(`${filters.battingOrder}番`);
  if (filters.scoreDifferential.kind !== "all") labels.push(filters.scoreDifferential.kind === "exact"
    ? `点差${filters.scoreDifferential.runs}` : scoreLabels[filters.scoreDifferential.value]);
  if (filters.gameInning) labels.push(filters.gameInning.through === null
    ? `${filters.gameInning.from}回以降` : `${filters.gameInning.from}〜${filters.gameInning.through}回`);
  if (filters.appearanceInning) labels.push(filters.appearanceInning.through === null
    ? `登板${filters.appearanceInning.from}イニング目以降` : `登板${filters.appearanceInning.from}イニング目`);
  return labels.length > 3 ? `${labels.slice(0, 2).join(" × ")} · 条件${labels.length - 1}件` : labels.join(" × ");
}

export function splitWarning(split: Split, subject: AnalysisSubject, group: AnalysisQuery["groupBy"], policy: SamplePolicy): string | null {
  const context = group === "appearance-inning" ? "appearanceSplit" : subject === "batter" && split.sampleSize.PA != null
    ? "battingSplit" : split.sampleSize.pitches != null ? "pitchLevel" : split.sampleSize.BBE != null
      ? "battedBall" : subject === "pitcher" ? "pitcherSplit" : "battingSplit";
  return sampleWarning(split.sampleSize, context, policy);
}

export function splitSample(split: Split, subject: AnalysisSubject, group?: AnalysisQuery["groupBy"]): string {
  const preferred = group === "appearance-inning" ? ["appearances", "BF", "pitches", "outs"] as const
    : subject === "pitcher" ? ["pitches", "BF", "appearances", "outs"] as const
    : ["PA", "pitches", "BBE", "AB"] as const;
  const unit = preferred.find((item) => split.sampleSize[item] != null);
  return unit ? formatSample(split.sampleSize, unit) : "母数不明";
}

export function formatSplitMetric(metric: Split["metrics"][number]): string {
  const definition = metrics[metric.definitionId];
  if (!definition) return "—";
  if (["avgVelocity", "maxVelocity", "exitVelocity"].includes(metric.definitionId) &&
    metric.sourceUnit !== "mph" && metric.sourceUnit !== "km/h") return "—";
  if (["verticalMovement", "horizontalMovement"].includes(metric.definitionId)) {
    return metric.value.status === "available" && (metric.sourceUnit === "in" || metric.sourceUnit === "cm")
      ? formatMovement(metric.value.value, metric.sourceUnit) : "—";
  }
  if (metric.value.status === "available" && (metric.sourceUnit === "mph" || metric.sourceUnit === "km/h"))
    return formatVelocity(metric.value.value, metric.sourceUnit);
  const formatted = formatMetric(metric.value, definition);
  return metric.sourceUnit === "rpm" && formatted !== "—" ? `${formatted} rpm` : formatted;
}

export function metricRelativeLabel(metric: Split["metrics"][number], league: League): string | null {
  const definition = metrics[metric.definitionId];
  const comparison = metric.comparison;
  if (!definition || !comparison) return null;
  const top = formatTopPercentile(comparison.percentile, definition, league);
  return top ? `${comparison.population} · ${comparison.season}年 · ${top}` : null;
}

export function comparisonSample(size: SampleSize): string | null {
  const unit = (Object.keys(size) as (keyof SampleSize)[]).find((key) => size[key] != null);
  return unit ? formatSample(size, unit) : null;
}

export function formatMetricDelta(value: number, definitionId: string, sourceUnit?: Split["metrics"][number]["sourceUnit"]): string {
  const definition = metrics[definitionId];
  if (!definition || !Number.isFinite(value)) return "—";
  const sign = value >= 0 ? "+" : "−";
  if (["avgVelocity", "maxVelocity", "exitVelocity"].includes(definitionId))
    return sourceUnit === "mph" || sourceUnit === "km/h"
      ? `${sign}${formatVelocity(Math.abs(value), sourceUnit)}` : "—";
  if (["verticalMovement", "horizontalMovement"].includes(definitionId))
    return sourceUnit === "in" || sourceUnit === "cm"
      ? `${sign}${formatMovement(Math.abs(value), sourceUnit)}` : "—";
  if (definition.format === "percent") return `${sign}${new Intl.NumberFormat("ja-JP", {
    minimumFractionDigits: definition.precision, maximumFractionDigits: definition.precision,
  }).format(Math.abs(value) * 100)}pt`;
  return `${sign}${formatMetric({ status: "available", value: Math.abs(value) }, definition)}`;
}

export function visibleSplitRows(splits: Split[], group: AnalysisQuery["groupBy"], expanded: boolean): Split[] {
  if (expanded) return splits;
  if (group === "count") {
    const keys = ["first-pitch", "pitcher-ahead", "batter-ahead", "two-strikes", "full-count"];
    const selected = splits.filter((split) => keys.includes(split.key));
    return selected.length ? selected : splits.slice(0, 5);
  }
  if (group === "game-inning") {
    const bands = splits.filter((split) => split.key.startsWith("band:"));
    return bands.length ? bands : splits.slice(0, 4);
  }
  if (group === "appearance-inning") {
    const bands = splits.filter((split) => split.key.startsWith("band:"));
    return bands.length ? bands : splits.slice(0, 4);
  }
  return splits;
}
