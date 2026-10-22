import { z } from "zod";
import { draftTeams, type DraftEvent } from "./npb-draft-event";
import { draftForecastAdmission, draftEligibilityReview } from "./npb-draft-eligibility";

export const draft2026Start = "2026-10-22T07:50:00Z";
export function assertFirstFinalPublication(now = Date.now()) {
  if (now >= Date.parse(draft2026Start)) throw Error("Meeting started: new premeeting publication prohibited");
}
export function assertFinalAppPublicationWindow(alreadyPublished: boolean, now = Date.now()) {
  // Reserve 15 minutes for the Pages deployment itself. Later maintenance may retain an already published immutable edition.
  if (!alreadyPublished && now >= Date.parse(draft2026Start) - 15 * 60000) throw Error("Too late for first premeeting Pages publication");
}
const beforeStart = (s: string) => Date.parse(s) < Date.parse(draft2026Start);
const url = z.url().refine(s => { const u = new URL(s); return u.protocol === "https:" && !u.username && !u.password; });
const team = z.enum(draftTeams as [string, ...string[]]);
const candidate = z.strictObject({
  id: z.string().regex(/^npb:draft:2026:[a-f0-9]{24}$/),
  name: z.string().min(1).max(40), affiliation: z.string().min(1).max(60),
  group: z.enum(["high_school", "university", "corporate", "independent"]),
  position: z.enum(["投手", "捕手", "内野手", "外野手", "未確認"]),
  legacyCandidateId: z.string().nullable(), legacyEvidenceSha256: z.string().regex(/^[a-f0-9]{64}$/).nullable(),
  identityNote: z.string().min(1).max(300), identityUrls: z.array(url).min(1).max(4),
  eligibility: z.strictObject({
    status: z.literal("reviewed_eligible"), rule: z.enum(["student_list", "corporate_graduate", "independent_graduate"]),
    basis: z.string().min(1).max(300), urls: z.array(url).min(1).max(4), checkedAt: z.iso.datetime(),
    studentList: z.strictObject({ name: z.string(), school: z.string().min(1), acceptedOn: z.iso.date().nullable(), section: z.literal("NPBドラフト対象者") }).nullable(),
    collegeGraduated: z.boolean().nullable(), firstCorporateSeason: z.number().int().min(2000).max(2026).nullable(),
    highSchoolGraduated: z.boolean().nullable(), independentSeasons: z.number().int().positive().nullable(),
  }),
});
function individualIdentityUrls(c: z.infer<typeof candidate>, candidates: z.infer<typeof candidate>[]) {
  return c.identityUrls.filter(u => !candidates.some(other => other.eligibility.rule === "student_list" && other.eligibility.urls.includes(u)))
    .filter(u => !candidates.some(other => other.id !== c.id && other.identityUrls.includes(u)));
}
const pick = z.strictObject({ teamId: team, round: z.number().int().min(1).max(3), candidateId: z.string(), reason: z.string().min(1).max(260) });
export const finalDraftForecastSchema = z.strictObject({
  schemaVersion: z.literal(1), id: z.literal("2026-premeeting-final-v4"), title: z.literal("2026ドラフト直前最終予想"),
  author: z.literal("Baseball Notes（独自予想）"), informationCutoff: z.iso.datetime(), frozenAt: z.iso.datetime(),
  baseBodySha256: z.string().regex(/^[a-f0-9]{64}$/), license: z.literal("CC-BY-SA-4.0"),
  candidates: z.array(candidate).length(36),
  clubs: z.array(z.strictObject({ teamId: team, context: z.string().min(1).max(300), referenceUrls: z.array(url).min(1).max(4) })).length(12),
  researchReferences: z.array(z.strictObject({ url, publisher: z.string(), author: z.string(), publishedOn: z.iso.date(), updatedOn: z.iso.date(), checkedAt: z.iso.datetime(), kind: z.enum(["commentary", "report"]), topic: z.string() })).min(1).max(24),
  roundTwoOrder: z.array(team).length(12), orderSourceUrls: z.array(url).min(1).max(3),
  firstBids: z.array(z.strictObject({ teamId: team, candidateId: z.string() })).length(12),
  lotteryAssumptions: z.array(z.strictObject({ candidateId: z.string(), teamIds: z.array(team).min(2).max(12), assumedWinner: team, branchNote: z.string().min(1).max(300) })).max(6),
  predictions: z.array(pick).length(36),
  wikipediaAttribution: z.array(z.strictObject({ title: z.string(), pageId: z.number().int().positive(), revision: z.number().int().positive() })).max(6),
}).superRefine((f, ctx) => {
  const fail = (message: string) => ctx.addIssue({ code: "custom", message });
  if (!beforeStart(f.frozenAt) || Date.parse(f.informationCutoff) > Date.parse(f.frozenAt)) fail("Forecast must freeze before meeting, after information cutoff");
  const cs = new Map(f.candidates.map(c => [c.id, c]));
  for (const r of f.researchReferences) if (Date.parse(r.checkedAt) > Date.parse(f.informationCutoff) || r.publishedOn > r.updatedOn || Date.parse(r.updatedOn + "T00:00:00+09:00") > Date.parse(r.checkedAt)) fail("Research must precede information cutoff");
  if (f.clubs.some(c => c.referenceUrls.some(u => !f.researchReferences.some(r => r.url === u)))) fail("Missing bibliographic reference");
  if (cs.size !== 36 || new Set(f.candidates.map(c => c.name + "|" + c.affiliation)).size !== 36) fail("Duplicate candidate identity");
  for (const c of f.candidates) {
    if (draftEligibilityReview.records.some(r => r.name === c.name && r.status !== "listed")) fail("PR62 rejected identity remains excluded in this edition");
    const e = c.eligibility;
    if (!beforeStart(e.checkedAt) || Date.parse(e.checkedAt) > Date.parse(f.informationCutoff)) fail("Eligibility evidence after cutoff");
    if ((c.legacyCandidateId === null) !== (c.legacyEvidenceSha256 === null)) fail("Incomplete legacy identity");
    if (!c.legacyCandidateId && individualIdentityUrls(c, f.candidates).length === 0) fail("New candidate needs individually bridgeable identity evidence");
    if (["high_school", "university"].includes(c.group)) {
      if (e.rule !== "student_list" || !e.studentList || e.studentList.name !== c.name || e.studentList.acceptedOn && e.studentList.acceptedOn > "2026-10-08") fail("Student needs individual NPB-target list evidence");
      const host = c.group === "high_school" ? "www.jhbf.or.jp" : "www.jubf.net";
      if (!e.urls.some(u => new URL(u).hostname === host)) fail("Missing official student list");
      if (!c.legacyCandidateId && e.studentList?.school !== c.affiliation) fail("New student identity must use its individually reviewed official school");
    } else if (c.group === "corporate") {
      if (e.rule !== "corporate_graduate" || e.collegeGraduated !== true || e.firstCorporateSeason === null || 2026 - e.firstCorporateSeason + 1 < 2 || e.studentList !== null) fail("Corporate eligibility is not a student application");
    } else if (e.rule !== "independent_graduate" || e.highSchoolGraduated !== true || e.independentSeasons === null || e.independentSeasons < 1 || e.studentList !== null) fail("Independent eligibility needs graduation and individual history");
  }
  for (const list of [f.clubs.map(c => c.teamId), f.roundTwoOrder, f.firstBids.map(c => c.teamId)]) if (new Set(list).size !== 12) fail("Need all twelve clubs exactly once");
  if (new Set(f.predictions.map(p => p.teamId + ":" + p.round)).size !== 36 || new Set(f.predictions.map(p => p.candidateId)).size !== 36) fail("Need 36 distinct winning selections");
  for (const p of [...f.predictions, ...f.firstBids]) if (!cs.has(p.candidateId)) fail("Unknown predicted identity");
  const grouped = new Map<string, string[]>();
  for (const bid of f.firstBids) grouped.set(bid.candidateId, [...(grouped.get(bid.candidateId) ?? []), bid.teamId]);
  if (new Set(f.lotteryAssumptions.map(a => a.candidateId)).size !== f.lotteryAssumptions.length) fail("Duplicate lottery assumption");
  for (const [id, teams] of grouped) {
    const a = f.lotteryAssumptions.find(a => a.candidateId === id);
    if (teams.length > 1) {
      if (!a || !teams.includes(a.assumedWinner) || JSON.stringify([...teams].sort()) !== JSON.stringify([...a.teamIds].sort()) || !f.predictions.some(p => p.round === 1 && p.teamId === a.assumedWinner && p.candidateId === id)) fail("Lottery winner/participants must agree with first-round scenario");
    } else if (a || !f.predictions.some(p => p.round === 1 && p.teamId === teams[0] && p.candidateId === id)) fail("Uncontested first bid must be allocated");
  }
  for (const a of f.lotteryAssumptions) if (!grouped.has(a.candidateId)) fail("Invented lottery group");
});
export type FinalDraftForecast = z.infer<typeof finalDraftForecastSchema>;

