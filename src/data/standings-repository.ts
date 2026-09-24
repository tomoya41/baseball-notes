import { createHash, randomUUID } from "node:crypto";
import type { InStatement } from "@libsql/client";
import { standingSchema, type GameFact, type Standing, type StandingsRepository } from "../domain/standings";
import { calculateStandings } from "./standings-calculation";
import { normalizeRetrosheetGames } from "./retrosheet";
import { sourceRegistry } from "./source-registry";
import type { DataClient } from "./database";

function gameHash(game: GameFact): string {
  return createHash("sha256").update(JSON.stringify([
    game.id, game.season, game.playedOn, game.completedOn, game.homeTeamId,
    game.awayTeamId, game.homeRuns, game.awayRuns, game.sourceKey,
  ])).digest("hex");
}

export interface IngestSummary {
  runId: string;
  status: "succeeded" | "dry-run";
  targetDate: string;
  fetched: number;
  inserted: number;
  updated: number;
  skipped: number;
  snapshotDates: string[];
}

export class SqliteStandingsRepository implements StandingsRepository {
  constructor(private readonly client: DataClient) {}

  async findByDate(league: "MLB" | "NPB", date: string): Promise<Standing[]> {
    const result = await this.client.execute({
      sql: "SELECT * FROM standings_daily WHERE league = ? AND snapshot_date = ? ORDER BY competition_group, rank, team_id",
      args: [league, date],
    });
    return result.rows.map((row) => standingSchema.parse({
      date: row.snapshot_date, season: row.season, league: row.league,
      competitionGroup: row.competition_group, teamId: row.team_id, rank: row.rank,
      wins: row.wins, losses: row.losses, ties: row.ties, gamesPlayed: row.games_played,
      pct: row.pct, gamesBehindLeader: row.games_behind_leader, streak: row.streak,
      sourceKey: row.source_key, collectedAt: row.collected_at, calculatedAt: row.calculated_at,
    }));
  }

