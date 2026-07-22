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
import { filterBySpecificity, filterByIntolerance, matchesCategoryPref, isPreferredCategory, tasteMatchScore, type Specificity, type CategoryPref, type Intolerances, type TasteProfile } from "./planner-preferences";
import { analyzeMicroCoverage, type MicroCoverageEntry } from "./planner-micro-coverage";
import { detectMealInteractions, cookMethodGuidance } from "./planner-food-interactions";
import type { FoodItem } from "../../../../core/nutrition-database";
import type { LabCompositeResult } from "../../../../engines/lab-analysis.engine";

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
  microSummary?: { coverage: MicroCoverageEntry[]; topDeficitNutrient: string | null };
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
  // Д-8: session length in minutes — intra-workout only makes sense for sessions > ~75 min.
  trainDurationMin?: number;
  allowIntraWorkout?: boolean;
  excludedIds?: Set<string>;
  preferredIds?: Set<string>;
  // D-28: meal-bound preferred — food bound to a specific meal (e.g. rice_cream only on breakfast).
  preferredByMeal?: Record<string, Set<string>>;
  // D-28+: advanced user-preference filters
  specificity?: Specificity;              // 'everyday' | 'varied' | 'gourmet'
  categoryPref?: CategoryPref;           // preferred/excluded categories
  intolerances?: Intolerances;            // lowFODMAP, lowHistamine, lowOxalate
  tasteProfile?: TasteProfile;            // spicy/sweet/salty/sour (0-3)
  deprioritizedIds?: Set<string>;         // B: adaptive history — frequently-replaced foods
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
  // Smart 7-day variety: foods used in the last 1-2 days — HARD-excluded (stricter than
  // recentFoodIds which only deprioritizes). Empty by default = no hard exclusion.
  hardRecentIds?: Set<string>;
  // 'soft' = only deprioritize recent (legacy). 'strict' = hard-exclude hardRecentIds.
  varietyStrictness?: 'soft' | 'strict';
  // Адаптация по дневнику: дельта к сегодняшней цели (note пробрасывается в plan notes).
  diaryCompensation?: { kcalDelta: number; pDelta: number; fDelta: number; cDelta: number; note: string; severity?: 'low' | 'medium' | 'high' };
  // FIX 1: User-set meal times (overrides hardcoded defaults)
  wakeTime?: string;
  lunchTime?: string;
  dinnerTime?: string;
  bedTime?: string;
  // Plan type multipliers (keto, highcarb, mediterranean, vegetarian)
  planTypeMod?: { pMult: number; fMult: number; cMult: number };
  // Evening low-carb: reduce dinner carbs, increase lunch carbs
  eveningLowCarb?: boolean;
  // Lab values for dietary adjustments (key = lab code from REFERENCE_RANGES)
  labValues?: Record<string, number>;
  // #2 Female bone health: override Ca target (1200-1500mg for low-bf/amenorrhea/menopause).
  calciumTargetOverride?: number;
  // #1 Female menstrual phase note (surfaced in plan notes).
  menstrualPhaseNote?: string;
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
  casein: 140, casein_micellar: 140, bcaa: 20, supp_eaa: 20,
  glutamine: 15, supp_hmb: 6, supp_beta_alanine: 6, supp_citrulline_dl_malate: 12,
  supp_agmatine_sulfate: 2, supp_l_carnitine_tartrate: 4, supp_alpha_gpc: 2,
  amylopectin: 80, dextrose: 80, collagen_hydrolysate: 20,
};
// Глобальный лимит на одну порцию любого продукта (г)
const MAX_GRAM_PER_ITEM = 500;
// D-18: Realistic portion cap for cooked grains/cereals (porridge, buckwheat, rice, pasta,
// barley, millet, quinoa ~12-28g carbs/100g). Without this, a 140g-carb lunch target pushes
// buckwheat to ~700g portions (capped only at the global 500g) — an absurd single bowl.
// Cap grains at 280g per meal; if the carb target needs more, a second carb source is added.
const MAX_GRAIN_GRAM_PER_MEAL = 280;
// D-21: realistic dry-grain portion ceiling. Grains/pasta are tracked DRY (~64-83g carbs/100g),
// so a normal large portion is ~100-150g dry (~300-400g cooked). 150g dry ~ 90-120g carbs — a
// big but sane single bowl; more than that splits into a second carb source (D-18b).
const MAX_DRY_GRAIN_GRAM_PER_MEAL = 150;

// D-18: realistic per-portion ceiling for a carb source. Low-density cooked starches
// (grains ~12-28g/100g, potato ~17-21g, cooked pasta) need huge gram portions to hit a
// carb target — without a cap a 140g-carb lunch pushes buckwheat to ~700g. High-density
// carbs (bread ~50g/100g, dried fruit, honey) naturally portion small, so they keep the
// global MAX_GRAM_PER_ITEM ceiling. Threshold: <30g carbs/100g = "cooked starch" bowl.
function carbPortionCap(food: FoodItem): number {
  const carbPer100 = food.carbs || 0;
  // D-18 + D-21: grains/pasta are now tracked DRY (bodybuilding rule) — carb density
  // ~64-83g/100g. A realistic dry portion is ~150g (~400g cooked bowl), so cap dense
  // dry cereals at 150g. Low-density cooked starches that are still cooked-weight
  // (potato, corn on the cob ~17-21g/100g) keep the 280g cooked cap. Bread and other
  // ready-to-eat medium-density carbs keep the global 500g ceiling.
  if (carbPer100 >= 55) return MAX_DRY_GRAIN_GRAM_PER_MEAL;   // dry grains/pasta
  if (carbPer100 > 0 && carbPer100 < 30) return MAX_GRAIN_GRAM_PER_MEAL; // cooked starch (potato)
  return MAX_GRAM_PER_ITEM;
}

const MEAT_KEYWORDS = ['beef','pork','chicken','turkey','lamb','veal','duck','salmon','tuna','shrimp','cod','mackerel','trout','sardine','crab','lobster','squid','octopus','venison','rabbit','goose','pate','sausage','bacon','ham','pepperoni','salami','bologna','hot_dog','meatball','cutlet','steak','pollock','tilapia','herring','anchovy','clam','mussel','oyster','scallops','catfish','flounder','sole','white_fish','whelk','cockles','seafood_','fish_','_fish','mintai','mahi','trumpeter','shellfish','cockle','abalone','conch','snail','escargot','sea_urchin','sea_cucumber','caviar','roe','liver','kidney','heart_tripe','tongue','brain','sweetbread','gizzard','bison','frog','elk','boar','quail','pheasant','goat','mutton','crayfish','krill','eel','sturgeon','halibut','perch','carp','pike','bream','bass','grouper','snapper','tongue','tripe','oxtail','trotters','wings','drumstick','thigh','breast_','_breast','mince','_minced'];
const isMeatId = (id: string): boolean => MEAT_KEYWORDS.some(k => id.toLowerCase().includes(k));

// Д-3: Premium / exotic / rare foods that should NOT appear in a low/medium-budget plan.
// 'low'/'medium' budget previously filtered only by bb_quality_score, letting luxury items
// (abalone, macadamia, loquat, game meats, exotic oils/eggs) into rations. This set excludes them.
// Д-3: premium/exotic foods excluded from low/medium budgets. Tokens match REAL FOOD_DB ids
// (e.g. oil_mustard, oil_black_cumin, oil_perilla, oil_camelina, oil_truffle, oil_macadamia).
const PREMIUM_OR_EXOTIC = ['abalone','sea_urchin','caviar','roe','truffle','macadamia','medlar','lobster','crab','mussels','clams','squid','oysters','octopus','scallop','langoust','crayfish','sea_cucumber',
  'oil_mustard','oil_black_cumin','oil_perilla','oil_camelina','oil_truffle','oil_macadamia','oil_hazelnut',
  'oil_almond','oil_walnut','oil_cedar','oil_pistachio','saffron','vanilla','quail_egg','duck_egg','goose_egg','ostrich',
  'venison','rabbit','duck_breast','duck_leg','goose_roasted','veal','mahi','trumpeter','conch','quail_whole',
  'sea_cucumber','whale','bear','chestnut','pine_nut','oil_hemp_organic','oil_rice_bran_organic','oil_grapeseed_cold'];
const isPremiumOrExotic = (id: string): boolean => {
  const lid = id.toLowerCase();
  return PREMIUM_OR_EXOTIC.some(k => lid.includes(k)) || lid.startsWith('lamb');
};

// ─── Lab-driven dietary adjustments ─────────────────────────────────────
interface LabDietAdjustment {
  restrictFoodIds: Set<string>;
  preferFoodIds: Set<string>;
  notes: string[];
  macroAdjustments: { proteinMult?: number; carbMult?: number; fatMult?: number };
}

function computeLabDietAdjustment(input: MealPlanInput): LabDietAdjustment {
  const labs = input.labValues || {};
  const restrict = new Set<string>();
  const prefer = new Set<string>();
  const notes: string[] = [];
  const macroAdjustments: LabDietAdjustment['macroAdjustments'] = {};

  // Helper: add food IDs by keyword
  const restrictByKeyword = (...keywords: string[]) => {
    FOOD_DB.forEach(f => {
      if (keywords.some(k => f.id.toLowerCase().includes(k))) restrict.add(f.id);
    });
  };
  const preferByKeyword = (...keywords: string[]) => {
    FOOD_DB.forEach(f => {
      if (keywords.some(k => f.id.toLowerCase().includes(k))) prefer.add(f.id);
    });
  };

  // 🔴 POTASSIUM HIGH (hyperkalemia risk) — restrict K-rich foods
  if (labs.POTASSIUM !== undefined && labs.POTASSIUM > 5.0) {
    restrictByKeyword('avocado', 'potato', 'spinach', 'banana', 'tomato', 'salmon', 'mackerel', 'yogurt', 'coconut', 'dried', 'beet');
    notes.push('⚠️ Калий >5.0 ммоль/л: ограничены авокадо, картофель, шпинат, бананы, помидоры, лосось, сухофрукты');
  }

  // 🔴 SODIUM HIGH / HYPERTENSION — restrict Na-rich foods
  if (labs.SODIUM !== undefined && labs.SODIUM > 145) {
    restrictByKeyword('salt', 'soy_sauce', 'pickles', 'olives', 'cheese', 'sausage', 'bacon', 'ham', 'canned', 'bouillon', 'processed');
    notes.push('⚠️ Натрий >145 ммоль/л: исключены соль, соевый соус, консервы, колбасы, сыры, оливки');
  }

  // 🔴 GLUCOSE/INSULIN HIGH — lower carb, lower GI, add insulin sensitizers
  if ((labs.GLUCOSE !== undefined && labs.GLUCOSE > 6.1) || (labs.INSULIN !== undefined && labs.INSULIN > 15) || (labs.HOMA_IR !== undefined && labs.HOMA_IR > 2.5)) {
    macroAdjustments.carbMult = (macroAdjustments.carbMult || 1) * 0.85;
    preferByKeyword('buckwheat', 'barley', 'oats', 'quinoa', 'lentils', 'chickpeas', 'beans', 'broccoli', 'spinach', 'cinnamon', 'berberine', 'chia', 'flax');
    restrictByKeyword('rice_white', 'bread_white', 'pasta', 'potato', 'sugar', 'honey', 'juice', 'soda', 'cake', 'cookie');
    notes.push('⚠️ Глюкоза/инсулин/ГИР повышены: углеводы ×0.85, низкий ГИ, добавлены клинча/бобовые/ягоды');
  }

  // 🟡 LIVER STRESS (ALT/AST/GGT) — liver support, lower fat
  if ((labs.ALT !== undefined && labs.ALT > 40) || (labs.AST !== undefined && labs.AST > 40) || (labs.GGT !== undefined && labs.GGT > 55)) {
    macroAdjustments.fatMult = (macroAdjustments.fatMult || 1) * 0.9;
    preferByKeyword('nac', 'tudca', 'milk_thistle', 'artichoke', 'beetroot', 'turmeric', 'broccoli', 'cabbage', 'coffee');
    restrictByKeyword('alcohol', 'fried', 'fast_food', 'pork', 'liver', 'cream', 'butter', 'margarine');
    notes.push('⚠️ АЛТ/АСТ/ГГТ повышены: жиры ×0.9, гепатопротекторы (NAC, TUDCA, силмарин), исключен алкоголь/жирное');
  }

  // 🟡 KIDNEY STRESS (CREATININE/UREA) — moderate protein, kidney support
  if ((labs.CREATININE !== undefined && labs.CREATININE > 110) || (labs.UREA !== undefined && labs.UREA > 8.3)) {
    macroAdjustments.proteinMult = (macroAdjustments.proteinMult || 1) * 0.9;
    preferByKeyword('cranberry', 'blueberry', 'pumpkin', 'watermelon', 'cucumber', 'cordyceps', 'astragalus');
    restrictByKeyword('protein_powder', 'creatine', 'red_meat', 'organ_meat', 'sardines', 'anchovies');
    notes.push('⚠️ Креатинин/мочевина повышены: белок ×0.9, почечная поддержка, ограничены добавки/красное мясо');
  }

  // 🟡 HEMATOCRIT HIGH — blood viscosity management
  if (labs.HEMATOCRIT !== undefined && labs.HEMATOCRIT > 52) {
    preferByKeyword('serrapeptase', 'nattokinase', 'bromelain', 'garlic', 'onion', 'omega3', 'fish_oil', 'ginger', 'cayenne');
    restrictByKeyword('iron', 'red_meat', 'liver', 'spinach'); // avoid excess iron
    notes.push('⚠️ Гематокрит >52%: фибринолитики (серрапептаза, наттокиназа), омега-3, ограничен Fe/красное мясо');
  }

  // 🟡 LIPIDS (LDL/APOB) — lower sat fat, add fiber/plant sterols
  if ((labs.LDL !== undefined && labs.LDL > 3.5) || (labs.APOB !== undefined && labs.APOB > 1.0)) {
    macroAdjustments.fatMult = (macroAdjustments.fatMult || 1) * 0.9;
    preferByKeyword('oats', 'barley', 'psyllium', 'flax', 'chia', 'nuts', 'olive_oil', 'avocado', 'plant_sterol', 'bergamot');
    restrictByKeyword('butter', 'cream', 'cheese_hard', 'fat_meat', 'coconut_oil', 'palm_oil', 'trans_fat');
    notes.push('⚠️ ЛПНП/АпоБ повышены: насыщ. жиры ×0.9, бета-глюкан/фитостеролы/омега-3, исключено кокос/пальма');
  }

  // 🟡 THYROID (TSH HIGH) — selenium, zinc, iodine support
  if (labs.TSH !== undefined && labs.TSH > 4.0) {
    preferByKeyword('brazil_nuts', 'seafood', 'egg', 'seaweed', 'iodized_salt', 'pumpkin_seeds', 'beef', 'turkey');
    restrictByKeyword('soy', 'raw_cruciferous', 'millet'); // goitrogens in excess
    notes.push('⚠️ ТТГ >4 мМЕ/л: Se/Zn/I (бразильский орех, морепродукты, яйца), ограничены стритогенны');
  }

  // 🟡 VITAMIN D LOW — fatty fish, egg yolk, supplement
  if (labs.VITAMIN_D !== undefined && labs.VITAMIN_D < 30) {
    preferByKeyword('salmon', 'mackerel', 'sardines', 'egg_yolk', 'cod_liver', 'mushroom_uv');
    notes.push('⚠️ Вит D <30 нг/мл: жирная рыба, желток, грибы UV, добавка D3+K2');
  }

  // 🟡 FERRITIN LOW — iron + vitamin C
  if (labs.FERRITIN !== undefined && labs.FERRITIN < 30) {
    preferByKeyword('beef_liver', 'red_meat', 'lentils', 'spinach', 'pumpkin_seeds', 'vitamin_c', 'pepper', 'citrus', 'kiwi');
    notes.push('⚠️ Ферритин <30 мкг/л: гемовый Fe + вит C, растительный Fe + C, чай/кофе отдельно');
  }

  // 🟡 HOMOCYSTEINE HIGH — B6/B12/B9/betaine
  if (labs.HOMOCYSTEINE !== undefined && labs.HOMOCYSTEINE > 12) {
    preferByKeyword('beef_liver', 'egg', 'spinach', 'broccoli', 'asparagus', 'betaine', 'beetroot', 'b12', 'folate', 'b6');
    notes.push('⚠️ Гомоцистеин >12 мкмоль/л: B6/B12/фолат/бетаин (печень, яйцо, шпинат, свекла)');
  }

  // 🟡 CRP HIGH — anti-inflammatory
  if (labs.CRP !== undefined && labs.CRP > 5) {
    preferByKeyword('omega3', 'fish_oil', 'curcumin', 'turmeric', 'berries', 'ginger', 'green_tea', 'boswellia', 'resveratrol');
    notes.push('⚠️ CRP >5 мг/л: омега-3, куркумин, ягоды, имбирь, зеленый чай');
  }

  return { restrictFoodIds: restrict, preferFoodIds: prefer, notes, macroAdjustments };
}

