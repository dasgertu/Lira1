import React, { useMemo, useRef, useEffect } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  addMonths,
  endOfMonth,
  isSameDay,
  isSameMonth,
  startOfMonth,
} from 'date-fns';

import { useApp } from '../AppContext';
import { buildDayMarkers, fmt } from '../cycle';
import { tArray } from '../i18n';
import { ThemeColors } from '../theme';

interface Props {
  /** ISO date currently selected (highlighted with a ring), if any. */
  selectedIso?: string | null;
  onSelectDay: (iso: string) => void;
  /** How many months back from today to render. Default 1. */
  monthsBack?: number;
  /** How many months forward from today to render. Default 11. */
  monthsForward?: number;
}

interface MonthBlock {
  date: Date;
  cells: (Date | null)[];
}

const buildMonthBlocks = (
  monthsBack: number,
  monthsForward: number,
): MonthBlock[] => {
  const today = new Date();
  const blocks: MonthBlock[] = [];
  for (let m = -monthsBack; m <= monthsForward; m++) {
    const anchor = addMonths(today, m);
    const start = startOfMonth(anchor);
    const end = endOfMonth(anchor);
    // Monday-first grid (ISO week).
    const startDow = (start.getDay() + 6) % 7;
    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= end.getDate(); d++) {
      cells.push(new Date(start.getFullYear(), start.getMonth(), d));
    }
    while (cells.length % 7 !== 0) cells.push(null);
    blocks.push({ date: start, cells });
  }
  return blocks;
};

