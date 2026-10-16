import { sumHistoricalRows, type NpbHistoricalRow } from "./npb-historical";

export const progressionMetrics = ["AVG", "OPS", "HR", "H", "RBI", "PA", "G", "ERA", "SO", "outsRecorded", "WHIP", "K9", "BB9"] as const;
export type ProgressionMetric = typeof progressionMetrics[number];
export type SeasonObservation = { season: number; teams: string[]; metrics: Record<string, number | null>; sample: number | null };

/** Summarize observations, never impute missing seasons or merge other competitions. */
export function historicalProgression(rows: readonly NpbHistoricalRow[], years: readonly number[]): SeasonObservation[] {
  if (!rows.length) return [];
  if (rows.some(r => r.playerId !== rows[0]!.playerId || r.role !== rows[0]!.role)) throw Error("One player and role required");
  const keys = rows.map(r => `${r.season}:${r.teamId}`);
  if (new Set(keys).size !== keys.length) throw Error("Duplicate club-year row");
  return [...new Set(years)].sort((a, b) => a - b).map(season => {
    const records = rows.filter(r => r.season === season);
    if (!records.length) return { season, teams: [], metrics: {}, sample: null };
    const metrics = sumHistoricalRows(records).metrics;
    const outs = metrics.outsRecorded;
    if (rows[0]!.role === "pitching") {
      metrics.K9 = outs != null && outs > 0 && metrics.SO != null ? metrics.SO * 27 / outs : null;
      metrics.BB9 = outs != null && outs > 0 && metrics.BB != null ? metrics.BB * 27 / outs : null;
    }
    return { season, teams: [...new Set(records.map(r => r.teamId))], metrics, sample: metrics[rows[0]!.role === "batting" ? "PA" : "outsRecorded"] ?? null };
  });
}

export function bestObservedSeasons(points: readonly SeasonObservation[], metric: ProgressionMetric) {
  const rate = ["AVG", "OPS", "ERA", "WHIP", "K9", "BB9"].includes(metric);
  const minimum = ["AVG", "OPS"].includes(metric) ? 100 : 90;
  const candidates = points.filter(p => p.metrics[metric] != null && (!rate || p.sample != null && p.sample >= minimum));
  if (!candidates.length) return [];
  const lower = ["ERA", "WHIP", "BB9"].includes(metric);
  const value = (lower ? Math.min : Math.max)(...candidates.map(p => p.metrics[metric]!));
  return candidates.filter(p => p.metrics[metric] === value).sort((a, b) => a.season - b.season);
}
