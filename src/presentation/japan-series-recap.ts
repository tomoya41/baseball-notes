import type { NpbJapanSeries } from "../domain/npb-japan-series";

type Game = NpbJapanSeries["series"]["games"][number];
type ScoringHalf = { teamId: string; inning: number; half: "表" | "裏"; runs: number; comeback: boolean };

/** Existing conditional dates cease to be required, not missing/zero results. */
export function japanGameNotRequired(data: NpbJapanSeries, game: Game) {
  const lastFinal = data.series.games.filter(g => g.status === "final").at(-1);
  return data.series.clinched && !!lastFinal && game.gameNumber > lastFinal.gameNumber &&
    (game.status === "scheduled" || game.status === "cancelled");
}

/** Only admitted final scores/innings; never player performance or a causal play narrative. */
export function japanSeriesRecap(data: NpbJapanSeries) {
  const { games, clinched, winnerId, teams, winsRequired } = data.series;
  const closingGame = games.filter(g => g.status === "final").at(-1);
  const opponentId = teams.find(t => t.teamId !== winnerId)?.teamId;
  if (!clinched || !winnerId || !closingGame || !opponentId) return null;

  const played = games.filter(g => g.gameNumber <= closingGame.gameNumber);
  if (played.length !== closingGame.gameNumber) return null;
  const sum = (innings: readonly number[]) => innings.reduce((total, runs) => total + runs, 0);
  let winnerRuns = 0, opponentRuns = 0, oneRunGames = 0;
  const results = [];
  for (const game of played) {
    const { homeRuns, awayRuns } = game;
    const result = data.results.find(r => r.gameId === game.gameId);
    if (game.status !== "final" || homeRuns === null || awayRuns === null || !result ||
        result.homeInnings.length !== result.awayInnings.length ||
        sum(result.homeInnings) !== homeRuns || sum(result.awayInnings) !== awayRuns) return null;
    const winnerAtHome = game.homeTeamId === winnerId;
    winnerRuns += winnerAtHome ? homeRuns : awayRuns;
    opponentRuns += winnerAtHome ? awayRuns : homeRuns;
    if (Math.abs(homeRuns - awayRuns) === 1) oneRunGames++;
    results.push(result);
  }
  const wins = played.filter(g => g.winnerId === winnerId).length;
  if (wins !== winsRequired) return null;
  const losses = played.filter(g => g.winnerId === opponentId).length;
  const ties = played.length - wins - losses;
  const result = results.at(-1)!;
  const scoring: ScoringHalf[] = [];
  let away = 0, home = 0;
  for (const [index, awayHalf] of result.awayInnings.entries()) {
    const inning = index + 1;
    if (awayHalf) scoring.push({ teamId: closingGame.awayTeamId, inning, half: "表", runs: awayHalf, comeback: away < home && away + awayHalf > home });
    away += awayHalf;
    if (inning === result.homeInnings.length && result.homeLastInning === "not_played") continue;
    const homeHalf = result.homeInnings[index]!;
    if (homeHalf) scoring.push({ teamId: closingGame.homeTeamId, inning, half: "裏", runs: homeHalf, comeback: home < away && home + homeHalf > away });
    home += homeHalf;
  }
  const turn = scoring.filter(f => f.teamId === winnerId && f.comeback).at(-1) ?? null;
  const firstNonExtra = results.findIndex(r => r.awayInnings.length <= 9);
  return {
    winnerId, opponentId, wins, losses, ties, games: played.length, winnerRuns, opponentRuns, oneRunGames,
    extraInningGames: results.filter(r => r.awayInnings.length > 9).length,
    firstExtraStreak: firstNonExtra < 0 ? played.length : firstNonExtra,
    closingGame, firstScore: scoring[0] ?? null, turn,
    following: turn ? scoring.slice(scoring.indexOf(turn) + 1).filter(f => f.teamId === winnerId) : [],
  };
}
