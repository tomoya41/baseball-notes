import { partitionBatterRoles, playerBatterRoleSchema } from "../domain/player-batter-role";
import { aggregateBatting, resolvePlayerPeriod } from "../domain/player-period";
import { unavailablePeriodCoverage } from "../domain/period-coverage";
import type { PlayerHomeAwayCoverageReader, PlayerHomeAwayFactReader } from "./player-home-away";

export class PlayerBatterRoleService {
  constructor(private readonly facts: PlayerHomeAwayFactReader,
    private readonly coverageReader: PlayerHomeAwayCoverageReader, private readonly clock: () => Date = () => new Date(),
    private readonly onTiming?: (partitionMs:number) => void) {}

  async find(playerId: string, asOfDate: string) {
    const query = { playerId, asOfDate, period: "30d" as const };
    const window = resolvePlayerPeriod(query);
    const player = await this.facts.findPlayerIdentity(playerId);
    if (!player) return null;
    const [rows, coverage] = await Promise.all([
      this.facts.findSituatedBattingByPlayer(playerId, window.from, window.to),
      this.coverageReader.findPeriodCoverage(window).catch(() => unavailablePeriodCoverage(window)),
    ]);
    const started = performance.now();
    const parts = partitionBatterRoles(rows);
    this.onTiming?.(performance.now()-started);
    const now = this.clock();
    const classified = [...parts.starter,...parts.substitute];
    return playerBatterRoleSchema.parse({ player, asOfDate, period:"30d", ...window, coverage,
      totalFactCount: rows.length, unknownRoleFactCount: parts.unknown.length,
      classifiedTotal: classified.length ? aggregateBatting(query,classified,now,coverage,window) : null,
      starter: parts.starter.length ? aggregateBatting(query,parts.starter,now,coverage,window) : null,
      substitute: parts.substitute.length ? aggregateBatting(query,parts.substitute,now,coverage,window) : null,
    });
  }
}
