CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS data_sources (
  source_key TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  league TEXT NOT NULL,
  base_url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  priority INTEGER NOT NULL,
  status TEXT NOT NULL,
  update_cadence TEXT NOT NULL,
  terms_url TEXT NOT NULL,
  checked_on TEXT NOT NULL,
  categories_json TEXT NOT NULL,
  notes TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  run_id TEXT PRIMARY KEY,
  source_key TEXT NOT NULL,
  target_date TEXT NOT NULL,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('running','succeeded','failed','partial','skipped')),
  fetched_count INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT
);

CREATE TABLE IF NOT EXISTS game_facts (
  game_id TEXT PRIMARY KEY,
  league TEXT NOT NULL,
  season INTEGER NOT NULL,
  played_on TEXT NOT NULL,
  completed_on TEXT NOT NULL,
  home_team_id TEXT NOT NULL,
  away_team_id TEXT NOT NULL,
  home_runs INTEGER NOT NULL CHECK (home_runs >= 0),
  away_runs INTEGER NOT NULL CHECK (away_runs >= 0),
  source_key TEXT NOT NULL,
  source_record_id TEXT NOT NULL,
  source_url TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  UNIQUE (source_key, source_record_id)
);
CREATE INDEX IF NOT EXISTS game_facts_season_completion ON game_facts (league, season, completed_on);

CREATE TABLE IF NOT EXISTS standings_daily (
  snapshot_date TEXT NOT NULL,
  season INTEGER NOT NULL,
  league TEXT NOT NULL,
  competition_group TEXT NOT NULL,
  team_id TEXT NOT NULL,
  rank INTEGER NOT NULL CHECK (rank > 0),
  wins INTEGER NOT NULL CHECK (wins >= 0),
  losses INTEGER NOT NULL CHECK (losses >= 0),
  ties INTEGER NOT NULL CHECK (ties >= 0),
  games_played INTEGER NOT NULL CHECK (games_played >= 0),
  pct REAL NOT NULL,
  games_behind_leader REAL NOT NULL,
  streak INTEGER NOT NULL,
  source_key TEXT NOT NULL,
  collected_at TEXT NOT NULL,
  calculated_at TEXT NOT NULL,
  PRIMARY KEY (snapshot_date, league, competition_group, team_id)
);
CREATE INDEX IF NOT EXISTS standings_team_history ON standings_daily (team_id, snapshot_date);

-- Reserved fact tables. Their adapters remain disabled until source rights and field quality are verified.
CREATE TABLE IF NOT EXISTS player_game_batting (
  game_id TEXT NOT NULL, player_id TEXT NOT NULL, team_id TEXT NOT NULL, opponent_team_id TEXT,
  batting_order INTEGER, pa INTEGER, ab INTEGER, hits INTEGER, doubles INTEGER, triples INTEGER,
  home_runs INTEGER, rbi INTEGER, walks INTEGER, strikeouts INTEGER, hbp INTEGER, sb INTEGER, cs INTEGER,
  source_key TEXT NOT NULL, source_record_id TEXT NOT NULL, collected_at TEXT NOT NULL,
  PRIMARY KEY (game_id, player_id, team_id)
);
CREATE TABLE IF NOT EXISTS player_game_pitching (
  fact_id TEXT PRIMARY KEY, game_id TEXT NOT NULL, player_id TEXT NOT NULL, team_id TEXT NOT NULL, opponent_team_id TEXT,
  role TEXT, appearance_order INTEGER, ip_outs INTEGER, batters_faced INTEGER, hits INTEGER,
  home_runs INTEGER, walks INTEGER, strikeouts INTEGER, runs INTEGER, earned_runs INTEGER,
  pitches INTEGER, catcher_id TEXT,
  source_key TEXT NOT NULL, source_record_id TEXT NOT NULL, collected_at TEXT NOT NULL,
  UNIQUE (source_key, source_record_id)
);
CREATE TABLE IF NOT EXISTS pitcher_appearances (
  appearance_id TEXT PRIMARY KEY, game_id TEXT NOT NULL, pitcher_id TEXT NOT NULL,
  entered_inning INTEGER, exited_inning INTEGER, innings_pitched_outs INTEGER,
  pitches INTEGER, batters_faced INTEGER, role TEXT, previous_appearance_date TEXT,
  source_key TEXT NOT NULL, source_record_id TEXT NOT NULL, collected_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plate_appearances (
  appearance_id TEXT PRIMARY KEY, game_id TEXT NOT NULL, batter_id TEXT NOT NULL,
  pitcher_id TEXT, batting_order INTEGER, game_inning INTEGER, half_inning TEXT,
  outs_before INTEGER, base_state INTEGER, score_differential_before INTEGER,
  result_code TEXT, rbi INTEGER,
  source_key TEXT NOT NULL, source_record_id TEXT NOT NULL, collected_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS master_history (
  entity_kind TEXT NOT NULL, entity_id TEXT NOT NULL, valid_from TEXT NOT NULL,
  payload_json TEXT NOT NULL, source_key TEXT NOT NULL, source_record_id TEXT NOT NULL,
  collected_at TEXT NOT NULL, PRIMARY KEY (entity_kind, entity_id, valid_from)
);
CREATE TABLE IF NOT EXISTS permanent_events (
  event_id TEXT PRIMARY KEY, event_kind TEXT NOT NULL, event_date TEXT NOT NULL,
  entity_id TEXT, payload_json TEXT NOT NULL, source_key TEXT NOT NULL,
  source_record_id TEXT NOT NULL, collected_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS season_finals (
  league TEXT NOT NULL, season INTEGER NOT NULL, entity_kind TEXT NOT NULL,
  entity_id TEXT NOT NULL, stats_json TEXT NOT NULL, source_key TEXT NOT NULL,
  collected_at TEXT NOT NULL, PRIMARY KEY (league, season, entity_kind, entity_id)
);

CREATE TABLE IF NOT EXISTS derived_payloads (
  payload_key TEXT PRIMARY KEY, algorithm_version TEXT NOT NULL, source_revision TEXT NOT NULL,
  as_of_date TEXT NOT NULL, payload_json TEXT NOT NULL, generated_at TEXT NOT NULL,
  expires_at TEXT
);
CREATE TABLE IF NOT EXISTS display_cache (
  cache_key TEXT PRIMARY KEY, payload_json TEXT NOT NULL, generated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS raw_response_manifest (
  object_key TEXT PRIMARY KEY, source_key TEXT NOT NULL, archive_class TEXT NOT NULL,
  stored_at TEXT NOT NULL, expires_at TEXT NOT NULL
);
