import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
    FlatList,
    Alert,
    SafeAreaView,
    StyleSheet,
    Text, TouchableOpacity,
    View
} from 'react-native';
import { initDB } from '../db/database';
import { getAllMatches, getInningsByMatch, deleteMatch } from '../db/queries';

export default function HomeScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>([]);

  useEffect(() => {
    initDB();
    loadMatches();
  }, []);

  const loadMatches = () => {
    const data = getAllMatches();
    setMatches(data);
  };

  const handleOpenMenu = (item: any) => {
    Alert.alert(
      'Match Options',
      `${item.team1} vs ${item.team2}\nStatus: ${item.status === 'live' ? 'Live Match' : 'Completed'}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: '🗑 Delete Match',
          style: 'destructive',
          onPress: () => {
            deleteMatch(item.id);
            loadMatches();
          }
        }
      ]
    );
  };

  const handleMatchPress = (item: any) => {
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
        <Text style={styles.headerTitle}>CricketScore</Text>
        <Text style={styles.headerSub}>Local match scoring</Text>
      </View>

      <TouchableOpacity
        style={styles.newMatchBtn}
        onPress={() => router.push('/setup' as any)}
      >
        <Text style={styles.newMatchIcon}>+</Text>
        <Text style={styles.newMatchText}>New Match</Text>
      </TouchableOpacity>

      {matches.length > 0 && (
        <Text style={styles.sectionTitle}>RECENT MATCHES</Text>
      )}

      {matches.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🏏</Text>
          <Text style={styles.emptyText}>No matches yet</Text>
          <Text style={styles.emptySubText}>Tap + New Match to get started</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.matchCard}
              onPress={() => handleMatchPress(item)}
              activeOpacity={0.8}
            >
              <View style={styles.matchCardTop}>
                <Text style={styles.matchTeams} numberOfLines={1}>
                  {item.team1} vs {item.team2}
                </Text>
                <View style={styles.cardTopRight}>
                  <View style={[
                    styles.statusBadge,
                    item.status === 'live' ? styles.statusLive : styles.statusDone
                  ]}>
                    <Text style={styles.statusText}>
                      {item.status === 'live' ? 'LIVE' : 'DONE'}
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
              <Text style={styles.matchInfo}>
                {item.overs} Overs  •  2 Innings
              </Text>
              <Text style={styles.matchDate}>
                {new Date(item.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric'
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
  container: { flex: 1, backgroundColor: '#080f0b' },

  header: {
    backgroundColor: '#0e1d14',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e3d28',
  },
  headerTitle: { color: '#fff', fontSize: 26, fontWeight: '800' },
  headerSub:   { color: '#4a6655', fontSize: 13, marginTop: 2 },

  newMatchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1b5e20',
    margin: 16,
    padding: 16,
    borderRadius: 14,
    gap: 10,
  },
  newMatchIcon: { color: '#00e676', fontSize: 24, fontWeight: '800', lineHeight: 26 },
  newMatchText: { color: '#fff', fontSize: 17, fontWeight: '700' },

  sectionTitle: {
    color: '#4a6655',
    fontSize: 11,
    letterSpacing: 1.5,
    marginHorizontal: 16,
    marginBottom: 8,
  },

  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emptyIcon:    { fontSize: 48, marginBottom: 8 },
  emptyText:    { color: '#8fa99a', fontSize: 18, fontWeight: '600' },
  emptySubText: { color: '#4a6655', fontSize: 14 },

  matchCard: {
    backgroundColor: '#182a1f',
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e3d28',
    borderLeftWidth: 3,
    borderLeftColor: '#00b359',
  },
  matchCardTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  cardTopRight:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dotsBtn: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsText:     { color: '#8fa99a', fontSize: 20, fontWeight: '700', lineHeight: 22 },
  matchTeams:   { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  statusBadge:  { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusLive:   { backgroundColor: '#1b5e20' },
  statusDone:   { backgroundColor: '#263238' },
  statusText:   { color: '#00e676', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  matchInfo:    { color: '#8fa99a', fontSize: 13, marginBottom: 4 },
  matchDate:    { color: '#4a6655', fontSize: 12 },
});
