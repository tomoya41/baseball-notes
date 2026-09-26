import { z } from "zod";
import type { PlayerGameBatting, PlayerGamePitching } from "./game-facts";
import { classifyPitcherRole } from "./player-pitcher-role";

const count = z.number().int().nonnegative().nullable();
const team = z.object({ id: z.string(), name: z.string(), shortName: z.string(), score: count,
  totals: z.object({ pa: count, paSource: z.enum(["battingFacts", "opponentBf", "unavailable"]),
    ab: count, runs: count, hits: count, homeRuns: count }) });
const batting = z.object({ playerId: z.string(), name: z.string(), teamId: z.string(),
  battingOrder: z.number().int().min(1).max(9).nullable(), starter: z.boolean().nullable(),
  pa: count, ab: count, runs: count, hits: count, doubles: count, triples: count, homeRuns: count,
  rbi: count, walks: count, hbp: count, sacrificeHits: count, sacrificeFlies: count,
  strikeouts: count, stolenBases: count, caughtStealing: count });
const pitching = z.object({ playerId: z.string(), name: z.string(), teamId: z.string(),
  role: z.enum(["starter", "reliever", "unknown"]), appearanceOrder: count,
  outsRecorded: count, bf: count, hits: count, homeRuns: count, strikeouts: count,
  runs: count, earnedRuns: count, pitchCount: count, walksAndHitByPitch: count,
  decision: z.enum(["win", "loss", "hold", "save", "none"]).nullable() });
export const npbGameDetailSchema = z.object({ gameId: z.string(), date: z.iso.date(),
  gameNumber: z.number().int().positive(), status: z.enum(["scheduled", "final", "postponed", "canceled", "suspended", "unknown"]),
  completeness: z.enum(["complete", "partial", "failed", "pending", "unverified"]).nullable(),
  home: team, away: team, batting: z.object({ home: z.array(batting), away: z.array(batting) }),
  pitching: z.object({ home: z.array(pitching), away: z.array(pitching) }) });
export type NpbGameDetail = z.infer<typeof npbGameDetailSchema>;

export function sumKnown(rows: readonly (number | null | undefined)[]): number | null {
  return rows.length && rows.every((value) => value !== null && value !== undefined) ?
    rows.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
}

export function battingLine(fact: PlayerGameBatting, name: string) {
  return { playerId: fact.playerId, name, teamId: fact.teamId, battingOrder: fact.battingOrder,
    starter: fact.starter ?? null, pa: fact.pa, ab: fact.ab, runs: fact.runs ?? null,
    hits: fact.hits, doubles: fact.doubles, triples: fact.triples, homeRuns: fact.homeRuns,
    rbi: fact.rbi, walks: fact.walks, hbp: fact.hbp, sacrificeHits: fact.sacrificeHits ?? null,
    sacrificeFlies: fact.sacrificeFlies ?? null, strikeouts: fact.strikeouts,
    stolenBases: fact.stolenBases, caughtStealing: fact.caughtStealing };
}

export function pitchingLine(fact: PlayerGamePitching, name: string) {
  return { playerId: fact.playerId, name, teamId: fact.teamId, role: classifyPitcherRole(fact),
    appearanceOrder: fact.appearanceOrder, outsRecorded: fact.inningsPitchedOuts,
    bf: fact.battersFaced, hits: fact.hits, homeRuns: fact.homeRuns, strikeouts: fact.strikeouts,
    runs: fact.runs, earnedRuns: fact.earnedRuns, pitchCount: fact.pitches,
    walksAndHitByPitch: fact.walksAndHitBatters ?? null, decision: fact.decision ?? null };
}
