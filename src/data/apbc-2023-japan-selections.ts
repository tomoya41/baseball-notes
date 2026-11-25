// Japanese Wikipedia contributors, revisions 111407169 and 111760584 (CC BY-SA 4.0).
// Selection and appearance facts were checked against the official announcements and box scores.
import { apbc2023Id, apbc2023Revision } from "./apbc-2023-pitching";

export const apbc2023SelectionRevision = "111407169";
export const apbc2023SelectionVerifiedAt = "2026-11-25T12:25:40Z";
const tournamentId = apbc2023Id;
const teamId = "international:team:jpn";
const player = (pageId: number) => "international:player:jawiki:" + pageId;
const selected = [
  [4236478, "早川隆久", "投手"],
  [4463322, "隅田知一郎", "投手"],
  [4472177, "赤星優志", "投手"],
  [4486288, "佐藤隼輔", "投手"],
  [4050017, "横山陸人", "投手"],
  [4655368, "吉村貢司郎", "投手"],
  [2868818, "田口麗斗", "投手"],
  [4012741, "及川雅貴", "投手"],
  [4468993, "桐敷拓馬", "投手"],
  [3508043, "今井達也", "投手"],
  [3750723, "清水達也", "投手"],
  [4283150, "根本悠楓", "投手"],
  [4490453, "古賀悠斗", "捕手"],
  [3586306, "坂倉将吾", "捕手"],
  [3870792, "石橋康太", "捕手"],
  [4240485, "牧秀悟", "内野手"],
  [3886550, "野村佑希", "内野手"],
  [4237419, "佐藤輝明", "内野手"],
  [4524575, "野口智哉", "内野手"],
  [4741578, "門脇誠", "内野手"],
  [3858983, "小園海斗", "内野手"],
  [3858954, "藤原恭大", "外野手"],
  [4037204, "森下翔太", "外野手"],
  [4257495, "秋広優人", "外野手"],
  [4044268, "岡林勇希", "外野手"],
  [3886554, "万波中正", "外野手"],
] as const;

export const apbc2023Selections = selected.map(([pageId, name, position]) => ({
  id: player(pageId), name, position, date: pageId === 3886550 ? "2023-11-06" : "2023-10-24",
}));

const games = [
  { date: "2023-11-16", sides: "jpn-tpe", record: "GAME2", winningPitcher: 4283150,
    hitters: [4037204], fieldPlayers: [4044268, 3858983, 4037204, 4240485, 4237419, 3886554, 3586306, 4741578, 3886550] },
  { date: "2023-11-17", sides: "kor-jpn", record: "GAME4", winningPitcher: 4463322,
    hitters: [3886554], fieldPlayers: [4044268, 3858983, 4037204, 4240485, 4237419, 3886554, 3586306, 4741578, 3886550] },
  { date: "2023-11-18", sides: "jpn-aus", record: "GAME5", winningPitcher: 4236478,
    hitters: [], fieldPlayers: [3858954, 3870792, 3858983, 3886554, 4237419, 4257495, 4524575, 3886550, 4741578, 4490453] },
  { date: "2023-11-19", sides: "kor-jpn", record: "決勝", winningPitcher: 4655368,
    hitters: [4240485], fieldPlayers: [3858954, 3858983, 4490453, 4240485, 3586306, 3886554, 4741578, 4237419, 4044268] },
] as const;

const gameKey = (date: string, sides: string) => "international:game:apbc:2023:" + date + ":" + sides;
export const apbc2023AdditionalAppearances = games.flatMap(({ date, sides, fieldPlayers }) =>
  fieldPlayers.map(pageId => ({ kind: "appeared", competition: "international", tournamentId, teamId,
    playerId: player(pageId), gameId: gameKey(date, sides), date,
    source: { sourceRevisionId: apbc2023SelectionRevision, sourceRecordId: date + "/打順・捕手" },
  })));

export const apbc2023Highlights = games.map(({ date, sides, record, winningPitcher, hitters }) => ({
  gameId: gameKey(date, sides), teamId, winningPitcherId: player(winningPitcher),
  ...(hitters.length === 0 ? { noHomeRuns: true as const } : {}),
  homeRuns: hitters.map(pageId => ({ playerId: player(pageId), count: 1 })),
  source: { sourceRevisionId: String(apbc2023Revision), sourceRecordId: record + "/本塁打・勝利投手" },
}));

export const apbc2023Mvp = { teamId, playerId: player(4741578),
  source: { sourceRevisionId: String(apbc2023Revision), sourceRecordId: "表彰選手/最優秀選手" } };