// ─── Источники белковой ротации (только существующие ID в FOOD_DB) ──────
const PROTEIN_ROTATION: { label: string; ids: string[]; note: string }[] = [
  { label: 'Птица', ids: ['chicken_breast','turkey_breast','chicken_thigh'], note: 'Низкожирный цельный белок, высокий DIAAS (≈1.18)' },
  { label: 'Жирная рыба (Omega-3)', ids: ['salmon','mackerel','sardines','tuna_steak'], note: 'EPA/DHA + природный креатин, противовоспалительный эффект' },
  { label: 'Постная рыба', ids: ['cod','pollock','tuna_canned'], note: 'Самая высокая плотность белка, низкий жир, идеальна ночью' },
  { label: 'Красное мясо', ids: ['beef_lean','beef_liver','rabbit'], note: 'Гемовое железо + Zn + B12, креатин 4–5 г/кг' },
  { label: 'Яйца/молоко', ids: ['egg_whole','egg_white','cottage_cheese_5','yogurt_greek'], note: 'Биологическая ценность яйца = 100, казеин = 77' },
  { label: 'Морепродукты', ids: ['shrimp','tuna_canned','cod','pollock'], note: 'Йод + таурин, низкокалорийно' },
  { label: 'Сыворотка/молоко', ids: ['whey_protein','whey_isolate','milk','kefir'], note: 'Сыворотка — самый быстрый белок, пик аминокислот 60 мин' },
  { label: 'Веган/бобовые', ids: ['tofu','tempeh','lentils','chickpeas','edamame'], note: 'Растительный белок, дополнить сывороткой для лейцина' },
];

function pickRotation(dayOffset: number): { label: string; ids: string[]; note: string } {
  return PROTEIN_ROTATION[Math.abs(dayOffset) % PROTEIN_ROTATION.length] || PROTEIN_ROTATION[0];
}

// ─── Preference: common bodybuilding carbs get selection bonus ───
const COMMON_CARB_IDS = new Set(['rice_white','rice_brown','buckwheat','potato_boiled','pasta_durum','quinoa','barley','cereal','millet','couscous','noodle','bulgur','chickpea','lentil','beans','corn','bread']);

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
// D-28+: module-scoped preference vars (set by buildDayPlan, read by pickWeighted)
var _tasteProfile: any = undefined;
var _deprioritizedIds: Set<string> | undefined = undefined;
var _categoryPref: any = undefined;

