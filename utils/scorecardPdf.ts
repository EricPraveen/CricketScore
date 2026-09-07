import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { Match, Innings, Player, BatsmanStats, BowlerStats } from '../db/queries';
import { FallOfWicket, Partnership } from './cricketStats';

export interface InningsPdfData {
  innings: Innings;
  battingTeam: string;
  bowlingTeam: string;
  totalRuns: number;
  wickets: number;
  overs: string;
  runRate: string;
  batsmen: Array<{
    player: Player;
    stats: BatsmanStats;
    dismissal: string;
    strikeRate: string;
  }>;
  bowlers: Array<{
    player: Player;
    stats: BowlerStats;
    oversStr: string;
    economy: string;
  }>;
  extras: {
    total: number;
    wides: number;
    noballs: number;
    byes: number;
    legbyes: number;
    penalty?: number;
  };
  fow?: FallOfWicket[];
  partnerships?: Partnership[];
}

export interface ScorecardPdfOptions {
  match: Match | null;
  result: string;
  ballsPerOver: number;
  inningsData: InningsPdfData[];
}

export function generateScorecardHtml(options: ScorecardPdfOptions): string {
  const { match, result, ballsPerOver, inningsData } = options;

  const dateStr = match?.created_at
    ? new Date(match.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });

  const timeStr = match?.created_at
    ? new Date(match.created_at).toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';

  const getOrdinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return s[(v - 20) % 10] || s[v] || s[0];
  };

  const inningsHtml = inningsData
    .map((inn, idx) => {
      const battingRows = inn.batsmen
        .map((b, bIdx) => {
          const isFifty = b.stats.runs >= 50 && b.stats.runs < 100;
          const isCentury = b.stats.runs >= 100;
          const highlightStyle = isCentury
            ? 'background: #FEF3C7; color: #92400E; font-weight: 800;'
            : isFifty
            ? 'background: #ECFDF5; color: #065F46; font-weight: 800;'
            : '';

          return `
            <tr style="background: ${bIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
              <td style="padding: 9px 12px; font-weight: 700; color: #0F172A; text-align: left;">
                ${b.player.name}
              </td>
              <td style="padding: 9px 12px; font-size: 11px; color: #64748B; text-align: left;">
                ${b.dismissal}
              </td>
              <td style="padding: 9px 12px; font-weight: 800; text-align: right; ${highlightStyle}">
                ${b.stats.runs}
              </td>
              <td style="padding: 9px 12px; color: #475569; text-align: right;">${b.stats.balls_faced}</td>
              <td style="padding: 9px 12px; color: #475569; text-align: right;">${b.stats.fours}</td>
              <td style="padding: 9px 12px; color: #475569; text-align: right;">${b.stats.sixes}</td>
              <td style="padding: 9px 12px; color: #475569; text-align: right; font-weight: 600;">${b.strikeRate}</td>
            </tr>
          `;
        })
        .join('');

      const bowlingRows = inn.bowlers
        .map((bl, blIdx) => {
          const isTopBowler = bl.stats.wickets >= 3;
          const wktStyle = isTopBowler
            ? 'background: #FEE2E2; color: #991B1B; font-weight: 800;'
            : 'font-weight: 700; color: #0F172A;';

          return `
            <tr style="background: ${blIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC'};">
              <td style="padding: 9px 12px; font-weight: 700; color: #0F172A; text-align: left;">
                ${bl.player.name}
              </td>
              <td style="padding: 9px 12px; color: #475569; text-align: right;">${bl.oversStr}</td>
              <td style="padding: 9px 12px; color: #475569; text-align: right;">${bl.stats.runs_given}</td>
              <td style="padding: 9px 12px; text-align: right; ${wktStyle}">
                ${bl.stats.wickets}
              </td>
              <td style="padding: 9px 12px; color: #475569; text-align: right;">${bl.economy}</td>
            </tr>
          `;
        })
        .join('');

      const parts = [
        `w ${inn.extras.wides}`,
        `nb ${inn.extras.noballs}`,
        `b ${inn.extras.byes}`,
        `lb ${inn.extras.legbyes}`,
      ];
      if ((inn.extras.penalty ?? 0) > 0) {
        parts.push(`p ${inn.extras.penalty}`);
      }
      const extrasBreakdown = parts.join(', ');

      return `
        <div class="innings-card">
          <!-- Innings Header -->
          <div class="innings-title-bar">
            <div>
              <span class="badge">Innings ${idx + 1}</span>
              <h2 style="display: inline-block; margin: 0 0 0 8px; font-size: 18px; font-weight: 800; color: #0F172A; vertical-align: middle;">
                ${inn.battingTeam}
              </h2>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 20px; font-weight: 900; color: #15803D;">
                ${inn.totalRuns}/${inn.wickets}
              </span>
              <span style="font-size: 14px; color: #64748B; font-weight: 600; margin-left: 6px;">
                (${inn.overs} ov)
              </span>
              <div style="font-size: 11px; color: #64748B; margin-top: 2px;">
                RR: <b>${inn.runRate}</b>
              </div>
            </div>
          </div>

          <!-- Batting Table -->
          <div style="margin-top: 14px;">
            <div class="section-label">BATTING</div>
            <table class="stats-table">
              <thead>
                <tr>
                  <th style="text-align: left; width: 32%;">Batter</th>
                  <th style="text-align: left; width: 26%;">Dismissal</th>
                  <th style="text-align: right; width: 8%;">R</th>
                  <th style="text-align: right; width: 8%;">B</th>
                  <th style="text-align: right; width: 8%;">4s</th>
                  <th style="text-align: right; width: 8%;">6s</th>
                  <th style="text-align: right; width: 10%;">SR</th>
                </tr>
              </thead>
              <tbody>
                ${battingRows}
              </tbody>
            </table>

            <!-- Extras & Total Bar -->
            <div class="extras-bar">
              <div>
                <span style="font-weight: 700; color: #334155;">Extras:</span>
                <span style="font-weight: 800; color: #0F172A; margin-left: 4px;">${inn.extras.total}</span>
                <span style="color: #64748B; font-size: 11px; margin-left: 6px;">(${extrasBreakdown})</span>
              </div>
              <div>
                <span style="font-weight: 700; color: #334155;">Total Score:</span>
                <span style="font-weight: 900; color: #15803D; font-size: 14px; margin-left: 6px;">
                  ${inn.totalRuns}/${inn.wickets}
                </span>
                <span style="color: #64748B; font-size: 12px; margin-left: 4px;">(${inn.overs} Overs)</span>
              </div>
            </div>
          </div>

          <!-- Bowling Table -->
          ${
            inn.bowlers.length > 0
              ? `
            <div style="margin-top: 18px;">
              <div class="section-label">BOWLING</div>
              <table class="stats-table">
                <thead>
                  <tr>
                    <th style="text-align: left; width: 44%;">Bowler</th>
                    <th style="text-align: right; width: 14%;">O</th>
                    <th style="text-align: right; width: 14%;">R</th>
                    <th style="text-align: right; width: 14%;">W</th>
                    <th style="text-align: right; width: 14%;">Eco</th>
                  </tr>
                </thead>
                <tbody>
                  ${bowlingRows}
                </tbody>
              </table>
            </div>
          `
              : ''
          }

          <!-- Fall of Wickets -->
          ${
            inn.fow && inn.fow.length > 0
              ? `
            <div style="margin-top: 16px;">
              <div class="section-label">FALL OF WICKETS</div>
              <div class="fow-box">
                ${inn.fow
                  .map(
                    (f) =>
                      `<span class="fow-item"><b>${f.wicketNum}-${f.score}</b> <span style="color: #64748B;">(${f.batsmanName}, ${f.overs} ov)</span></span>`
                  )
                  .join('<span style="color: #CBD5E1; margin: 0 6px;">•</span>')}
              </div>
            </div>
          `
              : ''
          }

          <!-- Partnerships -->
          ${
            inn.partnerships && inn.partnerships.length > 0
              ? `
            <div style="margin-top: 16px;">
              <div class="section-label">PARTNERSHIPS</div>
              <table class="stats-table">
                <thead>
                  <tr>
                    <th style="text-align: left; width: 22%;">Wicket</th>
                    <th style="text-align: right; width: 14%;">Runs (Balls)</th>
                    <th style="text-align: left; width: 32%;">Batter 1</th>
                    <th style="text-align: left; width: 32%;">Batter 2</th>
                  </tr>
                </thead>
                <tbody>
                  ${(() => {
                    const maxStandRuns = Math.max(...inn.partnerships!.map((p) => p.totalRuns), 1);
                    return inn.partnerships!
                      .map((p) => {
                        const isHighest = p.totalRuns === maxStandRuns && p.totalRuns > 0;
                        const wktLabel = p.isUnbroken
                          ? `${p.wicketNum}* (Unbroken)`
                          : `${p.wicketNum}${getOrdinal(p.wicketNum)} Wkt`;
                        const highestBadge = isHighest
                          ? '<span class="highest-badge">BEST</span>'
                          : '';
                        return `
                          <tr>
                            <td style="padding: 7px 12px; font-weight: 700; color: #334155;">
                              ${wktLabel} ${highestBadge}
                            </td>
                            <td style="padding: 7px 12px; text-align: right; font-weight: 800; color: #0F172A;">
                              ${p.totalRuns} <span style="font-weight: 400; color: #64748B; font-size: 11px;">(${p.totalBalls}b)</span>
                            </td>
                            <td style="padding: 7px 12px; color: #1E293B;">
                              ${p.batsman1.name} <b>${p.batsman1.runs}</b> <span style="color: #64748B; font-size: 11px;">(${p.batsman1.balls}b)</span>
                            </td>
                            <td style="padding: 7px 12px; color: #1E293B;">
                              ${p.batsman2.name} <b>${p.batsman2.runs}</b> <span style="color: #64748B; font-size: 11px;">(${p.batsman2.balls}b)</span>
                            </td>
                          </tr>
                        `;
                      })
                      .join('');
                  })()}
                </tbody>
              </table>
            </div>
          `
              : ''
          }
        </div>
      `;
    })
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <title>${match?.team1 || 'Team 1'} vs ${match?.team2 || 'Team 2'} - Scorecard</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 14mm 14mm 16mm 14mm;
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          background-color: #FFFFFF;
          color: #0F172A;
          margin: 0;
          padding: 0;
          font-size: 12px;
          line-height: 1.45;
        }
        .container {
          max-width: 820px;
          margin: 0 auto;
        }
        .header {
          background: linear-gradient(135deg, #14532D 0%, #166534 50%, #15803D 100%);
          color: #FFFFFF;
          padding: 20px 24px;
          border-radius: 12px;
          margin-bottom: 16px;
        }
        .match-title {
          font-size: 24px;
          font-weight: 900;
          letter-spacing: -0.5px;
          margin: 0 0 6px 0;
          color: #FFFFFF;
        }
        .match-sub {
          font-size: 13px;
          color: #BBF7D0;
          font-weight: 500;
          margin: 0;
        }
        .result-banner {
          background: #FEF3C7;
          border: 1.5px solid #F59E0B;
          color: #92400E;
          border-radius: 10px;
          padding: 12px 18px;
          font-size: 15px;
          font-weight: 800;
          margin-bottom: 18px;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .innings-card {
          border: 1px solid #E2E8F0;
          border-radius: 12px;
          background: #FFFFFF;
          margin-bottom: 20px;
          padding: 16px 18px;
          page-break-inside: avoid;
          box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        }
        .innings-title-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-bottom: 12px;
          border-bottom: 2px solid #F1F5F9;
        }
        .badge {
          display: inline-block;
          background: #DCFCE7;
          color: #15803D;
          font-size: 10px;
          font-weight: 800;
          padding: 3px 8px;
          border-radius: 6px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .section-label {
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.8px;
          color: #64748B;
          margin-bottom: 6px;
          text-transform: uppercase;
        }
        .stats-table {
          width: 100%;
          border-collapse: collapse;
          border-radius: 8px;
          overflow: hidden;
          font-size: 12px;
          border: 1px solid #E2E8F0;
        }
        .stats-table thead tr {
          background: #0F172A;
          color: #F8FAFC;
        }
        .stats-table th {
          padding: 8px 12px;
          font-weight: 700;
          font-size: 11px;
          letter-spacing: 0.5px;
          text-transform: uppercase;
        }
        .stats-table td {
          border-top: 1px solid #F1F5F9;
        }
        .extras-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-top: none;
          padding: 8px 12px;
          border-radius: 0 0 8px 8px;
          font-size: 12px;
        }
        .fow-box {
          background-color: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 8px;
          padding: 10px 14px;
          font-size: 11.5px;
          line-height: 1.8;
          color: #1E293B;
        }
        .fow-item {
          display: inline-block;
          white-space: nowrap;
        }
        .highest-badge {
          display: inline-block;
          background-color: #FEF3C7;
          color: #92400E;
          font-size: 9px;
          font-weight: 800;
          padding: 1px 5px;
          border-radius: 4px;
          margin-left: 4px;
          vertical-align: middle;
          letter-spacing: 0.5px;
        }
        .footer {
          margin-top: 24px;
          padding-top: 12px;
          border-top: 1px solid #E2E8F0;
          text-align: center;
          font-size: 11px;
          color: #94A3B8;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <!-- Main Match Header -->
        <div class="header">
          <h1 class="match-title">🏏 ${match?.team1 || 'Team 1'} vs ${match?.team2 || 'Team 2'}</h1>
          <p class="match-sub">
            📅 ${dateStr} ${timeStr ? `• ${timeStr}` : ''}
            ${match?.overs ? ` • ${match.overs} Overs Match` : ''}
            ${ballsPerOver !== 6 ? ` • (${ballsPerOver} balls/over)` : ''}
          </p>
        </div>

        <!-- Result Banner -->
        ${
          result
            ? `
          <div class="result-banner">
            🏆 ${result}
          </div>
        `
            : ''
        }

        <!-- All Innings -->
        ${inningsHtml}

        <!-- Footer -->
        <div class="footer">
          Generated with Cricket Score App • Scored live ball-by-ball
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Generate PDF file and trigger native Share Sheet
 */
export async function shareScorecardAsPdf(options: ScorecardPdfOptions): Promise<void> {
  const html = generateScorecardHtml(options);

  // Generate the PDF file with base64 data
  const { uri, base64 } = await Print.printToFileAsync({
    html,
    base64: true,
  });

  let shareUri = uri;

  // On Android/iOS, printToFileAsync writes to a temporary print cache directory
  // that ExpoSharing cannot read directly due to scoped storage / file permissions.
  // Writing the base64 content to the app's scoped directory resolves this.
  const targetDir = FileSystem.cacheDirectory || FileSystem.documentDirectory;
  if (base64 && targetDir) {
    const rawTitle = `${options.match?.team1 || 'Team1'}_vs_${options.match?.team2 || 'Team2'}_Scorecard`;
    const sanitizedTitle = rawTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
    const targetUri = `${targetDir}${sanitizedTitle}.pdf`;

    await FileSystem.writeAsStringAsync(targetUri, base64, {
      encoding: FileSystem.EncodingType.Base64,
    });
    shareUri = targetUri;
  }

  // Check sharing availability
  const isAvailable = await Sharing.isAvailableAsync();
  if (isAvailable) {
    await Sharing.shareAsync(shareUri, {
      mimeType: 'application/pdf',
      dialogTitle: `${options.match?.team1 || 'Team1'} vs ${options.match?.team2 || 'Team2'} Scorecard`,
      UTI: '.pdf',
    });
  } else {
    // Fallback on environments without native file sharing (e.g. web browser)
    await Print.printAsync({ html });
  }
}
