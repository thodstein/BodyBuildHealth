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

/**
 * Недельный темп прогрессии ПМ по уровню спортсмена (Rhea 2003; Schoenfeld 2019).
 * Новички адаптируются быстрее (+1.5%/нед), продвинутые — медленнее (+0.5%/нед).
 * Это НИЖНЯЯ граница для натурала: если цикл задаёт более медленный correctionPct —
 * берётся levelK. На курсе применяется курсовая кривая (выше), на ПКТ — нисходящая.
 */
export const LEVEL_PM_K: Record<string, number> = {
  beginner: 0.015,     // +1.5%/нед — быстрый адаптационный рост
  intermediate: 0.008, // +0.8%/нед
  advanced: 0.005,     // +0.5%/нед — предел натурального роста
};

/** levelK (нижняя граница) по нормализованному уровню; null — если уровень не задан. */
export function levelPmFloor(level?: string): number | null {
  if (!level) return null;
  return LEVEL_PM_K[level.toLowerCase()] ?? null;
}

/** Дефолтный % для on_course по интенсивности курса. */
export function courseDefaultPercent(intensity?: 'mild' | 'moderate' | 'heavy'): number {
  if (intensity === 'mild') return 0.015;     // +1.5%
  if (intensity === 'heavy') return 0.025;    // +2.5%
  return 0.02;                                 // moderate +2%
}

export function resolveWeeklyPercent(input: PMProgressionInput): number {
  const value = input.weeklyPercent != null
    ? input.weeklyPercent
    : input.mode === 'on_course' ? courseDefaultPercent(input.courseIntensity) : DEFAULT_WEEKLY_PERCENT[input.mode] ?? 0.005;
  if (!Number.isFinite(value) || value <= -1) throw new Error('resolveWeeklyPercent: weekly percent must be finite and greater than -100%');
  return value;
}

/** PM на конкретной неделе (1-индекс: неделя 1 = PM0, прирост начинается со 2-й недели). */
export function pmForWeek(input: PMProgressionInput, weekNumber: number): number {
  if (!Number.isFinite(input.pm0) || input.pm0 <= 0) throw new Error('pmForWeek: pm0 must be > 0');
  const k = resolveWeeklyPercent(input);
  if (weekNumber <= 1) return input.pm0;
  return pmCap(input.pm0, k, input.pm0 * Math.pow(1 + k, weekNumber - 1));
}

/**
 * Cap PM growth to avoid runaway progression on long `weeksOverride` cycles.
 * Without a cap, a 52-week `on_course` heavy cycle (k=0.025) would project
 * PM × 3.56 (e.g., 200kg squat → 712kg). Real-world strength gains plateau
 * well before that. Caps:
 *   - on_course (heavy/moderate): ×1.5 (anabolics extend but don't eliminate ceiling)
 *   - on_course (mild): ×1.35
 *   - pct (PCТ): ×1.0 (no growth expected; cap is a safety net against rounding)
 *   - natural: ×1.25 (genetic ceiling, ~5-7% gain per 12-week mesocycle)
 *   - custom: ×1.5 (conservative; user takes responsibility)
 */
function pmCap(pm0: number, k: number, computed: number): number {
  if (k <= 0) return computed; // descending progression (PCT): no cap needed
  const capMultiplier = k > 0.02 ? 1.5 : k > 0.01 ? 1.35 : 1.25;
  return Math.min(computed, pm0 * capMultiplier);
}

/** Полный ряд PM по всем неделям цикла. */
export function pmProgression(input: PMProgressionInput): number[] {
  if (!Number.isFinite(input.pm0) || input.pm0 <= 0) throw new Error('pmProgression: pm0 must be > 0');
  if (!Number.isFinite(input.weeks) || input.weeks < 0) throw new Error('pmProgression: weeks must be >= 0');
  const k = resolveWeeklyPercent(input);
  const out: number[] = [];
  for (let w = 0; w < input.weeks; w++) {
    const raw = input.pm0 * Math.pow(1 + k, w);
    out.push(pmCap(input.pm0, k, raw));
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
  if (!Number.isFinite(input.pm0) || input.pm0 <= 0) throw new Error('progressionRationale: pm0 must be > 0');
  if (!Number.isFinite(input.weeks) || input.weeks < 1) throw new Error('progressionRationale: weeks must be >= 1');
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
  const verb = k >= 0 ? 'растёт' : 'снижается';
  return `${modeLabel[input.mode]}: PM ${verb} на ${sign}${pct}%/нед (${dir}). ` +
    `PM0=${input.pm0} кг → за ${input.weeks} нед: ${(input.pm0 * Math.pow(1 + k, input.weeks - 1)).toFixed(1)} кг.`;
}
