import type { NpbJapanSeries } from "../domain/npb-japan-series";
import release from "./npb-japan-series-box-scores.json";
import identities from "./npb-japan-series-player-links.json";

export type JapanSeriesBoxScore = (typeof release.boxes)[number];
type BoxTeam = JapanSeriesBoxScore["teams"][number];
type BoxRole = "batting" | "pitching";
type PlayerGame = { box: JapanSeriesBoxScore; teamId: string; side: "away" | "home" } & (
  { role: "batting"; stats: BoxTeam["batting"][number] } |
  { role: "pitching"; stats: BoxTeam["pitching"][number] }
);

export const japanSeriesBoxScoreLicense = release.source.license;
export const japanSeriesBoxScoreSource = `https://ja.wikipedia.org/w/index.php?curid=${release.source.pageId}&oldid=${release.source.revision}`;
export const japanSeriesIdentitySource = `https://github.com/chadwickbureau/register/tree/${identities.chadwick.revision}`;
const players = release.source.contentSha256 === identities.boxSourceSha256 ? identities.players : [];
const rowKey = (teamId: string, role: string, label: string) => `${teamId}|${role}|${label}`;
const byRow = new Map(players.flatMap(player =>
  player.entries.map(entry => [rowKey(entry.teamId, entry.role, entry.name), player.playerId] as const)));

export const admittedJapanSeriesScopes = players.map(player => ({
  playerId: player.playerId, season: 2026, stage: "japan_series" as const,
}));

export function japanSeriesPlayerId(teamId: string, role: BoxRole, recordedName: string) {
  return byRow.get(rowKey(teamId, role, recordedName));
}

export function japanSeriesBoxScore(data: NpbJapanSeries, gameId: string): JapanSeriesBoxScore | undefined {
  if (data.series.id !== release.seriesId) return;
  const box = release.boxes.find(entry => entry.gameId === gameId);
  const game = data.series.games.find(entry => entry.gameId === gameId);
  const result = data.results.find(entry => entry.gameId === gameId);
  if (!box || !game || game.status !== "final" || game.date !== box.date || game.gameNumber !== box.gameNumber ||
    game.awayTeamId !== box.teams[0]?.teamId || game.homeTeamId !== box.teams[1]?.teamId ||
    game.awayRuns !== box.awayRuns || game.homeRuns !== box.homeRuns ||
    result?.evidenceSha256 !== box.resultEvidenceSha256) return;
  return box;
}

export function japanSeriesPlayerGames(data: NpbJapanSeries, playerId: string, role: BoxRole) {
  const games: PlayerGame[] = [];
  for (const game of data.series.games) {
    const box = japanSeriesBoxScore(data, game.gameId);
    if (!box) continue;
    for (const [index, team] of box.teams.entries()) {
      const matches = (row: { name: string }) => japanSeriesPlayerId(team.teamId, role, row.name) === playerId;
      const context = { box, teamId: team.teamId, side: index === 0 ? "away" as const : "home" as const };
      if (role === "batting") {
        const stats = team.batting.find(matches);
        if (stats) games.push({ ...context, role, stats });
      } else {
        const stats = team.pitching.find(matches);
        if (stats) games.push({ ...context, role, stats });
      }
    }
  }
  return games;
}