/** Preserve PR #62 review: old rejected identities cannot be re-admitted by a new forecast. */
export function assertFinalDraftBase(f: FinalDraftForecast, base: DraftEvent) {
  for (const c of f.candidates) {
    if (!c.legacyCandidateId) continue;
    const b = base.candidates.find(b => b.id === c.legacyCandidateId);
    if (!b || b.id !== c.id || b.name !== c.name || b.affiliation !== c.affiliation || b.evidenceSha256 !== c.legacyEvidenceSha256) throw Error("Final forecast legacy identity mismatch");
    if (["high_school", "university"].includes(c.group) && !draftForecastAdmission(b, c.group).admitted) throw Error("PR62 rejected student cannot be revived");
  }
}

/** An alternative draw exchanges the winner's and that loser's first selections. It is another hypothesis, never a result. */
export function alternativeFinalDraw(f: FinalDraftForecast, candidateId: string, winner: string) {
  const a = f.lotteryAssumptions.find(a => a.candidateId === candidateId);
  if (!a || !a.teamIds.includes(winner)) throw Error("Unknown lottery branch");
  const replacement = f.predictions.find(p => p.teamId === winner && p.round === 1)!;
  return f.predictions.map(p => p.round !== 1 ? p : p.teamId === winner ? { ...p, candidateId } : p.teamId === a.assumedWinner ? { ...p, candidateId: replacement.candidateId } : p);
}

