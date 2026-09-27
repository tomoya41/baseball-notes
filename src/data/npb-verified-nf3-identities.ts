// Manually verified same-name identity exception. The nf3 profile links to the
// NPB player page below; the Swallows' J. Osuna is a different person.
export const verifiedNf3Identities = [
  {
    sourceId: "2026:E:uniform:21",
    existingCanonical: true,
    playerId: "a66dfd52-1ae2-4245-b849-558f263e6422",
    name: "早川隆久",
    teamId: "npb:team:eagles",
    profileUrl: "https://nf3.sakura.ne.jp/Pacific/E/p/21_stat.htm",
    officialProfileUrl: "https://npb.jp/bis/players/31835153.html",
    verifiedAt: "2026-09-27",
    note: "nf3 #21 pitcher links to NPB 31835153; Eagles, left-handed, birth 1998-07-06 matches existing verified canonical master. No new Player.",
  },
  {
    sourceId: "2026:H:uniform:54",
    playerId: "a4d2116b-07d3-4a7a-8f8e-32f6d28759e4",
    name: "オスナ",
    teamId: "npb:team:hawks",
    profileUrl: "https://nf3.sakura.ne.jp/Pacific/H/p/54_stat.htm",
    officialProfileUrl: "https://npb.jp/bis/players/13415155.html",
    verifiedAt: "2026-09-27",
    note: "R. Osuna (Roberto), Hawks pitcher #54; distinct from J. Osuna, Swallows infielder #13.",
  },
] as const;
