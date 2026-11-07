import { z } from "zod";

const tournamentId = z.string().regex(/^international:tournament:(?:apbc|wbc|premier12|exhibition):\d{4}(?::[a-z0-9-]+)?$/);
const teamId = z.string().regex(/^international:team:[a-z0-9-]+$/);
const gameId = z.string().regex(/^international:game:[a-z0-9:-]+$/);
const playerId = z.string().regex(/^international:player:[a-z0-9:-]+$/);
const label = z.string().trim().min(1);
const officialUrl = z.url({ protocol: /^https$/ });

export const internationalTournamentSchema = z.strictObject({
  competition: z.literal("international"),
  id: tournamentId,
  kind: z.enum(["apbc", "wbc", "premier12", "exhibition"]),
  year: z.number().int().min(1900).max(9999),
  name: label,
  summary: label.optional(),
  links: z.array(z.strictObject({ label, url: officialUrl })).min(1),
}).refine(t => {
  const [, , kind, year] = t.id.split(":");
  return t.kind === kind && t.year === Number(year);
}, "Tournament ID and edition mismatch");

const sourceReference = z.strictObject({ sourceRevisionId: label, sourceRecordId: label });
const timeZone = z.string().refine(zone => {
  if (!/^[A-Za-z]/.test(zone)) return false;
  try { new Intl.DateTimeFormat("en", { timeZone: zone }); return true; }
  catch { return false; }
}, "Expected an IANA time zone");
const runs = z.number().int().nonnegative();

export const internationalGameSchema = z.strictObject({
  competition: z.literal("international"), tournamentId, id: gameId,
  round: z.enum(["qualifier", "pool", "super_round", "quarterfinal", "semifinal", "third_place", "final", "exhibition"]),
  homeTeamId: teamId.nullable(), awayTeamId: teamId.nullable(),
  localDate: z.iso.date().nullable(), scheduledAt: z.iso.datetime({ offset: true }).nullable(), timeZone,
  status: z.enum(["scheduled", "in_progress", "suspended", "postponed", "canceled", "final", "unknown"]),
  result: z.strictObject({ homeRuns: runs, awayRuns: runs }).nullable(),
  source: sourceReference,
}).refine(game => {
  const teamsKnown = game.homeTeamId !== null && game.awayTeamId !== null;
  if (teamsKnown && game.homeTeamId === game.awayTeamId) return false;
  if (game.status === "final") return teamsKnown && game.result !== null;
  return game.result === null;
}, "Final results require both confirmed teams; other statuses have no final result")
  .refine(game => {
    if (!game.localDate || !game.scheduledAt || !timeZone.safeParse(game.timeZone).success) return true;
    const instant = Date.parse(game.scheduledAt);
    return Number.isFinite(instant) && new Intl.DateTimeFormat("sv-SE", { timeZone: game.timeZone }).format(instant) === game.localDate;
  },
  { path: ["localDate"], message: "Local date must agree with the scheduled instant and time zone" });

const participation = z.strictObject({
  competition: z.literal("international"), tournamentId, teamId, playerId,
  date: z.iso.date().nullable(), source: sourceReference,
});
export const internationalParticipationSchema = z.discriminatedUnion("kind", [
  participation.extend({ kind: z.literal("selected") }),
  participation.extend({ kind: z.literal("registered") }),
  participation.extend({ kind: z.literal("appeared"), gameId }),
]);

const permission = z.enum(["approved", "unverified", "prohibited"]);
const sourceRevision = z.strictObject({
  id: label, sourceId: label, version: label, url: officialUrl, termsEvidenceUrl: officialUrl,
  verifiedAt: z.iso.datetime(),
  permissions: z.strictObject({
    acquisition: permission, storage: permission, transformation: permission,
    webDisplay: permission, androidDisplay: permission, redistribution: permission,
  }),
});
const coverage = z.discriminatedUnion("status", [
  z.strictObject({ status: z.literal("uncollected") }),
  z.strictObject({ status: z.enum(["partial", "complete"]), scope: label, source: sourceReference }),
]);
const identityEvidence = z.strictObject({
  playerId,
  independentEvidence: z.tuple([officialUrl, officialUrl]).refine(([a, b]) => a !== b),
  verificationMethod: label, reviewedAt: z.iso.datetime(),
});
const identity = z.discriminatedUnion("league", [
  identityEvidence.extend({ league: z.literal("NPB"), canonicalPlayerId: z.uuid() }),
  identityEvidence.extend({ league: z.literal("MLB"), canonicalPlayerId: z.templateLiteral(["mlb:player:", z.uuid()]) }),
]);

/** A tournament's release evidence is separate from its public, link-only introduction. */
export const internationalTournamentEvidenceSchema = z.strictObject({
  tournamentId, editionRevision: z.number().int().positive(),
  sources: z.array(sourceRevision), identities: z.array(identity),
  games: z.array(internationalGameSchema), participation: z.array(internationalParticipationSchema),
  coverage: z.strictObject({ schedule: coverage, results: coverage, selections: coverage,
    registrations: coverage, appearances: coverage, playerStats: coverage }),
  corrections: z.array(z.strictObject({
    supersedesRevision: z.number().int().positive(), recordedAt: z.iso.datetime(), reason: label, source: sourceReference,
  })),
}).superRefine((edition, context) => {
  const approved = new Set(edition.sources.filter(s => Object.values(s.permissions).every(p => p === "approved")).map(s => s.id));
  if (new Set(edition.sources.map(s => s.id)).size !== edition.sources.length)
    context.addIssue({ code: "custom", path: ["sources"], message: "Duplicate source revision" });
  if (new Set(edition.identities.map(i => i.playerId)).size !== edition.identities.length)
    context.addIssue({ code: "custom", path: ["identities"], message: "Conflicting player identity bridge" });
  const games = new Map(edition.games.map(g => [g.id, g]));
  if (games.size !== edition.games.length || edition.games.some(g =>
    g.tournamentId !== edition.tournamentId || !approved.has(g.source.sourceRevisionId)))
    context.addIssue({ code: "custom", path: ["games"], message: "Games require unique IDs and admitted evidence for this tournament" });
  for (const [index, record] of edition.participation.entries()) {
    const game = record.kind === "appeared" ? games.get(record.gameId) : undefined;
    const invalidAppearance = record.kind === "appeared" && (!game ||
      !["in_progress", "suspended", "final"].includes(game.status) ||
      (game.homeTeamId !== record.teamId && game.awayTeamId !== record.teamId));
    if (invalidAppearance || record.tournamentId !== edition.tournamentId || !approved.has(record.source.sourceRevisionId))
      context.addIssue({ code: "custom", path: ["participation", index], message: "Participation requires admitted evidence and, for an appearance, a played game" });
  }
  for (const [field, value] of Object.entries(edition.coverage)) {
    if (value.status !== "uncollected" && !approved.has(value.source.sourceRevisionId))
      context.addIssue({ code: "custom", path: ["coverage", field], message: "Coverage requires an admitted source revision" });
  }
  for (const correction of edition.corrections) {
    if (correction.supersedesRevision >= edition.editionRevision || !approved.has(correction.source.sourceRevisionId))
      context.addIssue({ code: "custom", path: ["corrections"], message: "Correction requires an earlier revision and admitted evidence" });
  }
});
