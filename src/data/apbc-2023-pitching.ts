// Japanese Wikipedia contributors, revision 111760584 (CC BY-SA 4.0).
// Pitcher innings and opponent line scores agree with the four official box scores.
export const apbc2023Id = "international:tournament:apbc:2023";
export const apbc2023Revision = 111760584;

const japan = "international:team:jpn";
const playerId = (pageId: number) => `international:player:jawiki:${pageId}`;
const source = (sourceRecordId: string) => ({ sourceRevisionId: String(apbc2023Revision), sourceRecordId });
export const apbc2023PitcherNames = new Map([
  [playerId(4472177), "赤星優志"], [playerId(4012741), "及川雅貴"], [playerId(4283150), "根本悠楓"],
  [playerId(4468993), "桐敷拓馬"], [playerId(2868818), "田口麗斗"], [playerId(4463322), "隅田知一郎"],
  [playerId(4050017), "横山陸人"], [playerId(4236478), "早川隆久"], [playerId(4655368), "吉村貢司郎"],
  [playerId(4486288), "佐藤隼輔"], [playerId(3750723), "清水達也"], [playerId(3508043), "今井達也"],
]);

const games = [
  { date: "2023-11-16", sides: "jpn-tpe", record: "GAME2", side: "RSP", teamOuts: 27, box: "20231116_2",
    pitchers: [[4472177, 14], [4012741, 1], [4283150, 6], [4468993, 3], [2868818, 3]] },
  { date: "2023-11-17", sides: "kor-jpn", record: "GAME4", side: "HSP", teamOuts: 27, box: "20231117_2",
    pitchers: [[4463322, 21], [4050017, 3], [2868818, 3]] },
  { date: "2023-11-18", sides: "jpn-aus", record: "GAME5", side: "RSP", teamOuts: 24, box: "20231118_1",
    pitchers: [[4236478, 15], [4655368, 5], [4486288, 1], [3750723, 3]] },
  { date: "2023-11-19", sides: "kor-jpn", record: "決勝", side: "HSP", teamOuts: 30, box: "20231119_2",
    pitchers: [[3508043, 12], [4283150, 9], [4468993, 3], [2868818, 3], [4655368, 3]] },
] as const;

const gameId = (date: string, sides: string) => `international:game:apbc:2023:${date}:${sides}`;
export const apbc2023GamePitching = games.map(({ date, sides, record, side, teamOuts, pitchers }) => ({
  gameId: gameId(date, sides), teamId: japan, source: source(`${record}/${side}`), teamOuts,
  teamOutsSource: source(`${record}/対戦相手のイニングスコア`),
  pitchers: pitchers.map(([pageId, outs]) => ({ playerId: playerId(pageId), outs })),
}));

export const apbc2023PitcherAppearances = games.flatMap(({ date, sides, record, side, pitchers }) =>
  pitchers.map(([pageId]) => ({ kind: "appeared", competition: "international", tournamentId: apbc2023Id,
    teamId: japan, playerId: playerId(pageId), gameId: gameId(date, sides), date, source: source(`${record}/${side}`) })));

export const apbc2023OfficialBoxes = new Map(games.map(({ date, box }) =>
  [date, `https://www.japan-baseball.jp/jp/team/topteam/score/${box}/table.html`] as [string, string]));
