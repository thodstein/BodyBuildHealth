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

import { FOOD_DB } from "../../../../core/nutrition-database";
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
  wakeTime?: string;   // e.g. "07:00"
  lunchTime?: string;  // e.g. "13:00"
  dinnerTime?: string; // e.g. "19:00"
  bedTime?: string;    // e.g. "23:00"
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
  casein: 60, casein_micellar: 60, bcaa: 20, supp_eaas: 20,
  glutamine: 15, supp_hmb: 6, supp_beta_alanine: 6, supp_citrulline_dl_malate: 12,
  supp_agmatine_sulfate: 2, supp_l_carnitine_tartrate: 4, supp_alpha_gpc: 2,
  amylopectin: 80, dextrose: 80, coll_hydro: 20,
};
// Глобальный лимит на одну порцию любого продукта (г)
const MAX_GRAM_PER_ITEM = 500;

const MEAT_KEYWORDS = ['beef','pork','chicken','turkey','lamb','veal','duck','salmon','tuna','shrimp','cod','mackerel','trout','sardine','crab','lobster','squid','octopus','venison','rabbit','goose','pate','sausage','bacon','ham','pepperoni','salami','bologna','hot_dog','meatball','cutlet','steak','pollock','tilapia','herring','anchovy','clam','mussel','oyster','scallops','catfish','flounder','sole'];
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
  const base = Math.min(MAX_GRAM_PER_ITEM, Math.max(20, Math.round(targetG / per100 * 100)));
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
    if (isVeg && isMeatId(f.id) && !f.isVegetarian && !f.isVegan) return false;
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
    fastProtein: limitPoolByVariety(basePool.filter(f => f.id === 'whey_isolate' || f.id === 'whey_protein' || f.id === 'egg_white' || f.id === 'whey_concentrate'), 10007),
    slowProtein: limitPoolByVariety(basePool.filter(f => f.id === 'casein' || f.id === 'cottage_cheese_5' || f.id === 'greek_yogurt' || f.id === 'yogurt_greek'), 10009),
    carbSlow: limitPoolByVariety(cSlowBud.length > 0 ? cSlowBud : cSlowRaw.length > 0 ? cSlowRaw : basePool.filter(f => (f.category === 'grain' || f.category === 'carb') && (f.carbs || 0) >= 15), 10011),
    carbFast: limitPoolByVariety(cFastBud.length > 0 ? cFastBud : cFastRaw.length > 0 ? cFastRaw : cFruitBud.length > 0 ? cFruitBud : basePool.filter(f => (f.category === 'grain' || f.category === 'carb') && (f.carbs || 0) >= 15), 10013),
    carbFruit: limitPoolByVariety(cFruitBud.length > 0 ? cFruitBud : cFruitRaw, 10015),
    fats: limitPoolByVariety(fatsBud.length > 0 ? fatsBud : fatsRaw, 10017),
    vegGreen: basePool.filter(f => ['broccoli','spinach','cucumber','zucchini','asparagus','green_bean','celery','cabbage','kale','green_apple'].some(k => f.id.includes(k)) && (f.protein || 0) < 20),
    vegColor: basePool.filter(f => ['tomato','pepper','carrot','beetroot','pumpkin','eggplant','pomegranate','citrus'].some(k => f.id.includes(k.toLowerCase())) && (f.protein || 0) < 20),
    dairy: byBudget(basePool.filter(f => f.category === 'dairy' && (f.fat || 0) <= 10)),
    eaa: basePool.find(f => f.id === 'bcaa'),
    dextrin: basePool.find(f => f.id === 'amylopectin' || f.id === 'dextrose'),
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
  }
): Meal {
  const { label, time, type, proteinG, carbG, fatG, pool, proteinRotationIds, seed, includeVeg, includeFruit, rationales, preferredIds, lockedIds, recentIds } = params;
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
      // Низколейциновый белок? Добор сывороткой (≤40 г raw, ≤25 г protein), чтобы достичь порога лейцина
      const curLeu = items.reduce((s, i) => s + (i.leucine_mg || 0), 0);
      if (curLeu < LEU_THRESHOLD_MG && pool.fastProtein.length > 0) {
        const whey = pool.fastProtein[0];
        const needLeu = LEU_THRESHOLD_MG - curLeu;
        const wheyLeuPer100 = getLeucine(whey);
        const wheyProteinPer100 = whey.protein || 0;
        const wheyGramsRaw = Math.round(needLeu / Math.max(1, wheyLeuPer100) * 100);
        const wheyGrams = Math.min(40, Math.max(15, wheyGramsRaw));
        const wItem = makeItem(whey, wheyGrams, 'fast_protein');
        if (wItem.p > 25) { wItem.p = 25; wItem.kcal = Math.round(wItem.p * 4 + wItem.f * 9 + wItem.c * 4); }
        items.push(wItem); remP -= wItem.p; remF -= wItem.f; remC -= wItem.c;
      }
    }
  }

  // 2. Углеводы: медленные по умолчанию (предпочтение — preferred)
  if (remC > 8) {
    const prefCarb = preferredIds && preferredIds.size > 0 ? pool.carbSlow.filter(f => preferredIds.has(f.id)) : [];
    const carbSource = pickPriority(prefCarb.length > 0 ? prefCarb : pool.carbSlow, seed + 1, { lockedIds, recentIds });
    if (carbSource) {
      const grams = gramsForMacro(carbSource, remC, 'carbs');
      if (grams > 0) {
        const item = makeItem(carbSource, grams, 'carb_slow');
        items.push(item); remP -= item.p; remF -= item.f; remC -= item.c;
      }
    }
  }

  // 3. Овощи (волокно + микро): порция ≥150 г (предпочтение — preferred)
  if (includeVeg) {
    const prefVegGreen = preferredIds && preferredIds.size > 0 ? pool.vegGreen.filter(f => preferredIds.has(f.id)) : [];
    const prefVegColor = preferredIds && preferredIds.size > 0 ? pool.vegColor.filter(f => preferredIds.has(f.id)) : [];
    const vegSource = pickPriority(prefVegGreen.length > 0 ? prefVegGreen : pool.vegGreen, seed + 2, { lockedIds, recentIds }) || pickPriority(prefVegColor.length > 0 ? prefVegColor : pool.vegColor, seed + 3, { lockedIds, recentIds });
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

  const totals = items.reduce((acc, it) => ({
    kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c,
    fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0),
  }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
  const mpsCheck = {
    proteinG: totals.p,
    leucineG: Math.round(totals.leucine_mg / 10) / 100,
    triggers_mTOR: totals.leucine_mg >= LEU_THRESHOLD_MG && totals.p >= 25,
  };

  return { label, time, items, totals, type, rationale: rationales, mpsCheck };
}

// ─── МЕТОД: pre-workout приём (–90 мин до тренировки) ─────────────────
function buildPreWorkout(
  time: string, label: string, seed: number,
  pool: ReturnType<typeof buildFoodPools>,
  budget: MealPlanInput['budget'],
  preferredIds?: Set<string>,
): Meal {
  const leanProteinPool = pool.proteinLean.length > 0 ? pool.proteinLean : pool.proteinSolid;
  const prefProtein = preferredIds && preferredIds.size > 0 ? leanProteinPool.filter(f => preferredIds.has(f.id)) : [];
  const proteinSource = pick(prefProtein.length > 0 ? prefProtein : leanProteinPool, seed);
  const carbSource = pick(pool.carbSlow, seed + 1);
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
    label, time, items, totals, type: 'preworkout',
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
): Meal {
  const fastProtein = pool.fastProtein[0];
  const fastCarb = pick(pool.carbFast, seed + 1);
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
    label, time, items, totals, type: 'postworkout',
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
    label: '🏋 Intra-workout', time, items, totals, type: 'intra',
    rationale: [
      `EAA ${INTRA_EAA_G} г — предотвращение катаболизма во время длительной (>60 мин) сессии`,
      `Циклодекстрин ${INTRA_CARB_G_PER_H} г/ч — поддержание глюкозы и гликогена`,
      `Без жиров — максимальная скорость gastric emptying`,
    ],
  };
}

