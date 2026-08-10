/**
 * weight-insights.ts — чистые хелперы аналитики дневника веса.
 * Без React, без UI, без localStorage. Покрыты тестами.
 */

export type RangeKey = 'all' | '7' | '30' | '90';

/** Фильтр записей по диапазону дней (для графика и статистик). */
export function rowsInRange<T extends { date: string }>(rows: T[], range: RangeKey): T[] {
  if (range === 'all' || rows.length === 0) return rows;
  const cutoff = Date.now() - Number(range) * 86400000;
  return rows.filter(r => {
    const d = Date.parse(r.date);
    if (Number.isNaN(d)) return true;
    return d >= cutoff;
  });
}

/** Дельта веса относительно предыдущей записи (сортировка по дате desc). */
export function deltaVsPrev(rows: { date: string; weight: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  const sorted = [...rows].sort((a, b) => b.date.localeCompare(a.date));
  for (let i = 0; i < sorted.length - 1; i++) {
    const cur = sorted[i];
    const prev = sorted[i + 1];
    const d = cur.weight - prev.weight;
    if (Number.isFinite(d)) out.set(cur.date, d);
  }
  return out;
}

export interface TimeOfDayGroup {
  avg: number | null;
  count: number;
}

export interface TimeOfDayInsight {
  morning: TimeOfDayGroup | null;
  evening: TimeOfDayGroup | null;
  /** Типичный дневной разброс: средний вечер минус среднее утро. */
  swing: number | null;
}

/** Средний вес по времени суток (утро/вечер). */
export function timeOfDayBreakdown(
  rows: { timeOfDay?: 'morning' | 'evening'; weight: number }[],
): TimeOfDayInsight {
  const morning: number[] = [];
  const evening: number[] = [];
  for (const r of rows) {
    if (!Number.isFinite(r.weight)) continue;
    if (r.timeOfDay === 'morning') morning.push(r.weight);
    else if (r.timeOfDay === 'evening') evening.push(r.weight);
  }
  const avg = (arr: number[]): number | null =>
    arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
  const m = avg(morning);
  const e = avg(evening);
  return {
    morning: morning.length ? { avg: m, count: morning.length } : null,
    evening: evening.length ? { avg: e, count: evening.length } : null,
    swing: m !== null && e !== null ? e - m : null,
  };
}

/** Подпись дельты с знаком: «+0.5», «−0.5». */
export function fmtSigned(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return '—';
  const abs = Math.abs(v).toFixed(digits);
  return `${v > 0 ? '+' : v < 0 ? '−' : '±'}${abs}`;
}

export interface GoalProgressResult {
  start: number;
  cur: number;
  pct: number | null;
  done: boolean;
}

/**
 * Прогресс к цели. Безопасно при goal === start (возвращает pct: null,
 * а не Infinity), обрезает pct до ±200.
 */
export function goalProgressSafe(
  start: number,
  cur: number,
  goal: number,
  tolerance = 0.5,
): GoalProgressResult | null {
  if (!Number.isFinite(start) || !Number.isFinite(cur) || !Number.isFinite(goal) || goal <= 0) return null;
  const done = Math.abs(cur - goal) < tolerance;
  if (Math.abs(goal - start) < 0.01) {
    return { start, cur, pct: null, done };
  }
  const pct = Math.max(-200, Math.min(200, Math.round(((cur - start) / (goal - start)) * 100)));
  return { start, cur, pct, done };
}

/** Целевое направление движения: +1 набирать, −1 сбрасывать, 0 — нет цели. */
export function goalDirection(start: number, cur: number, goal: number): 1 | -1 | 0 {
  if (goal <= 0 || Math.abs(goal - start) < 0.01) return 0;
  return goal > start ? 1 : -1;
}
