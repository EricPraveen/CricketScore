import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  SafeAreaView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { createInnings, getMatchById } from '../db/queries';
import { CricketColors as C } from '../constants/theme';

export default function TossScreen() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const match = getMatchById(Number(matchId));

  const [tossWinner, setTossWinner] = useState('');
  const [elected,    setElected]    = useState('');

  // ── Digital Coin Toss State ────────────────────────────────────────────────
  const [coinModalVisible, setCoinModalVisible] = useState(false);
  const [isFlipping,       setIsFlipping]       = useState(false);
  const [flipResult,       setFlipResult]       = useState<string | null>(null);
  const [displayedSide,    setDisplayedSide]    = useState<string>(match?.team1 ?? 'Coin');

  const [spinValue] = useState(() => new Animated.Value(0));
  const [coinScale] = useState(() => new Animated.Value(1));

  const handleFlipCoin = () => {
    if (isFlipping || !match) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {
      // Haptics fallback
    }

    setIsFlipping(true);
    setFlipResult(null);
    spinValue.setValue(0);

    // Random winner: 50/50 chance
    const teams = [match.team1, match.team2];
    const winner = teams[Math.floor(Math.random() * teams.length)];

    // Rapid side alternating during spin
    let toggleCount = 0;
    const interval = setInterval(() => {
      toggleCount++;
      setDisplayedSide(toggleCount % 2 === 0 ? match.team1 : match.team2);
      if (toggleCount >= 10) clearInterval(interval);
    }, 120);

    Animated.parallel([
      Animated.sequence([
        Animated.timing(coinScale, {
          toValue: 1.35,
          duration: 700,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(coinScale, {
          toValue: 1,
          duration: 700,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      clearInterval(interval);
      setDisplayedSide(winner);
      setFlipResult(winner);
      setTossWinner(winner);
      setIsFlipping(false);

      try {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {
        // Haptics fallback
      }
    });
  };

  const battingFirstTeam = elected === 'bat'
    ? tossWinner
    : tossWinner === match?.team1 ? match?.team2 : match?.team1;

  const handleStart = () => {
    if (!tossWinner || !elected) {
      Alert.alert('Incomplete', 'Please complete the toss first.');
      return;
    }
    const batting = battingFirstTeam!;
    const bowling = batting === match?.team1 ? match?.team2 : match?.team1;

    const inningsId = createInnings(Number(matchId), 1, batting, bowling!);

    router.replace(
      `/scoring?matchId=${matchId}&inningsId=${inningsId}&battingTeam=${batting}&bowlingTeam=${bowling}` as any
    );
  };

  if (!match) return null;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Back Arrow */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerTextCol}>
          <Text style={styles.headerTitle}>Match Toss</Text>
          <Text style={styles.headerSub}>Decide who bats or bowls first</Text>
        </View>
      </View>

      <View style={styles.matchCard}>
        <Text style={styles.matchTeamsText}>
          {match.team1} <Text style={styles.vsText}>vs</Text> {match.team2}
        </Text>
        <View style={styles.matchPillRow}>
          <View style={styles.matchPill}>
            <Text style={styles.matchPillText}>{match.overs} Overs</Text>
          </View>
          {match.balls_per_over && match.balls_per_over !== 6 && (
            <View style={[styles.matchPill, { backgroundColor: C.goldLight }]}>
              <Text style={[styles.matchPillText, { color: C.gold }]}>
                {match.balls_per_over} Balls/Over
              </Text>
            </View>
          )}
          <View style={styles.matchPill}>
            <Text style={styles.matchPillText}>{match.innings_count} Innings</Text>
          </View>
        </View>
      </View>

      {/* In-App Coin Toss Generator Button */}
      <TouchableOpacity
        style={styles.coinTossBtn}
        onPress={() => setCoinModalVisible(true)}
        activeOpacity={0.85}
      >
        <View style={styles.coinIconCircle}>
          <Text style={styles.coinIconText}>🪙</Text>
        </View>
        <View style={styles.coinBtnTextCol}>
          <Text style={styles.coinBtnTitle}>Toss Coin In-App</Text>
          <Text style={styles.coinBtnSub}>No physical coin? Tap here to flip digitally</Text>
        </View>
        <Ionicons name="sparkles" size={20} color={C.gold} />
      </TouchableOpacity>

      {/* Toss winner */}
      <View style={styles.section}>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>WHO WON THE TOSS?</Text>
          {tossWinner !== '' && (
            <View style={styles.tossBadge}>
              <Text style={styles.tossBadgeText}>✓ Selected</Text>
            </View>
          )}
        </View>
        <View style={styles.row}>
          {[match.team1, match.team2].map(team => (
            <TouchableOpacity
              key={team}
              style={[styles.optionBtn, tossWinner === team && styles.optionBtnActive]}
              onPress={() => setTossWinner(team)}
              activeOpacity={0.8}
            >
              <Text style={[styles.optionText, tossWinner === team && styles.optionTextActive]}>
                {team}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Elected to */}
      {tossWinner !== '' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{tossWinner.toUpperCase()} ELECTED TO…</Text>
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.optionBtn, elected === 'bat' && styles.optionBtnActive]}
              onPress={() => setElected('bat')}
              activeOpacity={0.8}
            >
              <View style={styles.bowlBtnInner}>
                <Image
                  source={require('../assets/cricket_bat.png')}
                  style={styles.cricketBallImg}
                  resizeMode="contain"
                />
                <Text style={[styles.optionText, elected === 'bat' && styles.optionTextActive]}>
                  Bat First
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionBtn, elected === 'bowl' && styles.optionBtnActive]}
              onPress={() => setElected('bowl')}
              activeOpacity={0.8}
            >
              <View style={styles.bowlBtnInner}>
                <Image
                  source={require('../assets/cricket_ball.png')}
                  style={styles.cricketBallImg}
                  resizeMode="contain"
                />
                <Text style={[styles.optionText, elected === 'bowl' && styles.optionTextActive]}>
                  Bowl First
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Summary */}
      {tossWinner !== '' && elected !== '' && (
        <View style={styles.summary}>
          <Image
            source={require('../assets/cricket_bat.png')}
            style={styles.summaryBatImg}
            resizeMode="contain"
          />
          <Text style={styles.summaryText}>
            <Text style={{ fontWeight: '800' }}>{battingFirstTeam}</Text> will bat first!
          </Text>
        </View>
      )}

      {/* Start Button */}
      <TouchableOpacity
        style={[styles.startBtn, (!tossWinner || !elected) && styles.startBtnDisabled]}
        onPress={handleStart}
        disabled={!tossWinner || !elected}
        activeOpacity={0.85}
      >
        <Text style={styles.startBtnText}>Start Match →</Text>
      </TouchableOpacity>

      {/* ─────── DIGITAL COIN TOSS MODAL ─────── */}
      <Modal visible={coinModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.coinCard}>
            <TouchableOpacity
              style={styles.closeBtn}
              onPress={() => !isFlipping && setCoinModalVisible(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Ionicons name="close" size={22} color={C.textMuted} />
            </TouchableOpacity>

            <Text style={styles.coinModalTitle}>Match Coin Toss</Text>
            <Text style={styles.coinModalSubtitle}>
              {match.team1}  vs  {match.team2}
            </Text>

            {/* 3D Animated Coin */}
            <View style={styles.coinContainer}>
              <Animated.View
                style={[
                  styles.coinVisual,
                  {
                    transform: [
                      { scale: coinScale },
                      {
                        rotateY: spinValue.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0deg', '1800deg'],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.coinInnerCircle}>
                  <Text style={styles.coinMainIcon}>🪙</Text>
                  <Text style={styles.coinFaceText} numberOfLines={1}>
                    {displayedSide}
                  </Text>
                </View>
              </Animated.View>
            </View>

            {/* Result Announcement */}
            {flipResult ? (
              <View style={styles.resultBox}>
                <Text style={styles.resultAnnouncement}>🎉 {flipResult} Won the Toss!</Text>
                <Text style={styles.resultSub}>Automatically selected as toss winner</Text>
              </View>
            ) : (
              <Text style={styles.flipInstruction}>
                {isFlipping ? 'Flipping coin in the air…' : 'Tap the button below to flip!'}
              </Text>
            )}

            {/* Action Buttons */}
            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[styles.flipActionBtn, isFlipping && styles.flipActionBtnDisabled]}
                onPress={handleFlipCoin}
                disabled={isFlipping}
                activeOpacity={0.8}
              >
                <Text style={styles.flipActionBtnText}>
                  {isFlipping ? 'Flipping…' : flipResult ? '🔄 Flip Again' : '🪙 Flip Coin'}
                </Text>
              </TouchableOpacity>

              {flipResult && (
                <TouchableOpacity
                  style={styles.doneActionBtn}
                  onPress={() => setCoinModalVisible(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.doneActionBtnText}>Continue →</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingTop: 12, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.bg,
    borderWidth: 1, borderColor: C.border,
    justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  headerTextCol: { flex: 1 },
  headerTitle:   { color: C.text, fontSize: 20, fontWeight: '800' },
  headerSub:     { color: C.textSub, fontSize: 13, marginTop: 2 },

  matchCard: {
    margin: 16,
    backgroundColor: C.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  matchTeamsText: { color: C.text, fontSize: 18, fontWeight: '800' },
  vsText:         { color: C.red, fontWeight: '900', fontSize: 15 },
  matchPillRow:   { flexDirection: 'row', gap: 8, marginTop: 10 },
  matchPill: {
    backgroundColor: '#F1F5F2',
    paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 12,
  },
  matchPillText:  { color: C.textSub, fontSize: 12, fontWeight: '600' },

  section: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: C.card, borderRadius: 16,
    padding: 18, borderWidth: 1, borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionTitle: {
    color: C.green, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.5, marginBottom: 12,
  },
  row: { flexDirection: 'row', gap: 10 },
  optionBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 12,
    borderWidth: 1, borderColor: C.border,
    backgroundColor: '#F8FAF8', alignItems: 'center',
  },
  optionBtnActive:  { backgroundColor: C.greenLight, borderColor: C.green },
  optionText:       { color: C.textSub, fontSize: 15, fontWeight: '600' },
  optionTextActive: { color: C.greenDark, fontSize: 15, fontWeight: '800' },
  bowlBtnInner:     { flexDirection: 'row', alignItems: 'center', gap: 7 },
  cricketBallImg: {
    width: 20, height: 20,
    borderRadius: 10,
  },

  summary: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: C.greenLight, borderRadius: 14,
    padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1, borderColor: '#86EFAC',
  },
  summaryBatImg: {
    width: 22, height: 22,
  },
  summaryText: { color: C.greenDark, fontSize: 15, fontWeight: '600' },

  startBtn: {
    backgroundColor: C.green, marginHorizontal: 16,
    marginTop: 8, padding: 18, borderRadius: 14, alignItems: 'center',
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  startBtnDisabled: { backgroundColor: '#CBD5E1', shadowOpacity: 0, elevation: 0 },
  startBtnText:     { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },

  // Coin Toss Generator Button
  coinTossBtn: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: C.surface,
    borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: '#FDE68A',
    shadowColor: C.gold, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12, shadowRadius: 6, elevation: 2,
  },
  coinIconCircle: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: '#FEF3C7',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#FDE68A',
  },
  coinIconText: { fontSize: 22 },
  coinBtnTextCol: { flex: 1 },
  coinBtnTitle: { color: C.text, fontSize: 15, fontWeight: '800' },
  coinBtnSub:   { color: C.textSub, fontSize: 11, marginTop: 2 },

  sectionTitleRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  tossBadge: {
    backgroundColor: C.greenLight, paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: 8, borderWidth: 1, borderColor: '#86EFAC',
  },
  tossBadgeText: { color: C.greenDark, fontSize: 10, fontWeight: '800' },

  // Digital Coin Toss Modal
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.65)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  coinCard: {
    width: '100%', maxWidth: 360,
    backgroundColor: C.surface,
    borderRadius: 24, padding: 24,
    alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 8,
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 16,
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  coinModalTitle: { color: C.text, fontSize: 20, fontWeight: '900', marginTop: 4 },
  coinModalSubtitle: { color: C.textSub, fontSize: 13, fontWeight: '600', marginTop: 4, marginBottom: 20 },

  coinContainer: {
    width: 140, height: 140,
    alignItems: 'center', justifyContent: 'center',
    marginVertical: 10,
  },
  coinVisual: {
    width: 130, height: 130, borderRadius: 65,
    backgroundColor: '#F59E0B',
    padding: 6,
    borderWidth: 3, borderColor: '#FDE68A',
    shadowColor: '#D97706', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4, shadowRadius: 12, elevation: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  coinInnerCircle: {
    width: '100%', height: '100%', borderRadius: 60,
    backgroundColor: '#FBBF24',
    borderWidth: 2, borderColor: '#FEF3C7',
    borderStyle: 'dashed',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 8,
  },
  coinMainIcon: { fontSize: 32, marginBottom: 2 },
  coinFaceText: {
    color: '#78350F', fontSize: 13, fontWeight: '900',
    textAlign: 'center', textTransform: 'uppercase',
  },

  flipInstruction: {
    color: C.textSub, fontSize: 13, fontWeight: '600',
    marginTop: 14, marginBottom: 16, textAlign: 'center',
  },
  resultBox: {
    backgroundColor: C.greenLight,
    borderWidth: 1.5, borderColor: '#86EFAC',
    borderRadius: 14, paddingVertical: 10, paddingHorizontal: 16,
    marginTop: 14, marginBottom: 16, alignItems: 'center',
  },
  resultAnnouncement: { color: C.greenDark, fontSize: 16, fontWeight: '900' },
  resultSub: { color: C.greenDark, fontSize: 11, fontWeight: '600', marginTop: 2 },

  modalActionsRow: {
    flexDirection: 'row', gap: 10, width: '100%', marginTop: 4,
  },
  flipActionBtn: {
    flex: 1, backgroundColor: C.surfaceWarm,
    paddingVertical: 14, borderRadius: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: '#FDE68A',
  },
  flipActionBtnDisabled: { opacity: 0.6 },
  flipActionBtnText: { color: '#92400E', fontSize: 15, fontWeight: '800' },
  doneActionBtn: {
    flex: 1, backgroundColor: C.green,
    paddingVertical: 14, borderRadius: 14, alignItems: 'center',
    shadowColor: C.green, shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
  },
  doneActionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
});