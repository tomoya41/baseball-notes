import { z } from "zod";
import { positionCodeSchema } from "./baseball-terms";
import { profileAffiliationSchema, amateurHistorySchema } from "./npb-profile-registry";

export const dataAvailabilitySchema = z.enum(["available", "partially_available", "source_available_not_implemented",
  "blocked_by_rights", "source_unavailable", "production_gate_pending"]);
const visualSchema = z.strictObject({ usage: z.enum(["allowed", "unavailable"]), url: z.url().nullable(),
  attribution: z.string().nullable(), licenseUrl: z.url().nullable() }).superRefine((v, ctx) => {
  if ((v.usage === "unavailable" && (v.url !== null || v.attribution !== null || v.licenseUrl !== null)) ||
    (v.usage === "allowed" && (!v.url || !v.attribution || !v.licenseUrl)))
    ctx.addIssue({ code: "custom", message: "Visual permission/credit contract mismatch" });
});
export const unavailableVisual = { usage: "unavailable", url: null, attribution: null, licenseUrl: null } as const;
export function ageOnDate(birthDate: string | null, asOfDate: string): number | null {
  z.iso.date().parse(asOfDate);
  if (birthDate === null) return null;
  z.iso.date().parse(birthDate);
  if (birthDate > asOfDate) return null;
  return Number(asOfDate.slice(0, 4)) - Number(birthDate.slice(0, 4)) - Number(asOfDate.slice(5) < birthDate.slice(5));
}
export const npbCatalogSchema = z.strictObject({ schemaVersion: z.literal(1), league: z.literal("NPB"),
  effectiveDate: z.iso.date(), generatedAt: z.iso.datetime(),
  teams: z.array(z.strictObject({ teamId: z.string().min(1), name: z.string().min(1), shortName: z.string().min(1),
    abbreviation: z.string().min(1), division: z.enum(["Central", "Pacific"]),
    homeLocation: z.string().nullable(), homeStadium: z.string().nullable(),
    visual: z.strictObject({ logo: visualSchema, primaryColor: z.string().regex(/^#[\da-fA-F]{6}$/).nullable(),
      colorRole: z.enum(["official", "neutral"]), fallback: z.literal("abbreviation") }) })),
  players: z.array(z.strictObject({ playerId: z.uuid(), displayName: z.string().min(1),
    profile: z.strictObject({ position: positionCodeSchema.nullable(), bats: z.enum(["right", "left", "switch"]).nullable(),
      throws: z.enum(["right", "left"]).nullable(), birthDate: z.iso.date().nullable(), birthPlace: z.string().nullable(),
      nationality: z.string().nullable(), ageYears: z.number().int().nonnegative().nullable(), ageAsOfDate: z.iso.date(),
      heightCm: z.number().positive().nullable(), weightKg: z.number().positive().nullable(),
      measurementsObservedAt: z.iso.datetime().nullable(), measurementsEffectiveDate: z.iso.date().nullable(),
      draftYear: z.number().int().nullable(), draftRound: z.string().nullable(), careerHistory: z.array(z.unknown()).max(0),
      // Additive v1 fields: earlier releases may omit them. No complete Career/roster claim.
      knownPositions: z.array(z.string()).optional(), schools: z.array(z.string()).optional(),
      affiliations: z.array(profileAffiliationSchema).optional(), draftTeamId: z.string().nullable().optional(),
      joinedYear: z.number().int().nullable().optional(), debutYear: z.number().int().nullable().optional(),
      identityLinked: z.boolean().optional(), originPlace: z.string().nullable().optional(),
      draftTeamName: z.string().nullable().optional(),
      amateurHistory: amateurHistorySchema.optional(), npbDebutYear: z.number().int().nullable().optional(),
      draftType: z.enum(["regular", "developmental"]).nullable().optional(),
      credits: z.array(z.strictObject({ name: z.string().min(1), url: z.url(), licenseUrl: z.url(),
        fields: z.array(z.string()).min(1), modified: z.literal(true) })).optional() }),
    membership: z.strictObject({ teamId: z.string().nullable(), scope: z.literal("latest_stored_affiliation"),
      uniformNumber: z.string().nullable(), uniformNumberObservedAt: z.iso.datetime().nullable(),
      uniformNumberEffectiveDate: z.iso.date().nullable(), registrationClass: z.enum(["registered", "developmental"]).nullable().optional() }),
    visual: z.strictObject({ photo: visualSchema, fallback: z.literal("name") }),
    battingAvailable: z.boolean(), pitchingAvailable: z.boolean() })),
}).superRefine((v, ctx) => {
  const ids = new Set(v.teams.map(t => t.teamId));
  if (ids.size !== 12 || v.teams.length !== 12 || new Set(v.players.map(p => p.playerId)).size !== v.players.length)
    ctx.addIssue({ code: "custom", message: "Duplicate/missing canonical entity" });
  for (const p of v.players) if (p.membership.teamId !== null && !ids.has(p.membership.teamId))
    ctx.addIssue({ code: "custom", message: "Unknown canonical affiliation" });
  for (const p of v.players) if ((p.profile.draftTeamId && !ids.has(p.profile.draftTeamId)) ||
    p.profile.affiliations?.some(a => a.teamId !== null && !ids.has(a.teamId)))
    ctx.addIssue({ code: "custom", message: "Unknown canonical profile Team" });
});
export type NpbCatalog = z.infer<typeof npbCatalogSchema>;

const metricSchema = z.strictObject({ value: z.number().finite().nonnegative().nullable(),
  status: z.enum(["complete", "partial", "unavailable"]), observedFacts: z.number().int().nonnegative(),
  factCount: z.number().int().nonnegative() });
export const coverageSchema = z.strictObject({ status: z.enum(["complete", "partial", "unknown", "unavailable"]),
  summary: z.strictObject({ dates: z.number().int().nonnegative(), complete: z.number().int().nonnegative(),
    noGames: z.number().int().nonnegative(), partial: z.number().int().nonnegative(),
    unknown: z.number().int().nonnegative(), failed: z.number().int().nonnegative() }) });
export const npbTeamSeasonSchema = z.strictObject({ schemaVersion: z.literal(1), league: z.literal("NPB"),
  season: z.number().int(), competition: z.literal("regular"), effectiveDate: z.iso.date(), generatedAt: z.iso.datetime(),
  period: z.strictObject({ from: z.iso.date(), to: z.iso.date() }), scope: z.literal("stored_final_games"), coverage: coverageSchema,
  teams: z.array(z.strictObject({ teamId: z.string(), G: z.number().int().nonnegative(), W: z.number().int().nonnegative(),
    L: z.number().int().nonnegative(), T: z.number().int().nonnegative(), runsFor: z.number().int().nonnegative().nullable(),
    runsAgainst: z.number().int().nonnegative().nullable(), scoreStatus: z.enum(["complete", "partial", "unavailable"]),
    gamesWithBattingFacts: z.number().int().nonnegative(), gamesWithPitchingFacts: z.number().int().nonnegative(),
    observedHomeVenues: z.array(z.string()), batting: z.record(z.string(), metricSchema), pitching: z.record(z.string(), metricSchema) })),
}).superRefine((v, ctx) => {
  if (v.period.to !== v.effectiveDate || v.period.from > v.period.to || new Set(v.teams.map(t => t.teamId)).size !== v.teams.length)
    ctx.addIssue({ code: "custom", message: "Invalid Season identity/window" });
  for (const t of v.teams) if (t.scoreStatus === "complete" && t.G !== t.W + t.L + t.T)
    ctx.addIssue({ code: "custom", message: "Team decisions disagree with Games" });
});
export type NpbTeamSeason = z.infer<typeof npbTeamSeasonSchema>;

export const npbCapabilitiesSchema = z.strictObject({ schemaVersion: z.literal(1), league: z.literal("NPB"),
  effectiveDate: z.iso.date(), generatedAt: z.iso.datetime(), coverage: coverageSchema,
  data: z.record(z.string(), z.strictObject({ status: dataAvailabilitySchema, available: z.boolean(),
    reasons: z.array(z.string()), known: z.number().int().nonnegative().nullable(), total: z.number().int().nonnegative().nullable() }))
}).superRefine((v, ctx) => {
  for (const c of Object.values(v.data)) {
    if (c.available !== ["available", "partially_available"].includes(c.status) ||
      (c.known !== null && c.total !== null && c.known > c.total))
      ctx.addIssue({ code: "custom", message: "Capability contradicts availability" });
  }
});
export type NpbCapabilities = z.infer<typeof npbCapabilitiesSchema>;
