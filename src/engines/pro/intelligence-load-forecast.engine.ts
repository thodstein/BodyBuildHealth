/**
 * intelligence-load-forecast.engine.ts — прогноз нагрузки и траектория показателей (E6).
 *
 * Границы честности:
 *  - Прогноз нагрузки — ЭКСТРАПОЛЯЦИЯ СГЛАЖЕННОГО УРОВНЯ (EWMA), а не предсказание травм или
 *    перетренированности: «завтра будет примерно столько же AU/день, как в последние дни».
 *    Разброс недели показывается честным интервалом из остаточного SD ряда.
 *  - «Порог на 4-й день» — ОПЕРАЦИОННОЕ СОГЛАШЕНИЕ (снизить объём/вставить отдых при 3+ днях
 *    подряд), а не медицинское правило и не гейт: решение всегда за пользователем.
 *  - Траектория e1RM/веса/объёма — ИЗМЕРИМЫЕ величины (в отличие от readiness, который является
 *    производным невалидированным композитом), поэтому показываются рядом с readiness-прогнозом
 *    именно как «факт против оценки».
 *  - Посуточное «план vs факт» сознательно НЕ реализовано: ни ББ-, ни ПЛ-планы не хранят даты
 *    недель, поэтому сопоставление по дням потребовало бы выдуманной привязки. Сравнение
 *    факта с планом делается понедельно (E5, «средняя неделя плана»).
 */
import { ewma, type DayLoad } from './training-load.engine';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function addDays(dateStr: string, n: number): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(p => !Number.isFinite(p))) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const LOAD_FORECAST_NOTE =
  'Прогноз — экстраполяция сглаженного уровня нагрузки (EWMA), а не предсказание травм или перетренированности.';

export const CONSECUTIVE_DAYS_NOTE =
  'Порог на 4-й день подряд — операционное соглашение (облегчить нагрузку или вставить отдых), не медицинское правило и не автоблокировка.';

export interface ForecastDay { day: number; date: string; projected: number; }

export interface LoadForecast {
  referenceDate: string;
  /** Сглаженный уровень нагрузки, AU/день (EWMA α=2/8 по последним 14 дням). */
  level: number;
  perDay: ForecastDay[];
  weeklyTotal: number;
  /** Интервал недельной суммы: [низ, верх] из остаточного SD ряда. */
  weeklyBand: [number, number];
  /** Сколько дней подряд есть нагрузка, включая сегодня. */
  consecutiveDays: number;
  /** Мягкий ориентир нагрузки на следующий день при 3+ днях подряд, AU (null — не нужен). */
  suggestedCap: number | null;
  guidance: string;
  note: string;
}

/**
 * Прогноз нагрузки на N дней: EWMA-уровень + разброс из остаточного SD + счётчик дней подряд.
 */
export function loadForecast(dailyLoads: DayLoad[], referenceDate?: string, days = 7): LoadForecast {
  const sorted = [...dailyLoads].sort((a, b) => a.date < b.date ? -1 : 1);
  const byDate: Record<string, number> = {};
  for (const d of sorted) if (DATE_RE.test(d.date)) byDate[d.date] = (byDate[d.date] || 0) + d.load;
  const ref = referenceDate || (sorted.length ? sorted[sorted.length - 1].date : addDays(new Date().toISOString().slice(0, 10), 0));
  const hasData = Object.keys(byDate).length > 0;
  const series: number[] = [];
  for (let i = 13; i >= 0; i--) series.push(byDate[addDays(ref, -i)] ?? 0);
  const level = ewma(series, 2 / 8);

  // Остаточный SD ряда → разброс недельной суммы (грубо, но честно: это «размах», а не «прогноз с ДИ»).
  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  const sd = Math.sqrt(series.reduce((s, v) => s + (v - mean) ** 2, 0) / series.length);

  const perDay: ForecastDay[] = [];
  for (let k = 1; k <= Math.max(0, days); k++) {
    perDay.push({ day: k, date: addDays(ref, k), projected: Math.round(level) });
  }
  const weeklyTotal = Math.round(level * Math.max(0, days));
  const band = Math.round(sd * Math.sqrt(Math.max(1, days)));

  let consecutiveDays = 0;
  for (let i = 0; i < 400; i++) {
    if ((byDate[addDays(ref, -i)] ?? 0) > 0) consecutiveDays++;
    else break;
  }
  const suggestedCap = consecutiveDays >= 3 ? Math.round(level * 0.85) : null;
  const guidance = consecutiveDays >= 3
    ? `${consecutiveDays} дней подряд с нагрузкой. Ориентир: следующий день — около ${suggestedCap} AU (≈ −15%) либо отдых. Решение за вами.`
    : hasData
      ? `Нагрузка идёт ${consecutiveDays} дн. подряд — порог на ${consecutiveDays + 1}-й день не применяется.`
      : 'Нет данных о нагрузке — прогноз не строится.';

  return {
    referenceDate: ref,
    level: Math.round(level * 10) / 10,
    perDay, weeklyTotal, weeklyBand: [Math.max(0, weeklyTotal - band), weeklyTotal + band],
    consecutiveDays, suggestedCap, guidance,
    note: `${LOAD_FORECAST_NOTE} ${CONSECUTIVE_DAYS_NOTE}`,
  };
}

