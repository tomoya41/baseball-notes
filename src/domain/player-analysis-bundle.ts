import { z } from "zod";
import { playerPeriodComparisonSchema } from "./player-period-comparison";
import { playerHomeAwaySchema } from "./player-home-away";
import { playerOpponentSchema } from "./player-opponent";
import { playerBattingOrderSchema } from "./player-batting-order";
import { playerPitcherRoleSchema } from "./player-pitcher-role";

const section = <T extends z.ZodType>(schema: T) => z.discriminatedUnion("status", [
  z.object({ status: z.literal("ready"), payload: schema }),
  z.object({ status: z.literal("error") }),
]);
export const playerAnalysisBundleSchema = z.object({
  playerId: z.string().uuid(), asOfDate: z.iso.date(),
  comparison: section(playerPeriodComparisonSchema),
  homeAway: section(playerHomeAwaySchema),
  opponent: section(playerOpponentSchema),
  battingOrder: section(playerBattingOrderSchema),
  pitcherRole: section(playerPitcherRoleSchema),
});
export type PlayerAnalysisBundle = z.infer<typeof playerAnalysisBundleSchema>;
