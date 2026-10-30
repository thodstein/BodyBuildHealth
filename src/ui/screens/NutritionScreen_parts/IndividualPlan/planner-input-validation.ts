/**
 * planner-input-validation.ts — B27 (аудит 2026-10).
 *
 * Находка: инпут возраста допускал 120, а валидация отклоняла всё >100 — то есть
 * пользователь мог ввести значение, которое гарантированно не пройдёт проверку.
 * Теперь границы объявлены ОДИН раз (`PLANNER_BOUNDS`) и используются и инпутами,
 * и валидацией.
 */

export const PLANNER_BOUNDS = {
  weight: { min: 30, max: 250 },
  height: { min: 100, max: 250 },
  age: { min: 14, max: 100 },
  bodyFatPct: { min: 3, max: 60 },
  sleepHours: { min: 3, max: 14 },
} as const;

export interface PlannerInputValues {
  weight: number;
  height: number;
  age: number;
  sex: 'male' | 'female';
  bodyFatPct: number;
  lifeStage?: string;
  goal: string;
  sleepHours: number;
}

/** Вернуть текст ошибки или `null`, если ввод допустим. */
export function validatePlannerInputs(v: PlannerInputValues): string | null {
  const { weight, height, age, sex, bodyFatPct, lifeStage, goal, sleepHours } = v;

  if (weight < PLANNER_BOUNDS.weight.min) return 'Вес слишком низок (<30 кг). Проверьте значение.';
  if (weight > PLANNER_BOUNDS.weight.max) return 'Вес слишком высок (>250 кг). Проверьте значение.';
  if (height < PLANNER_BOUNDS.height.min) return 'Рост слишком низок (<100 см) — нереалистично для взрослого.';
  if (age < PLANNER_BOUNDS.age.min) return 'Возраст <14 лет. Планировщик не предназначен для детей и подростков.';
  if (age > PLANNER_BOUNDS.age.max) return `Возраст >${PLANNER_BOUNDS.age.max} лет. Проверьте значение.`;

  const bmi = weight / Math.pow(height / 100, 2);
  if (bmi < 14) return `BMI=${bmi.toFixed(1)} — критично низкий (<14). Возможна анорексия. Обсудите с лечащим врачом.`;
  if (bmi > 60) return `BMI=${bmi.toFixed(1)} — критично высокий (>60). Подходит только при медицинской поддержке.`;

  if (bodyFatPct > 0) {
    if (sex === 'male' && bodyFatPct < 3) return `% жира ${bodyFatPct}% — опасно низкий (<3% для мужчин). Риск потери ЛБМ и эндокринных нарушений.`;
    if (sex === 'female' && bodyFatPct < 8) return `% жира ${bodyFatPct}% — опасно низкий (<8% для женщин). Риск аменореи/RED-S.`;
  }

  if (sex === 'female' && lifeStage === 'pregnancy' && (goal === 'cutting' || goal === 'fat_loss')) {
    return 'Агрессивная сушка во время беременности недопустима. Установите цель «Поддержка» и проконсультируйтесь с гинекологом.';
  }

  if (sleepHours < 4) return 'Сон <4 ч критично низкий — расчёт КБЖУ с применением такого ввода опасен.';

  return null;
}
