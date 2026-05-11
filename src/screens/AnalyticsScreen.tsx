import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
} from 'date-fns';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Line,
  Path,
  Polyline,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useApp } from '../AppContext';
import { useSubscription } from '../hooks/useSubscription';
import {
  computeCycleHistory,
  computeCycleStats,
  countSymptoms,
  isBleeding,
} from '../cycle';
import { tArray } from '../i18n';
import { SERIF_STACK, WaveBackground } from '../components/WaveBackground';
import { PremiumGate } from '../components/PremiumGate';
import { ThemeColors } from '../theme';
import { exportToPdf } from '../utils/exportPdf';
import type { RootStackParamList } from '../navigation';
import { DayLog } from '../types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const AnalyticsScreen: React.FC = () => {
  const { data, predictions, colors, t, language } = useApp();
  const { isPremium } = useSubscription();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const nav = useNavigation<Nav>();
  void language;

  const stats = useMemo(
    () => computeCycleStats(data.logs, data.settings),
    [data.logs, data.settings],
  );
  const history = useMemo(
    () => computeCycleHistory(data.logs),
    [data.logs],
  );
  const symptomCounts = useMemo(() => countSymptoms(data.logs), [data.logs]);

  const months = tArray('monthsGenitive');
  const fmtDate = (iso: string | null): string => {
    if (!iso) return '—';
    const d = parseISO(iso);
    return `${d.getDate()} ${months[d.getMonth()] ?? ''}`;
  };

  if (!isPremium) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <WaveBackground colors={colors} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.h1}>{t('analytics.title')}</Text>
          <PremiumGate
            feature="Полная статистика и аналитика"
            body="Графики длины цикла и месячных, средние, тренды, топ симптомов и настроений, график БТТ, фазовая тепловая карта и персональные инсайты. Открывается с любой из трёх подписок."
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Take the most recent 4 cycle entries plus the (still-running) current
  // cycle so the history card mirrors Clover-style "row of dots per cycle"
  // overview without overwhelming the screen.
  const recentCycles = history.slice(-4).reverse();
  const today = new Date();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <WaveBackground colors={colors} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>{t('analytics.title')}</Text>
            <Text style={styles.h1Sub}>{t('analytics.sectionTrends')}</Text>
          </View>
        </View>

        <CycleHistoryCard
          cycles={recentCycles}
          settings={data.settings}
          predictions={predictions}
          logs={data.logs}
          today={today}
          colors={colors}
          t={t}
          months={months}
          onViewAll={() => nav.navigate('History')}
        />

        <Text style={styles.section}>
          {t('analytics.cycleLengthChartTitle')}
        </Text>
        {stats.cycleLengths.length >= 2 ? (
          <View style={styles.chartCard}>
            <CycleLengthChart
              values={stats.cycleLengths.slice(-6)}
              average={stats.averageCycleLength}
              starts={stats.periodStarts.slice(-stats.cycleLengths.length - 1)}
              colors={colors}
              hint={t('analytics.chartHint')}
            />
          </View>
        ) : (
          <View style={styles.chartCard}>
            <Text style={styles.muted}>
              {t('analytics.cycleLengthChartHint')}
            </Text>
          </View>
        )}

        <Text style={styles.section}>{t('analytics.sectionForecast')}</Text>
        <View style={styles.row}>
          <ForecastCard
            label={t('analytics.nextPeriod')}
            value={fmtDate(predictions.nextPeriodStart)}
            colors={colors}
            tint={colors.period}
          />
          <ForecastCard
            label={t('analytics.nextOvulation')}
            value={fmtDate(predictions.ovulation)}
            colors={colors}
            tint={colors.ovulationPeak}
          />
        </View>
        <View style={styles.row}>
          <ForecastCard
            label={t('analytics.avgCycle')}
            value={
              stats.averageCycleLength !== null
                ? `${stats.averageCycleLength} ${t('analytics.daysShort')}`
                : '—'
            }
            colors={colors}
          />
          <ForecastCard
            label={t('analytics.avgPeriod')}
            value={
              stats.averagePeriodLength !== null
                ? `${stats.averagePeriodLength} ${t('analytics.daysShort')}`
                : '—'
            }
            colors={colors}
          />
        </View>

        <Text style={styles.section}>{t('analytics.sectionInsights')}</Text>
        {symptomCounts.length > 0 ? (
          <View style={styles.chartCard}>
            <SymptomsBreakdown
              data={symptomCounts}
              labelFor={(k) => t(`symptoms.${k}`)}
              colors={colors}
            />
          </View>
        ) : (
          <View style={styles.chartCard}>
            <Text style={styles.muted}>{t('analytics.symptomsHint')}</Text>
          </View>
        )}

        <Pressable
          style={styles.exportBtn}
          onPress={() => {
            void exportToPdf(data, 'analytics');
          }}
        >
          <Text style={styles.exportBtnText}>{t('analytics.exportPdf')}</Text>
        </Pressable>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

