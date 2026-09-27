import { z } from "zod";
import { leagueSchema } from "./models";

const featureSchema = z.enum(["available", "partial", "unavailable"]);
export const leagueAvailabilitySchema = z.object({
  schemaVersion: z.literal(1),
  league: leagueSchema,
  season: z.number().int().min(1800).max(2200),
  assessedAt: z.iso.date(),
  effectiveDate: z.iso.date().nullable(),
  readiness: z.enum(["ready", "not_ready"]),
  reason: z.enum(["source_permission_required", "coverage_incomplete", "ready"]),
  sourcePermission: z.enum(["approved", "restricted", "unverified"]),
  coverage: z.enum(["complete", "partial", "unknown"]),
  features: z.object({
    directory: featureSchema, schedule: featureSchema, gameDetail: featureSchema,
    recent: featureSchema, analysis: featureSchema, season: featureSchema,
    countingRanking: featureSchema, rateRanking: featureSchema, records: featureSchema,
  }).strict(),
}).strict().superRefine((value, ctx) => {
  if (value.sourcePermission !== "approved" && (value.readiness !== "not_ready" ||
      Object.values(value.features).some(state => state !== "unavailable"))) {
    ctx.addIssue({ code: "custom", message: "Unapproved source cannot expose production data" });
  }
  if (value.readiness === "ready" && (value.coverage !== "complete" || value.reason !== "ready" || !value.effectiveDate)) {
    ctx.addIssue({ code: "custom", message: "Ready requires verified coverage and effective date" });
  }
});
export type LeagueAvailability = z.infer<typeof leagueAvailabilitySchema>;

// An absence of licensed ingestion is unknown coverage, never evidence of no games.
export const mlbAvailability: LeagueAvailability = leagueAvailabilitySchema.parse({
  schemaVersion: 1, league: "MLB", season: 2026, assessedAt: "2026-09-27",
  effectiveDate: null, readiness: "not_ready", reason: "source_permission_required",
  sourcePermission: "restricted", coverage: "unknown",
  features: { directory: "unavailable", schedule: "unavailable", gameDetail: "unavailable",
    recent: "unavailable", analysis: "unavailable", season: "unavailable",
    countingRanking: "unavailable", rateRanking: "unavailable", records: "unavailable" },
});
