import type { NpbJapanSeries } from "../domain/npb-japan-series";
import { dateInZone } from "../domain/analysis-query";

/** Editorial prominence, not evidence that any scheduled Game actually took place. */
export function japanSeriesHomePeriod(now: number) {
  const date = dateInZone(now, "Asia/Tokyo");
  return date >= "2026-10-24" && date <= "2026-11-08";
}

export function japanSeriesHomeSummary(data: NpbJapanSeries, now: number) {
  const date = dateInZone(now, "Asia/Tokyo");
  const finals = data.series.games.filter(g => g.status === "final");
  const latest = finals.at(-1) ?? null;
  const next = data.series.clinched ? null : data.series.games.find(g => g.date >= date && (g.status === "scheduled" || g.status === "in_progress")) ?? null;
  // A later final cannot establish the full series standing while earlier Games are missing.
  const through = latest ? data.series.games.filter(g => g.gameNumber <= latest.gameNumber) : [];
  const standingCompleteThroughLatest = !!latest && through.every(g => g.status === "final");
  return { latest, next, finals: finals.length, standingCompleteThroughLatest };
}

export const japanSeriesGameUrl = (id: string) => `/NPB/games/${encodeURIComponent(id)}?season=2026&competition=postseason&stage=japan_series`;

// Curated identification links, not a lineup, probable starters or player-performance ranking.
// Explicit article links in reviewed Japan Series revision 111502352 identify these roster subjects.
export const japanSeriesFeaturedPlayers = [
  { id: "852bed28-a3f1-4b60-8a1f-950cc2947686", teamId: "npb:team:baystars", name: "牧秀悟" },
  { id: "54f9b289-4717-4fb8-b1c3-7c8cf37e2e42", teamId: "npb:team:hawks", name: "近藤健介" },
  { id: "dc165f2e-9539-4ad0-b206-5d75794fee96", teamId: "npb:team:hawks", name: "柳田悠岐" },
] as const;
