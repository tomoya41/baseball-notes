import { apbc2026Id } from "./apbc-2026-player-identities";

// Japanese Wikipedia contributors, revision 111828931 (CC BY-SA 4.0).
// Pitchers, catchers and outs were checked against the four official game records.
// teamOuts is verified from the opponent's completed innings in the line score.
export const apbc2026BatteryRevision = "111828931";
export const apbc2026Batteries = [
  { date: "2026-11-12", sides: "jpn-tpe", record: "GAME2/RSP", teamOuts: 27,
    pitchers: [[4977707, 21], [4847158, 3], [4993682, 3]], catchers: [5156099, 4666647] },
  { date: "2026-11-13", sides: "kor-jpn", record: "GAME4/HSP", teamOuts: 27,
    pitchers: [[5169029, 12], [4859137, 6], [5161252, 3], [4274936, 0], [4847158, 3], [4997978, 3]], catchers: [5156099] },
  { date: "2026-11-14", sides: "jpn-aus", record: "GAME5/RSP", teamOuts: 21,
    pitchers: [[4832529, 12], [4847462, 3], [5144198, 3], [4037049, 3]], catchers: [5156099, 4847310] },
  { date: "2026-11-15", sides: "kor-jpn", record: "決勝/HSP", teamOuts: 27,
    pitchers: [[4251765, 21], [4859137, 3], [4997978, 3]], catchers: [5156099] },
] as const;

const teamId = "international:team:jpn";
const gameId = (date: string, sides: string) => `international:game:apbc:2026:${date}:${sides}`;
const playerId = (pageId: number) => `international:player:jawiki:${pageId}`;
const source = (sourceRecordId: string) => ({ sourceRevisionId: apbc2026BatteryRevision, sourceRecordId });

export const apbc2026BatteryAppearances = apbc2026Batteries.flatMap(({ date, sides, record, pitchers, catchers }) =>
  [...pitchers.map(([pageId]) => pageId), ...catchers].map(pageId => ({
    kind: "appeared", competition: "international", tournamentId: apbc2026Id, teamId,
    playerId: playerId(pageId), gameId: gameId(date, sides), date, source: source(record),
  })));

export const apbc2026GamePitching = apbc2026Batteries.map(({ date, sides, record, teamOuts, pitchers }) => ({
  gameId: gameId(date, sides), teamId, source: source(record), teamOuts,
  teamOutsSource: source(`${record.split("/")[0]}/対戦相手のイニングスコア`),
  pitchers: pitchers.map(([pageId, outs]) => ({ playerId: playerId(pageId), outs })),
}));
