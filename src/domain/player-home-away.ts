import { z } from "zod";
import { classifyGameSide } from "./player-game-log";
import { periodCoverageSchema, playerRecentResponseSchema } from "./player-recent";

const roleSplit = <T extends z.ZodType>(result: T) => z.object({
  home: result, away: result, unknownFactCount: z.number().int().nonnegative(),
  totalFactCount: z.number().int().nonnegative(),
});

export const playerHomeAwaySchema = z.object({
  player: playerRecentResponseSchema.shape.player,
  asOfDate: z.iso.date(), period: z.literal("30d"), from: z.iso.date(), to: z.iso.date(),
  coverage: periodCoverageSchema, capability: z.enum(["available", "unavailable"]),
  batting: roleSplit(playerRecentResponseSchema.shape.batting),
  pitching: roleSplit(playerRecentResponseSchema.shape.pitching),
});
export type PlayerHomeAway = z.infer<typeof playerHomeAwaySchema>;

export type SituatedFact<T extends { teamId: string; opponentTeamId: string | null }> = {
  date: string; fact: T; homeTeamId: string | null; awayTeamId: string | null;
};

export function classifySituatedFact<T extends { teamId: string; opponentTeamId: string | null }>(row: SituatedFact<T>) {
  const side = classifyGameSide(row.fact.teamId, row.homeTeamId, row.awayTeamId);
  const opponentTeamId = side === "home" ? row.awayTeamId : side === "away" ? row.homeTeamId : null;
  if (!opponentTeamId || opponentTeamId === row.fact.teamId ||
    (row.fact.opponentTeamId && row.fact.opponentTeamId !== opponentTeamId))
    return { side: "unknown" as const, opponentTeamId: null };
  return { side, opponentTeamId };
}

export function partitionHomeAway<T extends { teamId: string; opponentTeamId: string | null }>(rows: readonly SituatedFact<T>[]) {
  const home: T[] = [], away: T[] = [], unknown: T[] = [];
  for (const row of rows) {
    const { side } = classifySituatedFact(row);
    (side === "home" ? home : side === "away" ? away : unknown).push(row.fact);
  }
  return { home, away, unknown };
}
