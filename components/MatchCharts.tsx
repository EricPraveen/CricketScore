import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Svg, { Circle, G, Line, Polyline, Text as SvgText } from 'react-native-svg';
import { CricketColors as C } from '../constants/theme';
import { FallOfWicket, OverSummary } from '../utils/cricketStats';

export interface InningsChartData {
  inningsNo: number;
  teamName: string;
  oversCount: number;
  summaries: OverSummary[];
  totalRuns: number;
  wickets: number;
  fow: FallOfWicket[];
}

export interface MatchChartsProps {
  inningsData: InningsChartData[];
  totalMatchOvers: number;
}

export const MatchCharts: React.FC<MatchChartsProps> = ({
  inningsData,
  totalMatchOvers,
}) => {
  const [chartType, setChartType] = useState<'manhattan' | 'worm'>('manhattan');
  const [selectedInnIndex, setSelectedInnIndex] = useState<number>(0);

  if (!inningsData || inningsData.length === 0) {
    return null;
  }

  // Ensure selected index is valid
  const currentInn = inningsData[selectedInnIndex] || inningsData[0];
  const maxOverRuns =
    currentInn.summaries.length > 0
      ? Math.max(...currentInn.summaries.map((s) => s.runs), 6)
      : 12;

  // Chart dimensions for Worm graph
  const wormWidth = 320;
  const wormHeight = 180;
  const paddingLeft = 36;
  const paddingRight = 16;
  const paddingTop = 16;
  const paddingBottom = 28;
  const graphWidth = wormWidth - paddingLeft - paddingRight;
  const graphHeight = wormHeight - paddingTop - paddingBottom;

  // Max scale for Worm graph
  const allFinalRuns = inningsData.map((d) => d.totalRuns);
  const maxFinalScore = Math.max(...allFinalRuns, 10);
  const yMax = Math.ceil(maxFinalScore / 20) * 20 || 20;

  const maxTotalOvers = Math.max(
    totalMatchOvers || 10,
    ...inningsData.map((d) => d.summaries.length),
    5
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>MATCH ANALYSIS & CHARTS</Text>

        {/* Chart Type Toggle */}
        <View style={styles.toggleGroup}>
          <TouchableOpacity
            style={[
              styles.toggleBtn,
              chartType === 'manhattan' && styles.toggleBtnActive,
            ]}
            onPress={() => setChartType('manhattan')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.toggleBtnText,
                chartType === 'manhattan' && styles.toggleBtnTextActive,
              ]}
            >
              📊 Manhattan
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.toggleBtn,
              chartType === 'worm' && styles.toggleBtnActive,
            ]}
            onPress={() => setChartType('worm')}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.toggleBtnText,
                chartType === 'worm' && styles.toggleBtnTextActive,
              ]}
            >
              📈 Worm
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── MANHATTAN CHART (BARS) ─────────────────────────────────── */}
      {chartType === 'manhattan' && (
        <View style={styles.chartCard}>
          {/* Innings Selector if 2 innings exist */}
          {inningsData.length > 1 && (
            <View style={styles.innSelectorRow}>
              {inningsData.map((inn, idx) => {
                const isSelected = idx === selectedInnIndex;
                return (
                  <TouchableOpacity
                    key={inn.inningsNo}
                    style={[
                      styles.innTab,
                      isSelected && styles.innTabActive,
                    ]}
                    onPress={() => setSelectedInnIndex(idx)}
                    activeOpacity={0.8}
                  >
                    <Text
                      style={[
                        styles.innTabText,
                        isSelected && styles.innTabTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      Inn {inn.inningsNo}: {inn.teamName} ({inn.totalRuns}/{inn.wickets})
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {currentInn.summaries.length === 0 ? (
            <View style={styles.emptyChart}>
              <Text style={styles.emptyText}>No deliveries recorded in this innings yet</Text>
            </View>
          ) : (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.barScrollContent}
              >
                {currentInn.summaries.map((s) => {
                  const barHeight = Math.max((s.runs / maxOverRuns) * 110, 4);
                  const isWicket = s.wickets > 0;
                  const isTeam1 = currentInn.inningsNo === 1;
                  const barColor = isTeam1 ? C.green : '#D97706';

                  return (
                    <View key={s.overNo} style={styles.barCol}>
                      {/* Wicket Tag */}
                      <View style={styles.wktContainer}>
                        {isWicket ? (
                          <View style={styles.wktBadge}>
                            <Text style={styles.wktBadgeText}>
                              {s.wickets > 1 ? `${s.wickets}W` : 'W'}
                            </Text>
                          </View>
                        ) : null}
                      </View>

                      {/* Runs text */}
                      <Text style={styles.barRunsText}>{s.runs}</Text>

                      {/* The Bar */}
                      <View style={styles.barTrack}>
                        <View
                          style={[
                            styles.barFill,
                            {
                              height: barHeight,
                              backgroundColor: barColor,
                            },
                          ]}
                        />
                      </View>

                      {/* Over label */}
                      <Text style={styles.barOverText}>{s.overNo}</Text>
                    </View>
                  );
                })}
              </ScrollView>

              {/* Manhattan Legend & Summary */}
              <View style={styles.manhattanSummaryRow}>
                <View style={styles.legendPill}>
                  <View
                    style={[
                      styles.legendDot,
                      { backgroundColor: currentInn.inningsNo === 1 ? C.green : '#D97706' },
                    ]}
                  />
                  <Text style={styles.legendLabel}>
                    {currentInn.teamName} Over-by-Over
                  </Text>
                </View>
                <View style={styles.legendPill}>
                  <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
                  <Text style={styles.legendLabel}>Wicket Over</Text>
                </View>
              </View>
            </>
          )}
        </View>
      )}

      {/* ─── WORM GRAPH (LINE) ──────────────────────────────────────── */}
      {chartType === 'worm' && (
        <View style={styles.chartCard}>
          <View style={styles.wormSvgContainer}>
            <Svg width={wormWidth} height={wormHeight}>
              {/* Background Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((pct, i) => {
                const y = paddingTop + graphHeight * (1 - pct);
                const scoreValue = Math.round(yMax * pct);
                return (
                  <G key={i}>
                    <Line
                      x1={paddingLeft}
                      y1={y}
                      x2={wormWidth - paddingRight}
                      y2={y}
                      stroke="#E2E8F0"
                      strokeDasharray="3 3"
                      strokeWidth={1}
                    />
                    <SvgText
                      x={paddingLeft - 6}
                      y={y + 4}
                      fontSize={10}
                      fill="#94A3B8"
                      textAnchor="end"
                      fontWeight="500"
                    >
                      {scoreValue}
                    </SvgText>
                  </G>
                );
              })}

              {/* X-axis Over Ticks */}
              {Array.from({ length: Math.min(maxTotalOvers, 10) + 1 }).map((_, i) => {
                const step = maxTotalOvers <= 10 ? 1 : Math.ceil(maxTotalOvers / 6);
                const overNum = i * step;
                if (overNum > maxTotalOvers) return null;
                const x = paddingLeft + (overNum / maxTotalOvers) * graphWidth;

                return (
                  <G key={i}>
                    <Line
                      x1={x}
                      y1={paddingTop + graphHeight}
                      x2={x}
                      y2={paddingTop + graphHeight + 4}
                      stroke="#CBD5E1"
                      strokeWidth={1}
                    />
                    <SvgText
                      x={x}
                      y={paddingTop + graphHeight + 16}
                      fontSize={10}
                      fill="#64748B"
                      textAnchor="middle"
                      fontWeight="500"
                    >
                      {overNum}
                    </SvgText>
                  </G>
                );
              })}

              {/* X-axis Label */}
              <SvgText
                x={wormWidth - paddingRight}
                y={paddingTop + graphHeight + 24}
                fontSize={9}
                fill="#94A3B8"
                textAnchor="end"
                fontWeight="600"
              >
                OVERS
              </SvgText>

              {/* Innings Lines & Wickets */}
              {inningsData.map((inn) => {
                if (inn.summaries.length === 0) return null;

                const isTeam1 = inn.inningsNo === 1;
                const lineColor = isTeam1 ? '#15803D' : '#D97706';

                // Points array starting at (0, 0)
                const pts: string[] = [`${paddingLeft},${paddingTop + graphHeight}`];
                inn.summaries.forEach((s) => {
                  const x = paddingLeft + (s.overNo / maxTotalOvers) * graphWidth;
                  const clampedRuns = Math.min(s.cumulativeRuns, yMax);
                  const y = paddingTop + graphHeight - (clampedRuns / yMax) * graphHeight;
                  pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
                });

                return (
                  <G key={inn.inningsNo}>
                    {/* Polyline */}
                    <Polyline
                      points={pts.join(' ')}
                      fill="none"
                      stroke={lineColor}
                      strokeWidth={3}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />

                    {/* Wicket points along the line */}
                    {inn.summaries
                      .filter((s) => s.wickets > 0)
                      .map((s) => {
                        const x = paddingLeft + (s.overNo / maxTotalOvers) * graphWidth;
                        const clampedRuns = Math.min(s.cumulativeRuns, yMax);
                        const y = paddingTop + graphHeight - (clampedRuns / yMax) * graphHeight;

                        return (
                          <Circle
                            key={s.overNo}
                            cx={x}
                            cy={y}
                            r={4.5}
                            fill="#EF4444"
                            stroke="#FFFFFF"
                            strokeWidth={1.5}
                          />
                        );
                      })}
                  </G>
                );
              })}
            </Svg>
          </View>

          {/* Worm Graph Legends */}
          <View style={styles.wormLegendContainer}>
            {inningsData.map((inn) => {
              const isTeam1 = inn.inningsNo === 1;
              const color = isTeam1 ? '#15803D' : '#D97706';
              return (
                <View key={inn.inningsNo} style={styles.wormLegendItem}>
                  <View style={[styles.wormLegendLine, { backgroundColor: color }]} />
                  <Text style={styles.wormLegendText} numberOfLines={1}>
                    {inn.teamName}: <Text style={{ fontWeight: '800' }}>{inn.totalRuns}/{inn.wickets}</Text>
                  </Text>
                </View>
              );
            })}
            <View style={styles.wormLegendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#EF4444' }]} />
              <Text style={styles.wormLegendText}>Wicket</Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerTitle: {
    color: C.greenDark,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  toggleGroup: {
    flexDirection: 'row',
    backgroundColor: '#E2E8F0',
    borderRadius: 8,
    padding: 2,
  },
  toggleBtn: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
  },
  toggleBtnActive: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  toggleBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748B',
  },
  toggleBtnTextActive: {
    color: '#0F172A',
    fontWeight: '800',
  },
  chartCard: {
    backgroundColor: C.surface,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  innSelectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  innTab: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#F8FAF8',
    alignItems: 'center',
  },
  innTabActive: {
    borderColor: C.green,
    backgroundColor: C.greenLight,
  },
  innTabText: {
    fontSize: 11,
    fontWeight: '600',
    color: C.textSub,
  },
  innTabTextActive: {
    color: C.greenDark,
    fontWeight: '800',
  },
  barScrollContent: {
    paddingHorizontal: 4,
    alignItems: 'flex-end',
    height: 155,
  },
  barCol: {
    width: 32,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
  },
  wktContainer: {
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  wktBadge: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  wktBadgeText: {
    color: '#DC2626',
    fontSize: 9,
    fontWeight: '900',
  },
  barRunsText: {
    color: C.text,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 4,
  },
  barTrack: {
    width: 14,
    height: 110,
    backgroundColor: '#F1F5F9',
    borderRadius: 7,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 7,
  },
  barOverText: {
    color: C.textSub,
    fontSize: 10,
    fontWeight: '600',
    marginTop: 6,
  },
  manhattanSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  legendPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 11,
    color: C.textSub,
    fontWeight: '600',
  },
  wormSvgContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  wormLegendContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 14,
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  wormLegendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  wormLegendLine: {
    width: 16,
    height: 3,
    borderRadius: 2,
  },
  wormLegendText: {
    fontSize: 11,
    color: C.text,
    fontWeight: '600',
  },
  emptyChart: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    color: C.textMuted,
    fontSize: 12,
  },
});