interface CycleHistoryEntry {
  start: string;
  end: string | null;
  cycleLength: number | null;
  periodLength: number;
  logs: DayLog[];
}

const CycleHistoryCard: React.FC<{
  cycles: CycleHistoryEntry[];
  settings: { lutealPhaseLength: number; averageCycleLength: number };
  predictions: { effectiveCycleLength: number; effectivePeriodLength: number };
  logs: Record<string, DayLog>;
  today: Date;
  colors: ThemeColors;
  t: (k: string, vars?: Record<string, string | number>) => string;
  months: string[];
  onViewAll: () => void;
}> = ({
  cycles,
  settings,
  predictions,
  logs,
  today,
  colors,
  t,
  months,
  onViewAll,
}) => {
  const styles = makeStyles(colors);

  return (
    <View style={styles.cardLg}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{t('analytics.cycleHistoryTitle')}</Text>
        <Pressable onPress={onViewAll} hitSlop={8}>
          <Text style={styles.linkText}>{t('analytics.viewAll')} ›</Text>
        </Pressable>
      </View>

      <View style={styles.legendRow}>
        <LegendDot color={colors.period} label={t('analytics.legendPeriod')} colors={colors} />
        <LegendDot color={colors.ovulation} label={t('analytics.legendFertile')} colors={colors} />
        <LegendDot color={colors.ovulationPeak} label={t('analytics.legendOvulation')} colors={colors} />
      </View>

      {cycles.length === 0 ? (
        <Text style={styles.muted}>{t('analytics.cycleHistoryHint')}</Text>
      ) : (
        cycles.map((c, idx) => (
          <CycleRow
            key={c.start}
            cycle={c}
            isCurrent={c.cycleLength === null}
            settings={settings}
            predictions={predictions}
            logs={logs}
            today={today}
            colors={colors}
            t={t}
            months={months}
            isFirst={idx === 0}
          />
        ))
      )}
    </View>
  );
};

const LegendDot: React.FC<{ color: string; label: string; colors: ThemeColors }> = ({
  color,
  label,
  colors,
}) => (
  <View style={legendStyles.legendItem}>
    <View style={[legendStyles.dot, { backgroundColor: color }]} />
    <Text
      numberOfLines={1}
      style={[legendStyles.legendLabel, { color: colors.textMuted }]}
    >
      {label}
    </Text>
  </View>
);

