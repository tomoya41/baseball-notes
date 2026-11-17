import type { GameDateIndex,GameManifest,GameIndexRow } from "../domain/npb-game-index";
import type { NpbRecords } from "../domain/npb-records";
export type PublishedGameSummary = { game: GameIndexRow; generatedAt: string; coverage: GameDateIndex["coverage"] };
export interface GameSummaryReader { find(gameId: string, date?: string): Promise<PublishedGameSummary | null> }
export type DeferGameAssetCache = (remember: () => Promise<void>) => void;
export interface GameSurfaceReader {
  manifest(deferCache?:DeferGameAssetCache):Promise<GameManifest>;
  date(date:string, expectedGeneratedAt?:string, deferCache?:DeferGameAssetCache):Promise<GameDateIndex>;
  recent():Promise<{games:GameIndexRow[];effectiveDate:string}>;
  records():Promise<NpbRecords>;
}

export async function readGameDateForManifest(reader: Pick<GameSurfaceReader, "date">, manifest: GameManifest,
  date: string, deferCache?: DeferGameAssetCache): Promise<GameDateIndex> {
  const day = await (deferCache ? reader.date(date, manifest.generatedAt, deferCache) : reader.date(date, manifest.generatedAt));
  if (day.date !== date || day.generatedAt !== manifest.generatedAt) throw Error("Game date publication generation differs");
  return day;
}
