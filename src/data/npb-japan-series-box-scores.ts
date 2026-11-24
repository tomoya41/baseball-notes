import type { NpbJapanSeries } from "../domain/npb-japan-series";
import release from "./npb-japan-series-box-scores.json";

export type JapanSeriesBoxScore = (typeof release.boxes)[number];

export const japanSeriesBoxScoreLicense = release.source.license;
export const japanSeriesBoxScoreSource = `https://ja.wikipedia.org/w/index.php?curid=${release.source.pageId}&oldid=${release.source.revision}`;

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