const CycleRow: React.FC<{
  cycle: CycleHistoryEntry;
  isCurrent: boolean;
  settings: { lutealPhaseLength: number; averageCycleLength: number };
  predictions: { effectiveCycleLength: number; effectivePeriodLength: number };
  logs: Record<string, DayLog>;
  today: Date;
  colors: ThemeColors;
  t: (k: string, vars?: Record<string, string | number>) => string;
  months: string[];
  isFirst: boolean;
}> = ({
  cycle,
  isCurrent,
  settings,
  predictions,
  logs,
  today,
  colors,
  t,
  months,
  isFirst,
}) => {
  const styles = makeStyles(colors);
  const start = parseISO(cycle.start);
  // For finished cycles use the actual length; for the still-running one use
  // the user's effective average so the row visualises the predicted shape.
  const length = isCurrent
    ? predictions.effectiveCycleLength
    : cycle.cycleLength ?? settings.averageCycleLength;
  const luteal = settings.lutealPhaseLength;
  const ovulationDay = Math.max(1, length - luteal); // 1-based day in cycle
  const fertileStart = ovulationDay - 5;
  const fertileEnd = ovulationDay + 1;
  const periodLen = isCurrent
    ? Math.max(cycle.periodLength, predictions.effectivePeriodLength)
    : cycle.periodLength;

  const startLabel = `${start.getDate()} ${months[start.getMonth()] ?? ''}`;
  const titleText = isCurrent
    ? `${length} ${t('analytics.daysShort')} (${t('analytics.currentCycle')})`
    : `${length} ${t('analytics.daysShort')}`;

  const todayInCycle = differenceInCalendarDays(today, start) + 1;

  // Render up to `length` dots; cap at 35 to keep the row from overflowing.
  const dots: React.ReactNode[] = [];
  const dotCount = Math.min(length, 35);
  for (let day = 1; day <= dotCount; day++) {
    const dayDate = addDays(start, day - 1);
    const iso = format(dayDate, 'yyyy-MM-dd');
    const log = logs[iso];

    let bg = colors.surface;
    let opacity = 0.45;

    if (day === ovulationDay) {
      bg = colors.ovulationPeak;
      opacity = 1;
    } else if (day >= fertileStart && day <= fertileEnd) {
      bg = colors.ovulation;
      opacity = 1;
    } else if (day <= periodLen) {
      bg = colors.period;
      opacity = 1;
    }

    // If the user actually logged bleeding on this day, force the period
    // colour even if it falls outside the predicted range (e.g. a longer
    // period than usual).
    if (log && isBleeding(log)) {
      bg = colors.period;
      opacity = 1;
    }

    const isToday = isCurrent && day === todayInCycle;

    dots.push(
      <View
        key={day}
        style={[
          styles.phaseDot,
          { backgroundColor: bg, opacity },
          isToday && {
            opacity: 1,
            borderWidth: 2,
            borderColor: colors.today,
          },
        ]}
      />,
    );
  }

  return (
    <View style={[styles.cycleRow, !isFirst && styles.cycleRowDivider]}>
      <View style={styles.cycleRowHeader}>
        <Text style={styles.cycleRowTitle}>{titleText}</Text>
        <Text style={styles.cycleRowSubtitle}>
          {t('analytics.startedOn', { date: startLabel })}
        </Text>
      </View>
      <View style={styles.cycleDots}>{dots}</View>
    </View>
  );
};

const ForecastCard: React.FC<{
  label: string;
  value: string;
  colors: ThemeColors;
  tint?: string;
}> = ({ label, value, colors, tint }) => {
  const styles = makeStyles(colors);
  return (
    <View style={[styles.card, tint ? { borderColor: tint } : null]}>
      {tint && <View style={[styles.cardAccent, { backgroundColor: tint }]} />}
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={[styles.cardValue, tint ? { color: tint } : null]}>
        {value}
      </Text>
    </View>
  );
};

