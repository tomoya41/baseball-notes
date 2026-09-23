import type { WatchGame } from "../domain/watch";
import { dateInZone } from "../domain/analysis-query";

// The viewer's "today" is JST; an MLB game may have a different local gameDate.
export function isWatchDay(game: WatchGame, date: string): boolean {
  return game.startsAt ? dateInZone(Date.parse(game.startsAt), "Asia/Tokyo") === date : game.gameDate === date;
}
