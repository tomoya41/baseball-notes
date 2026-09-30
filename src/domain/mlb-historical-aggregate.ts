import { aggregateBatting, aggregatePitching } from "./player-period";
import type { BattingPeriodResult, PitchingPeriodResult, PeriodWindow } from "./player-period";
import type { PlayerGameBatting, PlayerGamePitching } from "./game-facts";
import type { HistoricalBatter, HistoricalPitcher } from "../data/mlb-historical";

export type DatedBatter = HistoricalBatter & { gameId: string; date: string; season: number; home: boolean; opponentTeamId: string };
export type DatedPitcher = HistoricalPitcher & { gameId: string; date: string; season: number; home: boolean; opponentTeamId: string };
const source = { sourceKey: "retrosheet-csv", sourceRecordId: "aggregate", collectedAt: "2026-09-30T00:00:00.000Z" };

export function battingAggregate(playerId: string, rows: readonly DatedBatter[], from: string, to: string,
  calculatedAt = new Date("2026-09-30T00:00:00.000Z")): BattingPeriodResult {
  const facts: PlayerGameBatting[] = rows.filter(row => row.date >= from && row.date <= to).map(row => ({
    ...source, gameId: row.gameId, playerId: row.playerId, teamId: row.teamId,
    opponentTeamId: row.opponentTeamId, battingOrder: row.battingOrder, pa: row.pa, ab: row.ab,
    runs: row.runs, hits: row.hits, doubles: row.doubles, triples: row.triples,
    homeRuns: row.homeRuns, rbi: row.rbi, walks: row.bb, hbp: row.hbp,
    sacrificeHits: row.sh, sacrificeFlies: row.sf, strikeouts: row.so,
    stolenBases: row.sb, caughtStealing: row.cs, starter: row.starter,
  }));
  const window: PeriodWindow = { from, to, timeZone: "source-local" };
  return aggregateBatting({ playerId, asOfDate: to, period: "30d" }, facts, calculatedAt, undefined, window);
}

export function pitchingAggregate(playerId: string, rows: readonly DatedPitcher[], from: string, to: string,
  calculatedAt = new Date("2026-09-30T00:00:00.000Z")): PitchingPeriodResult {
  const filtered = rows.filter(row => row.date >= from && row.date <= to);
  const facts: PlayerGamePitching[] = filtered.map(row => ({
    ...source, id: `${row.gameId}:${row.playerId}`, gameId: row.gameId, playerId: row.playerId,
    teamId: row.teamId, opponentTeamId: row.opponentTeamId,
    role: row.role, appearanceOrder: row.appearanceOrder, inningsPitchedOuts: row.outsRecorded,
    battersFaced: row.bf, hits: row.hits, homeRuns: row.homeRuns, walks: row.bb,
    hitBatters: row.hbp, strikeouts: row.so, runs: row.runs, earnedRuns: row.er,
    pitches: row.pitchCount, catcherId: null, starter: row.role === "unknown" ? null : row.role === "starter",
    decision: row.win ? "win" : row.loss ? "loss" : row.save ? "save" : "none",
  }));
  const window: PeriodWindow = { from, to, timeZone: "source-local" };
  const result = aggregatePitching({ playerId, asOfDate: to, period: "30d" }, facts, calculatedAt, undefined, window);
  // Retrosheet supplies independent W/L/SV flags. Do not compress them into one decision.
  for (const [metric, field] of [["W", "win"], ["L", "loss"], ["SV", "save"]] as const) {
    const known = filtered.filter(row => row[field] !== null);
    result.metrics[metric] = { value: known.length === filtered.length && filtered.length > 0
      ? known.filter(row => row[field]).length : null,
    status: filtered.length === 0 ? "unavailable" : known.length === filtered.length ? "complete" : "partial",
    observedFacts: known.length, factCount: filtered.length };
  }
  return result;
}

export function dateWindow(asOfDate: string, days: 7 | 14 | 30): { from: string; to: string } {
  const date = new Date(`${asOfDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid historical date");
  date.setUTCDate(date.getUTCDate() - days + 1);
  return { from: date.toISOString().slice(0, 10), to: asOfDate };
}
