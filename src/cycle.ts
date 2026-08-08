import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';
import { DayLog, Settings } from './types';

export const fmt = (d: Date): string => format(d, 'yyyy-MM-dd');

const isBleeding = (log: DayLog | undefined): boolean => {
  if (!log || !log.flow) return false;
  return log.flow !== 'none';
};

/**
 * Identifies cycle starts (first day of bleeding after at least one non-bleeding
 * day or no log). Returns ISO date strings sorted ascending.
 */
export const findPeriodStarts = (logs: Record<string, DayLog>): string[] => {
  const dates = Object.keys(logs)
    .filter((d) => isBleeding(logs[d]))
    .sort();
  if (dates.length === 0) return [];

  const starts: string[] = [];
  for (const d of dates) {
    const prev = fmt(addDays(parseISO(d), -1));
    if (!isBleeding(logs[prev])) {
      starts.push(d);
    }
  }
  return starts;
};

/**
 * Identifies contiguous bleeding episodes as ``{start, end}`` ISO pairs.
 * ``end`` is the last consecutive bleeding day (inclusive). Used by the
 * Sync-with-Telegram flow so the bot/admin can see actual cycle history
 * (e.g. ``3-8 апр``, ``30 апр - 4 мая``) instead of just averages.
 */
export const findPeriodEpisodes = (
  logs: Record<string, DayLog>,
): { start: string; end: string }[] => {
  const dates = Object.keys(logs)
    .filter((d) => isBleeding(logs[d]))
    .sort();
  if (dates.length === 0) return [];
  const episodes: { start: string; end: string }[] = [];
  let curStart = dates[0];
  let curEnd = dates[0];
  for (let i = 1; i < dates.length; i++) {
    const prev = curEnd;
    const next = dates[i];
    const expected = fmt(addDays(parseISO(prev), 1));
    if (next === expected) {
      curEnd = next;
    } else {
      episodes.push({ start: curStart, end: curEnd });
      curStart = next;
      curEnd = next;
    }
  }
  episodes.push({ start: curStart, end: curEnd });
  return episodes;
};

export interface CycleStats {
  cycleLengths: number[];
  averageCycleLength: number | null;
  shortestCycle: number | null;
  longestCycle: number | null;
  periodStarts: string[];
  averagePeriodLength: number | null;
  /** True if the spread between the last 3 cycle lengths is > 7 days. */
  irregular: boolean;
  /** How many recent finished cycles were used to compute the average. */
  recentCyclesUsed: number;
}

export const computeCycleStats = (
  logs: Record<string, DayLog>,
  settings: Settings,
): CycleStats => {
  const periodStarts = findPeriodStarts(logs);
  const cycleLengths: number[] = [];
  for (let i = 1; i < periodStarts.length; i++) {
    const len = differenceInCalendarDays(
      parseISO(periodStarts[i]),
      parseISO(periodStarts[i - 1]),
    );
    if (len >= 15 && len <= 60) cycleLengths.push(len);
  }

  // Use only the **last 3–6 finished cycles** for the rolling average so the
  // prediction stays responsive to recent shifts. Fewer than 3 finished
  // cycles → fall back to the manual setting in `computePredictions`.
  const recent = cycleLengths.slice(-6);
  const avg =
    recent.length >= 3
      ? Math.round(recent.reduce((a, b) => a + b, 0) / recent.length)
      : null;

  // Irregular flag: spread between the last 3 cycles > 7 days.
  let irregular = false;
  if (recent.length >= 3) {
    const last3 = recent.slice(-3);
    const spread = Math.max(...last3) - Math.min(...last3);
    irregular = spread > 7;
  }

  // Compute average period length by counting consecutive bleeding days
  // starting from each detected period start. Skip the still-in-progress
  // episode (the last bleeding day is today): its length is incomplete and
  // would otherwise drag the rolling average way down — e.g. if the user
  // just tapped "Yes, period started today", that single day would weigh
  // 1 against history and the predicted period length collapses to ~2,
  // hiding most of the forecast for the rest of the current cycle.
  const today = new Date();
  const periodLengths: number[] = [];
  for (const start of periodStarts) {
    let len = 0;
    let cursor = parseISO(start);
    while (isBleeding(logs[fmt(cursor)])) {
      len++;
      cursor = addDays(cursor, 1);
      if (len > 14) break; // safety
    }
    // After the loop, `cursor` points at the first non-bleeding day. If
    // that day is in the future relative to today, the episode might still
    // continue (today is bleeding, tomorrow is unknown) — treat as
    // in-progress and exclude.
    const inProgress = differenceInCalendarDays(cursor, today) > 0;
    if (len > 0 && !inProgress) periodLengths.push(len);
  }
  const avgPeriod =
    periodLengths.length > 0
      ? Math.round(periodLengths.reduce((a, b) => a + b, 0) / periodLengths.length)
      : null;

  return {
    cycleLengths,
    averageCycleLength: avg,
    shortestCycle: cycleLengths.length ? Math.min(...cycleLengths) : null,
    longestCycle: cycleLengths.length ? Math.max(...cycleLengths) : null,
    periodStarts,
    averagePeriodLength: avgPeriod,
    irregular,
    recentCyclesUsed: recent.length,
  };
};

