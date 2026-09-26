import { z } from "zod";
import type { PlayerGamePitching } from "./game-facts";
import type { SituatedFact } from "./player-home-away";
import { periodCoverageSchema, playerRecentResponseSchema } from "./player-recent";

const result = playerRecentResponseSchema.shape.pitching;
export const playerPitcherRoleSchema = z.object({
  player: playerRecentResponseSchema.shape.player,
  asOfDate: z.iso.date(), period: z.literal("30d"), from: z.iso.date(), to: z.iso.date(),
  coverage: periodCoverageSchema,
  totalFactCount: z.number().int().nonnegative(),
  unknownRoleAppearances: z.number().int().nonnegative(),
  unknownRoleOuts: z.number().int().nonnegative().nullable(),
  unknownRoleBf: z.number().int().nonnegative().nullable(),
  classifiedTotal: result,
  starter: result,
  reliever: result,
});
export type PlayerPitcherRole = z.infer<typeof playerPitcherRoleSchema>;

// The stored role drives Game Log too. Contradictory explicit starter flags are
// left unclassified rather than silently assigned to either split.
export function classifyPitcherRole(fact: Pick<PlayerGamePitching, "role" | "starter">):
  "starter" | "reliever" | "unknown" {
  if (fact.role !== "starter" && fact.role !== "reliever") return "unknown";
  if (fact.starter != null && fact.starter !== (fact.role === "starter")) return "unknown";
  return fact.role;
}

export function partitionPitcherRoles(rows: readonly SituatedFact<PlayerGamePitching>[]) {
  const starter: PlayerGamePitching[] = [], reliever: PlayerGamePitching[] = [], unknown: PlayerGamePitching[] = [];
  for (const row of rows) {
    const role = classifyPitcherRole(row.fact);
    (role === "starter" ? starter : role === "reliever" ? reliever : unknown).push(row.fact);
  }
  return { starter, reliever, unknown };
}
