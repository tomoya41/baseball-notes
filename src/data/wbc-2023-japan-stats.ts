// Wikipedia contributors, revision 109739294, CC BY-SA 4.0.
// IDs are the Japanese Wikipedia page IDs of the linked players, not domestic IDs.
const batting = [
  [2459898, "近藤健介", 7, 26, 9, 1, 5],
  [3787489, "村上宗隆", 7, 26, 6, 1, 6],
  [4463972, "ラーズ・ヌートバー", 7, 26, 7, 0, 4],
  [5145471, "大谷翔平", 7, 23, 10, 1, 8],
  [3325410, "吉田正尚", 7, 22, 9, 2, 13],
  [3118995, "岡本和真", 7, 18, 6, 2, 7],
  [2225661, "山田哲人", 6, 15, 4, 0, 2],
  [3520387, "源田壮亮", 5, 12, 3, 0, 2],
  [4240485, "牧秀悟", 6, 15, 3, 2, 2],
  [2232184, "甲斐拓也", 4, 11, 1, 0, 2],
  [4244362, "中野拓夢", 5, 10, 3, 0, 0],
  [1610194, "中村悠平", 5, 7, 3, 0, 1],
  [2893785, "山川穂高", 3, 5, 1, 0, 2],
  [2231674, "牧原大成", 6, 2, 1, 0, 1],
  [3712110, "大城卓三", 3, 2, 0, 0, 0],
  [3700545, "周東佑京", 5, 1, 0, 0, 0],
] as const;
// Pitching innings are expressed as outs. Takahashi’s strikeout count disagrees with the official record.
const pitching = [
  [5145471, "大谷翔平", 3, 29, 2, 2, 11],
  [4012623, "佐々木朗希", 2, 23, 4, 3, 11],
  [3610515, "山本由伸", 2, 22, 2, 2, 12],
  [1276336, "ダルビッシュ有", 3, 18, 5, 4, 2],
  [3322875, "今永昇太", 3, 18, 2, 2, 7],
  [4029818, "宮城大弥", 1, 15, 1, 1, 7],
  [3933545, "戸郷翔征", 2, 15, 1, 1, 9],
  [4475539, "大勢", 4, 12, 0, 0, 3],
  [4251765, "髙橋宏斗", 3, 9, 1, 1, null],
  [3866773, "湯浅京己", 3, 8, 0, 0, 4],
  [4237529, "伊藤大海", 3, 7, 0, 0, 3],
  [3378021, "高橋奎二", 1, 6, 0, 0, 2],
  [4336967, "宇田川優希", 2, 4, 0, 0, 3],
  [2622429, "松井裕樹", 1, 3, 0, 0, 1],
] as const;

export const wbc2023JapanStatsRevision = "109739294";
export const wbc2023JapanStatsVerification = {
  batting: "https://www.mlb.com/world-baseball-classic/stats/japan/2023/",
  pitching: "https://www.mlb.com/world-baseball-classic/stats/pitching/japan/2023/",
};
export const wbc2023JapanStats = [
  ...batting.map(([pageId, name, gamesPlayed, atBats, hits, homeRuns, runsBattedIn]) => ({
    role: "batting" as const, pageId, name, gamesPlayed, atBats, hits, homeRuns, runsBattedIn,
  })),
  ...pitching.map(([pageId, name, gamesPlayed, outs, runsAllowed, earnedRuns, strikeouts]) => ({
    role: "pitching" as const, pageId, name, gamesPlayed, outs, runsAllowed, earnedRuns, strikeouts,
  })),
];
