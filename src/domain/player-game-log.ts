import { z } from "zod";

const count = z.number().int().nonnegative().nullable();
const game = z.strictObject({
  gameId: z.string().min(1), date: z.iso.date(), gameNumber: z.number().int().positive(),
  status: z.enum(["scheduled", "final", "postponed", "canceled", "suspended", "unknown"]),
  teamId: z.string().min(1), opponentTeamId: z.string().min(1),
  side: z.enum(["home", "away"]), homeTeamId: z.string().min(1), awayTeamId: z.string().min(1),
  homeScore: count, awayScore: count, result: z.enum(["win", "loss", "tie"]).nullable(),
});

const batting = game.extend({
  battingOrder: z.number().int().min(1).max(9).nullable(), starter: z.boolean().nullable(),
  pa: count, ab: count, runs: count, hits: count, doubles: count, triples: count,
  homeRuns: count, rbi: count, walks: count, hbp: count, sacrificeHits: count,
  sacrificeFlies: count, strikeouts: count, stolenBases: count, caughtStealing: count,
});
const pitching = game.extend({
  role: z.enum(["starter", "reliever", "unknown"]), starter: z.boolean().nullable(),
  appearanceOrder: z.number().int().positive().nullable(), outsRecorded: count,
  battersFaced: count, hits: count, homeRuns: count, strikeouts: count, runs: count,
  earnedRuns: count, pitchCount: count, walksAndHitByPitch: count,
  decision: z.enum(["win", "loss", "hold", "save", "none"]).nullable(),
});

export const playerGameLogResponseSchema = z.strictObject({
  playerId: z.string().uuid(), limit: z.number().int().min(1).max(50), offset: z.number().int().nonnegative(),
  batting: z.array(batting), pitching: z.array(pitching),
});
export type PlayerGameLogResponse = z.infer<typeof playerGameLogResponseSchema>;
export type PlayerBattingLog = PlayerGameLogResponse["batting"][number];
export type PlayerPitchingLog = PlayerGameLogResponse["pitching"][number];

export function gameContext(row: { gameId: string; date: string; gameNumber: number; status: string;
  homeTeamId: string; awayTeamId: string; homeScore: number | null; awayScore: number | null },
  teamId: string, factOpponentId: string | null) {
  const side = teamId === row.homeTeamId ? "home" : teamId === row.awayTeamId ? "away" : null;
  if (!side) throw new Error(`Player team is not in game ${row.gameId}`);
  const opponentTeamId = side === "home" ? row.awayTeamId : row.homeTeamId;
  if (factOpponentId && factOpponentId !== opponentTeamId)
    throw new Error(`Fact opponent conflicts with game ${row.gameId}`);
  const own = side === "home" ? row.homeScore : row.awayScore;
  const opponent = side === "home" ? row.awayScore : row.homeScore;
  const result = row.status !== "final" || own === null || opponent === null ? null :
    own > opponent ? "win" : own < opponent ? "loss" : "tie";
  return { ...row, teamId, opponentTeamId, side, result } as const;
}

export function formatOuts(outs: number | null): string {
  return outs === null ? "—" : `${Math.floor(outs / 3)}.${outs % 3}`;
}
