/**
 * ru-plural.ts — согласование числительных с существительными (русский).
 *
 * Зачем: тексты плана собираются шаблонами вида `\`${n} сетов\``, поэтому при
 * n = 1..4 получалось «1 недель», «3 тренировок», «2 сетов». Замер по 384
 * пользовательским текстам (отчёт/печать/rationale/валидация, 8 сплитов ×
 * 2 уровня × 1..6 недель): 1419 неверных форм.
 *
 * Важно: функция нужна только для ИМЕНИТЕЛЬНОГО счёта («3 сета», «4 недели»).
 * После предлогов и знаков сравнения нужен родительный падеж, и он уже верен:
 * «до 2 сетов», «из 4 сетов», «по 3 сета», «≥ 5 сетов» — такие места не трогаем.
 */

/** Формы существительного: [одно, 2–4, 5+]. */
export type RuPluralForms = readonly [one: string, few: string, many: string];

/** Нужная форма для числа `n`. */
export function ruForm(n: number, forms: RuPluralForms): string {
  const abs = Math.abs(Math.trunc(Number.isFinite(n) ? n : 0));
  const mod100 = abs % 100;
  const mod10 = abs % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

/** «N + слово» в правильной форме: `ruCount(3, RU_SETS)` → «3 сета». */
export function ruCount(n: number, forms: RuPluralForms): string {
  return `${n} ${ruForm(n, forms)}`;
}

export const RU_WEEKS: RuPluralForms = ['неделя', 'недели', 'недель'];
export const RU_TRAININGS: RuPluralForms = ['тренировка', 'тренировки', 'тренировок'];
export const RU_SETS: RuPluralForms = ['сет', 'сета', 'сетов'];
export const RU_EXERCISES: RuPluralForms = ['упражнение', 'упражнения', 'упражнений'];
export const RU_DAYS: RuPluralForms = ['день', 'дня', 'дней'];
