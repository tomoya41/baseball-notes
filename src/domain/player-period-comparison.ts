import { z } from "zod";
import { periodCoverageSchema, playerRecentResponseSchema } from "./player-recent";

const periodResult = z.object({ coverage: periodCoverageSchema, batting: playerRecentResponseSchema.shape.batting,
  pitching: playerRecentResponseSchema.shape.pitching });

export const playerPeriodComparisonSchema = z.object({
  player: playerRecentResponseSchema.shape.player,
  asOfDate: z.iso.date(),
  periods: z.object({ "7d": periodResult, "14d": periodResult, "30d": periodResult }),
});
export type PlayerPeriodComparison = z.infer<typeof playerPeriodComparisonSchema>;
export type ComparisonPeriod = keyof PlayerPeriodComparison["periods"];
export const comparisonPeriods = ["7d", "14d", "30d"] as const satisfies readonly ComparisonPeriod[];
