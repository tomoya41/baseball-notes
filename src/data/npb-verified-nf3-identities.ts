// Manually verified same-name identity exception. The nf3 profile links to the
// NPB player page below; the Swallows' J. Osuna is a different person.
export const verifiedNf3Identities = [
  {
    sourceId: "2026:F:uniform:2", playerId: "79e33d14-9021-4db8-a976-74c9d02df328",
    name: "マルティネス", teamId: "npb:team:fighters",
    profileUrl: "https://nf3.sakura.ne.jp/Pacific/F/f/2_stat.htm",
    officialProfileUrl: "https://npb.jp/bis/players/73975136.html", verifiedAt: "2026-09-27",
    note: "Ariel Martinez, Fighters catcher #2, birth 1996-05-28; distinct from Giants pitcher R. Martinez, NPB 23925134.",
  },
  {
    sourceId: "2026:DB:profile:tr_H_50", playerId: "d4f78de4-1e08-4f51-9f18-9e064968866f",
    existingCanonical: true, canonicalTeamId: "npb:team:hawks",
    name: "山本祐大", teamId: "npb:team:baystars",
    profileUrl: "https://nf3.sakura.ne.jp/Central/DB/f/tr_H_50_stat.htm",
    officialProfileUrl: "https://npb.jp/bis/players/23125136.html", verifiedAt: "2026-09-27",
    note: "Old DeNA #50 and current Hawks #39 nf3 profiles both link to NPB 23125136. Preserve existing Hawks canonical master and past DeNA Fact team.",
  },
  {
    sourceId: "2026:G:profile:tr_L_59", playerId: "3095455f-01b8-452a-9b8a-fdd8991bfba3",
    canonicalTeamId: "npb:team:lions", name: "若林楽人", teamId: "npb:team:giants",
    profileUrl: "https://nf3.sakura.ne.jp/Central/G/f/tr_L_59_stat.htm",
    officialProfileUrl: "https://npb.jp/bis/players/53555153.html", verifiedAt: "2026-09-27",
    note: "Old Giants #59 links to NPB 53555153, current Lions #49. Not yet in saved master at baseline; one reviewed canonical identity for both source aliases.",
  },
  {
    sourceId: "2026:L:uniform:49", playerId: "3095455f-01b8-452a-9b8a-fdd8991bfba3",
    existingCanonical: true, name: "若林楽人", teamId: "npb:team:lions",
    profileUrl: "https://nf3.sakura.ne.jp/Pacific/L/f/49_stat.htm",
    officialProfileUrl: "https://npb.jp/bis/players/53555153.html", verifiedAt: "2026-09-27",
    note: "Lions source alias for the already reviewed NPB 53555153 identity, created by chronological historical backfill.",
  },
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
