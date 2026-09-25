import type { PlayerGameBatting, PlayerGamePitching } from "../domain/game-facts";
import { aggregateBatting, aggregatePitching, resolvePlayerPeriod, playerPeriodQuerySchema } from "../domain/player-period";
import type { BattingPeriodResult, PitchingPeriodResult, PlayerPeriodQuery } from "../domain/player-period";
import { unavailablePeriodCoverage, type PeriodCoverage } from "../domain/period-coverage";
import type { PeriodWindow } from "../domain/player-period";

// The existing NpbRepository satisfies this read-only port. No collector or DB write is involved.
export interface PlayerPeriodFactReader {
  findBattingByPlayer(playerId: string, fromDate: string, toDate: string): Promise<PlayerGameBatting[]>;
  findPitchingByPlayer(playerId: string, fromDate: string, toDate: string): Promise<PlayerGamePitching[]>;
}

export interface PlayerPeriodCoverageReader {
  findPeriodCoverage(window: PeriodWindow): Promise<PeriodCoverage>;
}

export class PlayerPeriodService {
  constructor(private readonly facts: PlayerPeriodFactReader, private readonly clock: () => Date = () => new Date(),
    private readonly coverageReader?: PlayerPeriodCoverageReader) {}

  private async coverage(window: PeriodWindow): Promise<PeriodCoverage> {
    if (!this.coverageReader) return unavailablePeriodCoverage(window);
    try { return await this.coverageReader.findPeriodCoverage(window); }
    catch { return unavailablePeriodCoverage(window); }
  }

  async batting(input: PlayerPeriodQuery): Promise<BattingPeriodResult> {
    const query = playerPeriodQuerySchema.parse(input);
    const window = resolvePlayerPeriod(query);
    const [facts, coverage] = await Promise.all([
      this.facts.findBattingByPlayer(query.playerId, window.from, window.to), this.coverage(window),
    ]);
    return aggregateBatting(query, facts, this.clock(), coverage);
  }

  async pitching(input: PlayerPeriodQuery): Promise<PitchingPeriodResult> {
    const query = playerPeriodQuerySchema.parse(input);
    const window = resolvePlayerPeriod(query);
    const [facts, coverage] = await Promise.all([
      this.facts.findPitchingByPlayer(query.playerId, window.from, window.to), this.coverage(window),
    ]);
    return aggregatePitching(query, facts, this.clock(), coverage);
  }
}
