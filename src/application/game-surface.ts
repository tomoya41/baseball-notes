import type { GameDateIndex,GameManifest,GameIndexRow } from "../domain/npb-game-index";
import type { NpbRecords } from "../domain/npb-records";
export interface GameSurfaceReader {
  manifest():Promise<GameManifest>;
  date(date:string):Promise<GameDateIndex>;
  recent():Promise<{games:GameIndexRow[];effectiveDate:string}>;
  records():Promise<NpbRecords>;
}
