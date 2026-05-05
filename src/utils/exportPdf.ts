/**
 * PDF export for cycle data. Builds a styled HTML report and asks the
 * platform's print engine to render & share it as a PDF.
 *
 * - On native (iOS / Android) we use `expo-print` to render a real PDF
 *   file, then `expo-sharing` to open the system share sheet.
 * - On web `expo-print` falls back to `window.print()` — we just open a
 *   new tab with the report and let the browser save it as PDF.
 */
import { Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { parseISO } from 'date-fns';
import {
  CycleHistoryEntry,
  CyclePredictions,
  CycleStats,
  SymptomCount,
  computeCycleHistory,
  computeCycleStats,
  computePredictions,
  countSymptoms,
} from '../cycle';
import { AppData, DayLog, Profile, Settings } from '../types';

export type ExportKind = 'analytics' | 'history' | 'full';

const COLORS = {
  ink: '#5C4633',
  muted: '#9A8266',
  accent: '#C99275',
  bg: '#FCEAD3',
  card: '#FFF5E8',
  border: '#EFCDA8',
  period: '#E07083',
  ovulation: '#F4B5D2',
};

const SYMPTOM_LABELS: Record<string, string> = {
  cramps: 'Спазмы',
  headache: 'Голова',
  backache: 'Спина',
  bloating: 'Вздутие',
  breastTenderness: 'Грудь',
  acne: 'Кожа',
  fatigue: 'Усталость',
  nausea: 'Тошнота',
  cravings: 'Тяга к еде',
  insomnia: 'Бессонница',
};

const MOOD_LABELS: Record<string, string> = {
  happy: 'радость',
  calm: 'спокойствие',
  sad: 'грусть',
  anxious: 'тревога',
  irritable: 'раздражение',
  energetic: 'энергия',
  tired: 'усталость',
  sensitive: 'чувствительность',
};

const FLOW_LABELS: Record<string, string> = {
  none: '—',
  spotting: 'мазня',
  light: 'лёгкие',
  medium: 'средние',
  heavy: 'обильные',
};

const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const fmtDate = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  try {
    const d = parseISO(iso);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const fmtDateLong = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  try {
    const d = parseISO(iso);
    return d.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
};

const fmtNow = (): string =>
  new Date().toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const baseStyles = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Helvetica Neue", Arial, sans-serif;
         color: ${COLORS.ink}; background: ${COLORS.bg};
         margin: 0; padding: 32px 36px; font-size: 12px; line-height: 1.5; }
  h1 { font-size: 26px; margin: 0 0 4px; color: ${COLORS.ink}; font-weight: 600; }
  h2 { font-size: 16px; margin: 28px 0 10px; color: ${COLORS.accent};
       letter-spacing: 0.5px; text-transform: uppercase; font-weight: 700; }
  h3 { font-size: 13px; margin: 16px 0 6px; color: ${COLORS.ink}; font-weight: 700; }
  p { margin: 4px 0; }
  .muted { color: ${COLORS.muted}; font-size: 11px; }
  .header { display: flex; align-items: flex-end; justify-content: space-between;
            border-bottom: 2px solid ${COLORS.accent}; padding-bottom: 10px; margin-bottom: 4px; }
  .brand { font-size: 13px; color: ${COLORS.accent}; font-weight: 700; letter-spacing: 1.5px; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; margin: 8px 0 16px; }
  .stat { background: ${COLORS.card}; border: 1px solid ${COLORS.border};
          border-radius: 10px; padding: 10px 12px; }
  .stat .label { color: ${COLORS.muted}; font-size: 10px;
                 text-transform: uppercase; letter-spacing: 0.6px; }
  .stat .value { font-size: 16px; font-weight: 700; margin-top: 2px; color: ${COLORS.ink}; }
  table { border-collapse: collapse; width: 100%; margin-top: 6px; font-size: 11px; }
  th, td { text-align: left; padding: 6px 8px;
           border-bottom: 1px solid ${COLORS.border}; vertical-align: top; }
  th { background: ${COLORS.card}; color: ${COLORS.muted}; font-weight: 700;
       text-transform: uppercase; font-size: 10px; letter-spacing: 0.6px; }
  tr.current td { background: rgba(217, 163, 159, 0.12); }
  .pill { display: inline-block; background: ${COLORS.card};
          border: 1px solid ${COLORS.border}; border-radius: 999px;
          padding: 2px 8px; margin: 0 4px 4px 0; font-size: 10px; color: ${COLORS.ink}; }
  .empty { color: ${COLORS.muted}; font-style: italic; }
  .symptom-row { display: flex; justify-content: space-between;
                 padding: 4px 0; border-bottom: 1px dashed ${COLORS.border}; }
  .footer { margin-top: 24px; color: ${COLORS.muted}; font-size: 10px; text-align: right; }
  @media print { body { background: white; padding: 16mm; } }
`;

const renderHeader = (title: string, profile: Profile): string => {
  const name = profile.name ? escapeHtml(profile.name) : 'Lira';
  return `
  <div class="header">
    <div>
      <div class="brand">LIRA · ОТЧЁТ</div>
      <h1>${escapeHtml(title)}</h1>
      <p class="muted">${escapeHtml(name)} · сформирован ${fmtNow()}</p>
    </div>
  </div>`;
};

const renderForecast = (
  predictions: CyclePredictions,
  stats: CycleStats,
): string => {
  const dayLabel =
    predictions.daysUntilNextPeriod === null
      ? '—'
      : predictions.daysUntilNextPeriod >= 0
        ? `через ${predictions.daysUntilNextPeriod} дн.`
        : `${Math.abs(predictions.daysUntilNextPeriod)} дн. назад`;
  return `
  <h2>Прогноз</h2>
  <div class="grid">
    <div class="stat">
      <div class="label">Следующие месячные</div>
      <div class="value">${fmtDate(predictions.nextPeriodStart)}</div>
      <div class="muted">${dayLabel}</div>
    </div>
    <div class="stat">
      <div class="label">Овуляция (пик)</div>
      <div class="value">${fmtDate(predictions.ovulation)}</div>
    </div>
    <div class="stat">
      <div class="label">Фертильное окно</div>
      <div class="value">
        ${fmtDate(predictions.fertileStart)} — ${fmtDate(predictions.fertileEnd)}
      </div>
    </div>
    <div class="stat">
      <div class="label">День цикла</div>
      <div class="value">
        ${predictions.cycleDay !== null ? predictions.cycleDay : '—'}
        <span class="muted" style="font-weight: normal; font-size: 11px;">
          / ${predictions.effectiveCycleLength}
        </span>
      </div>
      <div class="muted">${
        stats.irregular ? 'Нерегулярный цикл (разброс &gt; 7 дн.)' : 'Регулярный'
      }</div>
    </div>
  </div>`;
};

const renderStats = (stats: CycleStats): string => {
  return `
  <h2>Средние значения</h2>
  <div class="grid">
    <div class="stat">
      <div class="label">Средняя длина цикла</div>
      <div class="value">
        ${stats.averageCycleLength !== null ? `${stats.averageCycleLength} дн.` : '—'}
      </div>
      <div class="muted">по ${stats.recentCyclesUsed} последним циклам</div>
    </div>
    <div class="stat">
      <div class="label">Средняя длина месячных</div>
      <div class="value">
        ${stats.averagePeriodLength !== null ? `${stats.averagePeriodLength} дн.` : '—'}
      </div>
    </div>
    <div class="stat">
      <div class="label">Самый короткий цикл</div>
      <div class="value">
        ${stats.shortestCycle !== null ? `${stats.shortestCycle} дн.` : '—'}
      </div>
    </div>
    <div class="stat">
      <div class="label">Самый длинный цикл</div>
      <div class="value">
        ${stats.longestCycle !== null ? `${stats.longestCycle} дн.` : '—'}
      </div>
    </div>
  </div>`;
};

const renderSymptoms = (symptoms: SymptomCount[]): string => {
  if (symptoms.length === 0) {
    return `<h2>Симптомы</h2><p class="empty">Симптомы пока не отмечались.</p>`;
  }
  const rows = symptoms
    .map(
      (s) => `
    <div class="symptom-row">
      <span>${escapeHtml(SYMPTOM_LABELS[s.key] ?? s.key)}</span>
      <span><b>${s.count}</b> <span class="muted">отметок</span></span>
    </div>`,
    )
    .join('');
  return `<h2>Частые симптомы</h2>${rows}`;
};

const renderHistory = (history: CycleHistoryEntry[]): string => {
  if (history.length === 0) {
    return `<h2>История циклов</h2><p class="empty">История пока пустая.</p>`;
  }
  const rows = history
    .slice()
    .reverse()
    .map((entry, idx) => {
      const isCurrent = entry.end === null;
      const cls = isCurrent ? ' class="current"' : '';
      return `
        <tr${cls}>
          <td>${history.length - idx}</td>
          <td>${fmtDate(entry.start)}</td>
          <td>${entry.end ? fmtDate(entry.end) : '<span class="muted">текущий</span>'}</td>
          <td>${entry.cycleLength !== null ? `${entry.cycleLength} дн.` : '—'}</td>
          <td>${entry.periodLength} дн.</td>
        </tr>`;
    })
    .join('');
  return `
  <h2>История циклов</h2>
  <table>
    <thead>
      <tr>
        <th>#</th><th>Начало</th><th>Конец</th>
        <th>Длина цикла</th><th>Длина М</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
};

