import { Delivery, Player } from '../db/queries';

export interface FallOfWicket {
  wicketNum: number;
  score: number;
  overs: string;
  batsmanName: string;
  batsmanId: number;
}

export interface PartnershipBatter {
  id: number;
  name: string;
  runs: number;
  balls: number;
}

export interface Partnership {
  wicketNum: number;
  isUnbroken: boolean;
  totalRuns: number;
  totalBalls: number;
  batsman1: PartnershipBatter;
  batsman2: PartnershipBatter;
  extras: number;
}

/**
 * Calculates Fall of Wickets for an innings in chronological order.
 */
export function calculateFallOfWickets(
  deliveries: Delivery[],
  players: Player[],
  ballsPerOver: number = 6
): FallOfWicket[] {
  const playerMap = new Map<number, Player>();
  players.forEach(p => playerMap.set(p.id, p));

  const fow: FallOfWicket[] = [];
  let runningScore = 0;
  let legalBalls = 0;
  let wicketCount = 0;

  for (const d of deliveries) {
    const ballExtras =
      (d.wide_runs ?? (d.extras_type === 'wide' ? d.extras_value : 0)) +
      (d.noball_runs ?? (d.extras_type === 'noball' ? (d.extras_value > 0 ? d.extras_value : 1) : 0)) +
      (d.bye_runs ?? (d.extras_type === 'bye' ? d.extras_value : 0)) +
      (d.legbye_runs ?? (d.extras_type === 'legbye' ? d.extras_value : 0)) +
      (d.penalty_runs ?? (d.extras_type === 'penalty' ? d.extras_value : 0));

    runningScore += (d.batsman_runs ?? 0) + ballExtras;

    if (d.is_legal_delivery === 1) {
      legalBalls++;
    }

    if (d.is_wicket === 1) {
      wicketCount++;
      const dismissedId = d.dismissed_player_id ?? d.batsman_id;
      const player = playerMap.get(dismissedId);
      const batsmanName = player ? player.name : `Batsman ${dismissedId}`;
      const overStr = `${Math.floor(legalBalls / ballsPerOver)}.${legalBalls % ballsPerOver}`;

      fow.push({
        wicketNum: wicketCount,
        score: runningScore,
        overs: overStr,
        batsmanName,
        batsmanId: dismissedId,
      });
    }
  }

  return fow;
}

/**
 * Calculates wicket-by-wicket partnerships for an innings.
 */
export function calculatePartnerships(
  deliveries: Delivery[],
  players: Player[]
): Partnership[] {
  if (!deliveries || deliveries.length === 0) {
    return [];
  }

  const playerMap = new Map<number, Player>();
  players.forEach(p => playerMap.set(p.id, p));

  const partnerships: Partnership[] = [];
  let currentWicket = 1;

  let p1Id = 0;
  let p2Id = 0;
  let p1Runs = 0;
  let p1Balls = 0;
  let p2Runs = 0;
  let p2Balls = 0;
  let extras = 0;
  let totalRuns = 0;
  let totalBalls = 0;
  let hasDeliveriesInStand = false;

  const getPlayerName = (id: number): string => {
    return playerMap.get(id)?.name || (id > 0 ? `Player ${id}` : 'Batter');
  };

  const flushStand = (isUnbroken: boolean) => {
    if (!hasDeliveriesInStand && isUnbroken) {
      return;
    }

    partnerships.push({
      wicketNum: currentWicket,
      isUnbroken,
      totalRuns,
      totalBalls,
      batsman1: {
        id: p1Id,
        name: getPlayerName(p1Id),
        runs: p1Runs,
        balls: p1Balls,
      },
      batsman2: {
        id: p2Id,
        name: getPlayerName(p2Id),
        runs: p2Runs,
        balls: p2Balls,
      },
      extras,
    });

    // Reset for next stand
    currentWicket++;
    p1Id = 0;
    p2Id = 0;
    p1Runs = 0;
    p1Balls = 0;
    p2Runs = 0;
    p2Balls = 0;
    extras = 0;
    totalRuns = 0;
    totalBalls = 0;
    hasDeliveriesInStand = false;
  };

  for (const d of deliveries) {
    // Initialize or verify partners at the crease
    if (p1Id === 0 && p2Id === 0) {
      p1Id = d.batsman_id;
      p2Id = d.non_striker_id;
    } else {
      // If either id was not set or new player entered:
      if (d.batsman_id !== p1Id && d.batsman_id !== p2Id) {
        if (p1Id === 0) p1Id = d.batsman_id;
        else if (p2Id === 0) p2Id = d.batsman_id;
      }
      if (d.non_striker_id !== p1Id && d.non_striker_id !== p2Id) {
        if (p1Id === 0) p1Id = d.non_striker_id;
        else if (p2Id === 0) p2Id = d.non_striker_id;
      }
    }

    hasDeliveriesInStand = true;

    const ballExtras =
      (d.wide_runs ?? (d.extras_type === 'wide' ? d.extras_value : 0)) +
      (d.noball_runs ?? (d.extras_type === 'noball' ? (d.extras_value > 0 ? d.extras_value : 1) : 0)) +
      (d.bye_runs ?? (d.extras_type === 'bye' ? d.extras_value : 0)) +
      (d.legbye_runs ?? (d.extras_type === 'legbye' ? d.extras_value : 0)) +
      (d.penalty_runs ?? (d.extras_type === 'penalty' ? d.extras_value : 0));

    const batRuns = d.batsman_runs ?? 0;
    totalRuns += batRuns + ballExtras;
    extras += ballExtras;

    if (d.is_legal_delivery === 1) {
      totalBalls++;
    }

    // Balls faced: legal balls and no-balls (exclude wides and penalties)
    const isWide = (d.wide_runs ?? 0) > 0 || d.extras_type === 'wide';
    const isPenalty = (d.penalty_runs ?? 0) > 0 || d.extras_type === 'penalty';
    const countsAsBallFaced = !isWide && !isPenalty;

    if (d.batsman_id === p1Id) {
      p1Runs += batRuns;
      if (countsAsBallFaced) p1Balls++;
    } else if (d.batsman_id === p2Id) {
      p2Runs += batRuns;
      if (countsAsBallFaced) p2Balls++;
    } else {
      // Fallback for edge cases
      p1Runs += batRuns;
      if (countsAsBallFaced) p1Balls++;
    }

    if (d.is_wicket === 1) {
      flushStand(false);
    }
  }

  // If match or innings ended with an unbroken partnership
  if (hasDeliveriesInStand) {
    flushStand(true);
  }

  return partnerships;
}

