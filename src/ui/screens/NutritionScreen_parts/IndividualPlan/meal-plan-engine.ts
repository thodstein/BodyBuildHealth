/**
 * meal-plan-engine.ts — профессиональный движок генерации рациона бодибилдера.
 *
 * Принципы (на основе клинической спортивной диетологии):
 *   1. Muscle Protein Synthesis (MPS): 0.3–0.4 г белка/кг LBM на приём,
 *      порог лейцина ≥2.5 г для запуска mTOR, интервал 3–5ч.
 *   2. Carb periodization: тренировочный день → углеводы в функциональные окна
 *      (pre-/intra-/post-workout), день отдыха → равномерно + акцент вечером.
 *   3. Fat residual: жиры как остаток после белка и углеводов, мин 0.8 г/кг.
 *   4. Peri-workout protocol:
 *      -90 мин pre-W: белок 25–30 г + медленные углеводы 30–50 г, жиры ≤5 г.
 *      intra-W: EAA 10–15 г + циклический декстрин 30–60 г/ч (тяжёлые дни).
 *      +60 мин post-W: сыворотка 30–40 г + быстрые углеводы 40–80 г.
 *   5. Real-food meal assembly: приём пищи = белковый источник + углеводный
 *      источник + овощная порция + Fat source (по расписанию), а не «первые
 *      2 продукта из пула».
 *   6. Food synergy: витамин C × железо (растительное), жиры × ADEK,
 *      пиперин × куркумин; конфликты: оксалаты × кальций, танины × железо.
 *   7. Diversity: ≥8 уникальных продуктов/день для микронутриентной coverage.
 *
 * Вход: FoodItem[] (полный FOOD_DB), цели по KBJU, профиль (вес/LBM/цель/
 * фаза курса), тренировочный календарь, протокол тренировки (время начала).
 * Выход: DayPlan (массив meals с items, totals, заметками по MPS/нутритаймингу).
 */

import { FOOD_DB, FOOD_ALLERGEN_DIET } from "../../../../core/nutrition-database";
import type { FoodItem } from "../../../../core/nutrition-database";

// ─── Публичные типы ────────────────────────────────────────────────────
export interface MealItem {
  id: string; name: string; amount: number;
  kcal: number; p: number; f: number; c: number; fiber: number;
  leucine_mg?: number;
  role: 'protein' | 'fast_protein' | 'slow_protein' | 'carb_slow' | 'carb_fast' | 'fat' | 'veg' | 'fruit' | 'supplement' | 'liquid';
}

export interface Meal {
  label: string; time: string;
  items: MealItem[];
  totals: { kcal: number; p: number; f: number; c: number; fiber: number; leucine_mg: number };
  type: 'breakfast' | 'lunch' | 'snack' | 'preworkout' | 'intra' | 'postworkout' | 'dinner' | 'presleep';
  rationale: string[];
  mpsCheck?: { proteinG: number; leucineG: number; triggers_mTOR: boolean };
  target?: { p: number; c: number; f: number };
}

export interface DayPlanV2 {
  dayIndex: number;
  isTrainingDay: boolean;
  meals: Meal[];
  totals: { kcal: number; p: number; f: number; c: number; fiber: number; leucine_mg: number };
  mpsSummary: { feedings: number; avg_leucine_g: number; avg_protein_per_meal_g: number; intra_workout: boolean; prePostWindow: boolean };
  diversity: { uniqueFoods: number; categories: Record<string, number> };
  notes: string[];
}

export interface MealPlanInput {
  weightKg: number;
  lbmKg: number;
  bodyFatPct?: number;
  sex?: 'male' | 'female';
  goalKcal: number;
  goalProteinG: number;
  goalFatG: number;
  goalCarbsG: number;
  mealsCount: number;
  isTrainingDay: boolean;
  trainStartMin?: number;
  allowIntraWorkout?: boolean;
  excludedIds?: Set<string>;
  preferredIds?: Set<string>;
  budget: 'low' | 'medium' | 'max' | 'enhanced';
  isVegetarian?: boolean;
  isCutting?: boolean;
  dayOffset: number;
  cyclePhase?: 'course' | 'pct' | 'cutting' | 'bridge' | 'recovery' | 'maintenance';
  randomSalt?: number;
  variety?: 'minimal' | 'medium' | 'max';
  // P1.2: Foods locked by user — must be included in plan (same food, recalculated grams)
  lockedIds?: Set<string>;
  // P1.3: Foods used in recent days — deprioritized to avoid repetition
  recentFoodIds?: Set<string>;
  // FIX 1: User-set meal times (overrides hardcoded defaults)
  wakeTime?: string;
  lunchTime?: string;
  dinnerTime?: string;
  bedTime?: string;
  // Plan type multipliers (keto, highcarb, mediterranean, vegetarian)
  planTypeMod?: { pMult: number; fMult: number; cMult: number };
  // Evening low-carb: reduce dinner carbs, increase lunch carbs
  eveningLowCarb?: boolean;
}

// ─── Константы (клинические ориентиры) ─────────────────────────────────
const LEU_THRESHOLD_MG = 2500;
const MPS_LBM_LOW = 0.3;
const MPS_LBM_HIGH = 0.4;
const FAT_FLOOR_PER_KG = 0.8;
const CARB_FLOOR_G = 130;
const PREW_PROTEIN_G = 25;
const PREW_CARB_SLOW_G = 40;
const PREW_FAT_MAX_G = 5;
const POSTW_FAST_PROTEIN_G = 35;
const POSTW_FAST_CARB_G = 60;
const INTRA_EAA_G = 12;
const INTRA_CARB_G_PER_H = 40;
// Максимально допустимые порции для добавок (г) — защита от абсурдных доз
const SUPPLEMENT_MAX_G: Record<string, number> = {
  creatine: 10, whey_isolate: 60, whey_protein: 60, whey_concentrate: 60,
  casein: 60, casein_micellar: 60, bcaa: 20, supp_eaa: 20,
  glutamine: 15, supp_hmb: 6, supp_beta_alanine: 6, supp_citrulline_dl_malate: 12,
  supp_agmatine_sulfate: 2, supp_l_carnitine_tartrate: 4, supp_alpha_gpc: 2,
  amylopectin: 80, dextrose: 80, collagen_hydrolysate: 20,
};
// Глобальный лимит на одну порцию любого продукта (г)
const MAX_GRAM_PER_ITEM = 500;

const MEAT_KEYWORDS = ['beef','pork','chicken','turkey','lamb','veal','duck','salmon','tuna','shrimp','cod','mackerel','trout','sardine','crab','lobster','squid','octopus','venison','rabbit','goose','pate','sausage','bacon','ham','pepperoni','salami','bologna','hot_dog','meatball','cutlet','steak','pollock','tilapia','herring','anchovy','clam','mussel','oyster','scallops','catfish','flounder','sole','white_fish','whelk','cockles','seafood_','protein_','fish_','_fish','mintai','mahi','trumpeter','shellfish','cockle','abalone','conch','snail','escargot','sea_urchin','sea_cucumber','caviar','roe','liver','kidney','heart_tripe','tongue','brain','sweetbread','gizzard'];
const isMeatId = (id: string): boolean => MEAT_KEYWORDS.some(k => id.toLowerCase().includes(k));

// ─── Источники белковой ротации (только существующие ID в FOOD_DB) ──────
const PROTEIN_ROTATION: { label: string; ids: string[]; note: string }[] = [
  { label: 'Птица', ids: ['chicken_breast','turkey_breast','chicken_thigh'], note: 'Низкожирный цельный белок, высокий DIAAS (≈1.18)' },
  { label: 'Жирная рыба (Omega-3)', ids: ['salmon','mackerel','sardines','red_fish'], note: 'EPA/DHA + природный креатин, противовоспалительный эффект' },
  { label: 'Постная рыба', ids: ['cod','pollock','white_fish_cod','white_fish_mintai','tuna_steak'], note: 'Самая высокая плотность белка, низкий жир, идеальна ночью' },
  { label: 'Красное мясо', ids: ['beef_lean','beef_minced','beef_liver','rabbit'], note: 'Гемовое железо + Zn + B12, креатин 4–5 г/кг' },
  { label: 'Яйца/молоко', ids: ['egg_whole','egg_white','cottage_cheese_5','yogurt_greek'], note: 'Биологическая ценность яйца = 100, казеин = 77' },
  { label: 'Морепродукты', ids: ['shrimp','tuna_canned'], note: 'Йод + таурин, низкокалорийно' },
  { label: 'Сыворотка/молоко', ids: ['whey_protein','whey_isolate','milk','kefir'], note: 'Сыворотка — самый быстрый белок, пик аминокислот 60 мин' },
  { label: 'Веган/бобовые', ids: ['tofu','tempeh','lentils','chickpeas','seitan'], note: 'Растительный белок, дополнить сывороткой для лейцина' },
];