const renderJournal = (logs: Record<string, DayLog>): string => {
  const dates = Object.keys(logs).sort();
  if (dates.length === 0) {
    return `<h2>Дневник дней</h2><p class="empty">Записей пока нет.</p>`;
  }
  const rows = dates
    .map((d) => {
      const log = logs[d];
      if (!log) return '';
      const flow = log.flow ? FLOW_LABELS[log.flow] ?? log.flow : '';
      const flowCell = flow && flow !== '—' ? flow : '';
      const symptoms = (log.symptoms ?? [])
        .map((s) => `<span class="pill">${escapeHtml(SYMPTOM_LABELS[s] ?? s)}</span>`)
        .join('');
      const moods = (log.moods ?? [])
        .map((m) => `<span class="pill">${escapeHtml(MOOD_LABELS[m] ?? m)}</span>`)
        .join('');
      const temp = log.temperature !== undefined
        ? `${log.temperature.toFixed(2)} °C`
        : '';
      const notes = log.notes ? escapeHtml(log.notes) : '';
      const intim = log.intimacy ? '✓' : '';
      return `
        <tr>
          <td>${fmtDate(d)}</td>
          <td>${flowCell}</td>
          <td>${symptoms}${moods}</td>
          <td>${temp}</td>
          <td>${intim}</td>
          <td>${notes}</td>
        </tr>`;
    })
    .join('');
  return `
  <h2>Дневник дней</h2>
  <table>
    <thead>
      <tr>
        <th>Дата</th><th>Поток</th><th>Симптомы / настроение</th>
        <th>Темп.</th><th>Бл.</th><th>Заметка</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
};

const renderProfileBlock = (profile: Profile, settings: Settings): string => {
  return `
  <h2>Профиль и настройки</h2>
  <div class="grid">
    <div class="stat">
      <div class="label">Имя</div>
      <div class="value">${profile.name ? escapeHtml(profile.name) : '—'}</div>
    </div>
    <div class="stat">
      <div class="label">Дата рождения</div>
      <div class="value">${fmtDateLong(profile.birthdate)}</div>
    </div>
    <div class="stat">
      <div class="label">Установлено: длина цикла</div>
      <div class="value">${settings.averageCycleLength} дн.</div>
    </div>
    <div class="stat">
      <div class="label">Установлено: длина месячных</div>
      <div class="value">${settings.averagePeriodLength} дн.</div>
    </div>
    <div class="stat">
      <div class="label">Лютеиновая фаза</div>
      <div class="value">${settings.lutealPhaseLength} дн.</div>
    </div>
    <div class="stat">
      <div class="label">Язык / тема</div>
      <div class="value">${settings.language} · ${settings.theme}</div>
    </div>
  </div>`;
};

const buildAnalyticsHtml = (data: AppData): string => {
  const stats = computeCycleStats(data.logs, data.settings);
  const predictions = computePredictions(data.logs, data.settings);
  const symptoms = countSymptoms(data.logs);
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8" />
    <title>Lira · Аналитика</title><style>${baseStyles}</style></head><body>
    ${renderHeader('Аналитика цикла', data.profile)}
    ${renderForecast(predictions, stats)}
    ${renderStats(stats)}
    ${renderSymptoms(symptoms)}
    <p class="footer">Lira · твой цикл, твоя ритм-карта</p>
    </body></html>`;
};

