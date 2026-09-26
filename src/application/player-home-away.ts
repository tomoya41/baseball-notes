import type { PlayerGameBatting, PlayerGamePitching } from "../domain/game-facts";
import { partitionHomeAway, playerHomeAwaySchema, type PlayerHomeAway, type SituatedFact } from "../domain/player-home-away";
import { aggregateBatting, aggregatePitching, resolvePlayerPeriod } from "../domain/player-period";
import { unavailablePeriodCoverage, type PeriodCoverage } from "../domain/period-coverage";

export interface PlayerHomeAwayFactReader {
  findPlayerIdentity(playerId: string): Promise<PlayerHomeAway["player"] | null>;
  findSituatedBattingByPlayer(playerId: string, from: string, to: string): Promise<SituatedFact<PlayerGameBatting>[]>;
  findSituatedPitchingByPlayer(playerId: string, from: string, to: string): Promise<SituatedFact<PlayerGamePitching>[]>;
}
export interface PlayerHomeAwayCoverageReader {
  findPeriodCoverage(window: ReturnType<typeof resolvePlayerPeriod>): Promise<PeriodCoverage>;
}

export class PlayerHomeAwayService {
  constructor(private readonly facts: PlayerHomeAwayFactReader,
    private readonly coverageReader: PlayerHomeAwayCoverageReader, private readonly clock: () => Date = () => new Date()) {}

  async find(playerId: string, asOfDate: string): Promise<{
    payload: PlayerHomeAway; dbReadMs: number; partitionMs: number; aggregationMs: number;
    battingFactRows: number; pitchingFactRows: number;
  } | null> {
    const query = { playerId, asOfDate, period: "30d" as const };
    const window = resolvePlayerPeriod(query);
    const startedAt = performance.now();
    const player = await this.facts.findPlayerIdentity(playerId);
    if (!player) return null;
    const [battingRows, pitchingRows, coverage] = await Promise.all([
      this.facts.findSituatedBattingByPlayer(playerId, window.from, window.to),
      this.facts.findSituatedPitchingByPlayer(playerId, window.from, window.to),
      this.coverageReader.findPeriodCoverage(window).catch(() => unavailablePeriodCoverage(window)),
    ]);
    const dbReadMs = performance.now() - startedAt;
    const battingParts = partitionHomeAway(battingRows);
    const pitchingParts = partitionHomeAway(pitchingRows);
    const partitionMs = performance.now() - startedAt - dbReadMs;
    const now = this.clock();
    const batting = {
      home: battingParts.home.length ? aggregateBatting(query, battingParts.home, now, coverage, window) : null,
      away: battingParts.away.length ? aggregateBatting(query, battingParts.away, now, coverage, window) : null,
      unknownFactCount: battingParts.unknown.length, totalFactCount: battingRows.length,
    };
    const pitching = {
      home: pitchingParts.home.length ? aggregatePitching(query, pitchingParts.home, now, coverage, window) : null,
      away: pitchingParts.away.length ? aggregatePitching(query, pitchingParts.away, now, coverage, window) : null,
      unknownFactCount: pitchingParts.unknown.length, totalFactCount: pitchingRows.length,
    };
    const payload = playerHomeAwaySchema.parse({ player, asOfDate, period: "30d", ...window, coverage,
      capability: batting.home || batting.away || pitching.home || pitching.away ? "available" : "unavailable",
      batting, pitching });
    return { payload, dbReadMs, partitionMs, aggregationMs: performance.now() - startedAt - dbReadMs - partitionMs,
      battingFactRows: battingRows.length, pitchingFactRows: pitchingRows.length };
  }
}
