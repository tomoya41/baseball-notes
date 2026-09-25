import { z } from "zod";
import type { PlayerGameBatting, PlayerGamePitching } from "../domain/game-facts";
import { aggregateBatting, aggregatePitching, playerPeriodQuerySchema, resolvePlayerPeriod } from "../domain/player-period";
import type { BattingPeriodResult, PitchingPeriodResult, PeriodWindow } from "../domain/player-period";
import type { NpbSeasonMetadata } from "../domain/npb-season";
import { unavailablePeriodCoverage, type PeriodCoverage, type PeriodCoverageStatus } from "../domain/period-coverage";
import type { PlayerPeriodCoverageReader } from "./player-period";

export const playerPeriodBatchQuerySchema = playerPeriodQuerySchema.omit({ playerId: true }).extend({
  maxBatters: z.number().int().nonnegative().optional(),
  maxPitchers: z.number().int().nonnegative().optional(),
});
export type PlayerPeriodBatchQuery = z.infer<typeof playerPeriodBatchQuerySchema>;

export interface PlayerPeriodBatchReader {
  findPeriodPlayerIds(from: string, to: string, season?: number): Promise<{ batters: string[]; pitchers: string[] }>;
  findBattingByPeriod(from: string, to: string, playerIds: readonly string[] | null, season?: number): Promise<PlayerGameBatting[]>;
  findPitchingByPeriod(from: string, to: string, playerIds: readonly string[] | null, season?: number): Promise<PlayerGamePitching[]>;
  findSeasonBoundary?(asOfDate: string): Promise<NpbSeasonMetadata | null>;
}

type CoverageCounts = Record<PeriodCoverageStatus, number>;
export type PlayerPeriodBatchResult = {
  period: PlayerPeriodBatchQuery["period"];
  window: PeriodWindow;
  coverage: PeriodCoverage;
  batters: BattingPeriodResult[];
  pitchers: PitchingPeriodResult[];
  summary: { batterPlayers: number; pitcherPlayers: number; uniquePlayers: number;
    battingFacts: number; pitchingFacts: number; coverage: CoverageCounts };
  timings: { dbReadMs: number; aggregationMs: number; totalMs: number };
};

function groupByPlayer<T extends { playerId: string }>(rows: readonly T[]): Map<string, T[]> {
  const grouped = new Map<string, T[]>();
  for (const row of rows) {
    const group = grouped.get(row.playerId) ?? [];
    group.push(row);
    grouped.set(row.playerId, group);
  }
  return grouped;
}

export function countBatchCoverage(results: readonly (BattingPeriodResult | PitchingPeriodResult)[]): CoverageCounts {
  const counts: CoverageCounts = { complete: 0, partial: 0, unknown: 0, unavailable: 0 };
  for (const result of results) counts[result.coverage.status] += 1;
  return counts;
}

// The universe is players with saved Facts in this period; no player-master scan or per-player SQL.
export class PlayerPeriodBatchService {
  constructor(private readonly facts: PlayerPeriodBatchReader,
    private readonly coverageReader?: PlayerPeriodCoverageReader,
    private readonly clock: () => Date = () => new Date()) {}

  async aggregate(input: PlayerPeriodBatchQuery): Promise<PlayerPeriodBatchResult> {
    const query = playerPeriodBatchQuerySchema.parse(input);
    const start = performance.now();
    const season = query.period === "season" ? await this.facts.findSeasonBoundary?.(query.asOfDate) ?? null : null;
    const window = resolvePlayerPeriod({ asOfDate: query.asOfDate, period: query.period, playerId: "batch" }, season ?? undefined);
    const universe = window.beforeSeason ? { batters: [], pitchers: [] } :
      await this.facts.findPeriodPlayerIds(window.from, window.to, season?.season);
    const batterIds = universe.batters.slice(0, query.maxBatters);
    const pitcherIds = universe.pitchers.slice(0, query.maxPitchers);
    const allBatters = query.maxBatters === undefined ? null : batterIds;
    const allPitchers = query.maxPitchers === undefined ? null : pitcherIds;
    const [battingRows, pitchingRows, coverage] = await Promise.all([
      batterIds.length ? this.facts.findBattingByPeriod(window.from, window.to, allBatters, season?.season) : [],
      pitcherIds.length ? this.facts.findPitchingByPeriod(window.from, window.to, allPitchers, season?.season) : [],
      window.beforeSeason || !this.coverageReader ? unavailablePeriodCoverage(window) :
        this.coverageReader.findPeriodCoverage(window).catch(() => unavailablePeriodCoverage(window)),
    ]);
    const dbReadMs = performance.now() - start;
    const calculatedAt = this.clock();
    const battersById = groupByPlayer(battingRows);
    const pitchersById = groupByPlayer(pitchingRows);
    const batters = batterIds.map((playerId) => aggregateBatting({ playerId, asOfDate: query.asOfDate, period: query.period },
      battersById.get(playerId) ?? [], calculatedAt, coverage, window));
    const pitchers = pitcherIds.map((playerId) => aggregatePitching({ playerId, asOfDate: query.asOfDate, period: query.period },
      pitchersById.get(playerId) ?? [], calculatedAt, coverage, window));
    const aggregationMs = performance.now() - start - dbReadMs;
    return { period: query.period, window, coverage, batters, pitchers,
      summary: { batterPlayers: batters.length, pitcherPlayers: pitchers.length,
        uniquePlayers: new Set([...batterIds, ...pitcherIds]).size,
        battingFacts: battingRows.length, pitchingFacts: pitchingRows.length,
        coverage: countBatchCoverage([...batters, ...pitchers]) },
      timings: { dbReadMs, aggregationMs, totalMs: performance.now() - start } };
  }
}
