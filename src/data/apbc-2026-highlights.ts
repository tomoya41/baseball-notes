// Adapted from English Wikipedia revision 1385998229, CC BY-SA 4.0.
// Each game row was checked against the corresponding official box score.
const sourceRevisionId = "1385998229";
const teamId = "international:team:jpn";
const player = (id: number) => `international:player:jawiki:${id}`;
const masaki = 4450526, muneyama = 4980856;

const games = [
  { date: "2026-11-12", sides: "jpn-tpe", winningPitcher: 4977707, hitters: [[masaki, 2], [muneyama, 1]], officialGame: "20261112_2" },
  { date: "2026-11-13", sides: "kor-jpn", winningPitcher: 4847158, hitters: [[masaki, 1], [5156099, 1], [muneyama, 2]], officialGame: "20261113_2" },
  { date: "2026-11-14", sides: "jpn-aus", winningPitcher: 4847462, hitters: [[muneyama, 1], [masaki, 1], [4989729, 1]], officialGame: "20261114_1" },
  { date: "2026-11-15", sides: "kor-jpn", winningPitcher: 4251765, hitters: [[4989301, 1], [masaki, 1]], officialGame: "20261115_2" },
] as const;

export const apbc2026Highlights = games.map(({ date, sides, winningPitcher, hitters }) => ({
  gameId: `international:game:apbc:2026:${date}:${sides}`,
  teamId,
  winningPitcherId: player(winningPitcher),
  homeRuns: hitters.map(([id, count]) => ({ playerId: player(id), count })),
  source: { sourceRevisionId, sourceRecordId: `Games/${date}/JPN home runs and winning pitcher` },
}));
export const apbc2026Mvp = { teamId, playerId: player(muneyama), source: { sourceRevisionId, sourceRecordId: "Awards/MVP" } };
export const apbc2026OfficialBoxes = new Map(games.map(({ date, officialGame }) =>
  [date, `https://www.japan-baseball.jp/jp/team/topteam/score/${officialGame}/`]));
