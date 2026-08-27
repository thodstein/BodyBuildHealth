/**
 * metabolic-constants.ts — единые константы и хелперы метаболики
 * Централизует BMR/PAL для всех движков питания, чтобы разойтись не могли.
 * Источники: Mifflin 1990, Katch-McArdle 1991, EFSA 2010, Helms 2014.
 */

// ── clamp ──
export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));

// ── BMR ──
export function bmrKatchMcArdle(leanKg: number): number {
  return 370 + 21.6 * leanKg;
}
export function bmrMifflin(weightKg: number, heightCm: number, age: number, sex: 'male' | 'female'): number {
  return sex === 'male'
    ? 10 * weightKg + 6.25 * heightCm - 5 * age + 5
    : 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}
export interface BMRResult {
  bmr: number;
  lean: number;
  method: 'katch_mcardle' | 'mifflin';
}
export function computeBMR(input: { weight: number; height: number; age: number; sex: 'male' | 'female'; bodyFat?: number }): BMRResult {
  const bf = input.bodyFat;
  const hasBF = typeof bf === 'number' && bf > 3 && bf < 70;
  if (hasBF) {
    const lean = input.weight * (1 - bf! / 100);
    const bmr = Math.max(800, bmrKatchMcArdle(lean));
    return { bmr, lean, method: 'katch_mcardle' as const };
  }
  const bmr = Math.max(800, bmrMifflin(input.weight, input.height, input.age, input.sex));
  const leanDef = input.weight * (1 - (input.sex === 'male' ? 0.15 : 0.22));
  return { bmr, lean: leanDef, method: 'mifflin' as const };
}

// ── PAL ──
// Простая модель для хаба (low/medium/high + тренировочные дни/кардио)
export const PAL_BASE_MAP = { low: 1.40, medium: 1.55, high: 1.75 } as const;
export type PalLevel = 'low' | 'medium' | 'high';

export function computePalSimple(opts: {
  activityLevel?: PalLevel;
  trainingDays?: number;
  cardioMin?: number;
}): number {
  const palBase = PAL_BASE_MAP[opts.activityLevel ?? 'medium'];
  const trainAdd = clamp((opts.trainingDays ?? 3) * 0.022, 0, 0.14);
  const cardioAdd = clamp((opts.cardioMin ?? 0) / 60 * 0.025, 0, 0.10);
  return clamp(palBase + trainAdd + cardioAdd, 1.25, 2.25);
}

// Полная модель для планировщика (учитывает шаги/быт/NЕАТ/интенсивность)
export function computePalFull(opts: {
  workoutsPerWeek?: number;
  avgWorkoutMinutes?: number;
  dailySteps?: number;
  householdActivity?: string;
  trainType?: string;
  trainIntensity?: string;
  basePal?: number;
}): number {
  const wpw = opts.workoutsPerWeek ?? 0;
  const awm = opts.avgWorkoutMinutes ?? 0;
  let pal = opts.basePal ?? (1.2 + wpw * 0.075);
  if (opts.basePal === undefined) {
    if (awm > 60) pal += 0.1;
    if (awm > 90) pal += 0.05;
    if (wpw >= 6) pal += 0.05;
  }
  const steps = opts.dailySteps ?? 0;
  if (steps >= 15000) pal += 0.15;
  else if (steps >= 10000) pal += 0.1;
  else if (steps >= 7500) pal += 0.05;
  const ha = String(opts.householdActivity || '').toLowerCase();
  if (ha === 'active') pal += 0.15;
  else if (ha === 'moderate') pal += 0.1;
  else if (ha === 'light') pal += 0.05;
  const tt = String(opts.trainType || '').toLowerCase();
  if (tt === 'hiit') pal += 0.1;
  else if (tt === 'cardio') pal += 0.05;
  else if (tt === 'mixed') pal += 0.03;
  const ti = String(opts.trainIntensity || '').toLowerCase();
  if (ti === 'high') pal += 0.1;
  else if (ti === 'medium') pal += 0.05;
  return Math.min(1.9, Math.max(1.2, Math.round(pal * 1000) / 1000));
}

// ── cm → inch ──
export const toIn = (cm: number): number => cm * 0.393701;
export const log10 = (x: number): number => Math.log(x) / Math.log(10);

// ── Адаптивный тренд (совместим с nutrition-v2-data calcTrend) ──
export interface WeightPoint {
  date: string;
  kg: number;
}
export function calcTrendFromHistory(history: WeightPoint[]): number {
  if (!history || history.length < 3) return 0;
  const recent = history.slice(-7);
  if (recent.length < 2) return 0;
  const first = recent[0].kg;
  const last = recent[recent.length - 1].kg;
  const days = (new Date(recent[recent.length - 1].date).getTime() - new Date(recent[0].date).getTime()) / 86400000;
  if (days < 3) return 0;
  return (last - first) / (days / 7);
}

export function calcAdaptiveAdjustment(
  trendKgPerWeek: number,
  goal: 'cut' | 'maintain' | 'bulk' | 'health' | undefined,
  _baseTdee: number,
): { adjustment: number; expected: number; trend: number; suggest: string } {
  const isCut = goal === 'cut';
  const isBulk = goal === 'bulk';
  const isHealth = goal === 'health';
  let expected = 0;
  if (isCut) expected = -0.5;
  else if (isBulk) expected = 0.25;
  else if (isHealth) expected = 0;
  let adjustment = 0;
  if ((isCut || isBulk) && Math.abs(trendKgPerWeek - expected) > 0.05) {
    const diff = trendKgPerWeek - expected;
    adjustment = Math.round(diff * 770);
    adjustment = isCut ? clamp(adjustment, -500, 500) : clamp(adjustment, -300, 300);
  }
  if (isHealth && Math.abs(trendKgPerWeek) > 0.35) {
    // Для health — любой дрейф >0.35кг/нед — сигнал проверить калории
    adjustment = Math.round(trendKgPerWeek * 770 * 0.5);
    adjustment = clamp(adjustment, -250, 250);
  }
  let suggest = 'Тренд в норме';
  if (isHealth) {
    if (Math.abs(trendKgPerWeek) < 0.12) suggest = 'Вес стабилен — здоровье';
    else if (trendKgPerWeek > 0.3) suggest = 'Набор >0.3кг/нед — проверь профицит';
    else if (trendKgPerWeek < -0.3) suggest = 'Снижение >0.3кг/нед — проверь дефицит';
  } else if (isCut && trendKgPerWeek > -0.1 && trendKgPerWeek > expected * 0.5) suggest = 'Плато сушки — проверь дефицит или добавь 1000 шагов';
  else if (isBulk && trendKgPerWeek < 0.08) suggest = 'Набор стоит — +200ккал';
  else if (Math.abs(trendKgPerWeek - expected) < 0.12) suggest = 'Тренд совпадает с целью';
  void _baseTdee;
  return { adjustment, expected, trend: trendKgPerWeek, suggest };
}
