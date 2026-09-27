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

// ─── Волна 1: Экстремальные КБЖУ (1500г У / 500г Б) ───────────────────────────
// Проблема: статическая лестница DENSE_CARB_LADDER покрывает только «добивку»
// 600-1000г углеводов. При 1500г У нужно 8-10 носителей, чередующихся между
// приёмами с учётом квот семейств и капов съедобности.

export interface HvCarbCarrier {
  id: string;
  /** Плотность углеводов (г/100г) — для ранжирования. */
  carbPer100: number;
  /** Кап одной порции (г/мл) — реальный съедобный потолок. */
  portionCap: number;
  /** Гликемический индекс (для чередования быстрых/медленных). */
  gi: number;
  /** Жидкий носитель — для intra/post окон. */
  liquid?: boolean;
}

/**
 * Расширенная лестница HV-носителей для экстремальных углеводных дней.
 * Все id проверены по FOOD_DB. Порядок = от жидких к плотным.
 */
export const HV_CARB_CARRIERS: HvCarbCarrier[] = [
  // Жидкие (intra/post/peri)
  { id: 'orange_juice', carbPer100: 10, portionCap: 400, gi: 50, liquid: true },
  { id: 'dextrose', carbPer100: 95, portionCap: 60, gi: 100, liquid: true },
  { id: 'isoton', carbPer100: 6, portionCap: 500, gi: 40, liquid: true },
  { id: 'drink_isotonic', carbPer100: 6, portionCap: 500, gi: 40, liquid: true },
  // Сахаристые (быстрые)
  { id: 'honey', carbPer100: 80, portionCap: 60, gi: 50 },
  { id: 'jam', carbPer100: 65, portionCap: 55, gi: 60 },
  { id: 'marmalade', carbPer100: 60, portionCap: 50, gi: 60 },
  { id: 'zefir', carbPer100: 40, portionCap: 50, gi: 40 },
  { id: 'pastila', carbPer100: 50, portionCap: 50, gi: 50 },
  // Выпечка
  { id: 'pryaniki', carbPer100: 75, portionCap: 80, gi: 70 },
  { id: 'sushki', carbPer100: 75, portionCap: 80, gi: 70 },
  { id: 'bread_white', carbPer100: 50, portionCap: 165, gi: 70 },
  { id: 'sugar_cookies', carbPer100: 70, portionCap: 60, gi: 65 },
  { id: 'bread_rye', carbPer100: 45, portionCap: 165, gi: 65 },
  // Концентраты (сухофрукты)
  { id: 'dates', carbPer100: 65, portionCap: 60, gi: 55 },
  { id: 'raisins', carbPer100: 70, portionCap: 60, gi: 60 },
  { id: 'dried_apricots', carbPer100: 60, portionCap: 60, gi: 50 },
  { id: 'dried_banana_chips', carbPer100: 60, portionCap: 40, gi: 50 },
  // Крупы сухие (плотные носители)
  { id: 'corn_flakes', carbPer100: 80, portionCap: 150, gi: 80 },
  { id: 'rice_white', carbPer100: 75, portionCap: 450, gi: 70 },
  { id: 'cream_of_rice', carbPer100: 80, portionCap: 400, gi: 75 },
  { id: 'buckwheat', carbPer100: 65, portionCap: 450, gi: 55 },
  { id: 'oats_dry', carbPer100: 60, portionCap: 100, gi: 55 },
  { id: 'quinoa', carbPer100: 60, portionCap: 400, gi: 55 },
  { id: 'bulgur', carbPer100: 70, portionCap: 300, gi: 55 },
  { id: 'millet', carbPer100: 65, portionCap: 400, gi: 65 },
  { id: 'barley', carbPer100: 65, portionCap: 450, gi: 50 },
  // Картофель/батат (варёные)
  { id: 'potato_boiled', carbPer100: 17, portionCap: 300, gi: 70 },
  { id: 'sweet_potato', carbPer100: 20, portionCap: 300, gi: 60 },
  { id: 'potato_baked', carbPer100: 20, portionCap: 300, gi: 70 },
];

export interface HvCarrierSelection {
  carriers: HvCarbCarrier[];
  liquidCarriers: HvCarbCarrier[];
  solidCarriers: HvCarbCarrier[];
  totalCapacity: number;
}

/**
 * Выбирает набор носителей для HV-дня с учётом:
 * - Квоты семейства (не более 3-4 приёмов на семейство крупы)
 * - Капов съедобности
 * - Разнообразия (не повторять носитель в соседних приёмах)
 * - Баланса GI (чередовать быстрые/медленные)
 */
