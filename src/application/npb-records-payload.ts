import { recordsSchema } from "../domain/npb-records";
import type { NpbSeasonPayload } from "./npb-season-payload";

// Shared projection of existing Season metrics; never re-aggregates or changes a Gate.
export function buildNpbRecords(season: NpbSeasonPayload) {
  const categories = ([['batting', 'HR'], ['batting', 'H'], ['batting', 'RBI'], ['batting', 'SB'],
    ['pitching', 'SO'], ['pitching', 'W'], ['pitching', 'SV'], ['pitching', 'HLD']] as const)
    .map(([role, metric]) => {
      const entries = season.readiness.status === "ready" ? season.players.filter(p => p[role]?.metrics[metric]?.status === "complete")
        .map(p => ({ playerId: p.playerId, displayName: p.displayName, value: p[role]!.metrics[metric]!.value! }))
        .sort((a, b) => b.value - a.value || a.playerId.localeCompare(b.playerId)) : [];
      return { role, metric, rows: entries.map(p => ({ ...p, rank: 1 + entries.filter(x => x.value > p.value).length })) };
    });
  return recordsSchema.parse({ schemaVersion: 1, league: "NPB", season: season.season, effectiveDate: season.effectiveDate,
    coverage: season.coverage.status, readiness: season.readiness.status, qualifierStatus: season.readiness.rateQualifier,
    reasons: season.readiness.reasons, categories });
}
