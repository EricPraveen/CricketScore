import db from './database';

// ─── MATCH ───────────────────────────────────────────

export const createMatch = (team1, team2, overs, inningsCount) => {
  const result = db.runSync(
    `INSERT INTO matches (team1, team2, overs, innings_count)
     VALUES (?, ?, ?, ?)`,
    [team1, team2, overs, inningsCount]
  );
  return result.lastInsertRowId;
};

export const getAllMatches = () => {
  return db.getAllSync(`SELECT * FROM matches ORDER BY created_at DESC`);
};

export const getMatchById = (matchId) => {
  return db.getFirstSync(`SELECT * FROM matches WHERE id = ?`, [matchId]);
};

export const updateMatchStatus = (matchId, status) => {
  db.runSync(`UPDATE matches SET status = ? WHERE id = ?`, [status, matchId]);
};

// Cascade-delete: deliveries → innings → players → match
export const deleteMatch = (matchId) => {
  const innings = db.getAllSync(
    `SELECT id FROM innings WHERE match_id = ?`, [matchId]
  );
  innings.forEach(inn => {
    db.runSync(`DELETE FROM deliveries WHERE innings_id = ?`, [inn.id]);
  });
  db.runSync(`DELETE FROM innings WHERE match_id = ?`,  [matchId]);
  db.runSync(`DELETE FROM players WHERE match_id = ?`,  [matchId]);
  db.runSync(`DELETE FROM matches WHERE id = ?`,        [matchId]);
};

// ─── PLAYERS ─────────────────────────────────────────

export const addPlayer = (name, team, matchId) => {
  const result = db.runSync(
    `INSERT INTO players (name, team, match_id) VALUES (?, ?, ?)`,
    [name, team, matchId]
  );
  return result.lastInsertRowId;
};

export const getPlayersByMatch = (matchId) => {
  return db.getAllSync(
    `SELECT * FROM players WHERE match_id = ?`,
    [matchId]
  );
};

export const getPlayersByTeam = (matchId, team) => {
  return db.getAllSync(
    `SELECT * FROM players WHERE match_id = ? AND team = ?`,
    [matchId, team]
  );
};

// ─── INNINGS ─────────────────────────────────────────

export const createInnings = (matchId, inningsNo, battingTeam, bowlingTeam) => {
  const result = db.runSync(
    `INSERT INTO innings (match_id, innings_no, batting_team, bowling_team)
     VALUES (?, ?, ?, ?)`,
    [matchId, inningsNo, battingTeam, bowlingTeam]
  );
  return result.lastInsertRowId;
};

export const getInningsByMatch = (matchId) => {
  return db.getAllSync(
    `SELECT * FROM innings WHERE match_id = ? ORDER BY innings_no ASC`,
    [matchId]
  );
};

export const updateInningsStatus = (inningsId, status) => {
  db.runSync(
    `UPDATE innings SET status = ? WHERE id = ?`,
    [status, inningsId]
  );
};

// ─── DELIVERIES ──────────────────────────────────────

export const addDelivery = (
  inningsId, overNo, ballNo,
  batsmanId, bowlerId, runs,
  extrasType, extrasValue,
  isWicket, wicketType, dismissedPlayerId
) => {
  const result = db.runSync(
    `INSERT INTO deliveries (
      innings_id, over_no, ball_no,
      batsman_id, bowler_id, runs,
      extras_type, extras_value,
      is_wicket, wicket_type, dismissed_player_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      inningsId, overNo, ballNo,
      batsmanId, bowlerId, runs,
      extrasType, extrasValue,
      isWicket ? 1 : 0, wicketType, dismissedPlayerId
    ]
  );
  return result.lastInsertRowId;
};

export const getDeliveriesByInnings = (inningsId) => {
  return db.getAllSync(
    `SELECT * FROM deliveries WHERE innings_id = ? ORDER BY id ASC`,
    [inningsId]
  );
};

export const undoLastDelivery = (inningsId) => {
  db.runSync(
    `DELETE FROM deliveries WHERE id = (
      SELECT MAX(id) FROM deliveries WHERE innings_id = ?
    )`,
    [inningsId]
  );
};

// ─── SCORECARD ───────────────────────────────────────

export const getTotalRuns = (inningsId) => {
  const result = db.getFirstSync(
    `SELECT COALESCE(SUM(runs + extras_value), 0) as total
     FROM deliveries WHERE innings_id = ?`,
    [inningsId]
  );
  return result?.total || 0;
};

export const getWickets = (inningsId) => {
  const result = db.getFirstSync(
    `SELECT COUNT(*) as wickets
     FROM deliveries
     WHERE innings_id = ? AND is_wicket = 1`,
    [inningsId]
  );
  return result?.wickets || 0;
};

// Legal balls: wides & no-balls do NOT count as a ball bowled
export const getLegalBalls = (inningsId) => {
  const result = db.getFirstSync(
    `SELECT COUNT(*) as balls
     FROM deliveries
     WHERE innings_id = ?
     AND (extras_type IS NULL OR extras_type NOT IN ('wide', 'noball'))`,
    [inningsId]
  );
  return result?.balls || 0;
};

export const getOversDisplay = (inningsId) => {
  const balls = getLegalBalls(inningsId);
  return `${Math.floor(balls / 6)}.${balls % 6}`;
};

// Batsman's runs = off the bat only (not byes/wides); balls faced excludes wides
export const getBatsmanStats = (inningsId, batsmanId) => {
  const result = db.getFirstSync(
    `SELECT
       COALESCE(SUM(CASE WHEN extras_type IS NULL OR extras_type = 'noball' THEN runs ELSE 0 END), 0) AS runs,
       COUNT(CASE WHEN extras_type IS NULL OR extras_type = 'noball' THEN 1 END) AS balls_faced,
       COUNT(CASE WHEN (extras_type IS NULL OR extras_type = 'noball') AND runs = 4 THEN 1 END) AS fours,
       COUNT(CASE WHEN (extras_type IS NULL OR extras_type = 'noball') AND runs = 6 THEN 1 END) AS sixes
     FROM deliveries
     WHERE innings_id = ? AND batsman_id = ?`,
    [inningsId, batsmanId]
  );
  return result || { runs: 0, balls_faced: 0, fours: 0, sixes: 0 };
};

// Bowler's runs = all runs except byes; balls_bowled excludes wides & no-balls
export const getBowlerStats = (inningsId, bowlerId) => {
  const result = db.getFirstSync(
    `SELECT
       COALESCE(SUM(
         CASE WHEN extras_type IS NULL OR extras_type NOT IN ('bye', 'legbye')
           THEN runs + extras_value ELSE 0 END
       ), 0) AS runs_given,
       COUNT(CASE WHEN extras_type IS NULL OR extras_type NOT IN ('wide', 'noball') THEN 1 END) AS balls_bowled,
       COALESCE(SUM(is_wicket), 0) AS wickets
     FROM deliveries
     WHERE innings_id = ? AND bowler_id = ?`,
    [inningsId, bowlerId]
  );
  return result || { runs_given: 0, balls_bowled: 0, wickets: 0 };
};