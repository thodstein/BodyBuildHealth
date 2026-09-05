/**
 * planner-carb-density.ts — Итерация B (HIGH-VOLUME план, разд. 3.3–3.4).
 *
 * Проблема: добивка углеводов шла фруктом (E5) + одним comfort (F1) с капами 35–110 г —
 * недобор 300–500 г на high-carb днях закрывать нечем («батат ×5»).
 *
 * Решение:
 *  - DENSE_CARB_LADDER: ранжированная лестница плотности (напитки → сахаристые →
 *    выпечка → сухофрукты → плотные крупы). Порядок = fiber/У ascending; все id проверены
 *    по FOOD_DB (иначе движок пропускает отсутствующий).
 *  - EDIBILITY_CAPS: сколько реально съесть за раз (по продуктам, не по категориям).
 *  - isHighCarbDay(): гейт режима (≥6.5 г/кг или ≥600 г/день).
 *
 * Математика per100 не трогается — только выбор носителя и порционные потолки.
 */
import { FOOD_DB } from '../../../../core/nutrition-database';

export type DenseCarbKind = 'drink' | 'sugar' | 'bake' | 'dried' | 'grain';

export interface DenseCarbStep {
  id: string;
  kind: DenseCarbKind;
  /** Съедобная порция шага (г/мл) — потолок одной добивки. */
  maxG: number;
}

/** Лестница плотности: от нулевой клетчатки к крупам. */
export const DENSE_CARB_LADDER: DenseCarbStep[] = [
  { id: 'orange_juice', kind: 'drink', maxG: 400 },
  { id: 'dextrose', kind: 'drink', maxG: 60 },
  { id: 'honey', kind: 'sugar', maxG: 60 },
  { id: 'jam', kind: 'sugar', maxG: 55 },
  { id: 'marmalade', kind: 'sugar', maxG: 50 },
  { id: 'zefir', kind: 'sugar', maxG: 50 },
  { id: 'pastila', kind: 'sugar', maxG: 50 },
  { id: 'pryaniki', kind: 'bake', maxG: 80 },
  { id: 'sushki', kind: 'bake', maxG: 80 },
  { id: 'bread_white', kind: 'bake', maxG: 165 },
  { id: 'sugar_cookies', kind: 'bake', maxG: 60 },
  { id: 'dates', kind: 'dried', maxG: 60 },
  { id: 'raisins', kind: 'dried', maxG: 60 },
  { id: 'dried_apricots', kind: 'dried', maxG: 60 },
  { id: 'corn_flakes', kind: 'grain', maxG: 150 },
  { id: 'rice_white', kind: 'grain', maxG: 150 },
  { id: 'bread_white', kind: 'bake', maxG: 165 },
  { id: 'cream_of_rice', kind: 'grain', maxG: 150 },
];

/**
 * Съедобные потолки одной порции (г). Категорийные капы (300 г белка и т.п.) —
 * отдельно; здесь — кулинарная норма «сколько реально съесть».
 */
export const EDIBILITY_CAPS: Record<string, number> = {
  // Каши готовые / сухие
  rice_white: 450, rice_brown: 450, buckwheat: 450, pasta_durum: 450, potato_boiled: 450,
  oats: 450, oats_dry: 100, cream_of_rice: 400, corn_flakes: 150, bulgur: 450, millet: 400, barley: 450, quinoa: 400,
  // Хлеб/выпечка/сладости
  bread_white: 165, bread_rye: 165, pryaniki: 80, sushki: 80, sugar_cookies: 60,
  honey: 60, jam: 55, marmalade: 50, zefir: 50, pastila: 50,
  dates: 60, raisins: 60, dried_apricots: 60,
  orange_juice: 400, dextrose: 60,
  // Белок
  chicken_breast: 300, turkey_breast: 300, beef_lean: 300, salmon: 300, tuna_canned: 250,
  cottage_cheese_5: 250, egg_whole: 275,
  // Овощи/жиры
  broccoli: 300, cucumber: 300, tomato: 300,
  walnuts: 40, almonds: 40, olive_oil: 30,
};

/** Съедобный потолок продукта (fallback — переданный категорийный кап). */
export function edibilityCapFor(foodId: string, fallback: number): number {
  const v = EDIBILITY_CAPS[foodId];
  if (typeof v === 'number' && v > 0) return Math.min(v, fallback);
  return fallback;
}

/** Режим high-carb дня: ≥6.5 г/кг или ≥600 г (порог плотной добивки и carb-снеков). */
export function isHighCarbDay(totalCarbsG: number, weightKg: number): boolean {
  const w = Math.max(40, weightKg || 80);
  return totalCarbsG / w >= 6.5 || totalCarbsG >= 600;
}

/** Шаги лестницы, реально present в FOOD_DB (защита от битых id). */
export function liveLadderSteps(): DenseCarbStep[] {
  try {
    const ids = new Set(FOOD_DB.map(f => f.id));
    return DENSE_CARB_LADDER.filter(s => ids.has(s.id));
  } catch {
    return DENSE_CARB_LADDER;
  }
}
