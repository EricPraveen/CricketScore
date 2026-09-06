import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Image, Modal,
  SafeAreaView, ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View,
} from 'react-native';
import CelebrationOverlay from '../components/CelebrationOverlay';
import { CricketColors as C } from '../constants/theme';
import {
  Delivery, Player,
  addDelivery,
  createInnings,
  getBatsmanStats, getBowlerStats,
  getDeliveriesByInnings,
  getInningsByMatch,
  getLastDelivery,
  getLegalBalls,
  getMatchById,
  getPlayersByTeam,
  getTotalRuns, getWickets,
  undoLastDelivery,
  updateMatchStatus,
} from '../db/queries';

// ─── Wicket types with visual image assets ─────────────────────────────────────
const WICKET_OPTIONS = [
  {
    type: 'Bowled',
    image: require('../assets/wicket_bowled.png'),
    desc: 'Ball shattered stumps & bails',
    badge: '#DC2626',
  },
  {
    type: 'Caught',
    image: require('../assets/wicket_caught.png'),
    desc: 'Fielder cleanly took the catch',
    badge: '#2563EB',
  },
  {
    type: 'LBW',
    image: require('../assets/wicket_lbw.png'),
    desc: 'Ball struck the pad in line',
    badge: '#D97706',
  },
  {
    type: 'Run Out',
    image: require('../assets/wicket_runout.png'),
    desc: 'Direct hit / Wicket dislodged',
    badge: '#EA580C',
  },
  {
    type: 'Stumped',
    image: require('../assets/wicket_stumped.png'),
    desc: 'Keeper whipped off the bails',
    badge: '#7C3AED',
  },
  {
    type: 'Hit Wicket',
    image: require('../assets/wicket_hit_wicket.png'),
    desc: 'Bat crashed into stumps & bails',
    badge: '#4B5563',
  },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────
export default function ScoringScreen() {
  const router = useRouter();
  const { matchId, inningsId, battingTeam, bowlingTeam } = useLocalSearchParams<{
    matchId: string; inningsId: string; battingTeam: string; bowlingTeam: string;
  }>();

  // Stable match info
  const match = useMemo(() => getMatchById(Number(matchId)), [matchId]);
  const ballsPerOver = match?.balls_per_over ?? 6;

  // ── Score state (always recalculated from DB) ────────────────────────────
  const [totalRuns,  setTotalRuns]  = useState(0);
  const [wickets,    setWickets]    = useState(0);
  const [legalBalls, setLegalBalls] = useState(0);
  const [currentOver, setCurrentOver] = useState<Delivery[]>([]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const refreshScore = useCallback(() => {
    const id = Number(inningsId);
    const runs  = getTotalRuns(id);
    const wkts  = getWickets(id);
    const balls = getLegalBalls(id);
    const all   = getDeliveriesByInnings(id);
    const overNo = Math.floor(balls / ballsPerOver);
    setTotalRuns(runs);
    setWickets(wkts);
    setLegalBalls(balls);
    setCurrentOver(all.filter(d => d.over_no === overNo));
  }, [inningsId, ballsPerOver]);

  // ── Player lists ─────────────────────────────────────────────────────────
  const [battingPlayers] = useState<Player[]>(() =>
    getPlayersByTeam(Number(matchId), battingTeam)
  );
  const [bowlingPlayers] = useState<Player[]>(() =>
    getPlayersByTeam(Number(matchId), bowlingTeam)
  );
  const [dismissedIds,   setDismissedIds]   = useState<number[]>([]);

  // ── On-field players (transient UI state) ────────────────────────────────
  const [striker,       setStriker]       = useState<Player | null>(null);
  const [nonStriker,    setNonStriker]    = useState<Player | null>(null);
  const [currentBowler, setCurrentBowler] = useState<Player | null>(null);

  // ── Game rules state ─────────────────────────────────────────────────────
  const [isFreeHit,        setIsFreeHit]        = useState(false);
  const [firstInningsScore] = useState<number | null>(() => {
    const allInnings = getInningsByMatch(Number(matchId));
    return allInnings.length >= 2 ? getTotalRuns(allInnings[0].id) : null;
  });

  // ── Celebration Overlay State ────────────────────────────────────────────
  const [celebration, setCelebration] = useState<'four' | 'six' | 'wicket' | null>(null);

  // ── Modal state ──────────────────────────────────────────────────────────
  const [wicketModal,        setWicketModal]        = useState(false);
  const [dismissedPlayer,    setDismissedPlayer]    = useState<Player | null>(null);
  const [selectBatsmanModal, setSelectBatsmanModal] = useState(false);
  const [selectBowlerModal,  setSelectBowlerModal]  = useState(false);
  const [needNewBowler,      setNeedNewBowler]      = useState(false);

  // ── Run Out Modal States ──────────────────────────────────────────────────
  const [runOutModal,            setRunOutModal]            = useState(false);
  const [runsBeforeRunOutModal,  setRunsBeforeRunOutModal]  = useState(false);
  const [pendingWicketRuns,      setPendingWicketRuns]      = useState(0);

  // ── Init ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Try to restore state from existing deliveries
    const existing = getDeliveriesByInnings(Number(inningsId));

    if (existing.length > 0) {
      const last = existing[existing.length - 1];

      // Restore on-field players from last delivery
      setStriker(battingPlayers.find(p => p.id === last.batsman_id) ?? null);
      setNonStriker(battingPlayers.find(p => p.id === last.non_striker_id) ?? null);
      setCurrentBowler(bowlingPlayers.find(p => p.id === last.bowler_id) ?? null);

      // Restore dismissed list
      const dIds = existing
        .filter(d => d.is_wicket && d.dismissed_player_id !== null)
        .map(d => d.dismissed_player_id as number);
      setDismissedIds(dIds);

      // Free Hit is active if the last recorded delivery was a no-ball
      setIsFreeHit(last.extras_type === 'noball');

      refreshScore();
    } else {
      // Fresh innings — select openers
      setStriker(null);
      setNonStriker(null);
      setCurrentBowler(null);
      setDismissedIds([]);
      setIsFreeHit(false);
      setNeedNewBowler(false);
      setSelectBatsmanModal(true);
    }
  }, [inningsId, battingPlayers, bowlingPlayers, refreshScore]);

  const rotateStrike = () => {
    const newStriker = nonStriker;
    const newNonStriker = striker;
    setStriker(newStriker);
    setNonStriker(newNonStriker);
  };

  const handleBack = () => {
    Alert.alert(
      'Leave Match?',
      'Your live scoring progress is automatically saved. You can resume this match anytime from the Home screen.',
      [
        { text: 'Stay Here', style: 'cancel' },
        { text: 'Leave to Home', style: 'destructive', onPress: () => router.replace('/' as any) },
      ]
    );
  };

  // ── Innings / match end ──────────────────────────────────────────────────

  const handleInningsEnd = () => {
    const allInnings = getInningsByMatch(Number(matchId));
    const isFirst    = allInnings.length <= 1;
    const inningsCount = match?.innings_count ?? 2;

    if (isFirst && inningsCount === 2) {
      const runs = getTotalRuns(Number(inningsId));
      const wkts = getWickets(Number(inningsId));
      const balls = getLegalBalls(Number(inningsId));
      const ovs  = `${Math.floor(balls / ballsPerOver)}.${balls % ballsPerOver}`;
      Alert.alert(
        '🏏 Innings Over!',
        `${battingTeam}: ${runs}/${wkts} (${ovs} ov)\n\n${bowlingTeam} needs ${runs + 1} to win`,
        [{
          text: 'Start 2nd Innings →',
          onPress: () => {
            const newId = createInnings(
              Number(matchId), 2,
              bowlingTeam,   // now bats
              battingTeam    // now bowls
            );
            router.replace(
              `/scoring?matchId=${matchId}&inningsId=${newId}&battingTeam=${bowlingTeam}&bowlingTeam=${battingTeam}` as any
            );
          },
        }]
      );
    } else {
      // Single innings OR 2nd innings complete
      updateMatchStatus(Number(matchId), 'completed');
      router.replace(`/scorecard?matchId=${matchId}` as any);
    }
  };

  /** Returns true and shows alert if target is chased (2nd innings only). */
  const checkTargetChased = (): boolean => {
    if (firstInningsScore === null) return false;
    const newRuns = getTotalRuns(Number(inningsId));
    if (newRuns > firstInningsScore) {
      const wkts = getWickets(Number(inningsId));
      const wicketsLeft = battingPlayers.length - 1 - wkts;
      updateMatchStatus(Number(matchId), 'completed');
      Alert.alert(
        '🏆 Match Won!',
        `${battingTeam} won by ${wicketsLeft} wicket${wicketsLeft !== 1 ? 's' : ''}!`,
        [{ text: 'View Scorecard', onPress: () => router.replace(`/scorecard?matchId=${matchId}` as any) }]
      );
      return true;
    }
    return false;
  };

  // ── handleRun ────────────────────────────────────────────────────────────
  /**
   * extrasType: null | 'wide' | 'noball' | 'bye' | 'legbye'
   * extrasValue: 0 for normal runs, 1 for wide/noball/bye/legbye
   * runs: batsman_runs (0 for extras, actual runs for normal balls)
   *
   * Legal delivery: extras_type IS NULL | 'bye' | 'legbye'
   * Illegal:        extras_type 'wide' | 'noball'
   */
  const handleRun = (
    runs: number,
    extrasType: string | null = null,
    extrasValue: number = 0
  ) => {
    if (!striker || !nonStriker || !currentBowler) {
      Alert.alert('Select Players', 'Please select batsmen and bowler first.');
      return;
    }

    const isLegal = extrasType === null || extrasType === 'bye' || extrasType === 'legbye';
    const currentOverNo = Math.floor(legalBalls / ballsPerOver);
    const currentBallNo = legalBalls % ballsPerOver;

    // Record delivery
    addDelivery(
      Number(inningsId),
      currentOverNo, currentBallNo,
      striker.id, nonStriker.id, currentBowler.id,
      runs,       // batsman_runs
      extrasType, extrasValue,
      isLegal,
      false, null, null, // no wicket
      isFreeHit   // was this ball a free hit?
    );

    // Trigger celebration animations for boundaries
    if (runs === 4) {
      setCelebration('four');
    } else if (runs === 6) {
      setCelebration('six');
    }

    // Update free-hit state:
    //  – No-ball bowled → next delivery is free hit
    //  – Legal delivery → free hit ends
    //  – Wide           → free hit persists (wide is NOT legal)
    if (extrasType === 'noball') {
      setIsFreeHit(true);
    } else if (isLegal) {
      setIsFreeHit(false);
    }
    // Wide leaves isFreeHit unchanged

    const newBalls    = getLegalBalls(Number(inningsId));
    const totalOvers  = match?.overs ?? 0;

    refreshScore();

    // 2nd innings: check target
    if (checkTargetChased()) return;

    if (isLegal && newBalls > 0 && newBalls % ballsPerOver === 0) {
      // ── End of over ──
      if (newBalls / ballsPerOver >= totalOvers) {
        handleInningsEnd();
      } else {
        // Rotate strike (non-striker faces new over)
        rotateStrike();
        Alert.alert('Over Complete!', `Over ${newBalls / ballsPerOver} complete! Select new bowler.`);
        setSelectBowlerModal(true);
      }
    } else if (isLegal) {
      // ── Mid-over: rotate on odd runs ──
      // For byes/legbyes: rotation based on extras runs (striker/non-striker swap if odd)
      const rotateRuns = (extrasType === 'bye' || extrasType === 'legbye')
        ? extrasValue : runs;
      if (rotateRuns % 2 !== 0) {
        rotateStrike();
      }
    }
    // Wide / No Ball → no strike rotation
  };

  // ── handleWicket ─────────────────────────────────────────────────────────

  const handleWicket = () => {
    if (!striker || !nonStriker || !currentBowler) {
      Alert.alert('Select Players', 'Please select batsmen and bowler first.');
      return;
    }
    setDismissedPlayer(striker);
    setWicketModal(true);
  };

  const confirmWicket = (type: string) => {
    // Free Hit restriction
    if (isFreeHit && type !== 'Run Out') {
      Alert.alert(
        '🟡 Free Hit!',
        `Only "Run Out" is valid on a Free Hit.\n${type} does not count.`
      );
      return;
    }

    // If Run Out, transition to run selection and dismissed player flow
    if (type === 'Run Out') {
      setWicketModal(false);
      setPendingWicketRuns(0);
      setRunsBeforeRunOutModal(true);
      return;
    }

    // All other wicket types (Bowled, Caught, LBW, Stumped, Hit Wicket): Striker is dismissed
    setWicketModal(false);
    processWicket(striker!, type, 0);
  };

  const processWicket = (
    dismissed: Player,
    type: string,
    runsScored: number = 0,
    extrasType: string | null = null,
    extrasValue: number = 0,
    isLegalDelivery: boolean = true
  ) => {
    const currentOverNo = Math.floor(legalBalls / ballsPerOver);
    const currentBallNo = legalBalls % ballsPerOver;

    // 1. Record delivery to DB
    addDelivery(
      Number(inningsId),
      currentOverNo,
      currentBallNo,
      striker!.id,
      nonStriker!.id,
      currentBowler!.id,
      runsScored,      // batsman runs completed prior to run out
      extrasType,
      extrasValue,
      isLegalDelivery,
      true,            // is_wicket
      type,
      dismissed.id,
      isFreeHit
    );

    // 2. Track dismissed player so they do not reappear in batsman list
    setDismissedIds(prev => [...prev, dismissed.id]);
    setCelebration('wicket');

    // 3. Legal delivery ends the Free Hit
    if (isLegalDelivery) {
      setIsFreeHit(false);
    }

    refreshScore();

    // 4. In 2nd innings, check if completed runs won the match
    if (checkTargetChased()) return;

    const newWickets = getWickets(Number(inningsId));
    const newBalls   = getLegalBalls(Number(inningsId));
    const totalOvers = match?.overs ?? 0;

    // 5. All out check (wickets = total team players - 1)
    if (newWickets >= battingPlayers.length - 1) {
      handleInningsEnd();
      return;
    }

    // 6. Check if overs completed on this ball
    const isOverComplete = isLegalDelivery && newBalls > 0 && newBalls % ballsPerOver === 0;

    if (isOverComplete) {
      if (newBalls / ballsPerOver >= totalOvers) {
        handleInningsEnd();
        return;
      }

      // Over completed on wicket ball:
      // Surviving batsman changes ends for new over.
      // The dismissed player's end is cleared so new batsman takes it.
      if (dismissed.id === striker?.id) {
        setStriker(nonStriker); // non-striker faces new over
        setNonStriker(null);    // incoming batsman fills non-striker slot
      } else {
        setNonStriker(striker); // striker moves to non-striker
        setStriker(null);       // incoming batsman takes strike
      }
      setNeedNewBowler(true);
      Alert.alert('Over Complete!', `Over ${newBalls / ballsPerOver} complete! Select new bowler.`);
      setSelectBatsmanModal(true);
    } else {
      // Mid-over dismissal:
      // If Striker is out → new batsman becomes Striker; Non-Striker stays
      // If Non-Striker is out → new batsman becomes Non-Striker; Striker stays
      if (dismissed.id === striker?.id) {
        setStriker(null);
      } else {
        setNonStriker(null);
      }
      setSelectBatsmanModal(true);
    }
  };

  // ── handleUndo ───────────────────────────────────────────────────────────

  const handleUndo = () => {
    Alert.alert('Undo Last Ball', 'Remove the last recorded delivery?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Undo',
        style: 'destructive',
        onPress: () => {
          // Grab delivery before deleting it
          const toUndo = getLastDelivery(Number(inningsId));
          if (!toUndo) return;

          undoLastDelivery(Number(inningsId));
          refreshScore();

          // Restore game state from new last delivery
          const newLast = getLastDelivery(Number(inningsId));

          if (!newLast) {
            // No deliveries left — back to opener selection
            setStriker(null);
            setNonStriker(null);
            setCurrentBowler(null);
            setDismissedIds([]);
            setIsFreeHit(false);
            setNeedNewBowler(false);
            setSelectBatsmanModal(true);
          } else {
            // Restore on-field players
            setStriker(battingPlayers.find(p => p.id === newLast.batsman_id) ?? null);
            setNonStriker(battingPlayers.find(p => p.id === newLast.non_striker_id) ?? null);
            setCurrentBowler(bowlingPlayers.find(p => p.id === newLast.bowler_id) ?? null);

            // Rebuild dismissed list from remaining deliveries
            const remaining = getDeliveriesByInnings(Number(inningsId));
            const dIds = remaining
              .filter(d => d.is_wicket && d.dismissed_player_id !== null)
              .map(d => d.dismissed_player_id as number);
            setDismissedIds(dIds);

            // Free hit: active if the new last delivery was a no-ball
            setIsFreeHit(newLast.extras_type === 'noball');
          }
        },
      },
    ]);
  };

  // ── Ball display helpers ─────────────────────────────────────────────────

  const getBallLabel = (d: Delivery): string => {
    if (d.is_wicket)                return 'W';
    if (d.extras_type === 'wide')   return 'Wd';
    if (d.extras_type === 'noball') return 'Nb';
    if (d.extras_type === 'bye')    return 'B';
    if (d.extras_type === 'legbye') return 'Lb';
    if (d.batsman_runs === 4)       return '4';
    if (d.batsman_runs === 6)       return '6';
    return d.batsman_runs.toString();
  };

  const getBallBadge = (d: Delivery): { bg: string; text: string; border: string } => {
    if (d.is_wicket) return { bg: '#FEE2E2', text: '#DC2626', border: '#FCA5A5' };
    if (d.extras_type === 'wide' || d.extras_type === 'noball') return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' };
    if (d.batsman_runs === 6) return { bg: '#F3E8FF', text: '#7C3AED', border: '#DDD6FE' };
    if (d.batsman_runs === 4) return { bg: '#DCFCE7', text: '#15803D', border: '#86EFAC' };
    if (d.batsman_runs > 0)   return { bg: '#F1F5F2', text: '#0F172A', border: '#E2EBE3' };
    return { bg: '#F8FAF8', text: '#94A3B8', border: '#EDF2EE' };
  };

  // ── Computed display values ───────────────────────────────────────────────

  const totalOversNum = match?.overs ?? 0;
  const oversDisplay  = `${Math.floor(legalBalls / ballsPerOver)}.${legalBalls % ballsPerOver}`;
  const target        = firstInningsScore !== null ? firstInningsScore + 1 : 0;
  const runsNeeded    = target > 0 ? Math.max(0, target - totalRuns) : 0;
  const ballsLeft     = totalOversNum * ballsPerOver - legalBalls;
  const runRate       = legalBalls > 0 ? ((totalRuns / legalBalls) * ballsPerOver).toFixed(2) : '0.00';
  const requiredRR    = ballsLeft > 0 && runsNeeded > 0
    ? ((runsNeeded / ballsLeft) * ballsPerOver).toFixed(2) : '0.00';
  const targetPct     = target > 0 ? Math.min(totalRuns / target, 1) : 0;

  // Players available for batsman selection
  const availableBatsmen = battingPlayers.filter(
    p => p.id !== striker?.id && p.id !== nonStriker?.id && !dismissedIds.includes(p.id)
  );

  // Batsman modal title/step labels
  const isInitialOpeners = !striker && !nonStriker && dismissedIds.length === 0;
  const batsmanModalTitle = isInitialOpeners
    ? 'Select Striker'
    : !striker
    ? 'New Batsman In (Striker)'
    : !nonStriker
    ? (dismissedIds.length === 0 ? 'Select Non-Striker' : 'New Batsman In (Non-Striker)')
    : 'New Batsman In';
  const batsmanModalStep = isInitialOpeners
    ? 'Step 1 of 2'
    : (!striker && !nonStriker)
    ? 'Step 1 of 2'
    : (dismissedIds.length === 0 && !nonStriker)
    ? 'Step 2 of 2'
    : '';

  // ── Render ─────────────────────────────────────────────────────────────────
  const allInningsLength = getInningsByMatch(Number(matchId)).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* ── Top Header Navigation Bar ── */}
      <View style={styles.topNav}>
        <TouchableOpacity
          style={styles.navBackBtn}
          onPress={handleBack}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={20} color={C.text} />
        </TouchableOpacity>
        <View style={styles.navCenter}>
          <Text style={styles.navMatchTitle} numberOfLines={1}>
            {match?.team1} vs {match?.team2}
          </Text>
          <Text style={styles.navInningsSub}>
            {allInningsLength <= 1 ? '1st Innings' : '2nd Innings (Chase)'} • {totalOversNum} Ov Match{ballsPerOver !== 6 ? ` (${ballsPerOver}b/ov)` : ''}
          </Text>
        </View>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

        {/* ── Scoreboard Card ── */}
        <View style={styles.scoreboard}>
          <View style={styles.scoreTopRow}>
            <Text style={styles.teamsText}>
              {battingTeam} <Text style={styles.vsText}>vs</Text> {bowlingTeam}
            </Text>
            {target > 0 && (
              <View style={styles.targetBadgeCompact}>
                <Text style={styles.targetBadgeText}>Target <Text style={{ fontWeight: '900', color: C.text }}>{target}</Text></Text>
              </View>
            )}
          </View>

          {/* FREE HIT Badge */}
          {isFreeHit && (
            <View style={styles.freeHitBadge}>
              <Text style={styles.freeHitText}>🟡 FREE HIT DELIVERY!</Text>
            </View>
          )}

          <View style={styles.scoreRowCenter}>
            <Text style={styles.scoreText}>
              {totalRuns}<Text style={styles.scoreSlash}>/</Text><Text style={styles.scoreWickets}>{wickets}</Text>
            </Text>
            <View style={styles.scoreMetaColumn}>
              <View style={styles.oversBadge}>
                <Text style={styles.oversText}>
                  {oversDisplay} / {totalOversNum} ov{ballsPerOver !== 6 ? ` (${ballsPerOver}b)` : ''}
                </Text>
              </View>
              <View style={styles.rrPill}>
                <Text style={styles.rrText}>CRR {runRate}</Text>
              </View>
            </View>
          </View>

          {/* Chase Banner (Directly inside scoreboard for 2nd innings to eliminate scrolling) */}
          {target > 0 && (
            <View style={styles.compactChaseBanner}>
              <View style={styles.chaseHeaderRow}>
                <Text style={styles.chaseSummaryText}>
                  {runsNeeded === 0 ? (
                    <Text style={{ color: C.green, fontWeight: '900' }}>🏆 Target Achieved!</Text>
                  ) : ballsLeft <= 0 ? (
                    <Text style={{ color: C.red, fontWeight: '900' }}>Overs Completed</Text>
                  ) : (
                    <>
                      Need <Text style={styles.chaseHighlightNum}>{runsNeeded}</Text> off{' '}
                      <Text style={styles.chaseHighlightNum}>{ballsLeft}</Text> balls
                    </>
                  )}
                </Text>
                <View style={[styles.compactRrrBadge, Number(requiredRR) > 10 ? styles.compactRrrUrgent : null]}>
                  <Text style={[styles.compactRrrText, { color: Number(requiredRR) > 10 ? C.red : C.greenDark }]}>
                    RRR {requiredRR}
                  </Text>
                </View>
              </View>

              <View style={styles.chaseProgressBarBg}>
                <View
                  style={[
                    styles.chaseProgressBarFill,
                    {
                      width: `${Math.round(targetPct * 100)}%` as any,
                      backgroundColor: runsNeeded === 0 ? C.green : Number(requiredRR) > 10 ? C.red : C.green,
                    },
                  ]}
                />
              </View>
            </View>
          )}
        </View>

        {/* ── Current Over ── */}
        <View style={styles.overContainer}>
          <Text style={styles.overLabel}>THIS OVER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.overBalls}>
              {currentOver.length === 0
                ? <Text style={styles.emptyOver}>—</Text>
                : currentOver.map((ball, i) => {
                    const badge = getBallBadge(ball);
                    return (
                      <View key={i} style={[styles.ball, { backgroundColor: badge.bg, borderColor: badge.border, borderWidth: 1 }]}>
                        <Text style={[styles.ballText, { color: badge.text }]}>{getBallLabel(ball)}</Text>
                      </View>
                    );
                  })}
            </View>
          </ScrollView>
        </View>

        {/* ── Batsmen ── */}
        <View style={styles.playersRow}>
          {[
            { player: striker,    isStriker: true  },
            { player: nonStriker, isStriker: false },
          ].map(({ player, isStriker }) => {
            const stats = player
              ? getBatsmanStats(Number(inningsId), player.id)
              : null;
            const sr = stats && stats.balls_faced > 0
              ? ((stats.runs / stats.balls_faced) * 100).toFixed(0)
              : '0';
            return (
              <View
                key={isStriker ? 'st' : 'ns'}
                style={[styles.playerCard, isStriker && styles.strikerCard]}
              >
                <Text style={styles.playerNameLabel}>
                  {isStriker ? '🏏 ' : ''}{player?.name ?? '—'}{isStriker && player ? ' *' : ''}
                </Text>
                {stats ? (
                  <>
                    <Text style={styles.playerScore}>
                      {stats.runs}
                      <Text style={styles.playerBalls}> ({stats.balls_faced})</Text>
                    </Text>
                    <Text style={styles.playerMeta}>
                      SR {sr}  •  4s {stats.fours}  •  6s {stats.sixes}
                    </Text>
                  </>
                ) : (
                  <Text style={styles.playerMeta}>—</Text>
                )}
              </View>
            );
          })}
        </View>

        {/* ── Bowler ── */}
        <View style={styles.bowlerRow}>
          <View style={styles.bowlerInfo}>
            <View style={styles.bowlerNameRow}>
              <Image
                source={require('../assets/cricket_ball.png')}
                style={styles.bowlerBallImg}
                resizeMode="contain"
              />
              <Text style={styles.bowlerName} numberOfLines={1}>
                {currentBowler?.name ?? 'Select Bowler'}
              </Text>
            </View>
            {currentBowler && (() => {
              const bs  = getBowlerStats(Number(inningsId), currentBowler.id);
              const ovs = `${Math.floor(bs.balls_bowled / ballsPerOver)}.${bs.balls_bowled % ballsPerOver}`;
              return (
                <Text style={styles.bowlerStats}>
                  {bs.wickets}-{bs.runs_given}  •  {ovs} ov
                </Text>
              );
            })()}
          </View>
          <TouchableOpacity
            style={styles.changeBtn}
            onPress={() => setSelectBowlerModal(true)}
          >
            <Text style={styles.changeBtnText}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* ── Run Buttons ── */}
        <View style={styles.runButtons}>
          {([0, 1, 2, 3, 4, 6] as const).map(run => (
            <TouchableOpacity
              key={run}
              style={[
                styles.runBtn,
                run === 0 && styles.runBtn0,
                run === 4 && styles.runBtn4,
                run === 6 && styles.runBtn6,
              ]}
              onPress={() => handleRun(run)}
              activeOpacity={0.75}
            >
              <Text style={[
                styles.runBtnText,
                run === 4 && styles.runBtnText4,
                run === 6 && styles.runBtnText6,
              ]}>
                {run}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Extras Row ── */}
        <View style={styles.extrasRow}>
          {[
            { label: 'Wide',    type: 'wide',   val: 1 },
            { label: 'No Ball', type: 'noball', val: 1 },
            { label: 'Bye',     type: 'bye',    val: 1 },
            { label: 'Leg Bye', type: 'legbye', val: 1 },
          ].map(({ label, type, val }) => (
            <TouchableOpacity
              key={type}
              style={styles.extraBtn}
              onPress={() => handleRun(0, type, val)}
              activeOpacity={0.75}
            >
              <Text style={styles.extraBtnText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Bottom Row: Undo | Wicket ── */}
        <View style={styles.bottomRow}>
          <TouchableOpacity style={styles.undoBtn} onPress={handleUndo} activeOpacity={0.8}>
            <Text style={styles.undoBtnText}>↩ Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.wicketBtn} onPress={handleWicket} activeOpacity={0.8}>
            <View style={styles.wicketInner}>
              <Text style={styles.wicketBtnText}>⚡ WICKET (OUT)</Text>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 32 }} />
      </ScrollView>

      {/* ─────── WICKET MODAL ─────── */}
      <Modal visible={wicketModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>How Out?</Text>
            {dismissedPlayer && (
              <Text style={styles.modalSubtitle}>{dismissedPlayer.name}</Text>
            )}
            {isFreeHit && (
              <View style={styles.freeHitWarning}>
                <Text style={styles.freeHitWarningText}>
                  🟡 FREE HIT — Only Run Out allowed
                </Text>
              </View>
            )}
            <View style={styles.wicketOptionsList}>
              {WICKET_OPTIONS.map(({ type, image, desc, badge }) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.wicketOptionCard,
                    isFreeHit && type !== 'Run Out' && styles.modalOptionDisabled,
                  ]}
                  onPress={() => confirmWicket(type)}
                  activeOpacity={0.7}
                >
                  <View style={[styles.wicketIconBox, { backgroundColor: `${badge}15` }]}>
                    <Image
                      source={image}
                      style={styles.wicketOptionImg}
                      resizeMode="cover"
                    />
                  </View>
                  <View style={styles.wicketOptionInfo}>
                    <Text
                      style={[
                        styles.wicketOptionTitle,
                        isFreeHit && type !== 'Run Out' && styles.modalOptionTextDisabled,
                      ]}
                    >
                      {type}
                    </Text>
                    <Text style={styles.wicketOptionDesc}>{desc}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={C.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setWicketModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─────── RUNS BEFORE RUN OUT MODAL ─────── */}
      <Modal visible={runsBeforeRunOutModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Runs before Run Out?</Text>
            <Text style={styles.modalSubtitle}>Select completed runs before the run out occurred</Text>

            <View style={styles.runsBeforeRow}>
              {([0, 1, 2, 3] as const).map(run => (
                <TouchableOpacity
                  key={run}
                  style={[
                    styles.runBeforeCircle,
                    pendingWicketRuns === run && styles.runBeforeCircleActive,
                  ]}
                  onPress={() => setPendingWicketRuns(run)}
                  activeOpacity={0.75}
                >
                  <Text
                    style={[
                      styles.runBeforeCircleText,
                      pendingWicketRuns === run && styles.runBeforeCircleTextActive,
                    ]}
                  >
                    {run}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={styles.confirmRunOutBtn}
              onPress={() => {
                setRunsBeforeRunOutModal(false);
                setRunOutModal(true);
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.confirmRunOutBtnText}>Next: Select Who is Out →</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setRunsBeforeRunOutModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─────── RUN OUT MODAL (Who is out?) ─────── */}
      <Modal visible={runOutModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>🏃 Run Out — Who is out?</Text>
            <Text style={styles.modalSubtitle}>
              {pendingWicketRuns > 0
                ? `${pendingWicketRuns} run${pendingWicketRuns > 1 ? 's' : ''} scored before wicket`
                : 'Select the dismissed batsman'}
            </Text>

            {striker && (
              <TouchableOpacity
                style={styles.runOutCard}
                onPress={() => {
                  setRunOutModal(false);
                  processWicket(striker, 'Run Out', pendingWicketRuns);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.runOutPlayerName} numberOfLines={1}>{striker.name}</Text>
                <View style={styles.strikerBadge}>
                  <Text style={styles.strikerBadgeText}>STRIKER ✦</Text>
                </View>
              </TouchableOpacity>
            )}

            <View style={styles.runOutDivider} />

            {nonStriker && (
              <TouchableOpacity
                style={styles.runOutCard}
                onPress={() => {
                  setRunOutModal(false);
                  processWicket(nonStriker, 'Run Out', pendingWicketRuns);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.runOutPlayerName} numberOfLines={1}>{nonStriker.name}</Text>
                <View style={styles.nonStrikerBadge}>
                  <Text style={styles.nonStrikerBadgeText}>NON-STRIKER</Text>
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.modalCancel}
              onPress={() => setRunOutModal(false)}
            >
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ─────── SELECT BATSMAN MODAL ─────── */}
      <Modal visible={selectBatsmanModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{batsmanModalTitle}</Text>
            {batsmanModalStep !== '' && (
              <Text style={styles.modalSubtitle}>{batsmanModalStep}</Text>
            )}
            <ScrollView style={{ maxHeight: 420 }}>
              {(!striker && !nonStriker && dismissedIds.length === 0 ? battingPlayers : availableBatsmen).map(player => (
                <TouchableOpacity
                  key={player.id}
                  style={styles.modalOption}
                  onPress={() => {
                    if (!striker && !nonStriker) {
                      // Selecting opener striker
                      setStriker(player);
                      // Modal stays open for opener non-striker
                    } else if (!striker) {
                      // Dismissed striker replaced (or over complete rotation)
                      setStriker(player);
                      setSelectBatsmanModal(false);
                      if (needNewBowler) {
                        setNeedNewBowler(false);
                        setSelectBowlerModal(true);
                      }
                    } else if (!nonStriker) {
                      // Dismissed non-striker replaced (or opener non-striker)
                      setNonStriker(player);
                      setSelectBatsmanModal(false);
                      if (!currentBowler || needNewBowler) {
                        setNeedNewBowler(false);
                        setSelectBowlerModal(true);
                      }
                    }
                  }}
                >
                  <Text style={styles.modalOptionText}>{player.name}</Text>
                </TouchableOpacity>
              ))}
              {(!striker && !nonStriker && dismissedIds.length === 0 ? battingPlayers : availableBatsmen).length === 0 && (
                <Text style={styles.modalEmpty}>No available batsmen</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─────── SELECT BOWLER MODAL ─────── */}
      <Modal visible={selectBowlerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Bowler</Text>
            <ScrollView style={{ maxHeight: 420 }}>
              {bowlingPlayers.map(player => {
                const bs  = getBowlerStats(Number(inningsId), player.id);
                const ovs = `${Math.floor(bs.balls_bowled / ballsPerOver)}.${bs.balls_bowled % ballsPerOver}`;
                return (
                  <TouchableOpacity
                    key={player.id}
                    style={styles.modalOption}
                    onPress={() => {
                      setCurrentBowler(player);
                      setSelectBowlerModal(false);
                    }}
                  >
                    <Text style={styles.modalOptionText}>{player.name}</Text>
                    {bs.balls_bowled > 0 && (
                      <Text style={styles.modalOptionSub}>
                        {bs.wickets}-{bs.runs_given}  ({ovs} ov)
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─────── CELEBRATION ANIMATION OVERLAY ─────── */}
      <CelebrationOverlay
        visible={celebration !== null}
        type={celebration}
        onDismiss={() => setCelebration(null)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Top Nav
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingTop: 10, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  navBackBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  navCenter: { flex: 1 },
  navMatchTitle: { color: C.text, fontSize: 16, fontWeight: '800' },
  navInningsSub: { color: C.textSub, fontSize: 12, marginTop: 1 },
  liveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.redLight, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12, borderWidth: 1, borderColor: '#FECACA',
  },
  liveDot: {
    width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.red,
  },
  liveText: {
    color: C.red, fontSize: 11, fontWeight: '800', letterSpacing: 0.5,
  },

  // Scoreboard
  scoreboard: {
    backgroundColor: C.surface,
    marginHorizontal: 12, marginTop: 8, marginBottom: 8,
    borderRadius: 16,
    paddingHorizontal: 16, paddingVertical: 12,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  scoreTopRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 4,
  },
  teamsText: { color: C.textSub, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  vsText:    { color: C.red, fontWeight: '900' },
  targetBadgeCompact: {
    backgroundColor: C.surfaceWarm, paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 10, borderWidth: 1, borderColor: '#FDE68A',
  },
  targetBadgeText: { color: C.textSub, fontSize: 11, fontWeight: '700' },
  freeHitBadge: {
    backgroundColor: '#FEF3C7', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 16, paddingHorizontal: 10, paddingVertical: 3,
    marginVertical: 4, alignSelf: 'center',
  },
  freeHitText: { color: '#B45309', fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  scoreRowCenter: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 2,
  },
  scoreText:   { color: C.text, fontSize: 42, fontWeight: '900', letterSpacing: -1 },
  scoreSlash:  { color: C.textMuted, fontWeight: '400' },
  scoreWickets:{ color: C.red, fontWeight: '900' },
  scoreMetaColumn: { alignItems: 'flex-end', gap: 4 },
  oversBadge: {
    backgroundColor: '#F1F5F2', paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 12, borderWidth: 1, borderColor: C.border,
  },
  oversText:   { color: C.textSub, fontSize: 12, fontWeight: '700' },
  rrPill: {
    backgroundColor: C.greenLight, paddingHorizontal: 10, paddingVertical: 3,
    borderRadius: 12, borderWidth: 1, borderColor: '#86EFAC',
  },
  rrText: { color: C.greenDark, fontSize: 11, fontWeight: '800' },

  // Integrated Compact Chase Banner (Within Scoreboard)
  compactChaseBanner: {
    marginTop: 8, paddingTop: 8,
    borderTopWidth: 1, borderTopColor: '#F1F5F2',
  },
  chaseHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 6,
  },
  chaseSummaryText: { color: C.text, fontSize: 13, fontWeight: '700' },
  chaseHighlightNum: { color: C.red, fontWeight: '900', fontSize: 15 },
  compactRrrBadge: {
    backgroundColor: C.greenLight, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8, borderWidth: 1, borderColor: '#86EFAC',
  },
  compactRrrUrgent: {
    backgroundColor: '#FEE2E2', borderColor: '#FCA5A5',
  },
  compactRrrText: { fontSize: 11, fontWeight: '800' },
  chaseProgressBarBg: {
    height: 6, backgroundColor: '#E2EBE3', borderRadius: 3, overflow: 'hidden',
  },
  chaseProgressBarFill: {
    height: 6, borderRadius: 3,
  },

  // Current over
  overContainer: {
    backgroundColor: C.surface,
    marginHorizontal: 12, marginBottom: 8,
    borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: C.border,
  },
  overLabel: { color: C.greenDark, fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  overBalls: { flexDirection: 'row', gap: 5, alignItems: 'center' },
  emptyOver: { color: C.textMuted, fontSize: 14 },
  ball: {
    width: 28, height: 28, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
  },
  ballText: { fontSize: 10, fontWeight: '800' },

  // Batsmen
  playersRow:  { flexDirection: 'row', marginHorizontal: 10, gap: 8, marginBottom: 8 },
  playerCard: {
    flex: 1, backgroundColor: C.surface,
    borderRadius: 14, padding: 10,
    borderWidth: 1, borderColor: C.border,
  },
  strikerCard: { borderColor: C.green, backgroundColor: C.greenLight },
  playerNameLabel: { color: C.text, fontSize: 12, fontWeight: '800', marginBottom: 2 },
  playerScore:     { color: C.text, fontSize: 20, fontWeight: '900' },
  playerBalls:     { fontSize: 12, fontWeight: '500', color: C.textSub },
  playerMeta:      { color: C.textSub, fontSize: 10, fontWeight: '600', marginTop: 2 },

  // Bowler
  bowlerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.surface, marginHorizontal: 12, borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8, borderWidth: 1, borderColor: C.border,
  },
  bowlerInfo:  { flex: 1, marginRight: 8 },
  bowlerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bowlerBallImg: {
    width: 16, height: 16,
    borderRadius: 8,
  },
  bowlerName:  { color: C.text, fontSize: 13, fontWeight: '800' },
  bowlerStats: { color: C.textSub, fontSize: 11, fontWeight: '600', marginTop: 1 },
  changeBtn: {
    backgroundColor: C.bg, paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 16, borderWidth: 1, borderColor: C.border,
  },
  changeBtnText: { color: C.green, fontSize: 11, fontWeight: '700' },

  // Run buttons
  runButtons: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 8, gap: 6,
    justifyContent: 'center', marginBottom: 8,
  },
  runBtn: {
    width: '31%', height: 50, borderRadius: 12,
    backgroundColor: C.surface,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.2, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03, shadowRadius: 3, elevation: 1,
  },
  runBtn0: { borderColor: '#E2EBE3', backgroundColor: '#F8FAF8' },
  runBtn4: { borderColor: '#10B981', backgroundColor: '#ECFDF5' },
  runBtn6: { borderColor: '#8B5CF6', backgroundColor: '#FAF5FF' },
  runBtnText:  { color: C.text, fontSize: 22, fontWeight: '900' },
  runBtnText4: { color: '#047857' },
  runBtnText6: { color: '#7C3AED' },

  // Extras
  extrasRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 6, marginBottom: 8 },
  extraBtn: {
    flex: 1, backgroundColor: '#FFFBEB',
    paddingVertical: 9, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#FDE68A',
  },
  extraBtnText: { color: '#B45309', fontSize: 11, fontWeight: '800' },

  // Bottom row
  bottomRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8 },
  undoBtn: {
    flex: 1, backgroundColor: C.surface,
    paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    borderWidth: 1.5, borderColor: C.border,
  },
  undoBtnText: { color: C.textSub, fontSize: 14, fontWeight: '700' },
  wicketBtn: {
    flex: 2, backgroundColor: C.red,
    paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.red, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25, shadowRadius: 6, elevation: 3,
  },
  wicketInner: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
  },
  wicketBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)', justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: C.surface,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 24, paddingBottom: 40,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  modalTitle:    { color: C.text, fontSize: 19, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  modalSubtitle: { color: C.textSub, fontSize: 13, textAlign: 'center', marginBottom: 12 },
  freeHitWarning: {
    backgroundColor: '#FEF3C7', borderRadius: 10,
    borderWidth: 1, borderColor: '#FDE68A',
    paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12,
    alignItems: 'center',
  },
  freeHitWarningText: { color: '#B45309', fontSize: 12, fontWeight: '800' },
  modalOption: {
    paddingVertical: 15,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalOptionDisabled: { opacity: 0.35 },
  modalOptionText:    { color: C.text, fontSize: 16, fontWeight: '600' },
  modalOptionTextDisabled: { color: C.textMuted },
  modalOptionSub:     { color: C.textSub, fontSize: 12, marginTop: 2 },
  modalCancel:        { paddingTop: 18, alignItems: 'center' },
  modalCancelText:    { color: C.red, fontSize: 16, fontWeight: '800' },
  modalEmpty:         { color: C.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 20 },

  // Rich Wicket Options List
  wicketOptionsList: {
    gap: 8, marginVertical: 4,
  },
  wicketOptionCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#F8FAF8',
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: C.border,
  },
  wicketIconBox: {
    width: 44, height: 44, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
    marginRight: 12, overflow: 'hidden',
  },
  wicketOptionImg: {
    width: 38, height: 38,
    borderRadius: 8,
  },
  wicketOptionInfo: { flex: 1 },
  wicketOptionTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  wicketOptionDesc:  { color: C.textSub, fontSize: 11, fontWeight: '500', marginTop: 1 },

  // ── Run Out UI Styles ──────────────────────────────────────────────────
  runOutCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F8FAF8',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
  },
  runOutPlayerName: {
    color: C.text,
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 10,
  },
  strikerBadge: {
    backgroundColor: C.greenLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  strikerBadgeText: {
    color: C.greenDark,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  nonStrikerBadge: {
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  nonStrikerBadgeText: {
    color: '#B45309',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  runOutDivider: {
    height: 10,
  },

  // ── Runs Before Run Out Styles ─────────────────────────────────────────
  runsBeforeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginVertical: 18,
  },
  runBeforeCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#F8FAF8',
    borderWidth: 2,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  runBeforeCircleActive: {
    borderColor: C.green,
    backgroundColor: C.greenLight,
  },
  runBeforeCircleText: {
    color: C.text,
    fontSize: 22,
    fontWeight: '800',
  },
  runBeforeCircleTextActive: {
    color: C.greenDark,
  },
  confirmRunOutBtn: {
    backgroundColor: C.green,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 6,
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 3,
  },
  confirmRunOutBtnText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
});
