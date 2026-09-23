import { z } from "zod";

export const leagueSchema = z.enum(["NPB", "MLB"]);
export type League = z.infer<typeof leagueSchema>;
const id = z.string().min(1);
export const timestampSchema = z.iso.datetime();
export const sourceSchema = z.object({
  providerId: id,
  label: id,
  kind: z.enum(["sample", "licensed"]),
  license: id,
  revision: id,
  updatedAt: timestampSchema,
});
export type SourceMetadata = z.infer<typeof sourceSchema>;
export const teamSchema = z.object({ id, league: leagueSchema, name: id });
export type Team = z.infer<typeof teamSchema>;
export const playerSchema = z.object({
  id,
  league: leagueSchema,
  name: id,
  searchNames: z.array(z.string()),
  teamId: id.nullable(),
  position: z.string().nullable(),
  sourceIds: z.record(z.string(), z.string()),
});
export type Player = z.infer<typeof playerSchema>;
export const playerProfileSchema = z.object({
  player: playerSchema,
  bats: z.enum(["右", "左", "両"]).nullable(),
  throws: z.enum(["右", "左"]).nullable(),
  jersey: z.string().nullable(),
});
export type PlayerProfile = z.infer<typeof playerProfileSchema>;

// Each metric is independently available; a missing value is never zero.
export const metricValueSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("available"), value: z.number().finite() }),
  z.object({ status: z.enum(["missing", "unsupported"]), reason: id }),
]);
export type MetricValue = z.infer<typeof metricValueSchema>;
export const statisticsSchema = z.object({
  playerId: id,
  league: leagueSchema,
  season: z.number().int().min(1800).max(2200),
  seasonType: z.enum(["regular", "postseason", "preseason"]),
  group: z.enum(["hitting", "pitching"]),
  completeness: z.enum(["complete", "partial"]),
  metrics: z.record(z.string(), metricValueSchema),
  source: sourceSchema,
});
export type Statistics = z.infer<typeof statisticsSchema>;
export type SeasonStats = Statistics;
export type HitterStats = Statistics & { group: "hitting" };
export type PitcherStats = Statistics & { group: "pitching" };

// Date-only baseball business dates, end inclusive; resolved by future window logic.
export interface TimeWindow {
  kind: "7d" | "14d" | "30d" | "month" | "season";
  startDate: string;
  endDate: string;
  timeZone: string;
}
export interface RecentForm {
  playerId: string;
  window: TimeWindow;
  stats: Statistics;
  baseline: Statistics | null;
  sampleSize: { unit: "PA" | "outs"; value: number };
}
export interface MetricDefinition {
  id: string;
  name: string;
  fullName: string;
  description: string;
  interpretation: string;
  caveat: string;
  advanced: boolean;
  format: "rate" | "decimal" | "count" | "percent" | "outs";
}
export const favoriteSchema = z.object({
  kind: z.enum(["player", "team"]),
  entityId: id,
  league: leagueSchema,
  addedAt: timestampSchema,
});
export type Favorite = z.infer<typeof favoriteSchema>;
export const catalogSchema = z
  .object({
    league: leagueSchema,
    source: sourceSchema,
    teams: z.array(teamSchema),
    profiles: z.array(playerProfileSchema),
    statistics: z.array(statisticsSchema),
  })
  .superRefine((catalog, ctx) => {
    const teams = new Set(catalog.teams.map((t) => t.id));
    const players = new Set(catalog.profiles.map((p) => p.player.id));
    if (
      teams.size !== catalog.teams.length ||
      players.size !== catalog.profiles.length
    )
      ctx.addIssue({ code: "custom", message: "Duplicate identity" });
    for (const team of catalog.teams)
      if (team.league !== catalog.league)
        ctx.addIssue({ code: "custom", message: "Team league mismatch" });
    for (const { player } of catalog.profiles)
      if (
        player.league !== catalog.league ||
        (player.teamId !== null && !teams.has(player.teamId))
      )
        ctx.addIssue({ code: "custom", message: "Invalid player relation" });
    for (const stat of catalog.statistics)
      if (stat.league !== catalog.league || !players.has(stat.playerId))
        ctx.addIssue({
          code: "custom",
          message: "Invalid statistics relation",
        });
  });
export type PlayerCatalog = z.infer<typeof catalogSchema>;
export const dataFreshnessSchema = z.object({
  fetchedAt: timestampSchema,
  expiresAt: timestampSchema,
  state: z.enum(["fresh", "stale"]),
  origin: z.enum(["provider", "cache"]),
});
export type DataFreshness = z.infer<typeof dataFreshnessSchema>;
export interface CatalogResult {
  data: PlayerCatalog;
  freshness: DataFreshness;
  warnings: string[];
}