export const VerticalCalendar: React.FC<Props> = ({
  selectedIso,
  onSelectDay,
  monthsBack = 1,
  monthsForward = 11,
}) => {
  const { data, predictions, colors, language } = useApp();
  const today = new Date();
  const todayKey = fmt(today);
  const markers = useMemo(
    () => buildDayMarkers(data.logs, predictions, data.settings, today),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.logs, predictions, data.settings, language, todayKey],
  );

  const months = tArray('months');
  const weekdays = tArray('weekdays');
  const blocks = useMemo(
    () => buildMonthBlocks(monthsBack, monthsForward),
    [monthsBack, monthsForward],
  );

  const styles = makeStyles(colors);

  const scrollRef = useRef<ScrollView>(null);
  const offsetsRef = useRef<Record<string, number>>({});

  // Auto-scroll to today's month when first mounted.
  useEffect(() => {
    const key = `${today.getFullYear()}-${today.getMonth()}`;
    const offset = offsetsRef.current[key];
    if (typeof offset === 'number' && scrollRef.current) {
      scrollRef.current.scrollTo({ y: Math.max(offset - 60, 0), animated: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.wrap}>
      <Legend colors={colors} />
      <View style={styles.weekRow}>
        {weekdays.map((w) => (
          <Text key={w} style={styles.weekday}>
            {w}
          </Text>
        ))}
      </View>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {blocks.map((block) => (
          <View
            key={`${block.date.getFullYear()}-${block.date.getMonth()}`}
            onLayout={(e) => {
              offsetsRef.current[
                `${block.date.getFullYear()}-${block.date.getMonth()}`
              ] = e.nativeEvent.layout.y;
            }}
            style={styles.monthBlock}
          >
            <Text style={styles.monthLabel}>
              {months[block.date.getMonth()] ?? ''}
              {' '}
              {block.date.getFullYear() !== today.getFullYear()
                ? block.date.getFullYear()
                : ''}
            </Text>
            <View style={styles.grid}>
              {block.cells.map((cell, idx) => {
                if (!cell) {
                  return (
                    <View
                      key={`empty-${block.date.getMonth()}-${idx}`}
                      style={styles.cellWrap}
                    />
                  );
                }
                const dateStr = fmt(cell);
                const dayMarkers = markers[dateStr] ?? [];
                const isToday = isSameDay(cell, today);
                const isSelected = selectedIso === dateStr;
                const isOtherMonth = !isSameMonth(cell, block.date);

                return (
                  <DayCell
                    key={dateStr}
                    date={cell}
                    iso={dateStr}
                    markers={dayMarkers}
                    isToday={isToday}
                    isSelected={isSelected}
                    isOtherMonth={isOtherMonth}
                    colors={colors}
                    onPress={() => onSelectDay(dateStr)}
                  />
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

interface DayCellProps {
  date: Date;
  iso: string;
  markers: string[];
  isToday: boolean;
  isSelected: boolean;
  isOtherMonth: boolean;
  colors: ThemeColors;
  onPress: () => void;
}

const DayCell: React.FC<DayCellProps> = ({
  date,
  markers,
  isToday,
  isSelected,
  isOtherMonth,
  colors,
  onPress,
}) => {
  const styles = makeStyles(colors);
  const hasPeriod = markers.includes('period');
  const hasPredicted = markers.includes('predictedPeriod');
  const hasOvulationPeak = markers.includes('ovulation');
  const hasFertile = markers.includes('fertile');

  // Visual layering, top → bottom precedence.
  let circleStyle: object = styles.circleEmpty;
  let textStyle: object = styles.dayText;

  if (hasPeriod) {
    circleStyle = { ...styles.circle, backgroundColor: colors.period };
    textStyle = { ...styles.dayText, color: colors.primaryText, fontWeight: '700' };
  } else if (hasPredicted) {
    circleStyle = {
      ...styles.circle,
      backgroundColor: 'transparent',
      borderColor: colors.predictedPeriod,
      borderWidth: 2,
    };
    textStyle = {
      ...styles.dayText,
      color: colors.predictedPeriod,
      fontWeight: '600',
    };
  } else if (hasOvulationPeak) {
    circleStyle = {
      ...styles.circle,
      backgroundColor: colors.ovulationPeak,
    };
    textStyle = {
      ...styles.dayText,
      color: colors.primaryText,
      fontWeight: '700',
    };
  } else if (hasFertile) {
    circleStyle = {
      ...styles.circle,
      backgroundColor: colors.ovulation,
    };
    textStyle = { ...styles.dayText, color: colors.text, fontWeight: '600' };
  }

  if (isOtherMonth && !hasPeriod && !hasPredicted && !hasOvulationPeak && !hasFertile) {
    textStyle = { ...textStyle, color: colors.textMuted, opacity: 0.4 };
  }

  return (
    <View style={styles.cellWrap}>
      <View style={isToday ? styles.todayRing : undefined}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [
            circleStyle,
            isSelected && {
              borderColor: colors.today,
              borderWidth: 2,
            },
            pressed && { opacity: 0.7 },
          ]}
        >
          <Text style={textStyle}>{date.getDate()}</Text>
        </Pressable>
      </View>
    </View>
  );
};

const Legend: React.FC<{ colors: ThemeColors }> = ({ colors }) => {
  const styles = makeStyles(colors);
  const items: { swatch: React.ReactNode; label: string }[] = [
    {
      swatch: <View style={[styles.swatch, { backgroundColor: colors.period }]} />,
      label: 'Месячные',
    },
    {
      swatch: (
        <View
          style={[
            styles.swatch,
            {
              backgroundColor: 'transparent',
              borderColor: colors.predictedPeriod,
              borderWidth: 2,
            },
          ]}
        />
      ),
      label: 'Прогноз',
    },
    {
      swatch: <View style={[styles.swatch, { backgroundColor: colors.ovulation }]} />,
      label: 'Овуляция',
    },
    {
      swatch: <View style={[styles.swatch, { backgroundColor: colors.ovulationPeak }]} />,
      label: 'Пик',
    },
    {
      swatch: (
        <View style={styles.legendTodayRing}>
          <View style={[styles.swatch, styles.swatchInner]} />
        </View>
      ),
      label: 'Сегодня',
    },
  ];
  return (
    <View style={styles.legendRow}>
      {items.map((it) => (
        <View key={it.label} style={styles.legendItem}>
          {it.swatch}
          <Text style={styles.legendLabel}>{it.label}</Text>
        </View>
      ))}
    </View>
  );
};

const CIRCLE = 36;

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      flex: 1,
    },
    weekRow: {
      flexDirection: 'row',
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
    },
    weekday: {
      flex: 1,
      textAlign: 'center',
      fontSize: 12,
      color: colors.textMuted,
      letterSpacing: 0.5,
      fontWeight: '600',
    },
    scroll: {
      paddingBottom: 80,
    },
    monthBlock: {
      paddingTop: 16,
      paddingHorizontal: 8,
    },
    monthLabel: {
      fontSize: 16,
      color: colors.textMuted,
      fontWeight: '600',
      marginLeft: 6,
      marginBottom: 6,
      letterSpacing: 0.4,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    cellWrap: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 4,
    },
    circle: {
      width: CIRCLE,
      height: CIRCLE,
      borderRadius: CIRCLE / 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    circleEmpty: {
      width: CIRCLE,
      height: CIRCLE,
      borderRadius: CIRCLE / 2,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: 'transparent',
    },
    dayText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
    },
    todayRing: {
      width: CIRCLE + 8,
      height: CIRCLE + 8,
      borderRadius: (CIRCLE + 8) / 2,
      borderWidth: 1.5,
      borderColor: colors.today,
      alignItems: 'center',
      justifyContent: 'center',
    },
    legendRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 8,
      paddingVertical: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: colors.background,
      justifyContent: 'space-between',
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 3,
      paddingRight: 4,
    },
    legendLabel: {
      marginLeft: 6,
      fontSize: 12,
      color: colors.textMuted,
      letterSpacing: 0.2,
    },
    swatch: {
      width: 18,
      height: 18,
      borderRadius: 9,
    },
    swatchInner: {
      width: 12,
      height: 12,
      borderRadius: 6,
      backgroundColor: 'transparent',
    },
    legendTodayRing: {
      width: 22,
      height: 22,
      borderRadius: 11,
      borderWidth: 1.5,
      borderColor: colors.today,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
