import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('cricket.db');

export const initDB = () => {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      team1 TEXT NOT NULL,
      team2 TEXT NOT NULL,
      overs INTEGER NOT NULL,
      balls_per_over INTEGER DEFAULT 6,
      innings_count INTEGER DEFAULT 2,
      status TEXT DEFAULT 'live',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      team TEXT NOT NULL,
      match_id INTEGER,
      FOREIGN KEY (match_id) REFERENCES matches(id)
    );

    CREATE TABLE IF NOT EXISTS innings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      match_id INTEGER,
      innings_no INTEGER,
      batting_team TEXT,
      bowling_team TEXT,
      status TEXT DEFAULT 'live',
      FOREIGN KEY (match_id) REFERENCES matches(id)
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      innings_id INTEGER,
      over_no INTEGER,
      ball_no INTEGER,
      batsman_id INTEGER,
      bowler_id INTEGER,
      runs INTEGER DEFAULT 0,
      extras_type TEXT,
      extras_value INTEGER DEFAULT 0,
      is_wicket INTEGER DEFAULT 0,
      wicket_type TEXT,
      dismissed_player_id INTEGER,
      FOREIGN KEY (innings_id) REFERENCES innings(id)
    );
  `);
};

export default db;