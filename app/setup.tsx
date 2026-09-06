import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text, TextInput, TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addPlayer, createMatch, getMatchById, getPlayersByMatch } from '../db/queries';
import { CricketColors as C } from '../constants/theme';

export default function SetupScreen() {
  const router = useRouter();
  const { rematchMatchId } = useLocalSearchParams<{ rematchMatchId?: string }>();

  // Pre-load previous match details if in Rematch mode
  const oldMatch = rematchMatchId ? getMatchById(Number(rematchMatchId)) : null;
  const initialPlayers = oldMatch ? getPlayersByMatch(oldMatch.id) : [];
  const initialT1 = oldMatch
    ? initialPlayers.filter(p => p.team.trim().toLowerCase() === oldMatch.team1.trim().toLowerCase()).map(p => p.name)
    : [];
  const initialT2 = oldMatch
    ? initialPlayers.filter(p => p.team.trim().toLowerCase() === oldMatch.team2.trim().toLowerCase()).map(p => p.name)
    : [];

  const [team1, setTeam1]         = useState(oldMatch?.team1 ?? '');
  const [team2, setTeam2]         = useState(oldMatch?.team2 ?? '');
  const [overs, setOvers]         = useState(oldMatch?.overs ? oldMatch.overs.toString() : '');
  const [matchType, setMatchType] = useState<'ordinary' | 'custom'>(
    oldMatch && oldMatch.balls_per_over && oldMatch.balls_per_over !== 6 ? 'custom' : 'ordinary'
  );
  const [ballsPerOver, setBallsPerOver] = useState(
    oldMatch?.balls_per_over ? oldMatch.balls_per_over.toString() : '6'
  );
  const [inningsCount, setInningsCount] = useState<1 | 2>(
    oldMatch?.innings_count === 1 ? 1 : 2
  );

  const [team1Players, setTeam1Players] = useState<string[]>(
    initialT1.length >= 2 ? initialT1 : initialT1.length === 1 ? [initialT1[0], ''] : ['', '']
  );
  const [team2Players, setTeam2Players] = useState<string[]>(
    initialT2.length >= 2 ? initialT2 : initialT2.length === 1 ? [initialT2[0], ''] : ['', '']
  );

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

  const addPlayerField = (team: 'team1' | 'team2') => {
    if (team === 'team1') {
      if (team1Players.length >= 15) return;
      setTeam1Players(prev => [...prev, '']);
    } else {
      if (team2Players.length >= 15) return;
      setTeam2Players(prev => [...prev, '']);
    }
  };

  const removePlayerField = (team: 'team1' | 'team2', index: number) => {
    if (team === 'team1') {
      if (team1Players.length <= 2) return;
      setTeam1Players(prev => prev.filter((_, i) => i !== index));
    } else {
      if (team2Players.length <= 2) return;
      setTeam2Players(prev => prev.filter((_, i) => i !== index));
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
    const ballsPerOverNum = matchType === 'ordinary' ? 6 : parseInt(ballsPerOver, 10);
    if (isNaN(ballsPerOverNum) || ballsPerOverNum <= 0) {
      Alert.alert('Invalid Balls Count', 'Enter a valid number of balls per over (e.g. 4, 5, 6).');
      return;
    }
    if (ballsPerOverNum > 20) {
      Alert.alert('Too Many Balls', 'Balls per over cannot exceed 20.');
      return;
    }
    const filled1 = team1Players.filter(p => p.trim() !== '');
    const filled2 = team2Players.filter(p => p.trim() !== '');
    if (filled1.length < 2 || filled2.length < 2) {
      Alert.alert('Too Few Players', 'Each team needs at least 2 players.');
      return;
    }

    const matchId = createMatch(team1.trim(), team2.trim(), oversNum, inningsCount, ballsPerOverNum);
    filled1.forEach(name => addPlayer(name.trim(), team1.trim(), matchId));
    filled2.forEach(name => addPlayer(name.trim(), team2.trim(), matchId));

    router.push(`/toss?matchId=${matchId}` as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>

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
            <Text style={styles.headerTitle}>
              {rematchMatchId ? '🔄 Rematch Setup' : 'Match Setup'}
            </Text>
            <Text style={styles.headerSub}>
              {rematchMatchId ? 'Teams & players pre-filled from match' : 'Configure your teams & rules'}
            </Text>
          </View>
        </View>

        {Boolean(rematchMatchId) && (
          <View style={styles.rematchBanner}>
            <View style={styles.rematchBannerIconBox}>
              <Ionicons name="repeat" size={18} color={C.green} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rematchBannerTitle}>Rematch Details Loaded</Text>
              <Text style={styles.rematchBannerDesc}>
                All settings & players pre-filled! Make any tweaks if needed, then proceed to Toss.
              </Text>
            </View>
          </View>
        )}

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

          {/* Match Type Selector */}
          <Text style={styles.fieldLabel}>Match Type</Text>
          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, matchType === 'ordinary' && styles.toggleBtnActive]}
              onPress={() => {
                setMatchType('ordinary');
                setBallsPerOver('6');
              }}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, matchType === 'ordinary' && styles.toggleTextActive]}>
                🏏 Ordinary (6 Balls)
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, matchType === 'custom' && styles.toggleBtnActive]}
              onPress={() => setMatchType('custom')}
              activeOpacity={0.8}
            >
              <Text style={[styles.toggleText, matchType === 'custom' && styles.toggleTextActive]}>
                ⚙️ Custom Match
              </Text>
            </TouchableOpacity>
          </View>

          {/* Custom Balls per Over Selector */}
          {matchType === 'custom' && (
            <View style={styles.customContainer}>
              <Text style={styles.fieldLabel}>Balls per Over</Text>
              <View style={styles.chipRow}>
                {['4', '5', '6', '8'].map(b => (
                  <TouchableOpacity
                    key={b}
                    style={[styles.chipBtn, ballsPerOver === b && styles.chipBtnActive]}
                    onPress={() => setBallsPerOver(b)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.chipText, ballsPerOver === b && styles.chipTextActive]}>
                      {b} Balls
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <TextInput
                style={[styles.input, { marginBottom: 4 }]}
                placeholder="Or type balls per over"
                placeholderTextColor={C.textMuted}
                value={ballsPerOver}
                onChangeText={setBallsPerOver}
                keyboardType="numeric"
              />
              <Text style={styles.inningsBadgeText}>
                {`⚡ Custom rules: ${parseInt(ballsPerOver, 10) || 6} legal balls per over`}
              </Text>
            </View>
          )}

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
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>
              {team1.trim() || 'TEAM 1'} PLAYERS ({team1Players.length})
            </Text>
            <Text style={styles.minPlayersHint}>Min 2 required</Text>
          </View>
          {team1Players.map((player, index) => (
            <View key={index} style={styles.playerInputRow}>
              <TextInput
                style={[styles.input, styles.playerInputFlex]}
                placeholder={`Player ${index + 1}${index < 2 ? ' *' : ''}`}
                placeholderTextColor={C.textMuted}
                value={player}
                onChangeText={val => updatePlayer('team1', index, val)}
              />
              {team1Players.length > 2 && (
                <TouchableOpacity
                  style={styles.removePlayerBtn}
                  onPress={() => removePlayerField('team1', index)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.removePlayerText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {team1Players.length < 15 && (
            <TouchableOpacity
              style={styles.addPlayerBtn}
              onPress={() => addPlayerField('team1')}
              activeOpacity={0.8}
            >
              <Text style={styles.addPlayerIcon}>+</Text>
              <Text style={styles.addPlayerText}>Add Player</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Team 2 Players */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionLabel}>
              {team2.trim() || 'TEAM 2'} PLAYERS ({team2Players.length})
            </Text>
            <Text style={styles.minPlayersHint}>Min 2 required</Text>
          </View>
          {team2Players.map((player, index) => (
            <View key={index} style={styles.playerInputRow}>
              <TextInput
                style={[styles.input, styles.playerInputFlex]}
                placeholder={`Player ${index + 1}${index < 2 ? ' *' : ''}`}
                placeholderTextColor={C.textMuted}
                value={player}
                onChangeText={val => updatePlayer('team2', index, val)}
              />
              {team2Players.length > 2 && (
                <TouchableOpacity
                  style={styles.removePlayerBtn}
                  onPress={() => removePlayerField('team2', index)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.removePlayerText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          {team2Players.length < 15 && (
            <TouchableOpacity
              style={styles.addPlayerBtn}
              onPress={() => addPlayerField('team2')}
              activeOpacity={0.8}
            >
              <Text style={styles.addPlayerIcon}>+</Text>
              <Text style={styles.addPlayerText}>Add Player</Text>
            </TouchableOpacity>
          )}
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
  headerTitle:  { color: C.text, fontSize: 20, fontWeight: '800' },
  headerSub:    { color: C.textSub, fontSize: 13, marginTop: 2 },

  section: {
    margin: 16, marginBottom: 0, marginTop: 16,
    backgroundColor: C.card,
    borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionLabel: {
    color: C.green, fontSize: 11, fontWeight: '800',
    letterSpacing: 1.5, marginBottom: 12,
  },

  input: {
    backgroundColor: '#F8FAF8', color: C.text,
    padding: 14, borderRadius: 10, marginBottom: 10,
    fontSize: 15, borderWidth: 1, borderColor: C.border,
  },

  fieldLabel: {
    color: C.textSub, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8,
    marginTop: 4,
  },
  toggleRow:    { flexDirection: 'row', gap: 10, marginBottom: 10 },
  toggleBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    borderWidth: 1, borderColor: C.border,
    backgroundColor: '#F8FAF8', alignItems: 'center',
  },
  toggleBtnActive: { backgroundColor: C.greenLight, borderColor: C.green },
  toggleText:      { color: C.textSub, fontSize: 14, fontWeight: '600' },
  toggleTextActive:{ color: C.greenDark, fontSize: 14, fontWeight: '800' },
  inningsBadgeText:{ color: C.textSub, fontSize: 12, textAlign: 'center', marginTop: 2 },

  customContainer: {
    backgroundColor: C.surfaceWarm,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FDE68A',
    marginBottom: 12,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  chipBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center',
  },
  chipBtnActive: {
    backgroundColor: C.greenLight,
    borderColor: C.green,
  },
  chipText: {
    color: C.textSub,
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: C.greenDark,
    fontWeight: '800',
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  minPlayersHint: {
    color: C.textMuted,
    fontSize: 11,
    marginBottom: 12,
  },
  playerInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playerInputFlex: {
    flex: 1,
  },
  removePlayerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    borderRadius: 10,
    backgroundColor: C.redLight,
    borderWidth: 1,
    borderColor: '#FECACA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  removePlayerText: {
    color: C.red,
    fontSize: 13,
    fontWeight: 'bold',
  },
  addPlayerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: C.green,
    backgroundColor: C.greenLight,
    marginTop: 4,
  },
  addPlayerIcon: {
    color: C.greenDark,
    fontSize: 17,
    fontWeight: 'bold',
  },
  addPlayerText: {
    color: C.greenDark,
    fontSize: 13,
    fontWeight: '700',
  },

  startBtn: {
    backgroundColor: C.green, margin: 16, marginTop: 24,
    padding: 18, borderRadius: 14, alignItems: 'center',
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  startBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },

  rematchBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.greenLight,
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 16,
    marginBottom: 6,
    padding: 14,
    gap: 12,
  },
  rematchBannerIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#DCFCE7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  rematchBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: C.greenDark,
    marginBottom: 2,
  },
  rematchBannerDesc: {
    fontSize: 12,
    color: '#15803D',
    lineHeight: 17,
  },
});