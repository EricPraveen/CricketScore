import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Alert,
  ScrollView, Share,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  getBatsmanStats, getBowlerStats,
  getInningsByMatch,
  getMatchById,
  getOversDisplay,
  getPlayersByTeam,
  getTotalRuns, getWickets,
  updateMatchStatus,
} from '../db/queries';
import { CricketColors as C } from '../constants/theme';

export default function ScorecardScreen() {
  const router   = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();

  const match   = getMatchById(Number(matchId));
  const ballsPerOver = match?.balls_per_over ?? 6;
  const innings = getInningsByMatch(Number(matchId));

  // ── Result calculation ─────────────────────────────────────────────────────
  const getResult = (): string => {
    if (innings.length < 1) return '';
    if (innings.length === 1) {
      const r = getTotalRuns(innings[0].id);
      const w = getWickets(innings[0].id);
      return `${innings[0].batting_team} scored ${r}/${w}`;
    }
    const runs1 = getTotalRuns(innings[0].id);
    const runs2 = getTotalRuns(innings[1].id);
    const wkts2 = getWickets(innings[1].id);
    const pl2   = getPlayersByTeam(Number(matchId), innings[1].batting_team);

    if (runs2 > runs1) {
      const byWickets = pl2.length - 1 - wkts2;
      return `${innings[1].batting_team} won by ${byWickets} wicket${byWickets !== 1 ? 's' : ''}! 🏆`;
    } else if (runs1 > runs2) {
      const byRuns = runs1 - runs2;
      return `${innings[0].batting_team} won by ${byRuns} run${byRuns !== 1 ? 's' : ''}! 🏆`;
    }
    return "Match Tied! 🤝";
  };

  // ── Share text ─────────────────────────────────────────────────────────────
  const handleShare = async () => {
    const date = match?.created_at
      ? new Date(match.created_at).toLocaleDateString('en-IN', {
          day: '2-digit', month: '2-digit', year: 'numeric',
        })
      : '—';

    let text = `🏏 ${match?.team1} vs ${match?.team2}\nDate: ${date}\n\n`;

    innings.forEach((inn, i) => {
      const bp  = getPlayersByTeam(Number(matchId), inn.batting_team);
      const blp = getPlayersByTeam(Number(matchId), inn.bowling_team);
      const runs = getTotalRuns(inn.id);
      const wkts = getWickets(inn.id);
      const ovs  = getOversDisplay(inn.id, ballsPerOver);

      text += `INNINGS ${i + 1} - ${inn.batting_team}: ${runs}/${wkts} (${ovs} ov)\n`;
      text += 'BATTING:\n';
      bp.forEach(p => {
        const s = getBatsmanStats(inn.id, p.id);
        if (s.balls_faced > 0 || s.runs > 0) {
          text += `${p.name}: ${s.runs}(${s.balls_faced})\n`;
        }
      });
      text += 'BOWLING:\n';
      blp.forEach(p => {
        const s = getBowlerStats(inn.id, p.id);
        if (s.balls_bowled > 0) {
          const o = `${Math.floor(s.balls_bowled / ballsPerOver)}.${s.balls_bowled % ballsPerOver}`;
          text += `${p.name}: ${o}-${s.runs_given}-${s.wickets}\n`;
        }
      });
      text += '\n';
    });

    text += `Result: ${getResult()}`;
    await Share.share({ message: text });
  };

  const handleResumeScoring = () => {
    if (innings.length === 0) return;
    const latest = innings[innings.length - 1];
    Alert.alert(
      'Resume Match?',
      'Reopen match to edit scores or undo deliveries?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Resume Scoring ✏️',
          onPress: () => {
            updateMatchStatus(Number(matchId), 'live');
            router.push(
              `/scoring?matchId=${matchId}&inningsId=${latest.id}&battingTeam=${latest.batting_team}&bowlingTeam=${latest.bowling_team}` as any
            );
          },
        },
      ]
    );
  };

  const result = getResult();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Header with Back Arrow */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.replace('/' as any)}
            activeOpacity={0.7}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Ionicons name="arrow-back" size={22} color={C.text} />
          </TouchableOpacity>
          <View style={styles.headerTextCol}>
            <Text style={styles.headerText}>Match Scorecard</Text>
            <Text style={styles.matchText}>
              {match?.team1} vs {match?.team2}{ballsPerOver !== 6 ? ` • ${ballsPerOver}b/ov` : ''}
            </Text>
          </View>
        </View>

        {/* Result Box */}
        {result !== '' && (
          <View style={styles.resultBox}>
            <Text style={styles.resultText}>{result}</Text>
          </View>
        )}

        {/* Innings */}
        {innings.map((inn, i) => {
          const bp  = getPlayersByTeam(Number(matchId), inn.batting_team);
          const blp = getPlayersByTeam(Number(matchId), inn.bowling_team);
          const runs = getTotalRuns(inn.id);
          const wkts = getWickets(inn.id);
          const ovs  = getOversDisplay(inn.id, ballsPerOver);

          return (
            <View key={inn.id} style={styles.inningsSection}>
              <View style={styles.inningsHeader}>
                <Text style={styles.inningsTitle}>
                  Innings {i + 1} — {inn.batting_team}
                </Text>
                <Text style={styles.inningsScore}>
                  {runs}/{wkts}
                  {'  '}<Text style={styles.inningsOvers}>({ovs} ov)</Text>
                </Text>
              </View>

              {/* Batting table */}
              <Text style={styles.tableTitle}>BATTING</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.thCell, { flex: 2, textAlign: 'left' }]}>Batsman</Text>
                <Text style={styles.thCell}>R</Text>
                <Text style={styles.thCell}>B</Text>
                <Text style={styles.thCell}>4s</Text>
                <Text style={styles.thCell}>6s</Text>
                <Text style={styles.thCell}>SR</Text>
              </View>
              {bp.map(p => {
                const s  = getBatsmanStats(inn.id, p.id);
                const sr = s.balls_faced > 0
                  ? ((s.runs / s.balls_faced) * 100).toFixed(0)
                  : '-';
                return (
                  <View key={p.id} style={styles.tableRow}>
                    <Text style={[styles.tdCell, { flex: 2, textAlign: 'left', fontWeight: '600' }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={[styles.tdCell, s.runs >= 50 && styles.highlight]}>
                      {s.runs}
                    </Text>
                    <Text style={styles.tdCell}>{s.balls_faced}</Text>
                    <Text style={styles.tdCell}>{s.fours}</Text>
                    <Text style={styles.tdCell}>{s.sixes}</Text>
                    <Text style={styles.tdCell}>{sr}</Text>
                  </View>
                );
              })}

              {/* Bowling table */}
              <Text style={[styles.tableTitle, { marginTop: 18 }]}>BOWLING</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.thCell, { flex: 2, textAlign: 'left' }]}>Bowler</Text>
                <Text style={styles.thCell}>O</Text>
                <Text style={styles.thCell}>R</Text>
                <Text style={styles.thCell}>W</Text>
                <Text style={styles.thCell}>Eco</Text>
              </View>
              {blp.map(p => {
                const s   = getBowlerStats(inn.id, p.id);
                if (s.balls_bowled === 0) return null;
                const ovs = `${Math.floor(s.balls_bowled / ballsPerOver)}.${s.balls_bowled % ballsPerOver}`;
                const eco = s.balls_bowled > 0
                  ? ((s.runs_given / s.balls_bowled) * ballsPerOver).toFixed(1)
                  : '-';
                return (
                  <View key={p.id} style={styles.tableRow}>
                    <Text style={[styles.tdCell, { flex: 2, textAlign: 'left', fontWeight: '600' }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.tdCell}>{ovs}</Text>
                    <Text style={styles.tdCell}>{s.runs_given}</Text>
                    <Text style={[styles.tdCell, s.wickets >= 3 && styles.highlightWickets]}>
                      {s.wickets}
                    </Text>
                    <Text style={styles.tdCell}>{eco}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}

        {/* Actions */}
        <TouchableOpacity
          style={styles.resumeBtn}
          onPress={handleResumeScoring}
          activeOpacity={0.85}
        >
          <Text style={styles.resumeBtnText}>↩ Resume Match / Undo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.rematchBtn}
          onPress={() => router.push(`/setup?rematchMatchId=${matchId}` as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.rematchBtnText}>🔄 Rematch / Play Again</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Text style={styles.shareBtnText}>📤 Share Scorecard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace('/' as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.homeBtnText}>🏠 Return to Home</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

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
  headerText:  { color: C.text, fontSize: 20, fontWeight: '800' },
  matchText:   { color: C.textSub, fontSize: 13, marginTop: 2 },

  resultBox: {
    backgroundColor: C.greenLight, margin: 16,
    padding: 16, borderRadius: 16, alignItems: 'center',
    borderWidth: 1, borderColor: '#86EFAC',
    shadowColor: C.green, shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 6, elevation: 2,
  },
  resultText: { color: C.greenDark, fontSize: 16, fontWeight: '800', textAlign: 'center' },

  inningsSection: {
    marginHorizontal: 16, marginBottom: 16,
    backgroundColor: C.card,
    borderRadius: 16, padding: 18,
    borderWidth: 1, borderColor: C.border,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  inningsHeader: {
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingBottom: 12, marginBottom: 14,
  },
  inningsTitle:  { color: C.green, fontSize: 12, fontWeight: '800', letterSpacing: 0.5 },
  inningsScore:  { color: C.text, fontSize: 28, fontWeight: '900', marginTop: 4 },
  inningsOvers:  { color: C.textSub, fontSize: 15, fontWeight: '500' },

  tableTitle:  { color: C.greenDark, fontSize: 11, fontWeight: '800', marginBottom: 8, letterSpacing: 1 },
  tableHeader: {
    flexDirection: 'row', paddingVertical: 8,
    backgroundColor: '#F8FAF8', borderRadius: 8,
    borderWidth: 1, borderColor: C.border, marginBottom: 4,
  },
  thCell: {
    flex: 1, color: C.textSub, fontSize: 11,
    fontWeight: '800', textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F1F5F2',
    alignItems: 'center',
  },
  tdCell:    { flex: 1, color: C.text, fontSize: 13, textAlign: 'center' },
  highlight: { color: C.greenDark, fontWeight: '800' },
  highlightWickets: { color: C.red, fontWeight: '900' },

  resumeBtn: {
    backgroundColor: '#FEF3C7',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#F59E0B',
  },
  resumeBtnText: { color: '#B45309', fontSize: 16, fontWeight: '800' },

  rematchBtn: {
    backgroundColor: C.green,
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 18,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  rematchBtnText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },

  shareBtn: {
    backgroundColor: C.cardAlt,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 16,
    borderRadius: 14,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: C.green,
  },
  shareBtnText: { color: C.greenDark, fontSize: 15, fontWeight: '800' },

  homeBtn: {
    backgroundColor: C.surface, marginHorizontal: 16,
    padding: 16, borderRadius: 14, alignItems: 'center',
    borderWidth: 1.5, borderColor: C.border,
  },
  homeBtnText: { color: C.textSub, fontSize: 15, fontWeight: '700' },
});