function pickRotation(dayOffset: number): { label: string; ids: string[]; note: string } {
  return PROTEIN_ROTATION[Math.abs(dayOffset) % PROTEIN_ROTATION.length] || PROTEIN_ROTATION[0];
}

// ─── Утилиты: детерминированный выбор ─────────────────────────────────
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9999) * 10000;
  return x - Math.floor(x);
}

function pick<T>(arr: T[], seed: number): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(seededRandom(seed) * arr.length)];
}

// FIX 2: Quality-weighted pick — foods with higher bb_quality_score get proportionally higher selection probability
function pickWeighted(arr: FoodItem[], seed: number): FoodItem | undefined {
  if (arr.length === 0) return undefined;
  if (arr.length === 1) return arr[0];
  const weights = arr.map(f => {
    const score = (f as any).bb_quality_score ?? 5;
    // Weight = score^1.5 so score 9 is ~3x more likely than score 5
    return Math.max(0.5, Math.pow(score, 1.5));
  });
  const total = weights.reduce((s, w) => s + w, 0);
  let r = seededRandom(seed) * total;
  for (let i = 0; i < arr.length; i++) {
    r -= weights[i];
    if (r <= 0) return arr[i];
  }
  return arr[arr.length - 1];
}

// P1.2: Pick from pool, but prefer locked foods, then preferred, then deprioritize recent
function pickPriority<T extends { id: string }>(arr: T[], seed: number, opts?: { lockedIds?: Set<string>; preferredIds?: Set<string>; recentIds?: Set<string> }): T | undefined {
  if (arr.length === 0) return undefined;
  const locked = opts?.lockedIds;
  const preferred = opts?.preferredIds;
  const recent = opts?.recentIds;
  // 1. Locked foods get absolute priority
  if (locked && locked.size > 0) {
    const lockedPool = arr.filter(f => locked.has(f.id));
    if (lockedPool.length > 0) return lockedPool[Math.floor(seededRandom(seed) * lockedPool.length)];
  }
  // 2. Preferred foods get next priority (already handled by caller for most cases, but as fallback)
  if (preferred && preferred.size > 0) {
    const prefPool = arr.filter(f => preferred.has(f.id));
    if (prefPool.length > 0) return prefPool[Math.floor(seededRandom(seed) * prefPool.length)];
  }
  // 3. Deprioritize recent foods: filter them out if enough alternatives exist
  if (recent && recent.size > 0) {
    const freshPool = arr.filter(f => !recent.has(f.id));
    if (freshPool.length >= Math.min(3, arr.length)) {
      return freshPool[Math.floor(seededRandom(seed) * freshPool.length)];
    }
  }
  // 4. Quality-weighted pick (higher bb_quality_score = higher chance)
  return pickWeighted(arr as any as FoodItem[], seed) as any as T;
}

// ─── Дескриптор лейцина в продукте (мг/100 г) ──────────────────────────
function getLeucine(food: FoodItem): number {
  return food.amino_acid_profile_100g?.leucine_mg ?? food.micros?.Leucine ?? Math.round((food.protein || 0) * 85);
}

// ─── Граммовка для достижения цели по макросу ─────────────────────────
function gramsForMacro(food: FoodItem, targetG: number, macro: 'protein' | 'carbs' | 'fat'): number {
  const per100 = macro === 'protein' ? (food.protein || 0) : macro === 'carbs' ? (food.carbs || 0) : (food.fat || 0);
  if (per100 <= 0) return 0;
  // Role-aware minimum: fat-dense foods (oils, nuts) need smaller min grams
  const minG = macro === 'fat' && per100 >= 80 ? 5 : macro === 'fat' && per100 >= 50 ? 10 : 20;
  const base = Math.min(MAX_GRAM_PER_ITEM, Math.max(minG, Math.round(targetG / per100 * 100)));
  const supplementCap = SUPPLEMENT_MAX_G[food.id];
  return supplementCap ? Math.min(supplementCap, base) : base;
}

function makeItem(food: FoodItem, grams: number, role: MealItem['role']): MealItem {
  const r = grams / 100;
  return {
    id: food.id, name: food.name, amount: Math.round(grams), role,
    kcal: Math.round((food.kcal || 0) * r),
    p: Math.round((food.protein || 0) * r),
    f: Math.round((food.fat || 0) * r),
    c: Math.round((food.carbs || 0) * r),
    fiber: Math.round((food.fiber || 0) * r),
    leucine_mg: Math.round(getLeucine(food) * r),
  };
}

// ─── Пулы продуктов по ролям (с фильтром аллергенов и диеты) ───────────
function buildFoodPools(excludedIds: Set<string>, isVeg: boolean, budget: MealPlanInput['budget'], varietyPoolSize?: number) {
  const isMealFood = (f: FoodItem) =>
    f.category !== 'supplement' && !['whey_protein','casein'].includes(f.id);
  const basePool = FOOD_DB.filter(f => {
    if (excludedIds.has(f.id)) return false;
    if (!isMealFood(f)) return false;
    if (isVeg) { const diet = FOOD_ALLERGEN_DIET[f.id]; if ((diet && diet.isVegetarian === false) || f.isVegetarian === false || (isMeatId(f.id) && !f.isVegetarian && !f.isVegan)) return false; }
    return true;
  });
  const byBudget = <T extends FoodItem>(arr: T[]): T[] => {
    if (budget === 'max' || budget === 'enhanced') return arr.filter(f => (f.bb_quality_score ?? 5) >= 8);
    if (budget === 'low') return arr.filter(f => (f.bb_quality_score ?? 5) <= 7);
    return arr;
  };
  const pSolid = byBudget(basePool.filter(f => (f.category === 'protein' || f.category === 'dairy') && (f.fat || 0) <= 8 && (f.protein || 0) >= 13));
  const pFatty = byBudget(basePool.filter(f => f.category === 'protein' && (f.fat || 0) > 8 && (f.protein || 0) >= 12));
  const pLean = byBudget(basePool.filter(f => (f.category === 'protein' || f.category === 'dairy') && (f.fat || 0) <= 3 && (f.protein || 0) >= 11));
  const anyProtein = pSolid.length > 0 ? pSolid : pLean.length > 0 ? pLean : pFatty.length > 0 ? pFatty : byBudget(basePool.filter(f => (f.category === 'protein' || f.category === 'dairy') && (f.protein || 0) >= 12));
  const cSlowRaw = basePool.filter(f => (f.category === 'grain' || f.category === 'carb') && (f.gi || 0) > 0 && (f.gi || 0) <= 55 && (f.carbs || 0) >= 15 && (f.protein || 0) / Math.max(1, f.carbs || 0) < 0.35);
  const cSlowBud = byBudget(cSlowRaw);
  const cFastRaw = basePool.filter(f => (f.category === 'grain' || f.category === 'carb' || f.category === 'veg_fruit') && (f.gi || 0) >= 60 && (f.carbs || 0) >= 15 && (f.protein || 0) / Math.max(1, f.carbs || 0) < 0.35);
  const cFastBud = byBudget(cFastRaw);
  const cFruitRaw = basePool.filter(f => f.category === 'veg_fruit' && (f.carbs || 0) >= 8 && (f.gi || 0) <= 55 && (f.fiber || 0) >= 1.5 && (f.protein || 0) < 15);
  const cFruitBud = byBudget(cFruitRaw);
  const fatsRaw = basePool.filter(f => f.category === 'fat' && (f.fat || 0) >= 50);
  const fatsBud = byBudget(fatsRaw);
  // variety-based pool limiting: перемешиваем и обрезаем для разнообразия
  const limitPoolByVariety = <T>(arr: T[], seed: number): T[] => {
    if (!varietyPoolSize || arr.length <= varietyPoolSize) return arr;
    const shuffled = [...arr].sort((a, b) => {
      const sa = seededRandom(seed + arr.indexOf(a as any) * 7);
      const sb = seededRandom(seed + arr.indexOf(b as any) * 7);
      return sa - sb;
    });
    return shuffled.slice(0, varietyPoolSize);
  };
  return {
    proteinSolid: limitPoolByVariety(pSolid.length > 0 ? pSolid : anyProtein, 10001),
    proteinFatty: limitPoolByVariety(pFatty.length > 0 ? pFatty : anyProtein, 10003),
    proteinLean: limitPoolByVariety(pLean.length > 0 ? pLean : anyProtein, 10005),
    fastProtein: FOOD_DB.filter(f => !excludedIds.has(f.id) && (f.id === 'whey_isolate' || f.id === 'whey_concentrate' || f.id === 'whey_protein' || f.id === 'egg_white')),
    slowProtein: FOOD_DB.filter(f => !excludedIds.has(f.id) && (f.id === 'casein' || f.id === 'casein_micellar' || f.id === 'cottage_cheese_5' || f.id === 'yogurt_greek')),
    carbSlow: limitPoolByVariety(cSlowBud.length > 0 ? cSlowBud : cSlowRaw.length > 0 ? cSlowRaw : basePool.filter(f => (f.category === 'grain' || f.category === 'carb') && (f.carbs || 0) >= 15), 10011),
    carbFast: limitPoolByVariety(cFastBud.length > 0 ? cFastBud : cFastRaw.length > 0 ? cFastRaw : cFruitBud.length > 0 ? cFruitBud : basePool.filter(f => (f.category === 'grain' || f.category === 'carb') && (f.carbs || 0) >= 15), 10013),
    carbFruit: limitPoolByVariety(cFruitBud.length > 0 ? cFruitBud : cFruitRaw, 10015),
    fats: limitPoolByVariety(fatsBud.length > 0 ? fatsBud : fatsRaw, 10017),
    vegGreen: basePool.filter(f => f.category === 'veg_fruit' && ['broccoli','spinach','cucumber','zucchini','asparagus','green_bean','celery','cabbage','kale','green_apple'].some(k => f.id.includes(k)) && (f.protein || 0) < 10),
    vegColor: basePool.filter(f => f.category === 'veg_fruit' && ['tomato','pepper','carrot','beetroot','pumpkin','eggplant','pomegranate','citrus'].some(k => f.id.includes(k.toLowerCase())) && (f.protein || 0) < 10),
    dairy: byBudget(basePool.filter(f => f.category === 'dairy' && (f.fat || 0) <= 10)),
    eaa: FOOD_DB.find(f => !excludedIds.has(f.id) && (f.id === 'supp_eaa' || f.id === 'bcaa')),
    dextrin: FOOD_DB.find(f => !excludedIds.has(f.id) && (f.id === 'amylopectin' || f.id === 'dextrose')),
  };
}

