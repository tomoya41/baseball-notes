import { z } from "zod";
import type { PlayerGameBatting } from "./game-facts";
import type { SituatedFact } from "./player-home-away";
import { periodCoverageSchema, playerRecentResponseSchema } from "./player-recent";

const result = playerRecentResponseSchema.shape.batting;
export const playerBatterRoleSchema = z.object({
  player: playerRecentResponseSchema.shape.player,
  asOfDate: z.iso.date(), period: z.literal("30d"), from: z.iso.date(), to: z.iso.date(),
  coverage: periodCoverageSchema, totalFactCount: z.number().int().nonnegative(),
  unknownRoleFactCount: z.number().int().nonnegative(),
  classifiedTotal: result, starter: result, substitute: result,
});
export type PlayerBatterRole = z.infer<typeof playerBatterRoleSchema>;

export function partitionBatterRoles(rows: readonly SituatedFact<PlayerGameBatting>[]) {
  const starter: PlayerGameBatting[] = [], substitute: PlayerGameBatting[] = [], unknown: PlayerGameBatting[] = [];
  for (const { fact } of rows)
    (fact.starter === true ? starter : fact.starter === false ? substitute : unknown).push(fact);
  return { starter, substitute, unknown };
}
