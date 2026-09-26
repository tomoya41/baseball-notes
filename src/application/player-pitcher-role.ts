import { partitionPitcherRoles, playerPitcherRoleSchema } from "../domain/player-pitcher-role";
import { aggregatePitching, resolvePlayerPeriod } from "../domain/player-period";
import { unavailablePeriodCoverage } from "../domain/period-coverage";
import type { PlayerHomeAwayCoverageReader, PlayerHomeAwayFactReader } from "./player-home-away";

export class PlayerPitcherRoleService {
  constructor(private readonly facts: PlayerHomeAwayFactReader,
    private readonly coverageReader: PlayerHomeAwayCoverageReader, private readonly clock: () => Date = () => new Date()) {}

  async find(playerId: string, asOfDate: string) {
    const query = { playerId, asOfDate, period: "30d" as const };
    const window = resolvePlayerPeriod(query);
    const player = await this.facts.findPlayerIdentity(playerId);
    if (!player) return null;
    const [rows, coverage] = await Promise.all([
      this.facts.findSituatedPitchingByPlayer(playerId, window.from, window.to),
      this.coverageReader.findPeriodCoverage(window).catch(() => unavailablePeriodCoverage(window)),
    ]);
    const start = performance.now();
    const parts = partitionPitcherRoles(rows);
    const partitionMs = performance.now() - start;
    const now = this.clock();
    const classified = [...parts.starter, ...parts.reliever];
    const unknown = parts.unknown.length ? aggregatePitching(query, parts.unknown, now, coverage, window) : null;
    const payload = playerPitcherRoleSchema.parse({ player, asOfDate, period: "30d", ...window, coverage,
      totalFactCount: rows.length, unknownRoleAppearances: parts.unknown.length,
      unknownRoleOuts: unknown?.metrics.outsRecorded.value ?? (parts.unknown.length ? null : 0),
      unknownRoleBf: unknown?.metrics.BF.value ?? (parts.unknown.length ? null : 0),
      classifiedTotal: classified.length ? aggregatePitching(query, classified, now, coverage, window) : null,
      starter: parts.starter.length ? aggregatePitching(query, parts.starter, now, coverage, window) : null,
      reliever: parts.reliever.length ? aggregatePitching(query, parts.reliever, now, coverage, window) : null,
    });
    return { payload, partitionMs, aggregationMs: performance.now() - start - partitionMs };
  }
}
