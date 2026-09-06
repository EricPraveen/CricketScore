import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  Alert, FlatList,
  StyleSheet,
  Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Match,
  deleteMatch, getAllMatches,
  getInningsByMatch,
  updateMatchStatus,
} from '../db/queries';
import { CricketColors as C } from '../constants/theme';

export default function HomeScreen() {
  const router  = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);

  // Reload every time the screen is focused (e.g. after returning from scoring)
  useFocusEffect(
    useCallback(() => {
      setMatches(getAllMatches());
    }, [])
  );

  const handleOpenMenu = (item: Match) => {
    Alert.alert(
      'Match Options',
      `${item.team1} vs ${item.team2}\nStatus: ${item.status === 'live' ? 'Live' : 'Completed'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        ...(item.status === 'completed'
          ? [
              {
                text: '✏️ Resume Match / Edit',
                onPress: () => {
                  updateMatchStatus(item.id, 'live');
                  const innings = getInningsByMatch(item.id);
                  if (innings.length === 0) {
                    router.push(`/toss?matchId=${item.id}` as any);
                    return;
                  }
                  const latest = innings[innings.length - 1];
                  router.push(
                    `/scoring?matchId=${item.id}&inningsId=${latest.id}&battingTeam=${latest.batting_team}&bowlingTeam=${latest.bowling_team}` as any
                  );
                },
              },
            ]
          : []),
        {
          text: '🔄 Rematch (Play Again)',
          onPress: () => {
            router.push(`/setup?rematchMatchId=${item.id}` as any);
          },
        },
        {
          text: '🗑 Delete Match',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Match',
              `Are you sure you want to delete ${item.team1} vs ${item.team2}? All data will be lost.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    deleteMatch(item.id);
                    setMatches(getAllMatches());
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleMatchPress = (item: Match) => {
    if (item.status === 'completed') {
      router.push(`/scorecard?matchId=${item.id}` as any);
      return;
    }
    const innings = getInningsByMatch(item.id);
    if (innings.length === 0) {
      router.push(`/toss?matchId=${item.id}` as any);
      return;
    }
    const latest = innings[innings.length - 1];
    router.push(
      `/scoring?matchId=${item.id}&inningsId=${latest.id}&battingTeam=${latest.batting_team}&bowlingTeam=${latest.bowling_team}` as any
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🏏 CricketScore</Text>
        <Text style={styles.headerSub}>Live Scoring & Match Tracker</Text>
      </View>

      <TouchableOpacity
        style={styles.newMatchBtn}
        onPress={() => router.push('/setup' as any)}
        activeOpacity={0.85}
      >
        <View style={styles.newMatchIconBox}>
          <Ionicons name="add" size={20} color="#FFFFFF" />
        </View>
        <Text style={styles.newMatchText}>Start New Match</Text>
      </TouchableOpacity>

      {matches.length > 0 && (
        <Text style={styles.sectionTitle}>RECENT MATCHES</Text>
      )}

      {matches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Text style={styles.emptyIcon}>🏏</Text>
          </View>
          <Text style={styles.emptyText}>No matches yet</Text>
          <Text style={styles.emptySubText}>Tap Start New Match to begin live scoring</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 28 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.matchCard}
              onPress={() => handleMatchPress(item)}
              activeOpacity={0.8}
            >
              <View style={styles.matchCardTop}>
                <Text style={styles.matchTeams} numberOfLines={1}>
                  {item.team1} <Text style={styles.vsText}>vs</Text> {item.team2}
                </Text>
                <View style={styles.cardTopRight}>
                  <View style={[
                    styles.statusBadge,
                    item.status === 'live' ? styles.statusLive : styles.statusDone,
                  ]}>
                    {item.status === 'live' && <View style={styles.livePulseDot} />}
                    <Text style={[
                      styles.statusText,
                      item.status === 'live' ? styles.statusTextLive : styles.statusTextDone,
                    ]}>
                      {item.status === 'live' ? 'LIVE' : 'FINISHED'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.dotsBtn}
                    onPress={() => handleOpenMenu(item)}
                    hitSlop={{ top: 12, right: 12, bottom: 12, left: 12 }}
                  >
                    <Text style={styles.dotsText}>⋮</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.matchPillsRow}>
                <View style={styles.infoPill}>
                  <Text style={styles.infoPillText}>{item.overs} Overs</Text>
                </View>
                {item.balls_per_over && item.balls_per_over !== 6 && (
                  <View style={[styles.infoPill, { backgroundColor: C.goldLight }]}>
                    <Text style={[styles.infoPillText, { color: C.gold }]}>
                      {item.balls_per_over}b/ov
                    </Text>
                  </View>
                )}
                <View style={styles.infoPill}>
                  <Text style={styles.infoPillText}>{item.innings_count} Innings</Text>
                </View>
              </View>

              <Text style={styles.matchDate}>
                {new Date(item.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                })}
              </Text>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    backgroundColor: C.surface,
    paddingHorizontal: 20,
    paddingTop: 16, paddingBottom: 18,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerTitle:  { color: C.text, fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  headerSub:    { color: C.textSub, fontSize: 13, marginTop: 2, fontWeight: '500' },

  newMatchBtn: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.green, margin: 16, padding: 16,
    borderRadius: 16, gap: 12,
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28, shadowRadius: 10, elevation: 4,
  },
  newMatchIconBox: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  newMatchIcon: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', lineHeight: 22 },
  newMatchText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  sectionTitle: {
    color: C.green, fontSize: 11, fontWeight: '800', letterSpacing: 1.5,
    marginHorizontal: 16, marginBottom: 10, marginTop: 4,
  },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyIconCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.greenLight,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  emptyIcon:    { fontSize: 32 },
  emptyText:    { color: C.text, fontSize: 18, fontWeight: '800' },
  emptySubText: { color: C.textSub, fontSize: 13, marginTop: 4, textAlign: 'center' },

  matchCard: {
    backgroundColor: C.card, marginHorizontal: 16, marginBottom: 12,
    padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  matchCardTop: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  cardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dotsBtn: {
    paddingHorizontal: 8, paddingVertical: 4,
    borderRadius: 8, backgroundColor: C.bg,
  },
  dotsText:    { color: C.textSub, fontSize: 18, fontWeight: '700', lineHeight: 18 },
  matchTeams:  { color: C.text, fontSize: 17, fontWeight: '800', flex: 1, marginRight: 8 },
  vsText:      { color: C.red, fontWeight: '900', fontSize: 14 },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  statusLive:  { backgroundColor: C.redLight, borderWidth: 1, borderColor: '#FECACA' },
  statusDone:  { backgroundColor: C.greenLight, borderWidth: 1, borderColor: '#86EFAC' },
  livePulseDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: C.red },
  statusText:  { fontSize: 11, fontWeight: '800', letterSpacing: 0.5 },
  statusTextLive: { color: C.red },
  statusTextDone: { color: C.greenDark },
  matchPillsRow: { flexDirection: 'row', gap: 6, marginBottom: 8 },
  infoPill: {
    backgroundColor: '#F1F5F2', paddingHorizontal: 10, paddingVertical: 4,
    borderRadius: 10,
  },
  infoPillText: { color: C.textSub, fontSize: 12, fontWeight: '600' },
  matchDate:   { color: C.textMuted, fontSize: 12 },
});
