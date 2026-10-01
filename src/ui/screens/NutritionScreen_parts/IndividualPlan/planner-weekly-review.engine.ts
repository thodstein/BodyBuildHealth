/**
 * planner-weekly-review.engine.ts — недельный разбор (PRO-контур «план → факт → коррекция»).
 *
 * Профессиональный диетолог раз в неделю смотрит: сколько реально съедено против цели
 * (приверженность), как меняется вес, и корректирует ОДНУ переменную (калории ±150) —
 * Helms 2022 (не более 0.5–1%/нед), Trexler (recomp), Garthe (набор). Чистая функция.
 */

export interface WeeklyReviewDay {
  date: string;
  kcal: number;
  proteinG: number;
}

export interface WeeklyReviewInput {
  days: WeeklyReviewDay[];
  targetKcal: number;
  targetProteinG: number;
  weightLog: { date: string; weightKg: number }[];
  goal: string;
  windowDays?: number;
}

export type WeeklyVerdict = 'on_track' | 'too_slow' | 'too_fast' | 'no_data';

export interface WeeklyReview {
  windowDays: number;
  loggedDays: number;
  avgKcal: number;
  avgProteinG: number;
  adherencePct: number;
  weightStartKg: number | null;
  weightEndKg: number | null;
  weightDeltaKg: number | null;
  weightRatePctPerWeek: number | null;
  targetRatePctPerWeek: number;
  verdict: WeeklyVerdict;
  /** Рекомендуемая правка калорий (±150, 0 — держать). */
  kcalAdjust: number;
  recommendation: string;
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const round1 = (v: number): number => Math.round(v * 10) / 10;

/** Целевой темп веса (%/нед) по цели атлета. */
export function targetRatePctPerWeek(goal: string): number {
  const g = String(goal || '').toLowerCase();
  if (g === 'cutting' || g === 'fat_loss') return -0.5;
  if (g === 'mass') return 0.25;
  if (g === 'strength') return 0.15;
  return 0; // recomp / maintenance / health / rehab / post_cut
}

const _daysBetween = (a: string, b: string): number => {
  const da = new Date(a + 'T00:00:00').getTime();
  const db = new Date(b + 'T00:00:00').getTime();
  return Math.round((db - da) / 86400000);
};

/** Недельный разбор: приверженность + тренд веса + одна рекомендация. */
export function buildWeeklyReview(input: WeeklyReviewInput): WeeklyReview {
  const windowDays = clamp(Math.round(input.windowDays || 7), 3, 28);
  const targetKcal = Math.max(1, Number(input.targetKcal) || 0);
  const targetProteinG = Math.max(1, Number(input.targetProteinG) || 0);
  const targetRate = targetRatePctPerWeek(input.goal);

  const days = (Array.isArray(input.days) ? input.days : [])
    .filter(d => d && typeof d.date === 'string' && Number.isFinite(d.kcal) && d.kcal > 0)
    .slice(-windowDays);
  const loggedDays = days.length;

  const avgKcal = loggedDays > 0 ? Math.round(days.reduce((s, d) => s + d.kcal, 0) / loggedDays) : 0;
  const avgProteinG = loggedDays > 0 ? Math.round(days.reduce((s, d) => s + (d.proteinG || 0), 0) / loggedDays) : 0;
  const adhered = days.filter(d => Math.abs(d.kcal - targetKcal) / targetKcal <= 0.05).length;
  const adherencePct = loggedDays > 0 ? Math.round((adhered / loggedDays) * 100) : 0;

  // Тренд веса в окне.
  const dates = days.map(d => d.date).sort();
  const from = dates[0] || '';
  const to = dates[dates.length - 1] || '';
  const wlog = (Array.isArray(input.weightLog) ? input.weightLog : [])
    .filter(w => w && typeof w.date === 'string' && Number.isFinite(w.weightKg) && w.weightKg > 0 && (!from || w.date >= from) && (!to || w.date <= to))
    .sort((a, b) => a.date.localeCompare(b.date));
  let weightStartKg: number | null = null;
  let weightEndKg: number | null = null;
  let weightDeltaKg: number | null = null;
  let weightRatePctPerWeek: number | null = null;
  if (wlog.length >= 2) {
    const _rawStart = wlog[0].weightKg;
    const _rawEnd = wlog[wlog.length - 1].weightKg;
    weightStartKg = round1(_rawStart);
    weightEndKg = round1(_rawEnd);
    weightDeltaKg = round1(_rawEnd - _rawStart);
    const span = Math.max(1, _daysBetween(wlog[0].date, wlog[wlog.length - 1].date));
    // Темп считаем от СЫРОЙ дельты (округление до 0.1 кг искажало −0.34 → −0.3 → темп −0.4%).
    weightRatePctPerWeek = round1(((_rawEnd - _rawStart) / _rawStart) * (7 / span) * 100);
  }

  let verdict: WeeklyVerdict = 'no_data';
  let kcalAdjust = 0;
  let recommendation = '📭 Мало данных: записывайте рацион и вес ≥4 дней в неделю — тогда разбор станет точным.';

  if (loggedDays >= 4) {
    if (weightRatePctPerWeek == null) {
      recommendation = `Приверженность ${adherencePct}%. Взвешивайтесь утром 3–4 раза/нед (натощак, после туалета) — без тренда веса коррекцию не делаем.`;
    } else {
      const diff = weightRatePctPerWeek - targetRate;
      if (targetRate < 0) {
        // Сушка.
        if (diff > 0.25) { verdict = 'too_slow'; kcalAdjust = -150; recommendation = `Темп ${weightRatePctPerWeek}%/нед — медленнее цели ${targetRate}%/нед. Уберите ~150 ккал (жиры/углеводы) ИЛИ добавьте кардио — одна переменная.`; }
        else if (diff < -0.25) { verdict = 'too_fast'; kcalAdjust = 150; recommendation = `Темп ${weightRatePctPerWeek}%/нед — быстрее цели (риск мышц/гормонов). Добавьте ~150 ккал, белок не режьте.`; }
        else { verdict = 'on_track'; recommendation = `✅ На курсе: темп ${weightRatePctPerWeek}%/нед в цели. Ничего не меняем.`; }
      } else if (targetRate > 0) {
        // Набор/сила.
        if (diff < -0.1) { verdict = 'too_slow'; kcalAdjust = 150; recommendation = `Темп ${weightRatePctPerWeek}%/нед — набор медленнее цели ${targetRate}%/нед. Добавьте ~150 ккал (углеводы).`; }
        else if (diff > 0.3) { verdict = 'too_fast'; kcalAdjust = -150; recommendation = `Темп ${weightRatePctPerWeek}%/нед — быстрый набор (лишний жир). Уберите ~150 ккал.`; }
        else { verdict = 'on_track'; recommendation = `✅ Набор идёт: ${weightRatePctPerWeek}%/нед. Держим.`; }
      } else {
        // Рекомпозиция/поддержание.
        if (Math.abs(weightRatePctPerWeek) > 0.35) { verdict = 'too_fast'; kcalAdjust = weightRatePctPerWeek > 0 ? -150 : 150; recommendation = `Поддержание/рекомп: вес плывёт ${weightRatePctPerWeek}%/нед — скорректируйте ~150 ккал к стабильности.`; }
        else { verdict = 'on_track'; recommendation = `✅ Вес стабилен (${weightRatePctPerWeek}%/нед) — для рекомпа/поддержания норма.`; }
      }
    }
  }
  if (loggedDays >= 4 && adherencePct < 70 && verdict !== 'no_data') {
    recommendation += ` ⚠ Приверженность ${adherencePct}% — сначала выровняйте выполнение, потом меняйте ккал.`;
  }
  return { windowDays, loggedDays, avgKcal, avgProteinG, adherencePct, weightStartKg, weightEndKg, weightDeltaKg, weightRatePctPerWeek, targetRatePctPerWeek: targetRate, verdict, kcalAdjust, recommendation };
}