// ─── МЕТОД: стандартный приём пищи (завтрак/обед/ужин) ─────────────────
function buildWholeMeal(
  params: {
    label: string; time: string; type: Meal['type'];
    proteinG: number; carbG: number; fatG: number;
    pool: ReturnType<typeof buildFoodPools>;
    proteinRotationIds: string[];
    seed: number;
    includeVeg: boolean;
    includeFruit?: boolean;
    rationales: string[];
    preferredIds?: Set<string>;
    lockedIds?: Set<string>;
    recentIds?: Set<string>;
    vegColorIdx?: number; // which VEG_COLOR_GROUPS to prefer
  }
): Meal {
  const { label, time, type, proteinG, carbG, fatG, pool, proteinRotationIds, seed, includeVeg, includeFruit, rationales, preferredIds, lockedIds, recentIds, vegColorIdx } = params;
  const items: MealItem[] = [];
  let remP = proteinG, remC = carbG, remF = fatG;

  // 1. Белок: роторный источник (предпочтение — preferred)
  const rotPool = pool.proteinSolid.filter(f => proteinRotationIds.includes(f.id));
  const preferredRot = preferredIds && preferredIds.size > 0 ? rotPool.filter(f => preferredIds.has(f.id)) : [];
  const proteinPool = preferredRot.length > 0 ? preferredRot : rotPool.length > 0 ? rotPool : pool.proteinLean.length > 0 ? pool.proteinLean : pool.proteinSolid;
  const proteinSource = pickPriority(proteinPool, seed, { lockedIds, preferredIds: preferredRot.length > 0 ? undefined : preferredIds, recentIds });
  if (proteinSource) {
    const grams = gramsForMacro(proteinSource, remP, 'protein');
    if (grams > 0) {
      const item = makeItem(proteinSource, grams, 'protein');
      items.push(item); remP -= item.p; remF -= item.f; remC -= item.c;
    }
  }

  // 2. Углеводы: медленные по умолчанию (предпочтение — preferred)
  if (remC > 8) {
    // Reserve carb budget for veg/fruit that will be added later (they contribute ~8-12g carbs each)
    const vegCarbReserve = includeVeg ? 12 : 0;
    const fruitCarbReserve = includeFruit ? 10 : 0;
    const carbTarget = Math.max(5, remC - vegCarbReserve - fruitCarbReserve);
    const prefCarb = preferredIds && preferredIds.size > 0 ? pool.carbSlow.filter(f => preferredIds.has(f.id)) : [];
    const carbSource = pickPriority(prefCarb.length > 0 ? prefCarb : pool.carbSlow, seed + 1, { lockedIds, recentIds });
    if (carbSource) {
      const grams = gramsForMacro(carbSource, carbTarget, 'carbs');
      if (grams > 0) {
        const item = makeItem(carbSource, grams, 'carb_slow');
        items.push(item); remP -= item.p; remF -= item.f; remC -= item.c;
      }
    }
  }

  // 3. Овощи (волокно + микро): порция ≥150 г (предпочтение — preferred)
  if (includeVeg) {
    // Vegetable rotation: prefer specified color group
    const colorGroup = vegColorIdx !== undefined ? VEG_COLOR_GROUPS[Math.abs(vegColorIdx) % VEG_COLOR_GROUPS.length] : null;
    const colorVegIds = colorGroup ? new Set(colorGroup.ids) : null;
    const vegGreenPool = colorVegIds ? pool.vegGreen.filter(f => colorVegIds.has(f.id)) : pool.vegGreen;
    const vegColorPool = colorVegIds ? pool.vegColor.filter(f => colorVegIds.has(f.id)) : pool.vegColor;
    const fallbackGreen = vegGreenPool.length > 0 ? vegGreenPool : pool.vegGreen;
    const fallbackColor = vegColorPool.length > 0 ? vegColorPool : pool.vegColor;
    const prefVegGreen = preferredIds && preferredIds.size > 0 ? fallbackGreen.filter(f => preferredIds.has(f.id)) : [];
    const prefVegColor = preferredIds && preferredIds.size > 0 ? fallbackColor.filter(f => preferredIds.has(f.id)) : [];
    const vegSource = pickPriority(prefVegGreen.length > 0 ? prefVegGreen : fallbackGreen, seed + 2, { lockedIds, recentIds }) || pickPriority(prefVegColor.length > 0 ? prefVegColor : fallbackColor, seed + 3, { lockedIds, recentIds });
    if (vegSource) {
      const grams = 150 + Math.floor(seededRandom(seed + 3) * 100);
      const item = makeItem(vegSource, grams, 'veg');
      items.push(item); remP -= item.p; remF -= item.f; remC -= item.c;
    }
  }

  // 4. Фрукт (ягоды/киви как пребиотик и антиоксидант) (предпочтение — preferred)
  if (includeFruit) {
    const prefFruit = preferredIds && preferredIds.size > 0 ? pool.carbFruit.filter(f => preferredIds.has(f.id)) : [];
    const fSrc = pickPriority(prefFruit.length > 0 ? prefFruit : pool.carbFruit, seed + 4, { lockedIds, recentIds });
    if (fSrc) {
      const grams = 80 + Math.floor(seededRandom(seed + 5) * 60);
      const item = makeItem(fSrc, grams, 'fruit');
      items.push(item); remP -= item.p; remF -= item.f; remC -= item.c;
    }
  }

  // 5. Жиры: остаточный принцип (если remF > 5) (предпочтение — preferred)
  if (remF > 5) {
    const prefFat = preferredIds && preferredIds.size > 0 ? pool.fats.filter(f => preferredIds.has(f.id)) : [];
    const fatSource = pickPriority(prefFat.length > 0 ? prefFat : pool.fats, seed + 6, { lockedIds, recentIds });
    if (fatSource) {
      const grams = gramsForMacro(fatSource, remF, 'fat');
      if (grams > 0) {
        const item = makeItem(fatSource, grams, 'fat');
        items.push(item); remP -= item.p; remF -= item.f; remC -= item.c;
      }
    }
  }

      // 6. MPS-добор: проверяем ПОСЛЕ сборки всего приёма
      //    Только если белок <25г И лейцин <2.5г — минимальный добор сывороткой
      {
        const curP = items.reduce((s, i) => s + i.p, 0);
        const curLeu = items.reduce((s, i) => s + (i.leucine_mg || 0), 0);
        if (curP < 25 && curLeu < LEU_THRESHOLD_MG && pool.fastProtein.length > 0) {
          const whey = pool.fastProtein.find(f => f.id === 'whey_isolate') ?? pool.fastProtein.find(f => f.id === 'whey_concentrate') ?? pool.fastProtein[0];
          const needLeu = LEU_THRESHOLD_MG - curLeu;
          const wheyLeuPer100 = getLeucine(whey);
          const wheyGramsRaw = Math.round(needLeu / Math.max(1, wheyLeuPer100) * 100);
          const wheyGrams = Math.min(40, Math.max(15, wheyGramsRaw));
          const wItem = makeItem(whey, wheyGrams, 'fast_protein');
          if (wItem.p > 25) { wItem.p = 25; wItem.kcal = Math.round(wItem.p * 4 + wItem.f * 9 + wItem.c * 4); }
          items.push(wItem); remP -= wItem.p; remF -= wItem.f; remC -= wItem.c;
        }
      }
  const totals = items.reduce((acc, it) => ({
    kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c,
    fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0),
  }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
  const mpsCheck = {
    proteinG: totals.p,
    leucineG: Math.round(totals.leucine_mg / 10) / 100,
    triggers_mTOR: totals.leucine_mg >= LEU_THRESHOLD_MG && totals.p >= 25,
  };

  return { label, time, items, totals, type, rationale: rationales, mpsCheck, target: { p: proteinG, c: carbG, f: fatG } };
}

// ─── МЕТОД: pre-workout приём (–90 мин до тренировки) ─────────────────
function buildPreWorkout(
  time: string, label: string, seed: number,
  pool: ReturnType<typeof buildFoodPools>,
  budget: MealPlanInput['budget'],
  preferredIds?: Set<string>,
  opts?: { lockedIds?: Set<string>; recentIds?: Set<string> },
): Meal {
  const leanProteinPool = pool.proteinLean.length > 0 ? pool.proteinLean : pool.proteinSolid;
  const prefProtein = preferredIds && preferredIds.size > 0 ? leanProteinPool.filter(f => preferredIds.has(f.id)) : [];
  const proteinSource = pickPriority(prefProtein.length > 0 ? prefProtein : leanProteinPool, seed, { preferredIds, recentIds: opts?.recentIds, lockedIds: opts?.lockedIds });
  const prefCarb = preferredIds && preferredIds.size > 0 ? pool.carbSlow.filter(f => preferredIds.has(f.id)) : [];
  const carbSource = pickPriority(prefCarb.length > 0 ? prefCarb : pool.carbSlow, seed + 1, { preferredIds, recentIds: opts?.recentIds, lockedIds: opts?.lockedIds });
  const items: MealItem[] = [];

  if (proteinSource) {
    const grams = gramsForMacro(proteinSource, PREW_PROTEIN_G, 'protein');
    items.push(makeItem(proteinSource, grams, 'protein'));
  }
  if (carbSource) {
    const grams = gramsForMacro(carbSource, PREW_CARB_SLOW_G, 'carbs');
    items.push(makeItem(carbSource, grams, 'carb_slow'));
  }

  const totals = items.reduce((acc, it) => ({
    kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c,
    fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0),
  }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
  return {
    label, time, items, totals, type: 'preworkout', target: { p: PREW_PROTEIN_G, c: PREW_CARB_SLOW_G, f: PREW_FAT_MAX_G },
    rationale: [
      `Pre-workout за ~90 мин: белок ${PREW_PROTEIN_G} г (снижение катаболизма)`,
      `Медленные углеводы ${PREW_CARB_SLOW_G} г (гликоген, стабильная глюкоза)`,
      `Жиры ≤ ${PREW_FAT_MAX_G} г — не задерживают gastric emptying`,
    ],
    mpsCheck: { proteinG: totals.p, leucineG: Math.round(totals.leucine_mg) / 1000, triggers_mTOR: totals.leucine_mg >= LEU_THRESHOLD_MG },
  };
}

// ─── МЕТОД: post-workout приём (+60 мин) ──────────────────────────────
function buildPostWorkout(
  time: string, label: string, seed: number,
  pool: ReturnType<typeof buildFoodPools>,
  preferredIds?: Set<string>,
  opts?: { lockedIds?: Set<string>; recentIds?: Set<string> },
): Meal {
  const fastProtein = pool.fastProtein.find(f => f.id === 'whey_isolate') ?? pool.fastProtein.find(f => f.id === 'whey_concentrate') ?? pool.fastProtein.find(f => f.id === 'whey_protein') ?? pool.fastProtein[0];
  const prefCarb = preferredIds && preferredIds.size > 0 ? pool.carbFast.filter(f => preferredIds.has(f.id)) : [];
  const fastCarb = pickPriority(prefCarb.length > 0 ? prefCarb : pool.carbFast, seed + 1, { preferredIds, recentIds: opts?.recentIds, lockedIds: opts?.lockedIds });
  const items: MealItem[] = [];

  if (fastProtein) {
    const grams = gramsForMacro(fastProtein, POSTW_FAST_PROTEIN_G, 'protein');
    items.push(makeItem(fastProtein, grams, 'fast_protein'));
  }
  if (fastCarb) {
    const grams = gramsForMacro(fastCarb, POSTW_FAST_CARB_G, 'carbs');
    items.push(makeItem(fastCarb, grams, 'carb_fast'));
  }

  const totals = items.reduce((acc, it) => ({
    kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c,
    fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0),
  }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
  return {
    label, time, items, totals, type: 'postworkout', target: { p: POSTW_FAST_PROTEIN_G, c: POSTW_FAST_CARB_G, f: 0 },
    rationale: [
      `Post-workout +60 мин: сывороточный белок ${POSTW_FAST_PROTEIN_G} г — пик аминокислот в крови через 60 мин`,
      `Быстрые углеводы ${POSTW_FAST_CARB_G} г — быстрое гликоген-восстановление, ↑инсулин (vs глюкагон)`,
      `Жиры ≤ 5 г — не тормозят абсорбцию`,
    ],
    mpsCheck: { proteinG: totals.p, leucineG: Math.round(totals.leucine_mg) / 1000, triggers_mTOR: totals.leucine_mg >= LEU_THRESHOLD_MG && totals.p >= 25 },
  };
}

// ─── МЕТОД: intra-workout (тяжёлый training) ─────────────────────────
function buildIntraWorkout(time: string, seed: number, pool: ReturnType<typeof buildFoodPools>): Meal {
  const items: MealItem[] = [];
  if (pool.eaa) items.push(makeItem(pool.eaa, INTRA_EAA_G, 'fast_protein'));
  // Dextrin (amylopectin): если нет — синтетический пункт
  if (pool.dextrin) {
    items.push(makeItem(pool.dextrin, INTRA_CARB_G_PER_H, 'liquid'));
  } else {
    items.push({ id: 'cyclic_dextrin', name: 'Циклический декстрин', amount: INTRA_CARB_G_PER_H, kcal: INTRA_CARB_G_PER_H * 4, p: 0, f: 0, c: INTRA_CARB_G_PER_H, fiber: 0, role: 'liquid' });
  }
  const totals = items.reduce((acc, it) => ({
    kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c,
    fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0),
  }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
  void seed;
  return {
    label: '🏋 Intra-workout', time, items, totals, type: 'intra', target: { p: INTRA_EAA_G, c: INTRA_CARB_G_PER_H, f: 0 },
    rationale: [
      `EAA ${INTRA_EAA_G} г — предотвращение катаболизма во время длительной (>60 мин) сессии`,
      `Циклодекстрин ${INTRA_CARB_G_PER_H} г/ч — поддержание глюкозы и гликогена`,
      `Без жиров — максимальная скорость gastric emptying`,
    ],
  };
}

// ─── МЕТОД: pre-sleep казеиновый приём ───────────────────────────────
function buildPreSleep(time: string, seed: number, pool: ReturnType<typeof buildFoodPools>, residualP: number, opts?: { lockedIds?: Set<string>; recentIds?: Set<string> }): Meal {
  // Рандомизация источника казеина по seed (раньше — всегда первый)
  const caseinPool = pool.slowProtein.length > 0 ? pool.slowProtein : FOOD_DB.filter(f => f.id === 'casein' || f.id.includes('cottage') || f.id === 'yogurt_greek');
  const caseinIdx = Math.floor(seededRandom(seed) * caseinPool.length) % caseinPool.length;
  const caseinSource = caseinPool[caseinIdx] || caseinPool[0];
  const items: MealItem[] = [];
  if (caseinSource) {
    const targetP = Math.max(30, Math.min(45, residualP));
    const grams = gramsForMacro(caseinSource, targetP, 'protein');
    items.push(makeItem(caseinSource, grams, 'slow_protein'));
  }
  // Mg-источник: тыквенные семечки/миндаль/кешью — ротация по seed
  const mgPool = FOOD_DB.filter(f => ['pumpkin_seeds','sunflower_seeds','almonds','cashew'].includes(f.id));
  const mgSource = pickPriority(mgPool as any as FoodItem[], seed + 1, { recentIds: opts?.recentIds, lockedIds: opts?.lockedIds }) as any || mgPool[0];
  if (mgSource) items.push(makeItem(mgSource, 15, 'fat'));
  // Мелатонин-источник: киви/вишня/ягоды — ротация
  const melPool = FOOD_DB.filter(f => f.id === 'kiwi' || f.id === 'cherry' || f.id.includes('berries'));
  const melSource = pickPriority(melPool as any as FoodItem[], seed + 2, { recentIds: opts?.recentIds, lockedIds: opts?.lockedIds }) as any || melPool[0];
  if (melSource) items.push(makeItem(melSource, 100, 'fruit'));

  const totals = items.reduce((acc, it) => ({
    kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c,
    fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0),
  }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
  void seed;
  return {
    label: '🌙 Pre-sleep', time, items, totals, type: 'presleep', target: { p: Math.max(30, Math.min(45, residualP)), c: 0, f: 0 },
    rationale: [
      'Казеин 30–40 г — медленный белок, ночная защита от катаболизма (6–8 ч)',
      'Mg (тыквенные семечки) 150 мг — релаксация мышц и нервной системы',
      'Киви/вишня — серотонин + антиоксиданты (+42% качество сна)',
    ],
    mpsCheck: { proteinG: totals.p, leucineG: Math.round(totals.leucine_mg) / 1000, triggers_mTOR: false },
  };
}

function fmtTime(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// ─── Вспомогательная: выбрать несколько белковых ротаций на день ──────
function pickRotationsForDay(dayOffset: number, randomSalt: number, count: number): { label: string; ids: string[]; note: string }[] {
  const result: { label: string; ids: string[]; note: string }[] = [];
  const used = new Set<number>();
  for (let i = 0; i < count; i++) {
    const seed = Math.abs(dayOffset * 10007 + randomSalt * 777 + i * 31);
    const idx = Math.floor(seededRandom(seed) * PROTEIN_ROTATION.length) % PROTEIN_ROTATION.length;
    if (!used.has(idx)) {
      used.add(idx);
      result.push(PROTEIN_ROTATION[idx]);
    }
  }
  if (result.length === 0) result.push(PROTEIN_ROTATION[Math.abs(dayOffset) % PROTEIN_ROTATION.length]);
  return result;
}

// Vegetable rotation: different color groups for lunch vs dinner
const VEG_COLOR_GROUPS = [
  { ids: ['broccoli','spinach','asparagus','green_bean','celery','cabbage'], label: 'зелёные' },
  { ids: ['tomato','veg_bell_pepper_red','beetroot','radish'], label: 'красные' },
  { ids: ['carrot','pumpkin','sweet_potato'], label: 'оранжевые' },
  { ids: ['cucumber','zucchini','eggplant'], label: 'белые/фиолетовые' },
];

// ─── ОСНОВНОЙ ВХОД: построить дневной план ───────────────────────────
export function buildDayPlan(input: MealPlanInput): DayPlanV2 {
  const randomSalt = input.randomSalt ?? 0;
  // FIX 4: Use user-set times (fallback to defaults)
  const tBreakfast = input.wakeTime || '07:30';
  const tLunch = input.lunchTime || '12:30';
  const tDinner = input.dinnerTime || '19:00';
  const tBed = input.bedTime || '22:00';
  // Pre-sleep 30 min before bed
  const tPreSleep = (() => { const [h, m] = tBed.split(':').map(Number); const min = (h * 60 + m - 30 + 1440) % 1440; return String(Math.floor(min/60)).padStart(2,'0') + ':' + String(min%60).padStart(2,'0'); })();
  const wantPreSleep = input.mealsCount >= 4; // only if user wants 4+ meals
  // Snack time: midpoint between lunch and dinner
  const tSnack = (() => { const [lh, lm] = tLunch.split(':').map(Number); const [dh, dm] = tDinner.split(':').map(Number); const mid = Math.round(((lh*60+lm) + (dh*60+dm)) / 2); return String(Math.floor(mid/60)).padStart(2,'0') + ':' + String(mid%60).padStart(2,'0'); })();
  const variety = input.variety ?? 'max';
  const varietyPoolSize = variety === 'max' ? 20 : variety === 'medium' ? 10 : 5;
  const pool = buildFoodPools(input.excludedIds || new Set(), !!input.isVegetarian, input.budget, varietyPoolSize);
  // P5: PCT food preference boost — крестоцветные (DIM/I3C) + zinc-rich + flax
  let effectivePreferred = input.preferredIds || new Set<string>();
  if (input.cyclePhase === 'pct') {
    const pctFoodIds = ['broccoli','cabbage','kale','cauliflower','brussels_sprouts','beef_lean','beef_liver','oysters','pumpkin_seeds','flaxseed','salmon'];
    effectivePreferred = new Set([...(input.preferredIds || []), ...pctFoodIds.filter(id => FOOD_DB.some(fd => fd.id === id))]);
  }
  const seedBase = (input.dayOffset + randomSalt) * 10007 + (input.isTrainingDay ? 3000 : 7000);
  // Ротация: разные группы белка в разные приёмы (раньше — одна на весь день)
  const mealRotations = pickRotationsForDay(input.dayOffset, randomSalt, 4);
  function rotationForMeal(mealIdx: number): { label: string; ids: string[]; note: string } {
    return mealRotations[Math.abs(mealIdx) % mealRotations.length] || mealRotations[0];
  }
  const meals: Meal[] = [];

  // ─── Распределение макросов по приёмам (MPS-based) ───────────────────
  const ptm = input.planTypeMod || { pMult: 1.0, fMult: 1.0, cMult: 1.0 };
  const mpsPerMeal = Math.round(input.lbmKg * MPS_LBM_LOW * (ptm.pMult || 1.0));
  const trainWindow = input.isTrainingDay && !!input.trainStartMin;
  // Carb periodization: тренировка → 25% pre+30% post+15% lunch; отдых → 30/30/20
  // Apply plan type multipliers (keto: low carb high fat, highcarb: high carb, etc.)
  const adjustedCarbsG = Math.round(input.goalCarbsG * ptm.cMult);
  const adjustedFatG = Math.round(input.goalFatG * ptm.fMult);
  const adjustedProteinG = Math.round(input.goalProteinG * ptm.pMult);
  const carbsTotal = Math.max(CARB_FLOOR_G * ptm.cMult, adjustedCarbsG);
  const breakC = Math.round(carbsTotal * 0.22);
  const trainCarbLunch = Math.round(carbsTotal * 0.18);
  const restCarbLunch = Math.round(carbsTotal * 0.30);
  const trainCarbDinner = Math.round(carbsTotal * 0.12);
  const restCarbDinner = Math.round(carbsTotal * 0.20);
  const fatTotal = Math.max(Math.round(input.weightKg * FAT_FLOOR_PER_KG), adjustedFatG || input.goalFatG);

  // P1.4: Snack on non-training days to fill MPS gap (lunch 12:30 → dinner 19:00 = 6.5h)
  const snackP = Math.max(15, Math.round(mpsPerMeal * 0.6));
  const snackC = Math.round(carbsTotal * 0.10);
  const snackF = Math.round(fatTotal * 0.10);
  const hasSnack = !trainWindow && input.mealsCount >= 4;

  const mealBudget = {
    breakfast: { p: Math.max(30, Math.round(mpsPerMeal * 1.2)), c: breakC, f: Math.round(fatTotal * 0.15) },
    lunch: { p: Math.max(30, Math.round(mpsPerMeal * 1.2)), c: (input.eveningLowCarb ? Math.round((trainWindow ? trainCarbLunch : restCarbLunch - snackC) * 1.3) : (trainWindow ? trainCarbLunch : restCarbLunch - snackC)), f: Math.round(fatTotal * 0.12) },
    dinner: { p: Math.max(30, Math.round(mpsPerMeal * 1.2)), c: input.eveningLowCarb ? Math.round((trainWindow ? trainCarbDinner : restCarbDinner) * 0.5) : (trainWindow ? trainCarbDinner : restCarbDinner), f: Math.round(fatTotal * 0.18) },
    prew: trainWindow ? { p: PREW_PROTEIN_G, c: PREW_CARB_SLOW_G, f: PREW_FAT_MAX_G } : null,
    postw: trainWindow ? { p: POSTW_FAST_PROTEIN_G, c: POSTW_FAST_CARB_G, f: 0 } : null,
    snack: hasSnack ? { p: snackP, c: snackC, f: snackF } : null,
  };

  const usedP = mealBudget.breakfast.p + mealBudget.lunch.p + mealBudget.dinner.p + (mealBudget.prew?.p || 0) + (mealBudget.postw?.p || 0) + (mealBudget.snack?.p || 0);
  const usedC = mealBudget.breakfast.c + mealBudget.lunch.c + mealBudget.dinner.c + (mealBudget.prew?.c || 0) + (mealBudget.postw?.c || 0) + (mealBudget.snack?.c || 0);
  const residualP = Math.max(25, (adjustedProteinG || input.goalProteinG) - usedP);
  const residualC = Math.max(0, carbsTotal - usedC);

  const allFoodsUsed: string[] = [];
  const rotLabels = [...new Set(mealRotations.map(r => r.label))].join(' / ');
  const notes: string[] = [
    `Ротация белка: ${rotLabels} — разные группы в каждый приём`,
    `MPS per meal: ${mpsPerMeal} г (≈${MPS_LBM_LOW} г/кг LBM), интервал 3–5 ч для синтеза`,
  ];

  // 1. Завтрак — белок + медленные углеводы + жиры + ягоды ─────────────
  const breakfastRot = rotationForMeal(0);
  const breakfast = buildWholeMeal({
    label: 'Завтрак', time: tBreakfast, type: 'breakfast',
    proteinG: mealBudget.breakfast.p,
    carbG: mealBudget.breakfast.c,
    fatG: mealBudget.breakfast.f,
    pool, proteinRotationIds: breakfastRot.ids, seed: seedBase + 1,
    includeVeg: input.mealsCount >= 5, includeFruit: true,
    preferredIds: effectivePreferred,
    lockedIds: input.lockedIds, recentIds: input.recentFoodIds,
    rationales: [
      `Завтрак: белок (${breakfastRot.label}) + медленные углеводы + жиры + ягоды`,
      'Желчь активна, липаза готова — жиры хорошо усваиваются',
      'Ягоды — антоцианы, защита от свободных радикалов',
    ],
  });
  meals.push(breakfast);
  breakfast.items.forEach(i => allFoodsUsed.push(i.id));

  // 2. Обед — основной цельный приём ─────────────────────────────────────
  const lunchRot = rotationForMeal(1);
  const lunch = buildWholeMeal({
    label: 'Обед', time: tLunch, type: 'lunch',
    proteinG: mealBudget.lunch.p,
    carbG: mealBudget.lunch.c,
    fatG: mealBudget.lunch.f,
    pool, proteinRotationIds: lunchRot.ids, seed: seedBase + 2,
    includeVeg: true, includeFruit: false,
    preferredIds: effectivePreferred,
    lockedIds: input.lockedIds, recentIds: input.recentFoodIds,
    vegColorIdx: input.dayOffset, // lunch: green day 0, red day 1, orange day 2...
    rationales: [
      `Обед: цельная пища (${lunchRot.label} + злак + овощи + жиры)`,
      'Поддержание MPS — четверть суточного белка',
    ],
  });
  meals.push(lunch);
  lunch.items.forEach(i => allFoodsUsed.push(i.id));

  // P1.4: 2b. Snack 15:00 — нетренировочный день (MPS gap fill)
  if (hasSnack && mealBudget.snack) {
    const snackRot = rotationForMeal(3);
    const snack = buildWholeMeal({
      label: 'Полдник', time: tSnack, type: 'snack',
      proteinG: mealBudget.snack.p,
      carbG: mealBudget.snack.c,
      fatG: mealBudget.snack.f,
      pool, proteinRotationIds: snackRot.ids, seed: seedBase + 8,
      includeVeg: false, includeFruit: true,
      preferredIds: effectivePreferred,
      lockedIds: input.lockedIds, recentIds: input.recentFoodIds,
      rationales: [
        `Полдник: лёгкий белок (${snackRot.label}) + фрукт — поддержание MPS (интервал 3ч от обеда)`,
        'Заполняет окно 6.5ч между обедом и ужином — предотвращает катаболизм',
      ],
    });
    meals.push(snack);
    snack.items.forEach(i => allFoodsUsed.push(i.id));
    notes.push('Полдник 15:30: MPS gap fill (нетренировочный день) — белок + фрукт');
  }

  // 3. Pre-workout (если тренировка) — за 90 мин до старта ─────────────
  if (trainWindow && mealBudget.prew && input.trainStartMin) {
    const preTime = fmtTime(input.trainStartMin - 90);
    const prew = buildPreWorkout(preTime, 'Предтрен', seedBase + 3, pool, input.budget, effectivePreferred, { lockedIds: input.lockedIds, recentIds: input.recentFoodIds });
    meals.push(prew);
    prew.items.forEach(i => allFoodsUsed.push(i.id));
    notes.push('Pre-workout: белок + медленные углеводы за 90 мин (как минимум 1 прием пищи до тренировки)');
  }

  // 4. Intra-workout (тяжёлый training, allowIntraWorkout=true) ─────────
  if (trainWindow && input.allowIntraWorkout && input.trainStartMin) {
    const intraTime = fmtTime(input.trainStartMin + 30);
    const intra = buildIntraWorkout(intraTime, seedBase + 4, pool);
    meals.push(intra);
    notes.push('Intra-workout: EAA + циклодекстрин (поддержание глюкозы на длинной тренировке)');
  }

  // 5. Post-workout (+60 мин) ──────────────────────────────────────────
  if (trainWindow && mealBudget.postw && input.trainStartMin) {
    const postTime = fmtTime(input.trainStartMin + 60);
    const postw = buildPostWorkout(postTime, 'Пост-трен', seedBase + 5, pool, effectivePreferred, { lockedIds: input.lockedIds, recentIds: input.recentFoodIds });
    meals.push(postw);
    postw.items.forEach(i => allFoodsUsed.push(i.id));
    notes.push('Post-workout: сыворотка + быстрые углеводы в течение 60 мин (анаболическое окно)');
  }

  // 6. Ужин — основная порция жиров и белковый ротационный ─────────────
  const dinnerRot = rotationForMeal(2);
  const dinner = buildWholeMeal({
    label: 'Ужин', time: tDinner, type: 'dinner',
    proteinG: mealBudget.dinner.p,
    carbG: mealBudget.dinner.c + (residualC > 0 ? Math.min(30, residualC) : 0),
    fatG: mealBudget.dinner.f,
    pool, proteinRotationIds: dinnerRot.ids, seed: seedBase + 6,
    includeVeg: true, includeFruit: false,
    preferredIds: effectivePreferred,
    lockedIds: input.lockedIds, recentIds: input.recentFoodIds,
    vegColorIdx: input.dayOffset + 2, // dinner: different color than lunch
    rationales: [
      `Ужин: ${dinnerRot.label} + 30% жиров — медленная абсорбция на ночь`,
      'Поддержание MPS — обязательный приём после 4–5 ч без белка',
      'Овощи — клетчатка + витамины K/C + фитонутриенты',
    ],
  });
  meals.push(dinner);
  dinner.items.forEach(i => allFoodsUsed.push(i.id));

  // 7. Pre-sleep — казеин + Mg + мелатонин ───────────────────────────────
  const preSleepSeed = seedBase + 7 + randomSalt * 13;
  const preSleep = wantPreSleep ? buildPreSleep(tPreSleep, preSleepSeed, pool, residualP, { lockedIds: input.lockedIds, recentIds: input.recentFoodIds }) : null;
  if (preSleep) { meals.push(preSleep); preSleep.items.forEach(i => allFoodsUsed.push(i.id)); notes.push('Pre-sleep: казеин + Mg + мелатонин-источник для ночного восстановления'); }

  // Sort meals by time (chronological order)
  meals.sort((a, b) => {
    const toMin = (t: string) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m; };
    return toMin(a.time) - toMin(b.time);
  });

  // ─── Дневные итоговые ────────────────────────────────────────────────
  const totals = meals.reduce((acc, m) => ({
    kcal: acc.kcal + m.totals.kcal,
    p: acc.p + m.totals.p,
    f: acc.f + m.totals.f,
    c: acc.c + m.totals.c,
    fiber: acc.fiber + m.totals.fiber,
    leucine_mg: acc.leucine_mg + m.totals.leucine_mg,
  }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });

  const feedings = meals.filter(m => m.mpsCheck && m.mpsCheck.proteinG >= 25).length;
  const mpsSummary = {
    feedings,
    avg_leucine_g: Math.round(totals.leucine_mg / Math.max(1, feedings) / 10) / 100,
    avg_protein_per_meal_g: Math.round(totals.p / Math.max(1, meals.length)),
    intra_workout: meals.some(m => m.type === 'intra'),
    prePostWindow: meals.some(m => m.type === 'preworkout') && meals.some(m => m.type === 'postworkout'),
  };

  const uniqueFoods = new Set(allFoodsUsed).size;
  const categories: Record<string, number> = {};
  allFoodsUsed.forEach(id => {
    const f = FOOD_DB.find(x => x.id === id);
    const cat = f?.category || 'other';
    categories[cat] = (categories[cat] || 0) + 1;
  });

  // Warn if goal kcal is too low to preserve protein + minimum macros
  const minKcal = Math.round((adjustedProteinG || input.goalProteinG) * 4 + input.weightKg * FAT_FLOOR_PER_KG * 9 + CARB_FLOOR_G * 4);
  if (input.goalKcal < minKcal * 0.9) {
    notes.push(`⚠ Цель ${input.goalKcal} ккал ниже минимальной (${minKcal} ккал = белок + минимум жиров/углеводов). Белок сохранён, но план не может достичь цели без ущерба для MPS.`);
  }


  // KBJU fine-tune: if kcal >10% under goal, add fat (capped at fatTotal*1.10)
  {
    const devK = (input.goalKcal - totals.kcal) / Math.max(1, input.goalKcal);
    if (devK > 0.10 && totals.f < fatTotal * 1.10) {
      const kcalNeed = input.goalKcal - totals.kcal;
      const fatCap = fatTotal * 1.10 - totals.f;
      const fatItems = meals.flatMap(m => m.items.filter(it => it.role === 'fat').map(it => ({ meal: m, item: it })));
      if (fatItems.length > 0 && fatCap > 2) {
        const kcalPerItem = Math.min(kcalNeed / fatItems.length, fatCap * 9 / fatItems.length);
        fatItems.forEach(({ meal, item }) => {
          const food = FOOD_DB.find(f => f.id === item.id);
          if (!food || !food.fat) return;
          const addGrams = Math.min(Math.round(item.amount * 0.5), Math.round(kcalPerItem / (food.kcal || 1) * 100));
          const newAmount = Math.min(MAX_GRAM_PER_ITEM, item.amount + addGrams);
          const factor = newAmount / (item.amount || 1);
          item.amount = newAmount; item.kcal = Math.round(item.kcal * factor); item.p = Math.round(item.p * factor); item.f = Math.round(item.f * factor); item.c = Math.round(item.c * factor); item.fiber = Math.round(item.fiber * factor); item.leucine_mg = Math.round((item.leucine_mg || 0) * factor);
        });
        meals.forEach(m => { m.totals = m.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 }); });
        totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0);
      }
    }
  }
  // P4: Protein overshoot correction — if protein >10% over goal, scale down protein items (preserve MPS min 25g/meal)
  {
    const goalP = adjustedProteinG || input.goalProteinG;
    const devP = (totals.p - goalP) / Math.max(1, goalP);
    if (devP > 0.10) {
      const excessP = totals.p - goalP;
      const proteinItems = meals.flatMap(m => m.items.filter(it => it.role === 'protein' || it.role === 'fast_protein' || it.role === 'slow_protein').map(it => ({ meal: m, item: it })));
      if (proteinItems.length > 0) {
        const reducePerItem = excessP / proteinItems.length;
        proteinItems.forEach(({ meal, item }) => {
          const food = FOOD_DB.find(f => f.id === item.id);
          if (!food || !food.protein) return;
          const reduceGrams = Math.round(reducePerItem / food.protein * 100);
          const newAmount = Math.max(15, item.amount - reduceGrams);
          const factor = newAmount / (item.amount || 1);
          item.amount = newAmount;
          item.kcal = Math.round(item.kcal * factor); item.p = Math.round(item.p * factor); item.f = Math.round(item.f * factor); item.c = Math.round(item.c * factor); item.fiber = Math.round(item.fiber * factor); item.leucine_mg = Math.round((item.leucine_mg || 0) * factor);
        });
        meals.forEach(m => { m.totals = m.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 }); });
        totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0);
      }
    }
  }
  // P4d: Fat overshoot correction — if fat >12% over goal, reduce fat items
  {
    const goalF2 = fatTotal;
    const devF2 = (totals.f - goalF2) / Math.max(1, goalF2);
    if (devF2 > 0.12) {
      const excessF = totals.f - goalF2;
      const fatItems2 = meals.flatMap(m => m.items.filter(it => it.role === 'fat').map(it => ({ meal: m, item: it })));
      if (fatItems2.length > 0) {
        const reducePerItem = excessF / fatItems2.length;
        fatItems2.forEach(({ meal, item }) => {
          const food = FOOD_DB.find(f => f.id === item.id);
          if (!food || !food.fat) return;
          const reduceGrams = Math.round(reducePerItem / food.fat * 100);
          const newAmount = Math.max(10, item.amount - reduceGrams);
          const factor = newAmount / (item.amount || 1);
          item.amount = newAmount; item.kcal = Math.round(item.kcal * factor); item.p = Math.round(item.p * factor); item.f = Math.round(item.f * factor); item.c = Math.round(item.c * factor); item.fiber = Math.round(item.fiber * factor); item.leucine_mg = Math.round((item.leucine_mg || 0) * factor);
        });
        meals.forEach(m => { m.totals = m.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 }); });
        totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0);
      }
    }
  }
  // P4c: Fat deficit correction — if fat >12% under goal, increase fat items
  {
    const goalF = fatTotal;
    const devF = (goalF - totals.f) / Math.max(1, goalF);
    if (devF > 0.12) {
      const fatDeficit = goalF - totals.f;
      const fatItems = meals.flatMap(m => m.items.filter(it => it.role === 'fat').map(it => ({ meal: m, item: it })));
      if (fatItems.length > 0) {
        const addPerItem = fatDeficit / fatItems.length;
        fatItems.forEach(({ meal, item }) => {
          const food = FOOD_DB.find(f => f.id === item.id);
          if (!food || !food.fat) return;
          const addGrams = Math.round(addPerItem / food.fat * 100);
          const newAmount = Math.min(MAX_GRAM_PER_ITEM, item.amount + addGrams);
          const factor = newAmount / (item.amount || 1);
          item.amount = newAmount;
          item.kcal = Math.round(item.kcal * factor); item.p = Math.round(item.p * factor); item.f = Math.round(item.f * factor); item.c = Math.round(item.c * factor); item.fiber = Math.round(item.fiber * factor); item.leucine_mg = Math.round((item.leucine_mg || 0) * factor);
        });
        meals.forEach(m => { m.totals = m.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 }); });
        totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0); totals.p = meals.reduce((s, m) => s + m.totals.p, 0);
      }
    }
  }
  notes.push(`Сводка MPS: ${feedings} feedings × ${mpsSummary.avg_protein_per_meal_g} г/meal, ${mpsSummary.avg_leucine_g} г лейцина (порог ${LEU_THRESHOLD_MG / 1000} г)`);
  notes.push(`Диверсификация: ${uniqueFoods} уникальных продуктов (${Object.keys(categories).length} категорий)`);
  if (input.isCutting) notes.push('Сушка: повышенная плотность белка, заниженные углеводы у ужина');
  if (mpsSummary.prePostWindow) notes.push('Pre/post-workout окно реализовано (полноценное анаболическое обеспечение тренировки)');
  // Fiber check
  const fiberG = Math.round(totals.fiber);
  const fiberTarget = input.sex === 'female' ? 25 : 35;
  if (fiberG < fiberTarget * 0.7) {
    notes.push(`⚠ Клетчатка: ${fiberG}г / ${fiberTarget}г — добавьте овощи/цельнозерновые/ягоды (+${Math.round((fiberTarget - fiberG) / 3)}г порцию овощей)`);
  } else if (fiberG >= fiberTarget) {
    notes.push(`✅ Клетчатка: ${fiberG}г / ${fiberTarget}г`);
  }

  // Omega-3 boost: ensure at least one omega-3 source per day
  {
    const omega3Ids = new Set(['salmon','mackerel','sardines','red_fish','flaxseed','chia_seeds','walnuts']);
    const hasOmega3 = meals.some(m => m.items.some(it => omega3Ids.has(it.id)));
    if (!hasOmega3 && !input.isVegetarian) {
      const fish = FOOD_DB.find(f => f.id === 'salmon' && !(input.excludedIds||new Set()).has(f.id)) || FOOD_DB.find(f => f.id === 'mackerel' && !(input.excludedIds||new Set()).has(f.id));
      if (fish) {
        const lunchMeal = meals.find(m => m.type === 'lunch') || meals[1];
        if (lunchMeal) {
          // Replace the main protein source in lunch with fish (swap, not add)
          const protIdx = lunchMeal.items.findIndex(it => it.role === 'protein');
          if (protIdx >= 0) {
            const oldItem = lunchMeal.items[protIdx];
            const fishGrams = oldItem.amount || 100;
            lunchMeal.items[protIdx] = makeItem(fish, fishGrams, 'protein');
            allFoodsUsed[allFoodsUsed.indexOf(oldItem.id)] = fish.id;
          } else {
            lunchMeal.items.push(makeItem(fish, 80, 'protein'));
            allFoodsUsed.push(fish.id);
          }
          lunchMeal.totals = lunchMeal.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
          // Recalculate day totals
          totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0); totals.fiber = meals.reduce((s, m) => s + m.totals.fiber, 0); totals.leucine_mg = meals.reduce((s, m) => s + m.totals.leucine_mg, 0);
          notes.push('🐟 Омега-3 буст: лосось заменяет белок в обеде (EPA/DHA ~2.2г) — противовоспалительный жир');
        }
      }
    }
  }

  const deficiencyClosure = closeFoodDeficiencies(meals);
  if (deficiencyClosure.length > 0) notes.push(...deficiencyClosure);
  // P5: Phase-specific nutrition protocol (bodybuilder-specific)
  const phaseNotes: string[] = [];
  const cp: string | undefined = input.cyclePhase as string | undefined;
  if (cp === 'pct') {
    phaseNotes.push('🔄 ПКТ-нутриция: крестоцветные (брокколи, капуста, кейл) — DIM/I3C сдвиг метаболизма эстрогена к 2-OH (vs 16-OH)');
    phaseNotes.push('🦪 Цинк 30–50 мг/день: устрицы, говядина, тыквенные семечки — ингибирование ароматазы + восстановление оси ГГЯО');
    phaseNotes.push('🌾 Клетчатка ≥30 г: элиминация эстрогена через ЖКТ (снижение реабсорбции); льняное семя 30 г — лигнаны');
    phaseNotes.push('⚠ Избегать фитоэстрогенов: соя, хмель, клевер — тормозят восстановление эндогенного тестостерона');
    phaseNotes.push('🥩 Белок 2.5 г/кг — защита мышц на фоне снижения андрогенов; омега-3 3 г — противовоспалительно');
  } else if (cp === 'cutting') {
    phaseNotes.push('✂️ Сушка / пиковая неделя: натрий стабилен (3–4 г) до 2 дней до пика, затем плавное снижение до ~1 г');
    phaseNotes.push('💧 Вода 4–5 л/день до 2 дней до пика, затем 1–1.5 л в день пика; калий стабилен (авокадо, шпинат, картофель)');
    phaseNotes.push('🍚 Углеводы: истощение 3 дня (1–2 г/кг) → загрузка 2–3 дня (4–6 г/кг) — наполнение гликогена/сухость');
    phaseNotes.push('🧂 Контроль гликемии и ГК; белок 2.5–3 г/кг — антикатаболизм на дефиците');
  } else if (cp === 'recovery') {
    phaseNotes.push('🩹 Восстановление: белок 2.5 г/кг, омега-3 3 г (EPA/DHA — противовоспалительное), витамин C 500 мг, цинк 30 мг');
    phaseNotes.push('😴 Сон 8+ ч — восстановление ЦНС и гормональной оси; магний 400 мг на ночь');
  } else if (cp === 'post_cut') {
    phaseNotes.push('📈 Выход из сушки: +100–150 ккал/неделя — обратная метаболическая адаптация (без refeed-binge)');
    phaseNotes.push('🥩 Белок 2.2 г/кг, углеводы растут постепенно (+0.5 г/кг/нед) — восстановление лепина и щитовидной');
  } else if (cp === 'bridge') {
    phaseNotes.push('🌉 Мост: белок 2.0 г/кг, кардиопротекция (омега-3 3 г, клетчатка ≥30 г), контроль липидов и АД');
  }
  if (phaseNotes.length > 0) notes.push(...phaseNotes);

  return {
    dayIndex: input.dayOffset,
    isTrainingDay: input.isTrainingDay,
    meals,
    totals,
    mpsSummary,
    diversity: { uniqueFoods, categories },
    notes,
  };
}

