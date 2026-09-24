CREATE TABLE IF NOT EXISTS source_entity_mappings (
  source_key TEXT NOT NULL, entity_kind TEXT NOT NULL, source_entity_id TEXT NOT NULL,
  internal_entity_id TEXT NOT NULL, source_url TEXT NOT NULL,
  first_seen TEXT NOT NULL, last_seen TEXT NOT NULL,
  PRIMARY KEY (source_key, entity_kind, source_entity_id)
);
CREATE TABLE IF NOT EXISTS npb_games (
  game_id TEXT PRIMARY KEY, season INTEGER NOT NULL, game_date TEXT NOT NULL,
  home_team_id TEXT NOT NULL, away_team_id TEXT NOT NULL, game_number INTEGER NOT NULL,
  venue TEXT, scheduled_time TEXT, status TEXT NOT NULL,
  home_score INTEGER, away_score INTEGER, source_key TEXT NOT NULL,
  source_record_id TEXT NOT NULL, source_url TEXT NOT NULL, collected_at TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  UNIQUE (season, game_date, home_team_id, away_team_id, game_number)
);
CREATE INDEX IF NOT EXISTS npb_games_date ON npb_games (game_date);
CREATE TABLE IF NOT EXISTS npb_ingestion_stages (
  target_date TEXT NOT NULL, stage TEXT NOT NULL,
  status TEXT NOT NULL, record_count INTEGER NOT NULL,
  updated_at TEXT NOT NULL, error_summary TEXT,
  PRIMARY KEY (target_date, stage)
);
ALTER TABLE player_game_batting ADD COLUMN runs INTEGER;
ALTER TABLE player_game_batting ADD COLUMN starter INTEGER;
ALTER TABLE player_game_batting ADD COLUMN source_url TEXT;
ALTER TABLE player_game_pitching ADD COLUMN starter INTEGER;
ALTER TABLE player_game_pitching ADD COLUMN decision TEXT;
ALTER TABLE player_game_pitching ADD COLUMN source_url TEXT;
