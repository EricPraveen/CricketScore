import { useLocalSearchParams, useRouter } from 'expo-router';
import {
    SafeAreaView,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import {
    getBatsmanStats, getBowlerStats,
    getInningsByMatch,
    getMatchById,
    getOversDisplay,
    getPlayersByTeam,
    getTotalRuns, getWickets
} from '../db/queries';

export default function ScorecardScreen() {
  const router = useRouter();
  const { matchId } = useLocalSearchParams();

  const match   = getMatchById(Number(matchId));
  const innings = getInningsByMatch(Number(matchId));

  const getResult = () => {
    if (innings.length < 1) return '';
    if (innings.length === 1) {
      return `${innings[0].batting_team} scored ${getTotalRuns(innings[0].id)}/${getWickets(innings[0].id)}`;
    }
    const runs1  = getTotalRuns(innings[0].id);
    const runs2  = getTotalRuns(innings[1].id);
    const wkts2  = getWickets(innings[1].id);
    const pl2    = getPlayersByTeam(Number(matchId), innings[1].batting_team);
    if (runs2 > runs1) {
      return `${innings[1].batting_team} won by ${pl2.length - 1 - wkts2} wickets`;
    } else if (runs1 > runs2) {
      return `${innings[0].batting_team} won by ${runs1 - runs2} runs`;
    }
    return "It's a Tie!";
  };

  const handleShare = async () => {
    let text = `${match?.team1} vs ${match?.team2}\n\n`;
    innings.forEach((inn: any, i: number) => {
      const bp = getPlayersByTeam(Number(matchId), inn.batting_team);
      const blp = getPlayersByTeam(Number(matchId), inn.bowling_team);
      text += `--- Innings ${i + 1}: ${inn.batting_team} ---\n`;
      text += `Score: ${getTotalRuns(inn.id)}/${getWickets(inn.id)} (${getOversDisplay(inn.id)} ov)\n\nBATTING:\n`;
      bp.forEach((p: any) => {
        const s = getBatsmanStats(inn.id, p.id);
        if (s.balls_faced > 0) text += `${p.name}: ${s.runs}(${s.balls_faced})\n`;
      });
      text += `\nBOWLING:\n`;
      blp.forEach((p: any) => {
        const s = getBowlerStats(inn.id, p.id);
        if (s.balls_bowled > 0) text += `${p.name}: ${s.wickets}/${s.runs_given}\n`;
      });
      text += '\n';
    });
    text += `Result: ${getResult()}`;
    await Share.share({ message: text });
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.headerText}>Scorecard</Text>
          <Text style={styles.matchText}>{match?.team1} vs {match?.team2}</Text>
        </View>

        <View style={styles.resultBox}>
          <Text style={styles.resultText}>{getResult()}</Text>
        </View>

        {innings.map((inn: any, i: number) => {
          const bp  = getPlayersByTeam(Number(matchId), inn.batting_team);
          const blp = getPlayersByTeam(Number(matchId), inn.bowling_team);
          return (
            <View key={inn.id} style={styles.inningsSection}>
              <View style={styles.inningsHeader}>
                <Text style={styles.inningsTitle}>Innings {i + 1} — {inn.batting_team}</Text>
                <Text style={styles.inningsScore}>
                  {getTotalRuns(inn.id)}/{getWickets(inn.id)}
                  {'  '}<Text style={styles.inningsOvers}>({getOversDisplay(inn.id)} ov)</Text>
                </Text>
              </View>

              <Text style={styles.tableTitle}>BATTING</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.thCell, { flex: 2, textAlign: 'left' }]}>Batsman</Text>
                <Text style={styles.thCell}>R</Text>
                <Text style={styles.thCell}>B</Text>
                <Text style={styles.thCell}>4s</Text>
                <Text style={styles.thCell}>6s</Text>
                <Text style={styles.thCell}>SR</Text>
              </View>
              {bp.map((p: any) => {
                const s  = getBatsmanStats(inn.id, p.id);
                const sr = s.balls_faced > 0
                  ? ((s.runs / s.balls_faced) * 100).toFixed(0) : '-';
                return (
                  <View key={p.id} style={styles.tableRow}>
                    <Text style={[styles.tdCell, { flex: 2, textAlign: 'left' }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={[styles.tdCell, s.runs >= 50 && styles.highlight]}>{s.runs}</Text>
                    <Text style={styles.tdCell}>{s.balls_faced}</Text>
                    <Text style={styles.tdCell}>{s.fours}</Text>
                    <Text style={styles.tdCell}>{s.sixes}</Text>
                    <Text style={styles.tdCell}>{sr}</Text>
                  </View>
                );
              })}

              <Text style={[styles.tableTitle, { marginTop: 16 }]}>BOWLING</Text>
              <View style={styles.tableHeader}>
                <Text style={[styles.thCell, { flex: 2, textAlign: 'left' }]}>Bowler</Text>
                <Text style={styles.thCell}>O</Text>
                <Text style={styles.thCell}>R</Text>
                <Text style={styles.thCell}>W</Text>
                <Text style={styles.thCell}>Eco</Text>
              </View>
              {blp.map((p: any) => {
                const s   = getBowlerStats(inn.id, p.id);
                if (s.balls_bowled === 0) return null;
                const ovs = `${Math.floor(s.balls_bowled / 6)}.${s.balls_bowled % 6}`;
                const eco = s.balls_bowled > 0
                  ? ((s.runs_given / s.balls_bowled) * 6).toFixed(1) : '-';
                return (
                  <View key={p.id} style={styles.tableRow}>
                    <Text style={[styles.tdCell, { flex: 2, textAlign: 'left' }]} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.tdCell}>{ovs}</Text>
                    <Text style={styles.tdCell}>{s.runs_given}</Text>
                    <Text style={[styles.tdCell, s.wickets >= 3 && styles.highlight]}>{s.wickets}</Text>
                    <Text style={styles.tdCell}>{eco}</Text>
                  </View>
                );
              })}
            </View>
          );
        })}

        <TouchableOpacity style={styles.shareBtn} onPress={handleShare}>
          <Text style={styles.shareBtnText}>Share Scorecard</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.homeBtn}
          onPress={() => router.replace('/' as any)}
        >
          <Text style={styles.homeBtnText}>Home</Text>
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
    padding: 20, alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: '#1e3d28',
  },
  headerText:   { color: '#fff', fontSize: 22, fontWeight: '800' },
  matchText:    { color: '#8fa99a', fontSize: 14, marginTop: 4 },
  resultBox: {
    backgroundColor: '#0c1c12', margin: 16,
    padding: 16, borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#1e3d28',
  },
  resultText: { color: '#00e676', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  inningsSection: {
    margin: 16, backgroundColor: '#182a1f',
    borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: '#1e3d28',
  },
  inningsHeader: {
    borderBottomWidth: 1, borderBottomColor: '#1e3d28',
    paddingBottom: 10, marginBottom: 12,
  },
  inningsTitle:  { color: '#00b359', fontSize: 13, fontWeight: '700' },
  inningsScore:  { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 4 },
  inningsOvers:  { color: '#8fa99a', fontSize: 14, fontWeight: '400' },
  tableTitle: { color: '#4a6655', fontSize: 10, marginBottom: 6, letterSpacing: 1.5 },
  tableHeader: {
    flexDirection: 'row', paddingVertical: 6,
    borderBottomWidth: 1, borderBottomColor: '#1e3d28',
  },
  thCell: {
    flex: 1, color: '#4a6655', fontSize: 11,
    fontWeight: '700', textAlign: 'center',
  },
  tableRow: {
    flexDirection: 'row', paddingVertical: 9,
    borderBottomWidth: 1, borderBottomColor: '#0f1f16',
  },
  tdCell:    { flex: 1, color: '#fff', fontSize: 13, textAlign: 'center' },
  highlight: { color: '#00e676', fontWeight: '700' },
  shareBtn: {
    backgroundColor: '#1565c0', margin: 16,
    padding: 16, borderRadius: 14, alignItems: 'center',
  },
  shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  homeBtn: {
    backgroundColor: '#182a1f', marginHorizontal: 16,
    padding: 16, borderRadius: 14, alignItems: 'center',
    borderWidth: 1, borderColor: '#1e3d28',
  },
  homeBtnText: { color: '#8fa99a', fontSize: 15, fontWeight: '600' },
});
