import type { GameIndexRow, GameDateIndex } from "./npb-game-index";
import type { PostseasonSeries } from "./competition";

export function tokyoToday(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(k => parts.find(p => p.type === k)!.value).join("-");
}
export function dailyGames(today: string, pages: readonly GameDateIndex[], effectiveDate: string) {
  const current = pages.find(p => p.date === today);
  const unique = [...new Map(pages.flatMap(p => p.games).map(g => [g.gameId, g])).values()];
  const chronological = (a: GameIndexRow, b: GameIndexRow) => a.date.localeCompare(b.date) || (a.scheduledTime ?? "99:99").localeCompare(b.scheduledTime ?? "99:99") || a.gameNumber - b.gameNumber || a.gameId.localeCompare(b.gameId);
  return {
    today: current ? [...current.games].sort(chronological) : [],
    todayState: current ? current.games.length ? "games" : current.coverage === "no_games" ? "no_games" : "unconfirmed" : "unavailable",
    next: unique.filter(g => g.status === "scheduled" && g.date > today).sort(chronological),
    recent: unique.filter(g => g.status === "final" && g.date < today && g.date <= effectiveDate).sort((a, b) => -chronological(a, b)),
  };
}
export type RecapBatter = { playerId: string; name: string; teamId: string; hits: number | null; homeRuns: number | null; rbi: number | null; pa: number | null };
export type RecapPitcher = { playerId: string; name: string; teamId: string; outs: number | null; runs: number | null; so: number | null };
export function recapNumbers(batting: readonly RecapBatter[], pitching: readonly RecapPitcher[]) {
  return {
    batting: batting.filter(p => (p.hits !== null && p.hits >= 2) || (p.homeRuns !== null && p.homeRuns > 0))
      .sort((a, b) => (b.homeRuns ?? 0) - (a.homeRuns ?? 0) || (b.hits ?? 0) - (a.hits ?? 0) || a.playerId.localeCompare(b.playerId)),
    pitching: pitching.filter(p => p.outs !== null && p.runs !== null && (p.outs >= 18 && p.runs <= 1 || p.outs >= 3 && p.runs === 0))
      .sort((a, b) => (b.outs ?? 0) - (a.outs ?? 0) || a.playerId.localeCompare(b.playerId)),
  };
}
/** Standing at this exact Game, not the eventual Series outcome. */
export function seriesAfterGame(series: PostseasonSeries, gameId: string) {
  const index = series.games.findIndex(g => g.gameId === gameId);
  if (index < 0 || series.games[index]!.status !== "final") return null;
  const games = series.games.slice(0, index + 1);
  if (games.some(g => g.status !== "final")) return null;
  return series.teams.map(t => ({ teamId: t.teamId, played: games.filter(g => g.winnerId === t.teamId).length, advantage: t.advantageWins,
    total: games.filter(g => g.winnerId === t.teamId).length + t.advantageWins }));
}
export const dailyProductCapabilities = {
  NPB: { today: true, preview: true, recap: true, teamFavorites: true, recentFavorites: true, historicalOnly: false },
  MLB: { today: false, preview: false, recap: true, teamFavorites: true, recentFavorites: true, historicalOnly: true },
} as const;