export interface OverSummary {
  overNo: number;            // 1-indexed (Over 1, 2, 3...)
  runs: number;              // Runs scored in this over
  wickets: number;           // Wickets fell in this over
  cumulativeRuns: number;    // Running team total after this over
  cumulativeWickets: number; // Running wickets down after this over
  runRate: number;           // Cumulative run rate after this over
  legalBalls: number;        // Legal balls bowled in this over
}

/**
 * Groups deliveries by over and computes per-over and cumulative statistics.
 */
export function calculateOverSummaries(
  deliveries: Delivery[],
  ballsPerOver: number = 6
): OverSummary[] {
  if (!deliveries || deliveries.length === 0) return [];

  const sorted = [...deliveries].sort((a, b) => a.id - b.id);

  const overMap = new Map<number, { runs: number; wickets: number; legalBalls: number }>();
  let maxOverNo = 0;

  for (const d of sorted) {
    const oNo = d.over_no;
    if (oNo > maxOverNo) maxOverNo = oNo;

    const ballExtras =
      (d.wide_runs ?? (d.extras_type === 'wide' ? d.extras_value : 0)) +
      (d.noball_runs ?? (d.extras_type === 'noball' ? (d.extras_value > 0 ? d.extras_value : 1) : 0)) +
      (d.bye_runs ?? (d.extras_type === 'bye' ? d.extras_value : 0)) +
      (d.legbye_runs ?? (d.extras_type === 'legbye' ? d.extras_value : 0)) +
      (d.penalty_runs ?? (d.extras_type === 'penalty' ? d.extras_value : 0));

    const runs = (d.batsman_runs ?? 0) + ballExtras;
    const wkt = d.is_wicket === 1 ? 1 : 0;
    const legal = d.is_legal_delivery === 1 ? 1 : 0;

    const current = overMap.get(oNo) || { runs: 0, wickets: 0, legalBalls: 0 };
    current.runs += runs;
    current.wickets += wkt;
    current.legalBalls += legal;
    overMap.set(oNo, current);
  }

  const summaries: OverSummary[] = [];
  let runningRuns = 0;
  let runningWkts = 0;
  let totalLegalBalls = 0;

  for (let o = 0; o <= maxOverNo; o++) {
    const data = overMap.get(o);
    if (!data) continue;

    runningRuns += data.runs;
    runningWkts += data.wickets;
    totalLegalBalls += data.legalBalls;

    const oversDec = totalLegalBalls / ballsPerOver;
    const runRate = oversDec > 0 ? Number((runningRuns / oversDec).toFixed(2)) : 0;

    summaries.push({
      overNo: o + 1,
      runs: data.runs,
      wickets: data.wickets,
      cumulativeRuns: runningRuns,
      cumulativeWickets: runningWkts,
      runRate,
      legalBalls: data.legalBalls,
    });
  }

  return summaries;
}

