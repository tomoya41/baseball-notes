import { z } from "zod";
import type { PlayerGameBatting } from "./game-facts";
import type { SituatedFact } from "./player-home-away";
import { periodCoverageSchema, playerRecentResponseSchema } from "./player-recent";

const result = playerRecentResponseSchema.shape.batting;
export const playerBattingOrderSchema = z.object({
  player: playerRecentResponseSchema.shape.player,
  asOfDate: z.iso.date(), period: z.literal("30d"), from: z.iso.date(), to: z.iso.date(),
  coverage: periodCoverageSchema,
  totalFactCount: z.number().int().nonnegative(),
  unknownBattingOrderFactCount: z.number().int().nonnegative(),
  unknownBattingOrderPa: z.number().int().nonnegative().nullable(),
  classifiedTotal: result,
  orders: z.array(z.object({ battingOrder: z.number().int().min(1).max(9), lastGameDate: z.iso.date(),
    stats: result })),
});
export type PlayerBattingOrder = z.infer<typeof playerBattingOrderSchema>;

// Keep invalid or absent orders visible in diagnostics rather than assigning a slot.
export function partitionByBattingOrder(rows: readonly SituatedFact<PlayerGameBatting>[]) {
  const groups = new Map<number, { facts: PlayerGameBatting[]; lastGameDate: string }>();
  const unknown: PlayerGameBatting[] = [];
  for (const row of rows) {
    const order = row.fact.battingOrder;
    if (!Number.isInteger(order) || order === null || order < 1 || order > 9) {
      unknown.push(row.fact);
      continue;
    }
    const group = groups.get(order);
    if (group) {
      group.facts.push(row.fact);
      if (row.date > group.lastGameDate) group.lastGameDate = row.date;
    } else groups.set(order, { facts: [row.fact], lastGameDate: row.date });
  }
  return { groups, unknown };
}

export function battingOrderChoice(payload: PlayerBattingOrder) {
  const options = [...payload.orders].sort((a, b) => a.battingOrder - b.battingOrder);
  const latest = [...options].sort((a, b) => b.lastGameDate.localeCompare(a.lastGameDate) ||
    a.battingOrder - b.battingOrder)[0];
  return { options, defaultOrder: latest?.battingOrder ?? null };
}