  async importRetrosheet2025(csv: string, targetDate: string, dryRun = false): Promise<IngestSummary> {
    if (!/^2025-\d{2}-\d{2}$/.test(targetDate)) throw new Error("Retrosheet 2025 supports only 2025 target dates");
    const runId = randomUUID();
    const startedAt = new Date().toISOString();
    if (!dryRun) await this.client.execute({
      sql: "INSERT INTO ingestion_runs (run_id, source_key, target_date, started_at, status) VALUES (?, 'retrosheet-csv', ?, ?, 'running')",
      args: [runId, targetDate, startedAt],
    });
    try {
      const games = normalizeRetrosheetGames(csv, 2025, startedAt);
      if (!games.some((game) => game.completedOn <= targetDate)) throw new Error("No completed games by target date");
      const existing = await this.client.execute("SELECT game_id, content_hash, completed_on FROM game_facts WHERE source_key = 'retrosheet-csv' AND season = 2025");
      const old = new Map(existing.rows.map((row) => [String(row.game_id), { hash: String(row.content_hash), completedOn: String(row.completed_on) }]));
      const incoming = new Set(games.map((game) => game.id));
      if ([...old.keys()].some((id) => !incoming.has(id))) throw new Error("Source lost previously imported games; manual review required");
      const statements: InStatement[] = [];
      let inserted = 0;
      let updated = 0;
      let skipped = 0;
      let earliestChange: string | null = null;
      for (const game of games) {
        const hash = gameHash(game);
        const previous = old.get(game.id);
        if (previous?.hash === hash) { skipped++; continue; }
        if (previous) updated++; else inserted++;
        const changeDate = previous ? [previous.completedOn, game.completedOn].sort()[0] : game.completedOn;
        if (changeDate && (earliestChange === null || changeDate < earliestChange)) earliestChange = changeDate;
        statements.push({
          sql: `INSERT INTO game_facts (game_id, league, season, played_on, completed_on, home_team_id, away_team_id, home_runs, away_runs, source_key, source_record_id, source_url, collected_at, content_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(game_id) DO UPDATE SET played_on=excluded.played_on, completed_on=excluded.completed_on,
                  home_team_id=excluded.home_team_id, away_team_id=excluded.away_team_id,
                  home_runs=excluded.home_runs, away_runs=excluded.away_runs,
                  source_url=excluded.source_url, collected_at=excluded.collected_at, content_hash=excluded.content_hash`,
          args: [game.id, game.league, game.season, game.playedOn, game.completedOn,
            game.homeTeamId, game.awayTeamId, game.homeRuns, game.awayRuns,
            game.sourceKey, game.sourceRecordId, game.sourceUrl, game.collectedAt, hash],
        });
      }
      const priorDates = await this.client.execute("SELECT DISTINCT snapshot_date FROM standings_daily WHERE league='MLB' AND season=2025");
      const snapshotDates = [...new Set([
        targetDate,
        ...priorDates.rows.map((row) => String(row.snapshot_date)).filter((date) => earliestChange !== null && date >= earliestChange),
      ])].sort();
      for (const date of snapshotDates) {
        const snapshot = calculateStandings(games, date, startedAt);
        if (snapshot.length !== 30) throw new Error(`Invalid snapshot team count for ${date}`);
        for (const row of snapshot) statements.push({
          sql: `INSERT INTO standings_daily (snapshot_date, season, league, competition_group, team_id, rank, wins, losses, ties, games_played, pct, games_behind_leader, streak, source_key, collected_at, calculated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(snapshot_date, league, competition_group, team_id) DO UPDATE SET
                  rank=excluded.rank, wins=excluded.wins, losses=excluded.losses, ties=excluded.ties,
                  games_played=excluded.games_played, pct=excluded.pct, games_behind_leader=excluded.games_behind_leader,
                  streak=excluded.streak, collected_at=excluded.collected_at, calculated_at=excluded.calculated_at`,
          args: [row.date, row.season, row.league, row.competitionGroup, row.teamId,
            row.rank, row.wins, row.losses, row.ties, row.gamesPlayed, row.pct,
            row.gamesBehindLeader, row.streak, row.sourceKey, row.collectedAt, row.calculatedAt],
        });
      }
      if (!dryRun) {
        await this.client.batch(statements, "write");
        await this.client.execute({
          sql: "UPDATE ingestion_runs SET finished_at=?, status='succeeded', fetched_count=?, inserted_count=?, updated_count=?, skipped_count=? WHERE run_id=?",
          args: [new Date().toISOString(), games.length, inserted, updated, skipped, runId],
        });
      }
      return { runId, status: dryRun ? "dry-run" : "succeeded", targetDate,
        fetched: games.length, inserted, updated, skipped, snapshotDates };
    } catch (error) {
      if (!dryRun) await this.client.execute({
        sql: "UPDATE ingestion_runs SET finished_at=?, status='failed', error_count=1, error_summary=? WHERE run_id=?",
        args: [new Date().toISOString(), String(error).slice(0, 500), runId],
      });
      throw error;
    }
  }
}

export async function syncSourceRegistry(client: DataClient): Promise<void> {
  await client.batch(sourceRegistry.map((source) => ({
    sql: `INSERT INTO data_sources (source_key, display_name, league, base_url, source_type, priority, status, update_cadence, terms_url, checked_on, categories_json, notes)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(source_key) DO UPDATE SET display_name=excluded.display_name, status=excluded.status,
            update_cadence=excluded.update_cadence, terms_url=excluded.terms_url,
            checked_on=excluded.checked_on, categories_json=excluded.categories_json, notes=excluded.notes`,
    args: [source.key, source.displayName, source.league, source.baseUrl, source.type, source.priority,
      source.status, source.updateCadence, source.termsUrl, source.checkedOn,
      JSON.stringify(source.categories), source.notes],
  })), "write");
}