export interface CyclePredictions {
  lastPeriodStart: string | null;
  nextPeriodStart: string | null;
  nextPeriodEnd: string | null;
  ovulation: string | null;
  fertileStart: string | null;
  fertileEnd: string | null;
  cycleDay: number | null; // 1-based day of current cycle
  daysUntilNextPeriod: number | null;
  effectiveCycleLength: number;
  effectivePeriodLength: number;
  /** True when the last 3 finished cycles spread > 7 days. */
  irregular: boolean;
  /** Did the average come from logs (>=3 cycles) or from settings fallback? */
  averageSource: 'logs' | 'settings';
}

export const computePredictions = (
  logs: Record<string, DayLog>,
  settings: Settings,
  today: Date = new Date(),
): CyclePredictions => {
  const stats = computeCycleStats(logs, settings);
  const cycleLen = stats.averageCycleLength ?? settings.averageCycleLength;
  const periodLen = stats.averagePeriodLength ?? settings.averagePeriodLength;
  const averageSource: 'logs' | 'settings' =
    stats.averageCycleLength !== null ? 'logs' : 'settings';

  const lastStart = stats.periodStarts.length
    ? stats.periodStarts[stats.periodStarts.length - 1]
    : null;

  if (!lastStart) {
    return {
      lastPeriodStart: null,
      nextPeriodStart: null,
      nextPeriodEnd: null,
      ovulation: null,
      fertileStart: null,
      fertileEnd: null,
      cycleDay: null,
      daysUntilNextPeriod: null,
      effectiveCycleLength: cycleLen,
      effectivePeriodLength: periodLen,
      irregular: stats.irregular,
      averageSource,
    };
  }

  // Roll the predicted next-period start forward until it's in the future
  // relative to today, so predictions stay meaningful even if the user hasn't
  // logged the latest period yet.
  let nextStart = addDays(parseISO(lastStart), cycleLen);
  while (differenceInCalendarDays(nextStart, today) < 0) {
    nextStart = addDays(nextStart, cycleLen);
  }
  const nextEnd = addDays(nextStart, Math.max(0, periodLen - 1));
  const ovulation = addDays(nextStart, -settings.lutealPhaseLength);
  const fertileStart = addDays(ovulation, -5);
  const fertileEnd = addDays(ovulation, 1);

  const cycleDay = differenceInCalendarDays(today, parseISO(lastStart)) + 1;
  const daysUntil = differenceInCalendarDays(nextStart, today);

  return {
    lastPeriodStart: lastStart,
    nextPeriodStart: fmt(nextStart),
    nextPeriodEnd: fmt(nextEnd),
    ovulation: fmt(ovulation),
    fertileStart: fmt(fertileStart),
    fertileEnd: fmt(fertileEnd),
    cycleDay: cycleDay > 0 ? cycleDay : null,
    daysUntilNextPeriod: daysUntil,
    effectiveCycleLength: cycleLen,
    effectivePeriodLength: periodLen,
    irregular: stats.irregular,
    averageSource,
  };
};

export type DayMarker =
  | 'period'
  | 'predictedPeriod'
  | 'ovulation'
  | 'fertile'
  | 'logged'
  | 'today';

