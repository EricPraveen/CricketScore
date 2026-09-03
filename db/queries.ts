import db from './database';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Match {
  id: number;
  team1: string;
  team2: string;
  overs: number;
  innings_count: number;
  status: string;
  created_at: string;
}

export interface Player {
  id: number;
  name: string;
  team: string;
  match_id: number;
}

export interface Innings {
  id: number;
  match_id: number;
  innings_no: number;
  batting_team: string;
  bowling_team: string;
  status: string;
}

export interface Delivery {
  id: number;
  innings_id: number;
  over_no: number;
  ball_no: number;
  batsman_id: number;
  non_striker_id: number;
  bowler_id: number;
  batsman_runs: number;
  extras_type: string | null;
  extras_value: number;
  is_legal_delivery: number; // 0 or 1
  is_wicket: number;         // 0 or 1
  wicket_type: string | null;
  dismissed_player_id: number | null;
  is_free_hit: number;       // 0 or 1
}

export interface BatsmanStats {
  runs: number;
  balls_faced: number;
  fours: number;
  sixes: number;
}

export interface BowlerStats {
  balls_bowled: number;
  runs_given: number;
  wickets: number;
}

// ─── MATCHES ─────────────────────────────────────────────────────────────────

export const createMatch = (
  team1: string,
  team2: string,
  overs: number,
  inningsCount: number
): number => {
  const result = db.runSync(
    `INSERT INTO matches (team1, team2, overs, innings_count) VALUES (?, ?, ?, ?)`,
    [team1, team2, overs, inningsCount]
  );
  return result.lastInsertRowId;
};

export const getAllMatches = (): Match[] =>
  db.getAllSync(`SELECT * FROM matches ORDER BY created_at DESC`) as Match[];

export const getMatchById = (matchId: number): Match | null =>
  db.getFirstSync(`SELECT * FROM matches WHERE id = ?`, [matchId]) as Match | null;

export const updateMatchStatus = (matchId: number, status: string): void => {
  db.runSync(`UPDATE matches SET status = ? WHERE id = ?`, [status, matchId]);
};

/** Cascade-delete everything for a match */
export const deleteMatch = (matchId: number): void => {
  const innings = db.getAllSync(
    `SELECT id FROM innings WHERE match_id = ?`,
    [matchId]
  ) as { id: number }[];
  innings.forEach(inn =>
    db.runSync(`DELETE FROM deliveries WHERE innings_id = ?`, [inn.id])
  );
  db.runSync(`DELETE FROM innings  WHERE match_id = ?`, [matchId]);
  db.runSync(`DELETE FROM players  WHERE match_id = ?`, [matchId]);
  db.runSync(`DELETE FROM matches  WHERE id = ?`,       [matchId]);
};

// ─── PLAYERS ─────────────────────────────────────────────────────────────────

export const addPlayer = (
  name: string,
  team: string,
  matchId: number
): number => {
  const result = db.runSync(
    `INSERT INTO players (name, team, match_id) VALUES (?, ?, ?)`,
    [name, team, matchId]
  );
  return result.lastInsertRowId;
};

export const getPlayersByMatch = (matchId: number): Player[] =>
  db.getAllSync(
    `SELECT * FROM players WHERE match_id = ?`,
    [matchId]
  ) as Player[];

export const getPlayersByTeam = (matchId: number, team: string): Player[] =>
  db.getAllSync(
    `SELECT * FROM players WHERE match_id = ? AND team = ?`,
    [matchId, team]
  ) as Player[];

// ─── INNINGS ─────────────────────────────────────────────────────────────────

export const createInnings = (
  matchId: number,
  inningsNo: number,
  battingTeam: string,
  bowlingTeam: string
): number => {
  const result = db.runSync(
    `INSERT INTO innings (match_id, innings_no, batting_team, bowling_team) VALUES (?, ?, ?, ?)`,
    [matchId, inningsNo, battingTeam, bowlingTeam]
  );
  return result.lastInsertRowId;
};

export const getInningsByMatch = (matchId: number): Innings[] =>
  db.getAllSync(
    `SELECT * FROM innings WHERE match_id = ? ORDER BY innings_no ASC`,
    [matchId]
  ) as Innings[];

export const updateInningsStatus = (inningsId: number, status: string): void => {
  db.runSync(`UPDATE innings SET status = ? WHERE id = ?`, [status, inningsId]);
};

// ─── DELIVERIES ──────────────────────────────────────────────────────────────

/**
 * Record a single delivery.
 *
 * Legal delivery  → extras_type IS NULL | 'bye' | 'legbye'
 * Illegal delivery → extras_type 'wide' | 'noball'
 *
 * Scoring rules:
 *  - Normal (0-6):  batsman_runs = runs, extras_value = 0, legal = true
 *  - Wide:          batsman_runs = 0,    extras_value = 1, legal = false
 *  - No Ball:       batsman_runs = 0,    extras_value = 1, legal = false
 *  - Bye:           batsman_runs = 0,    extras_value = 1, legal = true
 *  - Leg Bye:       batsman_runs = 0,    extras_value = 1, legal = true
 */
