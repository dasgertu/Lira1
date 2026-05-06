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
import { useSubscription } from '../hooks/useSubscription';
import { RootStackParamList } from '../navigation';
import { SERIF_STACK, WaveBackground } from '../components/WaveBackground';
import { ThemeColors } from '../theme';
import { buildTelegramLinkUrl } from '../utils/subscription';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const BOT_USERNAME = 'lowerBsk24_bot';
const BUTTON_ACCENT = '#8267E6';

interface MysteryTierCardProps {
  title: string;
  price: string;
  body: string;
  buttonLabel: string;
  tint: string;
  glow: string;
  active?: boolean;
  onPress: () => void;
}

const MysteryTierCard: React.FC<MysteryTierCardProps> = ({
  title,
  price,
  body,
  buttonLabel,
  tint,
  glow,
  active,
  onPress,
}) => {
  return (
    <View
      style={[
        stylesShared.card,
        {
          backgroundColor: tint,
          shadowColor: glow,
          borderColor: active ? BUTTON_ACCENT : 'rgba(255,255,255,0.35)',
          borderWidth: active ? 1.5 : 1,
        },
      ]}
    >
      <View style={stylesShared.cardTopRow}>
        <Text style={stylesShared.cardTitle}>{title}</Text>
        <Text style={stylesShared.cardPrice}>{price}</Text>
      </View>
      <Text style={stylesShared.cardBody}>{body}</Text>
      <Pressable style={stylesShared.cardButton} onPress={onPress}>
        <Text style={stylesShared.cardButtonText}>{buttonLabel}</Text>
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
  const { colors } = useApp();
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
          tint={colors.card}
          glow="#D8BDEB"
          active={isActive && tier === 'basic'}
          body="Каждый месяц перед началом цикла курьер приносит загадочную коробку. Внутри – твои выбранные средства гигиены, вкусный комплимент и ритуал ухода. Состав меняется, опираясь на твой профиль, аллергии, сезон и фазу. Мы не повторяемся. Ты узнаешь наполнение, только открыв коробку."
          buttonLabel="Выбрать ритм"
          onPress={openBot}
        />

        <MysteryTierCard
          title="Полная симфония"
          price="1999₽/мес"
          tint={colors.surface}
          glow="#C9B5FF"
          active={isActive && tier === 'vip'}
          body="Расширенная тайна для тех, кто хочет больше заботы и сюрпризов. Органические средства гигиены, гастрономический подарок ручной работы, ритуалы ухода для лица, тела и души, чайная церемония и тайный презент. Плюс персональные гайды и медитации в приложении. Бесплатная доставка к началу цикла. Мы собираем этот бокс в абсолютной тишине, зная о тебе больше, чем ты думаешь. Открой – и почувствуй мелодию заботы, написанную только для тебя."
          buttonLabel="Выбрать симфонию"
          onPress={openBot}
        />

        <View style={styles.codeCard}>
          <Text style={styles.codeTitle}>Синхронизация с Telegram</Text>
          <Text style={styles.codeHint}>
            Открой Lira BOX в Telegram — выбери тариф и оплати. Подписка{' '}
            <Text style={{ fontWeight: '700' }}>автоматически</Text> подтянется
            в приложение, никаких кодов вводить не нужно.
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
