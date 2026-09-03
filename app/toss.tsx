import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  SafeAreaView, StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { createInnings, getMatchById } from '../db/queries';

const C = {
  bg:        '#080f0b',
  surface:   '#0e1d14',
  card:      '#182a1f',
  border:    '#1e3d28',
  accent:    '#00e676',
  accentDim: '#00b359',
  text:      '#ffffff',
  textSub:   '#8fa99a',
  textMuted: '#4a6655',
  green:     '#1b5e20',
};

export default function TossScreen() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const match = getMatchById(Number(matchId));

  const [tossWinner, setTossWinner] = useState('');
  const [elected,    setElected]    = useState('');

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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>🪙 Toss</Text>
      </View>

      <View style={styles.matchTitle}>
        <Text style={styles.matchTitleText}>
          {match.team1} vs {match.team2}
        </Text>
        <Text style={styles.matchSubText}>
          {match.overs} Overs  •  {match.innings_count} Innings
        </Text>
      </View>

      {/* Toss winner */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>WHO WON THE TOSS?</Text>
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
            {[
              { label: '🏏 Bat',   value: 'bat'  },
              { label: '🎳 Bowl',  value: 'bowl' },
            ].map(({ label, value }) => (
              <TouchableOpacity
                key={value}
                style={[styles.optionBtn, elected === value && styles.optionBtnActive]}
                onPress={() => setElected(value)}
                activeOpacity={0.8}
              >
                <Text style={[styles.optionText, elected === value && styles.optionTextActive]}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Summary */}
      {tossWinner !== '' && elected !== '' && (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {battingFirstTeam} will bat first 🏏
          </Text>
        </View>
      )}

      {/* Start */}
      <TouchableOpacity
        style={[styles.startBtn, (!tossWinner || !elected) && styles.startBtnDisabled]}
        onPress={handleStart}
        activeOpacity={0.85}
      >
        <Text style={styles.startBtnText}>Start Match →</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.surface,
    paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerText: { color: C.text, fontSize: 24, fontWeight: '800', textAlign: 'center' },

  matchTitle:    { paddingVertical: 16, alignItems: 'center' },
  matchTitleText:{ color: C.textSub, fontSize: 17, fontWeight: '700' },
  matchSubText:  { color: C.textMuted, fontSize: 12, marginTop: 4 },

  section: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: C.card, borderRadius: 14,
    padding: 16, borderWidth: 1, borderColor: C.border,
  },
  sectionTitle: {
    color: C.accentDim, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.5, marginBottom: 12,
  },
  row: { flexDirection: 'row', gap: 10 },
  optionBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surface, alignItems: 'center',
  },
  optionBtnActive:  { backgroundColor: C.green, borderColor: C.accent },
  optionText:       { color: C.textSub, fontSize: 15, fontWeight: '600' },
  optionTextActive: { color: C.text,    fontSize: 15, fontWeight: '800' },

  summary: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: '#0c1c12', borderRadius: 14,
    padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  summaryText: { color: C.accent, fontSize: 15, fontWeight: '700' },

  startBtn: {
    backgroundColor: C.green, marginHorizontal: 16,
    marginTop: 8, padding: 18, borderRadius: 14, alignItems: 'center',
  },
  startBtnDisabled: { backgroundColor: C.card, opacity: 0.5 },
  startBtnText:     { color: C.text, fontSize: 17, fontWeight: '800' },
});