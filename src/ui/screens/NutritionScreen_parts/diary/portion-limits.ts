/**
 * portion-limits.ts — границы количества в очереди и в правке записи дневника.
 *
 * Раньше потолок был 1000 г: «+» в очереди и в редакторе записи молча
 * упирался в него, поэтому большие порции (рецепт на 6 порций, Meal Prep,
 * ×2 множитель в выборе рецепта) нельзя было выставить руками. 5 кг с запасом
 * закрывает любую реальную тарелку и остаётся защитой от опечатки.
 * но и вниз: сухая клетчатка меряется ложками (псиллиум 1 ч. л. = 4 г по
 * этикетке FDC), и флор 10 г молча завышал такую порцию в 2,5 раза. Защита от
 * нуля и мусора осталась — минимум 1 г, потолок 5 кг.
 */
export const MIN_ITEM_GRAMS = 1;
export const MAX_ITEM_GRAMS = 5000;

/** Приводит количество к допустимому диапазону; нечисло → fallback. */
export function clampItemGrams(value: number, fallback = 100): number {
  const parsed = Number(value);
  const base = Number.isFinite(parsed) ? Math.round(parsed) : fallback;
  return Math.max(MIN_ITEM_GRAMS, Math.min(MAX_ITEM_GRAMS, base));
}
