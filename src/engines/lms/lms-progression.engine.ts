/**
 * lms-progression.engine.ts — прогрессия предельного максимума (PM) по неделям цикла.
 * Этап A3. Восстановлено из cycle1.xlsm: % корректировки PM (ячейка AH58 = 0.005 по умолчанию).
 *
 * PM_нед = PM0 × (1 + k)^нед
 *  k — недельный коэффициент корректировки:
 *    - натурал:  +0.5% (0.005)  — дефолт
 *    - на курсе ААС: +1.5..2.5% — выше восстановительный/анаболический потенциал
 *    - на ПКТ / выход из курса: отрицательный (−0.5..−1%) — нисходящая прогрессия, минимум потерь
 */

export type ProgressionMode = 'natural' | 'on_course' | 'pct' | 'custom';

export interface PMProgressionInput {
  pm0: number;           // исходный PM (кг)
  weeks: number;         // число недель цикла
  mode: ProgressionMode;
  /** Явный недельный % (для custom и уточнения on_course/pct). Например 0.005 = +0.5%. */
  weeklyPercent?: number;
  /** Уровень ААС-курса (влияет на default on_course). */
  courseIntensity?: 'mild' | 'moderate' | 'heavy';
}

export const DEFAULT_WEEKLY_PERCENT: Record<ProgressionMode, number> = {
  natural: 0.005,    // +0.5%
  on_course: 0.02,   // +2%
  pct: -0.005,       // −0.5%
  custom: 0.005,
};

/** Дефолтный % для on_course по интенсивности курса. */
export function courseDefaultPercent(intensity?: 'mild' | 'moderate' | 'heavy'): number {
  if (intensity === 'mild') return 0.015;     // +1.5%
  if (intensity === 'heavy') return 0.025;    // +2.5%
  return 0.02;                                 // moderate +2%
}

export function resolveWeeklyPercent(input: PMProgressionInput): number {
  if (input.weeklyPercent != null) return input.weeklyPercent;
  if (input.mode === 'on_course') return courseDefaultPercent(input.courseIntensity);
  return DEFAULT_WEEKLY_PERCENT[input.mode] ?? 0.005;
}

/** PM на конкретной неделе (1-индекс: неделя 1 = PM0×(1+k)^1? — в cycle1 прирост идёт с каждой неделей). */
export function pmForWeek(input: PMProgressionInput, weekNumber: number): number {
  const k = resolveWeeklyPercent(input);
  if (weekNumber <= 0) return input.pm0;
  return input.pm0 * Math.pow(1 + k, weekNumber);
}

/** Полный ряд PM по всем неделям цикла. */
export function pmProgression(input: PMProgressionInput): number[] {
  const k = resolveWeeklyPercent(input);
  const out: number[] = [];
  for (let w = 0; w < input.weeks; w++) {
    out.push(input.pm0 * Math.pow(1 + k, w));
  }
  return out;
}

/**
 * Расчёт рабочего веса подхода (вес грифа): вес = PM_нед x %интенсивности.
 * %интенсивности — доля от PM (0.68 = 68%), как в раскладках СРЦ. Множ (mnosz) — множитель тоннажа, не веса.
 */
export function workWeight(pmWeek: number, pctIntensity: number): number {
  // AUD-FIX-A: рабочий вес на грифе = PM x % от PM. Множ (mnosz) НЕ входит в вес грифа —
  // это множитель тоннажа/нагрузки, применяется в lms-metrics.calcTonnage по спеке A0:
  // Тоннаж = (Сумма вес*пов*под) * Множ. Прежнее включение mnosz в вес грифа давало
  // удвоение Множ (в весе и в тоннаже) -> раздутые рабочие веса и Инт.отн >100% для ассистентных.
  return Math.round(pmWeek * pctIntensity * 10) / 10;
}

/** Описание режима прогрессии для UI. */
export function progressionRationale(input: PMProgressionInput): string {
  const k = resolveWeeklyPercent(input);
  const sign = k >= 0 ? '+' : '';
  const pct = (k * 100).toFixed(2);
  const modeLabel: Record<ProgressionMode, string> = {
    natural: 'Натуральный режим',
    on_course: 'На курсе ААС',
    pct: 'ПКТ / выход из курса',
    custom: 'Ручная настройка',
  };
  const dir = k >= 0 ? 'восходящая прогрессия' : 'нисходящая прогрессия (минимум потерь)';
  return `${modeLabel[input.mode]}: PM растёт на ${sign}${pct}%/нед (${dir}). ` +
    `PM0=${input.pm0} кг → за ${input.weeks} нед: ${(input.pm0 * Math.pow(1 + k, input.weeks)).toFixed(1)} кг.`;
}
