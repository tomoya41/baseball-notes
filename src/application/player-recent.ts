import type { NpbRepository } from "../data/npb-repository";
import { PlayerPeriodService } from "./player-period";
import type { RecentPeriod, PlayerRecentResponse } from "../domain/player-recent";

export async function getPlayerRecent(repository: NpbRepository, periods: PlayerPeriodService,
  playerId: string, period: RecentPeriod, asOfDate: string): Promise<PlayerRecentResponse | null> {
  const player = await repository.findPlayerIdentity(playerId);
  if (!player) return null;
  const query = { playerId, period, asOfDate };
  const [batting, pitching] = await Promise.all([periods.batting(query), periods.pitching(query)]);
  return { player, period, asOfDate,
    batting: batting.factCount ? batting : null, pitching: pitching.factCount ? pitching : null };
}
