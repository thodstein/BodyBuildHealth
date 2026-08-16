/**
 * cardio-diary.engine.ts — дневник выполнения кардио (he_cardio_sessions).
 * Запись выполненных сессий, adherence против CardioCycle, статистика 7/28 дней
 * и объяснимые рекомендации (снизить/сохранить/увеличить) на основе факта.
 */
import type { CardioCycle, CardioType } from './cardio.engine';

export const CARDIO_LOG_KEY = 'he_cardio_sessions';
export const CARDIO_LOG_CAP = 500;

export interface CardioLogEntry {
  id: string;
  date: string;            // ISO YYYY-MM-DD (локальная)
  type: CardioType;
  durationMin: number;
  distanceKm?: number;
  avgHr?: number;
  calories?: number;
  rpe?: number;
  completed: boolean;
  notes?: string;
}

export function loadCardioLog(): CardioLogEntry[] {
  try {
    const v = JSON.parse(localStorage.getItem(CARDIO_LOG_KEY) ?? '[]');
    if (!Array.isArray(v)) return [];
    return v
      .filter((e): e is CardioLogEntry => !!e && typeof e === 'object' && typeof e.date === 'string' && typeof e.durationMin === 'number')
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  } catch { return []; }
}

export function saveCardioLogEntry(entry: CardioLogEntry): CardioLogEntry[] {
  const all = loadCardioLog().filter(e => e.id !== entry.id);
  all.unshift(entry);
  try { localStorage.setItem(CARDIO_LOG_KEY, JSON.stringify(all.slice(0, CARDIO_LOG_CAP))); } catch { /* ignore */ }
  return all;
}

export function removeCardioLogEntry(id: string): CardioLogEntry[] {
  const all = loadCardioLog().filter(e => e.id !== id);
  try { localStorage.setItem(CARDIO_LOG_KEY, JSON.stringify(all)); } catch { /* ignore */ }
  return all;
}

export function clearCardioLog(): void {
  try { localStorage.removeItem(CARDIO_LOG_KEY); } catch { /* ignore */ }
}

function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function dateDaysAgo(days: number, referenceIso?: string): string {
  const ref = referenceIso ? new Date(referenceIso) : new Date();
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() - days);
  return toLocalIso(d);
}

/** Статистика журнала за последние N дней. */
export function cardioLogStats(log: CardioLogEntry[], days: number, referenceIso?: string): {
  sessions: number;
  minutes: number;
  avgRpe: number | null;
  avgHr: number | null;
  kcal: number;
} {
  const from = dateDaysAgo(days, referenceIso);
  const rows = log.filter(e => e.completed && e.date >= from);
  const minutes = rows.reduce((s, e) => s + e.durationMin, 0);
  const rpes = rows.filter(e => typeof e.rpe === 'number' && e.rpe > 0);
  const hrs = rows.filter(e => typeof e.avgHr === 'number' && e.avgHr > 0);
  return {
    sessions: rows.length,
    minutes,
    avgRpe: rpes.length > 0 ? Math.round(rpes.reduce((s, e) => s + (e.rpe ?? 0), 0) / rpes.length * 10) / 10 : null,
    avgHr: hrs.length > 0 ? Math.round(hrs.reduce((s, e) => s + (e.avgHr ?? 0), 0) / hrs.length) : null,
    kcal: rows.reduce((s, e) => s + (e.calories ?? 0), 0),
  };
}

/** Сопоставить неделю цикла с датой (неделя 1 = reference). */
export function weekStartIso(week: number, referenceIso?: string): string {
  const ref = referenceIso ? new Date(referenceIso) : new Date();
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate() + (week - 1) * 7);
  return toLocalIso(d);
}

export interface CardioAdherence {
  week: number;
  weekStart: string;
  plannedSessions: number;
  doneSessions: number;
  plannedMinutes: number;
  doneMinutes: number;
  pctSessions: number;
  pctMinutes: number;
}

