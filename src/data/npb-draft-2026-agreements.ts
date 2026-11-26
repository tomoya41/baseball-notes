import type { DraftEvent } from "../domain/npb-draft-event";

// Dates are from the reviewed Japanese Wikipedia revisions (CC BY-SA 4.0).
// The club/university pages independently confirm the dated event.
export const reviewedDraftAgreements = [
  {
    candidateId: "npb:draft:2026:cc5344219d7793c2c2ee82bd", selectionSha256: "257e92e7aa5d19a754f6830433dc417bbde7751c60a121806128ba34cb954952",
    article: "池田聖摩", teamId: "npb:team:giants", round: 3, date: "2026-11-13",
    source: { pageId: 5320379, revision: 111778970, contentSha256: "b3ff8ee98f58c80e2da23396e0f9bbbf4303e0a4e37f149cf52f07f211ff0b67" },
    verification: { url: "https://www.giants.jp/news/31754/", label: "球団発表" },
  },
  {
    candidateId: "npb:draft:2026:3f2ba0cfa62d5ff549e68849", selectionSha256: "161d68ed1217434dfc53bb35b5282f914008c56b594b0401671bd700fd79ab0e",
    article: "伊藤櫂人", teamId: "npb:team:giants", round: 5, date: "2026-11-11",
    source: { pageId: 5318806, revision: 111731642, contentSha256: "5e11c4fe807fd516c7b431edc695a664186d43f1479e5793a9c9325472bd0fe0" },
    verification: { url: "https://www.giants.jp/news/31721/", label: "球団発表" },
  },
  {
    candidateId: "npb:draft:2026:fa671ce93365fa05cb756fec", selectionSha256: "22e76d23bea6dbb5f94ee982c82fe984a99e225107bfd9294eab487ec462a0ed",
    article: "宮原廉", teamId: "npb:team:dragons", round: 1, date: "2026-11-16",
    source: { pageId: 5321032, revision: 111794321, contentSha256: "b7c08bbdf813b0b2e4b5b1902461368bf458dc00ec586da9ad2275b380dbd949" },
    verification: { url: "https://www.dragons.jp/news/2026/26111602.php", label: "球団発表" },
  },
  {
    candidateId: "npb:draft:2026:55b0893090c6d35373c82f32", selectionSha256: "50498cd359fb1060fa4527734d06e33616213948a5cc84bda76adfc319fb179d",
    article: "柴崎聖人", teamId: "npb:team:dragons", round: 2, date: "2026-11-12",
    source: { pageId: 5319173, revision: 111742899, contentSha256: "0bd4059c91c2dd66f72806208fb7ffed6ded2d1cbc322ff2b388603a784ff4a9" },
    verification: { url: "https://www.dragons.jp/news/2026/26111201.php", label: "球団発表" },
  },
  {
    candidateId: "npb:draft:2026:5394654ba04ff8803b69d5d7", selectionSha256: "db794b74428ff6c5d70507826bd74e229720d47d4c2db275d608bbe2f8b42ca5",
    article: "角田楓斗", teamId: "npb:team:buffaloes", round: 1, date: "2026-11-10",
    source: { pageId: 5318349, revision: 111779646, contentSha256: "6a98355c22104daf8d4708fffd67db1b0c588d77addd0dacbe6cb3a658c7cbe4" },
    verification: { url: "https://www.fuji-u.ac.jp/%E3%82%B5%E3%83%BC%E3%82%AF%E3%83%AB/5493/", label: "富士大学の発表" },
  },
  {
    candidateId: "npb:draft:2026:ddebfcf8ac8fd8f97ba344c8", selectionSha256: "ed48b70adeb8d580a5bbab2586c066c2bb557402d57ada821a8132f44cb3ac6d",
    article: "平田玲翔", teamId: "npb:team:giants", round: 2, date: "2026-11-15",
    source: { pageId: 5320571, revision: 111788031, contentSha256: "d0fcf6816347e40fdb39734d2e62a318a7d451b448d4826036fe55ece6e4d3ff" },
    verification: { url: "https://www.giants.jp/news/31758/", label: "球団発表" },
  },
] as const;
export type DraftAgreement = (typeof reviewedDraftAgreements)[number];

export function draftAgreements(data: Pick<DraftEvent, "eventState" | "candidates" | "selections">) {
  const agreements = new Map<string, DraftAgreement>();
  if (data.eventState !== "ended") return agreements;
  for (const record of reviewedDraftAgreements) {
    const selection = data.selections.find(row => row.candidateId === record.candidateId);
    const candidate = data.candidates.find(row => row.id === record.candidateId);
    if (selection?.evidenceSha256 === record.selectionSha256 && selection.teamId === record.teamId &&
        selection.type === "regular" && selection.round === record.round && candidate?.article === record.article) {
      agreements.set(record.candidateId, record);
    }
  }
  return agreements;
}