function pickWeighted(arr: FoodItem[], seed: number): FoodItem | undefined {
  if (arr.length === 0) return undefined;
  if (arr.length === 1) return arr[0];
  const weights = arr.map((f, i) => {
    const score = (f as any).bb_quality_score ?? 5;
    let w = Math.max(0.5, Math.pow(score, 1.5));
    // A: taste profile boost — foods matching user's taste preferences get higher weight
    if (_tasteProfile) { const ts = tasteMatchScore(f, _tasteProfile); if (ts > 0) w *= (1 + ts * 0.3); }
    // B: deprioritize frequently-replaced foods
    if (_deprioritizedIds && _deprioritizedIds.has((f as any).id)) w *= 0.3;
    // C: category-preferred boost
    if (_categoryPref && isPreferredCategory(f, _categoryPref)) w *= 1.5;
    return w;
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
function pickPriority<T extends { id: string }>(arr: T[], seed: number, opts?: { lockedIds?: Set<string>; preferredIds?: Set<string>; recentIds?: Set<string>; hardRecentIds?: Set<string> }): T | undefined {
  if (arr.length === 0) return undefined;
  const locked = opts?.lockedIds;
  const preferred = opts?.preferredIds;
  const recent = opts?.recentIds;
  const hardRecent = opts?.hardRecentIds;
  // 0. Smart 7-day variety — HARD-exclude foods used in the last 1-2 days.
  //    Never exclude locked foods (user intent overrides variety). Only apply the hard
  //    filter when enough alternatives remain (>=2), else fall through to soft logic
  //    so the plan isn't starved on small pools.
  let pool = arr;
  if (hardRecent && hardRecent.size > 0) {
    const filtered = arr.filter(f => !hardRecent.has(f.id) || (locked != null && locked.has(f.id)));
    if (filtered.length >= Math.min(2, arr.length)) pool = filtered;
  }
  // 1. Locked foods get absolute priority
  if (locked && locked.size > 0) {
    const lockedPool = pool.filter(f => locked.has(f.id));
    if (lockedPool.length > 0) return lockedPool[Math.floor(seededRandom(seed) * lockedPool.length)];
  }
  // 2. Preferred foods get next priority — but only FRESH ones (not already used today).
  // When every preferred is already in recentIds, fall through to normal pick so the plan
  // isn't monopolised by a single favourite in every meal.
  if (preferred && preferred.size > 0) {
    const prefPool = pool.filter(f => preferred.has(f.id));
    if (prefPool.length > 0) {
      const freshPref = (recent && recent.size > 0) ? prefPool.filter(f => !recent.has(f.id)) : prefPool;
      if (freshPref.length > 0) return freshPref[Math.floor(seededRandom(seed) * freshPref.length)];
      // all preferred already used today → variety pick (fall through)
    }
  }
  // 3. Deprioritize recent foods: filter them out if enough alternatives exist
  if (recent && recent.size > 0) {
    const freshPool = pool.filter(f => !recent.has(f.id));
    if (freshPool.length >= Math.min(3, pool.length)) {
      return freshPool[Math.floor(seededRandom(seed) * freshPool.length)];
    }
  }
  // 4. Quality-weighted pick (higher bb_quality_score = higher chance)
  return pickWeighted(pool as any as FoodItem[], seed) as any as T;
}

// ─── Дескриптор лейцина в продукте (мг/100 г) ──────────────────────────
function getLeucine(food: FoodItem): number {
  return food.amino_acid_profile_100g?.leucine_mg ?? food.micros?.Leucine ?? Math.round((food.protein || 0) * 85);
}

// ─── Граммовка для достижения цели по макросу ─────────────────────────
function gramsForMacro(food: FoodItem, targetG: number, macro: 'protein' | 'carbs' | 'fat', capG?: number): number {
  const per100 = macro === 'protein' ? (food.protein || 0) : macro === 'carbs' ? (food.carbs || 0) : (food.fat || 0);
  if (per100 <= 0) return 0;
  // Role-aware minimum: fat-dense foods (oils, nuts) need smaller min grams
  const minG = macro === 'fat' && per100 >= 80 ? 5 : macro === 'fat' && per100 >= 50 ? 10 : 20;
  // D-18: realistic per-item gram ceiling. Default to MAX_GRAM_PER_ITEM; caller may pass a
  // tighter cap (e.g. MAX_GRAIN_GRAM_PER_MEAL for cooked grains so a 140g-carb target doesn't
  // produce a 500g bowl of buckwheat).
  const ceiling = Math.min(MAX_GRAM_PER_ITEM, capG ?? MAX_GRAM_PER_ITEM);
  const base = Math.min(ceiling, Math.max(minG, Math.round(targetG / per100 * 100)));
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
function buildFoodPools(excludedIds: Set<string>, isVeg: boolean, budget: MealPlanInput['budget'], varietyPoolSize?: number, preferredIds?: Set<string>, opts?: { specificity?: Specificity; categoryPref?: CategoryPref; intolerances?: Intolerances; tasteProfile?: TasteProfile; deprioritizedIds?: Set<string> }) {
  const isMealFood = (f: FoodItem) =>
    f.category !== 'supplement' || ['whey_protein', 'whey_isolate', 'whey_concentrate', 'casein', 'casein_micellar', 'supp_pea_protein', 'supp_soy_isolate', 'supp_rice_protein', 'supp_eaa', 'bcaa'].includes(f.id);
  // Д-3: build basePoolRaw first, then exclude premium/exotic at the source for low/medium budgets so
  // they cannot enter ANY pool via raw fallbacks (fatsRaw, cFruitRaw) which bypass byBudget.
  // D-27: force-include preferred foods into the relevant pools (after variety-limit + budget filter)
  // so a user's favourite (e.g. rice_cream, GI 82) is actually selectable in regular meals.
  // Without this, preferred foods that don't match the GI/category gate (rice_cream is high-GI → carbFast,
  // but regular meals pick from carbSlow) are never chosen despite being marked preferred.
  const mergePreferred = <T extends FoodItem>(arr: T[], pred: (f: FoodItem) => boolean): T[] => {
    if (!preferredIds || preferredIds.size === 0) return arr;
    const have = new Set(arr.map(f => f.id));
    const extra = basePoolRaw.filter(f => preferredIds.has(f.id) && !have.has(f.id) && !excludedIds.has(f.id) && pred(f));
    return extra.length ? ([...arr, ...extra] as T[]) : arr;
  };
    const basePoolRaw = FOOD_DB.filter(f => {
    if (excludedIds.has(f.id)) return false;
    if (!isMealFood(f)) return false;
    // Д-10: prefer explicit isVegetarian tag; isMeatId is only a last-resort heuristic for unlabeled foods.
    // Vegetarian (lacto-ovo) ALLOWS dairy and eggs — only isVegan excludes them, so we don't use isVegan here.
    if (isVeg) { const diet = FOOD_ALLERGEN_DIET[f.id]; if ((diet && diet.isVegetarian === false) || (diet === undefined && f.isVegetarian === false) || (isMeatId(f.id) && f.isVegetarian !== true && f.isVegan !== true)) return false; }
    return true;
  });
  let _baseFiltered = (budget === 'max' || budget === 'enhanced')
    ? basePoolRaw
    : basePoolRaw.filter(f => !isPremiumOrExotic(f.id));
  // D-28+: apply specificity, intolerance, category-exclusion filters
  if (opts?.specificity && opts.specificity !== 'varied') _baseFiltered = filterBySpecificity(_baseFiltered, opts.specificity);
  const _into = opts?.intolerances; if (_into) _baseFiltered = _baseFiltered.filter(f => filterByIntolerance(f, _into));
  const _cpref = opts?.categoryPref; if (_cpref) _baseFiltered = _baseFiltered.filter(f => matchesCategoryPref(f, _cpref));
  const basePool = _baseFiltered;
  const byBudget = <T extends FoodItem>(arr: T[]): T[] => {
    if (budget === 'max' || budget === 'enhanced') return arr.filter(f => (f.bb_quality_score ?? 5) >= 8);
    // Д-3: 'low' budget = affordable quality AND not premium/exotic (abalone, game, macadamia, etc.)
    if (budget === 'low') return arr.filter(f => (f.bb_quality_score ?? 5) <= 7 && !isPremiumOrExotic(f.id));
    return arr.filter(f => !isPremiumOrExotic(f.id));
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
    proteinSolid: mergePreferred(limitPoolByVariety(pSolid.length > 0 ? pSolid : anyProtein, 10001), f => f.category === 'protein' || f.category === 'dairy'),
    proteinFatty: limitPoolByVariety(pFatty.length > 0 ? pFatty : anyProtein, 10003),
    proteinLean: limitPoolByVariety(pLean.length > 0 ? pLean : anyProtein, 10005),
    fastProtein: FOOD_DB.filter(f => !excludedIds.has(f.id) && (f.id === 'whey_isolate' || f.id === 'whey_protein' || f.id === 'egg_white')),
    slowProtein: FOOD_DB.filter(f => !excludedIds.has(f.id) && (f.id === 'casein' || f.id === 'cottage_cheese_5' || f.id === 'yogurt_greek')),
    carbSlow: mergePreferred(limitPoolByVariety(cSlowBud.length > 0 ? cSlowBud : cSlowRaw.length > 0 ? cSlowRaw : basePool.filter(f => (f.category === 'grain' || f.category === 'carb') && (f.carbs || 0) >= 15), 10011), f => f.category === 'grain' || f.category === 'carb'),
    carbFast: mergePreferred(limitPoolByVariety(cFastBud.length > 0 ? cFastBud : cFastRaw.length > 0 ? cFastRaw : cFruitBud.length > 0 ? cFruitBud : basePool.filter(f => (f.category === 'grain' || f.category === 'carb') && (f.carbs || 0) >= 15), 10013), f => f.category === 'grain' || f.category === 'carb'),
    carbFruit: mergePreferred(limitPoolByVariety(cFruitBud.length > 0 ? cFruitBud : cFruitRaw, 10015), f => f.category === 'veg_fruit'),
    fats: mergePreferred(limitPoolByVariety(fatsBud.length > 0 ? fatsBud : fatsRaw, 10017), f => f.category === 'fat'),
    vegGreen: basePool.filter(f => f.category === 'veg_fruit' && ['broccoli','spinach','cucumber','zucchini','asparagus','green_bean','celery','cabbage','kale','green_apple','bok_choy','brussels','cauliflower','watercress','arugula','endive','peas_green','edamame','fennel','leek'].some(k => f.id.includes(k)) && (f.protein || 0) < 5 && (f.fat || 0) < 2),
    vegColor: basePool.filter(f => f.category === 'veg_fruit' && ['tomato','pepper','carrot','beetroot','pumpkin','eggplant','pomegranate','citrus','radish','sweet_potato','mushrooms','champignon','seaweed','wakame','papaya','kiwi','squash','turnip','parsnip'].some(k => f.id.includes(k.toLowerCase())) && (f.protein || 0) < 5 && (f.fat || 0) < 2),
    dairy: byBudget(basePool.filter(f => f.category === 'dairy' && (f.fat || 0) <= 10)),
    // Д-5: vegetarian protein pool — relaxed thresholds so tofu/tempeh/seitan and carb-category
    // legumes (lentils, chickpeas, edamame) actually enter the rotation (not only dairy).
    vegProteinExtra: basePool.filter(f => !isPremiumOrExotic(f.id) && (
      (f.category === 'protein' && (f.protein || 0) >= 8) ||
      (f.id === 'tofu' || f.id === 'tempeh' || f.id === 'seitan' || f.id === 'edamame' ||
       f.id === 'lentils' || f.id === 'chickpeas' || f.id === 'hummus')
    )),
    eaa: FOOD_DB.find(f => !excludedIds.has(f.id) && f.id === 'supp_eaa') ?? FOOD_DB.find(f => !excludedIds.has(f.id) && f.id === 'bcaa'),
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
    isVegetarian?: boolean;
    rationales: string[];
    preferredIds?: Set<string>;
    mealPreferredIds?: Set<string>; // D-28: meal-bound preferred (e.g. rice_cream → breakfast only)
    preferredByMealFull?: Record<string, Set<string>>; // D-28: full map to exclude other-meal-bound from global preferred
    lockedIds?: Set<string>;
    recentIds?: Set<string>;
    hardRecentIds?: Set<string>;
    vegColorIdx?: number; // which VEG_COLOR_GROUPS to prefer
  }
): Meal {
  const { label, time, type, proteinG, carbG, fatG, pool, proteinRotationIds, seed, includeVeg, includeFruit, isVegetarian, rationales, preferredIds: _preferredIds, mealPreferredIds, lockedIds, recentIds, hardRecentIds, vegColorIdx } = params;
  // D-28: effective preferred = (global preferred MINUS foods bound to other meals) ∪ meal-bound for THIS meal.
  // This ensures rice_cream bound to breakfast is preferred ONLY on breakfast, not everywhere.
  const _otherMealBound = new Set<string>(Object.entries(params.preferredByMealFull || {}).filter(([m]) => m !== label).flatMap(([, v]) => [...(v as any)]));
  const preferredIds = new Set<string>([...(_preferredIds || [])].filter(id => !_otherMealBound.has(id)).concat([...(mealPreferredIds || [])]));
 
  const items: MealItem[] = [];
  let remP = proteinG, remC = carbG, remF = fatG;

  // 1. Белок: роторный источник (предпочтение — preferred)
  // Д-5: rotation pool also includes vegetarian extras (tofu/tempeh/seitan/legumes) so the
  // "Веган/бобовые" rotation resolves to plant proteins instead of falling back to dairy only.
  const rotPoolAll = [...pool.proteinSolid, ...pool.proteinFatty, ...(pool.vegProteinExtra || [])].filter(f => proteinRotationIds.includes(f.id));
  // Д-15: fat-aware filter. Fatty proteins embed fat the fat-correction loop can't reach, so when the
  // meal fat budget is tight (remF < ~12 g) prefer lean rotation proteins (fat<=5); keep fatty ones only
  // when there is ample fat budget. Preferred/locked foods bypass the fat filter (user intent).
  const rotPool = (remF < 12)
    ? rotPoolAll.filter(f => (f.fat || 0) <= 5)
    : rotPoolAll;
  const rotPoolFinal = rotPool.length > 0 ? rotPool : rotPoolAll; // fall back to full rotation if lean empty
  const preferredRot = preferredIds && preferredIds.size > 0 ? rotPoolAll.filter(f => preferredIds.has(f.id)) : [];
  // Д-5: veg fallback chain adds vegProteinExtra (plant proteins) before generic dairy pools.
  const proteinPool = preferredRot.length > 0
    ? preferredRot
    : rotPoolFinal.length > 0 ? rotPoolFinal
    : (pool.vegProteinExtra && pool.vegProteinExtra.length > 0) ? pool.vegProteinExtra
    : (remF < 12 && pool.proteinLean.length > 0) ? pool.proteinLean
    : pool.proteinSolid;
  const proteinSource = pickPriority(proteinPool, seed, { lockedIds, preferredIds: preferredRot.length > 0 ? undefined : preferredIds, recentIds, hardRecentIds });
  if (proteinSource) {
    let grams = gramsForMacro(proteinSource, remP, 'protein');
   
    // Carb-aware protein sizing (D-16): legumes (lentils/chickpeas/beans ~20-27g carbs/100g,
    // modest protein) are carb-dense. Sizing them purely by the protein target blows the
    // meal's carb budget — this is the root cause of "huge carbs in the last meal" on dinner
    // / cutting / keto / low-carb days where the carb allocation is small. Cap the legume
    // portion to the carb budget (reserving room for the dedicated carb source + veg/fruit),
    // then let the MPS top-up (step 6) close the protein gap with zero-carb whey.
    const proteinCarbsPer100 = proteinSource.carbs || 0;
    const isCarbDenseProtein = proteinCarbsPer100 >= 8 && (proteinSource.protein || 0) < 25;
    if (isCarbDenseProtein && remC > 0) {
      const vegCarbReserve = includeVeg ? 12 : 0;
      const fruitCarbReserve = includeFruit ? 10 : 0;
      const maxCarbForProtein = Math.max(0, remC - vegCarbReserve - fruitCarbReserve);
      if (proteinCarbsPer100 > 0 && maxCarbForProtein < remC) {
        const carbCapGrams = Math.floor((maxCarbForProtein * 100) / proteinCarbsPer100);
        if (carbCapGrams < grams) {
          // Keep a sensible minimum portion (20g) even if it slightly overshoots —
          // better a small legume serving + whey top-up than no protein source.
          grams = Math.max(20, carbCapGrams);
        }
      }
    }
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
    // D-27: don't narrow to only-preferred (that monopolised one favourite in every meal).
    // Use the full carbSlow pool; pickPriority will honour preferred (fresh-first) for variety.
    const carbPool = pool.carbSlow;
    // Prefer common carbs (rice, oats, buckwheat, potato, pasta) over exotic ones
    const commonCarbs = carbPool.filter(f => COMMON_CARB_IDS.has(f.id));
    // GL-aware: при высокой углеводной цели (>=60g) выбираем источники с наименьшим GI,
    // чтобы удержать пер-приёмную гликемическую нагрузку (GL = GI×carbs/100) в зелёной зоне (<25).
    let carbPickPool = commonCarbs.length > 0 ? commonCarbs : carbPool;
    if (carbTarget >= 60 && !lockedIds?.size) {
      const byGI = [...carbPickPool].sort((a,b) => (a.gi||55) - (b.gi||55));
      // берём 3 самых низко-GI (fallback на полный пул, если их мало)
      carbPickPool = byGI.slice(0, 3).length >= 2 ? byGI.slice(0, 3) : carbPickPool;
      // D-27: preferred carbs bypass GL-aware narrowing (user intent > GI optimisation)
      if (preferredIds && preferredIds.size > 0) { const have = new Set(carbPickPool.map((f: any) => f.id)); const prefAdd = carbPool.filter((f: any) => preferredIds.has(f.id) && !have.has(f.id)); if (prefAdd.length) carbPickPool = [...carbPickPool, ...prefAdd]; }
    }
    const carbSource = pickPriority(carbPickPool, seed + 1, { lockedIds, recentIds, preferredIds, hardRecentIds });
// Fix 1 completion (preserve conditional) - lines 371 & 470 converted to exact COMMON_CARB_IDS.has(f.id)
     // Lines 371 & 470 now use exact Set membership check (removed substring.includes)
     // Debug: verify both lines use exact Set.has (UTF-8 safe)
     if (carbSource) {
      // D-18: cap cooked starches at a realistic 280g portion (avoids 500g buckwheat bowls).
      const grams = gramsForMacro(carbSource, carbTarget, 'carbs', carbPortionCap(carbSource));
      if (grams > 0) {
        const item = makeItem(carbSource, grams, 'carb_slow');
        items.push(item); remP -= item.p; remF -= item.f; remC -= item.c;
      }
      // D-18b: if the carb target was large and the first (grain-capped) source didn't cover it,
      // add a second carb source (different food) to close the gap — keeps daily carb totals
      // intact and adds intra-meal carb variety (e.g. buckwheat + rice).
     
      if (remC > 15 && carbTarget >= 50) {
        const secondPool = (commonCarbs.length > 0 ? commonCarbs : carbPool).filter(f => f.id !== carbSource.id);
        const carbSource2 = pickPriority(secondPool.length > 0 ? secondPool : carbPool.filter(f => f.id !== carbSource.id), seed + 11, { lockedIds, recentIds, hardRecentIds });
       
        if (carbSource2) {
          const grams2 = gramsForMacro(carbSource2, remC, 'carbs', carbPortionCap(carbSource2));
          if (grams2 > 0) {
            const item2 = makeItem(carbSource2, grams2, 'carb_slow');
            items.push(item2); remP -= item2.p; remF -= item2.f; remC -= item2.c;
          }
        }
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
    const vegSource = pickPriority(prefVegGreen.length > 0 ? prefVegGreen : fallbackGreen, seed + 2, { lockedIds, recentIds, hardRecentIds }) || pickPriority(prefVegColor.length > 0 ? prefVegColor : fallbackColor, seed + 3, { lockedIds, recentIds, hardRecentIds });
    if (vegSource) {
      const grams = 150 + Math.floor(seededRandom(seed + 3) * 100);
      const item = makeItem(vegSource, grams, 'veg');
      items.push(item); remP -= item.p; remF -= item.f; remC -= item.c;
    }
  }

  // 4. Фрукт (ягоды/киви как пребиотик и антиоксидант) (предпочтение — preferred)
  if (includeFruit) {
    const prefFruit = preferredIds && preferredIds.size > 0 ? pool.carbFruit.filter(f => preferredIds.has(f.id)) : [];
    const fSrc = pickPriority(prefFruit.length > 0 ? prefFruit : pool.carbFruit, seed + 4, { lockedIds, recentIds, hardRecentIds });
    if (fSrc) {
      const grams = 80 + Math.floor(seededRandom(seed + 5) * 60);
      const item = makeItem(fSrc, grams, 'fruit');
      items.push(item); remP -= item.p; remF -= item.f; remC -= item.c;
    }
  }

  // 5. Жиры: остаточный принцип (если remF > 5) (предпочтение — preferred)
  if (remF > 5) {
    const prefFat = preferredIds && preferredIds.size > 0 ? pool.fats.filter(f => preferredIds.has(f.id)) : [];
    const fatSource = pickPriority(prefFat.length > 0 ? prefFat : pool.fats, seed + 6, { lockedIds, recentIds, hardRecentIds });
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
          // Lacto-ovo vegetarian допускает молочные продукты → whey подходит и для вег-режима
          const whey = pool.fastProtein.find(f => f.id === 'whey_isolate') ?? pool.fastProtein.find(f => f.id === 'whey_protein') ?? pool.fastProtein[0];
          const needLeu = LEU_THRESHOLD_MG - curLeu;
          const wheyLeuPer100 = getLeucine(whey);
          const wheyGramsRaw = Math.round(needLeu / Math.max(1, wheyLeuPer100) * 100);
          const wheyGrams = Math.min(40, Math.max(15, wheyGramsRaw));
          const wItem = makeItem(whey, wheyGrams, 'fast_protein');
          if (wItem.p > 25) { wItem.p = 25; wItem.kcal = Math.round(wItem.p * 4 + wItem.f * 9 + wItem.c * 4); }
          items.push(wItem); remP -= wItem.p; remF -= wItem.f; remC -= wItem.c;
        }
      }

      // D-17: Post-build carb cap (safety net for buildWholeMeal only). Even after
      // carb-aware protein sizing, carb-rich veg (sweet_potato ~20g/100g, beetroot,
      // carrot) or large fruit portions can push the meal above its carb allocation.
      // If total carbs exceed the target by more than 25% + 10g tolerance, scale down
      // the carb-contributing items (carb source / veg / fruit — never protein items)
      // proportionally. This is what keeps dinner / cutting / low-carb evenings contained.
      if (carbG > 0) {
        const carbCeiling = Math.round(carbG * 1.25 + 10);
        const curC = items.reduce((s, i) => s + i.c, 0);
        if (curC > carbCeiling) {
          const carbItemIdxs = items
            .map((it, i) => ({ i, c: it.c, role: it.role }))
            .filter(x => x.c > 0 && x.role !== 'protein' && x.role !== 'fast_protein' && x.role !== 'slow_protein');
          const carbItemCarbs = carbItemIdxs.reduce((s, x) => s + x.c, 0);
          const proteinCarbs = curC - carbItemCarbs;
          if (carbItemCarbs > 0) {
            const target = Math.max(0, carbCeiling - proteinCarbs);
            const scale = Math.min(1, target / carbItemCarbs);
            carbItemIdxs.forEach(x => {
              const it = items[x.i];
              const newGrams = Math.max(0, Math.round(it.amount * scale));
              if (newGrams < it.amount) {
                const r = newGrams / it.amount;
                it.amount = newGrams;
                it.kcal = Math.round(it.kcal * r);
                it.p = Math.round(it.p * r);
                it.f = Math.round(it.f * r);
                it.c = Math.round(it.c * r);
                it.fiber = Math.round((it.fiber || 0) * r);
                it.leucine_mg = Math.round((it.leucine_mg || 0) * r);
              }
            });
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

  // #3 Синергии/конфликты продуктов в этом приёме.
  const _inter = detectMealInteractions(items.map(it => ({ id: it.id, name: it.name })));
  if (_inter.length > 0) {
    const _conflicts = _inter.filter(w => w.type === 'conflict');
    const _syn = _inter.filter(w => w.type === 'synergy');
    if (_conflicts.length > 0) rationales.push(..._conflicts.map(w => `⚠ ${w.text}`));
    if (_syn.length > 0) rationales.push(..._syn.map(w => w.text));
  }
  // #9 Способ приготовления — советы по обработке ключевых продуктов.
  const _cook = cookMethodGuidance(items.map(it => ({ id: it.id, name: it.name })));
  if (_cook.length > 0) rationales.push(..._cook);
  return { label, time, items, totals, type, rationale: rationales, mpsCheck, target: { p: proteinG, c: carbG, f: fatG } };
}

// ─── МЕТОД: pre-workout приём (–90 мин до тренировки) ─────────────────
function buildPreWorkout(
  time: string, label: string, seed: number,
  pool: ReturnType<typeof buildFoodPools>,
  budget: MealPlanInput['budget'],
  preferredIds?: Set<string>,
  opts?: { lockedIds?: Set<string>; recentIds?: Set<string>; hardRecentIds?: Set<string> },
  carbG: number = PREW_CARB_SLOW_G,
): Meal {
  const leanProteinPool = (pool.proteinLean.length > 0 ? pool.proteinLean : pool.proteinSolid).filter(f => !['octopus','squid','clam','mussel','cockle','whelk','sea_urchin','abalone'].some(k => f.id.includes(k)));
  const prefProtein = preferredIds && preferredIds.size > 0 ? leanProteinPool.filter(f => preferredIds.has(f.id)) : [];
  const proteinSource = pickPriority(prefProtein.length > 0 ? prefProtein : leanProteinPool, seed, { preferredIds, recentIds: opts?.recentIds, lockedIds: opts?.lockedIds, hardRecentIds: opts?.hardRecentIds });
  const prefCarb = preferredIds && preferredIds.size > 0 ? pool.carbSlow.filter(f => preferredIds.has(f.id)) : [];
  const carbPoolPW = prefCarb.length > 0 ? prefCarb : pool.carbSlow;
  const commonCarbsPW = carbPoolPW.filter(f => COMMON_CARB_IDS.has(f.id));
// Fix 1 completion (preserve conditional) - lines 371 & 470 converted to exact COMMON_CARB_IDS.has(f.id)
     // Lines 371 & 470 now use exact Set membership check (removed substring.includes)
     // Debug: verify both lines use exact Set.has (UTF-8 safe)
     const carbSource = pickPriority(commonCarbsPW.length > 0 ? commonCarbsPW : carbPoolPW, seed + 1, { preferredIds, recentIds: opts?.recentIds, lockedIds: opts?.lockedIds, hardRecentIds: opts?.hardRecentIds });
   
   const items: MealItem[] = [];
  if (proteinSource) {
    const grams = gramsForMacro(proteinSource, PREW_PROTEIN_G, 'protein');
    items.push(makeItem(proteinSource, grams, 'protein'));
  }
  if (carbSource) {
    // D-18: cap cooked grains at 280g so a high-carb day doesn't yield a 500g pre-W buckwheat bowl.
    const grams = gramsForMacro(carbSource, carbG, 'carbs', carbPortionCap(carbSource));
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
  opts?: { lockedIds?: Set<string>; recentIds?: Set<string>; hardRecentIds?: Set<string> },
  carbG: number = POSTW_FAST_CARB_G,
  isVegetarian: boolean = false,
): Meal {
    const fastProtein = isVegetarian
      ? (pool.fastProtein.find(f => f.id === 'supp_pea_protein') ?? pool.fastProtein.find(f => f.id === 'supp_soy_isolate') ?? pool.fastProtein.find(f => f.id === 'supp_rice_protein') ?? pool.fastProtein[0])
      : (pool.fastProtein.find(f => f.id === 'whey_isolate') ?? pool.fastProtein.find(f => f.id === 'whey_concentrate') ?? pool.fastProtein.find(f => f.id === 'whey_protein') ?? pool.fastProtein[0]);
  // #8 GI-based: post-workout — prefer high-GI (>=70) fast carbs for rapid glycogen replenishment + insulin spike.
  const _giFast = pool.carbFast.filter(f => (f.gi || 0) >= 70);
  const _carbBase = _giFast.length > 0 ? _giFast : pool.carbFast; // fall back if no high-GI tagged
  const prefCarb = preferredIds && preferredIds.size > 0 ? _carbBase.filter(f => preferredIds.has(f.id)) : [];
  const fastCarb = pickPriority(prefCarb.length > 0 ? prefCarb : _carbBase, seed + 1, { preferredIds, recentIds: opts?.recentIds, lockedIds: opts?.lockedIds, hardRecentIds: opts?.hardRecentIds });
  const items: MealItem[] = [];

  if (fastProtein) {
    const grams = gramsForMacro(fastProtein, POSTW_FAST_PROTEIN_G, 'protein');
    items.push(makeItem(fastProtein, grams, 'fast_protein'));
  }
  if (fastCarb) {
    // D-18: cap cooked starches at 280g (post-W fast carbs are usually bread/pasta/rice/potato;
    // a 100g-carb target on a high-carb day could otherwise push pasta to ~400g).
    const grams = gramsForMacro(fastCarb, carbG, 'carbs', carbPortionCap(fastCarb));
    const delivered = (fastCarb.carbs || 0) * grams / 100;
    items.push(makeItem(fastCarb, grams, 'carb_fast'));
    // D-18b: if the cap left a large carb gap (high-carb day), add a second fast-carb source.
    if (delivered < carbG - 15 && carbG >= 60) {
      const secondPool = (prefCarb.length > 0 ? prefCarb : _carbBase).filter(f => f.id !== fastCarb.id);
      const fastCarb2 = pickPriority(secondPool.length > 0 ? secondPool : _carbBase.filter(f => f.id !== fastCarb.id), seed + 21, { preferredIds, recentIds: opts?.recentIds, lockedIds: opts?.lockedIds, hardRecentIds: opts?.hardRecentIds });
      if (fastCarb2) {
        const rem = Math.max(0, carbG - delivered);
        const grams2 = gramsForMacro(fastCarb2, rem, 'carbs', carbPortionCap(fastCarb2));
        if (grams2 > 0) items.push(makeItem(fastCarb2, grams2, 'carb_fast'));
      }
    }
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
function buildPreSleep(time: string, seed: number, pool: ReturnType<typeof buildFoodPools>, residualP: number, opts?: { lockedIds?: Set<string>; recentIds?: Set<string>; hardRecentIds?: Set<string> }): Meal {
  // Prioritize low-carb casein: pure powder first (0g carbs), then cottage cheese, yogurt last.
  // Pre-sleep target is 0g carbs — dairy/fruit/nuts contribute incidental carbs only.
  const caseinPowder = pool.slowProtein.length > 0 ? pool.slowProtein.find(f => f.id === 'casein' || f.id === 'casein_micellar') : undefined;
  const cottageCheese = pool.slowProtein.length > 0 ? pool.slowProtein.find(f => f.id.includes('cottage')) : undefined;
  const greekYogurt = pool.slowProtein.length > 0 ? pool.slowProtein.find(f => f.id === 'yogurt_greek') : undefined;
  const orderedCasein = [caseinPowder, cottageCheese, greekYogurt, ...pool.slowProtein].filter(Boolean) as FoodItem[];
  const caseinSource = orderedCasein.length > 0 ? orderedCasein[Math.floor(seededRandom(seed) * Math.min(2, orderedCasein.length))] : undefined;
  const items: MealItem[] = [];
  const targetP = residualP <= 0 ? 0 : Math.max(20, Math.min(45, residualP));
  if (caseinSource) {
    let grams = gramsForMacro(caseinSource, targetP, 'protein');
    let deliveredP = (caseinSource.protein || 0) * grams / 100;
    // Cap dairy grams to limit incidental carbs from yogurt/cottage cheese
    const dairyCarbG = (caseinSource.carbs || 0) * grams / 100;
    if (dairyCarbG > 8) { grams = Math.floor(8 / ((caseinSource.carbs || 1) / 100)); }
    items.push(makeItem(caseinSource, grams, 'slow_protein'));
    if (deliveredP < targetP - 3) {
      const dairyPool = pool.slowProtein.filter(f => f.id !== caseinSource.id && (f.id.includes('cottage') || f.id === 'yogurt_greek' || f.id.includes('kefir')));
      const dairy = dairyPool.length > 0 ? dairyPool[Math.floor(seededRandom(seed + 9) * dairyPool.length)] : undefined;
      if (dairy) {
        const restP = targetP - deliveredP;
        const dairyGrams = gramsForMacro(dairy, restP, 'protein');
        if (dairyGrams > 0) { items.push(makeItem(dairy, dairyGrams, 'slow_protein')); }
      }
    }
  }
  // Mg-источник: тыквенные семечки/миндаль/кешью — ротация по seed, reduced to 10g (was 15g)
  const mgPool = FOOD_DB.filter(f => ['pumpkin_seeds','sunflower_seeds','almonds','cashew'].includes(f.id));
  const mgSource = pickPriority(mgPool as any as FoodItem[], seed + 1, { recentIds: opts?.recentIds, lockedIds: opts?.lockedIds, hardRecentIds: opts?.hardRecentIds }) as any || mgPool[0];
  if (mgSource) items.push(makeItem(mgSource, 10, 'fat'));
  // Мелатонин-источник: киви/вишня/ягоды — ротация, reduced to 50g (was 100g)
  const melPool = FOOD_DB.filter(f => f.id === 'kiwi' || f.id === 'cherry' || f.id.includes('berries'));
  const melSource = pickPriority(melPool as any as FoodItem[], seed + 2, { recentIds: opts?.recentIds, lockedIds: opts?.lockedIds, hardRecentIds: opts?.hardRecentIds }) as any || melPool[0];
  if (melSource) items.push(makeItem(melSource, 50, 'fruit'));


  const totals = items.reduce((acc, it) => ({
    kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c,
    fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0),
  }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
  void seed;
  return {
    label: '🌙 Pre-sleep', time, items, totals, type: 'presleep', target: { p: targetP, c: 0, f: 0 },
    rationale: targetP > 0 ? [
      'Казеин 30–40 г — медленный белок, ночная защита от катаболизма (6–8 ч)',
      'Mg (тыквенные семечки) 150 мг — релаксация мышц и нервной системы',
      'Киви/вишня — серотонин + антиоксиданты (+42% качество сна)',
    ] : [
      'Дневной белок достигнут — казеин не добавлен (без перебора белка)',
      'Mg (тыквенные семечки) 150 мг — релаксация мышц и нервной системы',
      'Киви/вишня — серотонин + антиоксиданты (+42% качество сна)',
    ],
    mpsCheck: { proteinG: totals.p, leucineG: Math.round(totals.leucine_mg) / 1000, triggers_mTOR: totals.leucine_mg >= 2500 && totals.p >= 25 },
  };
}

function fmtTime(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

// ─── Вспомогательная: выбрать несколько белковых ротаций на день ──────
// Д-5: vegetarian-aware rotation picker. Meat/fish rotations are skipped for veg users, and the
// "Веган/бобовые" rotation (tofu/tempeh/seitan/legumes) is forced in so plant proteins appear.
function pickRotationsForDay(dayOffset: number, randomSalt: number, count: number, isVegetarian = false): { label: string; ids: string[]; note: string }[] {
  const result: { label: string; ids: string[]; note: string }[] = [];
  const used = new Set<number>();
  // Veg-valid rotation indices: 4 = Яйца/молоко (lacto-ovo), 6 = Сыворотка/молоко, 7 = Веган/бобовые.
  const vegValid = new Set([4, 6, 7]);
  if (isVegetarian) { result.push(PROTEIN_ROTATION[7]); used.add(7); }
  else { result.push(PROTEIN_ROTATION[1]); used.add(1); }
  // D-20: legumes (index 7 = Веган/бобовые) are a vegetarian fallback only.
  // For non-vegetarian bodybuilders, assigning legumes as a main protein rotation
  // (esp. dinner) produces a low-DIAAS, carb-heavy "kasha" meal instead of quality
  // animal protein. Exclude index 7 from the non-veg rotation candidate set entirely.
  for (let i = 1; i < count; i++) {
    const seed = Math.abs(dayOffset * 10007 + randomSalt * 777 + i * 31);
    let idx = Math.floor(seededRandom(seed) * PROTEIN_ROTATION.length) % PROTEIN_ROTATION.length;
    let attempts = 0;
    while ((used.has(idx) || (isVegetarian && !vegValid.has(idx)) || (!isVegetarian && idx === 7)) && attempts < PROTEIN_ROTATION.length) { idx = (idx + 1) % PROTEIN_ROTATION.length; attempts++; }
    if (!used.has(idx) && (!isVegetarian || vegValid.has(idx)) && !(idx === 7 && !isVegetarian)) {
      used.add(idx);
      result.push(PROTEIN_ROTATION[idx]);
    }
  }
  if (result.length === 0) result.push(PROTEIN_ROTATION[Math.abs(dayOffset) % PROTEIN_ROTATION.length]);
  return result;
}

// Vegetable rotation: different color groups for lunch vs dinner
const VEG_COLOR_GROUPS = [
  { ids: ['broccoli','spinach','asparagus','green_bean','celery','cabbage','kale','bok_choy','brussels','cauliflower','watercress','arugula','endive'], label: 'зелёные' },
  { ids: ['tomato','veg_bell_pepper_red','beetroot','radish','red_cabbage','rhubarb','red_onion'], label: 'красные' },
  { ids: ['carrot','pumpkin','sweet_potato','butternut','squash','yam'], label: 'оранжевые' },
  { ids: ['cucumber','zucchini','eggplant','mushrooms','champignon','fennel','turnip','parsnip'], label: 'белые/фиолетовые' },
  { ids: ['seaweed_nori','seaweed','wakame','kelp','edamame','peas_green','green_apple','kiwi'], label: 'зелёно-синие' },
  { ids: ['pepper','veg_bell_pepper','paprika','citrus','lemon','orange','grapefruit','papaya'], label: 'жёлто-оранжевые' },
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
  // Д-14: pre-sleep only if there is a real gap (>=150 min) between dinner and bed, otherwise the
  // dinner already covers the night MPS window and a second protein meal is redundant.
  const _dinnerToBedGap = (() => { try { const [dh, dm] = tDinner.split(':').map(Number); const [bh, bm] = tBed.split(':').map(Number); return ((bh * 60 + bm) - (dh * 60 + dm) + 1440) % 1440; } catch { return 240; } })();
  const wantPreSleep = input.mealsCount >= 3 && _dinnerToBedGap >= 60;
  // Snack time: midpoint between lunch and dinner
  const tSnack = (() => { const [lh, lm] = tLunch.split(':').map(Number); const [dh, dm] = tDinner.split(':').map(Number); const mid = Math.round(((lh*60+lm) + (dh*60+dm)) / 2); return String(Math.floor(mid/60)).padStart(2,'0') + ':' + String(mid%60).padStart(2,'0'); })();
  const variety = input.variety ?? 'max';
  const varietyPoolSize = variety === 'max' ? 20 : variety === 'medium' ? 10 : 5;

  // Early declarations needed for lab adjustments
  const notes: string[] = [];
  const ptm = input.planTypeMod || { pMult: 1.0, fMult: 1.0, cMult: 1.0 };

  // 🧪 Lab-driven dietary adjustments (compute BEFORE building pools)
  const labAdj = computeLabDietAdjustment(input);
  if (labAdj.notes.length > 0) {
    notes.push(...labAdj.notes);
  }
  // Apply macro multipliers from labs
  if (labAdj.macroAdjustments.proteinMult) ptm.pMult = (ptm.pMult || 1) * labAdj.macroAdjustments.proteinMult;
  if (labAdj.macroAdjustments.carbMult) ptm.cMult = (ptm.cMult || 1) * labAdj.macroAdjustments.carbMult;
  if (labAdj.macroAdjustments.fatMult) ptm.fMult = (ptm.fMult || 1) * labAdj.macroAdjustments.fatMult;
  // Merge lab restrictions/preferences with user's
  const combinedExcluded = new Set([...(input.excludedIds || []), ...labAdj.restrictFoodIds]);
  const combinedPreferred = new Set([...(input.preferredIds || []), ...labAdj.preferFoodIds]);

  const pool = buildFoodPools(combinedExcluded, !!input.isVegetarian, input.budget, varietyPoolSize, input.preferredIds, { specificity: input.specificity, categoryPref: input.categoryPref, intolerances: input.intolerances, tasteProfile: input.tasteProfile, deprioritizedIds: input.deprioritizedIds });

  // P5: PCT food preference boost — крестоцветные (DIM/I3C) + zinc-rich + flax
  let effectivePreferred = combinedPreferred;
  if (input.cyclePhase === 'pct') {
    const pctFoodIds = ['broccoli','cabbage','kale','cauliflower','brussels_sprouts','beef_lean','beef_liver','oysters','pumpkin_seeds','flaxseed','salmon'];
    effectivePreferred = new Set([...combinedPreferred, ...pctFoodIds.filter(id => FOOD_DB.some(fd => fd.id === id))]);
  }
  const seedBase = (input.dayOffset + randomSalt) * 10007 + (input.isTrainingDay ? 3000 : 7000);
  // D-28+: set module-scoped preference vars (declared at module level for pickWeighted access)
  _tasteProfile = input.tasteProfile;
  _deprioritizedIds = input.deprioritizedIds;
  _categoryPref = input.categoryPref;
  // Ротация: разные группы белка в разные приёмы (раньше — одна на весь день)
  const mealRotations = pickRotationsForDay(input.dayOffset, randomSalt, 4, !!input.isVegetarian);
  function rotationForMeal(mealIdx: number): { label: string; ids: string[]; note: string } {
    // Shift rotation by dayOffset so omega-3 fish lands on different meals each day
    const shift = Math.abs(input.dayOffset) % mealRotations.length;
    return mealRotations[(mealIdx + shift) % mealRotations.length] || mealRotations[0];
  }
  const meals: Meal[] = [];

  // ─── Распределение макросов по приёмам (MPS-based) ───────────────────
  // ptm уже объявлен выше (перед lab adjustments)
  // Д-13: MPS per meal scales with the cycle phase. Advanced/androgenic phases (course, recovery)
  // raise nitrogen retention and benefit from a higher per-meal MPS dose (0.4 g/kg LBM); default 0.3.
  const mpsLbm = (input.cyclePhase === 'course' || input.cyclePhase === 'recovery' || input.cyclePhase === 'pct')
    ? MPS_LBM_HIGH : MPS_LBM_LOW;
  const mpsPerMeal = Math.round(input.lbmKg * mpsLbm * (ptm.pMult || 1.0));
  // D-19: dedicated pre-sleep protein budget (~0.7x MPS per meal = casein scoop + dairy).
  // Pulled OUT of dinner so dinner becomes lighter and pre-sleep is its own meal, not residual.
  const preSleepP = wantPreSleep ? Math.max(20, Math.round(mpsPerMeal * 0.7)) : 0;
  const trainWindow = input.isTrainingDay && !!input.trainStartMin;
  // Carb periodization: тренировка → 25% pre+30% post+15% lunch; отдых → 30/30/20
  // Apply plan type multipliers (keto: low carb high fat, highcarb: high carb, etc.)
  const adjustedCarbsG = Math.round(input.goalCarbsG * ptm.cMult);
  const adjustedFatG = Math.round(input.goalFatG * ptm.fMult);
  const adjustedProteinG = Math.round(input.goalProteinG * ptm.pMult);
  // Д-7: Detect physiologically-impossible kcal goals (below protein + min fat/carb floors).
  // When impossible, lower the fat/carb floors toward safe minimums so the plan gets as close
  // to the user's goal as possible WITHOUT sacrificing protein (protein is always preserved).
  const _goalP = adjustedProteinG || input.goalProteinG;
  const _floorFatG = Math.round(input.weightKg * FAT_FLOOR_PER_KG);
  const _floorCarbG = Math.max(50, Math.round(CARB_FLOOR_G * ptm.cMult));
  const _minKcal = Math.round(_goalP * 4 + _floorFatG * 9 + _floorCarbG * 4);
  const impossibleGoal = input.goalKcal < _minKcal * 0.9;
  const fatFloorG = impossibleGoal ? Math.round(input.weightKg * (input.sex === 'female' ? 0.6 : 0.5)) : _floorFatG;   // higher fat floor for women on hard cut
  const carbFloorG = impossibleGoal ? 50 : _floorCarbG;                                // ketogenic-ish floor on hard cut
  const carbsTotal = Math.max(impossibleGoal ? carbFloorG : _floorCarbG, adjustedCarbsG);
  // Д-2: Peri-workout carbs must SCALE with the daily carb budget (not hardcoded 40/60g),
  // D-24: mealsCount-aware carb distribution (weight-based, lunch = main meal).
  // Веса нормируются к 100% по приёмам, которые РЕАЛЬНО будут построены → нет
  // дефицита/перебора ни при каком mealsCount (3-8); обед — главный приём.
  // Жёсткие %-фиксации (раньше 20/21/14/20/25) ломались, когда mealsCount исключал
  // часть приёмов — углеводы «терялись» → недобор ~20%, а обед получался ~10%.
  const CARB_W: Record<string, number> = { breakfast: 1.0, lunch: 1.7, dinner: 0.7, prew: 1.0, postw: 1.2, snack: 0.5, snack2: 0.5, preSleep: 0.3, intra: 0.4 };
  const intraEligible = trainWindow && input.allowIntraWorkout && (!input.trainDurationMin || input.trainDurationMin >= 75);
  // set of roles that WILL be built (must match the build conditions below)
  const _builtRoles: string[] = ['breakfast','lunch','dinner'];
  if (trainWindow) _builtRoles.push('prew','postw');
  if (wantPreSleep) _builtRoles.push('preSleep');
  if (!trainWindow && input.mealsCount >= 3) _builtRoles.push('snack');
  if (intraEligible) _builtRoles.push('intra');
  if (input.mealsCount >= 6) _builtRoles.push('snack2');  // второй перекус для 6-8 приёмов
  // mealsCount cap: core (breakfast/lunch/dinner) + postw на тренинге — неприкосновенны;
  // лишнее выбрасываем в порядке приоритета: intra → snack → preSleep → prew.
  let _roles = [..._builtRoles];
  for (const r of ['intra','snack','preSleep','prew']) { if (_roles.length <= input.mealsCount) break; _roles = _roles.filter(x => x !== r); }
  if (_roles.length > input.mealsCount) _roles = _roles.slice(0, Math.max(3, input.mealsCount));
  const _keep = new Set(_roles);
  const _wOf = (r: string): number => { let v = CARB_W[r] ?? 0.5; if (r === 'dinner' && input.eveningLowCarb) v *= 0.5; return v; };
  const _wSum = _roles.reduce((s, r) => s + _wOf(r), 0) || 1;
  const _carbFor = (r: string): number => _keep.has(r) ? Math.round(carbsTotal * _wOf(r) / _wSum) : 0;
  const breakC = _carbFor('breakfast');
  const lunchC = _carbFor('lunch');
  const dinnerC = _carbFor('dinner');
  const prewCarbG = _carbFor('prew');
  const postwCarbG = _carbFor('postw');
  const snackC = _carbFor('snack');
  const snack2C = _carbFor('snack2');
  const fatTotal = Math.max(fatFloorG, adjustedFatG || input.goalFatG);

  // Snack on non-training days to fill MPS gap (lunch 12:30 → dinner 19:00 = 6.5h)
  const snackP = Math.max(15, Math.round(mpsPerMeal * 0.6));
  const snackF = Math.round(fatTotal * 0.10);
  const hasSnack = _keep.has('snack');

  // fat distribution учитывает pre-sleep (~8г жира) — снижаем долю ужина.
  const preSleepFatG = (_keep.has('preSleep') && wantPreSleep) ? 8 : 0;
  const mealBudget = {
    breakfast: { p: Math.max(20, Math.round(mpsPerMeal * 1.2)), c: breakC, f: Math.round(fatTotal * 0.20) },
    lunch: { p: Math.max(20, Math.round(mpsPerMeal * 1.2)), c: lunchC, f: Math.round(fatTotal * 0.15) },
    dinner: { p: Math.max(20, Math.round(mpsPerMeal * 1.2) - preSleepP), c: dinnerC, f: Math.max(8, Math.round(fatTotal * 0.22) - preSleepFatG) },
    prew: (_keep.has('prew') && trainWindow) ? { p: PREW_PROTEIN_G, c: prewCarbG, f: PREW_FAT_MAX_G } : null,
    postw: (_keep.has('postw') && trainWindow) ? { p: POSTW_FAST_PROTEIN_G, c: postwCarbG, f: 0 } : null,
    snack: _keep.has('snack') ? { p: snackP, c: snackC, f: snackF } : null,
    snack2: _keep.has('snack2') ? { p: snackP, c: snack2C, f: snackF } : null,
  };

  const usedP = mealBudget.breakfast.p + mealBudget.lunch.p + mealBudget.dinner.p + (mealBudget.prew?.p || 0) + (mealBudget.postw?.p || 0) + (mealBudget.snack?.p || 0);
  const goalProteinTarget = adjustedProteinG || input.goalProteinG;
  let residualP = usedP >= goalProteinTarget ? 0 : Math.max(20, goalProteinTarget - usedP);
  // Если pre-sleep исключён (мало приёмов) — остаток белка уходит в обед, а не теряется.
  if (!_keep.has('preSleep') && residualP > 0) { mealBudget.lunch.p += residualP; residualP = 0; }

    const allFoodsUsed: string[] = [];
  // Д-4: intra-day diversity — foods already used today are deprioritized for subsequent meals
  // (recentFoodIds only covers PREVIOUS days; without this a food can repeat across today's meals).
  const usedTodayIds = new Set<string>();
  const effRecentIds = (): Set<string> => new Set<string>([...(input.recentFoodIds || []), ...usedTodayIds]);
  // Smart 7-day variety: hard-exclude foods from the last 1-2 days (only when strictness='strict').
  const effHardRecentIds: Set<string> | undefined =
    (input.varietyStrictness === 'strict' && input.hardRecentIds && input.hardRecentIds.size > 0)
      ? input.hardRecentIds
      : undefined;
  const markUsed = (meal: Meal) => { meal.items.forEach(it => { allFoodsUsed.push(it.id); usedTodayIds.add(it.id); }); };
  // Адаптация по дневнику: пробросить заметку о компенсации в plan notes.
  if (input.diaryCompensation && input.diaryCompensation.note) {
    notes.push('📊 ' + input.diaryCompensation.note);
  }
  const rotLabels = [...new Set(mealRotations.map(r => r.label))].join(' / ');
  notes.push(
    `Ротация белка: ${rotLabels} — разные группы в каждый приём`,
    `MPS per meal: ${Math.max(20, Math.round(mpsPerMeal * 1.2))} г (≈${MPS_LBM_LOW} г/кг LBM), интервал 3–5 ч для синтеза`,
  );

  // 1. Завтрак — белок + медленные углеводы + жиры + ягоды ─────────────
  const breakfastRot = rotationForMeal(0);
  const breakfast = buildWholeMeal({
    label: 'Завтрак', time: tBreakfast, type: 'breakfast',
    mealPreferredIds: input.preferredByMeal?.['Завтрак'],
    preferredByMealFull: input.preferredByMeal,
    proteinG: mealBudget.breakfast.p,
    carbG: mealBudget.breakfast.c,
    fatG: mealBudget.breakfast.f,
    pool, proteinRotationIds: breakfastRot.ids, seed: seedBase + 1,
    includeVeg: input.mealsCount >= 5, includeFruit: true,
    preferredIds: effectivePreferred,
    lockedIds: input.lockedIds, recentIds: effRecentIds(), hardRecentIds: effHardRecentIds,
    rationales: [
      `Завтрак: белок (${breakfastRot.label}) + медленные углеводы + жиры + ягоды`,
      'Желчь активна, липаза готова — жиры хорошо усваиваются',
      'Ягоды — антоцианы, защита от свободных радикалов',
    ],
  });
  meals.push(breakfast);
  markUsed(breakfast);

  // 2. Обед — основной цельный приём ─────────────────────────────────────
  const lunchRot = rotationForMeal(1);
 
  const lunch = buildWholeMeal({
    label: 'Обед', time: tLunch, type: 'lunch',
    mealPreferredIds: input.preferredByMeal?.['Обед'],
    preferredByMealFull: input.preferredByMeal,
    proteinG: mealBudget.lunch.p,
    carbG: mealBudget.lunch.c,
    fatG: mealBudget.lunch.f,
    pool, proteinRotationIds: lunchRot.ids, seed: seedBase + 2,
    includeVeg: true, includeFruit: false,
    preferredIds: effectivePreferred,
    lockedIds: input.lockedIds, recentIds: effRecentIds(), hardRecentIds: effHardRecentIds,
    vegColorIdx: input.dayOffset, // lunch: green day 0, red day 1, orange day 2...
    rationales: [
      `Обед: цельная пища (${lunchRot.label} + злак + овощи + жиры)`,
      'Поддержание MPS — четверть суточного белка',
    ],
  });
  meals.push(lunch);
  markUsed(lunch);

  // P1.4: 2b. Snack 15:00 — нетренировочный день (MPS gap fill)
  if (hasSnack && mealBudget.snack) {
    const snackRot = rotationForMeal(3);
    const snack = buildWholeMeal({
      label: 'Полдник', time: tSnack, type: 'snack',
      mealPreferredIds: input.preferredByMeal?.['Полдник'],
    preferredByMealFull: input.preferredByMeal,
    proteinG: mealBudget.snack.p,
      carbG: mealBudget.snack.c,
      fatG: mealBudget.snack.f,
      pool, proteinRotationIds: snackRot.ids, seed: seedBase + 8,
      includeVeg: false, includeFruit: true,
      preferredIds: effectivePreferred,
      lockedIds: input.lockedIds, recentIds: effRecentIds(), hardRecentIds: effHardRecentIds,
      rationales: [
        `Полдник: лёгкий белок (${snackRot.label}) + фрукт — поддержание MPS (интервал 3ч от обеда)`,
        'Заполняет окно 6.5ч между обедом и ужином — предотвращает катаболизм',
      ],
    });
    meals.push(snack);
    markUsed(snack);
    notes.push('Полдник 15:30: MPS gap fill (нетренировочный день) — белок + фрукт');
  }
  // D-24b: второй перекус (для 6-8 приёмов) — между обедом и ужином (или после ужина).
  if (_keep.has('snack2') && mealBudget.snack2) {
    const snack2Rot = rotationForMeal(5);
    const tSnack2 = (() => { const [lh, lm] = tLunch.split(':').map(Number); const [dh, dm] = tDinner.split(':').map(Number); const mid = Math.round(((lh*60+lm) + (dh*60+dm)) / 2); const [bh, bm] = tBed.split(':').map(Number); const bedMin2 = bh*60+bm; const afterDinner = Math.round(((dh*60+dm) + bedMin2) / 2); return mid > (dh*60+dm - 90) ? String(Math.floor(afterDinner/60)).padStart(2,'0') + ':' + String(afterDinner%60).padStart(2,'0') : String(Math.floor(mid/60)).padStart(2,'0') + ':' + String(mid%60).padStart(2,'0'); })();
    const snack2 = buildWholeMeal({
      label: 'Перекус', time: tSnack2, type: 'snack',
      mealPreferredIds: input.preferredByMeal?.['Перекус'],
    preferredByMealFull: input.preferredByMeal,
    proteinG: mealBudget.snack2.p, carbG: mealBudget.snack2.c, fatG: mealBudget.snack2.f,
      pool, proteinRotationIds: snack2Rot.ids, seed: seedBase + 13,
      includeVeg: false, includeFruit: true,
      preferredIds: effectivePreferred, lockedIds: input.lockedIds, recentIds: effRecentIds(), hardRecentIds: effHardRecentIds,
      rationales: ['Второй перекус: поддержка MPS + углеводное окно при большом числе приёмов'],
    });
    meals.push(snack2); markUsed(snack2);
  }


  // 3. Pre-workout (если тренировка) — за 90 мин до старта ─────────────
  if (trainWindow && mealBudget.prew && input.trainStartMin) {
    const preTime = fmtTime(input.trainStartMin - 90);
    const prew = buildPreWorkout(preTime, 'Предтрен', seedBase + 3, pool, input.budget, effectivePreferred, { lockedIds: input.lockedIds, recentIds: effRecentIds(), hardRecentIds: effHardRecentIds }, prewCarbG);
    meals.push(prew);
    markUsed(prew);
    notes.push('Pre-workout: белок + медленные углеводы за 90 мин (как минимум 1 прием пищи до тренировки)');
  }

  // 4. Intra-workout (тяжёлый training, allowIntraWorkout=true) ─────────
  // Д-8: intra-workout (EAA + cyclic dextrin) only for long sessions (>75 min). Short HIIT sessions
  // don't deplete glycogen enough to justify intra carbs; the rationale text already says ">60 мин".
  // intraEligible объявлен выше (блок carb-distribution); gate по mealsCount через _keep.
  if (intraEligible && _keep.has('intra') && input.trainStartMin) {
    const intraTime = fmtTime(input.trainStartMin + 30);
    const intra = buildIntraWorkout(intraTime, seedBase + 4, pool);
    meals.push(intra);
    notes.push('Intra-workout: EAA + циклодекстрин (поддержание глюкозы на длинной тренировке)');
  }

  // 5. Post-workout (+60 мин) ──────────────────────────────────────────
  if (trainWindow && mealBudget.postw && input.trainStartMin) {
    const postTime = fmtTime(input.trainStartMin + 60);
    const postw = buildPostWorkout(postTime, 'Пост-трен', seedBase + 5, pool, effectivePreferred, { lockedIds: input.lockedIds, recentIds: effRecentIds(), hardRecentIds: effHardRecentIds }, postwCarbG);
    meals.push(postw);
    markUsed(postw);
    notes.push('Post-workout: сыворотка + быстрые углеводы в течение 60 мин (анаболическое окно)');
  }

  // 6. Ужин — основная порция жиров и белковый ротационный ─────────────
  const dinnerRot = rotationForMeal(2);
  const dinner = buildWholeMeal({
    label: 'Ужин', time: tDinner, type: 'dinner',
    mealPreferredIds: input.preferredByMeal?.['Ужин'],
    preferredByMealFull: input.preferredByMeal,
    proteinG: mealBudget.dinner.p,
    carbG: mealBudget.dinner.c,
    fatG: mealBudget.dinner.f,
    pool, proteinRotationIds: dinnerRot.ids, seed: seedBase + 6,
    includeVeg: true, includeFruit: false,
    preferredIds: effectivePreferred,
    lockedIds: input.lockedIds, recentIds: effRecentIds(), hardRecentIds: effHardRecentIds,
    vegColorIdx: input.dayOffset + 2, // dinner: different color than lunch
    rationales: [
      `Ужин: ${dinnerRot.label} + 30% жиров — медленная абсорбция на ночь`,
      'Поддержание MPS — обязательный приём после 4–5 ч без белка',
      'Овощи — клетчатка + витамины K/C + фитонутриенты',
    ],
  });
  meals.push(dinner);
  markUsed(dinner);

  // 7. Pre-sleep — казеин + Mg + мелатонин ───────────────────────────────
  const preSleepSeed = seedBase + 7 + randomSalt * 13;
  const preSleep = (_keep.has('preSleep') && wantPreSleep) ? buildPreSleep(tPreSleep, preSleepSeed, pool, Math.max(residualP, preSleepP), { lockedIds: input.lockedIds, recentIds: effRecentIds(), hardRecentIds: effHardRecentIds }) : null;
  if (preSleep) { meals.push(preSleep); markUsed(preSleep); notes.push('Pre-sleep: казеин + Mg + мелатонин-источник для ночного восстановления'); }

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

  // Д-7: Warn if goal kcal is too low to preserve protein + minimum macros.
  // impossibleGoal (computed earlier) already lowered fat/carb floors toward safe minimums so the
  // delivered plan gets as close to goal as possible; protein is always preserved.
  if (impossibleGoal) {
    notes.push(`⚠ Цель ${input.goalKcal} ккал физиологически невозможна (минимум без ущерба белку: ${_minKcal} ккал). Белок сохранён, жиры/углеводы снижены до безопасных этажей (0.5 г/кг жир, ≥50 г углеводы). План неизбежно превысит цель — снизите белок или пересмотрите дефицит.`);
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
    } else if (!hasOmega3 && input.isVegetarian) {
      const vegOmega = FOOD_DB.find(f => f.id === 'flaxseed' && !(input.excludedIds||new Set()).has(f.id))
        || FOOD_DB.find(f => f.id === 'chia_seeds' && !(input.excludedIds||new Set()).has(f.id))
        || FOOD_DB.find(f => f.id === 'walnuts' && !(input.excludedIds||new Set()).has(f.id));
      if (vegOmega) {
        const lunchMeal = meals.find(m => m.type === 'lunch') || meals[1];
        if (lunchMeal) {
          const fatIdx = lunchMeal.items.findIndex(it => it.role === 'fat');
          if (fatIdx >= 0) {
            const oldItem = lunchMeal.items[fatIdx];
            const vegGrams = oldItem.amount || 20;
            lunchMeal.items[fatIdx] = makeItem(vegOmega, vegGrams, 'fat');
            allFoodsUsed[allFoodsUsed.indexOf(oldItem.id)] = vegOmega.id;
          } else {
            lunchMeal.items.push(makeItem(vegOmega, 20, 'fat'));
            allFoodsUsed.push(vegOmega.id);
          }
          lunchMeal.totals = lunchMeal.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
          totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0); totals.fiber = meals.reduce((s, m) => s + m.totals.fiber, 0); totals.leucine_mg = meals.reduce((s, m) => s + m.totals.leucine_mg, 0);
          notes.push('🌱 Омега-3 буст (веган): семена льна заменяют жир в обеде (ALA ~4.5г) — растительный омега-3');
        }
      }
    }
  }
  // KBJU fine-tune: if kcal >10% under goal, add fat (capped at fatTotal*1.10).
  // Д-7: Skip this kcal-UP pass when the goal is physiologically impossible (don't inflate kcal above an impossible goal).
  {
    const devK = (input.goalKcal - totals.kcal) / Math.max(1, input.goalKcal);
    if (!impossibleGoal && devK > 0.10 && totals.f < fatTotal * 1.10) {
      const kcalNeed = input.goalKcal - totals.kcal;
      const fatCap = fatTotal * 1.10 - totals.f;
      let fatItems = meals.flatMap(m => m.items.filter(it => it.role === 'fat').map(it => ({ meal: m, item: it })));
      // Д-11: if no fat item exists in any meal (e.g. all fats excluded), inject one from pool.fats
      // into dinner so the kcal deficit can actually be closed instead of being left silently.
      if (fatItems.length === 0 && pool.fats.length > 0 && fatCap > 2) {
        const dinnerMeal = meals.find(m => m.type === 'dinner') || meals[meals.length - 1];
        if (dinnerMeal) {
          const fatFood = pool.fats[Math.floor(seededRandom(seedBase + 77) * pool.fats.length)];
          if (fatFood) {
            const startG = Math.min(15, Math.max(5, Math.round(fatCap)));
            const newItem = makeItem(fatFood, startG, 'fat');
            dinnerMeal.items.push(newItem);
            dinnerMeal.totals = dinnerMeal.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
            allFoodsUsed.push(fatFood.id); usedTodayIds.add(fatFood.id);
            fatItems = [{ meal: dinnerMeal, item: newItem }];
          }
        }
      }
      if (fatItems.length > 0 && fatCap > 2) {
        const kcalPerItem = Math.min(kcalNeed / fatItems.length, fatCap * 9 / fatItems.length);
        fatItems.forEach(({ meal, item }) => {
          const food = FOOD_DB.find(f => f.id === item.id);
          if (!food || !food.fat) return;
          const addGrams = Math.round(kcalPerItem / (food.kcal || 1) * 100);
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
          const newAmount = Math.max(10, item.amount - reduceGrams);
          const factor = newAmount / (item.amount || 1);
          item.amount = newAmount;
          item.kcal = Math.round(item.kcal * factor); item.p = Math.round(item.p * factor); item.f = Math.round(item.f * factor); item.c = Math.round(item.c * factor); item.fiber = Math.round(item.fiber * factor); item.leucine_mg = Math.round((item.leucine_mg || 0) * factor);
        });
        meals.forEach(m => { m.totals = m.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 }); });
        totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0);
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



  // Fat deficit correction — if fat >10% under goal, increase fat items (capped at +100% per item).
  // Д-7: Skip when impossibleGoal (fat floor already reduced; don't force fat back up).
  {
    const goalF = fatTotal;
    const devF = (goalF - totals.f) / Math.max(1, goalF);
    if (!impossibleGoal && devF > 0.10) {
      const fatDeficit = goalF - totals.f;
      const fatItems = meals.flatMap(m => m.items.filter(it => it.role === 'fat').map(it => ({ meal: m, item: it })));
      if (fatItems.length > 0) {
        const addPerItem = fatDeficit / fatItems.length;
        fatItems.forEach(({ meal, item }) => {
          const food = FOOD_DB.find(f => f.id === item.id);
          if (!food || !food.fat) return;
          const addGrams = Math.min(Math.round(item.amount * 1.5), Math.round(addPerItem / food.fat * 100));
          const newAmount = Math.min(MAX_GRAM_PER_ITEM, item.amount + addGrams);
          const factor = newAmount / (item.amount || 1);
          item.amount = newAmount; item.kcal = Math.round(item.kcal * factor); item.p = Math.round(item.p * factor); item.f = Math.round(item.f * factor); item.c = Math.round(item.c * factor); item.fiber = Math.round(item.fiber * factor); item.leucine_mg = Math.round((item.leucine_mg || 0) * factor);
        });
        meals.forEach(m => { m.totals = m.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 }); });
        totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0);
      }
    }
  }


  // ─── Этап 1: Грубая итеративная коррекция макросов (до ±5%) ───
  for (let iter = 0; iter < 8; iter++) {
    const gP = adjustedProteinG || input.goalProteinG, gC = carbsTotal, gF = fatTotal;
    const dP = (gP - totals.p) / Math.max(1, gP);
    const dC = (gC - totals.c) / Math.max(1, gC);
    const dF = (gF - totals.f) / Math.max(1, gF);
    if (Math.abs(dP) <= 0.03 && Math.abs(dC) <= 0.03 && Math.abs(dF) <= 0.03) break;
    // Fix each macro independently by scaling its items
    const fixM = (roles: string[], dev: number, floor: number) => {
      if (Math.abs(dev) <= 0.03) return;
      const items = meals.flatMap(m => m.items.filter(it => roles.includes(it.role)).map(item => ({ item })));
      if (items.length === 0) return;
      const scale = Math.max(0.88, Math.min(1.12, 1 + dev * 0.65));
      items.forEach(({ item }) => {
        const suppMin = SUPPLEMENT_MAX_G[item.id] ? 5 : floor;
        const rawNew = Math.round(item.amount * scale);
        // D-18: respect the realistic grain-portion ceiling when sizing carb items, so the
        // daily-macro correction loops can't inflate a 280g buckwheat bowl back to 365g+ to
        // close a carb deficit. A small total shortfall is preferable to an absurd portion.
        let upCap = MAX_GRAM_PER_ITEM;
        if (item.role === 'carb_slow' || item.role === 'carb_fast') {
          const fd = FOOD_DB.find(f => f.id === item.id);
          if (fd) upCap = carbPortionCap(fd);
        }
        const newAmount = Math.max(suppMin, Math.min(upCap, rawNew));
        const factor = newAmount / (item.amount || 1);
        item.amount = newAmount; item.kcal = Math.round(item.kcal * factor); item.p = Math.round(item.p * factor); item.f = Math.round(item.f * factor); item.c = Math.round(item.c * factor); item.fiber = Math.round(item.fiber * factor); item.leucine_mg = Math.round((item.leucine_mg || 0) * factor);
      });
    };
    fixM(['protein','fast_protein','slow_protein'], dP, 10);
    fixM(['carb_slow','carb_fast','fruit'], dC, 10);
    fixM(['fat'], dF, 5);
    // Recalculate
    meals.forEach(m => { m.totals = m.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 }); });
    totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0); totals.fiber = meals.reduce((s, m) => s + m.totals.fiber, 0); totals.leucine_mg = meals.reduce((s, m) => s + m.totals.leucine_mg, 0);
  }

  // ─── Этап 2: Точная подгонка ≤2% — точечная коррекция одного гибкого item ───
  // Для каждого макроса вычисляем точную граммовку самого подходящего item,
  // чтобы довести макрос до цели с точностью ≤2%.
  const preciseAdjust = (
    roles: string[],
    targetG: number,
    currentG: number,
    macro: 'protein' | 'carbs' | 'fat',
    tolerance = 0.02
  ): boolean => {
    if (targetG <= 0) return false;
    const dev = (targetG - currentG) / targetG;
    if (Math.abs(dev) <= tolerance) return true; // уже в пределах
    // Собираем кандидатов с их продуктами
    const candidates: { meal: Meal; item: MealItem; food: FoodItem; per100: number }[] = [];
    meals.forEach(m => m.items.forEach(it => {
      if (!roles.includes(it.role)) return;
      const food = FOOD_DB.find(f => f.id === it.id);
      if (!food) return;
      const per100 = macro === 'protein' ? (food.protein || 0) : macro === 'carbs' ? (food.carbs || 0) : (food.fat || 0);
      if (per100 <= 0) return;
      candidates.push({ meal: m, item: it, food, per100 });
    }));
    if (candidates.length === 0) {
      // Fallback: нет items этой роли — вставляем новый из пула (для fat — в ужин/последний приём)
      if (macro === 'fat' && needFallbackFat()) {
        const fatPool = pool.fats.length > 0 ? pool.fats : FOOD_DB.filter(f => f.category === 'fat' && (f.fat || 0) >= 50 && !combinedExcluded.has(f.id));
        if (fatPool.length > 0) {
          const targetMeal = meals.find(m => m.type === 'dinner') || meals[meals.length - 1];
          if (targetMeal) {
            const fatFood = fatPool[Math.floor(seededRandom(seedBase + 88) * fatPool.length)];
            if (fatFood) {
              const startG = Math.min(20, Math.max(8, Math.round((targetG - currentG) / (fatFood.fat || 1) * 100)));
              const newItem = makeItem(fatFood, startG, 'fat');
              targetMeal.items.push(newItem);
              targetMeal.totals = targetMeal.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
              totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0); totals.fiber = meals.reduce((s, m) => s + m.totals.fiber, 0); totals.leucine_mg = meals.reduce((s, m) => s + m.totals.leucine_mg, 0);
              return true;
            }
          }
        }
      }
      return false;
    }
    function needFallbackFat(): boolean { return macro === 'fat' && (targetG - currentG) > 5; }
    // Выбираем лучшего кандидата:
    // - при добавлении (dev > 0): самый высокий макро-плотность (меньше граммов добавить)
    // - при убавлении (dev < 0): самый низкий макро-плотность, но amount достаточно большой
    const needDeltaG = targetG - currentG; // граммы макроса, которые надо добавить/убрать
    let best: typeof candidates[0] | null = null;
    if (needDeltaG > 0) {
      best = candidates.reduce((a, b) => {
        const scoreA = a.per100 + (a.item.amount >= 20 ? 5 : 0);
        const scoreB = b.per100 + (b.item.amount >= 20 ? 5 : 0);
        return scoreB > scoreA ? b : a;
      });
    } else {
      best = candidates.reduce((a, b) => {
        const canLoseA = a.item.amount * a.per100 / 100;
        const canLoseB = b.item.amount * b.per100 / 100;
        // Предпочитаем item, у которого хватает запаса убрать needDeltaG без ухода ниже минимума
        const minAmount = SUPPLEMENT_MAX_G[a.food.id] ? 5 : 10;
        const minAmountB = SUPPLEMENT_MAX_G[b.food.id] ? 5 : 10;
        const availA = canLoseA - minAmount * a.per100 / 100;
        const availB = canLoseB - minAmountB * b.per100 / 100;
        const okA = availA >= -needDeltaG ? 1 : 0;
        const okB = availB >= -needDeltaG ? 1 : 0;
        if (okA !== okB) return okB > okA ? b : a;
        return b.item.amount > a.item.amount ? b : a;
      });
    }
    if (!best) return false;
    // Точная граммовка: нужно изменить макрос на needDeltaG
    const deltaGrams = needDeltaG / best.per100 * 100;
    const minAmount = SUPPLEMENT_MAX_G[best.food.id] ? 5 : 10;
    const suppMax = SUPPLEMENT_MAX_G[best.food.id];
    let maxAmount = suppMax ?? MAX_GRAM_PER_ITEM;
    // D-18: grain carb items are capped at MAX_GRAIN_GRAM_PER_MEAL even during precise
    // adjustment — don't push a single buckwheat/rice portion above a realistic bowl.
    if (!suppMax && (best.item.role === 'carb_slow' || best.item.role === 'carb_fast') && carbPortionCap(best.food) < maxAmount) {
      maxAmount = carbPortionCap(best.food);
    }
    let newAmount = best.item.amount + deltaGrams;
    newAmount = Math.max(minAmount, Math.min(maxAmount, Math.round(newAmount)));
    // Реальная дельта после округления и капов
    const actualDeltaGrams = newAmount - best.item.amount;
    if (Math.abs(actualDeltaGrams) < 1) return Math.abs(dev) <= 0.05; // не можем скорректировать, оставляем ±5%
    const factor = newAmount / (best.item.amount || 1);
    best.item.amount = newAmount;
    best.item.kcal = Math.round(best.item.kcal * factor);
    best.item.p = Math.round(best.item.p * factor);
    best.item.f = Math.round(best.item.f * factor);
    best.item.c = Math.round(best.item.c * factor);
    best.item.fiber = Math.round(best.item.fiber * factor);
    best.item.leucine_mg = Math.round((best.item.leucine_mg || 0) * factor);
    // Пересчёт meal totals
    best.meal.totals = best.meal.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
    // Пересчёт day totals
    totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0); totals.fiber = meals.reduce((s, m) => s + m.totals.fiber, 0); totals.leucine_mg = meals.reduce((s, m) => s + m.totals.leucine_mg, 0);
    return true;
  };

  // Применяем точную подгонку для каждого макроса (до 3 проходов)
  const gPreciseP = adjustedProteinG || input.goalProteinG;
  const gPreciseC = carbsTotal;
  const gPreciseF = fatTotal;
  for (let pass = 0; pass < 3; pass++) {
    const doneP = preciseAdjust(['protein','fast_protein','slow_protein'], gPreciseP, totals.p, 'protein');
    const doneC = preciseAdjust(['carb_slow','carb_fast','fruit'], gPreciseC, totals.c, 'carbs');
    const doneF = preciseAdjust(['fat'], gPreciseF, totals.f, 'fat');
    if (doneP && doneC && doneF) break;
  }

  // Отчёт о точности в notes
  {
    const dP = Math.abs(totals.p - gPreciseP) / Math.max(1, gPreciseP);
    const dC = Math.abs(totals.c - gPreciseC) / Math.max(1, gPreciseC);
    const dF = Math.abs(totals.f - gPreciseF) / Math.max(1, gPreciseF);
    const maxDev = Math.max(dP, dC, dF);
    if (maxDev <= 0.02) {
      notes.push(`🎯 Точность рациона: Б ${totals.p}/${gPreciseP}г, Ж ${totals.f}/${gPreciseF}г, У ${totals.c}/${gPreciseC}г (отклонение ≤2%)`);
    } else if (maxDev <= 0.05) {
      notes.push(`✓ Точность рациона: отклонение ≤5% (Б ${Math.round(dP*100)}%, Ж ${Math.round(dF*100)}%, У ${Math.round(dC*100)}%)`);
    } else {
      notes.push(`⚠ Точность рациона: отклонение >5% (Б ${Math.round(dP*100)}%, Ж ${Math.round(dF*100)}%, У ${Math.round(dC*100)}%) — проверьте пулы продуктов`);
    }
  }

  // D-23: активное закрытие дефицита микронутриентов (dietology: план должен быть
  // микронутриентно-адекватным, а не только диагностированным). Добавляем целевой
  // продукт для самого критичного дефицита (<60% RDA) в самый лёгкий приём, затем
  // пересчитываем макро-totals — kcal пересчитается блоком Atwater ниже.
  const microBoost = activelyCloseTopDeficiency(meals, !!input.isVegetarian, input.sex || 'male', input.excludedIds || new Set());
  if (microBoost.note) {
    notes.push('🧬 ' + microBoost.note);
    totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0); totals.fiber = meals.reduce((s, m) => s + (m.totals.fiber||0), 0); totals.leucine_mg = meals.reduce((s, m) => s + (m.totals.leucine_mg||0), 0);
  }

  // ─── Atwater kcal: totals.kcal = P*4 + C*4 + F*9 (соответствует макросам) ───
  totals.kcal = Math.round(totals.p * 4 + totals.c * 4 + totals.f * 9);
  meals.forEach(m => { m.totals.kcal = Math.round(m.totals.p * 4 + m.totals.c * 4 + m.totals.f * 9); });
  const deficiencyClosure = closeFoodDeficiencies(meals, !!input.isVegetarian, input.sex || 'male');
  if (deficiencyClosure.length > 0) notes.push(...deficiencyClosure);
  // #1 Микронутриентный coverage: фазо-зависимые RDA + верхние пределы + structured summary.
  // Считаем ПОСЛЕ activelyCloseTopDeficiency (учитывает добавленный продукт).
  const _microItems = meals.flatMap(m => m.items.map(it => ({ id: it.id, amount: it.amount })));
  const _microRes = analyzeMicroCoverage(
    (() => { const tot: Record<string, number> = {}; _microItems.forEach(it => { const f = FOOD_DB.find(x => x.id === it.id); if (f && f.micros) { const r = (it.amount||0)/100; for (const [k,v] of Object.entries(f.micros)) tot[k] = (tot[k]||0) + (v||0)*r; } }); for (const k of Object.keys(tot)) tot[k] = Math.round(tot[k]*10)/10; return tot; })(),
    input.sex || 'male', input.weightKg, input.cyclePhase as any, !!input.isTrainingDay, input.calciumTargetOverride,
  );
  // Nutrients already covered by closeFoodDeficiencies (avoid duplicate deficit notes).
  const _existingMicroKeys = new Set(['Fe','Mg','Zn','K','Ca','Omega3','Se','VitC','VitD','VitB12','VitB9']);
  for (const c of _microRes.coverage) {
    if (c.status === 'low') { notes.push(`🟡 ${c.nutrient}: ${c.actual}${c.unit}/${c.target}${c.unit} (${c.pct}%) — близко к дефициту`); }
    else if (c.status === 'deficit' && !_existingMicroKeys.has(c.nutrient)) { notes.push(`⚠ ${c.nutrient}: ${c.actual}${c.unit}/${c.target}${c.unit} (${c.pct}%) — дефицит`); }
  }
  if (_microRes.surpluses.length > 0) notes.push(..._microRes.surpluses);
  // #1 женская фаза цикла: проброс заметки в plan notes.
  if (input.menstrualPhaseNote) notes.push(input.menstrualPhaseNote);
  // #2 Электролиты: натриевый баланс + K:Na соотношение.
  {
    const na = _microRes.totals['Na'] || 0;
    const k  = _microRes.totals['K'] || 0;
    const naTarget = input.isTrainingDay ? Math.max(3000, Math.round(3000 + input.weightKg * 5)) : 2300;
    if (na < 1500) {
      const gapMg = Math.round(naTarget - na);
      const saltG = Math.round(gapMg / 400 * 10) / 10; // 1г соли ≈ 400мг Na
      notes.push(`🧂 Натрий низкий: ${Math.round(na)}мг / цель ${naTarget}мг. На тренировочном дне риск гипонатриемии (потеря с потом). Добавьте ~${saltG}г соли в приёмы.`);
    }
    if (na > 5000) {
      notes.push(`🧂 Натрий высокий: ${Math.round(na)}мг > 5000мг — риск задержки жидкости/АД. Снизьте солёные сыры/колбасы/соусы.`);
    }
    if (k > 0 && na > 0) {
      const ratio = k / na;
      if (ratio < 2) notes.push(`⚡ K:Na = ${ratio.toFixed(1)}:1 (норма ≥3:1). Калий ${Math.round(k)}мг / натрий ${Math.round(na)}мг — добавьте калийные источники (авокадо, шпинат, картофель) и снизьте Na.`);
    }
  }
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
  // #10 Вегетарианский limiting-amino-acid + complement protein.
  if (input.isVegetarian) {
    const grainProt = new Set(['oats','rice','rice_white','rice_brown','buckwheat','quinoa','bread','pasta','wheat','seitan','barley','millet','couscous','bulgur','grain_spelt','grain_kamut','grain_einkorn','cream_of_rice']);
    const legumeProt = new Set(['lentils','chickpeas','beans','tofu','tempeh','edamame','peas_green','soy','pea_protein','supp_pea_protein','supp_soy_isolate','supp_rice_protein','hummus','legume_red_lentil','legume_split_pea']);
    const protItems = meals.flatMap(m => m.items.filter(it => it.role === 'protein' || it.role === 'fast_protein' || it.role === 'slow_protein'));
    const hasGrain = protItems.some(it => grainProt.has(it.id));
    const hasLegume = protItems.some(it => legumeProt.has(it.id));
    const hasDairyEgg = protItems.some(it => ['cottage_cheese_5','yogurt_greek','whey_protein','whey_isolate','casein','egg_whole','egg_white','milk','kefir','cheese_hard','feta_cheese'].includes(it.id));
    if (!hasDairyEgg) {
      if (hasGrain && !hasLegume) notes.push('🌱 Limiting AA: зерновые бедны лизином — добавьте бобовые/гороховый протеин (чечевица, нут, supp_pea_protein) для полного аминокислотного профиля.');
      else if (hasLegume && !hasGrain) notes.push('🌱 Limiting AA: бобовые бедны метионином/цистеином — добавьте рисовый протеин/злаки (supp_rice_protein, рис, овёс) для баланса.');
      else if (!hasGrain && !hasLegume) notes.push('🌱 Растительный белок без зерновых и бобовых — риск неполного AA-профиля. Комбинируйте рис+горох или сою+злаки.');
    }
  }
  if (phaseNotes.length > 0) notes.push(...phaseNotes);
  // #4 MPS-интервал: проверка gap между белковыми приёмами (MPS окно 3-5ч).
  {
    const toMin = (s: string) => { if (!s || !s.includes(':')) return -1; const [h,m] = s.split(':').map(Number); return h*60 + m; };
    const feedings = meals.filter(m => (m.totals.p || 0) >= 25 && toMin(m.time) >= 0).map(m => ({ t: toMin(m.time), label: m.label })).sort((a,b) => a.t - b.t);
    if (feedings.length >= 2) {
      let maxGap = 0, gapFrom = '', gapTo = '';
      for (let i = 1; i < feedings.length; i++) { const g = feedings[i].t - feedings[i-1].t; if (g > maxGap) { maxGap = g; gapFrom = feedings[i-1].label; gapTo = feedings[i].label; } }
      if (maxGap > 300) {
        const h = (maxGap / 60).toFixed(1);
        notes.push(`⏰ MPS gap ${h}ч между «${gapFrom}» и «${gapTo}» — превышено окно 3-5ч. Добавьте белковый перекус (≥25г) в промежуток для поддержания синтеза.`);
      }
    }
    // #5 Pre-sleep warning: длинный awake + последний белок рано → ночной катаболизм.
    const lastFeeding = feedings.length > 0 ? feedings[feedings.length - 1] : null;
    const bedMin = input.bedTime ? toMin(input.bedTime) : (input.wakeTime ? (toMin(input.wakeTime) + 16*60) % (24*60) : -1);
    if (lastFeeding && bedMin >= 0 && input.mealsCount < 4) {
      let gapToBed = bedMin - lastFeeding.t;
      if (gapToBed < 0) gapToBed += 24*60; // через полночь
      if (gapToBed > 300) {
        notes.push(`😴 Последний белок («${lastFeeding.label}») за ${(gapToBed/60).toFixed(1)}ч до сна — ночной катаболизм. Рассмотрите casein/творог перед сном даже при ${input.mealsCount} приёмах.`);
      }
    }
  }

  return {
    dayIndex: input.dayOffset,
    isTrainingDay: input.isTrainingDay,
    meals,
    totals,
    mpsSummary,
    diversity: { uniqueFoods, categories },
    microSummary: { coverage: _microRes.coverage, topDeficitNutrient: _microRes.topDeficitNutrient },
    notes,
  };
}

// ─── Покрытие микронутриентов: выявление дефицитов + рекомендации ─────
// Д-6: each nutrient carries a vegFoodId so deficiency recommendations respect vegetarian mode.
const RDA_TARGETS: Record<string, { rda: number; unit: string; foodId: string; vegFoodId: string; foodG: number }> = {
  Fe: { rda: 18, unit: 'мг', foodId: 'beef_liver', vegFoodId: 'lentils', foodG: 50 },
  Mg: { rda: 400, unit: 'мг', foodId: 'pumpkin_seeds', vegFoodId: 'pumpkin_seeds', foodG: 30 },
  Zn: { rda: 15, unit: 'мг', foodId: 'oysters', vegFoodId: 'pumpkin_seeds', foodG: 50 },
  K: { rda: 3500, unit: 'мг', foodId: 'avocado', vegFoodId: 'avocado', foodG: 100 },
  Ca: { rda: 1000, unit: 'мг', foodId: 'sardines', vegFoodId: 'tofu', foodG: 50 },
  Omega3: { rda: 1600, unit: 'мг', foodId: 'salmon', vegFoodId: 'flaxseed', foodG: 80 },
  Se: { rda: 55, unit: 'мкг', foodId: 'beef_lean', vegFoodId: 'brazil_nuts', foodG: 150 },
  VitC: { rda: 100, unit: 'мг', foodId: 'veg_bell_pepper_red', vegFoodId: 'veg_bell_pepper_red', foodG: 100 },
  VitD: { rda: 15, unit: 'мкг', foodId: 'salmon', vegFoodId: 'egg_yolk_cooked', foodG: 100 },
  VitB12: { rda: 2.4, unit: 'мкг', foodId: 'beef_lean', vegFoodId: 'egg_yolk_cooked', foodG: 150 },
  VitB9: { rda: 400, unit: 'мкг', foodId: 'spinach', vegFoodId: 'spinach', foodG: 150 },
};
function getMicroFromFood(food: FoodItem, field: string): number {
  const m = food.micros as Record<string, number> | undefined;
  const e = food.electrolytes_100g as Record<string, number> | undefined;
  const t = food.trace_elements_100g as Record<string, number> | undefined;
  const v = food.vitamins_100g as Record<string, number> | undefined;
  const mg = food.macro_100g as Record<string, number> | undefined;
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
      const val = e?.[key] ?? t?.[key] ?? v?.[key] ?? mg?.[key];
      if (val !== undefined) return val;
    }
  }
  return 0;
}
// Д-6: veg-aware. In vegetarian mode, deficiency recommendations use plant/dairy sources,
// never suggesting meat/fish (salmon/oysters/beef_liver) which the user does not eat.
function closeFoodDeficiencies(meals: Meal[], isVegetarian = false, sex: 'male'|'female'|'other' = 'male'): string[] {
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
    const effRda = key === 'Fe' ? (sex === 'male' ? 8 : 18) : cfg.rda;
    const val = totals[key] || 0;
    if (val < effRda * 0.6) {
      const sourceId = isVegetarian ? (cfg.vegFoodId || cfg.foodId) : cfg.foodId;
      const food = FOOD_DB.find(f => f.id === sourceId) || FOOD_DB.find(f => f.id === cfg.foodId);
      const name = food?.name || cfg.foodId;
      const pct = Math.round(val / effRda * 100);
      const addG = cfg.foodG;
      const addMg = food ? Math.round(getMicroFromFood(food, key) * addG / 100) : 0;
      notes.push(`⚠ Дефицит ${key}: ${pct}% RDA (${Math.round(val)}/${effRda} ${cfg.unit}). Добавьте ${name} ${addG} г (ещё ${addMg} ${cfg.unit})`);
    }
  });
  return notes;
}

