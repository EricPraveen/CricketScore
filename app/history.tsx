import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CricketColors as C } from '../constants/theme';
import {
  deleteMatch,
  getAllMatches,
  getInningsByMatch,
  Match,
  updateMatchStatus,
} from '../db/queries';
import { getMatchSummary, MatchSummary } from '../utils/cricketStats';

export default function MatchHistoryScreen() {
  const router = useRouter();
  const [matches, setMatches] = useState<Match[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'live'>('all');

  const loadMatches = useCallback(() => {
    setMatches(getAllMatches());
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMatches();
    }, [loadMatches])
  );

  // Compute summaries for all matches
  const matchSummaries = useMemo(() => {
    return matches.map((m) => getMatchSummary(m));
  }, [matches]);

  // Filter matches based on search query and active tab
  const filteredSummaries = useMemo(() => {
    return matchSummaries.filter((s) => {
      const team1Match = s.match.team1.toLowerCase().includes(searchQuery.toLowerCase());
      const team2Match = s.match.team2.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSearch = searchQuery.trim() === '' || team1Match || team2Match;

      if (!matchesSearch) return false;

      if (activeTab === 'completed') return s.isCompleted;
      if (activeTab === 'live') return !s.isCompleted;
      return true;
    });
  }, [matchSummaries, searchQuery, activeTab]);

  const totalCount = matchSummaries.length;
  const completedCount = matchSummaries.filter((s) => s.isCompleted).length;
  const liveCount = totalCount - completedCount;

  const handleResumeMatch = (item: Match) => {
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
  };

  const handleDeleteMatch = (item: Match) => {
    Alert.alert(
      'Delete Match',
      `Are you sure you want to delete ${item.team1} vs ${item.team2}? All scores and data will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteMatch(item.id);
            loadMatches();
          },
        },
      ]
    );
  };

  const handleMatchCardPress = (summary: MatchSummary) => {
    if (summary.isCompleted) {
      router.push(`/scorecard?matchId=${summary.match.id}` as any);
    } else {
      handleResumeMatch(summary.match);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.replace('/' as any)}
          activeOpacity={0.7}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={C.text} />
        </TouchableOpacity>
        <View style={styles.headerTextCol}>
          <Text style={styles.headerTitle}>📜 Match History</Text>
          <Text style={styles.headerSub}>All recorded matches & scorecards</Text>
        </View>
      </View>

      {/* Mini Stats Banner */}
      <View style={styles.statsBanner}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{totalCount}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: C.green }]}>{completedCount}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statBox}>
          <Text style={[styles.statValue, { color: C.gold }]}>{liveCount}</Text>
          <Text style={styles.statLabel}>Live / Open</Text>
        </View>
      </View>

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={18} color={C.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search teams..."
          placeholderTextColor={C.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          clearButtonMode="while-editing"
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={18} color={C.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={styles.tabsRow}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'all' && styles.tabBtnActive]}
          onPress={() => setActiveTab('all')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
            All ({totalCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'completed' && styles.tabBtnActive]}
          onPress={() => setActiveTab('completed')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
            Finished ({completedCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === 'live' && styles.tabBtnActive]}
          onPress={() => setActiveTab('live')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'live' && styles.tabTextActive]}>
            Live ({liveCount})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Matches List */}
      {filteredSummaries.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={styles.emptyIconCircle}>
            <Text style={styles.emptyIcon}>🏏</Text>
          </View>
          <Text style={styles.emptyTitle}>
            {searchQuery.trim() ? 'No matches found' : 'No matches in this category'}
          </Text>
          <Text style={styles.emptySub}>
            {searchQuery.trim()
              ? `No games found matching "${searchQuery}"`
              : 'Create a new match from Home to start scoring'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredSummaries}
          keyExtractor={(item) => item.match.id.toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const dateFormatted = item.match.created_at
              ? new Date(item.match.created_at).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : '';

            return (
              <View style={styles.card}>
                {/* Top Row: Teams, Status, Date */}
                <TouchableOpacity
                  onPress={() => handleMatchCardPress(item)}
                  activeOpacity={0.7}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardTeamsCol}>
                      <Text style={styles.cardTeamsText} numberOfLines={1}>
                        {item.match.team1} <Text style={styles.vsText}>vs</Text> {item.match.team2}
                      </Text>
                      <Text style={styles.cardDateText}>
                        📅 {dateFormatted} • {item.match.overs} Ov
                        {item.match.balls_per_over !== 6 ? ` (${item.match.balls_per_over}b/ov)` : ''}
                      </Text>
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        item.isCompleted ? styles.statusDone : styles.statusLive,
                      ]}
                    >
                      {!item.isCompleted && <View style={styles.livePulseDot} />}
                      <Text
                        style={[
                          styles.statusBadgeText,
                          item.isCompleted ? styles.statusTextDone : styles.statusTextLive,
                        ]}
                      >
                        {item.isCompleted ? 'FINISHED' : 'LIVE'}
                      </Text>
                    </View>
                  </View>

                  {/* Innings Scores Section */}
                  <View style={styles.scoresSection}>
                    {item.innings.length === 0 ? (
                      <Text style={styles.noInningsText}>Match yet to begin</Text>
                    ) : (
                      item.innings.map((inn) => (
                        <View key={inn.id} style={styles.inningsRow}>
                          <Text style={styles.teamScoreName} numberOfLines={1}>
                            {inn.battingTeam}
                          </Text>
                          <View style={styles.scoreNumberCol}>
                            <Text style={styles.teamScoreTotal}>
                              {inn.runs}/{inn.wickets}
                            </Text>
                            <Text style={styles.teamOversText}>({inn.oversStr} ov)</Text>
                          </View>
                        </View>
                      ))
                    )}
                  </View>

                  {/* Result Box */}
                  {item.resultText !== '' && (
                    <View
                      style={[
                        styles.resultBanner,
                        item.isCompleted ? styles.resultBannerDone : styles.resultBannerLive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.resultBannerText,
                          item.isCompleted ? styles.resultTextDone : styles.resultTextLive,
                        ]}
                        numberOfLines={1}
                      >
                        {item.resultText}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>

                {/* Card Quick Actions */}
                <View style={styles.cardActionsRow}>
                  {item.isCompleted ? (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnPrimary]}
                      onPress={() => router.push(`/scorecard?matchId=${item.match.id}` as any)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="document-text-outline" size={14} color="#FFFFFF" />
                      <Text style={styles.actionBtnPrimaryText}>Scorecard</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionBtnLive]}
                      onPress={() => handleResumeMatch(item.match)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="play-outline" size={14} color="#FFFFFF" />
                      <Text style={styles.actionBtnPrimaryText}>Resume Scoring</Text>
                    </TouchableOpacity>
                  )}

                  {item.isCompleted && (
                    <TouchableOpacity
                      style={styles.actionBtnSecondary}
                      onPress={() => handleResumeMatch(item.match)}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="pencil-outline" size={14} color={C.textSub} />
                      <Text style={styles.actionBtnSecondaryText}>Edit</Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.actionBtnSecondary}
                    onPress={() => router.push(`/setup?rematchMatchId=${item.match.id}` as any)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="refresh-outline" size={14} color={C.textSub} />
                    <Text style={styles.actionBtnSecondaryText}>Rematch</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.actionBtnDanger}
                    onPress={() => handleDeleteMatch(item.match)}
                    activeOpacity={0.8}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="trash-outline" size={14} color="#DC2626" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    backgroundColor: C.surface,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTextCol: {
    flex: 1,
  },
  headerTitle: {
    color: C.text,
    fontSize: 18,
    fontWeight: '800',
  },
  headerSub: {
    color: C.textSub,
    fontSize: 12,
    marginTop: 2,
  },
  statsBanner: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    color: C.text,
    fontSize: 18,
    fontWeight: '900',
  },
  statLabel: {
    color: C.textSub,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: C.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 42,
    borderWidth: 1,
    borderColor: C.border,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: C.text,
    height: '100%',
  },
  tabsRow: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: C.surface,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: C.greenLight,
    borderColor: C.green,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '600',
    color: C.textSub,
  },
  tabTextActive: {
    color: C.greenDark,
    fontWeight: '800',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    backgroundColor: C.surface,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardTeamsCol: {
    flex: 1,
    marginRight: 8,
  },
  cardTeamsText: {
    color: C.text,
    fontSize: 16,
    fontWeight: '800',
  },
  vsText: {
    color: C.textMuted,
    fontWeight: '400',
    fontSize: 13,
  },
  cardDateText: {
    color: C.textSub,
    fontSize: 11,
    marginTop: 2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusLive: {
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  statusDone: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  statusTextLive: {
    color: '#B45309',
  },
  statusTextDone: {
    color: '#64748B',
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D97706',
    marginRight: 5,
  },
  scoresSection: {
    backgroundColor: '#F8FAF8',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 6,
  },
  inningsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  teamScoreName: {
    color: C.text,
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  scoreNumberCol: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
  },
  teamScoreTotal: {
    color: C.greenDark,
    fontSize: 15,
    fontWeight: '900',
  },
  teamOversText: {
    color: C.textSub,
    fontSize: 11,
    fontWeight: '500',
  },
  noInningsText: {
    color: C.textMuted,
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 4,
  },
  resultBanner: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  resultBannerDone: {
    backgroundColor: '#DCFCE7',
  },
  resultBannerLive: {
    backgroundColor: '#FEF3C7',
  },
  resultBannerText: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  resultTextDone: {
    color: '#15803D',
  },
  resultTextLive: {
    color: '#92400E',
  },
  cardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 7,
    flex: 1,
  },
  actionBtnPrimary: {
    backgroundColor: C.green,
  },
  actionBtnLive: {
    backgroundColor: '#D97706',
  },
  actionBtnPrimaryText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  actionBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 7,
    backgroundColor: '#F1F5F9',
  },
  actionBtnSecondaryText: {
    color: C.textSub,
    fontSize: 12,
    fontWeight: '600',
  },
  actionBtnDanger: {
    padding: 6,
    borderRadius: 7,
    backgroundColor: '#FEE2E2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  emptyIcon: {
    fontSize: 28,
  },
  emptyTitle: {
    color: C.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 6,
    textAlign: 'center',
  },
  emptySub: {
    color: C.textMuted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
});
