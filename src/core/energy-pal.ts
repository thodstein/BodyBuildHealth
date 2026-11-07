/**
 * energy-pal.ts — чистые расчёты активности (PAL и тренировочная нагрузка).
 *
 * Вынесено из `core/data-link.ts` намеренно: `data-link` тянет движки рисков,
 * БАДов и лабораторий (~3 МБ данных), а виджетам APK нужен только PAL.
 * Любой импорт `derivePAL` из этого файла не тянет ничего лишнего.
 * См. docs/UI-PERF-PASS-2026-11.md.
 */

/** PAL (коэффициент физической активности) из числа тренировок и их длительности. */
export function derivePAL(workoutsPerWeek?: number, avgWorkoutMinutes?: number): number {
  const wpw = workoutsPerWeek ?? 3;
  const awm = avgWorkoutMinutes ?? 60;
  let p = 1.2 + wpw * 0.075;
  if (awm > 60) p += 0.05;
  if (awm > 90) p += 0.075;
  if (wpw >= 6) p += 0.05;
  return Math.max(1.2, Math.min(1.9, Math.round(p * 100) / 100));
}

/** Относительная тренировочная нагрузка (0.2…1.5) из недельного объёма. */
export function deriveTrainingLoad(workoutsPerWeek?: number, avgWorkoutMinutes?: number): number {
  const wpw = workoutsPerWeek ?? 3;
  const awm = avgWorkoutMinutes ?? 60;
  const weeklyMinutes = wpw * awm;
  const ratio = weeklyMinutes / 420;
  return Math.max(0.2, Math.min(1.5, Math.round(ratio * 100) / 100));
}
