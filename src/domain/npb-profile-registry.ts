import { z } from "zod";
import { positionCodeSchema } from "./baseball-terms";

// Periods retain source precision. A year is never converted into a fabricated day.
export const profilePeriodSchema = z.string().regex(/^\d{4}(-\d{2}(-\d{2})?)?$/).superRefine((v, ctx) => {
  if (!z.iso.date().safeParse(v.length === 4 ? `${v}-01-01` : v.length === 7 ? `${v}-01` : v).success)
    ctx.addIssue({ code: "custom", message: "Invalid profile period" });
});
export const profileAffiliationSchema = z.strictObject({ name: z.string().min(1), teamId: z.string().nullable(),
  from: profilePeriodSchema.nullable(), to: profilePeriodSchema.nullable(), uniformNumber: z.string().regex(/^\d{1,3}$/).nullable() });
export const profileFieldSchemas = {
  position: positionCodeSchema, knownPositions: z.array(z.string().min(1)).min(1),
  bats: z.enum(["right", "left", "switch"]), throws: z.enum(["right", "left"]), birthDate: z.iso.date(),
  birthPlace: z.string().min(1), originPlace: z.string().min(1), nationality: z.string().min(1), heightCm: z.number().positive().max(250),
  weightKg: z.number().positive().max(250), schools: z.array(z.string().min(1)).min(1),
  affiliations: z.array(profileAffiliationSchema).min(1), draftYear: z.number().int().min(1936).max(2100),
  draftRound: z.string().min(1), draftTeamId: z.string().min(1), joinedYear: z.number().int().min(1936).max(2100),
  debutYear: z.number().int().min(1936).max(2100), registrationClass: z.enum(["registered", "developmental"]),
  uniformNumber: z.string().regex(/^\d{1,3}$/),
} as const;
export type ProfileField = keyof typeof profileFieldSchemas;
export const profileRegistrySchema = z.strictObject({ schemaVersion: z.literal(1), observedAt: z.iso.datetime(),
  entries: z.array(z.strictObject({ playerId: z.uuid(), field: z.enum(Object.keys(profileFieldSchemas) as [ProfileField, ...ProfileField[]]),
    value: z.unknown(), sourceName: z.string().min(1), sourceUrl: z.url(), license: z.enum(["CC0", "CC-BY-4.0", "CC-BY-SA-4.0", "individual_fact"]),
    rightsEvidenceUrl: z.url(), publicReuseAllowed: z.boolean(), verifiedAt: z.iso.datetime(),
    effectiveFrom: profilePeriodSchema.nullable(), effectiveTo: profilePeriodSchema.nullable(),
    verificationStatus: z.enum(["source_verified", "human_reviewed", "pending", "conflict"]), reviewer: z.string().nullable(),
    notes: z.string(), additionalSourceUrls: z.array(z.url()) }))
}).superRefine((r, ctx) => {
  for (const e of r.entries) {
    if (!profileFieldSchemas[e.field].safeParse(e.value).success)
      ctx.addIssue({ code: "custom", message: `Invalid ${e.field} value` });
    if (e.verificationStatus === "human_reviewed" && (!e.reviewer || /codex|automated|agent/i.test(e.reviewer)))
      ctx.addIssue({ code: "custom", message: "Human review requires an actual named human reviewer" });
    if (e.license === "individual_fact" && e.verificationStatus !== "human_reviewed")
      ctx.addIssue({ code: "custom", message: "Individual factual verification requires human review" });
    if (e.license === "individual_fact" && e.additionalSourceUrls.length < 1)
      ctx.addIssue({ code: "custom", message: "Individual factual review requires multiple independent references" });
  }
});
export type ProfileRegistry = z.infer<typeof profileRegistrySchema>;
export type ProfileRegistryEntry = ProfileRegistry["entries"][number];

export function eligibleProfileEntries(registry: ProfileRegistry, effectiveDate: string) {
  return registry.entries.filter(e => e.publicReuseAllowed && ["source_verified", "human_reviewed"].includes(e.verificationStatus)
    && (e.field !== "birthDate" || String(e.value) <= effectiveDate)
    // Current membership attributes require day-precise evidence covering the requested day.
    && (!["uniformNumber", "registrationClass"].includes(e.field) ||
      (e.effectiveFrom?.length === 10 && e.effectiveTo?.length === 10 && e.effectiveFrom <= effectiveDate && e.effectiveTo >= effectiveDate)));
}
