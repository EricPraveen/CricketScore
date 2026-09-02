import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
    Alert, Modal,
    SafeAreaView, ScrollView,
    StyleSheet,
    Text, TouchableOpacity,
    View
} from 'react-native';
import {
    addDelivery,
    createInnings,
    getBatsmanStats, getBowlerStats,
    getDeliveriesByInnings,
    getInningsByMatch,
    getLegalBalls,
    getMatchById,
    getOversDisplay,
    getPlayersByTeam,
    getTotalRuns, getWickets,
    undoLastDelivery,
    updateMatchStatus
} from '../db/queries';

export default function ScoringScreen() {
  const router = useRouter();
  const { matchId, inningsId, battingTeam, bowlingTeam } = useLocalSearchParams();
  const matchRef = useRef(getMatchById(Number(matchId)));  // stable ref, won't go stale
  const match = matchRef.current;

  const [totalRuns, setTotalRuns]       = useState(0);
  const [wickets, setWickets]           = useState(0);
  const [oversDisplay, setOversDisplay] = useState("0.0");
  const [legalBalls, setLegalBalls]     = useState(0);
  const [currentOver, setCurrentOver]   = useState<any[]>([]);

  const [battingPlayers, setBattingPlayers] = useState<any[]>([]);
  const [bowlingPlayers, setBowlingPlayers] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds]     = useState<number[]>([]);

  const [striker, setStriker]             = useState<any>(null);
  const [nonStriker, setNonStriker]       = useState<any>(null);
  const [currentBowler, setCurrentBowler] = useState<any>(null);

  const [wicketModal, setWicketModal]               = useState(false);
  const [selectBatsmanModal, setSelectBatsmanModal] = useState(false);
  const [selectBowlerModal, setSelectBowlerModal]   = useState(false);
  const [needNewBowler, setNeedNewBowler]           = useState(false);

  const [dismissedPlayer, setDismissedPlayer] = useState<any>(null);
  const [firstInningsScore, setFirstInningsScore] = useState(0);

  useEffect(() => {
    const batting = getPlayersByTeam(Number(matchId), battingTeam as string);
    const bowling = getPlayersByTeam(Number(matchId), bowlingTeam as string);
    setBattingPlayers(batting);
    setBowlingPlayers(bowling);

    // Reset on-field and modal state for this innings
    setStriker(null);
    setNonStriker(null);
    setCurrentBowler(null);
    setDismissedIds([]);
    setDismissedPlayer(null);
    setNeedNewBowler(false);
    setWicketModal(false);
    setSelectBowlerModal(false);

    const allInnings = getInningsByMatch(Number(matchId));
    if (allInnings.length >= 2) {
      setFirstInningsScore(getTotalRuns(allInnings[0].id));
    } else {
      setFirstInningsScore(0);
    }

    refreshScore();
    setSelectBatsmanModal(true);
  }, [matchId, inningsId, battingTeam, bowlingTeam]);

  const refreshScore = () => {
    const runs  = getTotalRuns(Number(inningsId));
    const wkts  = getWickets(Number(inningsId));
    const overs = getOversDisplay(Number(inningsId));
    const balls = getLegalBalls(Number(inningsId));
    setTotalRuns(runs);
    setWickets(wkts);
    setOversDisplay(overs);
    setLegalBalls(balls);
    const allDeliveries = getDeliveriesByInnings(Number(inningsId));
    const overNo = Math.floor(balls / 6);
    setCurrentOver(allDeliveries.filter((d: any) => d.over_no === overNo));
  };

  // Always 2 innings for every match:
  // 1st innings: battingTeam bats, bowlingTeam bowls
  // 2nd innings: roles swap (bowlingTeam bats, battingTeam bowls)
  const handleInningsEnd = () => {
    const existingInnings = getInningsByMatch(Number(matchId));
    const isFirstInnings  = existingInnings.length <= 1;

    if (isFirstInnings) {
      const runs = getTotalRuns(Number(inningsId));
      const wkts = getWickets(Number(inningsId));
      const ovs  = getOversDisplay(Number(inningsId));
      Alert.alert(
        "🏏 Innings Over!",
        `${battingTeam}: ${runs}/${wkts} (${ovs} ov)\n\n${bowlingTeam} needs ${runs + 1} to win`,
        [{
          text: "Start 2nd Innings →",
          onPress: () => {
            const newId = createInnings(
              Number(matchId), 2,
              bowlingTeam as string,  // bowling team now BATS
              battingTeam as string   // batting team now BOWLS
            );
            router.replace(
              `/scoring?matchId=${matchId}&inningsId=${newId}&battingTeam=${bowlingTeam}&bowlingTeam=${battingTeam}` as any
            );
          }
        }]
      );
    } else {
      // 2nd innings done -> mark match completed
      updateMatchStatus(Number(matchId), "completed");
      router.replace(`/scorecard?matchId=${matchId}` as any);
    }
  };

  const checkTargetChased = (): boolean => {
    if (firstInningsScore <= 0) return false;
    const newRuns = getTotalRuns(Number(inningsId));
    if (newRuns > firstInningsScore) {
      const wkts = getWickets(Number(inningsId));
      Alert.alert(
        "Match Won!",
        `${battingTeam} won by ${battingPlayers.length - 1 - wkts} wickets!`,
        [{
          text: "View Scorecard",
          onPress: () => {
            updateMatchStatus(Number(matchId), "completed");
            router.replace(`/scorecard?matchId=${matchId}` as any);
          }
        }]
      );
      return true;
    }
    return false;
  };

  // FIX #2: compute strike rotation synchronously before any setState
  const handleRun = (runs: number, extrasType: string | null = null, extrasValue: number = 0) => {
    if (!striker || !currentBowler) {
      Alert.alert("Error", "Select batsman and bowler first!");
      return;
    }
    const currentOverNo = Math.floor(legalBalls / 6);
    const currentBallNo = legalBalls % 6;
    const isLegalBall   = !extrasType || extrasType === "bye";

    addDelivery(
      Number(inningsId), currentOverNo, currentBallNo,
      striker.id, currentBowler.id, runs,
      extrasType, extrasValue, false, null, null
    );

    const newBalls   = getLegalBalls(Number(inningsId));
    const totalOvers = match?.overs || 0;
    refreshScore();
    if (checkTargetChased()) return;

    if (isLegalBall && newBalls % 6 === 0 && newBalls > 0) {
      // End of over: original non-striker always faces the new over
      if (newBalls / 6 >= totalOvers) {
        handleInningsEnd();
      } else {
        setStriker(nonStriker);
        setNonStriker(striker);
        Alert.alert("Over Complete!", `Over ${newBalls / 6} done. Select new bowler.`);
        setSelectBowlerModal(true);
      }
    } else {
      // Mid-over: rotate on odd runs (not wide)
      const effectiveRuns = extrasType === "bye" ? extrasValue : runs;
      if (effectiveRuns % 2 !== 0 && extrasType !== "wide") {
        setStriker(nonStriker);
        setNonStriker(striker);
      }
    }
  };

  const handleWicket = () => {
    if (!striker || !currentBowler) {
      Alert.alert("Error", "Select batsman and bowler first!");
      return;
    }
    setDismissedPlayer(striker);
    setWicketModal(true);
  };

  const confirmWicket = (type: string) => {
    const currentOverNo = Math.floor(legalBalls / 6);
    const currentBallNo = legalBalls % 6;
    addDelivery(
      Number(inningsId), currentOverNo, currentBallNo,
      striker.id, currentBowler.id, 0,
      null, 0, true, type, dismissedPlayer?.id
    );
    // FIX #4: track dismissed so they don't reappear
    setDismissedIds(prev => [...prev, dismissedPlayer?.id]);
    setWicketModal(false);
    refreshScore();

    const newWickets = getWickets(Number(inningsId));
    const newBalls   = getLegalBalls(Number(inningsId));
    const totalOvers = match?.overs || 0;

    if (newWickets >= battingPlayers.length - 1) {
      handleInningsEnd();
      return;
    }
    // FIX #5: handle over-complete after wicket ball
    if (newBalls % 6 === 0 && newBalls > 0 && newBalls / 6 < totalOvers) {
      setStriker(nonStriker);
      setNonStriker(null);
      setNeedNewBowler(true);
      Alert.alert("Over Complete!", `Over ${newBalls / 6} done!`);
    }
    setSelectBatsmanModal(true);
  };

  const handleUndo = () => {
    Alert.alert("Undo", "Undo last ball?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Undo", onPress: () => {
          undoLastDelivery(Number(inningsId));
          refreshScore();
        }
      }
    ]);
  };

  const getBallDisplay = (d: any) => {
    if (d.is_wicket)              return "W";
    if (d.extras_type === "wide") return "Wd";
    if (d.extras_type === "noball") return "Nb";
    if (d.extras_type === "bye")  return "B";
    if (d.runs === 4)             return "4";
    if (d.runs === 6)             return "6";
    return d.runs.toString();
  };

  const getBallColor = (d: any) => {
    if (d.is_wicket)   return "#c62828";
    if (d.extras_type) return "#e65100";
    if (d.runs === 6)  return "#6a1b9a";
    if (d.runs === 4)  return "#1565c0";
    if (d.runs > 0)    return "#1b5e20";
    return "#263238";
  };

  const totalOversNum  = match?.overs || 0;
  const target         = firstInningsScore > 0 ? firstInningsScore + 1 : 0;
  const runsNeeded     = target > 0 ? Math.max(0, target - totalRuns) : 0;
  const ballsLeft      = totalOversNum * 6 - legalBalls;
  const runRate        = legalBalls > 0 ? ((totalRuns / legalBalls) * 6).toFixed(2) : "0.00";
  const requiredRR     = ballsLeft > 0 && runsNeeded > 0
    ? ((runsNeeded / ballsLeft) * 6).toFixed(2) : "0.00";
  const targetPct      = target > 0 ? Math.min(totalRuns / target, 1) : 0;

  // FIX #4: exclude on-field AND dismissed players from selection list
  const availableBatsmen = battingPlayers.filter(
    p => p.id !== striker?.id && p.id !== nonStriker?.id && !dismissedIds.includes(p.id)
  );

  // FIX #3: clear step-labelled batsman modal
  const batsmanModalTitle = !striker
    ? "Select Striker"
    : !nonStriker
    ? "Select Non-Striker"
    : "Select New Batsman";
  const batsmanModalStep  = !striker ? "Step 1 of 2" : !nonStriker ? "Step 2 of 2" : "";

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} bounces={false}>

        {/* Scoreboard */}
        <View style={styles.scoreboard}>
          <Text style={styles.teamsText}>
            {battingTeam} <Text style={styles.vsText}>vs</Text> {bowlingTeam}
          </Text>
          <Text style={styles.scoreText}>{totalRuns}/{wickets}</Text>
          <View style={styles.scoreMetaRow}>
            <Text style={styles.oversText}>{oversDisplay} / {totalOversNum} ov</Text>
            <View style={styles.rrPill}>
              <Text style={styles.rrText}>CRR {runRate}</Text>
            </View>
          </View>
        </View>

        {/* Target bar — 2nd innings only */}
        {target > 0 && (
          <View style={styles.targetBox}>
            <View style={styles.targetHeader}>
              <Text style={styles.targetNeedText}>
                {runsNeeded === 0
                  ? "Target Reached!"
                  : `Need ${runsNeeded} off ${ballsLeft} ball${ballsLeft !== 1 ? "s" : ""}`}
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

        {/* Current Over */}
        <View style={styles.overContainer}>
          <Text style={styles.overLabel}>THIS OVER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.overBalls}>
              {currentOver.length === 0
                ? <Text style={styles.emptyOver}>—</Text>
                : currentOver.map((ball, i) => (
                  <View key={i} style={[styles.ball, { backgroundColor: getBallColor(ball) }]}>
                    <Text style={styles.ballText}>{getBallDisplay(ball)}</Text>
                  </View>
                ))
              }
            </View>
          </ScrollView>
        </View>

        {/* Batsmen */}
        <View style={styles.playersRow}>
          {[{ player: striker, isStriker: true }, { player: nonStriker, isStriker: false }].map(
            ({ player, isStriker }) => {
              const stats = player ? getBatsmanStats(Number(inningsId), player.id) : null;
              const sr    = stats && stats.balls_faced > 0
                ? ((stats.runs / stats.balls_faced) * 100).toFixed(0) : "0";
              return (
                <View
                  key={isStriker ? "st" : "ns"}
                  style={[styles.playerCard, isStriker && styles.strikerCard]}
                >
                  <Text style={styles.playerName} numberOfLines={1}>
                    {isStriker ? "Bat " : ""}{player?.name || "—"}{isStriker && player ? " *" : ""}
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
            }
          )}
        </View>

        {/* Bowler */}
        <View style={styles.bowlerRow}>
          <View style={styles.bowlerInfo}>
            <Text style={styles.bowlerName} numberOfLines={1}>
              Bowl: {currentBowler?.name || "Select Bowler"}
            </Text>
            {currentBowler && (() => {
              const bs  = getBowlerStats(Number(inningsId), currentBowler.id);
              const ovs = `${Math.floor(bs.balls_bowled / 6)}.${bs.balls_bowled % 6}`;
              return (
                <Text style={styles.bowlerStats}>
                  {bs.wickets}-{bs.runs_given}  •  {ovs} ov
                </Text>
              );
            })()}
          </View>
          <TouchableOpacity style={styles.changeBtn} onPress={() => setSelectBowlerModal(true)}>
            <Text style={styles.changeBtnText}>Change</Text>
          </TouchableOpacity>
        </View>

        {/* Run Buttons */}
        <View style={styles.runButtons}>
          {[0, 1, 2, 3, 4, 6].map(run => (
            <TouchableOpacity
              key={run}
              style={[
                styles.runBtn,
                run === 0 && styles.runBtn0,
                run === 4 && styles.runBtn4,
                run === 6 && styles.runBtn6,
              ]}
              onPress={() => handleRun(run)}
            >
              <Text style={[
                styles.runBtnText,
                run === 4 && styles.runBtnText4,
                run === 6 && styles.runBtnText6,
              ]}>{run}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Extras */}
        <View style={styles.extrasRow}>
          {[
            { label: "Wide",    type: "wide",   val: 1 },
            { label: "No Ball", type: "noball", val: 1 },
            { label: "Bye",     type: "bye",    val: 1 },
          ].map(({ label, type, val }) => (
            <TouchableOpacity
              key={type}
              style={styles.extraBtn}
              onPress={() => handleRun(0, type, val)}
            >
              <Text style={styles.extraBtnText}>{label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Wicket + Undo */}
        <View style={styles.bottomRow}>
          <TouchableOpacity style={styles.undoBtn} onPress={handleUndo}>
            <Text style={styles.undoBtnText}>Undo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.wicketBtn} onPress={handleWicket}>
            <Text style={styles.wicketBtnText}>Wicket</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 28 }} />
      </ScrollView>

      {/* Wicket Modal */}
      <Modal visible={wicketModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>How Out?</Text>
            {dismissedPlayer && (
              <Text style={styles.modalSubtitle}>{dismissedPlayer.name}</Text>
            )}
            {["Bowled", "Caught", "Run Out", "LBW", "Stumped", "Hit Wicket"].map(type => (
              <TouchableOpacity
                key={type}
                style={styles.modalOption}
                onPress={() => confirmWicket(type)}
              >
                <Text style={styles.modalOptionText}>{type}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setWicketModal(false)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Select Batsman Modal */}
      <Modal visible={selectBatsmanModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>{batsmanModalTitle}</Text>
            {batsmanModalStep !== "" && (
              <Text style={styles.modalSubtitle}>{batsmanModalStep}</Text>
            )}
            {(!striker ? battingPlayers : availableBatsmen).map(player => (
              <TouchableOpacity
                key={player.id}
                style={styles.modalOption}
                onPress={() => {
                  if (!striker) {
                    setStriker(player);
                  } else if (!nonStriker) {
                    setNonStriker(player);
                    setSelectBatsmanModal(false);
                    if (!currentBowler || needNewBowler) {
                      setNeedNewBowler(false);
                      setSelectBowlerModal(true);
                    }
                  } else {
                    setStriker(player);
                    setSelectBatsmanModal(false);
                    if (needNewBowler) {
                      setNeedNewBowler(false);
                      setSelectBowlerModal(true);
                    }
                  }
                }}
              >
                <Text style={styles.modalOptionText}>{player.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </Modal>

      {/* Select Bowler Modal */}
      <Modal visible={selectBowlerModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Select Bowler</Text>
            {bowlingPlayers.map(player => {
              const bs  = getBowlerStats(Number(inningsId), player.id);
              const ovs = `${Math.floor(bs.balls_bowled / 6)}.${bs.balls_bowled % 6}`;
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
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const C = {
  bg:         "#080f0b",
  surface:    "#0e1d14",
  surface2:   "#132019",
  card:       "#182a1f",
  cardActive: "#1e3d28",
  accent:     "#00e676",
  accentDim:  "#00b359",
  text:       "#ffffff",
  textSub:    "#8fa99a",
  textMuted:  "#4a6655",
  red:        "#f44336",
  redDark:    "#b71c1c",
  blue:       "#2979ff",
  purple:     "#9c27b0",
  orange:     "#ff9800",
  dot:        "#263238",
  border:     "#1e3d28",
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  scoreboard: {
    backgroundColor: C.surface,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20,
    alignItems: "center",
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  teamsText:    { color: C.textSub, fontSize: 12, letterSpacing: 1.2, marginBottom: 4 },
  vsText:       { color: C.textMuted },
  scoreText:    { color: C.text, fontSize: 56, fontWeight: "800", letterSpacing: -2 },
  scoreMetaRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  oversText:    { color: C.textSub, fontSize: 13 },
  rrPill: {
    backgroundColor: C.surface2,
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
  },
  rrText: { color: C.accent, fontSize: 12, fontWeight: "700" },

  targetBox: {
    backgroundColor: "#0c1c12",
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  targetHeader:   { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  targetNeedText: { color: C.text, fontSize: 14, fontWeight: "600" },
  rrrPill: {
    backgroundColor: "#1a1500",
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 20, borderWidth: 1, borderColor: "#3d2f00",
  },
  rrrText:       { color: C.orange, fontSize: 12, fontWeight: "700" },
  targetBarBg:   { height: 6, backgroundColor: C.surface2, borderRadius: 3, overflow: "hidden" },
  targetBarFill: { height: 6, backgroundColor: C.accent, borderRadius: 3 },
  targetLabel:   { color: C.textMuted, fontSize: 11, marginTop: 6, textAlign: "right" },

  overContainer: {
    backgroundColor: C.surface,
    paddingHorizontal: 16, paddingVertical: 10,
    flexDirection: "row", alignItems: "center", gap: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  overLabel:  { color: C.textMuted, fontSize: 10, letterSpacing: 1.5 },
  overBalls:  { flexDirection: "row", gap: 6, alignItems: "center" },
  emptyOver:  { color: C.textMuted, fontSize: 18 },
  ball: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  ballText: { color: "#fff", fontSize: 11, fontWeight: "800" },

  playersRow:  { flexDirection: "row", padding: 10, gap: 8 },
  playerCard: {
    flex: 1, backgroundColor: C.card,
    borderRadius: 14, padding: 12,
    borderWidth: 1, borderColor: C.border,
  },
  strikerCard: { borderColor: C.accentDim, backgroundColor: C.cardActive },
  playerName:  { color: C.text, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  playerScore: { color: C.text, fontSize: 24, fontWeight: "800" },
  playerBalls: { fontSize: 14, fontWeight: "400", color: C.textSub },
  playerMeta:  { color: C.textMuted, fontSize: 11, marginTop: 4 },

  bowlerRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.card,
    marginHorizontal: 10, borderRadius: 14,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: C.border,
  },
  bowlerInfo:  { flex: 1, marginRight: 8 },
  bowlerName:  { color: C.text, fontSize: 13, fontWeight: "600" },
  bowlerStats: { color: C.textSub, fontSize: 11, marginTop: 3 },
  changeBtn: {
    backgroundColor: C.surface2,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, borderWidth: 1, borderColor: C.border,
  },
  changeBtnText: { color: C.accent, fontSize: 12, fontWeight: "600" },

  runButtons: {
    flexDirection: "row", flexWrap: "wrap",
    paddingHorizontal: 10, gap: 8,
    justifyContent: "center", marginBottom: 8,
  },
  runBtn: {
    width: 90, height: 90, borderRadius: 45,
    backgroundColor: C.card,
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: C.border,
  },
  runBtn0: { borderColor: C.dot,    backgroundColor: "#121c18" },
  runBtn4: { borderColor: C.blue,   backgroundColor: "#0a1a35" },
  runBtn6: { borderColor: C.purple, backgroundColor: "#160a22" },
  runBtnText:  { color: C.text, fontSize: 28, fontWeight: "800" },
  runBtnText4: { color: "#82b1ff" },
  runBtnText6: { color: "#e040fb" },

  extrasRow: { flexDirection: "row", paddingHorizontal: 10, gap: 8, marginBottom: 8 },
  extraBtn: {
    flex: 1, backgroundColor: "#140f00",
    paddingVertical: 12, borderRadius: 12,
    alignItems: "center",
    borderWidth: 1, borderColor: "#3d2f00",
  },
  extraBtnText: { color: C.orange, fontSize: 13, fontWeight: "700" },

  bottomRow: { flexDirection: "row", paddingHorizontal: 10, gap: 8 },
  undoBtn: {
    flex: 1, backgroundColor: C.card,
    paddingVertical: 16, borderRadius: 14,
    alignItems: "center",
    borderWidth: 1, borderColor: C.border,
  },
  undoBtnText: { color: C.textSub, fontSize: 15, fontWeight: "600" },
  wicketBtn: {
    flex: 2, backgroundColor: C.redDark,
    paddingVertical: 16, borderRadius: 14,
    alignItems: "center",
  },
  wicketBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.88)",
    justifyContent: "flex-end",
  },
  modalBox: {
    backgroundColor: "#111e16",
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 20, paddingBottom: 36,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  modalTitle:      { color: C.text, fontSize: 18, fontWeight: "800", marginBottom: 4, textAlign: "center" },
  modalSubtitle:   { color: C.textSub, fontSize: 13, textAlign: "center", marginBottom: 12 },
  modalOption: {
    paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: "#1a2e22",
  },
  modalOptionText: { color: C.text, fontSize: 16 },
  modalOptionSub:  { color: C.textMuted, fontSize: 12, marginTop: 2 },
  modalCancel:     { paddingTop: 18, alignItems: "center" },
  modalCancelText: { color: C.red, fontSize: 15, fontWeight: "700" },
});
