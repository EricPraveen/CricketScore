import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert, Modal,
  SafeAreaView, ScrollView,
  StyleSheet,
  Text, TouchableOpacity,
  View,
} from 'react-native';
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

// ─── Colour palette ────────────────────────────────────────────────────────────
const C = {
  bg:        '#080f0b',
  surface:   '#0e1d14',
  surface2:  '#132019',
  card:      '#182a1f',
  cardActive:'#1e3d28',
  border:    '#1e3d28',
  accent:    '#00e676',
  accentDim: '#00b359',
  text:      '#ffffff',
  textSub:   '#8fa99a',
  textMuted: '#4a6655',
  red:       '#f44336',
  redDark:   '#b71c1c',
  blue:      '#2979ff',
  purple:    '#9c27b0',
  orange:    '#ff9800',
  yellow:    '#FFD600',
  dot:       '#263238',
};

// ─── Wicket types ──────────────────────────────────────────────────────────────
const WICKET_TYPES = ['Bowled', 'Caught', 'LBW', 'Run Out', 'Stumped', 'Hit Wicket'] as const;

// ─── Component ────────────────────────────────────────────────────────────────
export default function ScoringScreen() {
  const router = useRouter();
  const { matchId, inningsId, battingTeam, bowlingTeam } = useLocalSearchParams<{
    matchId: string; inningsId: string; battingTeam: string; bowlingTeam: string;
  }>();

  // Stable match ref — won't go stale on re-renders
  const matchRef = useRef(getMatchById(Number(matchId)));
  const match = matchRef.current;
  const ballsPerOver = match?.balls_per_over ?? 6;

  // ── Score state (always recalculated from DB) ────────────────────────────
  const [totalRuns,  setTotalRuns]  = useState(0);
  const [wickets,    setWickets]    = useState(0);
  const [legalBalls, setLegalBalls] = useState(0);
  const [currentOver, setCurrentOver] = useState<Delivery[]>([]);

  // ── Player lists ─────────────────────────────────────────────────────────
  const [battingPlayers, setBattingPlayers] = useState<Player[]>([]);
  const [bowlingPlayers, setBowlingPlayers] = useState<Player[]>([]);
  const [dismissedIds,   setDismissedIds]   = useState<number[]>([]);

  // ── On-field players (transient UI state) ────────────────────────────────
  const [striker,       setStriker]       = useState<Player | null>(null);
  const [nonStriker,    setNonStriker]    = useState<Player | null>(null);
  const [currentBowler, setCurrentBowler] = useState<Player | null>(null);

  // ── Game rules state ─────────────────────────────────────────────────────
  const [isFreeHit,        setIsFreeHit]        = useState(false);
  const [firstInningsScore, setFirstInningsScore] = useState(0);

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
    const batting = getPlayersByTeam(Number(matchId), battingTeam);
    const bowling = getPlayersByTeam(Number(matchId), bowlingTeam);
    setBattingPlayers(batting);
    setBowlingPlayers(bowling);

    // 2nd innings: capture target from 1st innings
    const allInnings = getInningsByMatch(Number(matchId));
    if (allInnings.length >= 2) {
      setFirstInningsScore(getTotalRuns(allInnings[0].id));
    } else {
      setFirstInningsScore(0);
    }

    // Try to restore state from existing deliveries
    const existing = getDeliveriesByInnings(Number(inningsId));

    if (existing.length > 0) {
      const last = existing[existing.length - 1];

      // Restore on-field players from last delivery
      setStriker(batting.find(p => p.id === last.batsman_id) ?? null);
      setNonStriker(batting.find(p => p.id === last.non_striker_id) ?? null);
      setCurrentBowler(bowling.find(p => p.id === last.bowler_id) ?? null);

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
  }, [matchId, inningsId, battingTeam, bowlingTeam]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const refreshScore = () => {
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
  };

  const rotateStrike = () => {
    const newStriker = nonStriker;
    const newNonStriker = striker;
    setStriker(newStriker);
    setNonStriker(newNonStriker);
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
    if (firstInningsScore <= 0) return false;
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

  const getBallColor = (d: Delivery): string => {
    if (d.is_wicket)                   return '#c62828';
    if (d.extras_type === 'wide' || d.extras_type === 'noball') return '#e65100';
    if (d.batsman_runs === 6)          return '#6a1b9a';
    if (d.batsman_runs === 4)          return '#1565c0';
    if (d.batsman_runs > 0)            return '#1b5e20';
    return C.dot;
  };

  // ── Computed display values ───────────────────────────────────────────────

  const totalOversNum = match?.overs ?? 0;
  const oversDisplay  = `${Math.floor(legalBalls / ballsPerOver)}.${legalBalls % ballsPerOver}`;
  const target        = firstInningsScore > 0 ? firstInningsScore + 1 : 0;
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
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

        {/* ── Scoreboard ── */}
        <View style={styles.scoreboard}>
          <Text style={styles.teamsText}>
            {battingTeam}{' '}
            <Text style={styles.vsText}>vs</Text>
            {' '}{bowlingTeam}
          </Text>

          {/* FREE HIT Badge */}
          {isFreeHit && (
            <View style={styles.freeHitBadge}>
              <Text style={styles.freeHitText}>🟡 FREE HIT!</Text>
            </View>
          )}

          <Text style={styles.scoreText}>{totalRuns}/{wickets}</Text>

          <View style={styles.scoreMetaRow}>
            <Text style={styles.oversText}>
              {oversDisplay} / {totalOversNum} ov{ballsPerOver !== 6 ? ` (${ballsPerOver}b)` : ''}
            </Text>
            <View style={styles.rrPill}>
              <Text style={styles.rrText}>CRR {runRate}</Text>
            </View>
          </View>
        </View>

        {/* ── Target bar — 2nd innings only ── */}
        {target > 0 && (
          <View style={styles.targetBox}>
            <View style={styles.targetHeader}>
              <Text style={styles.targetNeedText}>
                {runsNeeded === 0
                  ? '🏆 Target Reached!'
                  : `Need ${runsNeeded} off ${ballsLeft} ball${ballsLeft !== 1 ? 's' : ''}`}
              </Text>
              <View style={styles.rrrPill}>
                <Text style={styles.rrrText}>RRR {requiredRR}</Text>
              </View>
            </View>
            <View style={styles.targetBarBg}>
              <View style={[styles.targetBarFill, { width: `${Math.round(targetPct * 100)}%` as any }]} />
            </View>
            <Text style={styles.targetLabel}>Target: {target}</Text>
          </View>
        )}

        {/* ── Current Over ── */}
        <View style={styles.overContainer}>
          <Text style={styles.overLabel}>THIS OVER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.overBalls}>
              {currentOver.length === 0
                ? <Text style={styles.emptyOver}>—</Text>
                : currentOver.map((ball, i) => (
                  <View key={i} style={[styles.ball, { backgroundColor: getBallColor(ball) }]}>
                    <Text style={styles.ballText}>{getBallLabel(ball)}</Text>
                  </View>
                ))}
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
            <Text style={styles.bowlerName} numberOfLines={1}>
              🎳 {currentBowler?.name ?? 'Select Bowler'}
            </Text>
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
            <Text style={styles.wicketBtnText}>🔴 Wicket</Text>
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
            {WICKET_TYPES.map(type => (
              <TouchableOpacity
                key={type}
                style={[
                  styles.modalOption,
                  isFreeHit && type !== 'Run Out' && styles.modalOptionDisabled,
                ]}
                onPress={() => confirmWicket(type)}
              >
                <Text style={[
                  styles.modalOptionText,
                  isFreeHit && type !== 'Run Out' && styles.modalOptionTextDisabled,
                ]}>
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
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
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // Scoreboard
  scoreboard: {
    backgroundColor: C.surface,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18,
    alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  teamsText:    { color: C.textSub, fontSize: 12, letterSpacing: 1.2, marginBottom: 4 },
  vsText:       { color: C.textMuted },
  freeHitBadge: {
    backgroundColor: '#2a2000', borderWidth: 1, borderColor: C.yellow,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 4,
    marginBottom: 6,
  },
  freeHitText: { color: C.yellow, fontSize: 13, fontWeight: '800', letterSpacing: 0.5 },
  scoreText:   { color: C.text, fontSize: 56, fontWeight: '800', letterSpacing: -2 },
  scoreMetaRow:{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  oversText:   { color: C.textSub, fontSize: 13 },
  rrPill: {
    backgroundColor: C.surface2, paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
  },
  rrText: { color: C.accent, fontSize: 12, fontWeight: '700' },

  // Target
  targetBox: {
    backgroundColor: '#0c1c12', paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  targetHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  targetNeedText: { color: C.text, fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  rrrPill: {
    backgroundColor: '#1a1500', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: '#3d2f00',
  },
  rrrText:       { color: C.orange, fontSize: 12, fontWeight: '700' },
  targetBarBg:   { height: 6, backgroundColor: C.surface2, borderRadius: 3, overflow: 'hidden' },
  targetBarFill: { height: 6, backgroundColor: C.accent, borderRadius: 3 },
  targetLabel:   { color: C.textMuted, fontSize: 11, marginTop: 6, textAlign: 'right' },

  // Current over
  overContainer: {
    backgroundColor: C.surface,
    paddingHorizontal: 16, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  overLabel: { color: C.textMuted, fontSize: 10, letterSpacing: 1.5 },
  overBalls: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  emptyOver: { color: C.textMuted, fontSize: 18 },
  ball: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
  },
  ballText: { color: '#fff', fontSize: 11, fontWeight: '800' },

  // Batsmen
  playersRow:  { flexDirection: 'row', padding: 10, gap: 8 },
  playerCard: {
    flex: 1, backgroundColor: C.card,
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: C.border,
  },
  strikerCard: { borderColor: C.accentDim, backgroundColor: C.cardActive },
  playerNameLabel: { color: C.text, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  playerScore:     { color: C.text, fontSize: 24, fontWeight: '800' },
  playerBalls:     { fontSize: 14, fontWeight: '400', color: C.textSub },
  playerMeta:      { color: C.textMuted, fontSize: 11, marginTop: 4 },

  // Bowler
  bowlerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: C.card, marginHorizontal: 10, borderRadius: 14,
    padding: 12, marginBottom: 8, borderWidth: 1, borderColor: C.border,
  },
  bowlerInfo:  { flex: 1, marginRight: 8 },
  bowlerName:  { color: C.text,    fontSize: 13, fontWeight: '600' },
  bowlerStats: { color: C.textSub, fontSize: 11, marginTop: 3 },
  changeBtn: {
    backgroundColor: C.surface2, paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
  },
  changeBtnText: { color: C.accent, fontSize: 12, fontWeight: '600' },

  // Run buttons
  runButtons: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 10, gap: 8,
    justifyContent: 'center', marginBottom: 8,
  },
  runBtn: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: C.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.border,
  },
  runBtn0: { borderColor: C.dot,    backgroundColor: '#121c18' },
  runBtn4: { borderColor: C.blue,   backgroundColor: '#0a1a35' },
  runBtn6: { borderColor: C.purple, backgroundColor: '#160a22' },
  runBtnText:  { color: C.text,     fontSize: 28, fontWeight: '800' },
  runBtnText4: { color: '#82b1ff' },
  runBtnText6: { color: '#e040fb' },

  // Extras
  extrasRow: { flexDirection: 'row', paddingHorizontal: 10, gap: 6, marginBottom: 8 },
  extraBtn: {
    flex: 1, backgroundColor: '#140f00',
    paddingVertical: 12, borderRadius: 12, alignItems: 'center',
    borderWidth: 1, borderColor: '#3d2f00',
  },
  extraBtnText: { color: C.orange, fontSize: 12, fontWeight: '700' },

  // Bottom row
  bottomRow: { flexDirection: 'row', paddingHorizontal: 10, gap: 8 },
  undoBtn: {
    flex: 1, backgroundColor: C.card,
    paddingVertical: 16, borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  undoBtnText: { color: C.textSub, fontSize: 15, fontWeight: '600' },
  wicketBtn: {
    flex: 2, backgroundColor: C.redDark,
    paddingVertical: 16, borderRadius: 14, alignItems: 'center',
  },
  wicketBtnText: { color: '#fff', fontSize: 16, fontWeight: '800' },

  // Modals
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.88)', justifyContent: 'flex-end',
  },
  modalBox: {
    backgroundColor: '#111e16',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  modalTitle:    { color: C.text,    fontSize: 18, fontWeight: '800', marginBottom: 4, textAlign: 'center' },
  modalSubtitle: { color: C.textSub, fontSize: 13, textAlign: 'center', marginBottom: 10 },
  freeHitWarning: {
    backgroundColor: '#2a2000', borderRadius: 10,
    borderWidth: 1, borderColor: C.yellow,
    paddingVertical: 8, paddingHorizontal: 12, marginBottom: 12,
    alignItems: 'center',
  },
  freeHitWarningText: { color: C.yellow, fontSize: 12, fontWeight: '700' },
  modalOption: {
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: '#1a2e22',
  },
  modalOptionDisabled: { opacity: 0.35 },
  modalOptionText:    { color: C.text,    fontSize: 16 },
  modalOptionTextDisabled: { color: C.textMuted },
  modalOptionSub:     { color: C.textMuted, fontSize: 12, marginTop: 2 },
  modalCancel:        { paddingTop: 18, alignItems: 'center' },
  modalCancelText:    { color: C.red, fontSize: 15, fontWeight: '700' },
  modalEmpty:         { color: C.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 20 },

  // ── Run Out UI Styles ──────────────────────────────────────────────────
  runOutCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#182a1f',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1e3d28',
  },
  runOutPlayerName: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    marginRight: 10,
  },
  strikerBadge: {
    backgroundColor: '#1a3a1a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2e7d32',
  },
  strikerBadgeText: {
    color: '#4CAF50',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  nonStrikerBadge: {
    backgroundColor: '#2a1a0a',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e65100',
  },
  nonStrikerBadgeText: {
    color: '#FF9800',
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
    backgroundColor: '#182a1f',
    borderWidth: 2,
    borderColor: '#1e3d28',
    alignItems: 'center',
    justifyContent: 'center',
  },
  runBeforeCircleActive: {
    borderColor: '#00e676',
    backgroundColor: '#1b5e20',
  },
  runBeforeCircleText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  runBeforeCircleTextActive: {
    color: '#00e676',
  },
  confirmRunOutBtn: {
    backgroundColor: '#1b5e20',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 6,
  },
  confirmRunOutBtnText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '800',
  },
});
