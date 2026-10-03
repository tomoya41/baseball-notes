import type { GameSurfaceReader } from "./game-surface";
import { shiftGameDate, type GameDateIndex } from "../domain/npb-game-index";
import { dailyGames } from "../domain/product-daily";

// Static date indexes only, at most 15 requests; no Game/player detail fetches.
export async function readDailyDashboard(reader: GameSurfaceReader, today: string) {
  const manifest = await reader.manifest();
  const from = [shiftGameDate(today, -7), manifest.from].sort().at(-1)!;
  const to = [shiftGameDate(today, 7), manifest.to].sort()[0]!;
  const dates: string[] = [], pages: GameDateIndex[] = [], failedDates: string[] = [], incompleteDates: string[] = [];
  for (let date = from; date <= to; date = shiftGameDate(date, 1)) dates.push(date);
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
  return { manifest, pages, failedDates, incompleteDates, ...dailyGames(today, pages, manifest.effectiveDate) };
}
