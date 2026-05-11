import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { parseISO } from 'date-fns';
import { useApp } from '../AppContext';
import { useSubscription } from '../hooks/useSubscription';
import { computeCycleHistory } from '../cycle';
import { tArray } from '../i18n';
import { SERIF_STACK, WaveBackground } from '../components/WaveBackground';
import { PremiumGate } from '../components/PremiumGate';
import { ThemeColors } from '../theme';
import { exportToPdf } from '../utils/exportPdf';
import type { RootStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<RootStackParamList, 'History'>;

export const HistoryScreen: React.FC = () => {
  const { data, colors, t, language } = useApp();
  const { isPremium } = useSubscription();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const nav = useNavigation<Nav>();
  void language;

  const history = useMemo(
    () => computeCycleHistory(data.logs),
    [data.logs],
  );
  const months = tArray('monthsGenitive');
  const fmtDate = (iso: string): string => {
    const d = parseISO(iso);
    return `${d.getDate()} ${months[d.getMonth()] ?? ''} ${d.getFullYear()}`;
  };

  if (!isPremium) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <WaveBackground colors={colors} />
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.h1}>{t('history.title')}</Text>
          <PremiumGate
            feature="История циклов"
            body="Полная летопись циклов: длительности, симптомы, фазы и экспорт в PDF. Открывается с любой из трёх подписок."
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <WaveBackground colors={colors} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>{t('history.title')}</Text>

        <Pressable
          style={styles.exportBtn}
          onPress={() => {
            void exportToPdf(data, 'history');
          }}
        >
          <Text style={styles.exportBtnText}>Экспорт истории в PDF</Text>
        </Pressable>

        {history.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.muted}>{t('history.empty')}</Text>
          </View>
        )}

        {history
          .slice()
          .reverse()
          .map((entry) => {
            const isCurrent = entry.end === null;
            return (
              <Pressable
                key={entry.start}
                style={({ pressed }) => [
                  styles.row,
                  pressed && { opacity: 0.7 },
                ]}
                onPress={() =>
                  nav.navigate('CycleDetail', { start: entry.start })
                }
              >
                <View style={styles.rowMain}>
                  <Text style={styles.rowDate}>{fmtDate(entry.start)}</Text>
                  <Text style={styles.rowSub}>
                    {isCurrent
                      ? t('history.current')
                      : entry.end
                        ? `→ ${fmtDate(entry.end)}`
                        : ''}
                  </Text>
                </View>
                <View style={styles.rowMeta}>
                  <Text style={styles.rowMetaValue}>
                    {entry.cycleLength !== null
                      ? `${entry.cycleLength} ${t('history.days')}`
                      : '—'}
                  </Text>
                  <Text style={styles.rowMetaLabel}>
                    {t('history.cycleLength')}
                  </Text>
                </View>
              </Pressable>
            );
          })}

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
};

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingTop: 8 },
    h1: {
      fontSize: 32,
      fontFamily: SERIF_STACK,
      fontWeight: '300',
      color: colors.primary,
      marginBottom: 16,
      marginTop: 8,
    },
    empty: {
      backgroundColor: colors.card,
      borderRadius: 18,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
    },
    muted: { color: colors.textMuted, fontSize: 14, lineHeight: 20 },
    exportBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 11,
      paddingHorizontal: 16,
      alignItems: 'center',
      marginTop: 6,
      marginBottom: 10,
    },
    exportBtnText: {
      color: colors.primaryText,
      fontWeight: '700',
      fontSize: 14,
      letterSpacing: 0.3,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 8,
    },
    rowMain: { flex: 1 },
    rowDate: {
      fontSize: 16,
      color: colors.text,
      fontFamily: SERIF_STACK,
      marginBottom: 2,
    },
    rowSub: { fontSize: 12, color: colors.textMuted },
    rowMeta: { alignItems: 'flex-end' },
    rowMetaValue: {
      fontSize: 16,
      color: colors.primary,
      fontFamily: SERIF_STACK,
    },
    rowMetaLabel: {
      fontSize: 10,
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginTop: 1,
    },
  });
