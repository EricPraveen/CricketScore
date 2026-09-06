import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('cricket.db');

// Increment this whenever the schema changes — old DB will be wiped & recreated
const SCHEMA_VERSION = 3;

export const initDB = (): void => {
  // ── Schema-version guard ─────────────────────────────────────────────────
  let currentVersion = 0;
  try {
    const row = db.getFirstSync(
      'SELECT version FROM schema_version'
    ) as { version: number } | null;
    currentVersion = row?.version ?? 0;
  } catch {
    // schema_version table doesn't exist yet → fresh install
    currentVersion = 0;
  }

  if (currentVersion < SCHEMA_VERSION) {
    // Drop all tables so we can recreate with the new schema
    db.execSync(`
      DROP TABLE IF EXISTS deliveries;
      DROP TABLE IF EXISTS innings;
      DROP TABLE IF EXISTS players;
      DROP TABLE IF EXISTS matches;
      DROP TABLE IF EXISTS schema_version;
    `);
  }

  // ── Create all tables ────────────────────────────────────────────────────
  db.execSync(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matches (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      team1         TEXT    NOT NULL,
      team2         TEXT    NOT NULL,
      overs         INTEGER NOT NULL,
      balls_per_over INTEGER DEFAULT 6,
      innings_count INTEGER DEFAULT 2,
      status        TEXT    DEFAULT 'live',
      created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS players (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      name     TEXT    NOT NULL,
      team     TEXT    NOT NULL,
      match_id INTEGER,
      FOREIGN KEY (match_id) REFERENCES matches(id)
    );

    CREATE TABLE IF NOT EXISTS innings (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id     INTEGER,
      innings_no   INTEGER,
      batting_team TEXT,
      bowling_team TEXT,
      status       TEXT DEFAULT 'live',
      FOREIGN KEY (match_id) REFERENCES matches(id)
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id                  INTEGER PRIMARY KEY AUTOINCREMENT,
      innings_id          INTEGER NOT NULL,
      over_no             INTEGER NOT NULL,
      ball_no             INTEGER NOT NULL,
      batsman_id          INTEGER NOT NULL,
      non_striker_id      INTEGER NOT NULL,
      bowler_id           INTEGER NOT NULL,
      batsman_runs        INTEGER DEFAULT 0,
      extras_type         TEXT,              -- 'wide' | 'noball' | 'bye' | 'legbye' | NULL
      extras_value        INTEGER DEFAULT 0,
      is_legal_delivery   INTEGER DEFAULT 1, -- 0 for wide/noball
      is_wicket           INTEGER DEFAULT 0,
      wicket_type         TEXT,
      dismissed_player_id INTEGER,
      is_free_hit         INTEGER DEFAULT 0, -- 1 if THIS delivery was a free-hit
      FOREIGN KEY (innings_id) REFERENCES innings(id)
    );
  `);

  // Persist new version (only needed after a migration / fresh install)
  if (currentVersion < SCHEMA_VERSION) {
    db.runSync(
      'INSERT INTO schema_version (version) VALUES (?)',
      [SCHEMA_VERSION]
    );
  }
};

// Ensure database tables are created immediately upon module load
try {
  initDB();
} catch (e) {
  console.error('Error initializing database:', e);
}

export default db;