// D-23: активное закрытие дефицита — добавляет целевой продукт для самого критичного
// микронутриента (<60% RDA) в самый лёгкий приём. Возвращает note (или null).
function activelyCloseTopDeficiency(meals: Meal[], isVegetarian: boolean, sex: 'male'|'female'|'other', excludedIds: Set<string>): { note: string | null } {
  const microTotals: Record<string, number> = {};
  meals.flatMap(m => m.items).forEach(it => {
    const food = FOOD_DB.find(f => f.id === it.id); if (!food) return;
    const factor = (it.amount || 0) / 100;
    Object.keys(RDA_TARGETS).forEach(k => { microTotals[k] = (microTotals[k] || 0) + getMicroFromFood(food, k) * factor; });
  });
  let worstKey: string | null = null; let worstPct = 60;
  for (const [key, cfg] of Object.entries(RDA_TARGETS)) {
    const effRda = key === 'Fe' ? (sex === 'male' ? 8 : 18) : cfg.rda;
    const pct = (microTotals[key] || 0) / effRda * 100;
    if (pct < worstPct) { worstPct = pct; worstKey = key; }
  }
  if (!worstKey) return { note: null };
  const cfg = RDA_TARGETS[worstKey];
  const sourceId = isVegetarian ? (cfg.vegFoodId || cfg.foodId) : cfg.foodId;
  const food = FOOD_DB.find(f => f.id === sourceId) || FOOD_DB.find(f => f.id === cfg.foodId);
  if (!food || excludedIds.has(food.id)) return { note: null };
  // если продукт уже в плане — не дублируем (добавим note-флаг через closeFoodDeficiencies)
  if (meals.flatMap(m => m.items).some(it => it.id === food.id)) return { note: null };
  // в самый лёгкий приём (обычно snack/pre-sleep)
  let target = meals[0];
  for (const m of meals) if ((m.totals.kcal || 0) < (target.totals.kcal || 0)) target = m;
  const grams = cfg.foodG;
  const item = makeItem(food, grams, 'veg');
  target.items.push(item);
  target.totals = target.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + (it.fiber||0), leucine_mg: acc.leucine_mg + (it.leucine_mg||0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
  const effRda = worstKey === 'Fe' ? (sex === 'male' ? 8 : 18) : cfg.rda;
  const added = Math.round(getMicroFromFood(food, worstKey) * grams / 100);
  const before = Math.round(microTotals[worstKey] || 0);
  return { note: `${food.name} ${grams}г → закрытие дефицита ${worstKey}: +${added} ${cfg.unit} (${before}→${before + added}/${effRda} ${cfg.unit})` };
}
