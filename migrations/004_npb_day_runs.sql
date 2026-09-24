CREATE TABLE IF NOT EXISTS npb_day_runs (
  run_id TEXT PRIMARY KEY,
  target_date TEXT NOT NULL,
  trigger_kind TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  day_status TEXT NOT NULL CHECK (day_status IN ('complete','partial','no_games','failed')),
  operational_status TEXT NOT NULL CHECK (operational_status IN ('succeeded','completed_with_warning','failed')),
  scheduled_games INTEGER NOT NULL,
  final_games INTEGER NOT NULL,
  complete_games INTEGER NOT NULL,
  partial_games INTEGER NOT NULL,
  failed_games INTEGER NOT NULL,
  batter_rows INTEGER NOT NULL,
  pitcher_rows INTEGER NOT NULL,
  mapping_created INTEGER NOT NULL,
  requests INTEGER NOT NULL,
  retries INTEGER NOT NULL,
  backup_status TEXT NOT NULL,
  error_summary TEXT
);
CREATE INDEX IF NOT EXISTS npb_day_runs_date ON npb_day_runs (target_date, started_at);
