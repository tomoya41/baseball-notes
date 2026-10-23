import type { GameSurfaceReader } from "./game-surface";
import { shiftGameDate, type GameDateIndex, type GameIndexRow } from "../domain/npb-game-index";
import { dailyGames } from "../domain/product-daily";

// Static date indexes only, at most 15 requests; no Game/player detail fetches.
export async function readDailyDashboard(reader: GameSurfaceReader, today: string) {
  const manifest = await reader.manifest();
  const from = [shiftGameDate(today, -7), manifest.from].sort().at(-1)!;
  const to = [shiftGameDate(today, 7), manifest.to].sort()[0]!;
  const dates: string[] = [], pages: GameDateIndex[] = [], failedDates: string[] = [], incompleteDates: string[] = [];
  for (let date = from; date <= to; date = shiftGameDate(date, 1)) dates.push(date);
  // A bounded, separately labelled saved-results feed remains useful after the
  // calendar window. It is not a Day/Coverage proof or a source of Today facts.
  let savedRecent: GameIndexRow[] = [], savedRecentUnavailable = false;
  if (!dates.length && today > manifest.to) {
    try {
      const recent = await reader.recent();
      if (recent.effectiveDate !== manifest.effectiveDate) throw Error("Saved results snapshot mismatch");
      savedRecent = recent.games.filter(g => g.status === "final" && g.date >= manifest.from && g.date <= manifest.to && g.date <= manifest.effectiveDate && g.date < today).slice(0,6);
    } catch { savedRecentUnavailable = true; }
  }
  // Independent static Pages requests, never collector/provider requests.
  const results = await Promise.allSettled(dates.map(date => reader.date(date)));
  results.forEach((result, index) => {
    const date = dates[index]!;
    if (result.status === "fulfilled" && result.value.date === date) {
      pages.push(result.value);
      if (!["complete", "no_games"].includes(result.value.coverage)) incompleteDates.push(date);
    }
    else failedDates.push(date);
  });
  return { manifest, pages, failedDates, incompleteDates, savedRecent, savedRecentUnavailable, ...dailyGames(today, pages, manifest.effectiveDate) };
}
