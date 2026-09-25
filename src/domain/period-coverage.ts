import type { PeriodWindow } from "./player-period";

export type PeriodCoverageStatus = "complete" | "partial" | "unknown" | "unavailable";
export type CoverageDayStatus = "complete" | "partial" | "failed" | "no_games" | "unknown";
export type CoverageCalendarDay = { date: string; status: CoverageDayStatus; finalGames: number };
export type CoverageSummary = { dates: number; complete: number; partial: number; failed: number;
  noGames: number; unknown: number };
export type DayCoverageEvidence = {
  date: string;
  dayStatus: "complete" | "partial" | "no_games" | "failed" | null;
  gamesStageStatus: string | null;
  finalGames: number | null;
  completeGames: number | null;
  partialGames: number | null;
  failedGames: number | null;
};
export type GameCoverageEvidence = {
  date: string;
  gameId: string;
  gameStatus: string | null;
  battingStatus: string | null;
  pitchingStatus: string | null;
};
export type PeriodCoverage = Pick<PeriodWindow, "from" | "to"> & {
  status: PeriodCoverageStatus;
  calendar: CoverageCalendarDay[];
  summary: CoverageSummary;
  finalGameDates: string[];
  completeGameDates: string[];
  noGameDates: string[];
  partialDates: string[];
  unknownDates: string[];
};

export function periodDates(window: PeriodWindow): string[] {
  const result: string[] = [];
  const day = new Date(`${window.from}T00:00:00Z`);
  while (day.toISOString().slice(0, 10) <= window.to) {
    result.push(day.toISOString().slice(0, 10));
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return result;
}

export function unavailablePeriodCoverage(window: PeriodWindow): PeriodCoverage {
  return { from: window.from, to: window.to, status: "unavailable", finalGameDates: [],
    completeGameDates: [], noGameDates: [], partialDates: [], unknownDates: [], calendar: [],
    summary: { dates: periodDates(window).length, complete: 0, partial: 0, failed: 0, noGames: 0, unknown: 0 } };
}

// League-wide proof is conservative: a player's day without a Fact is never itself a gap.
export function evaluatePeriodCoverage(window: PeriodWindow,
  days: readonly DayCoverageEvidence[], games: readonly GameCoverageEvidence[]): PeriodCoverage {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const gamesByDate = new Map<string, GameCoverageEvidence[]>();
  for (const game of games) {
    const rows = gamesByDate.get(game.date) ?? [];
    rows.push(game);
    gamesByDate.set(game.date, rows);
  }
  const coverage: PeriodCoverage = { from: window.from, to: window.to, status: "complete",
    finalGameDates: [], completeGameDates: [], noGameDates: [], partialDates: [], unknownDates: [], calendar: [],
    summary: { dates: 0, complete: 0, partial: 0, failed: 0, noGames: 0, unknown: 0 } };
  function record(date: string, status: CoverageDayStatus, finalGames: number): void {
    coverage.calendar.push({ date, status, finalGames });
    coverage.summary.dates += 1;
    if (status === "no_games") coverage.summary.noGames += 1;
    else coverage.summary[status] += 1;
    if (status === "complete") coverage.completeGameDates.push(date);
    else if (status === "no_games") coverage.noGameDates.push(date);
    else if (status === "unknown") coverage.unknownDates.push(date);
    else coverage.partialDates.push(date);
  }
  for (const date of periodDates(window)) {
    const day = byDate.get(date);
    const finalGames = gamesByDate.get(date) ?? [];
    if (finalGames.length) coverage.finalGameDates.push(date);
    if (day?.dayStatus === "failed" || day?.gamesStageStatus === "failed" ||
      finalGames.some((game) => game.gameStatus === "failed")) {
      record(date, "failed", finalGames.length);
      continue;
    }
    if (day?.dayStatus === "partial" || day?.gamesStageStatus === "partial" ||
      finalGames.some((game) => game.gameStatus != null && game.gameStatus !== "complete")) {
      record(date, "partial", finalGames.length);
      continue;
    }
    if (!day || day.gamesStageStatus !== "complete") {
      record(date, "unknown", finalGames.length);
      continue;
    }
    if (day.dayStatus === "no_games") {
      if (day.finalGames === 0 && day.completeGames === 0 && day.partialGames === 0 &&
        day.failedGames === 0 && finalGames.length === 0) record(date, "no_games", 0);
      else record(date, "partial", finalGames.length);
      continue;
    }
    if (day.dayStatus !== "complete" || day.finalGames === null || day.finalGames === 0 ||
      day.finalGames !== finalGames.length || day.completeGames !== finalGames.length ||
      day.partialGames !== 0 || day.failedGames !== 0 ||
      finalGames.some((game) => game.gameStatus !== "complete" ||
        game.battingStatus !== "complete" || game.pitchingStatus !== "complete")) {
      record(date, "partial", finalGames.length);
      continue;
    }
    record(date, "complete", finalGames.length);
  }
  coverage.status = coverage.partialDates.length ? "partial" : coverage.unknownDates.length ? "unknown" : "complete";
  return coverage;
}