/** Adherence конкретной недели цикла против журнала. */
export function cardioWeekAdherence(cycle: CardioCycle, week: number, log: CardioLogEntry[], referenceIso?: string): CardioAdherence {
  const cw = cycle.weeks.find(w => w.week === week);
  const start = weekStartIso(week, referenceIso);
  const end = weekStartIso(week + 1, referenceIso);
  const plannedSessions = cw ? cw.sessions.reduce((s, x) => s + x.weeklyFrequency, 0) : 0;
  const plannedMinutes = cw?.totalMinutes ?? 0;
  const done = log.filter(e => e.completed && e.date >= start && e.date < end);
  const doneSessions = done.length;
  const doneMinutes = done.reduce((s, e) => s + e.durationMin, 0);
  return {
    week,
    weekStart: start,
    plannedSessions,
    doneSessions,
    plannedMinutes,
    doneMinutes,
    pctSessions: plannedSessions > 0 ? Math.round((doneSessions / plannedSessions) * 100) : 0,
    pctMinutes: plannedMinutes > 0 ? Math.round((doneMinutes / plannedMinutes) * 100) : 0,
  };
}

/** Сводная adherence за N недель цикла. */
export function cardioAdherenceSummary(cycle: CardioCycle, log: CardioLogEntry[], weeks: number, referenceIso?: string): {
  weeks: CardioAdherence[];
  avgPctSessions: number;
  avgPctMinutes: number;
  totalPlanned: number;
  totalDone: number;
} {
  const weekList = cycle.weeks.filter(w => w.week <= weeks).map(w => cardioWeekAdherence(cycle, w.week, log, referenceIso));
  const avg = (f: (a: CardioAdherence) => number) => weekList.length > 0 ? Math.round(weekList.reduce((s, a) => s + f(a), 0) / weekList.length) : 0;
  return {
    weeks: weekList,
    avgPctSessions: avg(a => a.pctSessions),
    avgPctMinutes: avg(a => a.pctMinutes),
    totalPlanned: weekList.reduce((s, a) => s + a.plannedSessions, 0),
    totalDone: weekList.reduce((s, a) => s + a.doneSessions, 0),
  };
}

export type CardioAdviceAction = 'reduce' | 'keep' | 'increase';

export interface CardioAdvice {
  action: CardioAdviceAction;
  reason: string;
}

/**
 * Объяснимая рекомендация: факт vs план (7 дней), RPE/ЧСС, ACWR-контекст.
 * Возвращает действие и причину; кардио не пересобирается молча.
 */
export function computeCardioAdvice(
  cycle: CardioCycle,
  log: CardioLogEntry[],
  opts: { acwr?: number | null; recoveryLow?: boolean; referenceIso?: string } = {},
): CardioAdvice {
  const stats = cardioLogStats(log, 7, opts.referenceIso);
  const avgMinutes = cycle.totalWeeks > 0 ? Math.round(cycle.totalKcal / cycle.totalWeeks / 7) : 0;
  const plannedWeekly = cycle.weeks.length > 0 ? Math.round(cycle.weeks.reduce((s, w) => s + w.totalMinutes, 0) / cycle.weeks.length) : 0;
  if (opts.acwr != null && opts.acwr >= 1.5) {
    return { action: 'reduce', reason: `ACWR ${opts.acwr.toFixed(2)} — опасная зона: кардио-объём снизить, HIIT исключить.` };
  }
  if (opts.recoveryLow) {
    return { action: 'reduce', reason: 'Низкое восстановление: убрать HIIT, оставить лёгкое кардио.' };
  }
  if (stats.sessions === 0) {
    const from = dateDaysAgo(7, opts.referenceIso);
    const skipped = log.filter(e => !e.completed && e.date >= from).length;
    if (skipped > 0) {
      return { action: 'keep', reason: `За 7 дней пропущено ${skipped} сессий — начните со следующей по плану.` };
    }
    return { action: 'keep', reason: 'За 7 дней кардио не записано — начните с плана недели.' };
  }
  const ratio = plannedWeekly > 0 ? stats.minutes / plannedWeekly : 1;
  if (ratio < 0.6) {
    return { action: 'increase', reason: `Выполнено ${Math.round(ratio * 100)}% плана — добавьте недостающие сессии Zone 2.` };
  }
  if (stats.avgRpe != null && stats.avgRpe >= 8) {
    return { action: 'reduce', reason: `Средний RPE ${stats.avgRpe} — кардио перегружает: снизить интенсивность/минуты.` };
  }
  return { action: 'keep', reason: 'Нагрузка соответствует плану — продолжайте.' };
}