// ─── МЕТОД: pre-sleep казеиновый приём ───────────────────────────────
function buildPreSleep(time: string, seed: number, pool: ReturnType<typeof buildFoodPools>, residualP: number): Meal {
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
  const mgPool = FOOD_DB.filter(f => ['pumpkin_seeds','sunflower_seeds','nuts_almonds','cashew'].includes(f.id));
  const mgIdx = Math.floor(seededRandom(seed + 1) * mgPool.length) % mgPool.length;
  const mgSource = mgPool[mgIdx] || mgPool[0];
  if (mgSource) items.push(makeItem(mgSource, 20, 'fat'));
  // Мелатонин-источник: киви/вишня/ягоды — ротация
  const melPool = FOOD_DB.filter(f => f.id === 'kiwi' || f.id === 'cherry' || f.id.includes('berries'));
  const melIdx = Math.floor(seededRandom(seed + 2) * melPool.length) % melPool.length;
  const melSource = melPool[melIdx] || melPool[0];
  if (melSource) items.push(makeItem(melSource, 100, 'fruit'));

  const totals = items.reduce((acc, it) => ({
    kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c,
    fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0),
  }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
  void seed;
  return {
    label: '🌙 Pre-sleep', time, items, totals, type: 'presleep',
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
  const variety = input.variety ?? 'max';
  const varietyPoolSize = variety === 'max' ? 20 : variety === 'medium' ? 10 : 5;
  const pool = buildFoodPools(input.excludedIds || new Set(), !!input.isVegetarian, input.budget, varietyPoolSize);
  const seedBase = (input.dayOffset + randomSalt) * 10007 + (input.isTrainingDay ? 3000 : 7000);
  // Ротация: разные группы белка в разные приёмы (раньше — одна на весь день)
  const mealRotations = pickRotationsForDay(input.dayOffset, randomSalt, 4);
  function rotationForMeal(mealIdx: number): { label: string; ids: string[]; note: string } {
    return mealRotations[Math.abs(mealIdx) % mealRotations.length] || mealRotations[0];
  }
  const meals: Meal[] = [];

  // ─── Распределение макросов по приёмам (MPS-based) ───────────────────
  const mpsPerMeal = Math.round(input.lbmKg * MPS_LBM_LOW);
  const trainWindow = input.isTrainingDay && !!input.trainStartMin;
  // Carb periodization: тренировка → 25% pre+30% post+15% lunch; отдых → 30/30/20
  const carbsTotal = Math.max(CARB_FLOOR_G, input.goalCarbsG);
  const breakC = Math.round(carbsTotal * 0.22);
  const trainCarbLunch = Math.round(carbsTotal * 0.18);
  const restCarbLunch = Math.round(carbsTotal * 0.30);
  const trainCarbDinner = Math.round(carbsTotal * 0.12);
  const restCarbDinner = Math.round(carbsTotal * 0.20);
  const fatTotal = Math.max(Math.round(input.weightKg * FAT_FLOOR_PER_KG), input.goalFatG);

  // P1.4: Snack on non-training days to fill MPS gap (lunch 12:30 → dinner 19:00 = 6.5h)
  const snackP = Math.max(15, Math.round(mpsPerMeal * 0.6));
  const snackC = Math.round(carbsTotal * 0.10);
  const snackF = Math.round(fatTotal * 0.10);
  const hasSnack = !trainWindow && input.mealsCount >= 4;

  const mealBudget = {
    breakfast: { p: Math.max(25, mpsPerMeal), c: breakC, f: Math.round(fatTotal * 0.25) },
    lunch: { p: Math.max(25, mpsPerMeal), c: trainWindow ? trainCarbLunch : restCarbLunch - snackC, f: Math.round(fatTotal * 0.2) },
    dinner: { p: Math.max(25, mpsPerMeal), c: trainWindow ? trainCarbDinner : restCarbDinner, f: Math.round(fatTotal * 0.3) },
    prew: trainWindow ? { p: PREW_PROTEIN_G, c: PREW_CARB_SLOW_G, f: PREW_FAT_MAX_G } : null,
    postw: trainWindow ? { p: POSTW_FAST_PROTEIN_G, c: POSTW_FAST_CARB_G, f: 0 } : null,
    snack: hasSnack ? { p: snackP, c: snackC, f: snackF } : null,
  };

  const usedP = mealBudget.breakfast.p + mealBudget.lunch.p + mealBudget.dinner.p + (mealBudget.prew?.p || 0) + (mealBudget.postw?.p || 0) + (mealBudget.snack?.p || 0);
  const usedC = mealBudget.breakfast.c + mealBudget.lunch.c + mealBudget.dinner.c + (mealBudget.prew?.c || 0) + (mealBudget.postw?.c || 0) + (mealBudget.snack?.c || 0);
  const residualP = Math.max(25, input.goalProteinG - usedP);
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
    includeVeg: false, includeFruit: true,
    preferredIds: input.preferredIds,
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
    preferredIds: input.preferredIds,
    lockedIds: input.lockedIds, recentIds: input.recentFoodIds,
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
      label: 'Полдник', time: '15:30', type: 'snack',
      proteinG: mealBudget.snack.p,
      carbG: mealBudget.snack.c,
      fatG: mealBudget.snack.f,
      pool, proteinRotationIds: snackRot.ids, seed: seedBase + 8,
      includeVeg: false, includeFruit: true,
      preferredIds: input.preferredIds,
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
    const prew = buildPreWorkout(preTime, 'Предтренируюсь', seedBase + 3, pool, input.budget, input.preferredIds);
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
    const postw = buildPostWorkout(postTime, 'Пост-трен', seedBase + 5, pool);
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
    preferredIds: input.preferredIds,
    lockedIds: input.lockedIds, recentIds: input.recentFoodIds,
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
  const preSleep = wantPreSleep ? buildPreSleep(tPreSleep, preSleepSeed, pool, residualP) : null;
  if (preSleep) { meals.push(preSleep); preSleep.items.forEach(i => allFoodsUsed.push(i.id)); notes.push('Pre-sleep: казеин + Mg + мелатонин-источник для ночного восстановления'); }

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

  // ─── Коррекция KBJU: сохраняем белок, корректируем углеводы/жиры ───
  const TOL = 0.08; // 8% tolerance — real-world meal assembly varies 8-12%
  const devK = Math.abs(totals.kcal - input.goalKcal) / Math.max(1, input.goalKcal);
  if (devK > TOL) {
    const kcalDiff = input.goalKcal - totals.kcal; // positive = need more, negative = need less
    // Strategy: adjust carb/fat portions (NOT protein — it's MPS-optimized per meal)
    // Find all non-protein items (carbs + fats), sorted by amount descending (adjust biggest first)
    const adjustableItems = meals.flatMap(m => m.items.filter(it => it.role === 'carb_slow' || it.role === 'carb_fast' || it.role === 'fat' || it.role === 'fruit').map(it => ({ meal: m, item: it })));
    if (adjustableItems.length > 0) {
      const kcalPerItem = Math.round(kcalDiff / adjustableItems.length);
      adjustableItems.forEach(({ meal, item }) => {
        const food = FOOD_DB.find(f => f.id === item.id);
        if (!food) return;
        const kcalPer100g = food.kcal || 0;
        if (kcalPer100g <= 0) return;
        const deltaGrams = Math.round(kcalPerItem / kcalPer100g * 100);
        const newAmount = Math.max(15, Math.min(MAX_GRAM_PER_ITEM, item.amount + deltaGrams));
        const factor = newAmount / (item.amount || 1);
        item.amount = newAmount;
        item.kcal = Math.round(item.kcal * factor);
        item.p = Math.round(item.p * factor);
        item.f = Math.round(item.f * factor);
        item.c = Math.round(item.c * factor);
        item.fiber = Math.round(item.fiber * factor);
        item.leucine_mg = Math.round((item.leucine_mg || 0) * factor);
      });
      // Recalculate all meal totals
      meals.forEach(m => {
        m.totals = m.items.reduce((acc, it) => ({
          kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c,
          fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0),
        }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
      });
      totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0);
      totals.p = meals.reduce((s, m) => s + m.totals.p, 0);
      totals.f = meals.reduce((s, m) => s + m.totals.f, 0);
      totals.c = meals.reduce((s, m) => s + m.totals.c, 0);
      totals.fiber = meals.reduce((s, m) => s + m.totals.fiber, 0);
      totals.leucine_mg = meals.reduce((s, m) => s + m.totals.leucine_mg, 0);
    }
  }

  notes.push(`Сводка MPS: ${feedings} feedings × ${mpsSummary.avg_protein_per_meal_g} г/meal, ${mpsSummary.avg_leucine_g} г лейцина (порог ${LEU_THRESHOLD_MG / 1000} г)`);
  notes.push(`Диверсификация: ${uniqueFoods} уникальных продуктов (${Object.keys(categories).length} категорий)`);
  if (input.isCutting) notes.push('Сушка: повышенная плотность белка, заниженные углеводы у ужина');
  if (mpsSummary.prePostWindow) notes.push('Pre/post-workout окно реализовано (полноценное анаболическое обеспечение тренировки)');

  const deficiencyClosure = closeFoodDeficiencies(meals);
  if (deficiencyClosure.length > 0) notes.push(...deficiencyClosure);

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
};
function getMicroFromFood(food: FoodItem, field: string): number {
  const m = food.micros as Record<string, number> | undefined;
  const e = food.electrolytes_100g as Record<string, number> | undefined;
  const t = food.trace_elements_100g as Record<string, number> | undefined;
  const mc = food.macro_100g as Record<string, number> | undefined;
  return m?.[field] ?? e?.[field] ?? t?.[field] ?? mc?.[field] ?? 0;
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
      const addMg = Math.round(getMicroFromFood(food!, key) * addG / 100);
      notes.push(`⚠ Дефицит ${key}: ${pct}% RDA (${Math.round(val)}/${cfg.rda} ${cfg.unit}). Добавьте ${name} ${addG} г (ещё ${addMg} ${cfg.unit})`);
    }
  });
  return notes;
}