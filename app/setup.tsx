import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
    Alert,
    SafeAreaView, ScrollView,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View
} from 'react-native';
import { addPlayer, createMatch } from '../db/queries';

export default function SetupScreen() {
  const router = useRouter();

  const [team1, setTeam1] = useState('');
  const [team2, setTeam2] = useState('');
  const [overs, setOvers] = useState('');
  const [team1Players, setTeam1Players] = useState<string[]>(Array(11).fill(''));
  const [team2Players, setTeam2Players] = useState<string[]>(Array(11).fill(''));

  const updatePlayer = (team: string, index: number, value: string) => {
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
      Alert.alert('Error', 'Team names and overs are required!');
      return;
    }

    const oversNum = parseInt(overs);
    if (isNaN(oversNum) || oversNum <= 0) {
      Alert.alert('Error', 'Please enter a valid number of overs!');
      return;
    }

    const filledTeam1 = team1Players.filter(p => p.trim() !== '');
    const filledTeam2 = team2Players.filter(p => p.trim() !== '');

    if (filledTeam1.length < 2 || filledTeam2.length < 2) {
      Alert.alert('Error', 'Each team needs at least 2 players!');
      return;
    }

    // Always create a 2-innings match
    const matchId = createMatch(team1.trim(), team2.trim(), oversNum, 2);

    // Add players
    filledTeam1.forEach(name => addPlayer(name.trim(), team1.trim(), matchId));
    filledTeam2.forEach(name => addPlayer(name.trim(), team2.trim(), matchId));

    // Go to toss screen
    router.push(`/toss?matchId=${matchId}` as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Match Setup</Text>
          <Text style={styles.headerSub}>Configure teams & overs (2 Innings)</Text>
        </View>

        {/* Match Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MATCH SETTINGS</Text>

          <TextInput
            style={styles.input}
            placeholder="Team 1 Name"
            placeholderTextColor="#4a6655"
            value={team1}
            onChangeText={setTeam1}
          />

          <TextInput
            style={styles.input}
            placeholder="Team 2 Name"
            placeholderTextColor="#4a6655"
            value={team2}
            onChangeText={setTeam2}
          />

          <TextInput
            style={styles.input}
            placeholder="Number of Overs (e.g. 5, 10, 20)"
            placeholderTextColor="#4a6655"
            value={overs}
            onChangeText={setOvers}
            keyboardType="numeric"
          />

          <View style={styles.inningsBadge}>
            <Text style={styles.inningsBadgeText}>🏏 Standard 2-Innings Match</Text>
          </View>
        </View>

        {/* Team 1 Players */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {team1.trim() || 'TEAM 1'} PLAYERS
          </Text>
          {team1Players.map((player, index) => (
            <TextInput
              key={index}
              style={styles.input}
              placeholder={`Player ${index + 1}`}
              placeholderTextColor="#4a6655"
              value={player}
              onChangeText={(val) => updatePlayer('team1', index, val)}
            />
          ))}
        </View>

        {/* Team 2 Players */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {team2.trim() || 'TEAM 2'} PLAYERS
          </Text>
          {team2Players.map((player, index) => (
            <TextInput
              key={index}
              style={styles.input}
              placeholder={`Player ${index + 1}`}
              placeholderTextColor="#4a6655"
              value={player}
              onChangeText={(val) => updatePlayer('team2', index, val)}
            />
          ))}
        </View>

        {/* Start Button */}
        <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
          <Text style={styles.startBtnText}>Proceed to Toss →</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  headerTitle: { color: '#fff', fontSize: 24, fontWeight: '800' },
  headerSub:   { color: '#8fa99a', fontSize: 13, marginTop: 4 },
  section: {
    margin: 16,
    marginBottom: 0,
    marginTop: 16,
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
  input: {
    backgroundColor: '#0e1d14',
    color: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#1e3d28',
  },
  inningsBadge: {
    backgroundColor: '#0e1d14',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1e3d28',
    alignItems: 'center',
    marginTop: 2,
  },
  inningsBadgeText: {
    color: '#8fa99a',
    fontSize: 13,
    fontWeight: '600',
  },
  startBtn: {
    backgroundColor: '#1b5e20',
    margin: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  startBtnText: { color: '#fff', fontSize: 17, fontWeight: '800' },
});