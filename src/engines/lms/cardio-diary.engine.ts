/**
 * cardio-diary.engine.ts — дневник выполнения кардио (he_cardio_sessions).
 * Запись выполненных сессий, adherence против CardioCycle, статистика 7/28 дней
 * и объяснимые рекомендации (снизить/сохранить/увеличить) на основе факта.
 */
import type { CardioCycle, CardioSession, CardioType } from './cardio.engine';
import { cardioSessionsForDate, cardioWeekForDate, kcalForCardio } from './cardio.engine';

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
  km: number;
  avgPace: string | null;
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
    km: Math.round(rows.reduce((s, e) => s + (e.distanceKm ?? 0), 0) * 10) / 10,
    avgPace: cardioAvgPaceMinPerKm(rows),
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

/** Оценка ккал сессии журнала по MET-модели движка (вес по умолчанию 80 кг). */
export function estimateCardioEntryKcal(type: CardioType, durationMin: number, weightKg?: number): number {
  return kcalForCardio(type, durationMin, weightKg && weightKg > 0 ? weightKg : 80);
}

/** Темп сессии: мин/км в формате «м:сс/км» или null (нет дистанции/времени). */
export function cardioPaceMinPerKm(distanceKm?: number, minutes?: number): string | null {
  if (!distanceKm || distanceKm <= 0 || !minutes || minutes <= 0) return null;
  const sec = Math.round((minutes * 60) / distanceKm);
  if (sec <= 0) return null;
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}/км`;
}

/** Средний темп по набору записей (взвешенно по дистанции): м:сс/км или null. */
export function cardioAvgPaceMinPerKm(entries: { distanceKm?: number; durationMin: number }[]): string | null {
  const totalKm = entries.reduce((s, e) => s + (e.distanceKm ?? 0), 0);
  const totalMin = entries.reduce((s, e) => s + e.durationMin, 0);
  if (totalKm <= 0 || totalMin <= 0) return null;
  return cardioPaceMinPerKm(totalKm, totalMin);
}

/**
 * Объяснимая рекомендация: факт vs план (7 дней), RPE/ЧСС, ACWR-контекст.
 * Возвращает действие и причину; кардио не пересобирается молча.
 */
export function computeCardioAdvice(
  cycle: CardioCycle | null,
  log: CardioLogEntry[],
  opts: { acwr?: number | null; recoveryLow?: boolean; referenceIso?: string } = {},
): CardioAdvice {
  if (!cycle || cycle.weeks.length === 0) {
    return { action: 'keep', reason: 'Активный кардио-цикл не выбран — записывайте сессии, план вернётся.' };
  }
  const stats = cardioLogStats(log, 7, opts.referenceIso);
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

// ─── План vs факт по неделям (график/сводка) ───

export interface CardioWeekFact extends CardioAdherence {
  /** Фактически сожжённые ккал (поле calories журнала) за неделю. */
  factKcal: number;
  /** Фактическая дистанция (поле distanceKm журнала) за неделю. */
  factKm: number;
}

/** Факт недели цикла: план/выполнено/минуты/ккал/км (0 если не записывались). */
export function cardioWeekFact(cycle: CardioCycle, week: number, log: CardioLogEntry[], referenceIso?: string): CardioWeekFact {
  const a = cardioWeekAdherence(cycle, week, log, referenceIso);
  const start = weekStartIso(week, referenceIso);
  const end = weekStartIso(week + 1, referenceIso);
  const done = log.filter(e => e.completed && e.date >= start && e.date < end);
  const factKcal = done.reduce((s, e) => s + (e.calories ?? 0), 0);
  const factKm = Math.round(done.reduce((s, e) => s + (e.distanceKm ?? 0), 0) * 10) / 10;
  return { ...a, factKcal, factKm };
}

export interface CardioCycleCompliance {
  weeks: CardioWeekFact[];
  /** Выполнение по минутам за переданный диапазон недель (0-100). */
  overallPctMinutes: number;
  totalDoneSessions: number;
  totalPlannedSessions: number;
}

/** Сводная compliance по неделям цикла (диапазон задаёт вызывающий код). */
export function cardioCycleCompliance(cycle: CardioCycle, log: CardioLogEntry[], weekFilter?: (w: number) => boolean, referenceIso?: string): CardioCycleCompliance {
  const weeks = cycle.weeks.filter(w => !weekFilter || weekFilter(w.week)).map(w => cardioWeekFact(cycle, w.week, log, referenceIso));
  const plannedMinutes = weeks.reduce((s, w) => s + w.plannedMinutes, 0);
  const doneMinutes = weeks.reduce((s, w) => s + w.doneMinutes, 0);
  const plannedSessions = weeks.reduce((s, w) => s + w.plannedSessions, 0);
  const doneSessions = weeks.reduce((s, w) => s + w.doneSessions, 0);
  return {
    weeks,
    overallPctMinutes: plannedMinutes > 0 ? Math.round((doneMinutes / plannedMinutes) * 100) : 0,
    totalDoneSessions: doneSessions,
    totalPlannedSessions: plannedSessions,
  };
}

// ─── День: план, факт и суммарная нагрузка (сила + кардио) ───

export interface CardioDayFact {
  done: CardioLogEntry[];
  minutes: number;
  kcal: number;
  km: number;
  avgRpe: number | null;
}

/** Факт дня из кардио-журнала (выполненные сессии за дату). */
export function cardioDayFact(log: CardioLogEntry[], dateIso: string): CardioDayFact {
  const done = log.filter(e => e.completed && e.date === dateIso);
  const minutes = done.reduce((s, e) => s + e.durationMin, 0);
  const kcal = done.reduce((s, e) => s + (e.calories ?? 0), 0);
  const km = Math.round(done.reduce((s, e) => s + (e.distanceKm ?? 0), 0) * 10) / 10;
  const rpes = done.filter(e => typeof e.rpe === 'number' && e.rpe > 0);
  return {
    done,
    minutes,
    kcal,
    km,
    avgRpe: rpes.length > 0 ? Math.round((rpes.reduce((s, e) => s + (e.rpe ?? 0), 0) / rpes.length) * 10) / 10 : null,
  };
}

export interface CardioDayLoad {
  planned: CardioSession[];
  done: CardioLogEntry[];
  cardioMinutes: number;
  /** Нагрузка кардио: минуты × RPE/10 (RPE по умолчанию 5). */
  cardioLoad: number;
  strengthSessions: number;
  /** Нагрузка силы: Σ sRPE × минуты (как в training-load). */
  strengthLoad: number;
  totalLoad: number;
}

/**
 * Суммарная нагрузка дня: план кардио (из цикла), факт (журнал кардио)
 * и силовая нагрузка (sRPE-сессии). Единая строка «сила + кардио».
 */
export function cardioDayLoad(
  cycle: CardioCycle | null,
  log: CardioLogEntry[],
  srpe: { date: string; sRPE: number; durationMin: number }[],
  dateIso: string,
  referenceIso?: string,
): CardioDayLoad {
  const planned = cycle ? (cardioSessionsForDate(cycle, dateIso, referenceIso ?? cycle.startDate)?.sessions ?? []) : [];
  const fact = cardioDayFact(log, dateIso);
  const cardioLoad = fact.done.reduce((s, e) => s + e.durationMin * ((e.rpe ?? 5) / 10), 0);
  const strength = srpe.filter(s => s.date === dateIso);
  const strengthLoad = strength.reduce((s, x) => s + x.sRPE * x.durationMin, 0);
  return {
    planned,
    done: fact.done,
    cardioMinutes: fact.minutes,
    cardioLoad: Math.round(cardioLoad),
    strengthSessions: strength.length,
    strengthLoad: Math.round(strengthLoad),
    totalLoad: Math.round(cardioLoad + strengthLoad),
  };
}

// ─── Пульс по факту: факт-ЧСС vs целевые зоны плана (C2) ───

export interface CardioHrCheck {
  date: string;
  type: CardioType;
  avgHr: number;
  targetMin?: number;
  targetMax?: number;
  inZone: boolean;
  above: boolean;
  below: boolean;
}

export interface CardioHrComplianceResult {
  checks: CardioHrCheck[];
  /** % сессий с avgHr внутри целевой зоны (null — нет данных с ЧСС). */
  inZonePct: number | null;
  /** Среднее отклонение факт-ЧСС от середины зоны (уд; null — нет данных). */
  avgDelta: number | null;
  advice: string | null;
}

/**
 * Анализ фактического пульса против целевых зон плана за окно дней.
 * Сессия журнала (avgHr) сопоставляется с целевой зоной сессии цикла
 * того же типа в неделе даты. Возвращает точность попадания и совет.
 */
export function cardioHrCompliance(
  cycle: CardioCycle,
  log: CardioLogEntry[],
  opts: { days?: number; referenceIso?: string } = {},
): CardioHrComplianceResult {
  const days = Math.max(1, Math.round(opts.days ?? 28));
  const from = dateDaysAgo(days, opts.referenceIso);
  const rows = log.filter(e => e.completed && typeof e.avgHr === 'number' && e.avgHr > 0 && e.date >= from);
  const checks: CardioHrCheck[] = [];
  for (const e of rows) {
    const week = cardioWeekForDate(cycle, e.date, cycle.startDate);
    if (!week) continue;
    const plan = week.sessions.find(s => s.type === e.type) ?? week.sessions[0];
    const t = plan?.targetHr;
    if (!t || t.min == null || t.max == null) continue;
    const hr = e.avgHr as number;
    checks.push({
      date: e.date,
      type: e.type,
      avgHr: hr,
      targetMin: t.min,
      targetMax: t.max,
      inZone: hr >= t.min && hr <= t.max,
      above: hr > t.max,
      below: hr < t.min,
    });
  }
  if (checks.length === 0) return { checks, inZonePct: null, avgDelta: null, advice: null };
  const inZone = checks.filter(c => c.inZone).length;
  const inZonePct = Math.round((inZone / checks.length) * 100);
  const avgDelta = Math.round(checks.reduce((s, c) => s + (c.avgHr - ((c.targetMin ?? 0) + (c.targetMax ?? 0)) / 2), 0) / checks.length);
  let advice: string;
  if (inZonePct >= 70) {
    advice = `Попадание в пульс-зону ${inZonePct}% (${checks.length} сессий) — точность хорошая, среднее отклонение ${avgDelta > 0 ? '+' : ''}${avgDelta} уд.`;
  } else if (avgDelta > 5) {
    advice = `ЧСС выше целевой зоны в среднем на ${avgDelta} уд — снизьте темп, держитесь в зоне сессии (Z2/Z3).`;
  } else if (avgDelta < -5) {
    advice = `ЧСС ниже целевой зоны в среднем на ${-avgDelta} уд — сессии проходят слишком легко, добавьте темп.`;
  } else {
    advice = `Попадание в зону ${inZonePct}% — пульс плавает; чаще сверяйтесь с зоной по ходу сессии.`;
  }
  return { checks, inZonePct, avgDelta, advice };
}