export const buildDayMarkers = (
  logs: Record<string, DayLog>,
  predictions: CyclePredictions,
  settings: Settings,
  today: Date = new Date(),
): Record<string, DayMarker[]> => {
  const markers: Record<string, DayMarker[]> = {};
  const add = (date: string, m: DayMarker) => {
    if (!markers[date]) markers[date] = [];
    if (!markers[date].includes(m)) markers[date].push(m);
  };

  for (const [date, log] of Object.entries(logs)) {
    if (isBleeding(log)) add(date, 'period');
    else if (
      log.symptoms?.length ||
      log.moods?.length ||
      log.temperature !== undefined ||
      log.notes ||
      log.intimacy
    ) {
      add(date, 'logged');
    }
  }

  // Project the cycle forward for ~12 months so users can see future
  // predicted periods, ovulations, and fertile windows on the calendar
  // far ahead — useful for planning travel, conception, etc.
  if (predictions.nextPeriodStart) {
    const cycleLen = predictions.effectiveCycleLength;
    const periodLen = predictions.effectivePeriodLength;
    const luteal = settings.lutealPhaseLength;
    const horizonDays = 365;

    // Project predicted period + fertile window for one cycle starting at
    // `cycleStart`. Days the user already logged as bleeding stay as "period"
    // (logged data wins over the prediction). Predicted bleeding days that
    // have *already passed* get filled as "period" too — the cycle math says
    // bleeding was expected on those days and the user hasn't logged
    // otherwise, so showing them as a forecast ring would mis-state the past.
    // Today and future predicted days remain as a forecast ring.
    const projectCycle = (cycleStart: Date) => {
      for (let i = 0; i < periodLen; i++) {
        const day = addDays(cycleStart, i);
        const d = fmt(day);
        if (isBleeding(logs[d])) continue;
        const isPast = differenceInCalendarDays(day, today) < 0;
        add(d, isPast ? 'period' : 'predictedPeriod');
      }
      if (settings.showFertileWindow) {
        const ovDate = addDays(cycleStart, -luteal);
        const fertileStart = addDays(ovDate, -5);
        const fertileEnd = addDays(ovDate, 1);
        let fc = fertileStart;
        while (differenceInCalendarDays(fc, fertileEnd) <= 0) {
          add(fmt(fc), 'fertile');
          fc = addDays(fc, 1);
        }
        add(fmt(ovDate), 'ovulation');
      }
    };

    // `computePredictions` rolls `nextPeriodStart` forward until it lands in
    // the future relative to today. That hides any cycle that *should* have
    // started recently — e.g. a user whose period is a few days late ends up
    // with no May forecast on the calendar at all, even though May 1–5 was
    // predicted to be bleeding. Project that "missed" / current cycle too so
    // the days that were predicted but haven't been logged still show as a
    // forecast (coral ring), and the cycle's fertile/ovulation window is
    // plotted. We include the case where `prevStart === lastLogged` — that
    // happens when the user just logged today as the start of their current
    // cycle; the rest of the predicted bleeding days for that cycle still
    // need to be plotted as forecast.
    const next = parseISO(predictions.nextPeriodStart);
    const lastLogged = predictions.lastPeriodStart
      ? parseISO(predictions.lastPeriodStart)
      : null;
    const prevStart = addDays(next, -cycleLen);
    if (
      lastLogged &&
      differenceInCalendarDays(prevStart, lastLogged) >= 0
    ) {
      projectCycle(prevStart);
    }

    let startCursor = next;
    while (differenceInCalendarDays(startCursor, today) <= horizonDays) {
      projectCycle(startCursor);
      startCursor = addDays(startCursor, cycleLen);
    }
  }

  add(fmt(today), 'today');
  return markers;
};

const isBleedingExport = isBleeding;
export { isBleedingExport as isBleeding };

export type CyclePhase =
  | 'period'
  | 'follicular'
  | 'fertile'
  | 'ovulation'
  | 'luteal'
  | 'unknown';

export interface PhaseSegment {
  phase: CyclePhase;
  /** 1-based day-of-cycle (inclusive). */
  startDay: number;
  /** 1-based day-of-cycle (inclusive). */
  endDay: number;
}

