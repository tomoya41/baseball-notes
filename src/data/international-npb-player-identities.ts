import type { z } from "zod";
import type { internationalTournamentEvidenceSchema } from "../domain/international-competition";

type Edition = z.infer<typeof internationalTournamentEvidenceSchema>;
type Source = Edition["sources"][number];

export type NpbInternationalIdentityReview = {
  row: readonly [pageId: number, articleRevision: number, npbId: string, canonicalId: string, chadwickId: string, articleSha256: string];
  reviewDate: string;
};

export const kanemaruNpbIdentityReview = {
  row: [4977707, 111782436, "61565150", "7bbeda89-5b15-4e15-90d7-3c862c9a30b9",
    "8d65303a-dc8c-4874-acbd-8c9126664873", "1504b5a5e0f3fbb8fcb222a507fd5719fa48be8d5c6e57f62e47db043b8002fd"],
  reviewDate: "2026-11-24T12:19:00Z",
} as const satisfies NpbInternationalIdentityReview;

const wikiLicense = "https://creativecommons.org/licenses/by-sa/4.0/";
const chadwickRevision = "ba48ce101349a2156c7a5420f54d13e8ef3a4256";
const chadwickArchiveSha256 = "6938a20b2da4633348d3d6ce7e5bb62d17716d3bbe0382940395aa912d40a609";

const permissions = {
  acquisition: "approved", storage: "approved", transformation: "approved",
  webDisplay: "approved", androidDisplay: "approved", redistribution: "approved",
} satisfies Source["permissions"];

const chadwick: Source = {
  id: `chadwick:register:${chadwickRevision}`, sourceId: "chadwick-register", publisherId: "chadwick-bureau",
  version: chadwickRevision, url: `https://github.com/chadwickbureau/register/tree/${chadwickRevision}`,
  termsEvidenceUrl: "https://opendatacommons.org/licenses/by/1-0/", verifiedAt: kanemaruNpbIdentityReview.reviewDate, permissions,
};

export function buildNpbInternationalIdentityEvidence(reviews: readonly NpbInternationalIdentityReview[]) {
  const sources: Source[] = [
    chadwick,
    ...reviews.map(({ row: [, revision], reviewDate }): Source => ({
      id: `jawiki:player:${revision}`, sourceId: "jawiki-player", publisherId: "japanese-wikipedia",
      version: String(revision), url: `https://ja.wikipedia.org/w/index.php?oldid=${revision}`, termsEvidenceUrl: wikiLicense,
      verifiedAt: reviewDate, permissions,
    })),
  ];
  const identities: Edition["identities"] = reviews.map(
    ({ row: [pageId, revision, npbId, canonicalPlayerId, chadwickId, wikiSha256], reviewDate }) => {
      const playerId = `international:player:jawiki:${pageId}` as const;
      const identifier = { method: "shared_player_identifier", authorityId: "npb", value: npbId } as const;
      return {
        league: "NPB", playerId, canonicalPlayerId,
        evidence: {
          international: { sourceRevisionId: `jawiki:player:${revision}`, sourceRecordId: String(pageId), subjectId: playerId,
            publication: "original", documentSha256: wikiSha256, identifier },
          canonical: { sourceRevisionId: chadwick.id, sourceRecordId: chadwickId, subjectId: canonicalPlayerId,
            publication: "original", documentSha256: chadwickArchiveSha256, identifier },
        },
        review: { result: "verified", reviewer: "Baseball Notes", reviewedAt: reviewDate,
          rationale: "The fixed player article and Chadwick key_npb identify a unique verified NPB Directory ID; key_uuid matches the existing bridge." },
      };
    },
  );
  return { sources, identities };
}
