import { apbc2026Id } from "./apbc-2026-player-identities";

// Japanese Wikipedia contributors, revision 111828931 (CC BY-SA 4.0).
// The pitchers and catchers were checked against the four official game records.
export const apbc2026BatteryRevision = "111828931";
export const apbc2026Batteries = [
  { date: "2026-11-12", sides: "jpn-tpe", record: "GAME2/RSP",
    pitchers: [4977707, 4847158, 4993682], catchers: [5156099, 4666647] },
  { date: "2026-11-13", sides: "kor-jpn", record: "GAME4/HSP",
    pitchers: [5169029, 4859137, 5161252, 4274936, 4847158, 4997978], catchers: [5156099] },
  { date: "2026-11-14", sides: "jpn-aus", record: "GAME5/RSP",
    pitchers: [4832529, 4847462, 5144198, 4037049], catchers: [5156099, 4847310] },
  { date: "2026-11-15", sides: "kor-jpn", record: "決勝/HSP",
    pitchers: [4251765, 4859137, 4997978], catchers: [5156099] },
] as const;

export const apbc2026BatteryAppearances = apbc2026Batteries.flatMap(({ date, sides, record, pitchers, catchers }) =>
  [...pitchers, ...catchers].map(pageId => ({
    kind: "appeared", competition: "international", tournamentId: apbc2026Id, teamId: "international:team:jpn",
    playerId: `international:player:jawiki:${pageId}`, gameId: `international:game:apbc:2026:${date}:${sides}`, date,
    source: { sourceRevisionId: apbc2026BatteryRevision, sourceRecordId: record },
  })));
