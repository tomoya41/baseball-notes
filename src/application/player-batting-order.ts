import { playerBattingOrderSchema, partitionByBattingOrder } from "../domain/player-batting-order";
import { aggregateBatting, resolvePlayerPeriod } from "../domain/player-period";
import { unavailablePeriodCoverage } from "../domain/period-coverage";
import type { PlayerHomeAwayCoverageReader, PlayerHomeAwayFactReader } from "./player-home-away";

export class PlayerBattingOrderService {
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
    const { groups, unknown } = partitionByBattingOrder(rows);
    this.onTiming?.(performance.now()-started);
    const now = this.clock();
    const classified = [...groups.values()].flatMap((group) => group.facts);
    const unknownPa = unknown.length ? aggregateBatting(query, unknown, now, coverage, window).metrics.PA.value : 0;
    return playerBattingOrderSchema.parse({ player, asOfDate, period: "30d", ...window, coverage,
      totalFactCount: rows.length, unknownBattingOrderFactCount: unknown.length,
      unknownBattingOrderPa: unknownPa,
      classifiedTotal: classified.length ? aggregateBatting(query, classified, now, coverage, window) : null,
      orders: [...groups].sort(([a], [b]) => a - b).map(([battingOrder, group]) => ({
        battingOrder, lastGameDate: group.lastGameDate,
        stats: aggregateBatting(query, group.facts, now, coverage, window),
      })),
    });
  }
}