// ─── Покрытие микронутриентов: выявление дефицитов + рекомендации ─────
const RDA_TARGETS: Record<string, { rda: number; unit: string; foodId: string; foodG: number }> = {
  Fe: { rda: 18, unit: 'мг', foodId: 'beef_liver', foodG: 50 },
  Mg: { rda: 400, unit: 'мг', foodId: 'pumpkin_seeds', foodG: 30 },
  Zn: { rda: 15, unit: 'мг', foodId: 'oysters', foodG: 50 },
  K: { rda: 3500, unit: 'мг', foodId: 'avocado', foodG: 100 },
  Ca: { rda: 1000, unit: 'мг', foodId: 'sardines', foodG: 50 },
  Omega3: { rda: 1600, unit: 'мг', foodId: 'salmon', foodG: 80 },
  Se: { rda: 55, unit: 'мкг', foodId: 'beef_lean', foodG: 150 },
  VitC: { rda: 100, unit: 'мг', foodId: 'veg_bell_pepper_red', foodG: 100 },
  VitD: { rda: 15, unit: 'мкг', foodId: 'salmon', foodG: 100 },
  VitB12: { rda: 2.4, unit: 'мкг', foodId: 'beef_lean', foodG: 150 },
  VitB9: { rda: 400, unit: 'мкг', foodId: 'spinach', foodG: 150 },
};
function getMicroFromFood(food: FoodItem, field: string): number {
  const m = food.micros as Record<string, number> | undefined;
  const e = food.electrolytes_100g as Record<string, number> | undefined;
  const t = food.trace_elements_100g as Record<string, number> | undefined;
  const v = food.vitamins_100g as Record<string, number> | undefined;
  // Direct match in micros (primary source)
  const direct = m?.[field];
  if (direct !== undefined) return direct;
  // Field-specific fallbacks for alternative naming
  const fieldMap: Record<string, string[]> = {
    Fe: ['iron_total_mg'], Mg: ['magnesium_mg'], Zn: ['zinc_mg'], K: ['potassium_mg'],
    Ca: ['calcium_mg'], Se: ['selenium_mcg'],
    VitC: ['vitamin_c_mg'], VitD: ['vitamin_d_mcg'], VitB12: ['vitamin_b12_mcg'], VitB9: ['vitamin_b9_mcg'],
    Omega3: ['omega_3_mg'],
  };
  const altKeys = fieldMap[field];
  if (altKeys) {
    for (const key of altKeys) {
      const val = e?.[key] ?? t?.[key] ?? v?.[key];
      if (val !== undefined) return val;
    }
  }
  return 0;
}
function closeFoodDeficiencies(meals: Meal[]): string[] {
  const allItems = meals.flatMap(m => m.items.map(it => ({ ...it, food: FOOD_DB.find(f => f.id === it.id) })));
  const totals: Record<string, number> = {};
  allItems.forEach(({ food, amount }) => {
    if (!food) return;
    Object.keys(RDA_TARGETS).forEach(k => {
      const factor = (amount || 0) / 100;
      totals[k] = (totals[k] || 0) + getMicroFromFood(food, k) * factor;
    });
  });
  const notes: string[] = [];
  Object.entries(RDA_TARGETS).forEach(([key, cfg]) => {
    const val = totals[key] || 0;
    if (val < cfg.rda * 0.6) {
      const food = FOOD_DB.find(f => f.id === cfg.foodId);
      const name = food?.name || cfg.foodId;
      const pct = Math.round(val / cfg.rda * 100);
      const addG = cfg.foodG;
      const addMg = food ? Math.round(getMicroFromFood(food, key) * addG / 100) : 0;
      notes.push(`⚠ Дефицит ${key}: ${pct}% RDA (${Math.round(val)}/${cfg.rda} ${cfg.unit}). Добавьте ${name} ${addG} г (ещё ${addMg} ${cfg.unit})`);
    }
  });
  return notes;
}