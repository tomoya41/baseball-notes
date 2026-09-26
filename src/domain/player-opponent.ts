import { z } from "zod";
import { classifySituatedFact, type SituatedFact } from "./player-home-away";
import { periodCoverageSchema, playerRecentResponseSchema } from "./player-recent";

const result = playerRecentResponseSchema.shape.batting;
const role = z.object({ totalFactCount: z.number().int().nonnegative(),
  unknownOpponentFactCount: z.number().int().nonnegative(), classifiedTotal: result });

export const playerOpponentSchema = z.object({
  player: playerRecentResponseSchema.shape.player,
  asOfDate: z.iso.date(), period: z.literal("30d"), from: z.iso.date(), to: z.iso.date(),
  coverage: periodCoverageSchema, batting: role, pitching: role,
  opponents: z.array(z.object({ teamId: z.string().min(1), lastGameDate: z.iso.date(),
    batting: result, pitching: result })),
});
export type PlayerOpponent = z.infer<typeof playerOpponentSchema>;

export function partitionByOpponent<T extends { teamId: string; opponentTeamId: string | null }>(
  rows: readonly SituatedFact<T>[]) {
  const groups = new Map<string, { facts: T[]; lastGameDate: string }>();
  const unknown: T[] = [];
  for (const row of rows) {
    const { opponentTeamId } = classifySituatedFact(row);
    if (!opponentTeamId) { unknown.push(row.fact); continue; }
    const group = groups.get(opponentTeamId);
    if (group) {
      group.facts.push(row.fact);
      if (row.date > group.lastGameDate) group.lastGameDate = row.date;
    } else groups.set(opponentTeamId, { facts: [row.fact], lastGameDate: row.date });
  }
  return { groups, unknown };
}

export function opponentChoice(payload: PlayerOpponent, teamOrder: readonly string[]) {
  const order = new Map(teamOrder.map((id, index) => [id, index]));
  const compare = (a: PlayerOpponent["opponents"][number], b: PlayerOpponent["opponents"][number]) =>
    (order.get(a.teamId) ?? Number.MAX_SAFE_INTEGER) - (order.get(b.teamId) ?? Number.MAX_SAFE_INTEGER) ||
    a.teamId.localeCompare(b.teamId);
  const options = [...payload.opponents].sort(compare);
  const latest = [...options].sort((a, b) => b.lastGameDate.localeCompare(a.lastGameDate) || compare(a, b))[0];
  return { options, defaultTeamId: latest?.teamId ?? null };
}
