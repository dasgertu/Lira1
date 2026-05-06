import React, { useEffect, useMemo, useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';

import { useApp } from '../AppContext';
import { findPeriodEpisodes, findPeriodStarts } from '../cycle';
import { useSubscription } from '../hooks/useSubscription';
import { RootStackParamList } from '../navigation';
import { SERIF_STACK, WaveBackground } from '../components/WaveBackground';
import { ThemeColors } from '../theme';
import {
  buildTelegramLinkUrl,
  pushCyclePayloadToBot,
} from '../utils/subscription';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BOT_USERNAME = 'lowerBsk24_bot';
const BUTTON_ACCENT = '#8267E6';

interface TierPalette {
  /** Solid background tint of the card. */
  bg: string;
  /** Top-right large blurred-look glow blob. */
  glowA: string;
  /** Bottom-left large blurred-look glow blob. */
  glowB: string;
  /** Soft thin highlight stroke layered on top. */
  highlight: string;
  /** Drop-shadow color (subtle, behind the card). */
  shadow: string;
  /** Border color when card is "selected" (subscription active). */
  borderActive: string;
  /** Default border color. */
  border: string;
  /** Title + price text color. */
  textPrimary: string;
  /** Body text color. */
  textBody: string;
  /** Color of the small badge pill at the top of the card. */
  badgeBg: string;
  badgeText: string;
  /** CTA button background + text colors. */
  buttonBg: string;
  buttonText: string;
}

// Warm sunrise palette — soft peach cream with rose glow. Conveys
// "everyday morning ritual".
const PALETTE_DAWN: TierPalette = {
  bg: '#FBE0CF',
  glowA: '#F4B5D2',
  glowB: '#FCD0C0',
  highlight: 'rgba(255,255,255,0.55)',
  shadow: '#E7B9A6',
  borderActive: '#C45A8E',
  border: 'rgba(255,255,255,0.55)',
  textPrimary: '#7E4F58',
  textBody: '#8F6E6A',
  badgeBg: '#FFF3EA',
  badgeText: '#C45A8E',
  buttonBg: '#C45A8E',
  buttonText: '#FFFFFF',
};

// Deep sunset palette — rich warm rose with magenta glow. Conveys
// "luxury evening, more than just basics".
const PALETTE_SUNSET: TierPalette = {
  bg: '#C45A8E',
  glowA: '#E07083',
  glowB: '#F4B5D2',
  highlight: 'rgba(255,235,225,0.18)',
  shadow: '#7A2D55',
  borderActive: '#FCEAD3',
  border: 'rgba(255,234,211,0.35)',
  textPrimary: '#FFF4E8',
  textBody: '#FCE5D7',
  badgeBg: '#FFF3EA',
  badgeText: '#7A2D55',
  buttonBg: '#FFF4E8',
  buttonText: '#7A2D55',
};

interface MysteryTierCardProps {
  title: string;
  price: string;
  body: string;
  buttonLabel: string;
  badgeLabel?: string;
  features?: string[];
  palette: TierPalette;
  active?: boolean;
  onPress: () => void;
}

const MysteryTierCard: React.FC<MysteryTierCardProps> = ({
  title,
  price,
  body,
  buttonLabel,
  badgeLabel,
  features,
  palette,
  active,
  onPress,
}) => {
  return (
    <View
      style={[
        stylesShared.card,
        {
          backgroundColor: palette.bg,
          shadowColor: palette.shadow,
          borderColor: active ? palette.borderActive : palette.border,
          borderWidth: active ? 1.5 : 1,
          overflow: 'hidden',
        },
      ]}
    >
      <View
        style={[
          stylesShared.premiumGlowA,
          { backgroundColor: palette.glowA, opacity: 0.75 },
        ]}
      />
      <View
        style={[
          stylesShared.premiumGlowB,
          { backgroundColor: palette.glowB, opacity: 0.55 },
        ]}
      />
      <View
        style={[
          stylesShared.tierHighlight,
          { backgroundColor: palette.highlight },
        ]}
      />
      {badgeLabel ? (
        <View style={stylesShared.premiumBadgeRow}>
          <View
            style={[
              stylesShared.premiumBadge,
              { backgroundColor: palette.badgeBg },
            ]}
          >
            <Text
              style={[
                stylesShared.premiumBadgeText,
                { color: palette.badgeText },
              ]}
            >
              {badgeLabel}
            </Text>
          </View>
        </View>
      ) : null}
      <View style={stylesShared.cardTopRow}>
        <Text style={[stylesShared.cardTitle, { color: palette.textPrimary }]}>
          {title}
        </Text>
        <Text style={[stylesShared.cardPrice, { color: palette.textPrimary }]}>
          {price}
        </Text>
      </View>
      <Text style={[stylesShared.cardBody, { color: palette.textBody }]}>
        {body}
      </Text>
      {features && features.length > 0 ? (
        <View style={stylesShared.featureList}>
          {features.map((line) => (
            <Text
              key={line}
              style={[
                stylesShared.featureLine,
                { color: palette.textBody },
              ]}
            >
              ✦ {line}
            </Text>
          ))}
        </View>
      ) : null}
      <Pressable
        style={[
          stylesShared.cardButton,
          { backgroundColor: palette.buttonBg },
        ]}
        onPress={onPress}
      >
        <Text
          style={[
            stylesShared.cardButtonText,
            { color: palette.buttonText },
          ]}
        >
          {buttonLabel}
        </Text>
      </Pressable>
    </View>
  );
};

interface PremiumCardProps {
  active?: boolean;
  onPress: () => void;
  colors: ThemeColors;
}

const PremiumCard: React.FC<PremiumCardProps> = ({ active, onPress, colors }) => {
  return (
    <View
      style={[
        stylesShared.card,
        {
          backgroundColor: colors.surface,
          borderColor: active ? colors.primary : colors.border,
          borderWidth: active ? 1.5 : 1,
          shadowColor: colors.primary,
          overflow: 'hidden',
        },
      ]}
    >
      <View
        style={[
          stylesShared.premiumGlowA,
          { backgroundColor: colors.fertile, opacity: 0.7 },
        ]}
      />
      <View
        style={[
          stylesShared.premiumGlowB,
          { backgroundColor: colors.ovulation, opacity: 0.55 },
        ]}
      />
      <View style={stylesShared.premiumBadgeRow}>
        <View
          style={[
            stylesShared.premiumBadge,
            { backgroundColor: colors.background },
          ]}
        >
          <Text
            style={[stylesShared.premiumBadgeText, { color: colors.primary }]}
          >
            NEW · Цифровой
          </Text>
        </View>
      </View>
      <View style={stylesShared.cardTopRow}>
        <Text style={[stylesShared.cardTitle, { color: colors.text }]}>
          Lira Premium
        </Text>
        <Text style={[stylesShared.cardPrice, { color: colors.text }]}>
          199₽/мес
        </Text>
      </View>
      <Text style={[stylesShared.cardBody, { color: colors.text }]}>
        Расширенная аналитика цикла, прогноз овуляции, экспорт данных,
        персональные гайды. Всё в твоём телефоне.
      </Text>
      <View style={stylesShared.featureList}>
        {[
          'Графики температуры и симптомов',
          'Детальный прогноз овуляции',
          'Экспорт циклов в PDF / CSV',
          'Персональные гайды и статьи',
        ].map((line) => (
          <Text
            key={line}
            style={[stylesShared.featureLine, { color: colors.text }]}
          >
            ✦ {line}
          </Text>
        ))}
      </View>
      <Pressable
        style={[
          stylesShared.cardButton,
          { backgroundColor: colors.primary },
        ]}
        onPress={onPress}
      >
        <Text style={[stylesShared.cardButtonText, { color: colors.primaryText }]}>
          {active ? 'Управление подпиской' : 'Попробовать за 199 ₽/мес'}
        </Text>
      </Pressable>
    </View>
  );
};

export const SubscriptionScreen: React.FC = () => {
  const { colors, data } = useApp();
  const {
    subscription,
    tier,
    isActive,
    isPremium,
    daysLeft,
    refresh,
  } = useSubscription();
  const navigation = useNavigation<Nav>();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [syncing, setSyncing] = useState(false);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);

  // Resolve the Telegram deep-link once so the "Sync with Telegram" CTA
  // can open it without async work on press.
  useEffect(() => {
    let cancelled = false;
    void buildTelegramLinkUrl().then((url) => {
      if (!cancelled) setLinkUrl(url);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const fmtDate = (iso: string | null): string => {
    if (!iso) return '—';
    try {
      return format(parseISO(iso), 'd MMMM yyyy', { locale: ru });
    } catch {
      return iso;
    }
  };

  // All "open bot" entry points now go through the link deep link so the
  // device_id is bound on first contact. The user no longer needs to copy
  // any activation code by hand.
  const openBot = () => {
    void openSyncWithTelegram();
  };

  const onPressPremium = () => {
    if (tier === 'premium' && isActive) {
      navigation.navigate('ManageSubscription');
      return;
    }
    void openSyncWithTelegram();
  };

  // Open the bot via the link_<deviceid> deep link. Once the user taps
  // "Open" inside Telegram and the bot responds, the device is bound to
  // their Telegram account; the auto-poll inside useSubscription picks
  // up the active subscription within ~30s after they pay.
  const openSyncWithTelegram = async () => {
    setSyncing(true);
    try {
      // Push whatever cycle data the user has logged so far so the bot
      // can skip the cycle questions in the box questionnaire.
      const starts = findPeriodStarts(data.logs);
      const anchor = starts.length > 0 ? starts[starts.length - 1] : null;
      const episodes = findPeriodEpisodes(data.logs);
      await pushCyclePayloadToBot({
        anchorDate: anchor,
        cycleLength: data.settings.averageCycleLength,
        periodLength: data.settings.averagePeriodLength,
        episodes,
      });
      const url = linkUrl ?? (await buildTelegramLinkUrl());
      const can = await Linking.canOpenURL(url);
      if (!can) {
        Alert.alert(
          'Не получилось открыть Telegram',
          'Открой бота вручную: @' + BOT_USERNAME,
        );
        return;
      }
      await Linking.openURL(url);
      // After the user comes back we proactively refresh status. The
      // 30s poll will keep checking too.
      setTimeout(() => {
        void refresh();
      }, 4000);
    } catch {
      Alert.alert('Не получилось открыть Telegram', BOT_USERNAME);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <WaveBackground colors={colors} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Твоя тайная коробка заботы</Text>
        <Text style={styles.subtitle}>Мы узнали тебя. Теперь доверься нам.</Text>

        {isActive ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusEyebrow}>Подписка активна</Text>
            <Text style={styles.statusTitle}>
              {tier === 'vip'
                ? 'Полная симфония'
                : tier === 'basic'
                  ? 'Твой ритм'
                  : 'Lira Premium'}
            </Text>
            <View style={styles.statusRow}>
              <Text style={styles.statusKey}>Действует до</Text>
              <Text style={styles.statusVal}>{fmtDate(subscription.renewsAt)}</Text>
            </View>
            <Text style={styles.statusHint}>Осталось дней: {daysLeft}</Text>
            <Pressable
              style={styles.manageButton}
              onPress={() => navigation.navigate('ManageSubscription')}
            >
              <Text style={styles.manageButtonText}>Управление</Text>
            </Pressable>
          </View>
        ) : null}

        <PremiumCard
          active={isPremium && tier === 'premium'}
          onPress={onPressPremium}
          colors={colors}
        />

        <MysteryTierCard
          title="Твой ритм"
          price="999₽/мес"
          badgeLabel="Базовый бокс"
          palette={PALETTE_DAWN}
          active={isActive && tier === 'basic'}
          body="Каждый месяц перед началом цикла курьер приносит загадочную коробку. Внутри — твои выбранные средства гигиены, вкусный комплимент и ритуал ухода."
          features={[
            'Подбор по твоему профилю и аллергиям',
            'Состав меняется каждый месяц',
            'Доставка к началу цикла',
          ]}
          buttonLabel="Выбрать ритм"
          onPress={openBot}
        />

        <MysteryTierCard
          title="Полная симфония"
          price="1999₽/мес"
          badgeLabel="Премиум-бокс"
          palette={PALETTE_SUNSET}
          active={isActive && tier === 'vip'}
          body="Расширенная тайна для тех, кто хочет больше заботы. Органическая гигиена, гастрономический подарок ручной работы, ритуалы ухода и персональные гайды в приложении."
          features={[
            'Органические средства гигиены',
            'Чайная церемония и тайный презент',
            'Гайды и медитации в приложении',
            'Бесплатная доставка к началу цикла',
          ]}
          buttonLabel="Выбрать симфонию"
          onPress={openBot}
        />

        <View style={styles.codeCard}>
          <Text style={styles.codeTitle}>Синхронизация с Telegram</Text>
          <Text style={styles.codeHint}>
            Открой Lira BOX в Telegram — выбери тариф и оплати. Подписка{' '}
            <Text style={{ fontWeight: '700' }}>автоматически активируется</Text>.
          </Text>
          <Pressable
            style={[styles.activateButton, syncing && { opacity: 0.6 }]}
            onPress={() => void openSyncWithTelegram()}
            disabled={syncing}
          >
            <Text style={styles.activateButtonText}>
              {syncing ? 'Открываю Telegram…' : 'Открыть Lira BOX в Telegram'}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.activateButton,
              {
                marginTop: 10,
                backgroundColor: 'transparent',
                borderWidth: 1,
                borderColor: BUTTON_ACCENT,
              },
            ]}
            onPress={() => void refresh()}
          >
            <Text
              style={[styles.activateButtonText, { color: BUTTON_ACCENT }]}
            >
              Обновить статус подписки
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const stylesShared = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 22,
    marginBottom: 18,
    shadowOpacity: 0.16,
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 18,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  cardTitle: {
    flex: 1,
    fontSize: 28,
    lineHeight: 32,
    fontFamily: SERIF_STACK,
    color: '#7E6177',
  },
  cardPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#7E6177',
  },
  cardBody: {
    fontSize: 15,
    lineHeight: 24,
    color: '#8F786C',
  },
  cardButton: {
    marginTop: 18,
    alignSelf: 'flex-start',
    backgroundColor: BUTTON_ACCENT,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 16,
  },
  cardButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  premiumGlowA: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    top: -70,
    right: -60,
  },
  premiumGlowB: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    bottom: -60,
    left: -40,
  },
  // Soft top highlight that gives the card a subtle "glassy" sheen on
  // top of the colored glow blobs.
  tierHighlight: {
    position: 'absolute',
    left: 12,
    right: 12,
    top: 10,
    height: 2,
    borderRadius: 2,
    opacity: 0.8,
  },
  premiumBadgeRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  premiumBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  premiumBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  featureList: {
    marginTop: 14,
    marginBottom: 4,
  },
  featureLine: {
    fontSize: 14,
    lineHeight: 22,
  },
});

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: 16,
      paddingBottom: 32,
    },
    title: {
      fontSize: 36,
      lineHeight: 44,
      fontFamily: SERIF_STACK,
      color: colors.text,
      marginTop: 8,
    },
    subtitle: {
      marginTop: 8,
      marginBottom: 24,
      fontSize: 17,
      lineHeight: 24,
      color: colors.textMuted,
    },
    statusCard: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
      marginBottom: 18,
    },
    statusEyebrow: {
      fontSize: 12,
      textTransform: 'uppercase',
      letterSpacing: 1.1,
      color: colors.textMuted,
    },
    statusTitle: {
      marginTop: 6,
      fontSize: 24,
      fontFamily: SERIF_STACK,
      color: colors.text,
    },
    statusRow: {
      marginTop: 12,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: 12,
    },
    statusKey: {
      fontSize: 14,
      color: colors.textMuted,
    },
    statusVal: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    statusHint: {
      marginTop: 6,
      fontSize: 13,
      color: colors.textMuted,
    },
    manageButton: {
      marginTop: 14,
      backgroundColor: BUTTON_ACCENT,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
    },
    manageButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
    codeCard: {
      marginTop: 6,
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
    },
    codeTitle: {
      fontSize: 22,
      fontFamily: SERIF_STACK,
      color: colors.text,
    },
    codeHint: {
      marginTop: 8,
      marginBottom: 12,
      fontSize: 14,
      lineHeight: 21,
      color: colors.textMuted,
    },
    codeInput: {
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      borderRadius: 14,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 16,
      letterSpacing: 2,
      color: colors.text,
    },
    activateButton: {
      marginTop: 12,
      backgroundColor: BUTTON_ACCENT,
      borderRadius: 16,
      paddingVertical: 14,
      alignItems: 'center',
    },
    activateButtonText: {
      color: '#FFFFFF',
      fontSize: 15,
      fontWeight: '700',
    },
    syncBadge: {
      marginTop: 4,
      marginBottom: 12,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
      paddingVertical: 14,
      paddingHorizontal: 12,
      alignItems: 'center',
    },
    syncBadgeText: {
      color: colors.text,
      fontSize: 22,
      fontWeight: '700',
      letterSpacing: 4,
    },
  });