export function selectHvCarbCarriers(
  targetCarbsG: number,
  weightKg: number,
  opts: { mealsCount?: number; recentCarrierIds?: Set<string> } = {},
): HvCarrierSelection {
  const mealsCount = Math.max(6, opts.mealsCount || 8);
  const recent = opts.recentCarrierIds || new Set<string>();
  const available = HV_CARB_CARRIERS.filter(c => {
    try {
      return FOOD_DB.some(f => f.id === c.id);
    } catch { return true; }
  });
  const liquid = available.filter(c => c.liquid);
  const solid = available.filter(c => !c.liquid);
  const perMealTarget = targetCarbsG / mealsCount;
  const carriers: HvCarbCarrier[] = [];
  const usedFamilies = new Map<string, number>();
  const familyOf = (id: string): string => {
    if (/rice|cream_of_rice/.test(id)) return 'rice';
    if (/oats/.test(id)) return 'oats';
    if (/buckwheat/.test(id)) return 'buckwheat';
    if (/quinoa/.test(id)) return 'quinoa';
    if (/bulgur/.test(id)) return 'bulgur';
    if (/millet/.test(id)) return 'millet';
    if (/barley/.test(id)) return 'barley';
    if (/potato|sweet_potato/.test(id)) return 'potato';
    if (/bread/.test(id)) return 'bread';
    if (/dates|raisins|dried_apricots|dried_banana/.test(id)) return 'dried_fruit';
    if (/honey|jam|marmalade|zefir|pastila/.test(id)) return 'sweets';
    if (/juice|dextrose|isoton/.test(id)) return 'liquid';
    if (/flakes|cookies|pryaniki|sushki/.test(id)) return 'bake';
    return 'other';
  };
  const maxFamilyUses = Math.max(2, Math.floor(mealsCount / 3));
  const pickForMeal = (mealIdx: number, isLiquid: boolean): HvCarbCarrier | null => {
    const pool = isLiquid ? liquid : solid;
    const candidates = pool.filter(c => {
      const fam = familyOf(c.id);
      const uses = usedFamilies.get(fam) || 0;
      if (uses >= maxFamilyUses) return false;
      if (recent.has(c.id) && mealIdx < 2) return false;
      return true;
    });
    if (candidates.length === 0) return null;
    const targetDensity = perMealTarget > 100 ? 60 : perMealTarget > 60 ? 40 : 20;
    candidates.sort((a, b) => {
      const aDist = Math.abs(a.carbPer100 - targetDensity);
      const bDist = Math.abs(b.carbPer100 - targetDensity);
      const aRecent = recent.has(a.id) ? 10 : 0;
      const bRecent = recent.has(b.id) ? 10 : 0;
      return (aDist + aRecent) - (bDist + bRecent);
    });
    const picked = candidates[0];
    const fam = familyOf(picked.id);
    usedFamilies.set(fam, (usedFamilies.get(fam) || 0) + 1);
    return picked;
  };
  for (let i = 0; i < mealsCount; i++) {
    const isLiquid = i === 0 || i === mealsCount - 1;
    const carrier = pickForMeal(i, isLiquid);
    if (carrier) carriers.push(carrier);
  }
  const totalCapacity = carriers.reduce((s, c) => s + c.portionCap, 0);
  return {
    carriers,
    liquidCarriers: carriers.filter(c => c.liquid),
    solidCarriers: carriers.filter(c => !c.liquid),
    totalCapacity,
  };
}

export interface ExtremeQuotaScale {
  oil: number;
  nuts: number;
  egg: number;
  fruit: number;
  powder: number;
  family: number;
}

/**
 * Масштабирует порционные квоты для экстремальных дней.
 * При 1500г У / 500г Б стандартные квоты (масло 15г, соусы 30г) слишком узкие.
 * Возвращает null для обычных дней (байт-в-байт поведение).
 */
export function scalePortionCapsForExtreme(
  targetKcal: number,
  targetCarbsG: number,
  targetProteinG: number,
): ExtremeQuotaScale | null {
  const isExtreme = targetCarbsG >= 1200 || targetProteinG >= 400 || targetKcal >= 7000;
  if (!isExtreme) return null;
  const scale = Math.min(1.5, Math.max(1, targetKcal / 5000));
  return {
    oil: Math.round(15 * scale),
    nuts: Math.round(60 * Math.min(1.5, scale)),
    egg: Math.round(230 * Math.min(1.3, scale)),
    fruit: Math.min(6, Math.round(4 * scale)),
    powder: Math.min(3, Math.max(2, Math.round(2 * scale))),
    family: Math.min(5, Math.max(3, Math.round(3 * scale))),
  };
}

/**
 * Прогрессивный кап белка на приём для экстремальных дней.
 * При 500г белка и 10 приёмах = 50г/приём — стандартный кап 45-75г не подходит.
 */
export function hvProteinCapPerMeal(
  totalProteinG: number,
  mealsCount: number,
  weightKg: number,
): number {
  const perMeal = totalProteinG / mealsCount;
  const base = perMeal <= 40 ? perMeal : perMeal <= 60 ? perMeal * 1.1 : Math.min(perMeal * 1.2, 350);
  const weightBonus = Math.max(1, Math.min(1.3, weightKg / 80));
  return Math.round(base * weightBonus);
}

/**
 * Авто-расширение числа приёмов для HV-дней.
 * При 1500г углеводов нужно минимум 8 приёмов (по 150-180г углеводов на приём).
 */
export function autoMealCountForHv(
  targetCarbsG: number,
  targetProteinG: number,
  weightKg: number,
  baseMealsCount: number,
): number {
  const isHv = targetCarbsG >= 1200 || targetProteinG >= 400;
  if (!isHv) return baseMealsCount;
  const byCarbs = Math.ceil(targetCarbsG / 180);
  const byProtein = Math.ceil(targetProteinG / 50);
  const needed = Math.max(byCarbs, byProtein, 8);
  return Math.min(needed, 12);
}
