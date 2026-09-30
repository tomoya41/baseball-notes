import type { DataClient } from "./database";
import type { HistoricalPlateAppearance } from "../domain/mlb-plate-appearance";

// Released historical data lives in the local release SQLite, not the reserved
// NPB/Turso plate_appearances table. No NPB migration or remote write is needed.
export const paColumns = ["id", "league", "gameId", "season", "sequence", "inning", "half", "battingTeamId", "fieldingTeamId",
  "batterId", "pitcherId", "outsBefore", "baseStateBefore", "battingOrder", "battingScoreBefore", "fieldingScoreBefore",
  "result", "isAtBat", "hits", "doubles", "triples", "homeRuns", "walks", "intentionalWalks", "hbp", "strikeouts",
  "sacrificeHits", "sacrificeFlies", "substitutionDuringPa"] as const;
export async function createHistoricalPaTables(client: DataClient): Promise<void> {
  await client.executeMultiple("PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS mlb_historical_plate_appearances (
      id TEXT NOT NULL, league TEXT NOT NULL CHECK(league='MLB'), gameId TEXT NOT NULL, season INTEGER NOT NULL,
      sequence INTEGER NOT NULL, inning INTEGER NOT NULL, half TEXT NOT NULL,
      battingTeamId TEXT NOT NULL, fieldingTeamId TEXT NOT NULL, batterId TEXT NOT NULL, pitcherId TEXT NOT NULL,
      outsBefore INTEGER, baseStateBefore INTEGER, battingOrder INTEGER,
      battingScoreBefore INTEGER, fieldingScoreBefore INTEGER, result TEXT NOT NULL,
      isAtBat INTEGER NOT NULL, hits INTEGER NOT NULL, doubles INTEGER NOT NULL, triples INTEGER NOT NULL,
      homeRuns INTEGER NOT NULL, walks INTEGER NOT NULL, intentionalWalks INTEGER NOT NULL, hbp INTEGER NOT NULL,
      strikeouts INTEGER NOT NULL, sacrificeHits INTEGER NOT NULL, sacrificeFlies INTEGER NOT NULL,
      substitutionDuringPa INTEGER NOT NULL, PRIMARY KEY(gameId,sequence)
    ) WITHOUT ROWID;
    CREATE INDEX IF NOT EXISTS mlb_pa_batter_pitcher ON mlb_historical_plate_appearances(batterId,pitcherId,season);
    CREATE INDEX IF NOT EXISTS mlb_pa_pitcher_batter ON mlb_historical_plate_appearances(pitcherId,batterId,season);
    CREATE TABLE IF NOT EXISTS mlb_historical_pa_games (
      game_id TEXT PRIMARY KEY, season INTEGER NOT NULL, content_sha256 TEXT NOT NULL,
      pa_count INTEGER NOT NULL, report_json TEXT NOT NULL
    );
  `);
}
export async function replaceHistoricalPaGame(client: DataClient, gameId: string, season: number,
  rows: readonly HistoricalPlateAppearance[], hash: string, report: unknown): Promise<number> {
  const old = await client.execute({ sql: "SELECT content_sha256,report_json FROM mlb_historical_pa_games WHERE game_id=?", args: [gameId] });
  const reportJson = JSON.stringify(report);
  if (old.rows[0]?.content_sha256 === hash && old.rows[0]?.report_json === reportJson) return 0;
  // Corrections replace exactly one Game atomically, including removed PA rows.
  await client.batch([
    { sql: "DELETE FROM mlb_historical_plate_appearances WHERE gameId=?", args: [gameId] },
    ...rows.map(row => ({ sql: `INSERT INTO mlb_historical_plate_appearances (${paColumns.join(",")}) VALUES (${paColumns.map(() => "?").join(",")})`,
      args: paColumns.map(column => typeof row[column] === "boolean" ? Number(row[column]) : row[column]) })),
    { sql: `INSERT INTO mlb_historical_pa_games VALUES (?,?,?,?,?) ON CONFLICT(game_id) DO UPDATE SET
      season=excluded.season,content_sha256=excluded.content_sha256,pa_count=excluded.pa_count,report_json=excluded.report_json`,
    args: [gameId, season, hash, rows.length, reportJson] },
  ], "write");
  return rows.length + 2;
}
