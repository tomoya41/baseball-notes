import type { GameSurfaceReader } from "./game-surface";
import { shiftGameDate, type GameDateIndex } from "../domain/npb-game-index";
import { dailyGames } from "../domain/product-daily";

// Static date indexes only, at most 15 requests; no Game/player detail fetches.
export async function readDailyDashboard(reader: GameSurfaceReader, today: string) {
  const manifest = await reader.manifest();
  const from = [shiftGameDate(today, -7), manifest.from].sort().at(-1)!;
  const to = [shiftGameDate(today, 7), manifest.to].sort()[0]!;
  const pages: GameDateIndex[] = [], failedDates: string[] = [];
  for (let date = from; date <= to; date = shiftGameDate(date, 1)) {
    try { const p = await reader.date(date); if (p.date !== date) throw Error("Date mismatch"); pages.push(p); }
    catch { failedDates.push(date); }
  }
  return { manifest, pages, failedDates, ...dailyGames(today, pages, manifest.effectiveDate) };
}
