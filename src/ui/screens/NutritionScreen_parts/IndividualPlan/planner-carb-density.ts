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
  rice_white: 450, rice_brown: 450, buckwheat: 450, pasta_durum: 450, potato_boiled: 300,
  oats: 450, oats_dry: 100, cream_of_rice: 400, corn_flakes: 150, bulgur: 300, millet: 400, barley: 450, quinoa: 400,
  // E-PLATE (planner-edibility): низкоплотные варёные крахмалы — «не горы» никогда:
  // картофель/батат/булгур ≤300 г в одни руки (угли дня несут плотные носители: крем/рис/хлеб).
  sweet_potato: 300, potato_baked: 300,
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
  // P5-realism: стеблевые/листовые овощи-наполнители (проба: «сельдерей 244 г») —
  // объём тарелки не набирается водой: ≤150 г на приём. Плотные овощи остаются 300.
  celery: 150, veg_celery_stalks: 150, veg_celerysticks: 150, veg_celery_root: 150,
  arugula: 150, veg_arugula: 150, veg_lettuce_romaine: 150, veg_lettuce_iceberg: 150,
  veg_endive: 150, greens_endive: 150, veg_watercress: 150, greens_watercress: 150, veg_kohlrabi: 250,
  walnuts: 40, almonds: 40, olive_oil: 30,
};

/** Съедобный потолок продукта (fallback — переданный категорийный кап).
 *  mult — множитель экстремального профиля (инсулин/≥8 г/кг): только расширяет
 *  «съедобную» порцию, но никогда не выше переданного категорийного капа. */
export function edibilityCapFor(foodId: string, fallback: number, mult = 1): number {
  const v = EDIBILITY_CAPS[foodId];
  if (typeof v === 'number' && v > 0) {
    // §3A: экстремальный множитель применяем только к УГЛЕВОДНЫМ носителям —
    // мясо/творог/яйца не растут (иначе белок дня уходит за цель на +20–30%).
    let m = mult;
    if (m !== 1) {
      try {
        const f = FOOD_DB.find(x => x.id === foodId);
        if (!f || (f.carbs || 0) < 20) m = 1;
      } catch { m = 1; }
    }
    return Math.min(Math.round(v * m), fallback);
  }
  return fallback;
}

/** Режим high-carb дня: ≥6.5 г/кг или ≥600 г (порог плотной добивки и carb-снеков). */
export function isHighCarbDay(totalCarbsG: number, weightKg: number): boolean {
  const w = Math.max(40, weightKg || 80);
  return totalCarbsG / w >= 6.5 || totalCarbsG >= 600;
}

/**
 * EXTREME-профиль ёмкости (план NUTRITION-EXTREME-SCALE-PRO §3A).
 * На больших единицах (1500У/500Б, инсулин, ≥8 г/кг, ≥1200 г У) физически нельзя
 * уложиться в «нормальные» капы (тарелка 700, снек 120, сухая крупа 170): реальный
 * атлет ест больше за раз и добирает жидкостями. Профиль расширяет ТОЛЬКО порционные
 * потолки; математика целей/кап углеводов дня не трогается. Обычные дни (не active) —
 * байт-в-байт прежнее поведение.
 */
export interface ExtremeCapacityProfile {
  active: boolean;
  /** Множитель тарелки/порции (700→805/910, но не выше потолков ниже). */
  plateMult: number;
  /** Кап углеводов перекуса (120 → 150/180). */
  snackCarbCap: number;
  /** Потолок сухой крупы на приём (170 → 200/240). */
  dryGrainCap: number;
  /** Абсолютный потолок одной позиции (600 → 700/800). */
  itemCap: number;
  /** Множитель съедобных капов продуктов (EDIBILITY ×1.15/×1.3). */
  edibilityMult: number;
  /** Потолок твёрдой тарелки рецептурного приёма (730 → 850/900). */
  recipePlate: number;
}

export const DEFAULT_EXTREME_CAPACITY: ExtremeCapacityProfile = {
  active: false, plateMult: 1, snackCarbCap: 120, dryGrainCap: 170, itemCap: 600, edibilityMult: 1, recipePlate: 730,
};

export function extremeCapacityProfile(input: {
  insulinUnits?: number; carbsG?: number; weightKg?: number; goalKcal?: number; highVolumeDay?: boolean;
}): ExtremeCapacityProfile {
  const w = Math.max(40, input.weightKg || 80);
  const carbs = Math.max(0, input.carbsG || 0);
  const cPerKg = carbs / w;
  const insulin = Math.max(0, input.insulinUnits || 0);
  // Гейт: инсулин/≥8 г/кг/≥1200 г/≥7000 ккал. Обычные HV-дни (600–1000 г без инсулина)
  // остаются на прежних капах — их калибровки не трогаем. (Все условия гейта ⇒ день
  // highVolumeDay по определению движка, поэтому отдельный флаг не требуется.)
  const hv = insulin > 0 || cPerKg >= 8 || carbs >= 1200 || (input.goalKcal || 0) >= 7000;
  if (!hv) return { ...DEFAULT_EXTREME_CAPACITY };
  const extreme = cPerKg >= 8 || insulin >= 20 || carbs >= 1200;
  return {
    active: true,
    plateMult: extreme ? 1.3 : 1.15,
    snackCarbCap: extreme ? 180 : 150,
    dryGrainCap: extreme ? 240 : 200,
    itemCap: extreme ? 800 : 700,
    edibilityMult: extreme ? 1.3 : 1.15,
    recipePlate: extreme ? 900 : 850,
  };
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
