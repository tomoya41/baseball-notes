import type { z } from "zod";
import type { internationalTournamentEvidenceSchema } from "../domain/international-competition";

type Edition = z.infer<typeof internationalTournamentEvidenceSchema>;
type Source = Edition["sources"][number];

export const apbc2026Id = "international:tournament:apbc:2026";
const reviewedAt = "2026-11-24T12:19:00Z";
const wikiLicense = "https://creativecommons.org/licenses/by-sa/4.0/";
const chadwickRevision = "ba48ce101349a2156c7a5420f54d13e8ef3a4256";
const chadwickArchiveSha256 = "6938a20b2da4633348d3d6ce7e5bb62d17716d3bbe0382940395aa912d40a609";

// Japanese Wikipedia contributors (fixed player article revisions, CC BY-SA 4.0) and
// the Chadwick Baseball Bureau Register (ODC-BY 1.0). Only the exact matching IDs are used.
const reviewedPlayers = [
  // 髙橋宏斗
  [4251765, 111782428, "61265153", "85cf36a2-6dc5-4612-9969-0d9d6eca626c",
    "784a5f12-6e6a-4555-8570-8bbf37066792", "cf7c13b2a4b9da534a8e2907af6f215a3c1d8fe66e20916b9056df3576c01cc7"],
  // 正木智也
  [4450526, 111804472, "81885155", "2b2a8d97-2a6e-441c-9a33-0d79d2a7d147",
    "197db3cb-d211-45f4-926a-9bdab2f9540d", "89fe09ca7d0615bafbd2dd8a99f64d070f365fb3f17168bdf35b88c11b27b2f1"],
  // 森田駿哉
  [4847158, 111849866, "43345159", "18f28f0f-a0b1-4970-aa9a-cce98530eac8",
    "df09c07a-6daa-4851-81fb-8d609c7d22d4", "c90abe5058894a64602e2c9b2c4f81a0f609eb73f6fbd92ed1afa9313f211570"],
  // 髙太一
  [4847462, 111886451, "41045159", "b3179a2e-4de3-4a68-a624-2b1f6ae87911",
    "406ef87c-f492-4172-822b-710fc9f3e9e9", "974944152cb03318f1d86778a654f7c3e6c5dabec03957723abe0ed3fa16a3b7"],
  // 金丸夢斗
  [4977707, 111782436, "61565150", "7bbeda89-5b15-4e15-90d7-3c862c9a30b9",
    "8d65303a-dc8c-4874-acbd-8c9126664873", "1504b5a5e0f3fbb8fcb222a507fd5719fa48be8d5c6e57f62e47db043b8002fd"],
  // 宗山塁
  [4980856, 111833176, "53155150", "b6286dd6-cf1f-45b8-87e2-95433f8aadb0",
    "7a1b21f2-4cbf-457c-a3d7-7469284d28ef", "5869814f23e1e658764f1b6470bace6959abdf9082ccbc70ffef3c5df6f36be8"],
  // 西川史礁
  [4989301, 111806605, "21625150", "e7733422-2213-46f8-9b5f-4d12cf85c086",
    "b05094ea-3130-488e-a3bb-591157c4c87f", "fe3ee4441e50eb29bd8931557dda16b35cdcad3b4f20c38dc321e683fbe59dda"],
  // 渡部聖弥
  [4989729, 111782502, "83385150", "f19b2b9d-b148-4aee-9378-18fd5ad155fd",
    "49ef749d-3911-435d-8249-24ebf88bb524", "8abdcdf3b45eb6f28cb631559b9395d92621f7c498ff493409d77bcac5ee0f3a"],
  // 小島大河
  [5156099, 111782486, "41745152", "ae44f92d-c4be-4d52-a5ab-aa44f323b67b",
    "710cd9d2-e9f0-4578-a506-7642a91a6a4b", "bc54f7e8b21f3af84d6fe91fe25fae7db3bc0b222992d1bed1873d02feaedae1"],
] as const;

const permissions = {
  acquisition: "approved", storage: "approved", transformation: "approved",
  webDisplay: "approved", androidDisplay: "approved", redistribution: "approved",
} satisfies Source["permissions"];

const chadwick: Source = {
  id: `chadwick:register:${chadwickRevision}`, sourceId: "chadwick-register", publisherId: "chadwick-bureau",
  version: chadwickRevision, url: `https://github.com/chadwickbureau/register/tree/${chadwickRevision}`,
  termsEvidenceUrl: "https://opendatacommons.org/licenses/by/1-0/", verifiedAt: reviewedAt, permissions,
};

export const apbcIdentitySources: Source[] = [
  chadwick,
  ...reviewedPlayers.map(([, revision]): Source => ({
    id: `jawiki:player:${revision}`, sourceId: "jawiki-player", publisherId: "japanese-wikipedia",
    version: String(revision), url: `https://ja.wikipedia.org/w/index.php?oldid=${revision}`, termsEvidenceUrl: wikiLicense,
    verifiedAt: reviewedAt, permissions,
  })),
];

export const apbcIdentities: Edition["identities"] = reviewedPlayers.map(
  ([pageId, revision, npbId, canonicalPlayerId, chadwickId, wikiSha256]) => {
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
      review: { result: "verified", reviewer: "Baseball Notes", reviewedAt,
        rationale: "The fixed player article and Chadwick key_npb identify a unique verified NPB Directory ID; key_uuid matches the existing bridge." },
    };
  },
);