export type TrajectoryKey = 'e1rm' | 'bodyweight' | 'volume';

export interface TrajectoryPoint { date: string; value: number; }

export interface TrajectorySeries {
  key: TrajectoryKey;
  label: string;
  unit: string;
  /** true = измеримая величина (в отличие от readiness — производного композита). */
  measurable: true;
  points: TrajectoryPoint[];
  current: number | null;
  /** Линейный прирост за неделю (измеряемая единица/нед). */
  changePerWeek: number | null;
  changePct: number | null;
  direction: 'up' | 'down' | 'flat' | 'unknown';
  /** Проекция на N дней вперёд от последней точки. */
  projection: { date: string; value: number }[];
  /** Мало точек — проекция ориентировочная. */
  lowConfidence: boolean;
  note: string;
}

export const TRAJECTORY_NOTE =
  'e1RM, вес и объём — измеримые величины; readiness рядом — производный невалидированный композит. Проекция — линейная экстраполяция, а не прогноз результата.';

const SERIES_META: Record<TrajectoryKey, { label: string; unit: string }> = {
  e1rm: { label: 'e1RM (последний тест)', unit: 'кг' },
  bodyweight: { label: 'Вес тела', unit: 'кг' },
  volume: { label: 'Объём (сессия)', unit: 'AU' },
};

function sanitize(points: TrajectoryPoint[] | undefined): TrajectoryPoint[] {
  const out: TrajectoryPoint[] = [];
  for (const p of points ?? []) {
    if (!p || !DATE_RE.test(String(p.date))) continue;
    const v = Number(p.value);
    if (!Number.isFinite(v)) continue;
    out.push({ date: p.date, value: v });
  }
  return out.sort((a, b) => a.date < b.date ? -1 : 1);
}

/** Линейная регрессия → прирост в неделю. */
function slopePerWeek(points: TrajectoryPoint[]): number | null {
  if (points.length < 2) return null;
  const t0 = new Date(points[0].date).getTime();
  const xs = points.map(p => (new Date(p.date).getTime() - t0) / 86400000);
  const n = points.length;
  const meanX = xs.reduce((a, b) => a + b, 0) / n;
  const meanY = points.reduce((a, b) => a + b.value, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) { num += (xs[i] - meanX) * (points[i].value - meanY); den += (xs[i] - meanX) ** 2; }
  if (den <= 0) return null;
  return (num / den) * 7; // в неделю
}

/** Тренд по каждой измеримой серии + проекция вперёд. */
export function performanceTrajectory(
  input: Partial<Record<TrajectoryKey, TrajectoryPoint[]>>,
  referenceDate?: string,
  days = 7,
): TrajectorySeries[] {
  const keys: TrajectoryKey[] = ['e1rm', 'bodyweight', 'volume'];
  return keys.map(key => {
    const meta = SERIES_META[key];
    const points = sanitize(input[key]);
    const last = points.length ? points[points.length - 1] : null;
    const ref = referenceDate || last?.date || '';
    const perWeek = slopePerWeek(points);
    const changePct = perWeek != null && last && last.value !== 0
      ? Math.round((perWeek / Math.abs(last.value)) * 1000) / 10
      : null;
    const flat = perWeek == null || changePct == null || Math.abs(changePct) < 0.5;
    const direction = perWeek == null ? 'unknown' : flat ? 'flat' : perWeek > 0 ? 'up' : 'down';
    const projection: { date: string; value: number }[] = [];
    if (last && perWeek != null && ref) {
      for (let k = 1; k <= Math.max(0, days); k++) {
        const perDay = perWeek / 7;
        projection.push({ date: addDays(ref, k), value: Math.round((last.value + perDay * k) * 10) / 10 });
      }
    }
    return {
      key, label: meta.label, unit: meta.unit, measurable: true,
      points, current: last ? last.value : null,
      changePerWeek: perWeek == null ? null : Math.round(perWeek * 100) / 100,
      changePct, direction, projection,
      lowConfidence: points.length < 3,
      note: points.length < 2
        ? 'Недостаточно точек: тренд не считается (нужно ≥2 замера).'
        : points.length < 3
          ? 'Мало точек (2): направление ориентировочное.'
          : TRAJECTORY_NOTE,
    };
  });
}
