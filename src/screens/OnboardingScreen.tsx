import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  addMonths,
  endOfMonth,
  format,
  isAfter,
  parseISO,
  startOfMonth,
} from 'date-fns';
import { useApp } from '../AppContext';
import { ThemeColors } from '../theme';
import { hashPin } from '../pin';
import { tArray } from '../i18n';

const SERIF =
  'Cochin, "Hoefler Text", "Times New Roman", Georgia, serif';

type Step =
  | 'welcome'
  | 'name'
  | 'birthdate'
  | 'pin'
  | 'lastPeriod'
  | 'prevPeriod'
  | 'cycleLength'
  | 'done';

const STEP_ORDER: Step[] = [
  'welcome',
  'name',
  'birthdate',
  'pin',
  'lastPeriod',
  'prevPeriod',
  'cycleLength',
  'done',
];

interface Props {
  onComplete: () => void;
  initialStep?: Step;
  /** Skip profile-related steps and only run cycle calibration. */
  cycleOnly?: boolean;
}

export const OnboardingScreen: React.FC<Props> = ({
  onComplete,
  initialStep,
  cycleOnly = false,
}) => {
  const {
    colors,
    t,
    data,
    upsertLogs,
    updateSettings,
    updateProfile,
    setOnboardingDone,
  } = useApp();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const steps: Step[] = cycleOnly
    ? ['lastPeriod', 'prevPeriod', 'cycleLength', 'done']
    : STEP_ORDER;
  const [stepIdx, setStepIdx] = useState(() => {
    if (initialStep) return Math.max(0, steps.indexOf(initialStep));
    return 0;
  });
  const step = steps[stepIdx] ?? 'done';

  const [name, setName] = useState(data.profile.name);
  const [birthYear, setBirthYear] = useState(
    data.profile.birthdate ? data.profile.birthdate.slice(0, 4) : '',
  );
  const [birthMonth, setBirthMonth] = useState(
    data.profile.birthdate ? data.profile.birthdate.slice(5, 7) : '',
  );
  const [birthDay, setBirthDay] = useState(
    data.profile.birthdate ? data.profile.birthdate.slice(8, 10) : '',
  );
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [lastPeriodStart, setLastPeriodStart] = useState<string | null>(null);
  const [lastPeriodEnd, setLastPeriodEnd] = useState<string | null>(null);
  const [prevPeriodStart, setPrevPeriodStart] = useState<string | null>(null);
  const [prevPeriodEnd, setPrevPeriodEnd] = useState<string | null>(null);
  const [periodLen, setPeriodLen] = useState(data.settings.averagePeriodLength);
  const [cycleLen, setCycleLen] = useState(data.settings.averageCycleLength);
  const [monthOffset, setMonthOffset] = useState(() =>
    new Date().getDate() <= 7 ? -1 : 0,
  );
  const [prevMonthOffset, setPrevMonthOffset] = useState(() =>
    new Date().getDate() <= 7 ? -2 : -1,
  );
  const [pinError, setPinError] = useState<string | null>(null);

  // Auto-derive cycle length from prev->last period start gap
  const derivedCycleLen = useMemo(() => {
    if (!prevPeriodStart || !lastPeriodStart) return null;
    const days = Math.round(
      (parseISO(lastPeriodStart).getTime() -
        parseISO(prevPeriodStart).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    if (days < 18 || days > 60) return null;
    return days;
  }, [prevPeriodStart, lastPeriodStart]);

  const goNext = async () => {
    if (step === 'done') {
      // Persist everything and exit
      if (!cycleOnly) {
        const birthdate =
          birthYear && birthMonth && birthDay
            ? `${birthYear.padStart(4, '0')}-${birthMonth.padStart(2, '0')}-${birthDay.padStart(2, '0')}`
            : null;
        await updateProfile({
          name: name.trim(),
          birthdate,
          pinHash: pin && pin === pin2 ? hashPin(pin) : data.profile.pinHash,
        });
      }
      // Derive period length from range if provided
      let effectivePeriodLen = periodLen;
      if (lastPeriodStart && lastPeriodEnd) {
        const days =
          Math.round(
            (parseISO(lastPeriodEnd).getTime() -
              parseISO(lastPeriodStart).getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1;
        effectivePeriodLen = Math.min(10, Math.max(2, days));
      }
      const effectiveCycleLen = derivedCycleLen ?? cycleLen;
      await updateSettings({
        averagePeriodLength: effectivePeriodLen,
        averageCycleLength: effectiveCycleLen,
      });
      // Build the bleeding logs for both ranges in one batch so writes don't
      // overwrite each other.
      const bleedingLogs: { date: string; flow: 'medium' }[] = [];
      const expandRange = (start: string | null, end: string | null) => {
        if (!start) return;
        const s = parseISO(start);
        const e = end ? parseISO(end) : s;
        const days = Math.max(
          0,
          Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)),
        );
        for (let i = 0; i <= days; i += 1) {
          const d = new Date(s);
          d.setDate(d.getDate() + i);
          bleedingLogs.push({ date: format(d, 'yyyy-MM-dd'), flow: 'medium' });
        }
      };
      expandRange(prevPeriodStart, prevPeriodEnd);
      expandRange(lastPeriodStart, lastPeriodEnd);
      if (bleedingLogs.length > 0) {
        await upsertLogs(bleedingLogs);
      }
      await setOnboardingDone(true);
      onComplete();
      return;
    }
    if (step === 'pin' && pin.length > 0) {
      if (pin.length < 4) {
        setPinError(t('onboarding.pinTooShort'));
        return;
      }
      if (pin !== pin2) {
        setPinError(t('onboarding.pinMismatch'));
        return;
      }
    }
    setPinError(null);
    setStepIdx((i) => Math.min(steps.length - 1, i + 1));
  };

  // When user reaches cycleLength step, prefer the auto-derived value.
  React.useEffect(() => {
    if (step === 'cycleLength' && derivedCycleLen !== null) {
      setCycleLen(derivedCycleLen);
    }
  }, [step, derivedCycleLen]);

  const goBack = () => setStepIdx((i) => Math.max(0, i - 1));
  const skipPin = () => {
    setPin('');
    setPin2('');
    setPinError(null);
    setStepIdx((i) => Math.min(steps.length - 1, i + 1));
  };

  const canAdvance = (): boolean => {
    switch (step) {
      case 'name':
        return name.trim().length > 0;
      case 'lastPeriod':
        return Boolean(lastPeriodStart);
      case 'prevPeriod':
        return true; // optional
      case 'birthdate':
        // Birthdate is optional but if any field set, all must be set & valid
        if (!birthYear && !birthMonth && !birthDay) return true;
        return Boolean(
          birthYear &&
            birthMonth &&
            birthDay &&
            Number(birthYear) >= 1900 &&
            Number(birthYear) <= 2025 &&
            Number(birthMonth) >= 1 &&
            Number(birthMonth) <= 12 &&
            Number(birthDay) >= 1 &&
            Number(birthDay) <= 31,
        );
      case 'pin':
        return true; // pin is optional; if filled, validation runs in goNext
      default:
        return true;
    }
  };

  const renderProgress = () => {
    const progress = ((stepIdx + 1) / steps.length) * 100;
    return (
      <View style={styles.progressTrack}>
        <View style={[styles.progressBar, { width: `${progress}%` }]} />
      </View>
    );
  };

  const renderStep = () => {
    switch (step) {
      case 'welcome':
        return (
          <View style={styles.centered}>
            <Text style={styles.bigSerif}>{t('onboarding.welcomeTitle')}</Text>
            <Text style={styles.subtitle}>{t('onboarding.welcomeBody')}</Text>
          </View>
        );
      case 'name':
        return (
          <View>
            <Text style={styles.stepTitle}>{t('onboarding.nameTitle')}</Text>
            <Text style={styles.stepHint}>{t('onboarding.nameHint')}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={t('onboarding.namePlaceholder')}
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              autoCapitalize="words"
              autoFocus
            />
          </View>
        );
      case 'birthdate':
        return (
          <View>
            <Text style={styles.stepTitle}>{t('onboarding.birthdateTitle')}</Text>
            <Text style={styles.stepHint}>{t('onboarding.birthdateHint')}</Text>
            <BirthdateWheel
              colors={colors}
              day={birthDay}
              month={birthMonth}
              year={birthYear}
              onChange={(d, m, y) => {
                setBirthDay(d);
                setBirthMonth(m);
                setBirthYear(y);
              }}
            />
          </View>
        );
      case 'pin':
        return (
          <View>
            <Text style={styles.stepTitle}>{t('onboarding.pinTitle')}</Text>
            <Text style={styles.stepHint}>{t('onboarding.pinHint')}</Text>
            <TextInput
              value={pin}
              onChangeText={(v) => {
                setPin(v.replace(/\D/g, '').slice(0, 6));
                setPinError(null);
              }}
              placeholder="••••"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
            />
            <TextInput
              value={pin2}
              onChangeText={(v) => {
                setPin2(v.replace(/\D/g, '').slice(0, 6));
                setPinError(null);
              }}
              placeholder={t('onboarding.pinConfirm')}
              placeholderTextColor={colors.textMuted}
              style={[styles.input, { marginTop: 12 }]}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={6}
            />
            {pinError ? <Text style={styles.errorText}>{pinError}</Text> : null}
            <Pressable style={styles.skipBtn} onPress={skipPin}>
              <Text style={styles.skipBtnText}>{t('onboarding.skip')}</Text>
            </Pressable>
          </View>
        );
      case 'lastPeriod':
        return (
          <View>
            <Text style={styles.stepTitle}>
              {t('onboarding.lastPeriodTitle')}
            </Text>
            <Text style={styles.stepHint}>
              {t('onboarding.lastPeriodHint')}
            </Text>
            <RangeSummary
              colors={colors}
              fromLabel={t('onboarding.rangeFrom')}
              toLabel={t('onboarding.rangeTo')}
              durationLabel={t('onboarding.rangeDuration')}
              resetLabel={t('onboarding.rangeReset')}
              suffix={t('onboarding.daysSuffix')}
              start={lastPeriodStart}
              end={lastPeriodEnd}
              onReset={() => {
                setLastPeriodStart(null);
                setLastPeriodEnd(null);
              }}
            />
            <MiniCalendar
              colors={colors}
              monthOffset={monthOffset}
              onChangeMonthOffset={setMonthOffset}
              onPickToday={() => {
                const iso = format(new Date(), 'yyyy-MM-dd');
                setLastPeriodStart(iso);
                setLastPeriodEnd(null);
                setPeriodLen(1);
                setMonthOffset(0);
              }}
              rangeStart={lastPeriodStart}
              rangeEnd={lastPeriodEnd}
              onRangePick={(iso) => {
                if (!lastPeriodStart || (lastPeriodStart && lastPeriodEnd)) {
                  setLastPeriodStart(iso);
                  setLastPeriodEnd(null);
                  // Pre-set period length to 1 day until end is picked
                  setPeriodLen(1);
                  return;
                }
                // Picking the end
                if (parseISO(iso).getTime() < parseISO(lastPeriodStart).getTime()) {
                  // If user taps before start, treat tapped as new start
                  setLastPeriodStart(iso);
                  setLastPeriodEnd(null);
                  setPeriodLen(1);
                  return;
                }
                setLastPeriodEnd(iso);
                const days =
                  Math.round(
                    (parseISO(iso).getTime() -
                      parseISO(lastPeriodStart).getTime()) /
                      (1000 * 60 * 60 * 24),
                  ) + 1;
                setPeriodLen(Math.min(10, Math.max(2, days)));
              }}
            />
          </View>
        );
      case 'prevPeriod':
        return (
          <View>
            <Text style={styles.stepTitle}>
              {t('onboarding.prevPeriodTitle')}
            </Text>
            <Text style={styles.stepHint}>
              {t('onboarding.prevPeriodHint')}
            </Text>
            <RangeSummary
              colors={colors}
              fromLabel={t('onboarding.rangeFrom')}
              toLabel={t('onboarding.rangeTo')}
              durationLabel={t('onboarding.rangeDuration')}
              resetLabel={t('onboarding.rangeReset')}
              suffix={t('onboarding.daysSuffix')}
              start={prevPeriodStart}
              end={prevPeriodEnd}
              onReset={() => {
                setPrevPeriodStart(null);
                setPrevPeriodEnd(null);
              }}
            />
            <MiniCalendar
              colors={colors}
              monthOffset={prevMonthOffset}
              onChangeMonthOffset={setPrevMonthOffset}
              maxIso={lastPeriodStart ?? undefined}
              rangeStart={prevPeriodStart}
              rangeEnd={prevPeriodEnd}
              onRangePick={(iso) => {
                if (lastPeriodStart && iso >= lastPeriodStart) return;
                if (!prevPeriodStart || (prevPeriodStart && prevPeriodEnd)) {
                  setPrevPeriodStart(iso);
                  setPrevPeriodEnd(null);
                  return;
                }
                if (parseISO(iso).getTime() < parseISO(prevPeriodStart).getTime()) {
                  setPrevPeriodStart(iso);
                  setPrevPeriodEnd(null);
                  return;
                }
                setPrevPeriodEnd(iso);
              }}
            />
            {derivedCycleLen !== null ? (
              <Text style={styles.derivedNote}>
                {t('onboarding.derivedCycle', { n: derivedCycleLen })}
              </Text>
            ) : null}
          </View>
        );
      case 'cycleLength':
        return (
          <View>
            <Text style={styles.stepTitle}>
              {t('onboarding.cycleLengthTitle')}
            </Text>
            <Text style={styles.stepHint}>
              {derivedCycleLen !== null
                ? t('onboarding.cycleLengthDerivedHint', { n: derivedCycleLen })
                : t('onboarding.cycleLengthHint')}
            </Text>
            <Counter
              value={cycleLen}
              min={21}
              max={40}
              suffix={t('onboarding.daysSuffix')}
              colors={colors}
              onChange={setCycleLen}
            />
            <Text style={styles.tip}>{t('onboarding.cycleLengthTip')}</Text>
          </View>
        );
      case 'done':
        return (
          <View style={styles.centered}>
            <Text style={styles.bigSerif}>{t('onboarding.doneTitle')}</Text>
            <Text style={styles.subtitle}>
              {cycleOnly
                ? t('onboarding.doneBodyCycleOnly')
                : t('onboarding.doneBody', { name: name.trim() })}
            </Text>
          </View>
        );
      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {renderProgress()}
          <View style={styles.stepBox}>{renderStep()}</View>
        </ScrollView>

        <View style={styles.footer}>
          {stepIdx > 0 && step !== 'done' ? (
            <Pressable style={styles.backBtn} onPress={goBack}>
              <Text style={styles.backBtnText}>{t('onboarding.back')}</Text>
            </Pressable>
          ) : (
            <View style={{ flex: 1 }} />
          )}
          <Pressable
            style={[
              styles.nextBtn,
              !canAdvance() && { opacity: 0.4 },
            ]}
            onPress={goNext}
            disabled={!canAdvance()}
          >
            <Text style={styles.nextBtnText}>
              {step === 'done'
                ? t('onboarding.finish')
                : step === 'welcome'
                  ? t('onboarding.start')
                  : t('onboarding.next')}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Counter: React.FC<{
  value: number;
  min: number;
  max: number;
  suffix: string;
  colors: ThemeColors;
  onChange: (n: number) => void;
}> = ({ value, min, max, suffix, colors, onChange }) => {
  const styles = makeStyles(colors);
  const dec = () => onChange(Math.max(min, value - 1));
  const inc = () => onChange(Math.min(max, value + 1));
  return (
    <View style={styles.counterRow}>
      <Pressable style={styles.counterBtn} onPress={dec}>
        <Text style={styles.counterBtnText}>−</Text>
      </Pressable>
      <View style={styles.counterValueBox}>
        <Text style={styles.counterValue}>{value}</Text>
        <Text style={styles.counterSuffix}>{suffix}</Text>
      </View>
      <Pressable style={styles.counterBtn} onPress={inc}>
        <Text style={styles.counterBtnText}>+</Text>
      </Pressable>
    </View>
  );
};

const buildMonthGrid = (anchor: Date): (Date | null)[] => {
  const start = startOfMonth(anchor);
  const end = endOfMonth(anchor);
  const startDow = (start.getDay() + 6) % 7;
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i += 1) cells.push(null);
  for (let d = 1; d <= end.getDate(); d += 1) {
    cells.push(new Date(start.getFullYear(), start.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
};

interface MiniCalendarProps {
  colors: ThemeColors;
  monthOffset: number;
  onChangeMonthOffset: (n: number) => void;
  selected?: string | null;
  onSelect?: (iso: string) => void;
  onPickToday?: () => void;
  rangeStart?: string | null;
  rangeEnd?: string | null;
  onRangePick?: (iso: string) => void;
  /** Disable any date on or after this ISO date. */
  maxIso?: string;
}

const MiniCalendar: React.FC<MiniCalendarProps> = ({
  colors,
  monthOffset,
  onChangeMonthOffset,
  selected,
  onSelect,
  onPickToday,
  rangeStart,
  rangeEnd,
  onRangePick,
  maxIso,
}) => {
  const { t } = useApp();
  const todayLabel = t('onboarding.pickToday');
  const styles = makeStyles(colors);
  const today = new Date();
  const months = tArray('months');
  const weekdays = tArray('weekdays');
  const selectedDate = selected ? parseISO(selected) : null;
  const rangeStartDate = rangeStart ? parseISO(rangeStart) : null;
  const rangeEndDate = rangeEnd ? parseISO(rangeEnd) : null;
  const isRangeMode = Boolean(onRangePick);
  const sameDay = (a: Date, b: Date) =>
    a.getDate() === b.getDate() &&
    a.getMonth() === b.getMonth() &&
    a.getFullYear() === b.getFullYear();

  // Render two months at once: the previous month (so cross-month ranges like
  // "28 April → 2 May" can be picked without using the « ‹ › » navigation)
  // and the currently selected month underneath. The chevrons still let the
  // user shift the window further back if they need an older period.
  const renderMonth = (offset: number) => {
    const anchor = addMonths(today, offset);
    const cells = buildMonthGrid(anchor);
    const monthLabel = `${months[anchor.getMonth()] ?? ''} ${anchor.getFullYear()}`;
    return (
      <View key={`m${offset}`} style={styles.calMonthBox}>
        <Text style={styles.calMonth}>{monthLabel}</Text>
        <View style={styles.calWeekRow}>
          {weekdays.map((w) => (
            <Text key={w} style={styles.calWeek}>
              {w}
            </Text>
          ))}
        </View>
        <View style={styles.calGrid}>
          {cells.map((d, i) => {
            if (!d) return <View key={`e${offset}-${i}`} style={styles.calCellEmpty} />;
            const iso = format(d, 'yyyy-MM-dd');
            const isFuture =
              isAfter(d, today) ||
              (maxIso ? iso >= maxIso : false);
            const isSingleSelected =
              !isRangeMode && selectedDate && sameDay(d, selectedDate);
            const isRangeStart =
              isRangeMode && rangeStartDate && sameDay(d, rangeStartDate);
            const isRangeEnd =
              isRangeMode && rangeEndDate && sameDay(d, rangeEndDate);
            const isInRange =
              isRangeMode &&
              rangeStartDate &&
              rangeEndDate &&
              d.getTime() > rangeStartDate.getTime() &&
              d.getTime() < rangeEndDate.getTime();
            const isSelected = isSingleSelected || isRangeStart || isRangeEnd;
            const onPress = () => {
              if (isRangeMode) onRangePick?.(iso);
              else onSelect?.(iso);
            };
            return (
              <Pressable
                key={iso}
                disabled={isFuture}
                onPress={onPress}
                style={[
                  styles.calCell,
                  isInRange && {
                    backgroundColor: colors.fertile,
                    borderColor: colors.fertile,
                  },
                  isSelected && {
                    backgroundColor: colors.period,
                    borderColor: colors.period,
                  },
                  isFuture && { opacity: 0.25 },
                ]}
              >
                <Text
                  style={[
                    styles.calCellText,
                    isInRange && { color: colors.text, fontWeight: '600' },
                    isSelected && { color: colors.primaryText, fontWeight: '700' },
                  ]}
                >
                  {d.getDate()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.calBox}>
      <View style={styles.calHeader}>
        <Pressable
          style={styles.calNav}
          onPress={() => onChangeMonthOffset(monthOffset - 12)}
        >
          <Text style={styles.calNavText}>«</Text>
        </Pressable>
        <Pressable
          style={styles.calNav}
          onPress={() => onChangeMonthOffset(monthOffset - 1)}
        >
          <Text style={styles.calNavText}>‹</Text>
        </Pressable>
        <Text style={styles.calNavSpan}>
          {`${months[addMonths(today, monthOffset - 1).getMonth()] ?? ''} — ${months[addMonths(today, monthOffset).getMonth()] ?? ''} ${addMonths(today, monthOffset).getFullYear()}`}
        </Text>
        <Pressable
          style={styles.calNav}
          onPress={() => {
            if (monthOffset < 0) onChangeMonthOffset(monthOffset + 1);
          }}
        >
          <Text style={[styles.calNavText, monthOffset >= 0 && { opacity: 0.3 }]}>›</Text>
        </Pressable>
        <Pressable
          style={styles.calNav}
          onPress={() => {
            const next = Math.min(0, monthOffset + 12);
            onChangeMonthOffset(next);
          }}
        >
          <Text style={[styles.calNavText, monthOffset >= 0 && { opacity: 0.3 }]}>»</Text>
        </Pressable>
      </View>
      {renderMonth(monthOffset - 1)}
      {renderMonth(monthOffset)}
      {onPickToday ? (
        <Pressable style={styles.todayBtn} onPress={onPickToday}>
          <Text style={styles.todayBtnText}>{todayLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
};

const RangeSummary: React.FC<{
  colors: ThemeColors;
  fromLabel: string;
  toLabel: string;
  durationLabel: string;
  resetLabel: string;
  suffix: string;
  start: string | null;
  end: string | null;
  onReset: () => void;
}> = ({
  colors,
  fromLabel,
  toLabel,
  durationLabel,
  resetLabel,
  suffix,
  start,
  end,
  onReset,
}) => {
  const styles = makeStyles(colors);
  const months = tArray('monthsGenitive');
  const fmt = (iso: string | null) => {
    if (!iso) return '—';
    const d = parseISO(iso);
    return `${d.getDate()} ${months[d.getMonth()] ?? ''}`;
  };
  const days =
    start && end
      ? Math.max(
          1,
          Math.round(
            (parseISO(end).getTime() - parseISO(start).getTime()) /
              (1000 * 60 * 60 * 24),
          ) + 1,
        )
      : start
        ? 1
        : 0;
  return (
    <View style={styles.rangeBox}>
      <View style={styles.rangeRow}>
        <View style={styles.rangeCell}>
          <Text style={styles.rangeCellLabel}>{fromLabel}</Text>
          <Text style={styles.rangeCellValue}>{fmt(start)}</Text>
        </View>
        <View style={styles.rangeArrow}>
          <Text style={styles.rangeArrowText}>→</Text>
        </View>
        <View style={styles.rangeCell}>
          <Text style={styles.rangeCellLabel}>{toLabel}</Text>
          <Text style={styles.rangeCellValue}>{fmt(end)}</Text>
        </View>
      </View>
      {days > 0 ? (
        <View style={styles.rangeFooter}>
          <Text style={styles.rangeDuration}>
            {durationLabel}: {days} {suffix}
          </Text>
          {start ? (
            <Pressable onPress={onReset}>
              <Text style={styles.rangeReset}>{resetLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );
};

const BirthdateWheel: React.FC<{
  colors: ThemeColors;
  day: string;
  month: string;
  year: string;
  onChange: (day: string, month: string, year: string) => void;
}> = ({ colors, day, month, year, onChange }) => {
  const { t } = useApp();
  const styles = makeStyles(colors);
  const months = tArray('months');
  const today = new Date();
  const dn = Number(day) || 1;
  const mn = Number(month) || 1;
  const yn = Number(year) || today.getFullYear() - 25;
  const daysInMonth = new Date(yn, mn, 0).getDate();
  const clampDay = (n: number) => String(Math.min(daysInMonth, Math.max(1, n))).padStart(2, '0');
  const setD = (n: number) => onChange(clampDay(n), String(mn).padStart(2, '0'), String(yn));
  const setM = (n: number) => {
    const newMonth = ((n - 1 + 12) % 12) + 1;
    const newDays = new Date(yn, newMonth, 0).getDate();
    const newDay = Math.min(dn, newDays);
    onChange(String(newDay).padStart(2, '0'), String(newMonth).padStart(2, '0'), String(yn));
  };
  const setY = (n: number) => {
    const minY = 1925;
    const maxY = today.getFullYear();
    const ny = Math.min(maxY, Math.max(minY, n));
    const newDays = new Date(ny, mn, 0).getDate();
    const newDay = Math.min(dn, newDays);
    onChange(String(newDay).padStart(2, '0'), String(mn).padStart(2, '0'), String(ny));
  };
  return (
    <View style={styles.wheelRow}>
      <WheelColumn
        label={t('onboarding.birthdateDay')}
        value={day ? String(dn) : '—'}
        onMinus={() => setD(dn - 1)}
        onPlus={() => setD(dn + 1)}
        colors={colors}
        flex={1}
      />
      <WheelColumn
        label={t('onboarding.birthdateMonth')}
        value={month ? months[mn - 1] ?? String(mn) : '—'}
        onMinus={() => setM(mn - 1)}
        onPlus={() => setM(mn + 1)}
        colors={colors}
        flex={1.4}
      />
      <WheelColumn
        label={t('onboarding.birthdateYear')}
        value={year ? String(yn) : '—'}
        onMinus={() => setY(yn - 1)}
        onPlus={() => setY(yn + 1)}
        colors={colors}
        flex={1.2}
      />
    </View>
  );
};

const WheelColumn: React.FC<{
  label: string;
  value: string;
  onMinus: () => void;
  onPlus: () => void;
  colors: ThemeColors;
  flex: number;
}> = ({ label, value, onMinus, onPlus, colors, flex }) => {
  const styles = makeStyles(colors);
  return (
    <View style={[styles.wheelCol, { flex }]}>
      <Pressable style={styles.wheelArrow} onPress={onPlus}>
        <Text style={styles.wheelArrowText}>⌄</Text>
      </Pressable>
      <View style={styles.wheelValueBox}>
        <Text style={styles.wheelValue} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.wheelLabel}>{label}</Text>
      </View>
      <Pressable style={styles.wheelArrow} onPress={onMinus}>
        <Text style={styles.wheelArrowText}>⌃</Text>
      </Pressable>
    </View>
  );
};

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    flex: { flex: 1 },
    scrollContent: {
      padding: 24,
      paddingBottom: 40,
      flexGrow: 1,
    },
    progressTrack: {
      height: 4,
      backgroundColor: colors.ringTrack,
      borderRadius: 999,
      overflow: 'hidden',
      marginBottom: 32,
    },
    progressBar: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: 999,
    },
    stepBox: { flex: 1 },
    centered: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingTop: 40,
    },
    bigSerif: {
      fontSize: 40,
      lineHeight: 46,
      color: colors.text,
      fontFamily: SERIF,
      textAlign: 'center',
    },
    subtitle: {
      marginTop: 16,
      fontSize: 16,
      lineHeight: 24,
      color: colors.textMuted,
      textAlign: 'center',
      maxWidth: 320,
    },
    stepTitle: {
      fontSize: 28,
      fontFamily: SERIF,
      color: colors.text,
      marginBottom: 8,
    },
    stepHint: {
      fontSize: 15,
      lineHeight: 22,
      color: colors.textMuted,
      marginBottom: 24,
    },
    input: {
      backgroundColor: colors.card,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontSize: 18,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    dateRow: { flexDirection: 'row', gap: 8 },
    dateInput: { flex: 1, textAlign: 'center' },
    dateInputYear: { flex: 1.4, textAlign: 'center' },
    errorText: {
      color: colors.danger,
      marginTop: 8,
      fontSize: 14,
    },
    skipBtn: { marginTop: 16, alignSelf: 'flex-start', padding: 8 },
    skipBtnText: { color: colors.textMuted, fontSize: 14, textDecorationLine: 'underline' },
    counterRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 24,
    },
    counterBtn: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    counterBtnText: { fontSize: 28, color: colors.primary, fontWeight: '600' },
    counterValueBox: {
      flex: 1,
      alignItems: 'center',
    },
    counterValue: {
      fontSize: 56,
      fontFamily: SERIF,
      color: colors.text,
      lineHeight: 64,
    },
    counterSuffix: {
      fontSize: 14,
      color: colors.textMuted,
      marginTop: 4,
    },
    tip: {
      marginTop: 24,
      fontSize: 13,
      color: colors.textMuted,
      lineHeight: 19,
      backgroundColor: colors.surface,
      padding: 12,
      borderRadius: 12,
    },
    footer: {
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 24,
      paddingBottom: 16,
      paddingTop: 8,
    },
    backBtn: {
      flex: 1,
      paddingVertical: 16,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      backgroundColor: colors.card,
    },
    backBtnText: { color: colors.text, fontSize: 16, fontWeight: '500' },
    nextBtn: {
      flex: 2,
      paddingVertical: 16,
      borderRadius: 14,
      backgroundColor: colors.primary,
      alignItems: 'center',
    },
    nextBtnText: { color: colors.primaryText, fontSize: 16, fontWeight: '700' },
    calBox: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    calHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    calNav: { padding: 8 },
    calNavText: { fontSize: 24, color: colors.text },
    calNavSpan: {
      flex: 1,
      textAlign: 'center',
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    calMonthBox: { marginBottom: 12 },
    calMonth: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    calWeekRow: { flexDirection: 'row', marginBottom: 4 },
    calWeek: {
      flex: 1,
      textAlign: 'center',
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    calGrid: { flexDirection: 'row', flexWrap: 'wrap' },
    calCellEmpty: { width: `${100 / 7}%`, aspectRatio: 1 },
    calCell: {
      width: `${100 / 7}%`,
      aspectRatio: 1,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 999,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    calCellText: { color: colors.text, fontSize: 14 },
    todayBtn: {
      alignSelf: 'center',
      marginTop: 12,
      paddingVertical: 8,
      paddingHorizontal: 18,
      borderRadius: 999,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    todayBtnText: {
      color: colors.primary,
      fontWeight: '600',
      fontSize: 13,
      letterSpacing: 0.5,
    },
    wheelRow: {
      flexDirection: 'row',
      gap: 10,
      marginTop: 4,
    },
    wheelCol: {
      backgroundColor: colors.card,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 8,
      alignItems: 'center',
    },
    wheelArrow: {
      paddingVertical: 4,
      paddingHorizontal: 12,
    },
    wheelArrowText: {
      fontSize: 22,
      color: colors.primary,
      lineHeight: 22,
    },
    wheelValueBox: {
      alignItems: 'center',
      paddingVertical: 6,
    },
    wheelValue: {
      fontFamily: SERIF,
      fontSize: 26,
      color: colors.text,
      lineHeight: 30,
    },
    wheelLabel: {
      fontSize: 11,
      color: colors.textMuted,
      marginTop: 2,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    rangeBox: {
      backgroundColor: colors.surface,
      borderRadius: 14,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    rangeRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    rangeCell: {
      flex: 1,
      alignItems: 'center',
    },
    rangeCellLabel: {
      fontSize: 11,
      color: colors.textMuted,
      letterSpacing: 0.5,
      textTransform: 'uppercase',
      marginBottom: 4,
    },
    rangeCellValue: {
      fontSize: 18,
      color: colors.text,
      fontFamily: SERIF,
    },
    rangeArrow: {
      paddingHorizontal: 8,
    },
    rangeArrowText: {
      color: colors.primary,
      fontSize: 18,
    },
    rangeFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    rangeDuration: {
      fontSize: 13,
      color: colors.textMuted,
    },
    rangeReset: {
      fontSize: 13,
      color: colors.primary,
      fontWeight: '600',
    },
    derivedNote: {
      marginTop: 12,
      fontSize: 13,
      color: colors.primary,
      textAlign: 'center',
      fontWeight: '600',
    },
  });
