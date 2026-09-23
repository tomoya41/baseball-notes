import type { Player, PlayerCatalog, Statistics } from "../domain/models";

export const sampleRankingMetrics = ["avg", "hr", "ops", "era"] as const;
export type SampleRankingMetric = (typeof sampleRankingMetrics)[number];

export interface SampleRankRow {
  rank: number;
  player: Player;
  statistics: Statistics;
  value: number;
}

// A visual proof using the synthetic catalog, never an official/qualified leaderboard.
export function sampleRanking(catalog: PlayerCatalog, metricId: SampleRankingMetric): SampleRankRow[] {
  if (catalog.source.kind !== "sample") return [];
  const regular = catalog.statistics.filter((stats) => stats.seasonType === "regular");
  const season = Math.max(...regular.map((stats) => stats.season));
  const rows = regular
    .filter((stats) => stats.season === season && stats.metrics[metricId]?.status === "available")
    .flatMap((statistics) => {
      const metric = statistics.metrics[metricId];
      const player = catalog.profiles.find((profile) => profile.player.id === statistics.playerId)?.player;
      return metric?.status === "available" && player
        ? [{ player, statistics, value: metric.value }]
        : [];
    })
    .sort((a, b) => metricId === "era" ? a.value - b.value : b.value - a.value);
  let rank = 0;
  return rows.map((row, index) => {
    if (index === 0 || row.value !== rows[index - 1]?.value) rank = index + 1;
    return { ...row, rank };
  });
}
