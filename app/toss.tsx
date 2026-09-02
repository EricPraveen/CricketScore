import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    SafeAreaView,
    StyleSheet,
    Text, TouchableOpacity,
    View
} from 'react-native';
import { createInnings, getMatchById } from '../db/queries';

export default function TossScreen() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams();
  const match = getMatchById(Number(matchId));

  const [tossWinner, setTossWinner] = useState('');
  const [elected, setElected] = useState('');

  const handleStart = () => {
    if (!tossWinner || !elected) {
      Alert.alert('Error', 'Please complete the toss!');
      return;
    }

    const battingTeam = elected === 'bat' ? tossWinner :
      (tossWinner === match.team1 ? match.team2 : match.team1);
    const bowlingTeam = battingTeam === match.team1 ? match.team2 : match.team1;

    const inningsId = createInnings(Number(matchId), 1, battingTeam, bowlingTeam);

    router.replace(`/scoring?matchId=${matchId}&inningsId=${inningsId}&battingTeam=${battingTeam}&bowlingTeam=${bowlingTeam}` as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>🪙 Toss</Text>
      </View>

      <View style={styles.matchTitle}>
        <Text style={styles.matchTitleText}>
          {match?.team1} vs {match?.team2}
        </Text>
      </View>

      {/* Toss Winner */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Who won the toss?</Text>
        <View style={styles.row}>
          {[match?.team1, match?.team2].map((team) => (
            <TouchableOpacity
              key={team}
              style={[styles.optionBtn,
                tossWinner === team && styles.optionBtnActive]}
              onPress={() => setTossWinner(team)}
            >
              <Text style={[styles.optionText,
                tossWinner === team && styles.optionTextActive]}>
                {team}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Elected */}
      {tossWinner ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {tossWinner} elected to...
          </Text>
          <View style={styles.row}>
            {['bat', 'bowl'].map((choice) => (
              <TouchableOpacity
                key={choice}
                style={[styles.optionBtn,
                  elected === choice && styles.optionBtnActive]}
                onPress={() => setElected(choice)}
              >
                <Text style={[styles.optionText,
                  elected === choice && styles.optionTextActive]}>
                  {choice === 'bat' ? '🏏 Bat' : '🎳 Bowl'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : null}

      {/* Summary */}
      {tossWinner && elected ? (
        <View style={styles.summary}>
          <Text style={styles.summaryText}>
            {elected === 'bat' ? tossWinner :
              (tossWinner === match?.team1 ? match?.team2 : match?.team1)
            } will bat first 🏏
          </Text>
        </View>
      ) : null}

      {/* Start Button */}
      <TouchableOpacity
        style={[styles.startBtn,
          (!tossWinner || !elected) && styles.startBtnDisabled]}
        onPress={handleStart}
      >
        <Text style={styles.startBtnText}>Start Match →</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#080f0b' },
  header: {
    backgroundColor: '#0e1d14',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e3d28',
  },
  headerText: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  matchTitle: { paddingVertical: 18, alignItems: 'center' },
  matchTitleText: { color: '#8fa99a', fontSize: 16, fontWeight: '700' },
  section: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#182a1f',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1e3d28',
  },
  sectionTitle: {
    color: '#00b359',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  row: { flexDirection: 'row', gap: 10 },
  optionBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e3d28',
    backgroundColor: '#0e1d14',
    alignItems: 'center',
  },
  optionBtnActive: {
    backgroundColor: '#1b5e20',
    borderColor: '#00b359',
  },
  optionText: { color: '#8fa99a', fontSize: 15, fontWeight: '600' },
  optionTextActive: { color: '#fff', fontWeight: '800' },
  summary: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#0c1c12',
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#1e3d28',
  },
  summaryText: { color: '#00e676', fontSize: 15, fontWeight: '700' },
  startBtn: {
    backgroundColor: '#1b5e20',
    marginHorizontal: 16,
    marginTop: 8,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  startBtnDisabled: { backgroundColor: '#132019', opacity: 0.5 },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});