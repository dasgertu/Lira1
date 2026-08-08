import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useApp } from '../AppContext';
import { ThemeColors } from '../theme';

const SERIF =
  'Cochin, "Hoefler Text", "Times New Roman", Georgia, serif';

interface Props {
  onAccept: () => void;
}

/**
 * Consent screen shown before any other UI on the very first launch (and
 * after the user wipes their data via Settings → Clear data). Required for
 * 152-ФЗ ("О персональных данных") compliance: the user explicitly
 * acknowledges the privacy policy + user agreement and gives consent to
 * processing of personal data before the app collects any.
 */
export const ConsentScreen: React.FC<Props> = ({ onAccept }) => {
  const { colors, t, setConsentAccepted } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const [ackPolicy, setAckPolicy] = useState(false);
  const [ackAge, setAckAge] = useState(false);

  const canContinue = ackPolicy && ackAge;

  const onContinue = async () => {
    if (!canContinue) return;
    await setConsentAccepted();
    onAccept();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.bigSerif}>{t('consent.title')}</Text>
        <Text style={styles.subtitle}>{t('consent.subtitle')}</Text>

        <Section title={t('consent.privacyTitle')} colors={colors}>
          <Bullet text={t('consent.privacyOperator')} colors={colors} />
          <Bullet text={t('consent.privacyData')} colors={colors} />
          <Bullet text={t('consent.privacyStorage')} colors={colors} />
          <Bullet text={t('consent.privacyPurpose')} colors={colors} />
          <Bullet text={t('consent.privacyTelegram')} colors={colors} />
          <Bullet text={t('consent.privacyRetention')} colors={colors} />
          <Bullet text={t('consent.privacyRights')} colors={colors} />
          <Bullet text={t('consent.privacyLegal')} colors={colors} />
        </Section>

        <Section title={t('consent.termsTitle')} colors={colors}>
          <Bullet text={t('consent.termsScope')} colors={colors} />
          <Bullet text={t('consent.termsDisclaimer')} colors={colors} />
          <Bullet text={t('consent.termsAge')} colors={colors} />
          <Bullet text={t('consent.termsLiability')} colors={colors} />
          <Bullet text={t('consent.termsWithdraw')} colors={colors} />
        </Section>

        <Pressable
          style={styles.checkRow}
          onPress={() => setAckAge((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ackAge }}
        >
          <View
            style={[
              styles.checkBox,
              ackAge && {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
            ]}
          >
            {ackAge && <Text style={styles.checkMark}>✓</Text>}
          </View>
          <Text style={styles.checkLabel}>{t('consent.ackAge')}</Text>
        </Pressable>

        <Pressable
          style={styles.checkRow}
          onPress={() => setAckPolicy((v) => !v)}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: ackPolicy }}
        >
          <View
            style={[
              styles.checkBox,
              ackPolicy && {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
              },
            ]}
          >
            {ackPolicy && <Text style={styles.checkMark}>✓</Text>}
          </View>
          <Text style={styles.checkLabel}>{t('consent.ackPolicy')}</Text>
        </Pressable>

        <Pressable
          style={[styles.acceptBtn, !canContinue && styles.acceptBtnDisabled]}
          onPress={onContinue}
          disabled={!canContinue}
        >
          <Text style={styles.acceptBtnText}>{t('consent.accept')}</Text>
        </Pressable>

        <Text style={styles.footnote}>{t('consent.footnote')}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

interface SectionProps {
  title: string;
  colors: ThemeColors;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, colors, children }) => {
  const styles = makeStyles(colors);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
};

const Bullet: React.FC<{ text: string; colors: ThemeColors }> = ({
  text,
  colors,
}) => {
  const styles = makeStyles(colors);
  return (
    <View style={styles.bulletRow}>
      <View style={styles.bulletDot} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
};

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scrollContent: {
      paddingHorizontal: 24,
      paddingTop: 24,
      paddingBottom: 40,
    },
    bigSerif: {
      fontFamily: SERIF,
      fontSize: 32,
      lineHeight: 38,
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted,
      textAlign: 'center',
      marginBottom: 24,
      paddingHorizontal: 12,
    },
    section: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontFamily: SERIF,
      fontSize: 19,
      color: colors.text,
      marginBottom: 10,
    },
    sectionBody: {},
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    bulletDot: {
      width: 4,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.primary,
      marginTop: 8,
      marginRight: 10,
    },
    bulletText: {
      flex: 1,
      color: colors.text,
      fontSize: 13.5,
      lineHeight: 20,
    },
    checkRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      paddingVertical: 10,
    },
    checkBox: {
      width: 24,
      height: 24,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      marginRight: 12,
      marginTop: 1,
      backgroundColor: colors.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkMark: {
      color: colors.primaryText,
      fontSize: 14,
      lineHeight: 16,
      fontWeight: '700',
    },
    checkLabel: {
      flex: 1,
      color: colors.text,
      fontSize: 14,
      lineHeight: 20,
    },
    acceptBtn: {
      marginTop: 16,
      paddingVertical: 16,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    acceptBtnDisabled: {
      opacity: 0.4,
    },
    acceptBtnText: {
      color: colors.primaryText,
      fontSize: 16,
      fontWeight: '700',
    },
    footnote: {
      marginTop: 12,
      fontSize: 12,
      lineHeight: 18,
      color: colors.textMuted,
      textAlign: 'center',
    },
  });
