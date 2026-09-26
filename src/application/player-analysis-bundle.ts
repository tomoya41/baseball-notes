import type { PlayerGameBatting, PlayerGamePitching } from "../domain/game-facts";
import type { SituatedFact } from "../domain/player-home-away";
import { playerAnalysisBundleSchema } from "../domain/player-analysis-bundle";
import { comparisonPeriods } from "../domain/player-period-comparison";
import { resolvePlayerPeriod, type PeriodWindow } from "../domain/player-period";
import { unavailablePeriodCoverage, type PeriodCoverage } from "../domain/period-coverage";
import type { PlayerHomeAwayFactReader } from "./player-home-away";
import { PlayerHomeAwayService } from "./player-home-away";
import { PlayerOpponentService } from "./player-opponent";
import { PlayerPeriodComparisonService } from "./player-period-comparison";
import { PlayerBattingOrderService } from "./player-batting-order";
import { PlayerPitcherRoleService } from "./player-pitcher-role";

type CoverageReader = { findPeriodCoverages(windows: readonly PeriodWindow[]): Promise<PeriodCoverage[]> };
export type PlayerAnalysisContext = {
  player: NonNullable<Awaited<ReturnType<PlayerHomeAwayFactReader["findPlayerIdentity"]>>>;
  asOfDate: string;
  batting: SituatedFact<PlayerGameBatting>[];
  pitching: SituatedFact<PlayerGamePitching>[];
  coverages: PeriodCoverage[];
};

function settled<T>(result: PromiseSettledResult<T | null>) {
  return result.status === "fulfilled" && result.value ? { status: "ready" as const, payload: result.value } :
    { status: "error" as const };
}

export class PlayerAnalysisBundleService {
  constructor(private readonly facts: PlayerHomeAwayFactReader,
    private readonly coverageReader: CoverageReader, private readonly clock: () => Date = () => new Date()) {}

  async find(playerId: string, asOfDate: string) {
    const windows = comparisonPeriods.map((period) => resolvePlayerPeriod({ playerId, asOfDate, period }));
    const started = performance.now();
    const player = await this.facts.findPlayerIdentity(playerId);
    if (!player) return null;
    const [batting, pitching, coverages] = await Promise.all([
      this.facts.findSituatedBattingByPlayer(playerId, windows[2]!.from, windows[2]!.to),
      this.facts.findSituatedPitchingByPlayer(playerId, windows[2]!.from, windows[2]!.to),
      this.coverageReader.findPeriodCoverages(windows).catch(() => windows.map(unavailablePeriodCoverage)),
    ]);
    const dbReadMs = performance.now() - started;
    const context: PlayerAnalysisContext = { player, asOfDate, batting, pitching, coverages };
    const sharedFacts = {
      findPlayerIdentity: async () => context.player,
      findSituatedBattingByPlayer: async (_id: string, from: string, to: string) =>
        context.batting.filter((row) => row.date >= from && row.date <= to),
      findSituatedPitchingByPlayer: async (_id: string, from: string, to: string) =>
        context.pitching.filter((row) => row.date >= from && row.date <= to),
      findDatedBattingByPlayer: async (_id: string, from: string, to: string) =>
        context.batting.filter((row) => row.date >= from && row.date <= to).map(({ date, fact }) => ({ date, fact })),
      findDatedPitchingByPlayer: async (_id: string, from: string, to: string) =>
        context.pitching.filter((row) => row.date >= from && row.date <= to).map(({ date, fact }) => ({ date, fact })),
    };
    const sharedCoverage = {
      findPeriodCoverages: async (requested: readonly PeriodWindow[]) => requested.map((window) =>
        context.coverages.find((item) => item.from === window.from && item.to === window.to) ??
          unavailablePeriodCoverage(window)),
      findPeriodCoverage: async (window: PeriodWindow) => context.coverages.find((item) =>
        item.from === window.from && item.to === window.to) ?? unavailablePeriodCoverage(window),
    };
    let rolePartitionMs = 0, roleAggregationMs = 0;
    const [comparison, homeAway, opponent, battingOrder, pitcherRole] = await Promise.allSettled([
      new PlayerPeriodComparisonService(sharedFacts, sharedCoverage, this.clock).find(playerId, asOfDate)
        .then((value) => value?.payload ?? null),
      new PlayerHomeAwayService(sharedFacts, sharedCoverage, this.clock).find(playerId, asOfDate)
        .then((value) => value?.payload ?? null),
      new PlayerOpponentService(sharedFacts, sharedCoverage, this.clock).find(playerId, asOfDate)
        .then((value) => value?.payload ?? null),
      new PlayerBattingOrderService(sharedFacts, sharedCoverage, this.clock).find(playerId, asOfDate),
      new PlayerPitcherRoleService(sharedFacts, sharedCoverage, this.clock).find(playerId, asOfDate)
        .then((value) => { if (value) { rolePartitionMs = value.partitionMs; roleAggregationMs = value.aggregationMs; }
          return value?.payload ?? null; }),
    ]);
    const aggregationMs = performance.now() - started - dbReadMs;
    const payload = playerAnalysisBundleSchema.parse({ playerId, asOfDate,
      comparison: settled(comparison), homeAway: settled(homeAway), opponent: settled(opponent),
      battingOrder: settled(battingOrder), pitcherRole: settled(pitcherRole) });
    return { payload, context, dbReadMs, aggregationMs, rolePartitionMs, roleAggregationMs };
  }
}
