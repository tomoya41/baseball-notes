import { canonicalEntityRefSchema } from "./cross-league";
import type { League } from "./models";
import type { CompareMetrics } from "./player-compare";
import { seasonCheckpointSteps, seasonCheckpointLabels } from "./npb-season-milestones";

export type ComparisonRow = { id: string; name: string; season: number; date: string; coverage: string; metrics: CompareMetrics | null; notice?: string };
export const teamComparisonKeys = ["G", "W", "L", "T", "runsFor", "runsAgainst", "runDifference", "PA", "H", "HR", "AVG", "OPS", "outsRecorded", "SO", "ERA", "K9"];
export function selectedTeams(league: League, raw: string | null) {
  return [...new Set((raw ?? "").split(",").filter(id => canonicalEntityRefSchema.safeParse({ league, kind: "team", id }).success))].slice(0, 4);
}
export function selectedYears(raw: string | null, available: readonly number[]): number[] {
  if (raw === null) return [...available].sort((a, b) => a - b).slice(-6);
  const years = raw.split(",").map(Number);
  if (!years.length || years.length > 6 || years.some(y => !Number.isInteger(y) || !available.includes(y))) return [];
  return [...new Set(years)].sort((a, b) => a - b);
}
export function metricNumber(metrics: CompareMetrics | null | undefined, key: string): number | null {
  const m = metrics?.[key]; return m?.status === "unavailable" || !Number.isFinite(m?.value) ? null : m!.value;
}
export function previousYearDelta(rows: readonly ComparisonRow[], row: ComparisonRow, key: string): number | null {
  const previous = rows.find(r => r.season === row.season - 1), a = metricNumber(row.metrics, key), b = metricNumber(previous?.metrics, key);
  return a === null || b === null ? null : a - b;
}
export function comparisonValue(key: string, value: number | null): string {
  if (value === null) return "—";
  if (key === "outsRecorded") return `${Math.floor(value / 3)}.${value % 3}`;
  return value.toFixed(["AVG", "OBP", "SLG", "OPS"].includes(key) ? 3 : ["ERA", "K9"].includes(key) ? 2 : 0);
}
export function collectionSeasonCheckpoint(metrics: CompareMetrics | null, role: "batting" | "pitching"): string {
  return (role === "batting" ? ["H", "HR"] as const : ["SO", "SV"] as const).flatMap(k => {
    const count = metricNumber(metrics, k), step = seasonCheckpointSteps[k];
    return count === null || count <= 0 ? [] : [`${seasonCheckpointLabels[k]} ${count} / 節目 ${Math.floor(count / step) * step + step}`];
  }).join(" · ");
}
