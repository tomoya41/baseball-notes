import { outsideReviewedNpbRegularCalendar } from "../data/npb-season-metadata";
import type { GameDateIndex,GameManifest,GameIndexRow } from "../domain/npb-game-index";
import type { NpbGameDetail } from "../domain/npb-game-detail";
import type { NpbRecords } from "../domain/npb-records";
export type PublishedGameSummary = { game: GameIndexRow; generatedAt: string; coverage: GameDateIndex["coverage"] };
export interface GameSummaryReader { find(gameId: string, date?: string): Promise<PublishedGameSummary | null> }
export type DeferGameAssetCache = (remember: () => Promise<void>) => void;
export interface GameSurfaceReader {
  manifest(deferCache?:DeferGameAssetCache):Promise<GameManifest>;
  date(date:string, expectedGeneratedAt?:string, deferCache?:DeferGameAssetCache):Promise<GameDateIndex>;
  recent(deferCache?:DeferGameAssetCache):Promise<{games:GameIndexRow[];effectiveDate:string;generatedAt?:string}>;
  records():Promise<NpbRecords>;
}

export async function readGameDateForManifest(reader: Pick<GameSurfaceReader, "date">, manifest: GameManifest,
  date: string, deferCache?: DeferGameAssetCache): Promise<GameDateIndex> {
  const day = await (deferCache ? reader.date(date, manifest.generatedAt, deferCache) : reader.date(date, manifest.generatedAt));
  if (day.date !== date || day.generatedAt !== manifest.generatedAt) throw Error("Game date publication generation differs");
  return day;
}

type GameIdentity = Pick<GameIndexRow, "gameId" | "date" | "gameNumber"> & { away: { id: string }; home: { id: string } };

function sameNpbGame(a: GameIdentity, b: GameIdentity): boolean {
  return a.gameId === b.gameId && a.date === b.date && a.gameNumber === b.gameNumber &&
    a.away.id === b.away.id && a.home.id === b.home.id;
}

/** Recover a useful default from the same public generation when its observation
 * day is outside the reviewed calendar and contains no admitted game rows. */
export async function readLatestSavedResultDay(reader: Pick<GameSurfaceReader, "date" | "recent">,
  manifest: GameManifest, day: GameDateIndex, deferCache: DeferGameAssetCache): Promise<GameDateIndex> {
  if (day.coverage !== "unknown" || day.games.length > 0 || !outsideReviewedNpbRegularCalendar(day.date)) return day;
  try {
    const caching: (() => Promise<void>)[] = [];
    const recent = await reader.recent(save => { caching.push(save); });
    if (recent.generatedAt !== manifest.generatedAt || recent.effectiveDate !== manifest.effectiveDate) return day;
    const latest = recent.games.filter(game => game.status === "final" && game.home.score !== null && game.away.score !== null &&
      game.date >= manifest.from && game.date <= manifest.to && game.date < day.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!latest) return day;
    const results = await readGameDateForManifest(reader, manifest, latest.date, save => { caching.push(save); });
    if (results.coverage === "failed" || !results.games.some(game => sameNpbGame(game, latest) && game.status === "final" &&
      game.home.score === latest.home.score && game.away.score === latest.away.score)) return day;
    caching.forEach(deferCache);
    return results;
  } catch {
    return day;
  }
}

function hasPublishedOutcome(game: GameIndexRow): boolean {
  if (game.status === "final") return game.away.score !== null && game.home.score !== null;
  return (game.status === "postponed" || game.status === "canceled") &&
    game.away.score === null && game.home.score === null && !game.battingAvailable && !game.pitchingAvailable;
}

export function matchesPublishedGameOutcome(game: GameIndexRow, detail: NpbGameDetail): boolean {
  if (!hasPublishedOutcome(game) || game.status !== detail.status || !sameNpbGame(game, detail) ||
    detail.away.score !== game.away.score || detail.home.score !== game.home.score) return false;
  return game.status === "final" || (detail.batting.home.length === 0 && detail.batting.away.length === 0 &&
    detail.pitching.home.length === 0 && detail.pitching.away.length === 0);
}

export async function readPublishedGameOutcome(reader: Pick<GameSurfaceReader, "manifest" | "date">,
  expected: GameIdentity): Promise<PublishedGameSummary | null> {
  let rememberManifest: (() => Promise<void>) | undefined;
  const manifest = await reader.manifest(save => { rememberManifest = save; });
  const { date } = expected;
  if (date < manifest.from || date > manifest.to || date > manifest.effectiveDate) return null;
  let rememberDay: (() => Promise<void>) | undefined;
  const day = await readGameDateForManifest(reader, manifest, date, save => { rememberDay = save; });
  const game = day.games.find(candidate => candidate.gameId === expected.gameId);
  if (!game) return null;
  if (!sameNpbGame(game, expected)) throw Error("Published Game result identity mismatch");
  if (!hasPublishedOutcome(game)) return null;
  await Promise.all([rememberManifest?.(), rememberDay?.()]);
  return { game, generatedAt: day.generatedAt, coverage: day.coverage };
}
