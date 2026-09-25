import type { PlayerGameBatting, PlayerGamePitching } from "../domain/game-facts";
import { aggregateBatting, aggregatePitching, resolvePlayerPeriod, playerPeriodQuerySchema } from "../domain/player-period";
import type { BattingPeriodResult, PitchingPeriodResult, PlayerPeriodQuery } from "../domain/player-period";
import type { NpbSeasonMetadata } from "../domain/npb-season";
import { unavailablePeriodCoverage, type PeriodCoverage } from "../domain/period-coverage";
import type { PeriodWindow } from "../domain/player-period";

// The existing NpbRepository satisfies this read-only port. No collector or DB write is involved.
export interface PlayerPeriodFactReader {
  findBattingByPlayer(playerId: string, fromDate: string, toDate: string, season?: number): Promise<PlayerGameBatting[]>;
  findPitchingByPlayer(playerId: string, fromDate: string, toDate: string, season?: number): Promise<PlayerGamePitching[]>;
  findSeasonBoundary?(asOfDate: string): Promise<NpbSeasonMetadata | null>;
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

  private async window(query: PlayerPeriodQuery): Promise<{ window: PeriodWindow; season: NpbSeasonMetadata | null }> {
    const season = query.period === "season" ? await this.facts.findSeasonBoundary?.(query.asOfDate) ?? null : null;
    return { window: resolvePlayerPeriod(query, season ?? undefined), season };
  }

  async batting(input: PlayerPeriodQuery): Promise<BattingPeriodResult> {
    const query = playerPeriodQuerySchema.parse(input);
    const { window, season } = await this.window(query);
    if (window.beforeSeason) return aggregateBatting(query, [], this.clock(), unavailablePeriodCoverage(window), window);
    const [facts, coverage] = await Promise.all([
      season ? this.facts.findBattingByPlayer(query.playerId, window.from, window.to, season.season)
        : this.facts.findBattingByPlayer(query.playerId, window.from, window.to), this.coverage(window),
    ]);
    return aggregateBatting(query, facts, this.clock(), coverage, window);
  }

  async pitching(input: PlayerPeriodQuery): Promise<PitchingPeriodResult> {
    const query = playerPeriodQuerySchema.parse(input);
    const { window, season } = await this.window(query);
    if (window.beforeSeason) return aggregatePitching(query, [], this.clock(), unavailablePeriodCoverage(window), window);
    const [facts, coverage] = await Promise.all([
      season ? this.facts.findPitchingByPlayer(query.playerId, window.from, window.to, season.season)
        : this.facts.findPitchingByPlayer(query.playerId, window.from, window.to), this.coverage(window),
    ]);
    return aggregatePitching(query, facts, this.clock(), coverage, window);
  }
}
