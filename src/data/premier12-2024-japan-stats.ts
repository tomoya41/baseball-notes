// Wikipedia contributors, revision 111780580, CC BY-SA 4.0.
// IDs are the Japanese Wikipedia page IDs of the linked players.

const batting = [
  [3858956, "辰己涼介", 8, 29, 9, 0, 5],
  [4037204, "森下翔太", 9, 28, 10, 1, 9],
  [2510896, "桑原将志", 8, 29, 6, 0, 1],
  [3858983, "小園海斗", 7, 31, 12, 2, 8],
  [3106727, "栗原陵矢", 7, 23, 6, 0, 5],
  [4240485, "牧秀悟", 8, 29, 7, 1, 8],
  [3581354, "佐野恵太", 8, 28, 9, 0, 2],
  [3586306, "坂倉将吾", 7, 18, 8, 1, 4],
  [3520387, "源田壮亮", 7, 18, 5, 1, 2],
  [4029832, "紅林弘太郎", 6, 18, 5, 0, 5],
  [3521502, "清宮幸太郎", 4, 15, 3, 0, 2],
  [4031306, "佐藤都志也", 3, 11, 5, 0, 3],
  [3304798, "村林一輝", 4, 11, 2, 1, 1],
  [4238507, "五十幡亮汰", 6, 9, 2, 0, 2],
  [4490453, "古賀悠斗", 2, 5, 1, 0, 1],
] as const;

// Pitching innings are expressed as outs.
const pitching = [
  [3528446, "才木浩人", 2, 32, 2, 2, 10],
  [4236478, "早川隆久", 2, 28, 7, 7, 10],
  [3933545, "戸郷翔征", 2, 27, 6, 6, 13],
  [4463322, "隅田知一郎", 4, 24, 2, 2, 16],
  [4251765, "髙橋宏斗", 2, 24, 2, 2, 16],
  [4074931, "井上温大", 3, 24, 6, 6, 12],
  [4490620, "北山亘基", 4, 21, 3, 3, 10],
  [3514754, "藤平尚真", 6, 18, 0, 0, 12],
  [4050017, "横山陸人", 5, 13, 2, 2, 3],
  [4475539, "大勢", 4, 12, 1, 0, 3],
  [3750787, "清水達也", 4, 12, 0, 0, 6],
  [4264331, "鈴木昭汰", 3, 5, 2, 0, 1],
  [3896099, "鈴木翔天", 1, 3, 0, 0, 1],
] as const;

export const premier122024JapanStatsRevision = "111780580";
export const premier122024JapanStatsVerification = {
  throughSuperRound: "https://static.wbsc.org/uploads/federations/0/documents/82f90f98-607b-6a2c-59ba-47dbefdf741f.pdf#page=91",
  final: "https://www.japan-baseball.jp/jp/team/topteam/score/20241124_1/table.html",
};
export const premier122024JapanStats = [
  ...batting.map(([pageId, name, gamesPlayed, atBats, hits, homeRuns, runsBattedIn]) => ({
    role: "batting" as const, pageId, name, gamesPlayed, atBats, hits, homeRuns, runsBattedIn,
  })),
  ...pitching.map(([pageId, name, gamesPlayed, outs, runsAllowed, earnedRuns, strikeouts]) => ({
    role: "pitching" as const, pageId, name, gamesPlayed, outs, runsAllowed, earnedRuns, strikeouts,
  })),
];
