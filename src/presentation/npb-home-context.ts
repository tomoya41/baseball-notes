import { dateInZone } from "../domain/analysis-query";
import type { Favorite } from "../domain/models";
import type { NpbPlayerEvents } from "../domain/npb-player-events";
import type { NpbJapanSeries } from "../domain/npb-japan-series";
import { npbSeasonalHome } from "../domain/npb-seasonal-home";
import { japanSeriesHomePeriod, japanSeriesHomeSummary } from "./japan-series-home";

const day = (date: string) => Date.parse(`${date}T00:00:00Z`);
const age = (date: string, today: string) => (day(today) - day(date)) / 86400000;

/** Prominence only; missing results never establish that a series has ended. */
export function relevantJapanSeries(data: NpbJapanSeries, now: number) {
  if (!japanSeriesHomePeriod(now) || Date.parse(data.observedAt) > now) return false;
  const today = dateInZone(now, "Asia/Tokyo"), summary = japanSeriesHomeSummary(data, now);
  if (summary.awaitingResult) return false;
  if (summary.latest && age(summary.latest.date, today) >= 0 && age(summary.latest.date, today) <= 1) return true;
  return !data.series.clinched && !!summary.next && age(summary.next.date, today) >= -1 && age(summary.next.date, today) <= 0 && now - Date.parse(data.observedAt) <= 48 * 3600000;
}

export function homeMovementRecords(data: NpbPlayerEvents, now: number, favorites: readonly Favorite[]) {
  if (Date.parse(data.observedAt) > now) return [];
  const today = dateInZone(now, "Asia/Tokyo");
  const followed = (e: NpbPlayerEvents["events"][number]) => favorites.some(f => f.league === "NPB" && (f.kind === "player" ? f.entityId === e.playerId : e.relatedTeamIds.includes(f.entityId)));
  const seen = new Set<string>();
  return data.events.filter(e => age(e.recordedDate, today) >= 0 && age(e.recordedDate, today) < 14)
    .slice().sort((a, b) => Number(followed(b)) - Number(followed(a)) || b.recordedDate.localeCompare(a.recordedDate) || a.id.localeCompare(b.id))
    .filter(e => { if (seen.has(e.playerId)) return false; seen.add(e.playerId); return true; }).slice(0, 3)
    .map(event => ({ event, followed: followed(event), player: data.players.find(p => p.playerId === event.playerId)! }));
}

export function npbHomeContext(now: number, requested: string | null, series: NpbJapanSeries | null, events: NpbPlayerEvents | null, favorites: readonly Favorite[]) {
  const season = npbSeasonalHome(now, requested);
  const wantsSeries = season.manual ? season.mode === "autumn" : japanSeriesHomePeriod(now);
  const wantsMovements = season.mode === "winter" || season.mode === "autumn" && Number(season.date.slice(8)) >= 20;
  const movements = events && wantsMovements ? homeMovementRecords(events, now, favorites) : [];
  const focus = season.mode === "regular" ? "scores" : wantsSeries && series && relevantJapanSeries(series, now) ? "series" : movements.length ? "moves" : "seasonal";
  return { season, wantsSeries, wantsMovements, movements, focus } as const;
}
