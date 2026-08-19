/**
 * evening-sleep.engine.ts — вечерний приём vs сон (доп. функция 8).
 *
 * Оценивает «вечерний» приём (перед сном) по снотворным нутриентам:
 * - триптофан (из амино-профиля) — предшественник серотонина/мелатонина;
 * - магний (микро) — расслабление ЦНС/мышц.
 * Пороги (консервативные): триптофан ≥ 250 мг, магний ≥ 200 мг в вечернем приёме.
 */
import { FOOD_DB } from '../core/nutrition-database';
import { getMicro } from '../core/nutrition-micros';

export const TRYPTOPHAN_TARGET_MG = 250;
export const MAGNESIUM_TARGET_MG = 200;

export interface EveningSleepResult {
  tryptophanMg: number;
  magnesiumMg: number;
  status: 'good' | 'partial' | 'low';
  recommendation: string;
}

export function analyzeEveningSleep(products: { foodId: string; weightGrams: number }[]): EveningSleepResult {
  let tryptophan = 0;
  let magnesium = 0;
  for (const p of (products || [])) {
    if (!(p.weightGrams > 0)) continue;
    const f = FOOD_DB.find(x => x.id === p.foodId);
    if (!f) continue;
    const w = p.weightGrams / 100;
    tryptophan += (f.amino_acid_profile_100g?.tryptophan_mg ?? 0) * w;
    magnesium += getMicro(f, 'Mg') * w;
  }
  tryptophan = Math.round(tryptophan);
  magnesium = Math.round(magnesium);

  const good = tryptophan >= TRYPTOPHAN_TARGET_MG && magnesium >= MAGNESIUM_TARGET_MG;
  const partial = tryptophan >= TRYPTOPHAN_TARGET_MG || magnesium >= MAGNESIUM_TARGET_MG;
  const status: EveningSleepResult['status'] = good ? 'good' : partial ? 'partial' : 'low';

  const recommendation = good
    ? 'Вечерний приём хорошо поддерживает сон (триптофан + магний).'
    : partial
      ? `Частичная поддержка сна (триптофан ${tryptophan} мг / магний ${magnesium} мг) — добавьте недостающий компонент.`
      : `Низкая поддержка сна (триптофан ${tryptophan} мг, магний ${magnesium} мг). Добавьте индейку/творог (триптофан), орехи/шпинат (магний).`;

  return { tryptophanMg: tryptophan, magnesiumMg: magnesium, status, recommendation };
}
