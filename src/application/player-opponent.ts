import type { PlayerGameBatting, PlayerGamePitching } from "../domain/game-facts";
import type { PlayerHomeAwayCoverageReader, PlayerHomeAwayFactReader } from "./player-home-away";
import { partitionByOpponent, playerOpponentSchema, type PlayerOpponent } from "../domain/player-opponent";
import { aggregateBatting, aggregatePitching, resolvePlayerPeriod } from "../domain/player-period";
import { unavailablePeriodCoverage } from "../domain/period-coverage";

function visiblePitching(query: Parameters<typeof aggregatePitching>[0], facts: readonly PlayerGamePitching[],
  now: Date, coverage: Parameters<typeof aggregatePitching>[3], window: ReturnType<typeof resolvePlayerPeriod>) {
  const result = aggregatePitching(query, facts, now, coverage, window);
  const metrics: Partial<typeof result.metrics> = { ...result.metrics };
  delete metrics.WHIP;
  return { ...result, metrics };
}

export class PlayerOpponentService {
  constructor(private readonly facts: PlayerHomeAwayFactReader,
    private readonly coverageReader: PlayerHomeAwayCoverageReader, private readonly clock: () => Date = () => new Date()) {}

  async find(playerId: string, asOfDate: string): Promise<{
    payload: PlayerOpponent; dbReadMs: number; classificationMs: number; aggregationMs: number;
    battingFactRows: number; pitchingFactRows: number;
  } | null> {
    const query = { playerId, asOfDate, period: "30d" as const };
    const window = resolvePlayerPeriod(query);
    const started = performance.now();
    const player = await this.facts.findPlayerIdentity(playerId);
    if (!player) return null;
    const [battingRows, pitchingRows, coverage] = await Promise.all([
      this.facts.findSituatedBattingByPlayer(playerId, window.from, window.to),
      this.facts.findSituatedPitchingByPlayer(playerId, window.from, window.to),
      this.coverageReader.findPeriodCoverage(window).catch(() => unavailablePeriodCoverage(window)),
    ]);
    const dbReadMs = performance.now() - started;
    const battingParts = partitionByOpponent(battingRows);
    const pitchingParts = partitionByOpponent(pitchingRows);
    const classificationMs = performance.now() - started - dbReadMs;
    const now = this.clock();
    const battingFacts: PlayerGameBatting[] = [];
    const pitchingFacts: PlayerGamePitching[] = [];
    for (const group of battingParts.groups.values()) battingFacts.push(...group.facts);
    for (const group of pitchingParts.groups.values()) pitchingFacts.push(...group.facts);
    const teams = new Set([...battingParts.groups.keys(), ...pitchingParts.groups.keys()]);
    const opponents = [...teams].map((teamId) => {
      const batting = battingParts.groups.get(teamId);
      const pitching = pitchingParts.groups.get(teamId);
      return { teamId, lastGameDate: [batting?.lastGameDate, pitching?.lastGameDate]
        .filter((date): date is string => !!date).sort().at(-1)!,
      batting: batting ? aggregateBatting(query, batting.facts, now, coverage, window) : null,
      pitching: pitching ? visiblePitching(query, pitching.facts, now, coverage, window) : null };
    }).sort((a, b) => a.teamId.localeCompare(b.teamId));
    const payload = playerOpponentSchema.parse({ player, asOfDate, period: "30d", ...window, coverage,
      batting: { totalFactCount: battingRows.length, unknownOpponentFactCount: battingParts.unknown.length,
        classifiedTotal: battingFacts.length ? aggregateBatting(query, battingFacts, now, coverage, window) : null },
      pitching: { totalFactCount: pitchingRows.length, unknownOpponentFactCount: pitchingParts.unknown.length,
        classifiedTotal: pitchingFacts.length ? visiblePitching(query, pitchingFacts, now, coverage, window) : null },
      opponents });
    return { payload, dbReadMs, classificationMs,
      aggregationMs: performance.now() - started - dbReadMs - classificationMs,
      battingFactRows: battingRows.length, pitchingFactRows: pitchingRows.length };
  }
}