const buildHistoryHtml = (data: AppData): string => {
  const history = computeCycleHistory(data.logs);
  const stats = computeCycleStats(data.logs, data.settings);
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8" />
    <title>Lira · История</title><style>${baseStyles}</style></head><body>
    ${renderHeader('История циклов', data.profile)}
    ${renderStats(stats)}
    ${renderHistory(history)}
    <p class="footer">Lira · твой цикл, твоя ритм-карта</p>
    </body></html>`;
};

const buildFullHtml = (data: AppData): string => {
  const stats = computeCycleStats(data.logs, data.settings);
  const predictions = computePredictions(data.logs, data.settings);
  const symptoms = countSymptoms(data.logs);
  const history = computeCycleHistory(data.logs);
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8" />
    <title>Lira · Полный отчёт</title><style>${baseStyles}</style></head><body>
    ${renderHeader('Полный отчёт', data.profile)}
    ${renderProfileBlock(data.profile, data.settings)}
    ${renderForecast(predictions, stats)}
    ${renderStats(stats)}
    ${renderSymptoms(symptoms)}
    ${renderHistory(history)}
    ${renderJournal(data.logs)}
    <p class="footer">Lira · твой цикл, твоя ритм-карта</p>
    </body></html>`;
};

export const buildReportHtml = (data: AppData, kind: ExportKind): string => {
  switch (kind) {
    case 'analytics':
      return buildAnalyticsHtml(data);
    case 'history':
      return buildHistoryHtml(data);
    case 'full':
      return buildFullHtml(data);
  }
};

