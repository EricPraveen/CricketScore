import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  SafeAreaView, ScrollView, Share,
  StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import {
  getBatsmanStats, getBowlerStats,
  getInningsByMatch,
  getMatchById,
  getOversDisplay,
  getPlayersByTeam,
  getTotalRuns, getWickets,
} from '../db/queries';

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
};

export default function ScorecardScreen() {
  const router   = useRouter();
  const { matchId } = useLocalSearchParams<{ matchId: string }>();

  const match   = getMatchById(Number(matchId));
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
      const ovs  = getOversDisplay(inn.id);

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
          const o = `${Math.floor(s.balls_bowled / 6)}.${s.balls_bowled % 6}`;
          text += `${p.name}: ${o}-${s.runs_given}-${s.wickets}\n`;
        }
      });
      text += '\n';
    });

    text += `Result: ${getResult()}`;
    await Share.share({ message: text });
  };

  const result = getResult();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerText}>Scorecard</Text>
          <Text style={styles.matchText}>{match?.team1} vs {match?.team2}</Text>
        </View>

        {/* Result */}
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
          const ovs  = getOversDisplay(inn.id);

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
                    <Text style={[styles.tdCell, { flex: 2, textAlign: 'left' }]} numberOfLines={1}>
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
              <Text style={[styles.tableTitle, { marginTop: 16 }]}>BOWLING</Text>
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
                const ovs = `${Math.floor(s.balls_bowled / 6)}.${s.balls_bowled % 6}`;
                const eco = s.balls_bowled > 0
                  ? ((s.runs_given / s.balls_bowled) * 6).toFixed(1)
                  : '-';
                return (
                  <View key={p.id} style={styles.tableRow}>
                    <Text style={[styles.tdCell, { flex: 2, textAlign: 'left' }]} numberOfLines={1}>
                      {p.name}
                    </Text>
                    <Text style={styles.tdCell}>{ovs}</Text>
                    <Text style={styles.tdCell}>{s.runs_given}</Text>
                    <Text style={[styles.tdCell, s.wickets >= 3 && styles.highlight]}>
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
        <TouchableOpacity style={styles.shareBtn} onPress={handleShare} activeOpacity={0.85}>
          <Text style={styles.shareBtnText}>📤 Share Scorecard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace('/' as any)}
          activeOpacity={0.85}
        >
          <Text style={styles.homeBtnText}>🏠 Home</Text>
        </TouchableOpacity>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: {
    backgroundColor: C.surface,
    padding: 20, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  headerText:  { color: C.text,    fontSize: 22, fontWeight: '800' },
  matchText:   { color: C.textSub, fontSize: 14, marginTop: 4 },

  resultBox: {
    backgroundColor: '#0c1c12', margin: 16,
    padding: 16, borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  resultText: { color: C.accent, fontSize: 17, fontWeight: '700', textAlign: 'center' },

  inningsSection: {
    margin: 16, backgroundColor: C.card,
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: C.border,
  },
  inningsHeader: {
    borderBottomWidth: 1, borderBottomColor: C.border,
    paddingBottom: 10, marginBottom: 12,
  },
  inningsTitle:  { color: C.accentDim, fontSize: 13, fontWeight: '700' },
  inningsScore:  { color: C.text,    fontSize: 26, fontWeight: '800', marginTop: 4 },
  inningsOvers:  { color: C.textSub, fontSize: 14, fontWeight: '400' },

  tableTitle:  { color: C.textMuted, fontSize: 10, marginBottom: 6, letterSpacing: 1.5 },
  tableHeader: {
    flexDirection: 'row', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  thCell: {
    flex: 1, color: C.textMuted, fontSize: 11,
    fontWeight: '700', textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row', paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#0f1f16',
  },
  tdCell:    { flex: 1, color: C.text, fontSize: 13, textAlign: 'center' },
  highlight: { color: C.accent, fontWeight: '700' },

  shareBtn: {
    backgroundColor: '#1565c0', margin: 16,
    padding: 16, borderRadius: 14, alignItems: 'center',
  },
  shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  homeBtn: {
    backgroundColor: C.card, marginHorizontal: 16,
    padding: 16, borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: C.border,
  },
  homeBtnText: { color: C.textSub, fontSize: 15, fontWeight: '600' },
});
