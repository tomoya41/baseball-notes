import { z } from "zod";
import { capabilitySchema, postseasonRoundSchema } from "./competition";

export const postseasonCapabilitiesSchema = z.object({ schemaVersion: z.literal(1),
  leagues: z.record(z.enum(["NPB", "MLB"]), z.object({
    historicalSeasons: z.array(z.number().int()), rounds: z.array(postseasonRoundSchema),
    historical: capabilitySchema, current: capabilitySchema,
    postseasonSchedule: capabilitySchema, postseasonGames: capabilitySchema, postseasonSeries: capabilitySchema,
    postseasonBracket: capabilitySchema, postseasonPlayerStats: capabilitySchema, postseasonAnalysis: capabilitySchema,
  })),
  regularSeasonUnchanged: z.literal(true), productionPush: z.literal("not_verified"),
});
const unavailable = { status: "unavailable" as const, reason: "Source rights pending" };
const available = { status: "available" as const, reason: null };
export const postseasonCapabilities = postseasonCapabilitiesSchema.parse({ schemaVersion: 1,
  leagues: {
    NPB: { historicalSeasons: [], rounds: ["npb_cs_first", "npb_cs_final", "japan_series"], historical: unavailable, current: unavailable,
      postseasonSchedule: unavailable, postseasonGames: unavailable, postseasonSeries: unavailable, postseasonBracket: unavailable,
      postseasonPlayerStats: unavailable, postseasonAnalysis: unavailable },
    MLB: { historicalSeasons: [2020,2021,2022,2023,2024,2025], rounds: ["wild_card", "division_series", "alcs", "nlcs", "world_series"],
      historical: available, current: unavailable, postseasonSchedule: available, postseasonGames: available, postseasonSeries: available,
      postseasonBracket: available, postseasonPlayerStats: available, postseasonAnalysis: available },
  }, regularSeasonUnchanged: true, productionPush: "not_verified" });

/** Event contract only. No push is enabled and no imaginary advantage Game exists. */
export type PostseasonNotificationTarget = { league: "NPB" | "MLB"; season: number; competitionType: "postseason";
  eventType: "player_appearance" | "team_game" | "series_clinched"; canonicalPlayerId: string | null;
  canonicalTeamId: string | null; canonicalGameId: string | null; canonicalSeriesId: string | null; effectiveDate: string };