// Explicit bridges are reviewed separately after results arrive; never mutate the frozen forecast to force a match.
export const finalResultBridgesSchema = z.array(z.strictObject({
  forecastCandidateId: z.string(), resultCandidateId: z.string(), name: z.string(), affiliation: z.string(), article: z.string().nullable(),
  resultEvidenceSha256: z.string().regex(/^[a-f0-9]{64}$/), identityEvidenceUrls: z.array(url).min(2).max(4), reviewedAt: z.iso.datetime(),
})).max(36).superRefine((bs, ctx) => {
  if (new Set(bs.map(b => b.forecastCandidateId)).size !== bs.length || new Set(bs.map(b => b.resultCandidateId)).size !== bs.length) ctx.addIssue({ code: "custom", message: "Ambiguous final result identity bridge" });
  if (bs.some(b => new Set(b.identityEvidenceUrls).size < 2)) ctx.addIssue({ code: "custom", message: "Independent result bridge evidence required" });
});
export type FinalResultBridge = z.infer<typeof finalResultBridgesSchema>[number];
export function finalDraftOutcome(f: FinalDraftForecast, base: DraftEvent, teamId: string, round: number, bridges: FinalResultBridge[] = []) {
  const p = f.predictions.find(p => p.teamId === teamId && p.round === round);
  const actual = base.selections.find(s => s.teamId === teamId && s.round === round && s.type === "regular");
  if (!p || !actual) return "unavailable";
  const expected = f.candidates.find(c => c.id === p.candidateId)!;
  const actualCandidate = base.candidates.find(c => c.id === actual.candidateId)!;
  const legacy = expected.legacyCandidateId && base.candidates.find(c => c.id === expected.legacyCandidateId && c.name === expected.name && c.affiliation === expected.affiliation && c.evidenceSha256 === expected.legacyEvidenceSha256);
  const reviewed = bridges.filter(b => b.forecastCandidateId === expected.id);
  if (reviewed.length > 1) return "unverified";
  const bridge = reviewed[0];
  // A shared applicant-list or team-roster URL cannot establish a personal identity relation.
  // Require an individually admitted source not shared by another forecast candidate, and exact reviewed names/schools.
  // Abbreviations/changed names stay unverified rather than being silently normalized.
  const individualUrls = individualIdentityUrls(expected, f.candidates);
  const resultSource = base.sources.find(s => s.pageId === actualCandidate.sourcePageId);
  const resultUrl = resultSource && `https://ja.wikipedia.org/w/index.php?curid=${resultSource.pageId}&oldid=${resultSource.revision}`;
  const bridged = bridge && bridge.name === expected.name && bridge.affiliation === expected.affiliation &&
    Date.parse(bridge.reviewedAt) >= Date.parse(base.observedAt) && bridge.identityEvidenceUrls.some(u => individualUrls.includes(u)) &&
    resultUrl && bridge.identityEvidenceUrls.includes(resultUrl) &&
    base.candidates.find(c => c.id === bridge.resultCandidateId && c.name === bridge.name && c.affiliation === bridge.affiliation && c.article === bridge.article && c.evidenceSha256 === bridge.resultEvidenceSha256);
  const identity = legacy || bridged;
  if (!identity) return "unverified";
  if (identity.id === actualCandidate.id) return "match";
  if (identity.name === actualCandidate.name || identity.article && identity.article === actualCandidate.article) return "unverified";
  return "different";
}
