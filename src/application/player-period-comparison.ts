import type { PlayerGameBatting, PlayerGamePitching } from "../domain/game-facts";
import { aggregateBatting, aggregatePitching, resolvePlayerPeriod } from "../domain/player-period";
import type { PeriodWindow } from "../domain/player-period";
import { unavailablePeriodCoverage, type PeriodCoverage } from "../domain/period-coverage";
import { comparisonPeriods, playerPeriodComparisonSchema, type PlayerPeriodComparison } from "../domain/player-period-comparison";

type Dated<T> = { date: string; fact: T };
type PlayerIdentity = PlayerPeriodComparison["player"];
export interface PlayerComparisonFactReader {
  findPlayerIdentity(playerId: string): Promise<PlayerIdentity | null>;
  findDatedBattingByPlayer(playerId: string, from: string, to: string): Promise<Dated<PlayerGameBatting>[]>;
  findDatedPitchingByPlayer(playerId: string, from: string, to: string): Promise<Dated<PlayerGamePitching>[]>;
}
export interface PlayerComparisonCoverageReader {
  findPeriodCoverages(windows: readonly PeriodWindow[]): Promise<PeriodCoverage[]>;
}

export class PlayerPeriodComparisonService {
  constructor(private readonly facts: PlayerComparisonFactReader,
    private readonly coverage: PlayerComparisonCoverageReader, private readonly clock: () => Date = () => new Date()) {}

  async find(playerId: string, asOfDate: string): Promise<{ payload: PlayerPeriodComparison; dbReadMs: number; aggregationMs: number } | null> {
    const windows = comparisonPeriods.map((period) => resolvePlayerPeriod({ playerId, asOfDate, period }));
    const startedAt = performance.now();
    const player = await this.facts.findPlayerIdentity(playerId);
    if (!player) return null;
    const [batting, pitching, coverage] = await Promise.all([
      this.facts.findDatedBattingByPlayer(playerId, windows[2]!.from, windows[2]!.to),
      this.facts.findDatedPitchingByPlayer(playerId, windows[2]!.from, windows[2]!.to),
      this.coverage.findPeriodCoverages(windows).catch(() => windows.map(unavailablePeriodCoverage)),
    ]);
    const dbReadMs = performance.now() - startedAt;
    const calculatedAt = this.clock();
    const entries = comparisonPeriods.map((period, index) => {
      const window = windows[index]!;
      const query = { playerId, asOfDate, period };
      const battingFacts = batting.filter((row) => row.date >= window.from && row.date <= window.to).map((row) => row.fact);
      const pitchingFacts = pitching.filter((row) => row.date >= window.from && row.date <= window.to).map((row) => row.fact);
      const battingResult = aggregateBatting(query, battingFacts, calculatedAt, coverage[index], window);
      const pitchingResult = aggregatePitching(query, pitchingFacts, calculatedAt, coverage[index], window);
      return [period, { coverage: coverage[index] ?? unavailablePeriodCoverage(window),
        batting: battingResult.factCount ? battingResult : null,
        pitching: pitchingResult.factCount ? pitchingResult : null }] as const;
    });
    const payload = playerPeriodComparisonSchema.parse({ player, asOfDate, periods: Object.fromEntries(entries) });
    return { payload, dbReadMs, aggregationMs: performance.now() - startedAt - dbReadMs };
  }
}
