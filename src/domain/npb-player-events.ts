import { z } from "zod";
import { dateInZone } from "./analysis-query";
import { playerEventKinds } from "./npb-event-query";
export { playerEventKinds } from "./npb-event-query";

export const playerEventLabels: Record<typeof playerEventKinds[number], string> = {
  trade: "トレード", signing: "契約発表", retirement_announcement: "引退発表", nonrenewal_notice: "戦力外通告", release: "自由契約",
  registration_change: "支配下契約", fa_declaration: "FA宣言", posting_application: "ポスティング申請", draft_selection: "ドラフト指名", contract_renewal: "契約更改",
};
const team = z.string().regex(/^npb:team:(giants|tigers|dragons|carp|swallows|baystars|hawks|fighters|lions|marines|eagles|buffaloes)$/);
export const eventIdentitySchema = z.strictObject({ playerId: z.uuid(), name: z.string().min(1).max(100), article: z.string().min(1).max(120), wikidataId: z.string().regex(/^Q\d+$/), npbId: z.string().regex(/^\d+$/), identityRevision: z.number().int().positive() });
const sourceSchema = z.strictObject({ provider: z.literal("Wikipedia"), pageId: z.literal(5145794), title: z.literal("2026年の日本プロ野球"), revision: z.number().int().positive(), revisionAt: z.iso.datetime(), contentSha256: z.string().regex(/^[a-f0-9]{64}$/), url: z.url(), license: z.literal("CC-BY-SA-4.0"), licenseUrl: z.literal("https://creativecommons.org/licenses/by-sa/4.0/") });
export const playerEventSchema = z.strictObject({
  id: z.string().regex(/^npb:event:[a-f0-9]{24}$/), kind: z.enum(playerEventKinds), playerId: z.uuid(),
  recordedDate: z.iso.date(), announcementDate: z.null(), effectiveDate: z.null(),
  status: z.literal("encyclopedia_record"), relatedTeamIds: z.array(team).min(1).max(2),
  fromTeamId: team.nullable(), toTeamId: team.nullable(),
  sourceRevision: z.number().int().positive(), statementSha256: z.string().regex(/^[a-f0-9]{64}$/),
  // Licensed first-sentence evidence only, not a scraped external news body.
  excerpt: z.string().min(1).max(300),
}).superRefine((e, c) => {
  if (!e.recordedDate.startsWith("2026-") || new Set(e.relatedTeamIds).size !== e.relatedTeamIds.length) c.addIssue({ code: "custom", message: "Invalid event scope" });
  if (e.kind === "trade" ? !e.fromTeamId || !e.toTeamId || e.fromTeamId === e.toTeamId : e.fromTeamId !== null || e.toTeamId !== null) c.addIssue({ code: "custom", message: "Unproven membership transition" });
  if ([e.fromTeamId, e.toTeamId].some(t => t && !e.relatedTeamIds.includes(t))) c.addIssue({ code: "custom", message: "Unrelated event club" });
});
export const npbPlayerEventsSchema = z.strictObject({
  schemaVersion: z.literal(1), league: z.literal("NPB"), season: z.literal(2026), coverage: z.literal("partial"),
  provider: z.literal("Wikipedia"), license: z.literal("CC-BY-SA-4.0"), observedAt: z.iso.datetime(),
  source: sourceSchema, identityInputSha256: z.string().regex(/^[a-f0-9]{64}$/), players: z.array(eventIdentitySchema).max(740), events: z.array(playerEventSchema).max(1000),
  transformation: z.literal("Explicit dated first sentences and verified article identities; deterministic labels; no official certification, effective-date inference, AI-generated facts or canonical writes"),
}).superRefine((d, c) => {
  const ids = new Set(d.players.map(p => p.playerId));
  if (ids.size !== d.players.length || ["article", "npbId", "wikidataId"].some(k => new Set(d.players.map(p => p[k as "article" | "npbId" | "wikidataId"])).size !== d.players.length) || new Set(d.events.map(e => e.id)).size !== d.events.length) c.addIssue({ code: "custom", message: "Ambiguous event identity or duplicate event" });
  if (Date.parse(d.source.revisionAt) > Date.parse(d.observedAt) || d.events.some(e => e.sourceRevision !== d.source.revision || !ids.has(e.playerId) || e.recordedDate > dateInZone(Date.parse(d.observedAt), "Asia/Tokyo"))) c.addIssue({ code: "custom", message: "Event revision, identity or future-date mismatch" });
  if (d.source.url !== `https://ja.wikipedia.org/w/index.php?curid=5145794&oldid=${d.source.revision}`) c.addIssue({ code: "custom", message: "Mislabeled event source URL" });
});
export type EventIdentity = z.infer<typeof eventIdentitySchema>;
export type PlayerEvent = z.infer<typeof playerEventSchema>;
export type NpbPlayerEvents = z.infer<typeof npbPlayerEventsSchema>;

/** A missing/changed source row requires review, never an automatic retraction or roster edit. */
export function compareEventSnapshots(previous: NpbPlayerEvents, candidate: NpbPlayerEvents) {
  const before = new Map(previous.events.map(e => [e.id, e])), after = new Map(candidate.events.map(e => [e.id, e]));
  const previousPlayers = new Map(previous.players.map(p => [p.playerId, p]));
  const semantic = (e: PlayerEvent) => JSON.stringify({ ...e, sourceRevision: 0, statementSha256: "" });
  return {
    added: candidate.events.filter(e => !before.has(e.id)).map(e => e.id),
    removed: previous.events.filter(e => !after.has(e.id)).map(e => e.id),
    changed: candidate.events.filter(e => before.has(e.id) && semantic(e) !== semantic(before.get(e.id)!)).map(e => e.id),
    playersChanged: candidate.players.filter(p => previousPlayers.has(p.playerId) && JSON.stringify(p) !== JSON.stringify(previousPlayers.get(p.playerId))).map(p => p.playerId),
    identityInputChanged: candidate.identityInputSha256 !== previous.identityInputSha256,
    sourceChanged: candidate.source.contentSha256 !== previous.source.contentSha256,
  };
}