const fileNameFor = (kind: ExportKind): string => {
  const stamp = new Date().toISOString().slice(0, 10);
  const slug =
    kind === 'analytics'
      ? 'analytics'
      : kind === 'history'
        ? 'history'
        : 'full';
  return `lira-${slug}-${stamp}.pdf`;
};

const exportOnWeb = (html: string): void => {
  if (typeof window === 'undefined') return;
  const w = window.open('', '_blank');
  if (!w) {
    Alert.alert(
      'Не получилось открыть окно',
      'Разреши всплывающие окна и попробуй ещё раз.',
    );
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  // Give the browser a tick to lay out, then trigger native print → save as PDF.
  setTimeout(() => {
    try {
      w.focus();
      w.print();
    } catch {
      // user can still trigger Cmd/Ctrl+P manually
    }
  }, 350);
};

/**
 * Generate a PDF for the requested kind and open the share sheet.
 * On web falls back to opening a print dialog.
 */
export const exportToPdf = async (
  data: AppData,
  kind: ExportKind,
): Promise<void> => {
  const html = buildReportHtml(data, kind);
  if (Platform.OS === 'web') {
    exportOnWeb(html);
    return;
  }
  try {
    const { uri } = await Print.printToFileAsync({ html });
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Поделиться отчётом',
        UTI: 'com.adobe.pdf',
      });
    } else {
      Alert.alert('PDF готов', `Файл сохранён: ${uri}`);
    }
    // Suppress the unused-variable hint when sharing is unavailable.
    void fileNameFor(kind);
  } catch (e) {
    Alert.alert(
      'Не получилось создать PDF',
      e instanceof Error ? e.message : 'Неизвестная ошибка',
    );
  }
};
