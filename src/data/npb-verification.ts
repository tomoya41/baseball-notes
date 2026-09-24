import type { DataClient } from "./database";
import { NpbRepository } from "./npb-repository";

export interface NpbDatabaseReport {
  targetDate: string;
  standings: number;
  games: number;
  battingFacts: number;
  pitchingFacts: number;
  stages: Record<string, string>;
  migrations: number[];
}

export async function verifyNpbDatabase(client: DataClient, targetDate: string): Promise<NpbDatabaseReport> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) throw new Error("Invalid target date");
  const repository = new NpbRepository(client);
  const [standings, gameCount, battingCount, pitchingCount, versionRows, stages] = await Promise.all([
    repository.findStandingsByDate(targetDate),
    client.execute("SELECT COUNT(*) AS n FROM npb_games"),
    client.execute("SELECT COUNT(*) AS n FROM player_game_batting"),
    client.execute("SELECT COUNT(*) AS n FROM player_game_pitching"),
    client.execute("SELECT version FROM schema_migrations ORDER BY version"),
    repository.findStageStatuses(targetDate),
  ]);
  const report: NpbDatabaseReport = {
    targetDate, standings: standings.length,
    games: Number(gameCount.rows[0]?.n ?? 0), battingFacts: Number(battingCount.rows[0]?.n ?? 0),
    pitchingFacts: Number(pitchingCount.rows[0]?.n ?? 0), stages,
    migrations: versionRows.rows.map((row) => Number(row.version)),
  };
  if (report.standings !== 12 || report.games === 0 || stages.standings !== "complete" || stages.games !== "complete" ||
    stages.batting !== "partial" || stages.pitching !== "partial" || !report.migrations.includes(2))
    throw new Error(`Incomplete NPB remote ingestion: ${JSON.stringify(report)}`);
  return report;
}
