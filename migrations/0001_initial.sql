-- Arrow Puzzle DB schema
-- All timestamps are Unix seconds (INTEGER).

-- Players: one row per verified Eitaa user.
CREATE TABLE IF NOT EXISTS players (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  eitaa_user_id  TEXT    NOT NULL UNIQUE,
  first_name     TEXT,
  last_name      TEXT,
  username       TEXT,
  best_score     INTEGER NOT NULL DEFAULT 0,
  total_levels   INTEGER NOT NULL DEFAULT 0,  -- levels ever completed
  created_at     INTEGER NOT NULL,
  updated_at     INTEGER NOT NULL
);

-- Level progress: highest level unlocked per player.
CREATE TABLE IF NOT EXISTS player_progress (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  eitaa_user_id   TEXT    NOT NULL UNIQUE,
  max_level       INTEGER NOT NULL DEFAULT 1,   -- 1-indexed; level they can play next
  total_moves     INTEGER NOT NULL DEFAULT 0,
  updated_at      INTEGER NOT NULL,
  FOREIGN KEY (eitaa_user_id) REFERENCES players(eitaa_user_id) ON DELETE CASCADE
);

-- Game sessions: one row per play attempt (started but maybe not finished).
CREATE TABLE IF NOT EXISTS game_sessions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  eitaa_user_id   TEXT    NOT NULL,
  level           INTEGER NOT NULL,
  seed            TEXT    NOT NULL,             -- deterministic board seed
  started_at      INTEGER NOT NULL,             -- server timestamp
  finished_at     INTEGER,                      -- NULL if still in progress
  moves           INTEGER,                      -- move count on completion
  score           INTEGER,                      -- points awarded on completion
  FOREIGN KEY (eitaa_user_id) REFERENCES players(eitaa_user_id) ON DELETE CASCADE
);

-- Leaderboard: best score per player (denormalized for fast queries).
-- Updated transactionally when a session finishes with a better score.
CREATE TABLE IF NOT EXISTS leaderboard (
  rank_pos        INTEGER,                      -- computed at read time
  eitaa_user_id   TEXT    NOT NULL UNIQUE,
  display_name    TEXT    NOT NULL,
  best_score      INTEGER NOT NULL DEFAULT 0,
  levels_done     INTEGER NOT NULL DEFAULT 0,
  updated_at      INTEGER NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_players_best_score     ON players(best_score DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_user_level    ON game_sessions(eitaa_user_id, level);
CREATE INDEX IF NOT EXISTS idx_sessions_started       ON game_sessions(started_at);
CREATE INDEX IF NOT EXISTS idx_leaderboard_score      ON leaderboard(best_score DESC, levels_done DESC);
