// Adapted from English Wikipedia revisions 1370352167 (pool) and 1378823437 (knockout), CC BY-SA 4.0.
// The game dates follow the venues; the Japanese official page for the quarterfinal uses JST.
const player = (id: number) => `international:player:jawiki:${id}`;
const ohtani = 5145471, yoshida = 3325410;
const poolRevision = "1370352167", knockoutRevision = "1378823437";
const games = [
  { date: "2026-03-06", sides: "jpn-tpe", revision: poolRevision, winningPitcher: 3610515, hitters: [[ohtani, 1]], officialGame: "20260306_1" },
  { date: "2026-03-07", sides: "kor-jpn", revision: poolRevision, winningPitcher: 3692477, hitters: [[2721293, 2], [ohtani, 1], [yoshida, 1]], officialGame: "20260307_1" },
  { date: "2026-03-08", sides: "aus-jpn", revision: poolRevision, winningPitcher: 4463322, hitters: [[yoshida, 1]], officialGame: "20260308_1" },
  { date: "2026-03-10", sides: "cze-jpn", revision: poolRevision, winningPitcher: 4977707, hitters: [[3700545, 1], [3787489, 1]], officialGame: "20260310_1" },
  { date: "2026-03-14", sides: "ven-jpn", revision: knockoutRevision, losingPitcher: 4237529, hitters: [[ohtani, 1], [4037204, 1]], officialGame: "20260315_1" },
] as const;

export const wbc2026JapanHighlights = games.map(game => ({
  gameId: `international:game:wbc:2026:${game.date}:${game.sides}`,
  teamId: "international:team:jpn",
  ...("winningPitcher" in game ? { winningPitcherId: player(game.winningPitcher) } : { losingPitcherId: player(game.losingPitcher) }),
  homeRuns: game.hitters.map(([id, count]) => ({ playerId: player(id), count })),
  source: { sourceRevisionId: game.revision,
    sourceRecordId: `Games/${game.date}/JPN home runs and ${"winningPitcher" in game ? "winning" : "losing"} pitcher` },
}));
export const wbc2026OfficialBoxes = new Map(games.map(({ date, officialGame }) =>
  [date, `https://www.japan-baseball.jp/jp/team/topteam/score/${officialGame}/table.html`]));
