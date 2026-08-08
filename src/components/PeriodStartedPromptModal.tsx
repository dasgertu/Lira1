import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemeColors } from '../theme';

interface Props {
  visible: boolean;
  onYes: () => void;
  onNo: () => void;
  colors: ThemeColors;
  t: (key: string, opts?: Record<string, unknown>) => string;
}

/**
 * "Did your period start today?" auto-popup. Shown on the Today screen when
 * today falls inside a predicted period window (the user is "due" but
 * hasn't logged anything yet). Two-button reply: Yes logs a medium flow for
 * today; No snoozes the prompt for the rest of the day.
 */
export const PeriodStartedPromptModal: React.FC<Props> = ({
  visible,
  onYes,
  onNo,
  colors,
  t,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onNo}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>
            {t('today.confirmTitle')}
          </Text>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            {t('today.confirmHint')}
          </Text>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={onYes}
              style={({ pressed }) => [
                styles.btn,
                styles.btnPrimary,
                { backgroundColor: colors.primary },
                pressed && { opacity: 0.85 },
              ]}
            >
              <Text
                style={[styles.btnPrimaryText, { color: colors.primaryText }]}
              >
                {t('today.confirmYes')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              onPress={onNo}
              style={({ pressed }) => [
                styles.btn,
                styles.btnGhost,
                { borderColor: colors.border },
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={[styles.btnGhostText, { color: colors.text }]}>
                {t('today.confirmNo')}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'column',
    gap: 10,
  },
  btn: {
    height: 48,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnPrimary: {},
  btnPrimaryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  btnGhost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  btnGhostText: {
    fontSize: 16,
    fontWeight: '500',
  },
});
