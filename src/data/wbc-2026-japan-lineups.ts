// Japanese Wikipedia contributors, fixed revision 110704201, CC BY-SA 4.0.
// The roster IDs are sorted. The source and official box score disagree on the order of two starters on March 8.
export const wbc2026Id = "international:tournament:wbc:2026";
export const wbc2026LineupRevision = "110704201";
const games = [
  { date: "2026-03-06", sides: "jpn-tpe", record: "3月6日",
    starters: [2459898, 2721293, 2959833, 3118995, 3325410, 3520387, 3787489, 4240485, 5145471],
    battery: [2959833, 3327162, 3514754, 3610515, 4029818, 4490620, 4667614] },
  { date: "2026-03-07", sides: "kor-jpn", record: "3月7日",
    starters: [2459898, 2721293, 3118995, 3325410, 3327162, 3520387, 3787489, 4240485, 5145471],
    battery: [1610194, 1940916, 3103993, 3327162, 3692477, 4237529, 4475539] },
  { date: "2026-03-08", sides: "aus-jpn", record: "3月8日",
    starters: [2459898, 2721293, 2959833, 3118995, 3325410, 3520387, 3787489, 4240485, 5145471],
    battery: [1610194, 2293169, 2959833, 3692477, 4463322, 4475539] },
  { date: "2026-03-10", sides: "cze-jpn", record: "3月10日",
    starters: [1610194, 2231674, 3118995, 3325410, 3700545, 3787489, 3858983, 4037204, 4237419],
    battery: [1610194, 4029818, 4251765, 4490620, 4977707] },
  { date: "2026-03-14", sides: "ven-jpn", record: "準々決勝",
    starters: [2721293, 2959833, 3118995, 3325410, 3520387, 3787489, 4237419, 4240485, 5145471],
    battery: [1940916, 2959833, 3514754, 3610515, 3692477, 4237529, 4463322] },
] as const;

export const wbc2026LineupAppearances = games.flatMap(({ date, sides, record, starters, battery }) =>
  [...new Set<number>([...starters, ...battery])].map(pageId => ({
    kind: "appeared", competition: "international", tournamentId: wbc2026Id, teamId: "international:team:jpn",
    playerId: `international:player:jawiki:${pageId}`, gameId: `international:game:wbc:2026:${date}:${sides}`, date,
    source: { sourceRevisionId: wbc2026LineupRevision, sourceRecordId: `試合結果/${record}/先発・バッテリー` },
  })),
);
