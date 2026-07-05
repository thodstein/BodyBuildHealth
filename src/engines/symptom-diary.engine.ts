/**
 * symptom-diary.engine.ts — Дневник симптомов
 *
 * Ежедневный трекинг выбранных симптомов: оценка динамики,
 * сохранение в localStorage, график за неделю/месяц.
 */
import type { SymptomEntry, SymptomCategory, UrgencyLevel } from './symptom-solver.engine';
import { findSymptomById } from './symptom-solver.engine';

export type SymptomTrend = 'improving' | 'stable' | 'worsening' | 'resolved';

export interface SymptomDiaryEntry {
  date: string;          // YYYY-MM-DD
  symptomId: string;
  severity: number;      // 0-10 (0=нет, 10=максимум)
  trend: SymptomTrend;
  note?: string;
}

export interface SymptomDiaryDay {
  date: string;
  entries: SymptomDiaryEntry[];
  overallScore: number;  // средняя тяжесть за день
  symptomCount: number;
}

const DIARY_KEY = 'he_symptom_diary';

/** Получить весь дневник */
export function getSymptomDiary(): SymptomDiaryDay[] {
  try {
    return JSON.parse(localStorage.getItem(DIARY_KEY) || '[]');
  } catch { return []; }
}

/** Получить записи за сегодня */
export function getTodayDiary(): SymptomDiaryEntry[] {
  const diary = getSymptomDiary();
  const today = new Date().toISOString().slice(0, 10);
  const day = diary.find((d) => d.date === today);
  return day?.entries || [];
}

/** Добавить/обновить симптом за сегодня */
export function updateSymptomToday(
  symptomId: string,
  severity: number,
  note?: string
): SymptomDiaryDay[] {
  const diary = getSymptomDiary();
  const today = new Date().toISOString().slice(0, 10);
  let day = diary.find((d) => d.date === today);

  if (!day) {
    day = { date: today, entries: [], overallScore: 0, symptomCount: 0 };
    diary.push(day);
  }

  const existingIdx = day.entries.findIndex((e) => e.symptomId === symptomId);
  const trend = calcTrend(symptomId, severity, diary);

  const entry: SymptomDiaryEntry = {
    date: today,
    symptomId,
    severity,
    trend,
    note: note || undefined,
  };

  if (existingIdx >= 0) {
    day.entries[existingIdx] = entry;
  } else {
    day.entries.push(entry);
  }

  // Пересчёт
  day.symptomCount = day.entries.length;
  day.overallScore = day.entries.length > 0
    ? Math.round(day.entries.reduce((s, e) => s + e.severity, 0) / day.entries.length)
    : 0;

  localStorage.setItem(DIARY_KEY, JSON.stringify(diary));
  return diary;
}

/** Удалить симптом из дневника */
export function removeSymptomFromDiary(symptomId: string): void {
  const diary = getSymptomDiary();
  for (const day of diary) {
    day.entries = day.entries.filter((e) => e.symptomId !== symptomId);
  }
  localStorage.setItem(DIARY_KEY, JSON.stringify(diary));
}

/** Рассчитать тренд: сравнение с предыдущими 3 днями */
function calcTrend(
  symptomId: string,
  currentSeverity: number,
  diary: SymptomDiaryDay[]
): SymptomTrend {
  const prevEntries: SymptomDiaryEntry[] = [];
  for (let i = diary.length - 1; i >= 0 && prevEntries.length < 3; i--) {
    const found = diary[i].entries.find((e) => e.symptomId === symptomId);
    if (found && found.date !== new Date().toISOString().slice(0, 10)) {
      prevEntries.push(found);
    }
  }
  if (prevEntries.length === 0) return 'stable';
  if (currentSeverity === 0) return 'resolved';
  const avgPrev = prevEntries.reduce((s, e) => s + e.severity, 0) / prevEntries.length;
  if (currentSeverity < avgPrev - 1) return 'improving';
  if (currentSeverity > avgPrev + 1) return 'worsening';
  return 'stable';
}

