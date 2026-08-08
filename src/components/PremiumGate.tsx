import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useApp } from '../AppContext';
import { useSubscription } from '../hooks/useSubscription';
import { RootStackParamList } from '../navigation';
import { ThemeColors } from '../theme';

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface Props {
  /** Title shown over the locked feature. */
  feature: string;
  /** Optional descriptor of what unlocks. */
  body?: string;
}

export const PremiumGate: React.FC<Props> = ({ feature, body }) => {
  const { colors } = useApp();
  const { isPremium } = useSubscription();
  const navigation = useNavigation<Nav>();
  const styles = makeStyles(colors);
  if (isPremium) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Откроется с любой подпиской</Text>
      <Text style={styles.title}>{feature}</Text>
      {body ? <Text style={styles.body}>{body}</Text> : null}
      <View style={styles.tiers}>
        <View style={styles.tierChip}>
          <Text style={styles.tierName}>Lira Premium</Text>
          <Text style={styles.tierPrice}>199 ₽/мес</Text>
        </View>
        <View style={styles.tierChip}>
          <Text style={styles.tierName}>Твой ритм</Text>
          <Text style={styles.tierPrice}>999 ₽/мес</Text>
        </View>
        <View style={styles.tierChip}>
          <Text style={styles.tierName}>Полная симфония</Text>
          <Text style={styles.tierPrice}>1 999 ₽/мес</Text>
        </View>
      </View>
      <Pressable
        style={styles.cta}
        onPress={() => navigation.navigate('Subscription')}
      >
        <Text style={styles.ctaText}>Выбрать подписку</Text>
      </Pressable>
    </View>
  );
};

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
      padding: 18,
      marginVertical: 12,
    },
    label: {
      fontSize: 11,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.primary,
      marginBottom: 6,
    },
    title: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 6,
    },
    body: {
      fontSize: 13,
      lineHeight: 19,
      color: colors.textMuted,
      marginBottom: 12,
    },
    tiers: {
      gap: 8,
      marginBottom: 14,
    },
    tierChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tierName: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    tierPrice: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.primary,
    },
    cta: {
      alignSelf: 'flex-start',
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: colors.primary,
    },
    ctaText: {
      color: colors.primaryText,
      fontWeight: '700',
      fontSize: 13,
      letterSpacing: 0.4,
    },
  });
