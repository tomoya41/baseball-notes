import { z } from "zod";
import { analysisCapabilitySchema, dateSchema } from "./analysis";
import { dataFreshnessSchema, leagueSchema, sourceSchema, timestampSchema } from "./models";

const id = z.string().min(1);
export const watchCapabilitiesSchema = z.strictObject({
  providerId: id,
  league: leagueSchema,
  schedule: analysisCapabilitySchema,
  lineup: analysisCapabilitySchema,
  bullpenUsage: analysisCapabilitySchema,
});
export type WatchCapabilities = z.infer<typeof watchCapabilitiesSchema>;

export const watchGameSchema = z.strictObject({
  id,
  league: leagueSchema,
  gameDate: dateSchema,
  startsAt: timestampSchema.nullable(),
  homeTeamId: id,
  awayTeamId: id,
  homeStarterId: id.nullable(),
  awayStarterId: id.nullable(),
});
export type WatchGame = z.infer<typeof watchGameSchema>;

const snapshot = {
  source: sourceSchema,
  freshness: dataFreshnessSchema,
  observedAt: timestampSchema,
};
const missing = z.strictObject({ status: z.enum(["unavailable", "error"]), reason: id });
export const watchScheduleResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("data"), ...snapshot, games: z.array(watchGameSchema).min(1) }),
  z.strictObject({ status: z.literal("empty"), ...snapshot, games: z.array(watchGameSchema).length(0) }),
  missing,
]);
export type WatchScheduleResult = z.infer<typeof watchScheduleResultSchema>;

export const watchLineupSchema = z.strictObject({
  gameId: id,
  teamId: id,
  confirmed: z.boolean(),
  players: z.array(z.strictObject({
    battingOrder: z.number().int().min(1).max(9),
    playerId: id,
  })).max(9).refine((rows) => new Set(rows.map((row) => row.battingOrder)).size === rows.length &&
    new Set(rows.map((row) => row.playerId)).size === rows.length, "Duplicate lineup slot or player"),
});
export type WatchLineup = z.infer<typeof watchLineupSchema>;
export const watchLineupResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("data"), ...snapshot, lineup: watchLineupSchema }),
  z.strictObject({ status: z.literal("empty"), ...snapshot, reason: id }),
  missing,
]);
export type WatchLineupResult = z.infer<typeof watchLineupResultSchema>;

export const bullpenUsageSchema = z.strictObject({
  gameId: id,
  teamId: id,
  completeThrough: dateSchema,
  pitchers: z.array(z.strictObject({
    playerId: id,
    lastAppearanceDate: dateSchema.nullable(),
    previousDayPitches: z.number().int().nonnegative().nullable(),
    lastThreeDaysAppearances: z.number().int().nonnegative().nullable(),
    consecutiveDays: z.number().int().nonnegative().nullable(),
    lastThreeDaysPitches: z.number().int().nonnegative().nullable(),
  })),
});
export type BullpenUsage = z.infer<typeof bullpenUsageSchema>;
export const watchBullpenResultSchema = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("data"), ...snapshot, usage: bullpenUsageSchema }),
  z.strictObject({ status: z.literal("empty"), ...snapshot, reason: id }),
  missing,
]);
export type WatchBullpenResult = z.infer<typeof watchBullpenResultSchema>;
