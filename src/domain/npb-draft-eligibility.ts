import { z } from "zod";
import reviewJson from "../data/npb-draft-2026-eligibility-review.json";
import type { DraftEvent } from "./npb-draft-event";

const sourceUrls = {
  high_school: "https://www.jhbf.or.jp/pro-aspiring/2026.html",
  university: "https://www.jubf.net/system/prog/procandidate.php?kind=all&year=2026",
} as const;
export const draftEligibilityReviewSchema = z.strictObject({
  season: z.literal(2026), checkedAt: z.iso.datetime(),
  records: z.array(z.strictObject({
    candidateId: z.string(), name: z.string(), affiliation: z.string(),
    evidenceSha256: z.string().regex(/^[a-f0-9]{64}$/), sourcePageId: z.number().int().positive(),
    group: z.enum(["high_school", "university"]),
    status: z.enum(["listed", "not_listed", "identity_mismatch"]),
    note: z.string().min(1),
  })).max(250),
}).superRefine((r, ctx) => {
  if (new Set(r.records.map(c => c.candidateId)).size !== r.records.length)
    ctx.addIssue({ code: "custom", message: "Duplicate eligibility review identity" });
});
export const draftEligibilityReview = draftEligibilityReviewSchema.parse(reviewJson);
type Candidate = DraftEvent["candidates"][number];

/** Editorial admission review, separate from immutable Wikipedia observations and NPB identity/registration. */
export function draftForecastAdmission(candidate: Candidate, group: string | undefined) {
  const record = draftEligibilityReview.records.find(r => r.candidateId === candidate.id);
  // No name-only joins, broad university/school aliases, or review inheritance for new source evidence.
  if (!record || record.group !== group || record.name !== candidate.name || record.affiliation !== candidate.affiliation ||
    record.evidenceSha256 !== candidate.evidenceSha256 || record.sourcePageId !== candidate.sourcePageId)
    return { status: "unverified" as const, admitted: false, note: "2026年の指名対象としての確認が済んでいないため、予想を保留しています。", url: null };
  return { status: record.status, admitted: record.status === "listed", note: record.note, url: sourceUrls[record.group] };
}
