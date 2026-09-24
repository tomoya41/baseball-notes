ALTER TABLE player_game_batting ADD COLUMN sacrifice_hits INTEGER;
ALTER TABLE player_game_batting ADD COLUMN sacrifice_flies INTEGER;
ALTER TABLE player_game_pitching ADD COLUMN hit_batters INTEGER;
ALTER TABLE player_game_pitching ADD COLUMN walks_and_hit_batters INTEGER;

CREATE TABLE IF NOT EXISTS npb_game_completeness (
  game_id TEXT PRIMARY KEY,
  batting_status TEXT NOT NULL,
  pitching_status TEXT NOT NULL,
  game_status TEXT NOT NULL,
  expected_batters INTEGER NOT NULL,
  collected_batters INTEGER NOT NULL,
  mapped_batters INTEGER NOT NULL,
  expected_pitchers INTEGER NOT NULL,
  collected_pitchers INTEGER NOT NULL,
  mapped_pitchers INTEGER NOT NULL,
  checks_json TEXT NOT NULL,
  issues_json TEXT NOT NULL,
  source_key TEXT NOT NULL,
  verified_at TEXT NOT NULL
);
