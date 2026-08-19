/**
 * hydration.engine.ts — гидратация и электролиты в рационе (доп. функция 10).
 *
 * Оценивает дневной баланс натрия/калия/магния из продуктов (вода отдельно ведётся
 * в водном балансе UI). Целевые ориентиры: Na ≤ 2300 мг, K ≥ 3500 мг, Mg ≥ 400 мг.
 * Статус и рекомендация по слабейшему звену.
 */
import { FOOD_DB } from '../core/nutrition-database';
import { getMicro } from '../core/nutrition-micros';

export interface HydrationInput {
  products: { foodId: string; weightGrams: number }[];
}

export interface HydrationResult {
  sodiumMg: number;
  potassiumMg: number;
  magnesiumMg: number;
  kNaRatio: number;
  sodiumHigh: boolean;
  potassiumLow: boolean;
  magnesiumLow: boolean;
  status: 'ok' | 'attention';
  recommendation: string;
}

export const NA_TARGET = 2300;
export const K_TARGET = 3500;
export const MG_TARGET = 400;

export function computeHydration(input: HydrationInput): HydrationResult {
  let na = 0, k = 0, mg = 0;
  for (const p of (input.products || [])) {
    if (!(p.weightGrams > 0)) continue;
    const f = FOOD_DB.find(x => x.id === p.foodId);
    if (!f) continue;
    const w = p.weightGrams / 100;
    na += getMicro(f, 'Na') * w;
    k += getMicro(f, 'K') * w;
    mg += getMicro(f, 'Mg') * w;
  }
  na = Math.round(na); k = Math.round(k); mg = Math.round(mg);
  const sodiumHigh = na > NA_TARGET;
  const potassiumLow = k < K_TARGET;
  const magnesiumLow = mg < MG_TARGET;
  const kNaRatio = na > 0 ? Math.round((k / na) * 10) / 10 : (k > 0 ? Infinity : 0);
  const status: HydrationResult['status'] = (sodiumHigh || potassiumLow || magnesiumLow) ? 'attention' : 'ok';

  const issues: string[] = [];
  if (sodiumHigh) issues.push(`натрий ${na} мг > ${NA_TARGET} (задержка воды/АД)`);
  if (potassiumLow) issues.push(`калий ${k} мг < ${K_TARGET}`);
  if (magnesiumLow) issues.push(`магний ${mg} мг < ${MG_TARGET}`);
  const recommendation = issues.length === 0
    ? 'Электролитный баланс в норме (Na/K/Mg).'
    : `Электролиты требуют внимания: ${issues.join('; ')}. ${potassiumLow ? 'Добавьте авокадо, шпинат, бананы. ' : ''}${magnesiumLow ? 'Добавьте орехи, семена, бобовые. ' : ''}${sodiumHigh ? 'Снизьте солёное/фастфуд.' : ''}`;

  return { sodiumMg: na, potassiumMg: k, magnesiumMg: mg, kNaRatio, sodiumHigh, potassiumLow, magnesiumLow, status, recommendation };
}
