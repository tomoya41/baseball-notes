// Reviewed identity links. Wikidata IDs are source IDs, never canonical IDs.
// NPB/team pages were consulted only to verify identity, not imported as profile data.
export const verifiedPlayerMappings = [
  { playerId: "06a3e027-7a73-4792-9c91-8ecc3c1da36a", wikidataId: "Q124479656",
    name: "中島大輔", teamId: "npb:team:eagles", wikidataTeamId: "Q1375077",
    birthDate: "2001-06-04", expectedBirthPlace: "和歌山県", expectedNationality: "日本",
    expectedPosition: null, newPlayer: false,
    reason: "氏名・楽天所属・生年月日を照合。研究者の同名項目 Q91173348 と区別。" },
  { playerId: "6bf4b271-e16c-43f9-9142-8c7ca7de9887", wikidataId: "Q22117979",
    name: "上原健太", teamId: "npb:team:fighters", wikidataTeamId: "Q974277",
    birthDate: "1994-03-29", expectedBirthPlace: null, expectedNationality: "日本",
    expectedPosition: "P", newPlayer: false,
    reason: "氏名・日本ハム所属・生年月日・投手を照合。同名俳優と区別。" },
  { playerId: "2d760a27-b58a-47a5-80df-6b0aa3571ef5", wikidataId: "Q22118838",
    name: "坂本誠志郎", teamId: "npb:team:tigers", wikidataTeamId: "Q127635",
    birthDate: "1993-11-10", expectedBirthPlace: "兵庫県", expectedNationality: "日本",
    expectedPosition: "C", newPlayer: false,
    reason: "氏名・阪神所属・生年月日・捕手を照合。" },
  { playerId: "a66dfd52-1ae2-4245-b849-558f263e6422", wikidataId: "Q102246615",
    name: "早川隆久", teamId: "npb:team:eagles", wikidataTeamId: "Q1375077",
    birthDate: "1998-07-06", expectedBirthPlace: "横芝光町", expectedNationality: "日本",
    expectedPosition: "P", newPlayer: true,
    reason: "氏名・楽天所属・生年月日・投手を照合。Fact未収集の確認済み選手。" },
] as const;

export const profileVerificationAt = "2026-09-26T01:31:44.000Z";
