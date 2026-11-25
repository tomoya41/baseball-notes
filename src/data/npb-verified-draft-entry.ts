// The reviewed Japanese Wikipedia revisions are licensed CC BY-SA 4.0.
export const draftEntrySource = {
  revision: 111790323,
  pageId: 5129630,
  contentSha256: "e55619dbffe6afdc8aa3b5760630d35c52a5a4e00bb71372e4de0889e1f166f2",
  licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
  draftYear: 2025,
  firstSeason: 2026,
} as const;

// Limited to individual entries confirmed by the draft table, the player articles and official records.
export const draftEntries = [
  { playerId: "08bbf73b-0468-4e24-b3f9-83acaa0b255a", npbId: "91295152", wikidataId: "Q136653077",
    teamId: "npb:team:tigers", draftClubCode: "t", affiliationAtDraft: "創価大学", profileRevision: 111543816,
    entryVerification: "https://score.hanshintigers.jp/news/topics/info_10610.html",
    debut: { date: "2026-05-19", gameId: "npb:game:fb960af5c92f42703c66", role: "batting", boxSide: "home", officialBox: "t-d-10" } },
  { playerId: "ae44f92d-c4be-4d52-a5ab-aa44f323b67b", npbId: "41745152", wikidataId: "Q136653733",
    teamId: "npb:team:lions", draftClubCode: "l", affiliationAtDraft: "明治大学", profileRevision: 111898458,
    entryVerification: "https://www.seibulions.jp/news/detail/202600630138.html",
    debut: { date: "2026-03-27", gameId: "npb:game:79f9584fdfe1f58de72a", role: "batting", boxSide: "away", officialBox: "m-l-01" } },
  { playerId: "3bb0dc41-ed94-4226-ad54-cf66e0ad77af", npbId: "51455152", wikidataId: "Q136693680",
    teamId: "npb:team:dragons", draftClubCode: "d", affiliationAtDraft: "青山学院大学", profileRevision: 111651013,
    entryVerification: "https://dragons.jp/teamdata/draft/2025/nakanishi_m.php",
    debut: { date: "2026-04-01", gameId: "npb:game:5c780a80ae86511e9b7c", role: "pitching", boxSide: "home", officialBox: "d-g-02" } },
  { playerId: "230bcba0-ff13-4df1-b1d4-5d890e9c55aa", npbId: "61865152", wikidataId: "Q136926284",
    teamId: "npb:team:swallows", draftClubCode: "s", affiliationAtDraft: "法政大学", profileRevision: 111889979,
    entryVerification: "https://www.yakult-swallows.co.jp/news/detail/31774",
    debut: { date: "2026-05-29", gameId: "npb:game:74d67b5fb51c408cb709", role: "batting", boxSide: "away", officialBox: "e-s-01" } },
  { playerId: "485d1cb9-2a4f-4782-afe5-fc2857409088", npbId: "61165152", wikidataId: "Q138418140",
    teamId: "npb:team:marines", draftClubCode: "m", affiliationAtDraft: "高崎健康福祉大学高崎高", profileRevision: 111655585,
    entryVerification: "https://www.marines.co.jp/news/detail/202500751037.html",
    debut: { date: "2026-09-17", gameId: "npb:game:806cc68b8d00c317beb3", role: "pitching", boxSide: "home", officialBox: "m-e-22" } },
  { playerId: "0b28d983-d75c-49df-b4a4-ecd57ebba488", npbId: "71275152", wikidataId: "Q138411568",
    teamId: "npb:team:giants", draftClubCode: "g", affiliationAtDraft: "鷺宮製作所", profileRevision: 111901926,
    entryVerification: "https://sport.saginomiya.co.jp/topics/2025/11/000781.html",
    debut: { date: "2026-03-27", gameId: "npb:game:d61dde3ea5b7f1413fe7", role: "pitching", boxSide: "home", officialBox: "g-t-01" } },
] as const;

const byPlayer = new Map<string, (typeof draftEntries)[number]>(draftEntries.map(entry => [entry.playerId, entry]));
export function verifiedDraftEntry(playerId: string) {
  return byPlayer.get(playerId);
}

