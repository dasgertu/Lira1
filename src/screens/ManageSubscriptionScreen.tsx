import React, { useMemo } from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, parseISO } from 'date-fns';
import { enUS, ru } from 'date-fns/locale';

import { useApp } from '../AppContext';
import { useSubscription } from '../hooks/useSubscription';
import { SERIF_STACK, WaveBackground } from '../components/WaveBackground';
import { ThemeColors } from '../theme';
import { buildTelegramLinkUrl } from '../utils/subscription';

export const ManageSubscriptionScreen: React.FC = () => {
  const { colors, t, language } = useApp();
  const { subscription, tier, isActive, daysLeft } = useSubscription();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const fmtDate = (iso: string | null): string => {
    if (!iso) return '—';
    try {
      return format(parseISO(iso), 'd MMMM yyyy', {
        locale: language === 'ru' ? ru : enUS,
      });
    } catch {
      return iso;
    }
  };

  const tierLabel =
    tier === 'vip'
      ? t('subscription.vipLabel')
      : tier === 'basic'
        ? t('subscription.basicLabel')
        : tier === 'premium'
          ? 'Lira Premium'
          : t('manage.tierFree');

  const onOpenBot = async () => {
    try {
      const url = await buildTelegramLinkUrl();
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('subscription.botUnavailableTitle'), '@lowerBsk24_bot');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <WaveBackground colors={colors} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.h1}>{t('manage.title')}</Text>

        <View style={styles.card}>
          <Text style={styles.label}>{t('manage.currentTier')}</Text>
          <Text style={styles.tier}>{tierLabel}</Text>

          <View style={styles.row}>
            <Text style={styles.rowLabel}>{t('manage.status')}</Text>
            <Text
              style={[
                styles.rowValue,
                { color: isActive ? colors.primary : colors.textMuted },
              ]}
            >
              {isActive ? t('manage.statusActive') : t('manage.statusInactive')}
            </Text>
          </View>

          {isActive ? (
            <>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('manage.startedAt')}</Text>
                <Text style={styles.rowValue}>{fmtDate(subscription.startedAt)}</Text>
              </View>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>{t('manage.expiresAt')}</Text>
                <Text style={styles.rowValue}>{fmtDate(subscription.renewsAt)}</Text>
              </View>
              <Text style={styles.daysLeft}>
                {t('subscription.daysLeft', { n: daysLeft })}
              </Text>
            </>
          ) : (
            <Text style={styles.daysLeft}>{t('manage.inactiveHint')}</Text>
          )}
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>{t('manage.botSectionTitle')}</Text>
          <Text style={styles.infoBody}>{t('manage.botSectionBody')}</Text>
        </View>

        <Pressable
          style={[styles.cta, { backgroundColor: colors.primary }]}
          onPress={onOpenBot}
        >
          <Text style={styles.ctaText}>{t('manage.openBot')}</Text>
        </Pressable>

        <Text style={styles.disclaimer}>{t('manage.disclaimer')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 32 },
    h1: {
      fontSize: 28,
      fontFamily: SERIF_STACK,
      fontWeight: '300',
      color: colors.primary,
      marginTop: 8,
      marginBottom: 16,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    label: {
      color: colors.textMuted,
      fontSize: 12,
      letterSpacing: 1.2,
      textTransform: 'uppercase',
    },
    tier: {
      color: colors.primary,
      fontFamily: SERIF_STACK,
      fontSize: 26,
      fontWeight: '600',
      marginTop: 4,
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 6,
    },
    rowLabel: { color: colors.textMuted, fontSize: 13 },
    rowValue: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1, marginLeft: 12 },
    daysLeft: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 8,
      fontStyle: 'italic',
    },
    infoCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 18,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    infoTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
      fontFamily: SERIF_STACK,
    },
    infoBody: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: 6,
      lineHeight: 19,
    },
    cta: {
      paddingVertical: 14,
      borderRadius: 16,
      alignItems: 'center',
      marginTop: 6,
    },
    ctaText: {
      color: '#FFFCF7',
      fontSize: 15,
      fontWeight: '700',
      letterSpacing: 0.3,
    },
    disclaimer: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 16,
      textAlign: 'center',
      lineHeight: 16,
    },
  });