export const addDelivery = (
  inningsId: number,
  overNo: number,
  ballNo: number,
  batsmanId: number,
  nonStrikerId: number,
  bowlerId: number,
  batsmanRuns: number,
  extrasType: string | null,
  extrasValue: number,
  isLegalDelivery: boolean,
  isWicket: boolean,
  wicketType: string | null,
  dismissedPlayerId: number | null,
  isFreeHit: boolean
): number => {
  const result = db.runSync(
    `INSERT INTO deliveries (
       innings_id, over_no, ball_no,
       batsman_id, non_striker_id, bowler_id,
       batsman_runs, extras_type, extras_value,
       is_legal_delivery, is_wicket, wicket_type,
       dismissed_player_id, is_free_hit
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      inningsId, overNo, ballNo,
      batsmanId, nonStrikerId, bowlerId,
      batsmanRuns, extrasType ?? null, extrasValue,
      isLegalDelivery ? 1 : 0,
      isWicket       ? 1 : 0,
      wicketType ?? null,
      dismissedPlayerId ?? null,
      isFreeHit ? 1 : 0,
    ]
  );
  return result.lastInsertRowId;
};

export const getDeliveriesByInnings = (inningsId: number): Delivery[] =>
  db.getAllSync(
    `SELECT * FROM deliveries WHERE innings_id = ? ORDER BY id ASC`,
    [inningsId]
  ) as Delivery[];

/** Returns the most-recently-recorded delivery for undo purposes. */
export const getLastDelivery = (inningsId: number): Delivery | null =>
  db.getFirstSync(
    `SELECT * FROM deliveries WHERE innings_id = ? ORDER BY id DESC LIMIT 1`,
    [inningsId]
  ) as Delivery | null;

export const undoLastDelivery = (inningsId: number): void => {
  db.runSync(
    `DELETE FROM deliveries WHERE id = (
       SELECT MAX(id) FROM deliveries WHERE innings_id = ?
     )`,
    [inningsId]
  );
};

// ─── SCORE CALCULATIONS (always derived from deliveries table) ────────────────

/** Team total = sum of all batsman runs + all extras */
export const getTotalRuns = (inningsId: number): number => {
  const result = db.getFirstSync(
    `SELECT COALESCE(SUM(batsman_runs + extras_value), 0) AS total
     FROM deliveries WHERE innings_id = ?`,
    [inningsId]
  ) as { total: number } | null;
  return result?.total ?? 0;
};

/** Count wickets (all is_wicket rows) */
export const getWickets = (inningsId: number): number => {
  const result = db.getFirstSync(
    `SELECT COUNT(*) AS wickets FROM deliveries
     WHERE innings_id = ? AND is_wicket = 1`,
    [inningsId]
  ) as { wickets: number } | null;
  return result?.wickets ?? 0;
};

/** Legal balls = rows where is_legal_delivery = 1 */
export const getLegalBalls = (inningsId: number): number => {
  const result = db.getFirstSync(
    `SELECT COUNT(*) AS balls FROM deliveries
     WHERE innings_id = ? AND is_legal_delivery = 1`,
    [inningsId]
  ) as { balls: number } | null;
  return result?.balls ?? 0;
};

/** Returns "X.Y" over display string (e.g. "3.4") */
export const getOversDisplay = (inningsId: number): string => {
  const balls = getLegalBalls(inningsId);
  return `${Math.floor(balls / 6)}.${balls % 6}`;
};

/**
 * Batsman stats:
 *  - runs        = SUM(batsman_runs)  — all deliveries they faced as striker
 *  - balls_faced = legal deliveries only (is_legal_delivery = 1)
 *  - fours/sixes = any delivery where batsman_runs = 4/6 (includes no-balls)
 */
export const getBatsmanStats = (
  inningsId: number,
  batsmanId: number
): BatsmanStats => {
  const result = db.getFirstSync(
    `SELECT
       COALESCE(SUM(batsman_runs), 0) AS runs,
       COUNT(CASE WHEN is_legal_delivery = 1 THEN 1 END) AS balls_faced,
       COUNT(CASE WHEN batsman_runs = 4 THEN 1 END) AS fours,
       COUNT(CASE WHEN batsman_runs = 6 THEN 1 END) AS sixes
     FROM deliveries
     WHERE innings_id = ? AND batsman_id = ?`,
    [inningsId, batsmanId]
  ) as BatsmanStats | null;
  return result ?? { runs: 0, balls_faced: 0, fours: 0, sixes: 0 };
};

/**
 * Bowler stats:
 *  - balls_bowled = legal deliveries they bowled
 *  - runs_given   = SUM(batsman_runs + extras_value) excluding byes & legbyes
 *  - wickets      = wickets credited to bowler (EXCLUDES Run Out)
 */
export const getBowlerStats = (
  inningsId: number,
  bowlerId: number
): BowlerStats => {
  const result = db.getFirstSync(
    `SELECT
       COUNT(CASE WHEN is_legal_delivery = 1 THEN 1 END) AS balls_bowled,
       COALESCE(SUM(
         CASE WHEN extras_type IS NULL OR extras_type NOT IN ('bye', 'legbye')
              THEN batsman_runs + extras_value
              ELSE 0 END
       ), 0) AS runs_given,
       COUNT(CASE WHEN is_wicket = 1
                   AND (wicket_type IS NULL OR wicket_type != 'Run Out')
                  THEN 1 END) AS wickets
     FROM deliveries
     WHERE innings_id = ? AND bowler_id = ?`,
    [inningsId, bowlerId]
  ) as BowlerStats | null;
  return result ?? { balls_bowled: 0, runs_given: 0, wickets: 0 };
};
