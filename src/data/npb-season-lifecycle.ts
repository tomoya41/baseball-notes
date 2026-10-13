import { addDays } from "./npb-collector";
import { findNpbRegularSeason } from "./npb-season-metadata";
import type { DataClient } from "./database";

export type ScheduleMode = "season" | "monthly" | "weekly" | "daily";
// The reviewed calendar is an acquisition boundary, not proof that a season ended.
// A skip never constitutes a no-game observation, Day completeness or Gate proof.
export function planNpbCalendar(mode: ScheduleMode, date: string, savedGames = 0) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date) throw Error("Invalid schedule date");
  const season = findNpbRegularSeason(date);
  if (!season) throw Error("Season metadata unavailable; reviewed calendar required");
  const from = mode === "season" ? season.startDate : date;
  const to = mode === "season" ? season.endDate : mode === "monthly" ? addDays(date, 44) :
    mode === "weekly" ? addDays(date, 13) : date;
  if (date > season.endDate || to < season.startDate) {
    if (savedGames > 0) throw Error("Saved fixture outside reviewed calendar; metadata review required");
    return { skip: true as const, reason: "outside_reviewed_regular_calendar" as const,
      date, reviewedFrom: season.startDate, reviewedTo: season.endDate, endDateStatus: season.endDateStatus };
  }
  return { skip: false as const, range: {
    from: from < season.startDate ? season.startDate : from,
    to: to > season.endDate ? season.endDate : to,
  } };
}

export async function inspectNpbCalendar(client: DataClient, date: string) {
  const calendar = planNpbCalendar("daily", date);
  const result = await client.execute({ sql: `SELECT MAX(g.game_date) AS latest_game_date,
    SUM(CASE WHEN g.game_date=? THEN 1 ELSE 0 END) AS target_games,
    SUM(CASE WHEN g.game_date<=? AND (g.status NOT IN ('final','postponed','canceled') OR
      (g.status='final' AND COALESCE(c.game_status,'unknown')!='complete')) THEN 1 ELSE 0 END) AS pending_games
    FROM npb_games g LEFT JOIN npb_game_completeness c ON c.game_id=g.game_id WHERE g.season=?`,
    args: [date, date, Number(date.slice(0, 4))] });
  const row = result.rows[0];
  const latestSavedGameDate = row?.latest_game_date == null ? null : String(row.latest_game_date);
  return { calendar, latestSavedGameDate: row?.latest_game_date == null ? null : String(row.latest_game_date),
    targetGames: Number(row?.target_games ?? 0), pendingSavedGames: Number(row?.pending_games ?? 0),
    // No declaration of completion: scheduled metadata can exclude makeup games.
    seasonEndConfirmed: false as const,
    metadataReviewRequired: calendar.skip && latestSavedGameDate !== null && latestSavedGameDate > calendar.reviewedTo };
}
