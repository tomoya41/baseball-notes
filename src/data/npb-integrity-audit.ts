import { createHash } from "node:crypto";
import type { DataClient } from "./database";
import { NpbPeriodCoverageRepository } from "./npb-period-coverage-repository";
import type { PeriodWindow } from "../domain/player-period";

// Only SELECTs; no migrations, collectors, repairs or inferred completion evidence.
export async function auditNpbIntegrity(client: DataClient, window: PeriodWindow, asOfDate: string) {
  const season = Number(window.from.slice(0, 4));
  const pending = await client.execute({ sql: `SELECT g.*,c.game_status,c.batting_status,c.pitching_status,
    c.expected_batters,c.collected_batters,c.mapped_batters,c.expected_pitchers,c.collected_pitchers,
    c.mapped_pitchers,c.checks_json,c.issues_json,c.verified_at,
    (SELECT COUNT(*) FROM player_game_batting b WHERE b.game_id=g.game_id) AS saved_batting,
    (SELECT COUNT(*) FROM player_game_batting b WHERE b.game_id=g.game_id AND b.pa IS NULL) AS unknown_pa,
    (SELECT COUNT(*) FROM player_game_pitching p WHERE p.game_id=g.game_id) AS saved_pitching,
    (SELECT SUM(ip_outs) FROM player_game_pitching p WHERE p.game_id=g.game_id AND p.team_id=g.home_team_id) AS home_outs,
    (SELECT SUM(ip_outs) FROM player_game_pitching p WHERE p.game_id=g.game_id AND p.team_id=g.away_team_id) AS away_outs,
    (SELECT payload_json FROM permanent_events e WHERE e.event_id='npb:shortened-final:'||g.game_id) AS shortened_evidence
    FROM npb_games g LEFT JOIN npb_game_completeness c ON c.game_id=g.game_id
    WHERE g.season=? AND g.game_date<=? AND
    (g.status NOT IN ('final','postponed','canceled') OR
     (g.status='final' AND COALESCE(c.game_status,'unknown')!='complete'))
    ORDER BY g.game_date,g.game_id`, args: [season, asOfDate] });
  const coverage = await new NpbPeriodCoverageRepository(client).findPeriodCoverage(window);
  const days = await client.execute({ sql: `SELECT * FROM (SELECT *,ROW_NUMBER() OVER
    (PARTITION BY target_date ORDER BY started_at DESC,run_id DESC) AS ordinal FROM npb_day_runs
    WHERE target_date BETWEEN ? AND ?) WHERE ordinal=1 ORDER BY target_date`, args: [window.from, asOfDate] });
  const stages = await client.execute({ sql: "SELECT * FROM npb_ingestion_stages WHERE target_date BETWEEN ? AND ? ORDER BY target_date,stage",
    args: [window.from, asOfDate] });
  const boundary = await client.execute({ sql: `SELECT g.*,c.game_status,c.batting_status,c.pitching_status,
    (SELECT COUNT(*) FROM player_game_batting b WHERE b.game_id=g.game_id) AS saved_batting,
    (SELECT COUNT(*) FROM player_game_pitching p WHERE p.game_id=g.game_id) AS saved_pitching
    FROM npb_games g LEFT JOIN npb_game_completeness c ON c.game_id=g.game_id
    WHERE g.season=? AND g.game_date>=? ORDER BY g.game_date,g.game_id`, args: [season, window.to] });
  const parse = (value: unknown) => value == null ? null : JSON.parse(String(value)) as unknown;
  return { season, window, asOfDate, pendingGames: pending.rows.map(({ checks_json, issues_json, shortened_evidence, ...r }) =>
    ({ ...r, checks: parse(checks_json), issues: parse(issues_json), shortenedEvidence: parse(shortened_evidence) })),
  boundaryGames: boundary.rows, coverage, partialDays: coverage.calendar.filter(d => d.status !== "complete" && d.status !== "no_games")
    .map(d => ({ ...d, latestRun: days.rows.find(r => r.target_date === d.date) ?? null,
      stages: stages.rows.filter(r => r.target_date === d.date) })),
  boundaryDays: days.rows.filter(r => String(r.target_date) >= window.to) };
}

export async function hashNpbIntegrity(client: DataClient) {
  const tables = ["npb_games", "player_game_batting", "player_game_pitching", "npb_game_completeness",
    "npb_day_runs", "npb_ingestion_stages", "permanent_events", "master_history"] as const;
  const result: Record<string, { count: number; sha256: string }> = {};
  for (const table of tables) {
    // Fixed table names only. Database row values never appear in the output.
    const rows = (await client.execute(`SELECT * FROM ${table} ORDER BY rowid`)).rows;
    result[table] = { count: rows.length, sha256: createHash("sha256").update(JSON.stringify(rows)).digest("hex") };
  }
  return result;
}
