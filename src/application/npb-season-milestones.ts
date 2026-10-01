import { npbSeasonMilestonesSchema, seasonCheckpointSteps, type NpbSeasonMilestones } from "../domain/npb-season-milestones";
import type { NpbCapabilities, NpbCatalog } from "../domain/npb-product-contract";
import type { NpbSeasonPayload } from "./npb-season-payload";
export interface NpbSeasonMilestonesReader {
  capabilities(): Promise<NpbCapabilities>;
  seasonMilestones(season: number, expected: Pick<NpbCapabilities, "effectiveDate" | "generatedAt">): Promise<NpbSeasonMilestones>;
}

// Reuses already-calculated Season counting metrics: zero additional SELECTs or formulas.
export function buildNpbSeasonMilestones(season: NpbSeasonPayload, catalog?: NpbCatalog) {
  const teams = new Map(catalog?.teams.map(t => [t.teamId, t.shortName]) ?? []);
  const players = season.players.map(p => {
    const checkpoints = (Object.keys(seasonCheckpointSteps) as (keyof typeof seasonCheckpointSteps)[]).flatMap(metric => {
      const role = ["H", "HR", "RBI", "SB"].includes(metric) ? "batting" as const : "pitching" as const;
      const m = p[role]?.metrics[metric];
      // Never manufacture zero for an unknown field, or turn a partial metric into a precise count.
      if (!m || m.status !== "complete" || m.value === null || m.observedFacts !== m.factCount) return [];
      if (!Number.isSafeInteger(m.value) || m.value < 0) throw Error("Season counting metric must be a nonnegative integer");
      const step = seasonCheckpointSteps[metric], previousCheckpoint = Math.floor(m.value / step) * step;
      return [{ role, metric, count: m.value, previousCheckpoint, nextCheckpoint: previousCheckpoint + step }];
    });
    return { playerId: p.playerId, displayName: p.displayName, teamId: p.teamId,
      teamName: p.teamId ? teams.get(p.teamId) ?? null : null, checkpoints };
  }).filter(p => p.checkpoints.length).sort((a, b) => a.displayName.localeCompare(b.displayName, "ja") || a.playerId.localeCompare(b.playerId));
  return npbSeasonMilestonesSchema.parse({ schemaVersion: 1, league: "NPB", season: season.season,
    effectiveDate: season.effectiveDate, generatedAt: catalog?.generatedAt ?? season.generatedAt, period: season.period,
    scope: "stored_regular_season_facts", careerAvailable: false, coverage: season.coverage, players });
}