const CycleLengthChart: React.FC<{
  values: number[];
  average: number | null;
  starts: string[];
  colors: ThemeColors;
  hint: string;
}> = ({ values, average, starts, colors, hint }) => {
  const W = 320;
  const H = 200;
  const PAD_L = 32;
  const PAD_R = 16;
  const PAD_T = 28;
  const PAD_B = 40;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  // Use a stable 18-40 day y-axis so the band/baseline don't jump as data
  // arrives — most cycles fall in 24-34, abnormal stays visibly outside.
  const yMin = Math.min(18, Math.min(...values) - 2);
  const yMax = Math.max(40, Math.max(...values) + 2);
  const span = yMax - yMin;
  const yFor = (v: number) =>
    PAD_T + innerH - ((v - yMin) / span) * innerH;

  const stepX = values.length > 1 ? innerW / (values.length - 1) : innerW;
  const xFor = (i: number) =>
    values.length > 1 ? PAD_L + stepX * i : PAD_L + innerW / 2;

  const points = values.map((v, i) => `${xFor(i)},${yFor(v)}`).join(' ');

  // Personal "normal" band: average ± 4 days. Abnormal = >7 days off avg.
  const normalLo = average !== null ? Math.max(yMin, average - 4) : null;
  const normalHi = average !== null ? Math.min(yMax, average + 4) : null;

  // Day labels on the y-axis at 21, 28, 35.
  const yTicks = [21, 28, 35].filter((v) => v > yMin && v < yMax);

  return (
    <View>
      <Svg width={W} height={H}>
        <Defs>
          <LinearGradient id="cycleArea" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={colors.period} stopOpacity={0.22} />
            <Stop offset="100%" stopColor={colors.period} stopOpacity={0} />
          </LinearGradient>
        </Defs>

        {/* Grid */}
        {yTicks.map((tick) => (
          <Line
            key={`g${tick}`}
            x1={PAD_L}
            x2={W - PAD_R}
            y1={yFor(tick)}
            y2={yFor(tick)}
            stroke={colors.border}
            strokeWidth={1}
            opacity={0.5}
          />
        ))}

        {/* Normal range band */}
        {normalLo !== null && normalHi !== null && (
          <Rect
            x={PAD_L}
            y={yFor(normalHi)}
            width={innerW}
            height={yFor(normalLo) - yFor(normalHi)}
            fill={colors.period}
            opacity={0.08}
            rx={6}
          />
        )}

        {/* Average line */}
        {average !== null && (
          <Line
            x1={PAD_L}
            x2={W - PAD_R}
            y1={yFor(average)}
            y2={yFor(average)}
            stroke={colors.period}
            strokeWidth={1.5}
            strokeDasharray="6 4"
            opacity={0.6}
          />
        )}

        {/* Filled area under the line */}
        {values.length > 1 && (
          <Path
            d={`M ${xFor(0)},${PAD_T + innerH} ${values
              .map((v, i) => `L ${xFor(i)},${yFor(v)}`)
              .join(' ')} L ${xFor(values.length - 1)},${PAD_T + innerH} Z`}
            fill="url(#cycleArea)"
          />
        )}

        {/* Line */}
        <Polyline
          points={points}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Dots + values */}
        {values.map((v, i) => {
          const x = xFor(i);
          const y = yFor(v);
          const isAbnormal =
            average !== null && Math.abs(v - average) > 7;
          return (
            <React.Fragment key={`p${i}`}>
              {isAbnormal && (
                <Circle
                  cx={x}
                  cy={y}
                  r={11}
                  fill={colors.period}
                  opacity={0.18}
                />
              )}
              <Circle
                cx={x}
                cy={y}
                r={isAbnormal ? 6 : 5}
                fill={colors.background}
                stroke={isAbnormal ? colors.period : colors.primary}
                strokeWidth={2.5}
              />
              <SvgText
                x={x}
                y={y - 12}
                fontSize="11"
                fontWeight="600"
                fill={colors.text}
                textAnchor="middle"
              >
                {String(v)}
              </SvgText>
            </React.Fragment>
          );
        })}

        {/* Y-axis labels */}
        {yTicks.map((tick) => (
          <SvgText
            key={`yl${tick}`}
            x={PAD_L - 6}
            y={yFor(tick) + 4}
            fontSize="10"
            fill={colors.textMuted}
            textAnchor="end"
          >
            {String(tick)}
          </SvgText>
        ))}

        {/* X-axis: cycle start month labels (last entry only when room is short) */}
        {values.map((_, i) => {
          // `starts` may include one extra entry (the start of the cycle
          // following the last measured length). Map index i → starts[i+1]
          // so the label is the *end* of cycle i (= start of next). Fall
          // back to starts[i] if needed.
          const iso = starts[i + 1] ?? starts[i];
          if (!iso) return null;
          const d = parseISO(iso);
          const label = format(d, 'd MMM').replace('.', '');
          return (
            <SvgText
              key={`xl${i}`}
              x={xFor(i)}
              y={H - PAD_B + 18}
              fontSize="10"
              fill={colors.textMuted}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          );
        })}
      </Svg>
      <Text style={[chartStyles.hint, { color: colors.textMuted }]}>{hint}</Text>
    </View>
  );
};

const PALETTE = [
  '#E07083',
  '#E89B8A',
  '#C45A8E',
  '#F4B5D2',
  '#D4A57E',
  '#B88A6E',
  '#A95C73',
  '#E8C4A8',
  '#9A4D63',
  '#F0D7BF',
];

