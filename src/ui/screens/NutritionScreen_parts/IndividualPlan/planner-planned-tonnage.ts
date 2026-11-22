/**
 * planner-planned-tonnage.ts — плановый тоннаж из плана тренировок.
 *
 * ПРОБЛЕМА, которую закрывает модуль: пери-воркаут считался ТОЛЬКО по последней
 * ЗАВЕРШЁННОЙ сессии (`loadSessions()[0]` в PeriWorkoutCard). На старте недели или
 * в день тренировки карточка показывала вчерашнюю (или прошлонедельную) нагрузку,
 * а рацион вообще не знал тоннаж. Владелец попросил: «синхронизация с пери-воркаут
 * по кнопке, тоннаж брать из плана тренировок».
 *
 * Источник — `he_pl_runtime` (SRCBBScreen.tsx пишет `{ days: PlayerDay[]; focus; week; track }`,
 * PlayerDay = { label, exercises: [{ name, targetSets: [{ weight, reps }] }] }).
 * Фолбэк — последняя завершённая сессия (прежнее поведение, ничего не ломается).
 *
 * Чистые функции + чтение localStorage под try/catch: модуль тестируется без React.
 */
import { loadSessions } from '../../../../engines/workout-logger.engine';

export const PL_RUNTIME_KEY = 'he_pl_runtime';

export type PlannedIntensity = 'low' | 'medium' | 'high';

export interface PlannedSessionInfo {
  source: 'plan' | 'lastSession';
  /** тоннаж, кг·повт */
  tonnageKg: number;
  durationMin: number;
  intensity: PlannedIntensity;
  sets: number;
  dayLabel?: string;
  focus?: string;
  /** хэш плана: позволяет заметить «план перегенерили — синк устарел» */
  signature: string;
  updatedAt: number;
}

/** День недели для offset 0 (0 = Пн) — та же формула, что в planner-training-schedule. */
export function todayDowIndex(now: Date = new Date()): number {
  return (now.getDay() + 6) % 7;
}

function fnv1a(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Подпись текущего плана тренировок ('' если плана нет). */
export function planSignature(raw?: any): string {
  if (raw === undefined) {
    try {
      raw = JSON.parse(localStorage.getItem(PL_RUNTIME_KEY) || 'null');
    } catch {
      raw = null;
    }
  }
  if (!raw) return '';
  try {
    return fnv1a(JSON.stringify(raw.days || raw));
  } catch {
    return '';
  }
}

/**
 * Оценка длительности сессии по числу подходов.
 * 3 минуты на подход (работа + отдых) + 12 минут разминка/заминка, коридор 20–150.
 */
export function estimateSessionMinutes(sets: number): number {
  const s = Math.max(0, Math.round(sets));
  return Math.max(20, Math.min(150, s * 3 + 12));
}

/** Интенсивность по длительности/объёму подходов (прокси без %1ПМ). */
export function estimateIntensity(sets: number, durationMin: number): PlannedIntensity {
  if (durationMin >= 80 || sets >= 20) return 'high';
  if (durationMin <= 45 && sets <= 12) return 'low';
  return 'medium';
}

interface DayAggregate {
  label: string;
  tonnage: number;
  sets: number;
}

/**
 * Плановый день → агрегат. Считаем только подходы с весом и повторами
 * (разминочные «пустые» сеты без веса в тоннаж не входят).
 */
function aggregateDay(day: any, index: number): DayAggregate {
  const label = String(day?.label || `Д${index + 1}`);
  const exercises = Array.isArray(day?.exercises) ? day.exercises : [];
  let tonnage = 0;
  let sets = 0;
  for (const ex of exercises) {
    const targetSets = Array.isArray(ex?.targetSets) ? ex.targetSets : [];
    for (const set of targetSets) {
      const w = Number(set?.weight) || 0;
      const r = Number(set?.reps) || 0;
      if (w > 0 && r > 0) {
        tonnage += w * r;
        sets += 1;
      }
    }
  }
  return { label, tonnage, sets };
}

/**
 * Плановый тоннаж из `he_pl_runtime`.
 * @param opts.dowIndex — день недели (0 = Пн) для выбора дня 7-дневного плана.
 *   Не задан → сегодняшний.
 */
export function readPlannedSession(opts?: { dowIndex?: number }): PlannedSessionInfo | null {
  let raw: any = null;
  try {
    raw = JSON.parse(localStorage.getItem(PL_RUNTIME_KEY) || 'null');
  } catch {
    raw = null;
  }
  const days: any[] = Array.isArray(raw?.days) ? raw.days : [];
  if (days.length === 0) return null;
  const agg = days.map(aggregateDay);
  const filled = agg.filter((d) => d.sets > 0);
  if (filled.length === 0) return null;

  const dow = opts?.dowIndex ?? todayDowIndex();
  const byDow = agg.length === 7 ? agg[dow] : undefined;
  const pick = byDow && byDow.sets > 0 ? byDow : filled[0];
  const durationMin = estimateSessionMinutes(pick.sets);
  return {
    source: 'plan',
    tonnageKg: Math.round(pick.tonnage),
    durationMin,
    intensity: estimateIntensity(pick.sets, durationMin),
    sets: pick.sets,
    dayLabel: pick.label,
    focus: typeof raw?.focus === 'string' ? raw.focus : undefined,
    signature: planSignature(raw),
    updatedAt: Date.now(),
  };
}

/** Последняя завершённая сессия (прежний источник карточки) — фолбэк. */
export function readLastSessionInfo(): PlannedSessionInfo | null {
  let last: any = null;
  try {
    last = (loadSessions() || [])[0];
  } catch {
    last = null;
  }
  if (!last) return null;
  const tonnage = Math.max(0, Number(last.totalVolume) || 0);
  const dur = Math.max(0, Number(last.durationMin) || 0);
  if (tonnage <= 0 && dur <= 0) return null;
  const sets = Math.max(0, Number(last.totalSets) || 0);
  const rpe = Number(last.avgIntensity) || 0;
  const intensity: PlannedIntensity =
    rpe >= 8 ? 'high' : rpe > 0 && rpe <= 6 ? 'low' : estimateIntensity(sets, dur || estimateSessionMinutes(sets));
  return {
    source: 'lastSession',
    tonnageKg: Math.round(tonnage),
    durationMin: dur > 0 ? Math.round(dur) : estimateSessionMinutes(sets),
    intensity,
    sets,
    dayLabel: [last.date, last.focus].filter(Boolean).join(' · ') || undefined,
    signature: '',
    updatedAt: Date.now(),
  };
}

/** План → последняя сессия → null. */
export function resolveSessionSource(opts?: { dowIndex?: number }): PlannedSessionInfo | null {
  return readPlannedSession(opts) || readLastSessionInfo();
}
