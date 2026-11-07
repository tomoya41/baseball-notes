import type { NpbHistoricalDataset, NpbHistoricalManifest } from "../domain/npb-historical";
import { historicalProgression } from "../domain/npb-player-progression";
import type { CompareMetrics } from "../domain/player-compare";
import { readNpbHistoricalSeason } from "./npb-historical-reader";
import { readPublishedPlayerStats } from "./npb-published-player";
import { boundedComparisonRead } from "./product-comparison";

export type NpbComparisonRole = "batting" | "pitching";
type DirectoryReader = Parameters<typeof readPublishedPlayerStats>[2];
type Source =
  | { kind: "saved"; from: string; to: string; effectiveDate: string; coverage: string }
  | { kind: "archive"; observedAt: string; teams: string[]; credits: Pick<NpbHistoricalDataset, "players"> };
export type NpbSeasonComparisonRow = { year: number; state: "ready"; source: Source; metrics: CompareMetrics } |
  { year: number; state: "unrecorded" | "unavailable" };

export async function readNpbPlayerSeasonComparison(playerId: string, role: NpbComparisonRole,
  years: readonly number[], manifest: NpbHistoricalManifest | null, directory: DirectoryReader): Promise<NpbSeasonComparisonRow[]> {
  const observations = await boundedComparisonRead(years.map(String), async key => {
    const year = Number(key);
    if (year === 2026) {
      const saved = await readPublishedPlayerStats(playerId, "season", directory);
      const stats = saved?.player[role];
      if (!saved || !stats) return { year, state: "unrecorded" } as const;
      return { year, state: "ready", source: { kind: "saved", ...saved.period, effectiveDate: saved.effectiveDate, coverage: saved.coverage.status },
        metrics: stats.metrics } as const;
    }
    if (!manifest) return { year, state: "unavailable" } as const;
    if (!manifest.players.some(player => player.playerId === playerId && player.seasons.includes(year))) return { year, state: "unrecorded" } as const;
    const archive = await readNpbHistoricalSeason(year, manifest);
    const rows = archive.rows.filter(row => row.playerId === playerId && row.role === role);
    const observation = historicalProgression(rows, [year])[0];
    if (!observation) return { year, state: "unrecorded" } as const;
    const metrics: CompareMetrics = Object.fromEntries(Object.entries(observation.metrics).map(([key, value]) =>
      [key, { value, status: value === null ? "unavailable" : "partial" }]));
    return { year, state: "ready", source: { kind: "archive", observedAt: archive.observedAt, teams: observation.teams,
      credits: { players: archive.players.filter(player => player.playerId === playerId) } }, metrics } as const;
  });
  return observations.map((item, index) => item.status === "fulfilled" ? item.value : { year: years[index]!, state: "unavailable" });
}
