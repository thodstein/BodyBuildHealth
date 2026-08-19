/**
 * omega-index.engine.ts — абсолютный «омега-индекс» (доп. функция 6).
 *
 * Суммарный омега-3 (мг/день) по продуктам. Отдельных EPA/DHA в БД нет — используем
 * суммарный омега-3 как консервативный прокси целевого DHA+EPA ≥ 250 мг/день (AHA/EFSA).
 * Выход: omega3Mg, порог, статус и рекомендация.
 */
import { FOOD_DB } from '../core/nutrition-database';
import { getMicro } from '../core/nutrition-micros';

export const OMEGA3_TARGET_MG = 250;

export interface OmegaIndexInput {
  products: { foodId: string; weightGrams: number }[];
}

export interface OmegaIndexResult {
  omega3Mg: number;
  omega6Mg: number;
  ratio: number;
  targetMg: number;
  status: 'ok' | 'low';
  recommendation: string;
}

export function computeOmegaIndex(input: OmegaIndexInput): OmegaIndexResult {
  let omega3 = 0;
  let omega6 = 0;
  for (const p of (input.products || [])) {
    if (!(p.weightGrams > 0)) continue;
    const f = FOOD_DB.find(x => x.id === p.foodId);
    if (!f) continue;
    const w = p.weightGrams / 100;
    omega3 += (f.macro_100g?.omega_3_mg ?? getMicro(f, 'Omega3')) * w;
    omega6 += (f.macro_100g?.omega_6_mg ?? 0) * w;
  }
  omega3 = Math.round(omega3);
  omega6 = Math.round(omega6);
  const ratio = omega3 > 0 ? Math.round((omega6 / omega3) * 10) / 10 : (omega6 > 0 ? Infinity : 0);
  const status: OmegaIndexResult['status'] = omega3 >= OMEGA3_TARGET_MG ? 'ok' : 'low';

  const recommendation = status === 'ok'
    ? `Достаточно омега-3 (${omega3} мг ≥ ${OMEGA3_TARGET_MG} мг/день).`
    : `Низкий омега-3 (${omega3} мг < ${OMEGA3_TARGET_MG} мг/день): добавьте жирную рыбу (лосось/скумбрия), льняное/рыбий жир или семена чиа.`;

  return { omega3Mg: omega3, omega6Mg: omega6, ratio, targetMg: OMEGA3_TARGET_MG, status, recommendation };
}
