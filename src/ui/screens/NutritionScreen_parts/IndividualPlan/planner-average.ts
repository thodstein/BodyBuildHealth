/**
 * planner-average.ts — B26 (аудит 2026-10).
 *
 * Находка: средние по плану делились на ЖЁСТКО заданные 3 и 7
 * (`Math.round(totals.kcal / 7)`), поэтому при фактически меньшем числе дней
 * (ошибка генерации, ручное удаление дня) среднее завышалось в 2+ раза.
 */

/** Средняя калорийность дня. Делит на ФАКТИЧЕСКОЕ число дней, минимум 1. */
export function avgKcalPerDay(totalKcal: number, daysCount: number): number {
  const n = Math.max(1, Math.floor(Number(daysCount) || 0));
  const total = Number(totalKcal);
  return Math.round((Number.isFinite(total) ? total : 0) / n);
}

/** То же для любого макроса (белок/жир/углеводы/клетчатка). */
export function avgPerDay(total: number, daysCount: number): number {
  return avgKcalPerDay(total, daysCount);
}
