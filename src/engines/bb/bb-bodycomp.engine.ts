/**
 * bb-bodycomp.engine.ts — P1: targetBodyFat-драйвер (состав тела → объём).
 *
 * Целевой % жира управляет агрессивностью дефицита и сохранением мышц:
 * - далеко от цели → удержание объёма на MEV (сохранение мышц, дефицит уже в goal);
 * - близко к цели → плановый объём (максимум сохранения);
 * - масса/без цели → нейтрально.
 *
 * Дополняет goal-модуляцию (cut ×0.72) УТОЧНЕНИЕМ по прогрессу к targetBodyFat,
 * не заменяя капы. Капы не меняются.
 */

/** Множитель объёма по дистанции до целевого % жира (для cut/recomp). */
export function bodyCompVolumeFactor(
  bodyFat: number | undefined,
  targetBodyFat: number | undefined,
  goal: string = 'mass',
): number {
  if (goal !== 'cut' && goal !== 'recomp') return 1.0;
  if (!Number.isFinite(bodyFat) || !Number.isFinite(targetBodyFat)) return 1.0;
  const bf = Math.max(3, Math.min(50, bodyFat as number));
  const target = Math.max(3, Math.min(50, targetBodyFat as number));
  const delta = bf - target; // сколько % нужно сбросить
  if (delta <= 0) return 1.0; // уже на цели — обычный объём (поддержание)
  if (delta <= 2) return 1.0; // близко — полный объём (сохранение)
  if (delta <= 5) return 0.97; // умеренный дефицит — чуть ниже
  return 0.95; // далеко — приоритет сохранения мышц (объём ближе к MEV)
}

/** RU-строка стратегии по составу тела. */
export function bodyCompStrategyNote(bodyFat: number | undefined, targetBodyFat: number | undefined, goal: string): string | null {
  if (goal !== 'cut' && goal !== 'recomp') return null;
  if (!Number.isFinite(bodyFat) || !Number.isFinite(targetBodyFat)) return null;
  const delta = (bodyFat as number) - (targetBodyFat as number);
  if (delta <= 0) return `Состав тела: уже у цели (${bodyFat}% ≤ ${targetBodyFat}%) — объём полный (поддержание).`;
  if (delta <= 2) return `Состав тела: близко к цели (${bodyFat}%→${targetBodyFat}%) — полный объём для сохранения мышц.`;
  if (delta <= 5) return `Состав тела: умеренный дефицит (${bodyFat}%→${targetBodyFat}%, осталось ${Math.round(delta)}%) — объём −3%.`;
  return `Состав тела: далеко от цели (${bodyFat}%→${targetBodyFat}%, осталось ${Math.round(delta)}%) — объём −5% (приоритет сохранения мышц).`;
}

/** Найти целевой % жира из тела цели (если не задан явно). */
export function defaultTargetBodyFat(sex: string, goal: string): number | undefined {
  if (goal !== 'cut' && goal !== 'recomp') return undefined;
  // Израэтель: нижняя граница здорового % жира.
  return sex === 'female' ? 18 : 10;
}
