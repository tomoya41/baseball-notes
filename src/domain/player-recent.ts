import { z } from "zod";

const metric = z.object({ value: z.number().nullable(), status: z.enum(["complete", "partial", "unavailable"]),
  observedFacts: z.number().int().nonnegative(), factCount: z.number().int().nonnegative() });
const coverage = z.object({ from: z.iso.date(), to: z.iso.date(),
  status: z.enum(["complete", "partial", "unknown", "unavailable"]),
  finalGameDates: z.array(z.iso.date()), completeGameDates: z.array(z.iso.date()),
  noGameDates: z.array(z.iso.date()), partialDates: z.array(z.iso.date()), unknownDates: z.array(z.iso.date()) });
const periodStats = z.object({ from: z.iso.date(), to: z.iso.date(), playerId: z.string(),
  games: z.number().int().nonnegative(), factCount: z.number().int().nonnegative(),
  dataStatus: z.enum(["complete", "partial", "unavailable"]), coverage, calculatedAt: z.iso.datetime(),
  metrics: z.record(z.string(), metric) });

export const playerRecentResponseSchema = z.object({
  player: z.object({ id: z.string().uuid(), name: z.string().min(1), teamId: z.string().nullable(), teamName: z.string().nullable() }),
  asOfDate: z.iso.date(), period: z.enum(["7d", "14d", "30d", "currentMonth", "season"]),
  batting: periodStats.nullable(), pitching: periodStats.nullable(),
});
export type PlayerRecentResponse = z.infer<typeof playerRecentResponseSchema>;
export type RecentPeriod = PlayerRecentResponse["period"];
