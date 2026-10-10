import { z } from "zod";

const permission = z.enum(["allowed", "denied", "unknown"]);
/** Provider evidence; separate from application capability and existing Production Gates. */
export const sourceReadinessSchema = z.object({
  source: z.string().min(1), league: z.enum(["NPB", "MLB"]), competition: z.enum(["regular", "postseason", "preseason"]),
  season: z.number().int(), status: z.enum(["FULL_READY", "SCORE_READY", "TECHNICAL_ONLY", "BLOCKED", "UNVERIFIED"]),
  costTier: z.enum(["permanent_free", "trial", "paid", "unknown"]),
  coverage: z.enum(["complete", "partial", "unknown"]),
  fields: z.object({ schedule: z.boolean(), score: z.boolean(), batting: z.boolean(), pitching: z.boolean(), pa: z.boolean() }),
  permissions: z.object({ acquisition: permission, storage: permission, publicDisplay: permission, redistribution: permission }),
  provenance: z.object({ termsUrl: z.url(), checkedAt: z.iso.datetime(), notes: z.string() }),
}).superRefine((s, ctx) => {
  if (["FULL_READY", "SCORE_READY"].includes(s.status) && (s.costTier !== "permanent_free" ||
    Object.values(s.permissions).some(p => p !== "allowed") || !s.fields.schedule || !s.fields.score || s.coverage !== "complete"))
    ctx.addIssue({ code: "custom", message: "Readiness requires free, complete, explicitly permitted public ingestion" });
  if (s.status === "FULL_READY" && (!s.fields.batting || !s.fields.pitching))
    ctx.addIssue({ code: "custom", message: "Score-only source cannot supply full Game Facts" });
});
export type SourceReadiness = z.infer<typeof sourceReadinessSchema>;

const observationSchema = z.object({ source: z.string(), sourceGameId: z.string().min(1),
  league: z.enum(["NPB", "MLB"]), competition: z.enum(["regular", "postseason", "preseason"]), season: z.number().int(),
  playedAt: z.iso.datetime(), observedAt: z.iso.datetime(), effectiveDate: z.iso.date(),
  homeTeamId: z.string().nullable(), awayTeamId: z.string().nullable(),
  status: z.enum(["scheduled", "postponed", "suspended", "final"]),
  homeScore: z.number().int().nonnegative().nullable(), awayScore: z.number().int().nonnegative().nullable(),
  complete: z.boolean(), playerStatsComplete: z.boolean(), unresolvedIdentities: z.number().int().nonnegative(),
});
export type DailyObservation = z.infer<typeof observationSchema>;
export function npbObservationDate(instant: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant));
}
/** Pure shadow assessment; no persistence, retries, network calls, or canonical writes. */
export function assessDailyObservation(input: unknown, previous?: DailyObservation, attempt = 0) {
  const parsed = observationSchema.safeParse(input);
  if (!parsed.success) return { status: "invalid" as const, reasons: ["schema"], retryAllowed: false };
  const row = parsed.data, reasons: string[] = [];
  if (!row.homeTeamId || !row.awayTeamId || row.homeTeamId === row.awayTeamId) reasons.push("missing_or_invalid_team");
  if (row.season !== Number(row.effectiveDate.slice(0, 4)) ||
    (row.league === "NPB" && npbObservationDate(row.playedAt) !== row.effectiveDate)) reasons.push("date_scope");
  if (row.observedAt < row.playedAt && row.status === "final") reasons.push("future_final");
  if (row.status !== "final") reasons.push(row.status);
  if (!row.complete) reasons.push("partial_game");
  if (!row.playerStatsComplete) reasons.push("partial_player_stats");
  if (row.unresolvedIdentities) reasons.push("unknown_identity");
  if (row.status === "final" && (row.homeScore === null || row.awayScore === null)) reasons.push("missing_final_score");
  if (previous && (previous.source !== row.source || previous.sourceGameId !== row.sourceGameId ||
    previous.league !== row.league || previous.competition !== row.competition || previous.season !== row.season)) reasons.push("source_or_scope_conflict");
  if (previous && previous.observedAt > row.observedAt) reasons.push("stale_observation");
  if (previous?.status === "final" && (previous.homeScore !== row.homeScore || previous.awayScore !== row.awayScore)) reasons.push("correction_requires_review");
  const fingerprint = (value: DailyObservation) => JSON.stringify(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "observedAt")));
  const same = previous && fingerprint(row) === fingerprint(previous);
  return { status: reasons.length ? "quarantined" as const : same ? "unchanged" as const : "validated_shadow" as const,
    reasons, retryAllowed: Number.isInteger(attempt) && attempt >= 0 && attempt < 2 &&
      reasons.every(reason => ["suspended", "partial_game", "partial_player_stats", "missing_final_score"].includes(reason)) && reasons.length > 0 };
}