const SymptomsBreakdown: React.FC<{
  data: { key: string; count: number }[];
  labelFor: (k: string) => string;
  colors: ThemeColors;
}> = ({ data, labelFor, colors }) => {
  const top = data.slice(0, 6);
  const total = top.reduce((a, b) => a + b.count, 0);
  const W = 280;
  const R = 60;
  const CX = W / 2;
  const CY = R + 10;
  let cumulative = 0;
  const arcs: { d: string; color: string }[] = [];
  for (let i = 0; i < top.length; i++) {
    const value = top[i].count / total;
    const startAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    cumulative += value;
    const endAngle = cumulative * 2 * Math.PI - Math.PI / 2;
    const x1 = CX + R * Math.cos(startAngle);
    const y1 = CY + R * Math.sin(startAngle);
    const x2 = CX + R * Math.cos(endAngle);
    const y2 = CY + R * Math.sin(endAngle);
    const largeArc = value > 0.5 ? 1 : 0;
    const d =
      top.length === 1
        ? `M ${CX - R} ${CY} a ${R} ${R} 0 1 0 ${R * 2} 0 a ${R} ${R} 0 1 0 -${R * 2} 0`
        : `M ${CX} ${CY} L ${x1} ${y1} A ${R} ${R} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    arcs.push({ d, color: PALETTE[i % PALETTE.length] });
  }
  return (
    <View>
      <Svg width={W} height={R * 2 + 20}>
        {arcs.map((a, i) => (
          <Path key={i} d={a.d} fill={a.color} />
        ))}
        <Circle cx={CX} cy={CY} r={R * 0.55} fill={colors.card} />
      </Svg>
      <View style={{ marginTop: 12 }}>
        {top.map((s, i) => (
          <View key={s.key} style={legendStyles.row}>
            <View
              style={[
                legendStyles.dot,
                { backgroundColor: PALETTE[i % PALETTE.length] },
              ]}
            />
            <Text style={[legendStyles.label, { color: colors.text }]}>
              {labelFor(s.key)}
            </Text>
            <Text style={[legendStyles.value, { color: colors.textMuted }]}>
              {s.count}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
};

const legendStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    marginRight: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 14,
    marginBottom: 6,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    marginRight: 6,
  },
  label: { flex: 1, fontSize: 12 },
  legendLabel: { fontSize: 11.5, fontWeight: '500' },
  value: { fontSize: 13, fontWeight: '600' },
});

const chartStyles = StyleSheet.create({
  hint: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    textAlign: 'center',
  },
});

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingTop: 8 },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      marginBottom: 8,
    },
    h1: {
      fontSize: 32,
      fontFamily: SERIF_STACK,
      fontWeight: '300',
      color: colors.primary,
      marginTop: 8,
    },
    h1Sub: {
      fontSize: 12,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      fontWeight: '600',
      marginTop: 2,
    },
    section: {
      fontSize: 12,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: '600',
      marginTop: 18,
      marginBottom: 8,
    },
    row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    exportBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 13,
      paddingHorizontal: 16,
      alignItems: 'center',
      marginTop: 14,
    },
    exportBtnText: {
      color: colors.primaryText,
      fontWeight: '700',
      fontSize: 14,
      letterSpacing: 0.3,
    },
    card: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
      overflow: 'hidden',
    },
    cardAccent: {
      position: 'absolute',
      left: 0,
      top: 0,
      bottom: 0,
      width: 4,
      borderTopLeftRadius: 18,
      borderBottomLeftRadius: 18,
    },
    cardLabel: {
      color: colors.textMuted,
      fontSize: 11,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      fontWeight: '600',
      marginBottom: 6,
    },
    cardValue: {
      fontSize: 18,
      color: colors.text,
      fontFamily: SERIF_STACK,
    },
    cardLg: {
      backgroundColor: colors.card,
      borderRadius: 22,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      shadowColor: '#000',
      shadowOpacity: 0.05,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
      marginTop: 4,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 10,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      fontFamily: SERIF_STACK,
    },
    linkText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '600',
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginBottom: 12,
    },
    cycleRow: {
      paddingTop: 10,
      paddingBottom: 4,
    },
    cycleRowDivider: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      marginTop: 8,
    },
    cycleRowHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    cycleRowTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    cycleRowSubtitle: {
      fontSize: 12,
      color: colors.textMuted,
    },
    cycleDots: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    phaseDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    chartCard: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    muted: { color: colors.textMuted, fontSize: 13, lineHeight: 19 },
  });
