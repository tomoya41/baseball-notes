import type { NpbPlayerDirectory } from "../domain/npb-player-directory";
import type { RecentPeriod } from "../domain/player-recent";
import type { NpbSeasonPayload } from "./npb-season-payload";
import { readNpbExplorerSeason, readNpbRecentExplorer } from "./explorer-readers";

export type PublishedPlayerStats = Pick<NpbSeasonPayload, "period" | "coverage" | "effectiveDate" | "generatedAt"> & {
  player: NpbSeasonPayload["players"][number];
};
type DirectoryReader = { findLatestNpb(): Promise<NpbPlayerDirectory> };
type PublishedSnapshot = Pick<NpbSeasonPayload, "players" | "coverage" | "effectiveDate" | "generatedAt" | "period">;
const pending = new Map<string, Promise<PublishedSnapshot>>();

/** A saved publication, not a successful DB read or a full per-day coverage API. */
export function publishedPlayerStats(payload: PublishedSnapshot, directory: NpbPlayerDirectory, playerId: string): PublishedPlayerStats | null {
  if (payload.effectiveDate !== directory.effectiveDate) throw Error("Saved player publication date differs");
  const identity = directory.players.find(p => p.playerId === playerId);
  if (!identity) return null;
  const player = payload.players.find(p => p.playerId === playerId);
  if (!player) return null; // Missing rows never become zero appearances.
  if (player.displayName !== identity.displayName || player.teamId !== identity.teamId) throw Error("Saved player identity differs");
  return { player, period: payload.period, coverage: payload.coverage, effectiveDate: payload.effectiveDate, generatedAt: payload.generatedAt };
}

export async function readPublishedPlayerStats(playerId: string, period: RecentPeriod, repository: DirectoryReader): Promise<PublishedPlayerStats | null> {
  if (period === "currentMonth") throw Error("No admitted monthly publication");
  const directory = await repository.findLatestNpb();
  if (!directory.players.some(p => p.playerId === playerId)) return null;
  const key = `${period}:${directory.effectiveDate}`;
  let task = pending.get(key);
  if (!task) {
    task = (period === "season" ? readNpbExplorerSeason(2026) :
      readNpbRecentExplorer(Number(period.slice(0, -1)) as 7 | 14 | 30, directory))
      .finally(() => pending.delete(key));
    pending.set(key, task);
  }
  return publishedPlayerStats(await task, directory, playerId);
}
