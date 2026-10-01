import { z } from "zod";
import { capabilitySchema, postseasonRoundSchema, postseasonHubSchema, type PostseasonHub } from "./competition";

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
const pending = { status: "not_ready" as const, reason: "Historical Postseason release not published" };
export const postseasonCapabilities = postseasonCapabilitiesSchema.parse({ schemaVersion: 1,
  leagues: {
    NPB: { historicalSeasons: [], rounds: ["npb_cs_first", "npb_cs_final", "japan_series"], historical: unavailable, current: unavailable,
      postseasonSchedule: unavailable, postseasonGames: unavailable, postseasonSeries: unavailable, postseasonBracket: unavailable,
      postseasonPlayerStats: unavailable, postseasonAnalysis: unavailable },
    MLB: { historicalSeasons: [], rounds: ["wild_card", "division_series", "alcs", "nlcs", "world_series"],
      historical: pending, current: unavailable, postseasonSchedule: pending, postseasonGames: pending, postseasonSeries: pending,
      postseasonBracket: pending, postseasonPlayerStats: pending, postseasonAnalysis: pending },
  }, regularSeasonUnchanged: true, productionPush: "not_verified" });

/** Activate only after the complete staged payload tree is validated by the publication audit. */
export function capabilitiesForVerifiedPostseason(hubs: readonly PostseasonHub[]) {
  if (!hubs.length) return postseasonCapabilities;
  const verified = hubs.map(h => postseasonHubSchema.parse(h));
  const years = verified.map(h => h.season).sort();
  if (years.join(",") !== "2020,2021,2022,2023,2024,2025" || verified.some(h => h.coverage !== "complete" || h.playerStats.status !== "available"))
    throw new Error("Incomplete staged Postseason release");
  const available = { status: "available" as const, reason: null };
  return postseasonCapabilitiesSchema.parse({ ...postseasonCapabilities, leagues: { ...postseasonCapabilities.leagues,
    MLB: { ...postseasonCapabilities.leagues.MLB, historicalSeasons: years, historical: available,
      postseasonSchedule: available, postseasonGames: available, postseasonSeries: available, postseasonBracket: available,
      postseasonPlayerStats: available, postseasonAnalysis: verified.every(h => h.analysis.status === "available") ? available :
        { status: "not_ready", reason: "Scoped PA validation pending" } } } });
}

/** Event contract only. No push is enabled and no imaginary advantage Game exists. */
export type PostseasonNotificationTarget = { league: "NPB" | "MLB"; season: number; competitionType: "postseason";
  eventType: "player_appearance" | "team_game" | "series_clinched"; canonicalPlayerId: string | null;
  canonicalTeamId: string | null; canonicalGameId: string | null; canonicalSeriesId: string | null; effectiveDate: string };