export const buildPhaseSegments = (
  cycleLen: number,
  periodLen: number,
  lutealPhaseLength: number,
): PhaseSegment[] => {
  const safeCycle = Math.max(15, cycleLen);
  const safePeriod = Math.max(1, Math.min(periodLen, safeCycle - 4));
  const safeLuteal = Math.max(9, Math.min(lutealPhaseLength, safeCycle - safePeriod - 2));

  const ovulationDay = safeCycle - safeLuteal;
  const fertileStartDay = Math.max(safePeriod + 1, ovulationDay - 5);
  const fertileEndDay = Math.min(safeCycle, ovulationDay + 1);

  const segments: PhaseSegment[] = [];
  segments.push({ phase: 'period', startDay: 1, endDay: safePeriod });
  if (fertileStartDay > safePeriod + 1) {
    segments.push({
      phase: 'follicular',
      startDay: safePeriod + 1,
      endDay: fertileStartDay - 1,
    });
  }
  if (ovulationDay > fertileStartDay) {
    segments.push({
      phase: 'fertile',
      startDay: fertileStartDay,
      endDay: ovulationDay - 1,
    });
  }
  segments.push({ phase: 'ovulation', startDay: ovulationDay, endDay: ovulationDay });
  if (fertileEndDay > ovulationDay) {
    segments.push({
      phase: 'fertile',
      startDay: ovulationDay + 1,
      endDay: fertileEndDay,
    });
  }
  if (safeCycle > fertileEndDay) {
    segments.push({
      phase: 'luteal',
      startDay: fertileEndDay + 1,
      endDay: safeCycle,
    });
  }
  return segments;
};

export const phaseForCycleDay = (
  cycleDay: number,
  segments: PhaseSegment[],
): CyclePhase => {
  for (const s of segments) {
    if (cycleDay >= s.startDay && cycleDay <= s.endDay) return s.phase;
  }
  return 'unknown';
};

export interface FertileWindowInfo {
  total: number;
  remaining: number;
  isInside: boolean;
}

export const fertileWindowInfo = (
  cycleDay: number | null,
  segments: PhaseSegment[],
): FertileWindowInfo => {
  let start: number | null = null;
  let end: number | null = null;
  for (const s of segments) {
    if (s.phase === 'fertile' || s.phase === 'ovulation') {
      if (start === null || s.startDay < start) start = s.startDay;
      if (end === null || s.endDay > end) end = s.endDay;
    }
  }
  if (start === null || end === null) {
    return { total: 0, remaining: 0, isInside: false };
  }
  const total = end - start + 1;
  if (cycleDay === null) return { total, remaining: total, isInside: false };
  if (cycleDay < start) return { total, remaining: total, isInside: false };
  if (cycleDay > end) return { total, remaining: 0, isInside: false };
  return { total, remaining: end - cycleDay + 1, isInside: true };
};

export interface CycleHistoryEntry {
  /** ISO date of the first bleeding day. */
  start: string;
  /** ISO date of the last day of the cycle (start of next cycle - 1), or null
   *  for the still-running cycle. */
  end: string | null;
  /** Cycle length in days, or null if it's the current cycle. */
  cycleLength: number | null;
  /** Period length in days (consecutive bleeding days from start). */
  periodLength: number;
  /** All logs that fall inside this cycle, sorted by date. */
  logs: DayLog[];
}

export const computeCycleHistory = (
  logs: Record<string, DayLog>,
): CycleHistoryEntry[] => {
  const starts = findPeriodStarts(logs);
  if (starts.length === 0) return [];
  const entries: CycleHistoryEntry[] = [];
  for (let i = 0; i < starts.length; i++) {
    const start = starts[i];
    const nextStart = i < starts.length - 1 ? starts[i + 1] : null;
    const end =
      nextStart !== null ? fmt(addDays(parseISO(nextStart), -1)) : null;
    const cycleLength =
      nextStart !== null
        ? differenceInCalendarDays(parseISO(nextStart), parseISO(start))
        : null;

    let periodLength = 0;
    let cursor = parseISO(start);
    while (isBleeding(logs[fmt(cursor)])) {
      periodLength++;
      cursor = addDays(cursor, 1);
      if (periodLength > 14) break;
    }

    const cycleLogPairs: Array<{ date: string; log: DayLog }> = [];
    const cycleEndIso = end ?? fmt(new Date());
    for (const [date, log] of Object.entries(logs)) {
      if (date >= start && date <= cycleEndIso) {
        cycleLogPairs.push({ date, log });
      }
    }
    cycleLogPairs.sort((a, b) => a.date.localeCompare(b.date));
    const cycleLogs: DayLog[] = cycleLogPairs.map((p) => p.log);

    entries.push({ start, end, cycleLength, periodLength, logs: cycleLogs });
  }
  return entries;
};

export interface SymptomCount {
  key: string;
  count: number;
}

export const countSymptoms = (
  logs: Record<string, DayLog>,
): SymptomCount[] => {
  const counts: Record<string, number> = {};
  for (const log of Object.values(logs)) {
    for (const s of log.symptoms ?? []) counts[s] = (counts[s] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count);
};
