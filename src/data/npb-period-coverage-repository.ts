import type { DataClient } from "./database";
import type { PeriodWindow } from "../domain/player-period";
import { evaluatePeriodCoverage, type DayCoverageEvidence, type GameCoverageEvidence,
  type PeriodCoverage } from "../domain/period-coverage";

export class NpbPeriodCoverageRepository {
  constructor(private readonly client: DataClient) {}

  async findPeriodCoverage(window: PeriodWindow): Promise<PeriodCoverage> {
    const [runRows, stageRows, gameRows] = await Promise.all([
      this.client.execute({ sql: `SELECT target_date,day_status,final_games,complete_games,partial_games,failed_games
        FROM (SELECT *,ROW_NUMBER() OVER (PARTITION BY target_date ORDER BY started_at DESC,run_id DESC) AS ordinal
          FROM npb_day_runs WHERE target_date BETWEEN ? AND ?) WHERE ordinal=1`,
      args: [window.from, window.to] }),
      this.client.execute({ sql: `SELECT target_date,status FROM npb_ingestion_stages
        WHERE stage='games' AND target_date BETWEEN ? AND ?`, args: [window.from, window.to] }),
      this.client.execute({ sql: `SELECT g.game_date,g.game_id,c.game_status,c.batting_status,c.pitching_status
        FROM npb_games g LEFT JOIN npb_game_completeness c ON c.game_id=g.game_id
        WHERE g.game_date BETWEEN ? AND ? AND g.status='final'`, args: [window.from, window.to] }),
    ]);
    const stages = new Map(stageRows.rows.map((row) => [String(row.target_date), String(row.status)]));
    const days: DayCoverageEvidence[] = runRows.rows.map((row) => ({
      date: String(row.target_date), dayStatus: String(row.day_status) as DayCoverageEvidence["dayStatus"],
      gamesStageStatus: stages.get(String(row.target_date)) ?? null,
      finalGames: Number(row.final_games), completeGames: Number(row.complete_games),
      partialGames: Number(row.partial_games), failedGames: Number(row.failed_games),
    }));
    const games: GameCoverageEvidence[] = gameRows.rows.map((row) => ({
      date: String(row.game_date), gameId: String(row.game_id),
      gameStatus: row.game_status === null ? null : String(row.game_status),
      battingStatus: row.batting_status === null ? null : String(row.batting_status),
      pitchingStatus: row.pitching_status === null ? null : String(row.pitching_status),
    }));
    return evaluatePeriodCoverage(window, days, games);
  }
}
