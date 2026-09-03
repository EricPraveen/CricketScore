import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  SafeAreaView, ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View,
} from 'react-native';
import { addPlayer, createMatch } from '../db/queries';

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

export default function SetupScreen() {
  const router = useRouter();

  const [team1, setTeam1]         = useState('');
  const [team2, setTeam2]         = useState('');
  const [overs, setOvers]         = useState('');
  const [inningsCount, setInningsCount] = useState<1 | 2>(2);

  const [team1Players, setTeam1Players] = useState<string[]>(Array(11).fill(''));
  const [team2Players, setTeam2Players] = useState<string[]>(Array(11).fill(''));

  const updatePlayer = (team: 'team1' | 'team2', index: number, value: string) => {
    if (team === 'team1') {
      const updated = [...team1Players];
      updated[index] = value;
      setTeam1Players(updated);
    } else {
      const updated = [...team2Players];
      updated[index] = value;
      setTeam2Players(updated);
    }
  };

  const handleStart = () => {
    if (!team1.trim() || !team2.trim() || !overs.trim()) {
      Alert.alert('Missing Info', 'Team names and overs are required.');
      return;
    }
    const oversNum = parseInt(overs, 10);
    if (isNaN(oversNum) || oversNum <= 0) {
      Alert.alert('Invalid Overs', 'Enter a positive number of overs.');
      return;
    }
    const filled1 = team1Players.filter(p => p.trim() !== '');
    const filled2 = team2Players.filter(p => p.trim() !== '');
    if (filled1.length < 2 || filled2.length < 2) {
      Alert.alert('Too Few Players', 'Each team needs at least 2 players.');
      return;
    }

    const matchId = createMatch(team1.trim(), team2.trim(), oversNum, inningsCount);
    filled1.forEach(name => addPlayer(name.trim(), team1.trim(), matchId));
    filled2.forEach(name => addPlayer(name.trim(), team2.trim(), matchId));

    router.push(`/toss?matchId=${matchId}` as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Match Setup</Text>
          <Text style={styles.headerSub}>Configure your match</Text>
        </View>

        {/* Match Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>MATCH SETTINGS</Text>

          <TextInput
            style={styles.input}
            placeholder="Team 1 Name"
            placeholderTextColor={C.textMuted}
            value={team1}
            onChangeText={setTeam1}
          />
          <TextInput
            style={styles.input}
            placeholder="Team 2 Name"
            placeholderTextColor={C.textMuted}
            value={team2}
            onChangeText={setTeam2}
          />
          <TextInput
            style={styles.input}
            placeholder="Number of Overs (e.g. 5, 10, 20)"
            placeholderTextColor={C.textMuted}
            value={overs}
            onChangeText={setOvers}
            keyboardType="numeric"
          />

          {/* Innings Count Selector */}
          <Text style={styles.fieldLabel}>Innings</Text>
          <View style={styles.toggleRow}>
            {([1, 2] as const).map(n => (
              <TouchableOpacity
                key={n}
                style={[styles.toggleBtn, inningsCount === n && styles.toggleBtnActive]}
                onPress={() => setInningsCount(n)}
                activeOpacity={0.8}
              >
                <Text style={[styles.toggleText, inningsCount === n && styles.toggleTextActive]}>
                  {n === 1 ? '1 Innings' : '2 Innings'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.inningsBadgeText}>
            {inningsCount === 1
              ? '🏏 Single innings — no chase'
              : '🏆 Two innings — winning team chases'}
          </Text>
        </View>

        {/* Team 1 Players */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {team1.trim() || 'TEAM 1'} PLAYERS
          </Text>
          {team1Players.map((player, index) => (
            <TextInput
              key={index}
              style={styles.input}
              placeholder={`Player ${index + 1}`}
              placeholderTextColor={C.textMuted}
              value={player}
              onChangeText={val => updatePlayer('team1', index, val)}
            />
          ))}
        </View>

        {/* Team 2 Players */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            {team2.trim() || 'TEAM 2'} PLAYERS
          </Text>
          {team2Players.map((player, index) => (
            <TextInput
              key={index}
              style={styles.input}
              placeholder={`Player ${index + 1}`}
              placeholderTextColor={C.textMuted}
              value={player}
              onChangeText={val => updatePlayer('team2', index, val)}
            />
          ))}
        </View>

        {/* Start Button */}
        <TouchableOpacity style={styles.startBtn} onPress={handleStart} activeOpacity={0.85}>
          <Text style={styles.startBtnText}>Proceed to Toss →</Text>
        </TouchableOpacity>

        <View style={{ height: 48 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.surface,
    paddingHorizontal: 20,
    paddingTop: 16, paddingBottom: 20,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle:  { color: C.text,    fontSize: 24, fontWeight: '800' },
  headerSub:    { color: C.textSub, fontSize: 13, marginTop: 4 },

  section: {
    margin: 16, marginBottom: 0, marginTop: 16,
    backgroundColor: C.card,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: C.border,
  },
  sectionLabel: {
    color: C.accentDim, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.5, marginBottom: 12,
  },

  input: {
    backgroundColor: C.surface, color: C.text,
    padding: 14, borderRadius: 10, marginBottom: 10,
    fontSize: 15, borderWidth: 1, borderColor: C.border,
  },

  fieldLabel: {
    color: C.textMuted, fontSize: 11, letterSpacing: 1, marginBottom: 8,
    marginTop: 4,
  },
  toggleRow:    { flexDirection: 'row', gap: 10, marginBottom: 10 },
  toggleBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surface, alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: C.green, borderColor: C.accent },
  toggleText:      { color: C.textSub, fontSize: 14, fontWeight: '600' },
  toggleTextActive:{ color: C.text,    fontSize: 14, fontWeight: '800' },
  inningsBadgeText:{ color: C.textMuted, fontSize: 12, textAlign: 'center', marginTop: 2 },

  startBtn: {
    backgroundColor: C.green, margin: 16, marginTop: 24,
    padding: 18, borderRadius: 14, alignItems: 'center',
  },
  startBtnText: { color: C.text, fontSize: 17, fontWeight: '800' },
});