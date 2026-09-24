import { z } from "zod";
import { timestampSchema } from "./models";

const id = z.string().min(1);
const nullableCount = z.number().int().nonnegative().nullable();
const provenance = z.object({
  sourceKey: id, sourceRecordId: id, collectedAt: timestampSchema,
});

// Null means the source does not supply a field. A real zero remains zero.
export const playerGameBattingSchema = provenance.extend({
  gameId: id, playerId: id, teamId: id, opponentTeamId: id.nullable(),
  battingOrder: z.number().int().min(1).max(9).nullable(),
  pa: nullableCount, ab: nullableCount, hits: nullableCount,
  doubles: nullableCount, triples: nullableCount, homeRuns: nullableCount,
  rbi: nullableCount, walks: nullableCount, strikeouts: nullableCount,
  hbp: nullableCount, stolenBases: nullableCount, caughtStealing: nullableCount,
  sacrificeHits: nullableCount.optional(), sacrificeFlies: nullableCount.optional(),
  runs: nullableCount.optional(), starter: z.boolean().nullable().optional(), sourceUrl: z.url().optional(),
}).superRefine((row, context) => {
  if (row.ab !== null && row.hits !== null && row.hits > row.ab)
    context.addIssue({ code: "custom", message: "Hits exceed at-bats" });
});
export type PlayerGameBatting = z.infer<typeof playerGameBattingSchema>;

export const playerGamePitchingSchema = provenance.extend({
  id, gameId: id, playerId: id, teamId: id, opponentTeamId: id.nullable(),
  role: z.enum(["starter", "reliever", "unknown"]),
  appearanceOrder: z.number().int().positive().nullable(),
  inningsPitchedOuts: nullableCount, battersFaced: nullableCount,
  hits: nullableCount, homeRuns: nullableCount, walks: nullableCount,
  hitBatters: nullableCount.optional(), walksAndHitBatters: nullableCount.optional(),
  strikeouts: nullableCount, runs: nullableCount, earnedRuns: nullableCount,
  pitches: nullableCount, catcherId: id.nullable(),
  starter: z.boolean().nullable().optional(), decision: z.enum(["win","loss","hold","save","none"]).nullable().optional(),
  sourceUrl: z.url().optional(),
});
export type PlayerGamePitching = z.infer<typeof playerGamePitchingSchema>;

export const gameCompletenessSchema = z.object({
  gameId: id,
  battingStatus: z.enum(["pending", "partial", "complete", "failed", "unverified"]),
  pitchingStatus: z.enum(["pending", "partial", "complete", "failed", "unverified"]),
  gameStatus: z.enum(["pending", "partial", "complete", "failed", "unverified"]),
  expectedBatters: z.number().int().nonnegative(),
  collectedBatters: z.number().int().nonnegative(),
  mappedBatters: z.number().int().nonnegative(),
  expectedPitchers: z.number().int().nonnegative(),
  collectedPitchers: z.number().int().nonnegative(),
  mappedPitchers: z.number().int().nonnegative(),
  checks: z.record(z.string(), z.boolean()),
  issues: z.array(z.string()),
  sourceKey: id,
  verifiedAt: timestampSchema,
});
export type GameCompleteness = z.infer<typeof gameCompletenessSchema>;

export const pitcherAppearanceSchema = provenance.extend({
  id, gameId: id, pitcherId: id,
  enteredGameInning: z.number().int().positive().nullable(),
  exitedGameInning: z.number().int().positive().nullable(),
  inningsPitchedOuts: nullableCount, pitches: nullableCount,
  battersFaced: nullableCount,
  role: z.enum(["starter", "reliever", "unknown"]),
  previousAppearanceDate: z.iso.date().nullable(),
});
export type PitcherAppearance = z.infer<typeof pitcherAppearanceSchema>;

export const plateAppearanceFactSchema = provenance.extend({
  id, gameId: id, batterId: id, pitcherId: id.nullable(),
  battingOrder: z.number().int().min(1).max(9).nullable(),
  gameInning: z.number().int().positive().nullable(),
  halfInning: z.enum(["top", "bottom"]).nullable(),
  outsBefore: z.number().int().min(0).max(2).nullable(),
  baseState: z.number().int().min(0).max(7).nullable(),
  scoreDifferentialBefore: z.number().int().nullable(),
  resultCode: z.string().nullable(), rbi: nullableCount,
});
export type PlateAppearanceFact = z.infer<typeof plateAppearanceFactSchema>;
