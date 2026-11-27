/**
 * fiber-target.ts — норма клетчатки на день для дневника питания.
 *
 * Источник (не выдумано): Adequate Intake клетчатки — 14 г на 1000 ккал, что
 * соответствует 25 г/сут для взрослых женщин и 38 г/сут для взрослых мужчин.
 * Dahl WJ, Stewart ML. Position of the Academy of Nutrition and Dietetics:
 * Health Implications of Dietary Fiber. J Acad Nutr Diet. 2015;115(11):1861-70.
 * PMID 26514720 · doi:10.1016/j.jand.2015.09.003.
 *
 * Поэтому норма в приложении масштабируется под ДНЕВНУЮ калорийную цель
 * пользователя: 1800 ккал → 25 г, 2500 ккал → 35 г. Это одна и та же норма
 * 14 г/1000 ккал, а не второй, «удобный» ориентир.
 */

/** Adequate Intake: 14 г пищевых волокон на каждые 1000 ккал рациона. */
export const FIBER_G_PER_1000_KCAL = 14;

/**
 * Норма клетчатки на день, г. Нет валидной калорийной цели — 0 («нет данных»),
 * чтобы UI не рисовал процент от придуманного числа.
 */
export function fiberTargetG(kcalTarget: number): number {
  const kcal = Number(kcalTarget);
  if (!Number.isFinite(kcal) || kcal <= 0) return 0;
  return Math.round((kcal * FIBER_G_PER_1000_KCAL) / 1000);
}

/** Процент выполнения нормы клетчатки. Без нормы — 0, NaN/Infinity не выходят наружу. */
export function fiberPct(value: number, target: number): number {
  const v = Number(value);
  const t = Number(target);
  if (!(t > 0) || !Number.isFinite(v)) return 0;
  const pct = Math.round((v / t) * 100);
  return Number.isFinite(pct) ? pct : 0;
}
