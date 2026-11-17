import { readGameDateForManifest, type GameSurfaceReader } from "./game-surface";
import { shiftGameDate, type GameDateIndex, type GameManifest } from "../domain/npb-game-index";
import { dailyGames } from "../domain/product-daily";

type DailyDashboard = ReturnType<typeof dailyGames> & {
  manifest: GameManifest;
  pages: GameDateIndex[];
  failedDates: string[];
  incompleteDates: string[];
};

// Static date indexes only, at most 15 requests; no Game/player detail fetches.
export async function readDailyDashboard(reader: GameSurfaceReader, today: string, previous?: DailyDashboard): Promise<DailyDashboard> {
  let rememberManifest: (() => Promise<void>) | undefined;
  const manifest = await reader.manifest(save => { rememberManifest = save; });
  if (previous && previous.failedDates.length === 0 && previous.manifest.generatedAt === manifest.generatedAt &&
      previous.manifest.effectiveDate === manifest.effectiveDate && previous.manifest.from === manifest.from &&
      previous.manifest.to === manifest.to) return previous;
  const from = [shiftGameDate(today, -7), manifest.from].sort().at(-1)!;
  const to = [shiftGameDate(today, 7), manifest.to].sort()[0]!;
  const dates: string[] = [], pages: GameDateIndex[] = [], failedDates: string[] = [], incompleteDates: string[] = [];
  for (let date = from; date <= to; date = shiftGameDate(date, 1)) dates.push(date);
  // Independent static Pages requests, never collector/provider requests.
  const rememberDays: (() => Promise<void>)[] = [];
  const results = await Promise.allSettled(dates.map(date => readGameDateForManifest(reader, manifest, date,
    save => { rememberDays.push(save); })));
  results.forEach((result, index) => {
    const date = dates[index]!;
    if (result.status === "fulfilled") {
      pages.push(result.value);
      if (!["complete", "no_games"].includes(result.value.coverage)) incompleteDates.push(date);
    }
    else failedDates.push(date);
  });
  // A half-published window must not replace the last usable offline window.
  if (pages.length && failedDates.length === 0) await Promise.all([rememberManifest?.(), ...rememberDays.map(save => save())]);
  return { manifest, pages, failedDates, incompleteDates, ...dailyGames(today, pages, manifest.effectiveDate) };
}
