import { npbPlayerDirectorySchema, type NpbPlayerDirectory } from "../domain/npb-player-directory";
import { reviewedProfileSupplementSchema } from "../domain/npb-reviewed-profile";
import type { ReviewedMeasurements } from "./npb-product-payload";

// Public projection only. No Player creation, affiliation mutation or canonical Fact writes.
export function supplementNpbDirectory(directory: NpbPlayerDirectory, raw: unknown) {
  const supplement = reviewedProfileSupplementSchema.parse(raw), known = new Map(supplement.players.map(p => [p.playerId, p]));
  const conflicts: { playerId: string; field: string }[] = [];
  const players = directory.players.map(player => {
    const profile = known.get(player.playerId); if (!profile) return player;
    const result = { ...player };
    for (const key of ["position", "birthDate", "birthPlace", "nationality"] as const) {
      const incoming = profile[key];
      if (player[key] !== null && incoming !== null && player[key] !== incoming) {
        conflicts.push({ playerId: player.playerId, field: key }); continue;
      }
      // Never present a future DOB as an observed historical profile.
      if (key === "birthDate" && incoming !== null && incoming > directory.effectiveDate) continue;
      if (result[key] === null) Object.assign(result, { [key]: incoming });
    }
    // Role availability still comes exclusively from stored Facts, not profile position.
    return result;
  });
  return { directory: npbPlayerDirectorySchema.parse({ ...directory, players }), conflicts };
}
export function supplementNpbMeasurements(existing: ReviewedMeasurements, raw: unknown): ReviewedMeasurements {
  const supplement = reviewedProfileSupplementSchema.parse(raw);
  const known = new Map(existing.players.map(p => [p.playerId, p]));
  // Mixed snapshots retain per-snapshot observation dates in the catalog projector below.
  return { observedAt: supplement.observedAt, effectiveDate: null, players: supplement.players.filter(p => !known.has(p.playerId)) };
}