/** Получить историю по одному симптому */
export function getSymptomHistory(symptomId: string): { date: string; severity: number }[] {
  const diary = getSymptomDiary();
  const result: { date: string; severity: number }[] = [];
  for (const day of diary) {
    const entry = day.entries.find((e) => e.symptomId === symptomId);
    if (entry) {
      result.push({ date: day.date, severity: entry.severity });
    }
  }
  return result;
}

/** Получить статистику: сколько симптомов активны, улучшаются, ухудшаются */
export function getSymptomDiaryStats(): {
  activeSymptoms: number;
  improving: number;
  worsening: number;
  resolved: number;
  stable: number;
  todayScore: number;
  weekAvgScore: number;
} {
  const diary = getSymptomDiary();
  const today = new Date().toISOString().slice(0, 10);
  const todayDay = diary.find((d) => d.date === today);
  const todayEntries = todayDay?.entries || [];

  // Текущая активность
  const activeSymptoms = todayEntries.length;

  // Срез за последние 7 дней
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
  const weekEntries: SymptomDiaryEntry[] = [];
  for (const day of diary) {
    if (day.date >= weekAgo) {
      weekEntries.push(...day.entries);
    }
  }

  const improving = weekEntries.filter((e) => e.trend === 'improving').length;
  const worsening = weekEntries.filter((e) => e.trend === 'worsening').length;
  const resolved = weekEntries.filter((e) => e.trend === 'resolved').length;
  const stable = weekEntries.filter((e) => e.trend === 'stable').length;

  const weekScores = diary
    .filter((d) => d.date >= weekAgo)
    .map((d) => d.overallScore);
  const weekAvgScore = weekScores.length > 0
    ? Math.round(weekScores.reduce((s, v) => s + v, 0) / weekScores.length)
    : 0;

  return {
    activeSymptoms,
    improving,
    worsening,
    resolved,
    stable,
    todayScore: todayDay?.overallScore || 0,
    weekAvgScore,
  };
}

/** Получить данные для графика (7 или 30 дней) */
export function getSymptomChartData(
  days: number = 7
): { labels: string[]; values: number[] } {
  const diary = getSymptomDiary();
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const filtered = diary
    .filter((d) => d.date >= cutoff)
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    labels: filtered.map((d) => {
      const parts = d.date.split('-');
      return `${parts[2]}.${parts[1]}`;
    }),
    values: filtered.map((d) => d.overallScore),
  };
}

/** Собрать данные по всем симптомам за период для сводки */
export function getSymptomDiarySummary(days: number = 7): {
  symptomId: string;
  symptomName: string;
  category: SymptomCategory | string;
  trend: SymptomTrend;
  currentSeverity: number;
  avgSeverity: number;
}[] {
  const diary = getSymptomDiary();
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);

  // Уникальные symptomId за период
  const symptomMap = new Map<string, { severities: number[]; dates: string[] }>();
  for (const day of diary) {
    if (day.date < cutoff) continue;
    for (const entry of day.entries) {
      if (!symptomMap.has(entry.symptomId)) {
        symptomMap.set(entry.symptomId, { severities: [], dates: [] });
      }
      const s = symptomMap.get(entry.symptomId)!;
      s.severities.push(entry.severity);
      s.dates.push(day.date);
    }
  }

  const result: {
    symptomId: string; symptomName: string; category: string;
    trend: SymptomTrend; currentSeverity: number; avgSeverity: number;
  }[] = [];

  for (const [id, data] of symptomMap) {
    const sym = findSymptomById(id);
    const lastSev = data.severities[data.severities.length - 1] || 0;
    const avgSev = data.severities.length > 0
      ? Math.round(data.severities.reduce((s, v) => s + v, 0) / data.severities.length)
      : 0;
    const trend = data.severities.length >= 2
      ? calcTrend(id, lastSev, diary)
      : 'stable';

    result.push({
      symptomId: id,
      symptomName: sym?.symptom || id,
      category: sym?.category || 'other',
      trend,
      currentSeverity: lastSev,
      avgSeverity: avgSev,
    });
  }

  return result.sort((a, b) => b.currentSeverity - a.currentSeverity);
}
