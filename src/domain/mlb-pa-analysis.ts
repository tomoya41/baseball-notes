import { battingAggregate, type DatedBatter } from "./mlb-historical-aggregate";
import { addPaCounts, emptyPaCounts, type HistoricalPlateAppearance, type PaCounts } from "./mlb-plate-appearance";

export type PaAnalysisLine = { PA: number; AB: number; H: number; "2B": number; "3B": number; HR: number;
  BB: number; HBP: number; SO: number; SH: number; SF: number;
  AVG: number | null; OBP: number | null; SLG: number | null; OPS: number | null };
export function paAnalysisMetrics(counts: PaCounts): PaAnalysisLine {
  const row: DatedBatter = { playerId: "pa-read-model", gameId: "pa-read-model", teamId: "pa-read-model",
    opponentTeamId: "pa-read-model", date: "2025-01-01", season: 2025, home: false, battingOrder: null,
    appearanceOrder: null, starter: null, pa: counts.PA, ab: counts.isAtBat, hits: counts.hits, doubles: counts.doubles,
    triples: counts.triples, homeRuns: counts.homeRuns, bb: counts.walks, hbp: counts.hbp, sh: counts.sacrificeHits,
    sf: counts.sacrificeFlies, so: counts.strikeouts, runs: null, rbi: null, sb: null, cs: null };
  const metrics = battingAggregate(row.playerId, [row], row.date, row.date).metrics;
  return Object.fromEntries(["PA", "AB", "H", "2B", "3B", "HR", "BB", "HBP", "SO", "SH", "SF", "AVG", "OBP", "SLG", "OPS"]
    .map(key => [key, metrics[key as keyof typeof metrics].value])) as PaAnalysisLine;
}

export function exactBvp(rows: readonly HistoricalPlateAppearance[], batterId: string, pitcherId: string,
  season?: number): PaAnalysisLine {
  const total = emptyPaCounts();
  for (const row of rows) if (row.batterId === batterId && row.pitcherId === pitcherId && (season === undefined || row.season === season)) addPaCounts(total, row);
  return paAnalysisMetrics(total);
}

export interface AdvancedPlayerPayload {
  schemaVersion: 1; league: "MLB"; playerId: string; scope: string;
  directBvp: "ready" | "not_ready"; situations: "ready" | "not_ready";
  batting: { opponents: AdvancedOpponent[]; splits: AdvancedSplit[] };
  pitching: { opponents: AdvancedOpponent[]; splits: AdvancedSplit[] };
}
export interface AdvancedOpponent { playerId: string; name: string; metrics: PaAnalysisLine }
export interface AdvancedSplit { key: string; metrics: PaAnalysisLine; unknownPa: number }

export function historicalAdvancedGate(reports: readonly { season: number; expectedGames: number; games: number; reconstructedGames: number; skippedGames: number;
  parserFailures: number; identityUnresolved: number; mismatches: readonly unknown[]; stateIssues: Record<string, number> }[]) {
  const directBvp = reports.length === 6 && new Set(reports.map(report => report.season)).size === 6 &&
    reports.every(report => report.season >= 2020 && report.season <= 2025 && report.games > 0 &&
    report.games === report.expectedGames && report.games === report.reconstructedGames &&
    report.skippedGames === 0 && report.parserFailures === 0 && report.identityUnresolved === 0 && report.mismatches.length === 0 &&
    !(report.stateIssues.final_score || report.stateIssues.defensive_outs));
  const situations = directBvp && reports.every(report => Object.values(report.stateIssues).every(count => count === 0));
  return { directBvp: directBvp ? "ready" as const : "not_ready" as const,
    situations: situations ? "ready" as const : "not_ready" as const };
}
