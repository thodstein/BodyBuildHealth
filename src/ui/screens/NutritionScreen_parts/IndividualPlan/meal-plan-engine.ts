// @ts-nocheck
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
import { analyzeMicroCoverage, sumMicros, type MicroCoverageEntry } from "./planner-micro-coverage";
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
  type: 'breakfast' | 'lunch' | 'snack' | 'snack2' | 'snack3' | 'snack4' | 'preworkout' | 'intra' | 'postworkout' | 'dinner' | 'presleep';
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
  // FIX allergens-restrictions: теги аллергенов (dairy/gluten/eggs/...). Defense-in-depth:
  // контекст резолвит аллергены в excludedIds, этот фильтр защищает прочих вызывающих
  // (тесты, прямые вызовы buildDayPlan без резолвера).
  allergenTags?: Set<string>;
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
  // #4 Peak-week sodium manipulation.
  sodiumTargetOverride?: number;
  // #1 Female menstrual phase note (surfaced in plan notes).
  menstrualPhaseNote?: string;
  // #5 Menstrual carb GI preference ('low' = strict low-GI in luteal/menstrual).
  carbGiPref?: 'low' | 'normal' | 'high';
  quality?: 'full' | 'basic';
  // Этап 4: инъекции (инсулин/ГР/ИГФ) — привязка приёмов к времени укола/тренировке.
  // Дублирует данные Context.injections, чтобы V2-движок мог размещать приёмы вокруг уколов
  // (раньше это было только в классическом fallback-пути — БАГ-15/16).
  injections?: { type: string; name?: string; time?: string; dose?: number; esterType?: string; trainLinked?: boolean; trainTiming?: 'before' | 'after' | 'both' | 'none' }[];
  // Этап 5 (Пробел-2): настоящий рефид-день — высокоуглеводный, предпочтение быстрых/низкоклетчаточных
  // углеводов, лёгкие овощи (иначе рефид = просто ×2.5 углеводов в обычной структуре).
  refeedDay?: boolean;
  // Этап 7: верхний предел клетчатки (из prep/пик-недели ББ — fiberMaxG). На пик-дне снижает
  // объём овощей, чтобы высокоуглеводная загрузка не «упиралась» в порции.
  fiberCapG?: number;
  // E8: осознанный выбор пользователя — молоко к завтраку (учитывает no_dairy/аллергены)
  // и кокосовое масло/жиры в рацион. Пусто/не установлено = не добавлять.
  addMilkToBreakfast?: boolean;
  coconutOilBoost?: boolean;
  // N1: профиль вкуса завтрака — основа (каша/хлопья/яйца/творог).
  breakfastStyle?: BreakfastStyle;
  // N7: завтрак-шаблон — готовый «классический завтрак бодибилдера» (детерминированный состав).
  breakfastTemplate?: BreakfastTemplateId;
  // D-28: «загрузка под утреннюю тренировку» — вечером много углеводов, минимум жиров,
  // умеренный белок (гликоген к утренней сессии). Работает только при утренней тренировке.
  morningTrainLoad?: boolean;
  // D-28 (жалоба «кнопка еда на работе не работает»): в pro-движок фильтр «только портативная
  // еда» не передавался (работал только в классическом пути). portableMode ограничивает пулы
  // продуктов теми, что можно взять на работу без разогрева (порошок/хлопья/хлеб/фрукты/орехи).
  portableMode?: boolean;
  // Работа: окно смены для сдвига обеда/ужина в pro-движке (раньше только классика)
  workStartMin?: number;
  workEndMin?: number;
  isWorkDay?: boolean;
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
  amylopectin: 90, dextrose: 90, maltodextrin: 90, vitargo: 90, isoton: 90, isotonic: 90, drink_isotonic: 90, collagen_hydrolysate: 20,
};
// Глобальный лимит на одну порцию любого продукта (г)
// Этап 6: для уровня «Максимум»/enhanced лимиты выше, чтобы высококалорийные планы
// сходились к цели, а не упирались в порционные потолки (раньше 500/280/150).
// Aug 28 2026 (жалоба «110 кг атлет — не соответствует»): капы масштабируются от ЦЕЛИ
// приёма (scale = clamp(kcal приёма / 900, 1, 2)) — большой обед на массе больше не
// упирается в кап «нормального» приёма. Фрукт/овощ НЕ масштабируются (объёмные добавки).
function maxGramPerItem(budget?: string, scale = 1): number { return Math.round(((budget === 'max' || budget === 'enhanced') ? 600 : 500) * scale); }
function maxGrainPerMeal(budget?: string, scale = 1): number { return Math.round(((budget === 'max' || budget === 'enhanced') ? 350 : 280) * scale); }
function maxDryGrainPerMeal(budget?: string, scale = 1): number { return Math.round(((budget === 'max' || budget === 'enhanced') ? 200 : 150) * scale); }
// Масштаб порционных капов от макро-цели приёма (p/c/f в граммах).
function mealCapScale(pG: number, cG: number, fG: number): number {
  const kcal = (pG || 0) * 4 + (cG || 0) * 4 + (fG || 0) * 9;
  return Math.max(1, Math.min(2, kcal / 900));
}
function mealCapScaleOf(m: { target?: { p: number; c: number; f: number } }): number {
  return m && m.target ? mealCapScale(m.target.p, m.target.c, m.target.f) : 1;
}
// D-28+ fix (жалоба «500 г клюквы в обед»): реалистичная порция фрукта в приёме (г).
// Фрукт — микронутриентная «добавка», а не углеводный носитель; используется и в E5-добивке,
// и в коррекции макросов, чтобы фрукт не раздувался до 280-350 г.
const FRUIT_PORTION_CAP_G = 150;

// D-18: realistic per-portion ceiling for a carb source. Low-density cooked starches
// (grains ~12-28g/100g, potato ~17-21g, cooked pasta) need huge gram portions to hit a
// carb target — without a cap a 140g-carb lunch pushes buckwheat to ~700g. High-density
// carbs (bread ~50g/100g, dried fruit, honey) naturally portion small, so they keep the
// global maxGramPerItem ceiling (budget-aware). Threshold: <30g carbs/100g = "cooked starch" bowl.
function carbPortionCap(food: FoodItem, scale = 1): number {
  const carbPer100 = food.carbs || 0;
  // D-18 + D-21: grains/pasta are now tracked DRY (bodybuilding rule) — carb density
  // ~64-83g/100g. A realistic dry portion is ~150g (~400g cooked bowl), so cap dense
  // dry cereals at 150g. Low-density cooked starches that are still cooked-weight
  // (potato, corn on the cob ~17-21g/100g) keep the 280g cooked cap. Bread and other
  // ready-to-eat medium-density carbs keep the global 500g ceiling.
  const _budget = _currentBudget;
  if (carbPer100 >= 55) return maxDryGrainPerMeal(_budget, scale);   // dry grains/pasta
  if (carbPer100 > 0 && carbPer100 < 30) return maxGrainPerMeal(_budget, scale); // cooked starch (potato)
  // medium density 30-55 (oat bran, muesli, bread) — realistic bowl ~300g (max 350 for max budget)
  if (carbPer100 >= 30 && carbPer100 < 55) return Math.round((_budget === 'max' || _budget === 'enhanced' ? 350 : 300) * scale);
  return maxGramPerItem(_budget, scale);
}

const MEAT_KEYWORDS = ['beef','pork','chicken','turkey','lamb','veal','duck','salmon','tuna','shrimp','cod','mackerel','trout','sardine','crab','lobster','squid','octopus','venison','rabbit','goose','pate','sausage','bacon','ham','pepperoni','salami','bologna','hot_dog','meatball','cutlet','steak','pollock','tilapia','herring','anchovy','clam','mussel','oyster','scallops','catfish','flounder','sole','white_fish','whelk','cockles','seafood_','fish_','_fish','mintai','mahi','trumpeter','shellfish','cockle','abalone','conch','snail','escargot','sea_urchin','sea_cucumber','caviar','roe','liver','kidney','heart_tripe','tongue','brain','sweetbread','gizzard','bison','frog','elk','boar','quail','pheasant','goat','mutton','crayfish','krill','eel','sturgeon','halibut','perch','carp','pike','bream','bass','grouper','snapper','tongue','tripe','oxtail','trotters','wings','drumstick','thigh','breast_','_breast','mince','_minced'];
// P2-fix: isMeatId now checks FOOD_ALLERGEN_DIET first (canonical source), then
// falls back to the keyword heuristic for unlabeled foods. This reduces reliance
// on the 200+ hardcoded keywords and uses the structured diet-tag database.
const isMeatId = (id: string): boolean => {
  const diet = FOOD_ALLERGEN_DIET[id];
  if (diet) {
    // If the food is explicitly tagged as non-vegetarian, it's meat/fish.
    if (diet.isVegetarian === false) return true;
    // If explicitly tagged as vegetarian/vegan, it's not meat.
    if (diet.isVegetarian === true || diet.isVegan === true) return false;
  }
  // Fallback: keyword heuristic for unlabeled foods
  return MEAT_KEYWORDS.some(k => id.toLowerCase().includes(k));
};

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
  return PREMIUM_OR_EXOTIC.some(k => lid.includes(k)) || lid === 'lamb' || lid.startsWith('lamb_');
};

// D-28 (жалоба «еда на работе пулит всё подряд»): портативная еда — то, что можно взять
// на работу/в дорогу БЕЗ разогрева: порошки/хлопья/мюсли/хлеб/рисовые хлебцы, фрукты/ягоды,
// орехи/масла, молочка в упаковке (йогурт/творог/кефир), консервированная рыба, варёные яйца.
// Супы/горячие каши/жареное/фастфуд — НЕ портативны (их исключаем при portableMode).
const NON_PORTABLE_TOKENS = ['soup','porridge_','kfc','mcd','bk_','big_mac','royale','whopper','big_smoke','pizza','french_fries','fried','cheburek','pyanse','khachapuri','shaurma','ramen','gyros','falafel_pita','pancake','pelmeni','blini','pirozhok','borscht','hot_dog','hamburger','manti','samsa','kebab','shawarma','mayonnaise','ketchup','cream_sauce','bouillon_cube','ice_cream','marmalade','cookie','chocolate','coca_cola','soda','juice_apple','juice_orange'];
function isPortableFood(f: FoodItem): boolean {
  const lid = f.id.toLowerCase();
  const lname = (f.name || '').toLowerCase();
  if (NON_PORTABLE_TOKENS.some(t => lid.includes(t) || lname.includes(t))) return false;
  if (f.category === 'supplement') return true;        // порошки/батончики
  if (f.category === 'veg_fruit') return true;          // фрукты/ягоды/сырые овощи
  if (f.category === 'fat') {
    // Орехи/семечки — можно есть руками. Масла/пасты — нет (нужна ложка, пачкают).
    const lid = (f.id || '').toLowerCase();
    if (lid.includes('oil') || lid.includes('butter') || lid.includes('paste') || lid.includes('mayonnaise') || lid.includes('cream_sauce') || lid.includes('spread')) return false;
    return true;  // орехи/семечки/сухофрукты — едим руками
  }
  if (f.category === 'dairy') {
    // Только питьевые молочные (молоко/кефир в бутылке) — можно пить на работе.
    // Творог/йогурт/сыр — требуют ложки/контейнера, пахнут.
    const lid = (f.id || '').toLowerCase();
    if (lid.includes('milk') || lid.includes('kefir') || lid.includes('ayran')) return true;
    return false;
  }
  if (f.category === 'protein') {
    // «Хлопья на работе» = БЕЗ разогрева, БЕЗ запаха, БЕЗ контейнера.
    // Только протеиновый порошок (сыворотка/казеин/вега) — разводится водой в шейкере.
    // Никакого мяса, рыбы, яиц, творога — всё это требует контейнера, вилки, пахнет.
    const lid = (f.id || '').toLowerCase();
    if (lid.includes('whey') || lid.includes('casein') || lid.includes('isolate') || lid.includes('pea_protein') || lid.includes('soy_isolate') || lid.includes('rice_protein') || lid.includes('supp_eaa') || lid.includes('bcaa') || lid.includes('collagen')) return true;
    return false;
  }
  if (f.category === 'grain' || f.category === 'carb') {
    // готовые к употреблению злаки (хлопья/мюсли/хлеб/рисовый крем/хлебцы) — портативны
    // buckwheat/barley (гречка/ячка — горячие) — НЕ портативны, требуют варки
    // 'bar' убран — иначе barley ложно портативен (barley contains 'bar')
    return ['oats','cereal','muesli','rice_cream','bread','rice_cake','crispbread','flakes','cream_of_rice'].some(k => lid.includes(k) || lname.includes(k));
  }
  return false;
}

// ─── Per-meal portable helper (работа: только приёмы в окне смены — портативные) ──
function timeStrToMinutes(t: string): number | null {
  if (!t || typeof t !== 'string' || !t.includes(':')) return null;
  const [h, m] = t.split(':').map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}
function isTimeInWorkWindow(timeStr: string, ws: number, we: number): boolean {
  const tm = timeStrToMinutes(timeStr);
  if (tm === null || !Number.isFinite(ws) || !Number.isFinite(we)) return false;
  if (ws === we) return false;
  if (we > ws) return tm >= ws && tm <= we;
  // night shift wrap-around (e.g. 22:00-06:00)
  return tm >= ws || tm <= we;
}

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

  // 🔴 POTASSIUM HIGH (hyperkalemia risk) — restrict K-rich foods.
  // units-guard (Aug 22 2026): ключ POTASSIUM может нести ЛИБО сывороточный K (ммоль/л, ~3.5–6),
  // ЛИБО дневную пищевую цель в мг (напр. 4500 мг). Реагируем ТОЛЬКО на сывороточный диапазон,
  // иначе дневная цель 4500 мг давала ложную «гиперкалиемию» (резала авокадо/бананы/картофель).
  const _K = labs.POTASSIUM;
  if (_K !== undefined && _K >= 2.5 && _K <= 10 && _K > 5.0) {
    restrictByKeyword('avocado', 'potato', 'spinach', 'banana', 'tomato', 'salmon', 'mackerel', 'yogurt', 'coconut', 'dried', 'beet');
    notes.push('⚠️ Калий >5.0 ммоль/л: ограничены авокадо, картофель, шпинат, бананы, помидоры, лосось, сухофрукты');
  }

  // 🔴 SODIUM HIGH / HYPERTENSION — restrict Na-rich foods.
  // units-guard: реагируем только на сывороточный Na (ммоль/л, ~130–160), не на дневную цель в мг.
  const _Na = labs.SODIUM;
  if (_Na !== undefined && _Na >= 100 && _Na <= 200 && _Na > 145) {
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

  // 🟡 HEMATOCRIT/HEMOGLOBIN HIGH — blood viscosity management
  // P2-fix: HCT может прийти как 0.52 (доля) или 52 (%), приводим к %; HGB >170 г/л — тоже вязкость
  let _hct = labs.HEMATOCRIT; if (_hct !== undefined && _hct < 1) _hct *= 100;
  let _hgb = labs.HEMOGLOBIN;
  if ((_hct !== undefined && _hct > 52) || (_hgb !== undefined && _hgb > 170)) {
    preferByKeyword('serrapeptase', 'nattokinase', 'bromelain', 'garlic', 'onion', 'omega3', 'fish_oil', 'ginger', 'cayenne');
    restrictByKeyword('iron', 'red_meat', 'liver', 'spinach'); // avoid excess iron
    notes.push('⚠️ Гематокрит >52% / HGB >170 г/л: фибринолитики (серрапептаза, наттокиназа), омега-3, ограничен Fe/красное мясо');
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
  return PROTEIN_ROTATION[Math.abs(dayOffset ?? 0) % PROTEIN_ROTATION.length] || PROTEIN_ROTATION[0];
}

// ─── Preference: common bodybuilding carbs get selection bonus ───
const COMMON_CARB_IDS = new Set(['rice_white','rice_brown','buckwheat','potato_boiled','pasta_durum','quinoa','barley','cereal','millet','couscous','noodle','bulgur','chickpea','lentil','beans','corn','bread','oats','oats_dry']);

// ─── E1: Продуктовая типология приёмов ────────────────────────────────
// Завтрак ≠ ужин: подбор продуктов по типу приёма, а не из общего пула.
// Ключевые слова для «завтрашних» углеводов (каши/хлопья/манка/мюсли/рис/гречка).
const BREAKFAST_CARB_KEYWORDS = ['овсян','овсяные хлопья','хлопья','манк','рисов','рис ','мюсли','гречк','рисовый крем','геркул','сорг','пшённ','перловк'];
// «Завтрашние» фрукты/сухофрукты (ягоды, банан, изюм, курага, чернослив, финики).
const BREAKFAST_FRUIT_KEYWORDS = ['ягод','банан','черник','клубник','малин','смородин','изюм','кураг','черносл','финик','сухофрук','ежевик','голубик','киви','яблок'];
// D-28 fix (жалоба «в завтрак накидывается всё подряд — и хлопья, и макароны»):
// курируемый fallback «завтрашних» углеводов — если по ключевым словам ничего не нашлось,
// НЕ льём весь пул медленных углеводов (туда входят макароны/рис-гарниры/кус-кус).
// Используем только явно «завтрашние» id (каши/хлопья/мюсли/рисовый крем/тост).
const BREAKFAST_CARB_FALLBACK_IDS = ['oats','oats_dry','rice_cream','cereal','muesli','buckwheat','cereal_oat_bran','bread_white','bread_rye','bread_protein','rice_brown','millet','grain_spelt','grain_kamut','grain_einkorn','cream_of_rice','porridge_oat','porridge_buckwheat'];
// Курируемый fallback «завтрашних» фруктов (ягоды/банан/сухофрукты), а не весь плодовый пул.
const BREAKFAST_FRUIT_FALLBACK_IDS = ['banana','apple','berries','blueberries','strawberries','raspberries','blackberries','gooseberries','cranberries','kiwi','dried_apricots','dates','raisins','prunes','dried_berries','fruit_goji_berries'];
// D-28 fix (жалоба «логика завтрака не читается»): «завтрашний» белок —
// яйца/творог/греческий йогурт/сыворотка/тофу, а НЕ рыба/мясо (ротация обедов/ужинов).
const BREAKFAST_PROTEIN_IDS = ['egg_whole','egg_white','omelet','cottage_cheese_5','cottage_cheese_2','cottage_cheese_0','yogurt_greek','yogurt','milk','kefir','whey_protein','whey_isolate','tofu','supp_pea_protein','supp_soy_isolate','supp_rice_protein'];
// N1: профиль вкуса завтрака — сужает углеводную основу под выбор пользователя.
export type BreakfastStyle = 'auto' | 'porridge' | 'flakes' | 'eggs' | 'cottage';
const BREAKFAST_STYLE_CARBS: Record<Exclude<BreakfastStyle, 'auto'>, string[]> = {
  porridge: ['овсян','манк','гречк','геркул','пшённ','перловк'],
  flakes: ['хлопья','рисов','мюсли','рисовый крем','овсяные хлопья','кукурузные хлопья'],
  eggs: ['овсян','рис ','гречк','хлопья'],
  cottage: ['овсян','манк','хлопья','рис '],
};
// N1: белковая основа завтрака по стилю (яйца/творог).
const BREAKFAST_STYLE_PROTEIN: Record<Exclude<BreakfastStyle, 'auto'>, string[]> = {
  porridge: [],
  flakes: [],
  eggs: ['egg_whole', 'egg_white', 'omelet'],
  cottage: ['cottage_cheese', 'tvorog', 'йогурт греческ', 'yogurt_greek'],
};
// N7: завтрак-шаблоны — готовые «классический завтрак бодибилдера» с детерминированным составом.
export type BreakfastTemplateId = 'auto' | 'classic_oat' | 'protein_flakes' | 'eggs_toast' | 'cottage_berries';
export interface BreakfastTemplate {
  id: BreakfastTemplateId; label: string; foods: string[]; portions: Record<string, number>; milk?: boolean;
}
// П.3 (Aug 22 2026, диетология): завтрак-шаблоны переработаны в ПОЛНОЦЕННЫЕ «завтраки бодибилдера»
// с диетологически сбалансированным составом: медленные углеводы (низкий ГИ, долгая сытость) +
// полноценный белок (лейцин ≥2.5 г для запуска MPS) + полезные жиры (омега-3/мононенасыщенные) +
// фрукты/ягоды (микронутриенты, антиоксиданты) + молочная жидкость. Порции заданы явно (г).
export const BREAKFAST_TEMPLATES: BreakfastTemplate[] = [
  {
    id: 'classic_oat', label: '🥣 Овсянка + протеин + банан + семена чиа',
    foods: ['oats', 'whey_isolate', 'banana', 'berries', 'chia_seeds'], milk: true,
    portions: { oats: 80, whey_isolate: 30, banana: 100, berries: 100, chia_seeds: 10 },
  },
  {
    id: 'protein_flakes', label: '🌾 Хлопья + протеин + сухофрукты + миндаль',
    foods: ['corn_flakes', 'whey_isolate', 'dates', 'dried_apricots', 'almonds'], milk: true,
    portions: { corn_flakes: 50, whey_isolate: 30, dates: 30, dried_apricots: 20, almonds: 15 },
  },
  {
    id: 'eggs_toast', label: '🍳 Яйца + тост + авокадо + шпинат',
    foods: ['egg_whole', 'egg_white', 'bread_rye', 'avocado', 'spinach'], milk: false,
    portions: { egg_whole: 150, egg_white: 110, bread_rye: 70, avocado: 50, spinach: 60 },
  },
  {
    id: 'cottage_berries', label: '🥛 Творог + хлопья + черника + грецкие орехи',
    foods: ['cottage_cheese_5', 'oats', 'blueberries', 'walnuts'], milk: false,
    portions: { cottage_cheese_5: 200, oats: 50, blueberries: 80, walnuts: 15 },
  },
];

// П.3: роль продукта в завтраке по категории (для детерминированного шаблона).
function templateFoodRole(f: FoodItem): MealItem['role'] {
  if (f.category === 'supplement') return 'fast_protein';
  if (f.category === 'dairy') return 'slow_protein';
  if (f.category === 'grain' || f.category === 'carb') return 'carb_slow';
  if (f.category === 'fat') return 'fat';
  if (f.category === 'veg_fruit') {
    const lid = (f.id || '').toLowerCase();
    if (['spinach','broccoli','cabbage','kale','cucumber','tomato','pepper','carrot','onion','lettuce','arugula'].some(k => lid.includes(k))) return 'veg';
    return 'fruit';
  }
  return 'protein';
}

// П.3: сборка завтрака ИЗ шаблона (детерминированный состав, а не пуловый подбор).
// Уважает исключения/аллергены пользователя. ВАЖНО: шаблон ЗАМЕНЯЕТ пуловый завтрак,
// а не дополняет его (раньше докладывал овсянку+сыворотку поверх — «в завтрак всё подряд»).
function buildBreakfastFromTemplate(
  tmpl: BreakfastTemplate, time: string,
  excludedIds: Set<string>, allergenTags: Set<string> | undefined,
  targetKcal?: number,
): Meal {
  const items: MealItem[] = [];
  const used = new Set<string>();
  const _ok = (f: FoodItem): boolean => {
    if (excludedIds.has(f.id)) return false;
    if (allergenTags && allergenTags.size > 0) {
      const diet = FOOD_ALLERGEN_DIET[f.id];
      const tags = (diet && Array.isArray(diet.allergens)) ? diet.allergens : (f.allergens || []);
      if ([...allergenTags].some(t => tags.includes(t))) return false;
    }
    return true;
  };
  for (const fid of tmpl.foods) {
    const g = tmpl.portions[fid] || 80;
    const food = FOOD_DB.find(f => f.id === fid);
    if (!food || !_ok(food) || used.has(fid)) continue;
    items.push(makeItem(food, g, templateFoodRole(food)));
    used.add(fid);
  }
  if (tmpl.milk) {
    const milk = FOOD_DB.find(f => f.id === 'milk');
    if (milk && !excludedIds.has(milk.id) && _ok(milk)) items.push(makeItem(milk, 200, 'liquid'));
  }
  // Aug 28 (жалоба «завтрак не масштабируется под атлета»): шаблон тянет свои порции к
  // целевой ккал приёма (scale = clamp(target/base, 1, 1.8), округление до 5 г). Пропорции
  // авторские, без «раздувания» одного продукта — масштаб равномерный по всем позициям.
  if (targetKcal && targetKcal > 0 && items.length > 0) {
    const baseKcal = items.reduce((s, it) => s + it.kcal, 0);
    if (baseKcal > 0) {
      const k = Math.max(1, Math.min(1.8, targetKcal / baseKcal));
      if (k > 1.05) {
        for (const it of items) {
          const food = FOOD_DB.find(f => f.id === it.id);
          const ng = Math.max(5, Math.round((it.amount * k) / 5) * 5);
          const r = ng / (it.amount || 1);
          it.amount = ng; it.kcal = Math.round(it.kcal * r); it.p = Math.round(it.p * r); it.f = Math.round(it.f * r); it.c = Math.round(it.c * r); it.fiber = Math.round((it.fiber || 0) * r); it.leucine_mg = Math.round((it.leucine_mg || 0) * r);
        }
      }
    }
  }
  const totals = items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + (it.fiber || 0), leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
  const mpsCheck = { proteinG: totals.p, leucineG: Math.round(totals.leucine_mg / 10) / 100, triggers_mTOR: totals.leucine_mg >= LEU_THRESHOLD_MG && totals.p >= 25 };
  return {
    label: 'Завтрак', time, items, totals, type: 'breakfast' as const,
    rationale: [
      `Завтрак-шаблон «${tmpl.label}» — детерминированный состав (не случайный подбор)`,
      'Медленные углеводы (низкий ГИ) + полноценный белок (лейцин ≥2.5 г — запуск MPS после ночного голода)',
      'Полезные жиры (омега-3/мононенасыщенные) + фрукты/ягоды (антиоксиданты) + жидкость',
    ],
    mpsCheck, target: { p: totals.p, c: totals.c, f: totals.f },
  };
}

// Подбор завтрашнего пула углеводов (fallback → курируемый «завтрашний» набор, не весь пул).
function breakfastCarbPool(pool: ReturnType<typeof buildFoodPools>, style: BreakfastStyle = 'auto'): { carbs: FoodItem[]; fruits: FoodItem[] } {
  const source = pool.carbSlow.length > 0 ? pool.carbSlow : pool.carbFast;
  const match = (f: FoodItem, kws: string[]) => {
    const name = (f.name || '').toLowerCase(); const id = (f.id || '').toLowerCase();
    return kws.some(k => name.includes(k) || id.includes(k));
  };
  const styleKws = style !== 'auto' ? BREAKFAST_STYLE_CARBS[style] : null;
  let carbs = styleKws
    ? source.filter((f) => match(f, styleKws))
    : source.filter((f) => match(f, BREAKFAST_CARB_KEYWORDS));
  // D-28 fix: никогда не льём весь медленный пул (макароны/кус-кус/рис-гарниры в завтрак).
  // Fallback = только «завтрашние» id, отфильтрованные по наличию в пуле/FOOD_DB.
  if (carbs.length === 0) {
    carbs = source.filter(f => BREAKFAST_CARB_FALLBACK_IDS.includes(f.id));
    if (carbs.length === 0) {
      carbs = FOOD_DB.filter(f => BREAKFAST_CARB_FALLBACK_IDS.includes(f.id) && !(_currentExcludedIds && _currentExcludedIds.has(f.id)));
    }
  }
  let fruits = pool.carbFruit.filter((f) => match(f, BREAKFAST_FRUIT_KEYWORDS));
  if (fruits.length === 0) {
    fruits = pool.carbFruit.filter((f) => BREAKFAST_FRUIT_FALLBACK_IDS.includes(f.id));
    if (fruits.length === 0) {
      fruits = FOOD_DB.filter(f => BREAKFAST_FRUIT_FALLBACK_IDS.includes(f.id) && !(_currentExcludedIds && _currentExcludedIds.has(f.id)));
    }
  }
  // D-28 П10: овсяная основа — «завтрашние» злаки ранжируем: овсянка/хлопья/рисовый крем/мюсли
  // впереди гречки/пшена/перловки (по спортивной диетологии завтрак = овсяная каша, а не гречка,
  // которая каноничнее для обеда). Овсянка — низкий ГИ, бета-глюкан, долгая сытость.
  const oatScore = (f: FoodItem): number => {
    const id = (f.id || '').toLowerCase(); const n = (f.name || '').toLowerCase();
    if (/oats|овсян|геркул/.test(id + ' ' + n)) return 3;
    if (/хлопья|cereal|rice_cream|рисовый крем|muesli|мюсли/.test(id + ' ' + n)) return 2;
    if (/bread|хлеб/.test(id + ' ' + n)) return 1;
    return 0;
  };
  const oatFamily = carbs.filter((f) => oatScore(f) >= 2);
  if (oatFamily.length >= 2) carbs = oatFamily; // овсяное семейство приоритетно (≥2 вариантов)
  // D-28+1: если oatFamily <2 из-за variety-лимита, дополняем из FOOD_DB (иначе flakes/завтрак может дать лапшу)
  // Распространяем на любой завтрак (включая auto), иначе generic завтрак ловит rice_noodles
  if (carbs.length > 0 && oatFamily.length < 2) {
    const styleKwsForOat = style !== 'auto' ? BREAKFAST_STYLE_CARBS[style] : BREAKFAST_CARB_KEYWORDS;
    const matchOat = (f: FoodItem) => {
      const name = (f.name || '').toLowerCase(); const id = (f.id || '').toLowerCase();
      return styleKwsForOat.some(k => name.includes(k) || id.includes(k));
    };
    const extra = FOOD_DB.filter(f => (f.category === 'grain' || f.category === 'carb') && oatScore(f) >= 2 && matchOat(f) && !carbs.some(c => c.id === f.id) && (f.carbs || 0) >= 15 && (f.gi || 0) <= 55 && !(_currentExcludedIds && _currentExcludedIds.has(f.id))).slice(0, 2 - oatFamily.length);
    if (extra.length > 0) {
      carbs = [...oatFamily, ...extra];
      if (carbs.length < 2) {
        carbs = [...carbs, ...FOOD_DB.filter(f => BREAKFAST_CARB_FALLBACK_IDS.includes(f.id) && oatScore(f) >= 2 && !(_currentExcludedIds && _currentExcludedIds.has(f.id))).slice(0, 2 - carbs.length)];
      }
      if (carbs.length >= 2) {
        // oatFamily дополнен — теперь приоритетно, исключаем не-овсяные (лапшу)
        // carb уже = oatFamily+extra, без исходных не-овсяных
      }
    } else if (oatFamily.length > 0) {
      // есть хотя бы 1 овсяный, но не 2 — всё равно оставляем только овсяные, без лапши
      carbs = [...oatFamily];
    }
  }
  // D-28: для завтрака никогда не используем обеденные гарниры (макароны/лапша/кус-кус/киноа)
  // даже если они прошли фильтр по ключевым словам — тест «в завтрак не попадают макароны»
  const BREAKFAST_FORBIDDEN_RE = /pasta|noodle|macaroni|spaghetti|couscous/i;
  const _forbiddenIds = new Set(['rice_white', 'quinoa', 'rice_noodles', 'spaghetti', 'couscous']);
  carbs = carbs.filter(f => !BREAKFAST_FORBIDDEN_RE.test(f.id) && !_forbiddenIds.has(f.id));
  if (carbs.length === 0) {
    // fallback к овсяному семейству из FOOD_DB
    const fb = FOOD_DB.filter(f => BREAKFAST_CARB_FALLBACK_IDS.includes(f.id) && oatScore(f) >= 2 && !(_currentExcludedIds && _currentExcludedIds.has(f.id)));
    if (fb.length > 0) carbs = fb.slice(0, 2);
    else carbs = source.filter(f => !BREAKFAST_FORBIDDEN_RE.test(f.id) && !_forbiddenIds.has(f.id)).slice(0, 3);
  }
  return {
    carbs: carbs.length > 0 ? carbs : [...source.filter(f => !BREAKFAST_FORBIDDEN_RE.test(f.id) && !_forbiddenIds.has(f.id))],
    fruits: fruits.length > 0 ? fruits : [...pool.carbFruit],
  };
}
// N1: пул белковой основы завтрака по стилю (яйца/творог), fallback → «завтрашний» белок.
function breakfastProteinPref(pool: ReturnType<typeof buildFoodPools>, style: BreakfastStyle): FoodItem[] {
  const all = [...pool.proteinSolid, ...pool.proteinLean, ...(pool.vegProteinExtra || [])];
  const kws = style !== 'auto' ? BREAKFAST_STYLE_PROTEIN[style] : [];
  // D-28 fix: даже в режиме auto у завтрака НЕ берём рыбу/мясо из ротации — только «завтрашний» белок
  // (яйца/творог/йогурт/сыворотка/тофу). Стиль eggs/cottage сужает ещё сильнее.
  const poolIds = kws.length > 0 ? kws : BREAKFAST_PROTEIN_IDS;
  const matched = all.filter((f) => poolIds.some(k => f.id.includes(k) || (f.name || '').toLowerCase().includes(k)));
  return matched.length > 0 ? matched : [];
}
// D-28+ fix (жалоба «Завтрак: овсянка и говяжий фарш — где диетология?»):
// если по пулам не нашлось «завтрашнего» белка (яйца/творог/йогурт/сыворотка), НЕ отдаём завтрак
// дневной мясной ротации. Сначала подтягиваем быстрые/медленные «завтрашние» белки из хардкод-пулов
// (whey/egg_white + casein/cottage/yogurt — всегда уместны на завтрак), и только если и они пусты
// (исключены аллергенами) — возвращаем пусто, чтобы buildWholeMeal взял обычный белок.
function breakfastProteinFallback(pool: ReturnType<typeof buildFoodPools>): FoodItem[] {
  const bf = [...pool.fastProtein, ...pool.slowProtein];
  if (bf.length > 0) return bf;
  const any = [...pool.proteinSolid, ...pool.proteinLean];
  return any.filter(f => BREAKFAST_PROTEIN_IDS.some(k => f.id.includes(k) || (f.name || '').toLowerCase().includes(k)));
}
// П.1 (Aug 22 2026): является ли белок «завтрашним» (яйца/творог/йогурт/сыворотка/казеин/тофу).
// Используется для фильтрации ИЗБРАННЫХ белков на завтраке, чтобы любимый говяжий фарш/рыба
// не попадали в завтрак (только на обед/ужин).
function isBreakfastProtein(f: FoodItem): boolean {
  const id = (f.id || '').toLowerCase(); const name = (f.name || '').toLowerCase();
  return BREAKFAST_PROTEIN_IDS.some(k => id.includes(k) || name.includes(k));
}
// ─── E7: перекус-типология (протеин-порошок + хлопья + сухофрукты + орехи) ──
const SNACK_CARB_KEYWORDS = ['хлопья','овсян','рисов','манк','мюсли','гречк','сухар','рисовый крем','хлеб','рис '];
const SNACK_FRUIT_KEYWORDS = ['изюм','кураг','черносл','финик','сухофрук','ягод','банан','инжир','черника','малин'];
const SNACK_NUT_KEYWORDS = ['орех','миндаль','кешью','грецкий','арахис','фундук','пекан','кокос','тыквенные семечки','чиа','семечк'];
function snackCarbPool(pool: ReturnType<typeof buildFoodPools>): { carbs: FoodItem[]; fruits: FoodItem[] } {
  const source = pool.carbSlow.length > 0 ? pool.carbSlow : pool.carbFast;
  const match = (f: FoodItem, kws: string[]) => {
    const name = (f.name || '').toLowerCase(); const id = (f.id || '').toLowerCase();
    return kws.some(k => name.includes(k) || id.includes(k));
  };
  const carbs = source.filter((f) => match(f, SNACK_CARB_KEYWORDS));
  const fruits = pool.carbFruit.filter((f) => match(f, SNACK_FRUIT_KEYWORDS));
  return {
    carbs: carbs.length > 0 ? carbs : [...source],
    // No fallback to full carbFruit — prevents artichoke/potato as snack fruit (user report: "артишок + псиллиум" not nutritious)
    fruits: fruits,
  };
}
function snackNutPool(pool: ReturnType<typeof buildFoodPools>): FoodItem[] {
  const match = (f: FoodItem) => {
    const name = (f.name || '').toLowerCase(); const id = (f.id || '').toLowerCase();
    return SNACK_NUT_KEYWORDS.some(k => name.includes(k) || id.includes(k));
  };
  const nuts = pool.fats.filter(match);
  return nuts.length > 0 ? nuts : pool.fats;
}

// ─── N3/E2-фикс: распределение перекусов по САМЫМ БОЛЬШИМ разрывам ──
// Раньше snack и snack2 оба ложились в промежуток «обед→ужин», а утренний разрыв
// «завтрак→обед» оставался пустым (жалоба: «между завтраком и обедом 6 часов без еды»).
// Теперь каждый перекус встаёт в середину самого большого из оставшихся разрывов
// (largest-gap-first) — перекусы распределяются равномерно по дню.
function gapFillTimes(fixedMin: number[], count: number): number[] {
  const pts = [...fixedMin].filter(v => Number.isFinite(v)).sort((a, b) => a - b);
  const result: number[] = [];
  if (pts.length < 2) return result;
  for (let i = 0; i < count; i++) {
    let bestGap = -1, bestIdx = -1;
    for (let j = 1; j < pts.length; j++) {
      const g = pts[j] - pts[j - 1];
      if (g > bestGap) { bestGap = g; bestIdx = j; }
    }
    // Не заполняем разрыв меньше 2.5 ч — иначе приёмы слишком близко.
    if (bestGap < 150) break;
    const mid = Math.round((pts[bestIdx - 1] + pts[bestIdx]) / 2);
    result.push(mid);
    pts.push(mid);
    pts.sort((a, b) => a - b);
  }
  return result;
}
function fmtMin(min: number): string {
  return String(Math.floor(min / 60)).padStart(2, '0') + ':' + String(min % 60).padStart(2, '0');
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
// FIX week-perf: LRU-кэш пулов продуктов (сигнатура входов → пулы). Кап 12 записей.
const _poolCache = new Map<string, ReturnType<typeof buildFoodPools>>();
// D-28+ P0-4: module-scoped preference vars — установлены в начале buildDayPlan, ОБЯЗАТЕЛЬНО
// очищаются в finally(). buildDayPlan НЕ РЕЕНТЕРАБЕЛЕН (синхронный JS это гарантирует при отсутствии
// callback-yield точек); если внутри buildDayPlan появится await/Promise — refactor required.
const _pickCtx: { tasteProfile: any; deprioritizedIds: Set<string> | undefined; categoryPref: any; _locked: boolean } = {
  tasteProfile: undefined, deprioritizedIds: undefined, categoryPref: undefined, _locked: false,
};
// Совместимые алиасы (не удалять — избежать массы рефактора на pickWeighted внутри helpers).
let _tasteProfile: any = undefined;
let _deprioritizedIds: Set<string> | undefined = undefined;
let _categoryPref: any = undefined;
let _qualityMode: 'full' | 'basic' = 'full';
let _currentBudget: string = 'medium';
let _currentExcludedIds: Set<string> | undefined = undefined;

function pickWeighted(arr: FoodItem[], seed: number): FoodItem | undefined {
  if (arr.length === 0) return undefined;
  if (arr.length === 1) return arr[0];
  const weights = arr.map((f, i) => {
    const score = (f as any).bb_quality_score ?? 5;
    let w = _qualityMode === 'full' ? Math.max(0.5, Math.pow(score, 1.5)) : 1;
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
  // D-18: realistic per-item gram ceiling. Default to maxGramPerItem; caller may pass a
  // tighter cap (e.g. maxGrainPerMeal for cooked grains so a 140g-carb target doesn't
  // produce a 600g bowl of buckwheat).
  const ceiling = Math.min(maxGramPerItem(_currentBudget), capG ?? maxGramPerItem(_currentBudget));
  let base = Math.min(ceiling, Math.max(minG, Math.round(targetG / per100 * 100)));
  // Человеческие порции — snap к сетке (каша 50-100-125-150-200-250, жидкость 250-500, орехи/сухофрукты 25-50-75-100, протеин 30-60-90, мясо/рыба 100-150-200-250)
  // вне сетки — снапим к ближайшему целому шагу (5г для мяса/овощей, 25г для каши) чтобы граммовки были целые
  const snap = (v: number, brackets: number[]): number => {
    if (v <= 0) return v;
    if (v < brackets[0] || v > brackets[brackets.length - 1]) {
      const step = brackets[0] === 50 ? 25 : brackets[0] === 5 ? 5 : 10;
      const snapped = Math.round(v / step) * step;
      // для очень больших порций (>500г) не режем до 250 — оставляем округлённое
      if (v > brackets[brackets.length - 1] * 1.5) return Math.round(v / step) * step;
      return snapped;
    }
    let best = brackets[0]; let bestDiff = Math.abs(v - best);
    for (const b of brackets) { const d = Math.abs(v - b); if (d < bestDiff || (d === bestDiff && b > best)) { bestDiff = d; best = b; } }
    return best;
  };
  const id = (food.id || '').toLowerCase();
  const cat = food.category;
  const isAmylo = id.includes('amylopectin') || id.includes('amylop') || id.includes('dextrose') || id.includes('maltodextrin') || id.includes('vitargo') || id.includes('waxy');
  const isIsotonicPowder = id.includes('isotonic') || id.includes('isoton') || id.includes('isodrink') || id.includes('electrolyte') || (id.includes('drink') && cat === 'supplement');
  const isOil = id.includes('oil') || id.includes('масло') || (cat === 'fat' && (food.fat || 0) >= 90);
  const isAvocado = id.includes('avocado') || id.includes('авокадо');
  const isLiquid = !isAmylo && !isIsotonicPowder && (food.foodState === 'liquid' || id.includes('kefir') || id.includes('milk') || id.includes('yogurt') || id.includes('ayran') || id.includes('cream') || id.includes('water') || (cat === 'dairy' && (id.includes('milk') || id.includes('kefir') || id.includes('yogurt'))));
  const isNutDry = !isOil && !isAvocado && (cat === 'fat' || id.includes('nut') || id.includes('almond') || id.includes('cashew') || id.includes('walnut') || id.includes('hazel') || id.includes('pistach') || id.includes('peanut') || id.includes('dried') || id.includes('raisin') || id.includes('goji') || id.includes('chia') || id.includes('seed') || id.includes('apricot') || id.includes('prune') || id.includes('date'));
  const isPorridge = cat === 'grain' || cat === 'carb';
  const isProteinPowder = isAmylo || isIsotonicPowder || (cat === 'supplement' && (id.includes('whey') || id.includes('casein') || id.includes('isolate') || id.includes('protein') || id.includes('bcaa') || id.includes('eaa') || id.includes('creatine') || id.includes('collagen')));
  const isMeatFish = cat === 'protein';
  const isFruitVegFresh = cat === 'veg_fruit';
  const isDairy = cat === 'dairy';
  // Яйца целыми штуками: 1 яйцо ≈ 55 г съедобной части (55/110/165/220…)
  const isEggWhole = id === 'egg_whole' || id.startsWith('egg_whole');
  if (isEggWhole) { const eggs = Math.max(1, Math.round(base / 55)); base = eggs * 55; }
  else if (isPorridge) base = snap(base, [50, 100, 125, 150, 200, 250]);
  else if (isLiquid) base = snap(base, [100, 150, 200, 250, 300, 400, 500, 750, 1000]);
  else if (isOil) base = snap(base, [5, 10, 15, 30]);
  else if (isAvocado) base = snap(base, [50, 70, 100, 150]);
  else if (isNutDry) base = snap(base, [25, 50, 75, 100]);
  else if (isProteinPowder) base = snap(base, [30, 60, 90]);
  else if (isMeatFish) base = snap(base, [100, 150, 200, 250]);
  else if (isFruitVegFresh) base = snap(base, [100, 150, 200, 250]);
  else if (isDairy) base = snap(base, [100, 150, 200, 250]);
  else base = snap(base, [50, 100, 150, 200]);
  const supplementCap = SUPPLEMENT_MAX_G[food.id];
  return supplementCap ? Math.min(supplementCap, base) : base;
}

export function snapPortionG(food: FoodItem, grams: number): number {
  if (grams <= 0) return grams;
  const id = (food.id || '').toLowerCase();
  const cat = food.category;
  const isOil = id.includes('oil') || id.includes('масло') || (cat === 'fat' && (food.fat || 0) >= 90);
  const isAvocado = id.includes('avocado') || id.includes('авокадо');
  const isNutDry = !isOil && !isAvocado && (cat === 'fat' || id.includes('nut') || id.includes('almond') || id.includes('cashew') || id.includes('walnut') || id.includes('hazel') || id.includes('pistach') || id.includes('peanut') || id.includes('dried') || id.includes('raisin') || id.includes('goji') || id.includes('chia') || id.includes('seed') || id.includes('apricot') || id.includes('prune') || id.includes('date'));
  const isPorridge = cat === 'grain' || cat === 'carb';
  const isLiquid = food.foodState === 'liquid' || id.includes('kefir') || id.includes('milk') || id.includes('yogurt') || id.includes('ayran') || id.includes('cream') || id.includes('water') || (cat === 'dairy' && (id.includes('milk') || id.includes('kefir') || id.includes('yogurt')));
  const isProteinPowder = cat === 'supplement' && (id.includes('whey') || id.includes('casein') || id.includes('isolate') || id.includes('protein') || id.includes('bcaa') || id.includes('eaa') || id.includes('creatine') || id.includes('collagen') || id.includes('amylo') || id.includes('dextrose') || id.includes('maltodextrin'));
  const isMeatFish = cat === 'protein';
  const isFruitVeg = cat === 'veg_fruit';
  const isDairy = cat === 'dairy';
  let brackets: number[];
  const _isEggWholeSnap = id === 'egg_whole' || id.startsWith('egg_whole');
  if (_isEggWholeSnap) { const eggs = Math.max(1, Math.round(grams / 55)); return eggs * 55; }
  if (isPorridge) brackets = [50, 100, 125, 150, 200, 250];
  else if (isLiquid) brackets = [100, 150, 200, 250, 300, 400, 500, 750, 1000];
  else if (isOil) brackets = [5, 10, 15, 30];
  else if (isAvocado) brackets = [50, 70, 100, 150];
  else if (isNutDry) brackets = [25, 50, 75, 100];
  else if (isProteinPowder) brackets = [30, 60, 90];
  else if (isMeatFish) brackets = [100, 150, 200, 250];
  else if (isFruitVeg) brackets = [100, 150, 200, 250];
  else if (isDairy) brackets = [100, 150, 200, 250];
  else brackets = [50, 100, 150, 200];
  // Жидкости: маленькие объёмы (<100 мл — молоко в кофе/кашу) не раздуваем до первой ступени,
  // оставляем человеческое значение с шагом 10 мл.
  if (isLiquid && grams < brackets[0]) return Math.max(10, Math.round(grams / 10) * 10);
  if (grams < brackets[0]) return brackets[0];
  if (grams > brackets[brackets.length - 1]) {
    const step = brackets[0] === 50 ? 25 : brackets[0] === 5 ? 5 : brackets[0] === 25 ? 25 : brackets[0] === 30 ? 25 : 10;
    if (grams > brackets[brackets.length - 1] * 1.5) return Math.max(brackets[brackets.length - 1], Math.round(grams / step) * step);
    return Math.round(grams / step) * step;
  }
  let best = brackets[0]; let bestDiff = Math.abs(grams - best);
  for (const b of brackets) { const d = Math.abs(grams - b); if (d < bestDiff || (d === bestDiff && b > best)) { bestDiff = d; best = b; } }
  return best;
}

function makeItem(food: FoodItem, grams: number, role: MealItem['role']): MealItem {
  // FIX: snap к человеческой сетке (протеин 30/60/90, молоко 250/500, масло 5/10/15, каша 50/100/125/150/200/250)
  const cleanGrams = snapPortionG(food, grams);
  const r = cleanGrams / 100;
  const p = Math.round((food.protein || 0) * r);
  const f = Math.round((food.fat || 0) * r);
  const c = Math.round((food.carbs || 0) * r);
  // KBЖУ-консистентность ≤3%: kcal items ВСЕГДА из формулы 4Б+9Ж+4У (у ~56% FOOD_DB
  // табличный kcal дрейфует до десятков % — план наследовал этот разброс).
  const kcal = Math.round(4 * p + 9 * f + 4 * c);
  return {
    id: food.id, name: food.name, amount: cleanGrams, role,
    kcal,
    p,
    f,
    c,
    fiber: Math.round((food.fiber || 0) * r),
    leucine_mg: Math.round(getLeucine(food) * r),
  };
}

// ─── Пулы продуктов по ролям (с фильтром аллергенов и диеты) ───────────
function buildFoodPools(excludedIds: Set<string>, isVeg: boolean, budget: MealPlanInput['budget'], varietyPoolSize?: number, preferredIds?: Set<string>, opts?: { specificity?: Specificity; categoryPref?: CategoryPref; intolerances?: Intolerances; tasteProfile?: TasteProfile; deprioritizedIds?: Set<string>; allergenTags?: Set<string>; portableMode?: boolean }) {
  const isMealFood = (f: FoodItem) =>
    f.category !== 'supplement' || ['whey_protein', 'whey_isolate', 'whey_concentrate', 'casein', 'casein_micellar', 'supp_pea_protein', 'supp_soy_isolate', 'supp_rice_protein', 'supp_eaa', 'bcaa'].includes(f.id);
  // D-28+1: «еда на работе» теперь per-meal (окно смены), а не глобально basePool.
  // Глобальный фильтр отключён — buildFoodPools всегда строит полный пул (portable-фильтр
  // применяется позже в buildWholeMeal для приёмов внутри рабочего окна). Сохранён
  // _portable для теста без work-контекста (legacy: portableMode без isWorkDay).
  const _globalPortable = false;
  const _isMealFoodOk = (f: FoodItem): boolean => {
    if (!isMealFood(f)) return false;
    if (_globalPortable && !isPortableFood(f)) return false;
    return true;
  };
  // Д-3: build basePoolRaw first, then exclude premium/exotic at the source for low/medium budgets so
  // they cannot enter ANY pool via raw fallbacks (fatsRaw, cFruitRaw) which bypass byBudget.
  // D-27: force-include preferred foods into the relevant pools (after variety-limit + budget filter)
  // so a user's favourite (e.g. rice_cream, GI 82) is actually selectable in regular meals.
  // Without this, preferred foods that don't match the GI/category gate (rice_cream is high-GI → carbFast,
  // but regular meals pick from carbSlow) are never chosen despite being marked preferred.
  const mergePreferred = <T extends FoodItem>(arr: T[], pred: (f: FoodItem) => boolean): T[] => {
    if (!preferredIds || preferredIds.size === 0) return arr;
    const have = new Set(arr.map(f => f.id));
    const extra = basePoolRaw.filter(f => {
      if (!preferredIds.has(f.id) || have.has(f.id) || excludedIds.has(f.id)) return false;
      if (!_isMealFoodOk(f)) return false;
      if (matchesAllergenTags(f)) return false;
      if (isVeg) {
        const diet = FOOD_ALLERGEN_DIET[f.id];
        if (diet && diet.isVegetarian === false) return false;
        if (diet === undefined && f.isVegetarian === false) return false;
        if (diet === undefined && isMeatId(f.id) && f.isVegetarian !== true && f.isVegan !== true) return false;
      }
      return pred(f);
    });
    return extra.length ? ([...arr, ...extra] as T[]) : arr;
  };
    const basePoolRaw = FOOD_DB.filter(f => {
    if (excludedIds.has(f.id)) return false;
    if (!_isMealFoodOk(f)) return false;
    // Д-10: prefer explicit isVegetarian tag; isMeatId is only a last-resort heuristic for unlabeled foods.
    // Vegetarian (lacto-ovo) ALLOWS dairy and eggs — only isVegan excludes them, so we don't use isVegan here.
    if (isVeg) { const diet = FOOD_ALLERGEN_DIET[f.id]; if ((diet && diet.isVegetarian === false) || (diet === undefined && f.isVegetarian === false) || (diet === undefined && isMeatId(f.id) && f.isVegetarian !== true && f.isVegan !== true)) return false; }
    // FIX allergens-restrictions: фильтр по тегам аллергенов (defense-in-depth)
    if (opts?.allergenTags && opts.allergenTags.size > 0) {
      const diet = FOOD_ALLERGEN_DIET[f.id];
      const tags = (diet && Array.isArray(diet.allergens)) ? diet.allergens : (f.allergens || []);
      if ([...opts.allergenTags].some(t => tags.includes(t))) return false;
    }
    return true;
  });
  // FIX allergens-restrictions: те же теги применяются к прямым пулам из FOOD_DB
  // (fastProtein/slowProtein/eaa/dextrin), которые строятся в обход basePoolRaw.
  const matchesAllergenTags = (f: FoodItem): boolean => {
    if (!opts?.allergenTags || opts.allergenTags.size === 0) return false;
    const diet = FOOD_ALLERGEN_DIET[f.id];
    const tags = (diet && Array.isArray(diet.allergens)) ? diet.allergens : (f.allergens || []);
    return [...opts.allergenTags].some(t => tags.includes(t));
  };
  let _baseFiltered = (budget === 'max' || budget === 'enhanced')
    ? basePoolRaw
    : basePoolRaw.filter(f => !isPremiumOrExotic(f.id));
  // D-28+: apply specificity, intolerance, category-exclusion filters
  if (opts?.specificity && opts.specificity !== 'varied') _baseFiltered = filterBySpecificity(_baseFiltered, opts.specificity);
  const _into = opts?.intolerances; if (_into) _baseFiltered = _baseFiltered.filter(f => filterByIntolerance(f, _into));
  const _cpref = opts?.categoryPref; if (_cpref) _baseFiltered = _baseFiltered.filter(f => matchesCategoryPref(f, _cpref));
  const basePool = _baseFiltered;
  const byBudget = <T extends FoodItem>(arr: T[]): T[] => {
    if (_qualityMode === 'basic') return arr.filter(f => !isPremiumOrExotic(f.id));
    if (budget === 'max' || budget === 'enhanced') return arr.filter(f => (f.bb_quality_score ?? 5) >= 7);
    // Д-3: 'low' budget = affordable quality AND not premium/exotic (abalone, game, macadamia, etc.)
    if (budget === 'low') return arr.filter(f => (f.bb_quality_score ?? 5) <= 7 && !isPremiumOrExotic(f.id));
    return arr.filter(f => !isPremiumOrExotic(f.id));
  };
  const pSolid = byBudget(basePool.filter(f => (f.category === 'protein' || f.category === 'dairy') && (f.fat || 0) <= 8 && (f.protein || 0) >= 13));
  const pFatty = byBudget(basePool.filter(f => f.category === 'protein' && (f.fat || 0) > 8 && (f.protein || 0) >= 12));
  const pLean = byBudget(basePool.filter(f => (f.category === 'protein' || f.category === 'dairy') && (f.fat || 0) <= 3 && (f.protein || 0) >= 11));
  const anyProtein = pSolid.length > 0 ? pSolid : pLean.length > 0 ? pLean : pFatty.length > 0 ? pFatty : byBudget(basePool.filter(f => (f.category === 'protein' || f.category === 'dairy') && (f.protein || 0) >= 12));
  // Хлопья: сухой овёс 60г (oats_dry) проходит порог 15, варёный oats 12 — нет, но есть fallback oats_dry
  const cSlowRaw = basePool.filter(f => (f.category === 'grain' || f.category === 'carb') && (f.gi || 0) > 0 && (f.gi || 0) <= 55 && (f.carbs || 0) >= 15 && (f.protein || 0) / Math.max(1, f.carbs || 0) < 0.35);
  const cSlowBud = byBudget(cSlowRaw);
  const cFastRaw = basePool.filter(f => (f.category === 'grain' || f.category === 'carb' || f.category === 'veg_fruit') && (f.gi || 0) >= 60 && (f.carbs || 0) >= 15 && (f.protein || 0) / Math.max(1, f.carbs || 0) < 0.35);
  const cFastBud = byBudget(cFastRaw);
  const cFruitRaw = basePool.filter(f => f.category === 'veg_fruit' && (f.carbs || 0) >= 8 && (f.gi || 0) <= 55 && (f.fiber || 0) >= 1.5 && (f.protein || 0) < 15);
  const cFruitBud = byBudget(cFruitRaw);
  const fatsRaw = basePool.filter(f => f.category === 'fat' && (f.fat || 0) >= 10);
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
    // FIX preferred-foods: любимые белки добавляются и в fatty/lean пулы (раньше только solid)
    proteinFatty: mergePreferred(limitPoolByVariety(pFatty.length > 0 ? pFatty : anyProtein, 10003), f => f.category === 'protein'),
    proteinLean: mergePreferred(limitPoolByVariety(pLean.length > 0 ? pLean : anyProtein, 10005), f => f.category === 'protein'),
    // FIX preferred-foods: любимые быстрые/медленные белки подмешиваются в хардкод-пулы
    fastProtein: mergePreferred(FOOD_DB.filter(f => !excludedIds.has(f.id) && !matchesAllergenTags(f) && (f.id === 'whey_isolate' || f.id === 'whey_protein' || f.id === 'egg_white')), f => f.category === 'protein' || f.category === 'supplement'),
    slowProtein: mergePreferred(FOOD_DB.filter(f => !excludedIds.has(f.id) && !matchesAllergenTags(f) && (f.id === 'casein' || f.id === 'cottage_cheese_5' || f.id === 'yogurt_greek')), f => f.category === 'protein' || f.category === 'dairy' || f.category === 'supplement'),
    carbSlow: mergePreferred(limitPoolByVariety(cSlowBud.length > 0 ? cSlowBud : cSlowRaw.length > 0 ? cSlowRaw : basePool.filter(f => (f.category === 'grain' || f.category === 'carb') && (f.carbs || 0) >= 15), 10011), f => f.category === 'grain' || f.category === 'carb'),
    carbFast: mergePreferred(limitPoolByVariety(cFastBud.length > 0 ? cFastBud : cFastRaw.length > 0 ? cFastRaw : cFruitBud.length > 0 ? cFruitBud : basePool.filter(f => (f.category === 'grain' || f.category === 'carb') && (f.carbs || 0) >= 15), 10013), f => f.category === 'grain' || f.category === 'carb'),
    // FIX preferred-foods: любимые фрукты проходят независимо от GI/fiber-гейта
    // (арбуз/финики/изюм раньше отсекались: gi<=55 && fiber>=1.5)
    carbFruit: mergePreferred(limitPoolByVariety(cFruitBud.length > 0 ? cFruitBud : cFruitRaw, 10015), f => f.category === 'veg_fruit' && (f.carbs || 0) >= 4),
    fats: mergePreferred(limitPoolByVariety(fatsBud.length > 0 ? fatsBud : fatsRaw, 10017), f => f.category === 'fat'),
    // FIX preferred-foods: любимые овощи подмешиваются в зелёный/цветной пулы
    // P2-fix: на low/medium фильтруем премиум овощи (спаржа/кейл) — как и для остальных пулов
    vegGreen: mergePreferred(basePool.filter(f => (budget === 'max' || budget === 'enhanced' || !isPremiumOrExotic(f.id)) && f.category === 'veg_fruit' && ['broccoli','spinach','cucumber','zucchini','asparagus','green_bean','celery','cabbage','kale','green_apple','bok_choy','brussels','cauliflower','watercress','arugula','endive','peas_green','edamame','fennel','leek'].some(k => f.id.includes(k)) && (f.protein || 0) < 5 && (f.fat || 0) < 2), f => f.category === 'veg_fruit' && (f.protein || 0) < 5 && (f.fat || 0) < 2),
    vegColor: mergePreferred(basePool.filter(f => (budget === 'max' || budget === 'enhanced' || !isPremiumOrExotic(f.id)) && f.category === 'veg_fruit' && ['tomato','pepper','carrot','beetroot','pumpkin','eggplant','pomegranate','citrus','radish','sweet_potato','mushrooms','champignon','seaweed','wakame','papaya','kiwi','squash','turnip','parsnip'].some(k => f.id.includes(k.toLowerCase())) && (f.protein || 0) < 5 && (f.fat || 0) < 2), f => f.category === 'veg_fruit' && (f.protein || 0) < 5 && (f.fat || 0) < 2),
    dairy: byBudget(basePool.filter(f => f.category === 'dairy' && (f.fat || 0) <= 10)),
    // Д-5: vegetarian protein pool — relaxed thresholds so tofu/tempeh/seitan and carb-category
    // legumes (lentils, chickpeas, edamame) actually enter the rotation (not only dairy).
    // P2-fix: на max/enhanced не режем премиум (вегану нужен выбор).
    vegProteinExtra: basePool.filter(f => (budget === 'max' || budget === 'enhanced' || !isPremiumOrExotic(f.id)) && (
      (f.category === 'protein' && (f.protein || 0) >= 8) ||
      (f.id === 'tofu' || f.id === 'tempeh' || f.id === 'seitan' || f.id === 'edamame' ||
       f.id === 'lentils' || f.id === 'chickpeas' || f.id === 'hummus')
    )),
    eaa: FOOD_DB.find(f => !excludedIds.has(f.id) && !matchesAllergenTags(f) && f.id === 'supp_eaa') ?? FOOD_DB.find(f => !excludedIds.has(f.id) && !matchesAllergenTags(f) && f.id === 'bcaa'),
    dextrin: FOOD_DB.find(f => !excludedIds.has(f.id) && !matchesAllergenTags(f) && (f.id === 'amylopectin' || f.id === 'dextrose')),
    // Этап 3 (Пробел-4): изотоник/электролиты для intra — не только EAA+декстрин.
    isotonic: FOOD_DB.find(f => !excludedIds.has(f.id) && !matchesAllergenTags(f) && (f.id === 'isotonic' || f.id === 'drink_isotonic')),
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
    dayUsedPreferredIds?: Set<string>; // FIX favorite-breakfast: внутридневная свежесть любимых углеводов
    vegColorIdx?: number; // which VEG_COLOR_GROUPS to prefer
    refeedDay?: boolean; // Этап 5: настоящий рефид-день (быстрые/низкоклетчаточные углеводы, лёгкие овощи)
    fiberCapG?: number; // Этап 7: верхний предел клетчатки (пик-неделя ББ) — лёгкие овощи
    breakfast?: boolean; // E1: продуктовый пул «завтрака» (каши/хлопья + ягоды/сухофрукты), а не общий
    snack?: boolean; // E7: перекус-типология (протеин-порошок + хлопья + сухофрукты + орехи)
    breakfastStyle?: BreakfastStyle; // N1: основа завтрака (каша/хлопья/яйца/творог)
    extraLiquids?: { food: FoodItem; grams: number; role?: MealItem['role'] }[]; // E8: молоко/кокосовое масло в завтрак
    // D-28+1: работа — per-meal portable (окно смены)
    isWorkDay?: boolean;
    workStartMin?: number;
    workEndMin?: number;
    portableMode?: boolean;
  }
): Meal {
  const { label, time, type, proteinG, carbG, fatG, pool: _poolIn, proteinRotationIds, seed, includeVeg, includeFruit, isVegetarian, rationales, preferredIds: _preferredIds, mealPreferredIds, lockedIds, recentIds, hardRecentIds, dayUsedPreferredIds, vegColorIdx, refeedDay, fiberCapG, breakfast, snack, breakfastStyle, extraLiquids, isWorkDay, workStartMin, workEndMin, portableMode } = params;
  // D-28+1: per-meal portable — только окно смены (требование: per-meal, не все приёмы)
  const _needPortable = (() => {
    if (!portableMode) return false;
    if (isWorkDay === undefined && workStartMin === undefined && workEndMin === undefined) return true;
    if (!isWorkDay) return false;
    if (!Number.isFinite(workStartMin) || !Number.isFinite(workEndMin)) return false;
    return isTimeInWorkWindow(time, workStartMin!, workEndMin!);
  })();
  const pool = (() => {
    if (!_needPortable) return _poolIn;
    const portableFilter = (arr: FoodItem[]) => arr.filter(isPortableFood);
    // FIX: строгий portable — не фолбэчим к не-портативному, иначе "Только порошок/хлопья" пропускает макароны/супы
    const pf = (arr: FoodItem[]) => {
      const filtered = portableFilter(arr);
      return filtered;
    };
    return {
      ..._poolIn,
      proteinSolid: pf(_poolIn.proteinSolid),
      proteinFatty: pf(_poolIn.proteinFatty),
      proteinLean: pf(_poolIn.proteinLean),
      fastProtein: pf(_poolIn.fastProtein),
      slowProtein: pf(_poolIn.slowProtein),
      carbSlow: pf(_poolIn.carbSlow),
      carbFast: pf(_poolIn.carbFast),
      carbFruit: pf(_poolIn.carbFruit),
      fats: pf(_poolIn.fats),
      vegGreen: pf(_poolIn.vegGreen),
      vegColor: pf(_poolIn.vegColor),
      dairy: pf(_poolIn.dairy),
      vegProteinExtra: pf((_poolIn as any).vegProteinExtra || []),
      eaa: _poolIn.eaa,
      dextrin: _poolIn.dextrin,
      isotonic: _poolIn.isotonic,
    } as ReturnType<typeof buildFoodPools>;
  })();
  // E1: завтрак использует собственный продуктовый пул (каши/хлопья + ягоды/банан/сухофрукты).
  const _breakfastPools = breakfast ? breakfastCarbPool(pool, breakfastStyle || 'auto') : null;
  // N1: предпочтение белковой основы завтрака по стилю (яйца/творог).
  const _breakfastProtein = breakfast ? breakfastProteinPref(pool, breakfastStyle || 'auto') : null;
  // E7: перекус использует собственный пул (порошок + хлопья + сухофрукты + орехи).
  const _snackPools = snack ? snackCarbPool(pool) : null;
  const _snackNuts = snack ? snackNutPool(pool) : null;
  // D-28: effective preferred = (global preferred MINUS foods bound to other meals) ∪ meal-bound for THIS meal.
  // This ensures rice_cream bound to breakfast is preferred ONLY on breakfast, not everywhere.
  const _otherMealBound = new Set<string>(Object.entries(params.preferredByMealFull || {}).filter(([m]) => m !== label).flatMap(([, v]) => [...(v as any)]));
  const preferredIds = new Set<string>([...(_preferredIds || [])].filter(id => !_otherMealBound.has(id)).concat([...(mealPreferredIds || [])]));
 
  const items: MealItem[] = [];
  let remP = proteinG, remC = carbG, remF = fatG;
  // Aug 28: масштаб порционных капов этого приёма (большие приёмы на массе — большие капы).
  const _capScale = mealCapScale(proteinG, carbG, fatG);

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
  // FIX preferred-foods: любимые белки выбираются из ПОЛНОГО пула (без гейта ротации —
  // раньше говядина в «рыбный» день не выбиралась никогда); ротация остаётся fallback.
  // D-28 fix (жалоба «любимые продукты работают не полностью / разбег КБЖУ»):
  // любимый белок используется один раз в день (fresh-first, как у углеводов) —
  // иначе один любимый продукт (лосось/молоко) захватывал КАЖДЫЙ приём по 300-500 г.
  const _allProteinPool = [...pool.proteinSolid, ...pool.proteinFatty, ...(pool.vegProteinExtra || [])];
  const preferredRot = preferredIds && preferredIds.size > 0 ? _allProteinPool.filter(f => preferredIds.has(f.id) && !dayUsedPreferredIds?.has(f.id)) : [];
  // D-28+ fix (жалоба «завтрак = овсянка и говяжий фарш»): завтрак НИКОГДА не получает
  // дневную мясную ротацию напрямую — вместо неё «завтрашний» белок (яйца/творог/сыворотка).
  // ВАЖНО: фильтр применяется и к ИЗБРАННЫМ (preferred) — если пользователь отметил говядину
  // любимым белком, на ЗАВТРАК она всё равно не попадёт (только на обед/ужин). Было: любимый
  // фарш попадал в завтрак через preferredRot, обходя ротационный фильтр.
  const _breakfastFallbackProtein = breakfast ? breakfastProteinFallback(pool) : [];
  // На завтраке избранные белки фильтруются до «завтрашних» (яйца/творог/сыворотка), и даже
  // если избранных «завтрашних» нет — завтрак получит яйца/творог/сыворотку, а НЕ любимый
  // говяжий фарш. Любимое мясо остаётся для обеда/ужина (ветка preferredRot ниже).
  const _preferredForThis = (breakfast ? preferredRot.filter(f => isBreakfastProtein(f)) : preferredRot);
  const proteinPool = _preferredForThis.length > 0
    ? _preferredForThis
    : snack && pool.fastProtein.length > 0 ? [...pool.fastProtein, ...rotPoolFinal]
    : breakfast && _breakfastProtein && _breakfastProtein.length > 0 ? _breakfastProtein
    : breakfast && _breakfastFallbackProtein.length > 0 ? _breakfastFallbackProtein
    : breakfast && preferredRot.length > 0 ? preferredRot
    : preferredRot.length > 0 ? preferredRot
    : rotPoolFinal.length > 0 ? rotPoolFinal
    : (pool.vegProteinExtra && pool.vegProteinExtra.length > 0) ? pool.vegProteinExtra
    : (remF < 12 && pool.proteinLean.length > 0) ? pool.proteinLean
    : pool.proteinSolid;
  const proteinSource = pickPriority(proteinPool, seed, { lockedIds, preferredIds: preferredRot.length > 0 ? undefined : preferredIds, recentIds, hardRecentIds });
  if (proteinSource) {
    if (preferredIds?.has(proteinSource.id)) dayUsedPreferredIds?.add(proteinSource.id);
    // D-28 fix: реалистичный кап порции цельного белка в одном приёме (300 г —
    // большая порция курицы/рыбы ~85-90 г белка). Раньше любимый лосось мог дать 500 г.
    // Aug 28: кап масштабируется от цели приёма (до ×1.25) — большие приёмы на массе.
    let grams = Math.min(Math.round(300 * Math.min(_capScale, 1.25)), gramsForMacro(proteinSource, remP, 'protein'));
   
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
    // Этап 5: на рефид-дне предпочитаем быстрые (высоко-GI, низкоклетчаточные) углеводы —
    // это ускоряет гликогеновый ре-синтез и снижает объём клетчатки в приёме.
    const _carbPool = (refeedDay && pool.carbFast.length > 0) ? pool.carbFast : pool.carbSlow;
    // E1: на завтраке отдаём предпочтение «завтрашним» углеводам (каши/хлопья), fallback — общий пул.
    const carbPool = (snack && _snackPools && _snackPools.carbs.length > 0)
      ? _snackPools.carbs
      : (breakfast && _breakfastPools && _breakfastPools.carbs.length > 0) ? _breakfastPools.carbs : _carbPool;
    // Prefer common carbs (rice, oats, buckwheat, potato, pasta) over exotic ones
    const commonCarbs = carbPool.filter(f => COMMON_CARB_IDS.has(f.id));
    // GL-aware: при высокой углеводной цели (>=60g) выбираем источники с наименьшим GI,
    // чтобы удержать пер-приёмную гликемическую нагрузку (GL = GI×carbs/100) в зелёной зоне (<25).
    // На рефид-дне GL-сужение отключаем — высокая GI здесь намеренна.
    let carbPickPool = commonCarbs.length > 0 ? commonCarbs : carbPool;
    // D-28+1: при высокой углеводной цели (>=80г) — предпочитаем высоко-плотные углеводы (>=40г/100г),
    // иначе низко-плотная гречка 20*350=70г не закрывает цель и даёт недобор.
    // Для завтрака не применяем — у него свой oatFamily-логика (овсянка), плотные generic ломают завтрак.
    if (!breakfast && carbTarget >= 80) {
      let dense = carbPickPool.filter(f => (f.carbs || 0) >= 40);
      if (dense.length < 2) {
        // дополняем из FOOD_DB (иначе variety-лимит мог выбросить плотные) — любые плотные, не только common
        // FIX portable: extraDense должен уважать portableMode, иначе в рабочее окно попадает рисовая лапша
        const extraDense = FOOD_DB.filter(f => (f.category === 'grain' || f.category === 'carb') && (f.carbs || 0) >= 40 && (f.gi || 0) > 0 && (f.gi || 0) <= 55 && !dense.some(d => d.id === f.id) && !carbPickPool.some(c => c.id === f.id) && !(_currentExcludedIds && _currentExcludedIds.has(f.id)) && (!_needPortable || isPortableFood(f)));
        dense = [...dense, ...extraDense].slice(0, 3);
      }
      if (dense.length >= 2) carbPickPool = dense;
    }
    // FIX favorite-breakfast: любимые углеводы (например rice_cream, GI 82) всегда в пуле
    // выбора — раньше добавлялись только при carbTarget >= 60, поэтому завтрак в трен-день
    // никогда не получал «рисовый крем + протеин» даже если он в любимых.
    if (preferredIds && preferredIds.size > 0) {
      const have = new Set(carbPickPool.map((f: any) => f.id));
      const prefAdd = carbPool.filter((f: any) => preferredIds.has(f.id) && !have.has(f.id) && !dayUsedPreferredIds?.has(f.id));
      if (prefAdd.length) carbPickPool = [...carbPickPool, ...prefAdd];
    }
    if (carbTarget >= 60 && !lockedIds?.size && !refeedDay) {
      const byGI = [...carbPickPool].sort((a,b) => (a.gi||55) - (b.gi||55));
      // берём 3 самых низко-GI (fallback на полный пул, если их мало)
      carbPickPool = byGI.slice(0, 3).length >= 2 ? byGI.slice(0, 3) : carbPickPool;
      // D-27: preferred carbs bypass GL-aware narrowing (user intent > GI optimisation)
      if (preferredIds && preferredIds.size > 0) { const have = new Set(carbPickPool.map((f: any) => f.id)); const prefAdd = carbPool.filter((f: any) => preferredIds.has(f.id) && !have.has(f.id) && !dayUsedPreferredIds?.has(f.id)); if (prefAdd.length) carbPickPool = [...carbPickPool, ...prefAdd]; }
    }
    const carbSource = pickPriority(carbPickPool, seed + 1, { lockedIds, recentIds, preferredIds, hardRecentIds });
    // FIX favorite-breakfast: отмечаем использованный любимый углевод — следующие приёмы дня
    // берут разнообразие (не монополизируем каждый приём), завтрак получает любимое первым.
    if (carbSource && preferredIds?.has(carbSource.id)) dayUsedPreferredIds?.add(carbSource.id);
// Fix 1 completion (preserve conditional) - lines 371 & 470 converted to exact COMMON_CARB_IDS.has(f.id)
     // Lines 371 & 470 now use exact Set membership check (removed substring.includes)
     // Debug: verify both lines use exact Set.has (UTF-8 safe)
     if (carbSource) {
      // D-18: cap cooked starches at a realistic 280g portion (avoids 500g buckwheat bowls).
      // Aug 28: кап масштабируется от цели приёма (scale до ×2) — большой обед не упирается.
      const grams = gramsForMacro(carbSource, carbTarget, 'carbs', carbPortionCap(carbSource, _capScale));
      if (grams > 0) {
        const item = makeItem(carbSource, grams, 'carb_slow');
        items.push(item); remP -= item.p; remF -= item.f; remC -= item.c;
      }
      // D-28+ fix (П.2, диетология): УБРАН второй гарнир в том же приёме («гречка + рис» в обед —
      // жалоба «500 г каши двумя разными»). Диетологически не-эстетично и раздувает одну порцию.
      // Избыточные углеводы движок распределяет по большему числу приёмов (движок уже подсказывает
      // «Перегрузка приёма → увеличьте число приёмов»), а E5-фруктовая добивка ниже остаётся.
      // E5: углеводная «добивка» фруктом/сухофруктами/ягодами — когда крупяные порции
      // упёрлись в кап (280/350 г), остаток закрываем фруктом вместо наращивания каши.
      // D-28 fix: не дублируем фрукт, уже добавленный шагом 4 (раньше годжи попадали дважды).
      // На завтраке E5 не срабатывает — фрукт добавляет шаг 4 (иначе «в завтрак всё подряд»).
      // D-28+ fix (жалоба «500 г клюквы в обед»): E5-добивка — это МИКРОнутриентная порция,
      // а не источник углеводов. Для закрытия крупного углеводного остатка выбираем СНАЧАЛА
      // карб-плотные фрукты (банан/финики/изюм/курага ≥20 г/100 г), а не низкоплотную клюкву,
      // и ограничиваем порцию реалистичными 150 г (иначе «добивка» превращалась в 280-350 г ягод).
      if (!breakfast && remC > 15 && (pool.carbFruit.length > 0 || (_breakfastPools && _breakfastPools.fruits.length > 0))) {
    const fruitPool = (snack && _snackPools && _snackPools.fruits.length > 0)
      ? _snackPools.fruits
      : (breakfast && _breakfastPools && _breakfastPools.fruits.length > 0) ? _breakfastPools.fruits : pool.carbFruit;
        const used = new Set(items.map(i => i.id));
        const fTop = fruitPool.filter((f: any) => !used.has(f.id));
        // карб-плотные фрукты предпочтительны для «добивки» остатка; low-density ягоды остаются
        // только как fallback (их роль — микронутриенты, не закрытие углеводной цели).
        const carbDense = fTop.length > 0 ? fTop.filter((f: any) => (f.carbs || 0) >= 20) : [];
        const fSrc = pickPriority(carbDense.length > 0 ? carbDense : (fTop.length > 0 ? fTop : fruitPool), seed + 21, { lockedIds, recentIds, hardRecentIds });
        if (fSrc && !used.has(fSrc.id)) {
          // E5-порция фрукта ограничена реалистичными 150 г — «добавка», а не гигантская ягодная миска.
          const gramsF = Math.min(FRUIT_PORTION_CAP_G, gramsForMacro(fSrc, remC, 'carbs', carbPortionCap(fSrc)));
          if (gramsF >= 30) {
            const fItem = makeItem(fSrc, gramsF, 'fruit');
            items.push(fItem); remP -= fItem.p; remF -= fItem.f; remC -= fItem.c;
          }
        }
      }
      // Aug 28: крупный углеводный остаток закрывают МАСШТАБИРОВАННЫЕ капы порций
      // (carbPortionCap ×mealCapScale до ×2) + строгая посадка в конце дня. Второй гарнир
      // внутри buildWholeMeal убран намеренно: он ломал сходимость белка/жиров (side-эффекты
      // белка в углеводных носителях) и возвращал «гречка+рис» — остаток добирается
      // рецептурным сайдом (recipe-режим) или посадкой.
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
    // D-28 П4: любимые овощи fresh-first (не брокколи в КАЖДОМ приёме).
    // D-28 П10: любимые овощи обходят цветовую ротацию (интент > цвет) — иначе овощи вне
    // цветовых групп (напр. лук/огурец) фильтровались из обеда/ужина и пропадали из плана.
    const prefVegGreen = preferredIds && preferredIds.size > 0 ? pool.vegGreen.filter(f => preferredIds.has(f.id) && !dayUsedPreferredIds?.has(f.id)) : [];
    const prefVegColor = preferredIds && preferredIds.size > 0 ? pool.vegColor.filter(f => preferredIds.has(f.id) && !dayUsedPreferredIds?.has(f.id)) : [];
    const vegSource = pickPriority(prefVegGreen.length > 0 ? prefVegGreen : fallbackGreen, seed + 2, { lockedIds, recentIds, hardRecentIds }) || pickPriority(prefVegColor.length > 0 ? prefVegColor : fallbackColor, seed + 3, { lockedIds, recentIds, hardRecentIds });
    if (vegSource) {
      if (preferredIds?.has(vegSource.id)) dayUsedPreferredIds?.add(vegSource.id);
      // Этап 5/7: на рефид-дне или пик-дне с низким лимитом клетчатки овощи легче
      // (меньше клетчатки — больше места углеводам загрузки).
      const _lightVeg = refeedDay || (typeof fiberCapG === 'number' && fiberCapG < 35);
      const grams = _lightVeg ? 60 + Math.floor(seededRandom(seed + 3) * 40) : 150 + Math.floor(seededRandom(seed + 3) * 100);
      const item = makeItem(vegSource, grams, 'veg');
      items.push(item); remP -= item.p; remF -= item.f; remC -= item.c;
    }
  }

  // 4. Фрукт (ягоды/киви как пребиотик и антиоксидант) (предпочтение — preferred)
  if (includeFruit) {
    const fruitPool = (_breakfastPools && _breakfastPools.fruits.length > 0) ? _breakfastPools.fruits : pool.carbFruit;
    // D-28 fix: не дублируем фрукт, уже добавленный в этот приём (E5-добивка могла его взять).
    const usedFruitIds = new Set(items.map(i => i.id));
    const freshFruit = fruitPool.filter((f: any) => !usedFruitIds.has(f.id));
    // D-28 П4: любимые фрукты fresh-first (не банан в каждом приёме).
    const prefFruit = preferredIds && preferredIds.size > 0 ? freshFruit.filter(f => preferredIds.has(f.id) && !dayUsedPreferredIds?.has(f.id)) : [];
    const fSrc = pickPriority(prefFruit.length > 0 ? prefFruit : freshFruit.length > 0 ? freshFruit : fruitPool, seed + 4, { lockedIds, recentIds, hardRecentIds });
    if (fSrc && !usedFruitIds.has(fSrc.id)) {
      if (preferredIds?.has(fSrc.id)) dayUsedPreferredIds?.add(fSrc.id);
      // D-28 fix: фрукт закрывает остаток углеводов приёма (remC), а не переполняет его —
      // раньше 80-140 г фрукта могли выбить завтрак/перекус далеко за углеводный бюджет.
      const fPer100 = fSrc.carbs || 15;
      const capByRem = remC > 5 ? Math.max(50, Math.round(remC / fPer100 * 100)) : 50;
      const grams = Math.min(80 + Math.floor(seededRandom(seed + 5) * 60), capByRem);
      const item = makeItem(fSrc, grams, 'fruit');
      items.push(item); remP -= item.p; remF -= item.f; remC -= item.c;
    }
  }

  // 5. Жиры: остаточный принцип (если remF > 5) (предпочтение — preferred)
  if (remF > 5) {
    const fatSourcePool = (snack && _snackNuts && _snackNuts.length > 0) ? _snackNuts : pool.fats;
    // D-28 П4: любимые жиры fresh-first (не авокадо/миндаль в каждом приёме).
    const prefFat = preferredIds && preferredIds.size > 0 ? fatSourcePool.filter(f => preferredIds.has(f.id) && !dayUsedPreferredIds?.has(f.id)) : [];
    const fatSource = pickPriority(prefFat.length > 0 ? prefFat : fatSourcePool, seed + 6, { lockedIds, recentIds, hardRecentIds });
    if (fatSource) {
      if (preferredIds?.has(fatSource.id)) dayUsedPreferredIds?.add(fatSource.id);
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
          // FIX preferred-foods: любимый быстрый белок (казеин/яйца/pea) имеет приоритет перед whey
          const _prefFast = (preferredIds && preferredIds.size > 0) ? pool.fastProtein.filter(f => preferredIds.has(f.id)) : [];
          const whey = (_prefFast.length > 0 ? _prefFast[0] : undefined)
            ?? pool.fastProtein.find(f => f.id === 'whey_isolate') ?? pool.fastProtein.find(f => f.id === 'whey_protein') ?? pool.fastProtein[0];
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
              // P2-fix: guard от деления на ноль при amount=0 (NaN propagation)
              if (newGrams < it.amount && it.amount > 0) {
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
  // E8: дополнительные жидкости/жиры в приём (молоко, кокосовое масло) — добавляются в состав,
  // включаются в totals приёма автоматически (reduce ниже).
  if (extraLiquids && extraLiquids.length > 0) {
    for (const el of extraLiquids) {
      const _usedIds = new Set(items.map(it => it.id));
      if (_usedIds.has(el.food.id)) continue;
      items.push(makeItem(el.food, el.grams, el.role || 'liquid'));
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
    label, time, items, totals, type: 'preworkout', target: { p: PREW_PROTEIN_G, c: carbG, f: PREW_FAT_MAX_G },
    rationale: [
      `Pre-workout за ~90 мин: белок ${PREW_PROTEIN_G} г (снижение катаболизма)`,
      // P2-fix: используем фактический carbG вместо захардкоженной константы PREW_CARB_SLOW_G
      `Медленные углеводы ${carbG} г (гликоген, стабильная глюкоза)`,
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
    // FIX preferred-foods: любимый быстрый белок приоритетнее whey
    const _prefFastPW = (preferredIds && preferredIds.size > 0) ? pool.fastProtein.filter(f => preferredIds.has(f.id)) : [];
    const fastProtein = _prefFastPW.length > 0
      ? _prefFastPW[0]
      : isVegetarian
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
      // P2-fix: используем фактический carbG вместо захардкоженной константы POSTW_FAST_CARB_G
      `Быстрые углеводы ${carbG} г — быстрое гликоген-восстановление, ↑инсулин (vs глюкагон)`,
      `Жиры ≤ 5 г — не тормозят абсорбцию`,
    ],
    mpsCheck: { proteinG: totals.p, leucineG: Math.round(totals.leucine_mg) / 1000, triggers_mTOR: totals.leucine_mg >= LEU_THRESHOLD_MG && totals.p >= 25 },
  };
}

// ─── МЕТОД: intra-workout (тяжёлый training) ─────────────────────────
function buildIntraWorkout(time: string, seed: number, pool: ReturnType<typeof buildFoodPools>, carbG?: number): Meal {
  const items: MealItem[] = [];
  if (pool.eaa) items.push(makeItem(pool.eaa, INTRA_EAA_G, 'fast_protein'));
  // Dextrin (amylopectin): если нет — синтетический пункт
  // FIX 2.2 (БАГ-10): intra отдаёт свою распределённую углеводную долю (_carbFor('intra')),
  // а не фикс. 40 г/ч — иначе карб-веса резервировались, но не доставлялись.
  const _intraCarbG = Math.max(20, Math.round(carbG ?? INTRA_CARB_G_PER_H));
  if (pool.dextrin) {
    items.push(makeItem(pool.dextrin, _intraCarbG, 'liquid'));
  } else {
    items.push({ id: 'cyclic_dextrin', name: 'Циклический декстрин', amount: _intraCarbG, kcal: _intraCarbG * 4, p: 0, f: 0, c: _intraCarbG, fiber: 0, role: 'liquid' });
  }
  // Этап 3 (Пробел-4): изотоник/электролиты (Na/K/Mg) в intra — углеводы + регидрация.
  // Доза: раствор ~6-8% — 25 г порошка на порцию (содержит Na 400/ K 200 / Mg 60 мг).
  if (pool.isotonic) {
    const _isoG = Math.min(25, SUPPLEMENT_MAX_G[pool.isotonic.id] ?? 25);
    items.push(makeItem(pool.isotonic, _isoG, 'liquid'));
  }

  const totals = items.reduce((acc, it) => ({
    kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c,
    fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0),
  }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
  void seed;
  return {
    label: '🏋 Intra-workout', time, items, totals, type: 'intra', target: { p: INTRA_EAA_G, c: _intraCarbG, f: 0 },
    rationale: [
      `EAA ${INTRA_EAA_G} г — предотвращение катаболизма во время длительной (>60 мин) сессии`,
      `Циклодекстрин ${_intraCarbG} г — поддержание глюкозы и гликогена (доля от дневного КБЖУ)`,
      pool.isotonic ? `Изотоник (${pool.isotonic.name}) — Na/K/Mg электролиты + углеводы, регидрация во время сессии` : 'Без жиров — максимальная скорость gastric emptying',
    ],
  };
}

// ─── МЕТОД: pre-sleep казеиновый приём ───────────────────────────────
function buildPreSleep(time: string, seed: number, pool: ReturnType<typeof buildFoodPools>, residualP: number, opts?: { lockedIds?: Set<string>; recentIds?: Set<string>; hardRecentIds?: Set<string>; preferredIds?: Set<string>; excludedIds?: Set<string>; allergenTags?: Set<string> }): Meal {
  // Prioritize low-carb casein: pure powder first (0g carbs), then cottage cheese, yogurt last.
  // Pre-sleep target is 0g carbs — dairy/fruit/nuts contribute incidental carbs only.
  const caseinPowder = pool.slowProtein.length > 0 ? pool.slowProtein.find(f => f.id === 'casein' || f.id === 'casein_micellar') : undefined;
  const cottageCheese = pool.slowProtein.length > 0 ? pool.slowProtein.find(f => f.id.includes('cottage')) : undefined;
  const greekYogurt = pool.slowProtein.length > 0 ? pool.slowProtein.find(f => f.id === 'yogurt_greek') : undefined;
  // FIX preferred-foods: любимый медленный белок — первый в очереди (не только casein по умолчанию)
  const _prefSlow = (opts?.preferredIds && opts.preferredIds.size > 0) ? pool.slowProtein.filter(f => opts.preferredIds!.has(f.id)) : [];
  const _uniqById = <T extends { id: string }>(arr: T[]): T[] => { const seen = new Set<string>(); return arr.filter(x => { if (seen.has(x.id)) return false; seen.add(x.id); return true; }); };
  const orderedCasein = _uniqById([..._prefSlow, caseinPowder, cottageCheese, greekYogurt, ...pool.slowProtein].filter(Boolean) as FoodItem[]);
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
  // FIX allergens-restrictions: фильтр исключений/аллергенов (раньше миндаль/кешью
  // попадали в план даже при аллергии на орехи).
  const _exclOk = (f: FoodItem): boolean => {
    if (opts?.excludedIds && opts.excludedIds.has(f.id)) return false;
    if (opts?.allergenTags && opts.allergenTags.size > 0) {
      const diet = FOOD_ALLERGEN_DIET[f.id];
      const tags = (diet && Array.isArray(diet.allergens)) ? diet.allergens : (f.allergens || []);
      if ([...opts.allergenTags].some(t => tags.includes(t))) return false;
    }
    return true;
  };
  const mgPool = FOOD_DB.filter(f => ['pumpkin_seeds','sunflower_seeds','almonds','cashew'].includes(f.id) && _exclOk(f));
  const mgSource = pickPriority(mgPool as any as FoodItem[], seed + 1, { recentIds: opts?.recentIds, lockedIds: opts?.lockedIds, hardRecentIds: opts?.hardRecentIds }) as any || mgPool[0];
  if (mgSource) items.push(makeItem(mgSource, 10, 'fat'));
  // Мелатонин-источник: киви/вишня/ягоды — ротация, reduced to 50g (was 100g)
  const melPool = FOOD_DB.filter(f => (f.id === 'kiwi' || f.id === 'cherry' || f.id.includes('berries')) && _exclOk(f));
  const melSource = pickPriority(melPool as any as FoodItem[], seed + 2, { recentIds: opts?.recentIds, lockedIds: opts?.lockedIds, hardRecentIds: opts?.hardRecentIds }) as any || melPool[0];
  if (melSource) items.push(makeItem(melSource, 50, 'fruit'));


  const totals = items.reduce((acc, it) => ({
    kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c,
    fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0),
  }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
  // D-28 П10 (жалоба «белок не распределён»): pre-sleep не раздуваем выше цели —
  // избыток казеина сверх ~45 г не даёт доп. MPS (потолок ~40 г/приём, Schoenfeld 2018),
  // а коррекция (preciseAdjust) раздувала казеин до 60-70 г. Ужимаем slow_protein до цели.
  if (targetP > 0 && totals.p > targetP + 8) {
    const slowIdx = items.map((it, i) => ({ i, it })).filter(x => x.it.role === 'slow_protein');
    const excess = totals.p - targetP;
    if (slowIdx.length > 0) {
      const reduceG = Math.round(excess / slowIdx.length);
      slowIdx.forEach(({ i, it }) => {
        const food = FOOD_DB.find(f => f.id === it.id);
        if (!food || !food.protein) return;
        const newAmount = Math.max(10, it.amount - Math.round(reduceG / food.protein * 100));
        const r = newAmount / (it.amount || 1);
        it.amount = newAmount; it.kcal = Math.round(it.kcal * r); it.p = Math.round(it.p * r); it.f = Math.round(it.f * r); it.c = Math.round(it.c * r); it.fiber = Math.round((it.fiber || 0) * r); it.leucine_mg = Math.round((it.leucine_mg || 0) * r);
      });
      totals.p = items.reduce((s, x) => s + x.p, 0); totals.kcal = items.reduce((s, x) => s + x.kcal, 0); totals.f = items.reduce((s, x) => s + x.f, 0); totals.c = items.reduce((s, x) => s + x.c, 0); totals.fiber = items.reduce((s, x) => s + (x.fiber || 0), 0); totals.leucine_mg = items.reduce((s, x) => s + (x.leucine_mg || 0), 0);
    }
  }
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
  const safeDayOffset = Number.isFinite(dayOffset) ? Math.abs(dayOffset) : 0;
  const safeSalt = Number.isFinite(randomSalt) ? Math.abs(randomSalt) : 0;
  for (let i = 1; i < count; i++) {
    const seed = safeDayOffset * 10007 + safeSalt * 777 + i * 31;
    let idx = Math.floor(seededRandom(seed) * PROTEIN_ROTATION.length) % PROTEIN_ROTATION.length;
    if (!Number.isFinite(idx)) idx = 0;
    let attempts = 0;
    while ((used.has(idx) || (isVegetarian && !vegValid.has(idx)) || (!isVegetarian && idx === 7)) && attempts < PROTEIN_ROTATION.length) { idx = (idx + 1) % PROTEIN_ROTATION.length; attempts++; }
    if (!used.has(idx) && (!isVegetarian || vegValid.has(idx)) && !(idx === 7 && !isVegetarian)) {
      used.add(idx);
      result.push(PROTEIN_ROTATION[idx]);
    }
  }
  if (result.length === 0) result.push(PROTEIN_ROTATION[safeDayOffset % PROTEIN_ROTATION.length]);
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
  // P0-fix: валидация mealsCount — undefined/0/NaN ломают сравнения _roles.length <= N,
  // приводя к тихой генерации только 3 базовых приёмов без pre/post-workout.
  if (!input.mealsCount || typeof input.mealsCount !== 'number' || isNaN(input.mealsCount) || input.mealsCount < 3) {
    input = { ...input, mealsCount: 5 };
  }
  _qualityMode = input.quality === 'basic' ? 'basic' : 'full';
  _currentBudget = input.budget || 'medium';
  _currentExcludedIds = (input.excludedIds as Set<string>) || undefined;
  const randomSalt = input.randomSalt ?? 0;
  // FIX 4: Use user-set times (fallback to defaults)
  let tBreakfast = input.wakeTime || '07:30';
  let tLunch = input.lunchTime || '12:30';
  let tDinner = input.dinnerTime || '19:00';
  const tBed = input.bedTime || '22:00';
  // Работа: если isWorkDay, сдвигаем обед в середину смены, ужин — через 30м после конца смены
  if (input.isWorkDay && Number.isFinite(input.workStartMin) && Number.isFinite(input.workEndMin)) {
    const ws = input.workStartMin as number, we = input.workEndMin as number;
    if (ws >= 0 && ws < 1440 && we >= 0 && we < 1440) {
      if (we > ws) {
        // Дневная смена: обед в середине, ужин через 30м после
        tLunch = fmtMin(Math.round((ws + we) / 2));
        tDinner = fmtMin((we + 30) % 1440);
      } else {
        // Ночная смена (we <= ws, через полночь): обед в середине смены с поправкой
        const midShift = (ws + (we + 1440)) / 2 % 1440;
        tLunch = fmtMin(Math.round(midShift));
        tDinner = fmtMin((we + 30) % 1440);
      }
    }
  }
  // Pre-sleep 30 min before bed
  // P2-fix: try/catch на time parsing — malformed tBed давал "NaN:NaN" в таймах
  let tPreSleep = (() => {
    try {
      const [h, m] = tBed.split(':').map(Number);
      if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return '21:30';
      const min = (h * 60 + m - 30 + 1440) % 1440;
      return String(Math.floor(min/60)).padStart(2,'0') + ':' + String(min%60).padStart(2,'0');
    } catch { return '21:30'; }
  })();
  // Д-14: pre-sleep only if there is a real gap (>=60 min) between dinner and bed, otherwise the
  // dinner already covers the night MPS window and a second protein meal is redundant.
  // P2-fix: комментарий исправлен с "150 min" на "60 min" — соответствует фактическому порогу в коде.
  const _dinnerToBedGap = (() => { try { const [dh, dm] = tDinner.split(':').map(Number); const [bh, bm] = tBed.split(':').map(Number); if (isNaN(dh) || isNaN(dm) || isNaN(bh) || isNaN(bm)) return 240; return ((bh * 60 + bm) - (dh * 60 + dm) + 1440) % 1440; } catch { return 240; } })();
  const wantPreSleep = input.mealsCount >= 3 && _dinnerToBedGap >= 60;
  // Snack time: midpoint between lunch and dinner
  // P2-fix: try/catch на time parsing
  let tSnack = (() => {
    try {
      const [lh, lm] = tLunch.split(':').map(Number);
      const [dh, dm] = tDinner.split(':').map(Number);
      if (isNaN(lh) || isNaN(lm) || isNaN(dh) || isNaN(dm)) return '15:30';
      const mid = Math.round(((lh*60+lm) + (dh*60+dm)) / 2);
      return String(Math.floor(mid/60)).padStart(2,'0') + ':' + String(mid%60).padStart(2,'0');
    } catch { return '15:30'; }
  })();
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

  const pool = (() => {
    // FIX week-perf: пулы продуктов идентичны для всех дней одной генерации (семена
    // перемешивания — константы, разнообразие дней даёт pickPriority по seedBase).
    // Кэш по сигнатуре входов избавляет от 7× полных сканов FOOD_DB (~1100 продуктов).
    try {
      const key = JSON.stringify([
        [...combinedExcluded].sort(), !!input.isVegetarian, input.budget, varietyPoolSize,
        [...(input.preferredIds || [])].sort(), [...(input.allergenTags || [])].sort(),
        input.specificity || null, input.categoryPref || null, input.intolerances || null,
        // FIX 2.3 (БАГ-14): пулы зависят от _qualityMode (basic фильтрует premium/exotic),
        // но quality не входил в сигнатуру кэша — смена full↔basic возвращала старые пулы.
        input.quality || 'full',
        // D-28: portableMode (еда на работе) — иначе кэш вернул бы не-портативные пулы.
        !!input.portableMode,
      ]);
      const cached = _poolCache.get(key);
      if (cached) return cached;
      const built = buildFoodPools(combinedExcluded, !!input.isVegetarian, input.budget, varietyPoolSize, input.preferredIds, { specificity: input.specificity, categoryPref: input.categoryPref, intolerances: input.intolerances, tasteProfile: input.tasteProfile, deprioritizedIds: input.deprioritizedIds, allergenTags: input.allergenTags, portableMode: input.portableMode });
      if (_poolCache.size >= 12) { const first = _poolCache.keys().next(); if (!first.done) _poolCache.delete(first.value); }
      _poolCache.set(key, built);
      return built;
    } catch {
      return buildFoodPools(combinedExcluded, !!input.isVegetarian, input.budget, varietyPoolSize, input.preferredIds, { specificity: input.specificity, categoryPref: input.categoryPref, intolerances: input.intolerances, tasteProfile: input.tasteProfile, deprioritizedIds: input.deprioritizedIds, allergenTags: input.allergenTags, portableMode: input.portableMode });
    }
  })();

  // P5: PCT food preference boost — крестоцветные (DIM/I3C) + zinc-rich + flax
  let effectivePreferred = combinedPreferred;
  if (input.cyclePhase === 'pct') {
    const pctFoodIds = ['broccoli','cabbage','kale','cauliflower','brussels_sprouts','beef_lean','beef_liver','oysters','pumpkin_seeds','flaxseed','salmon'];
    effectivePreferred = new Set([...combinedPreferred, ...pctFoodIds.filter(id => FOOD_DB.some(fd => fd.id === id))]);
  }
  const seedBase = ((input.dayOffset ?? 0) + randomSalt) * 10007 + (input.isTrainingDay ? 3000 : 7000);
  // P0-4: lock + set pickCtx (sync JS ensures non-reentrancy; cleanup in finally at the end of buildDayPlan).
  if (_pickCtx._locked) { try { console.warn('[meal-plan-engine] buildDayPlan reentrant call — prefs may leak between plans.'); } catch {} }
  _pickCtx._locked = true;
  _pickCtx.tasteProfile = input.tasteProfile;
  _pickCtx.deprioritizedIds = input.deprioritizedIds;
  _pickCtx.categoryPref = input.categoryPref;
  _tasteProfile = input.tasteProfile;
  _deprioritizedIds = input.deprioritizedIds;
  _categoryPref = input.categoryPref;
  // P0-4: тело функции под lock — освобождаем state в finally (sync JS гарантирует отсутствие reentrancy в отсутствии await).
  try {
  // Ротация: разные группы белка в разные приёмы (раньше — одна на весь день)
  const mealRotations = pickRotationsForDay(input.dayOffset, randomSalt, 4, !!input.isVegetarian);
  function rotationForMeal(mealIdx: number): { label: string; ids: string[]; note: string } {
    // Shift rotation by dayOffset so omega-3 fish lands on different meals each day
    const shift = Math.abs(input.dayOffset ?? 0) % mealRotations.length;
    return mealRotations[(mealIdx + shift) % mealRotations.length] || mealRotations[0];
  }
  const meals: Meal[] = [];
  // FIX favorite-breakfast: внутридневная свежесть любимых углеводов (завтрак получает
  // любимое первым, следующие приёмы — разнообразие)
  const dayUsedPreferredIds = new Set<string>();

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
  const trainWindow = input.isTrainingDay && input.trainStartMin != null;
  // Пери-тренировочные времена (относительно старта и ДЛИТЕЛЬНОСТИ сессии):
  //  - предтрен: за 90 мин до старта
  //  - интра: на 30-й минуте (середина/начало длинной сессии)
  //  - пост-трен: ЧЕРЕЗ 30 мин ПОСЛЕ окончания сессии (а не жёстко start+60, которое
  //    при сессии 90+ мин попадало ВНУТРЬ тренировки — баг распределения).
  const _sessionMin = input.trainDurationMin && input.trainDurationMin > 0 ? input.trainDurationMin : 60;
  const prewMin = trainWindow ? (input.trainStartMin || 0) - 90 : NaN;
  const postwMin = trainWindow ? (input.trainStartMin || 0) + _sessionMin + 30 : NaN;
  // Training-aware: ужин и другие приёмы (завтрак/обед/ужин/перекус/preSleep) не ставятся
  // во время тренировки ±60 мин (пери-приёмы pre/intra/post уже вокруг тренировки)
  if (trainWindow) {
    const trainStart = input.trainStartMin || 0;
    const trainEnd = trainStart + _sessionMin;
    const buffer = 60;
    const isConflict = (t: number) => {
      if (isNaN(t)) return false;
      if (trainEnd <= 1440) return t >= trainStart - buffer && t <= trainEnd + buffer;
      const endMod = trainEnd % 1440;
      return t >= trainStart - buffer || t <= endMod + buffer;
    };
    const shiftAway = (t: number) => {
      if (!isConflict(t)) return t;
      const after = (trainEnd + 90) % 1440;
      const before = (trainStart - 90 + 1440) % 1440;
      return t < trainStart ? before : after;
    };
    const fmtM = (m: number) => String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0');
    const adjustStr = (s: string) => {
      const mm = timeStrToMinutes(s);
      if (mm === null || !isConflict(mm)) return s;
      return fmtM(shiftAway(mm));
    };
    tBreakfast = adjustStr(tBreakfast);
    tLunch = adjustStr(tLunch);
    tDinner = adjustStr(tDinner);
    tPreSleep = adjustStr(tPreSleep);
    tSnack = adjustStr(tSnack);
  }
  // Carb periodization: тренировка → 25% pre+30% post+15% lunch; отдых → 30/30/20
  // planType теперь только фильтр пулов (не множитель КБЖУ) — карточка = план; labAdj остаётся
  const labC = labAdj.macroAdjustments.carbMult || 1.0;
  const labF = labAdj.macroAdjustments.fatMult || 1.0;
  const labP = labAdj.macroAdjustments.proteinMult || 1.0;
  const adjustedCarbsG = Math.round(input.goalCarbsG * labC);
  const adjustedFatG = Math.round(input.goalFatG * labF);
  const adjustedProteinG = Math.round(input.goalProteinG * labP);
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
  // D-28+ fix (вопрос «120 кг на курсе → 900 г углеводов — много?»): физиологический ПОТОЛОК
  // углеводов 8 г/кг/день. Это верхняя граница даже для профессионалов в межсезонье с инсулином
  // (сверх неё нет доказанного анаболического эффекта, только жироотложение + гликемический риск).
  // Защищает от КУМУЛЯТИВНОГО стэка множителей: nutrLevel×1.5 × cycling/рефид × surplus — которые
  // иначе раздували цель до абсурда. Белок не трогаем (всегда приоритет).
  const _carbCeiling = Math.max(50, Math.round(input.weightKg * 8));
  const carbsTotal = Math.min(Math.max(impossibleGoal ? carbFloorG : _floorCarbG, adjustedCarbsG), _carbCeiling);
  // Д-2: Peri-workout carbs must SCALE with the daily carb budget (not hardcoded 40/60g),
  // D-24: mealsCount-aware carb distribution (weight-based, lunch = main meal).
  // Веса нормируются к 100% по приёмам, которые РЕАЛЬНО будут построены → нет
  // дефицита/перебора ни при каком mealsCount (3-8); обед — главный приём.
  // Жёсткие %-фиксации (раньше 20/21/14/20/25) ломались, когда mealsCount исключал
  // часть приёмов — углеводы «терялись» → недобор ~20%, а обед получался ~10%.
  const CARB_W: Record<string, number> = { breakfast: 1.0, lunch: 1.7, dinner: 0.7, prew: 1.0, postw: 1.2, snack: 0.5, snack2: 0.5, snack3: 0.4, snack4: 0.4, preSleep: 0.3, intra: 0.4 };
  const intraEligible = trainWindow && input.allowIntraWorkout && (input.trainDurationMin ?? 0) >= 75;
  // P0-фикс (Aug 22 2026): пери-тренировочные приёмы — ОТДЕЛЬНО от основных.
  // Раньше prew/postw/intra входили в общий лимит mealsCount и «съедали» слоты регулярных
  // приёмов (жалоба «тренировочные занимают половину, не хватает рекомендуемых»).
  // Теперь: mealsCount = количество ОСНОВНЫХ приёмов (завтрак/обед/ужин/перекусы/pre-sleep),
  // а prew/postw/intra добавляются СВЕРХ лимита.
  const _regularBuilt: string[] = ['breakfast','lunch','dinner'];
  if (wantPreSleep) _regularBuilt.push('preSleep');
  // Перекусы — по количеству ОСНОВНЫХ приёмов (независимо от трен-дня, иначе трен съедал перекус).
  if (input.mealsCount >= 4) _regularBuilt.push('snack');
  if (input.mealsCount >= 5) _regularBuilt.push('snack2');
  if (input.mealsCount >= 7) _regularBuilt.push('snack3');
  if (input.mealsCount >= 8) _regularBuilt.push('snack4');
  const _periBuilt: string[] = [];
  if (trainWindow) _periBuilt.push('prew', 'postw');
  if (intraEligible) _periBuilt.push('intra');
  // Кэп только для основных; пери — всегда сверху.
  let _regular = [..._regularBuilt];
  for (const r of ['snack4','snack3','snack2','preSleep','snack']) { if (_regular.length <= input.mealsCount) break; _regular = _regular.filter(x => x !== r); }
  if (_regular.length > input.mealsCount) _regular = _regular.slice(0, Math.max(3, input.mealsCount));
  const _roles = [..._regular, ..._periBuilt];
  const _keep = new Set(_roles);
  // N3/E2-фикс: перекусы распределяем по САМЫМ БОЛЬШИМ разрывам между фикс-приёмами,
  // чтобы не было «6 часов между завтраком и обедом». Раньше snack и snack2 оба ложились
  // в промежуток обед→ужин, утро оставалось пустым.
  const _toMin2 = (t: string): number => { try { const [h, m] = (t || '00:00').split(':').map(Number); return (isNaN(h) || isNaN(m)) ? NaN : h * 60 + m; } catch { return NaN; } };
  const _fixedPts: number[] = [_toMin2(tBreakfast), _toMin2(tLunch), _toMin2(tDinner)];
  if (_keep.has('preSleep') && wantPreSleep) _fixedPts.push(_toMin2(tPreSleep));
  if (trainWindow && _keep.has('prew')) _fixedPts.push(prewMin);
  if (trainWindow && _keep.has('postw')) _fixedPts.push(postwMin);
  if (intraEligible && _keep.has('intra')) _fixedPts.push((input.trainStartMin || 0) + 30);
  const _snackOrder = ['snack', 'snack2', 'snack3', 'snack4'];
  const _keptSnacks = _snackOrder.filter(r => _keep.has(r));
  const _snackTimes = gapFillTimes(_fixedPts, _keptSnacks.length);
  const _snackTimeOf = (role: string): string => {
    const i = _keptSnacks.indexOf(role);
    return i >= 0 && i < _snackTimes.length ? fmtMin(_snackTimes[i]) : tSnack;
  };
  // FIX 2.2 (БАГ-10): preSleep резервировал углеводную долю 0.3 в _wSum, но никогда её не отдавал
  // (buildPreSleep целенаправленно 0-углеводный — казеин). Доля «терялась», сжимая остальные приёмы.
  // Теперь preSleep не участвует в распределении углеводов вовсе.
  // D-28: «загрузка под утреннюю тренировку» — активна только при утренней сессии (старт до 14:00).
  // Вечер получает много углеводов (гликоген к утренней тренировке), завтрак — легче.
  const morningTrainLoad = !!(input.morningTrainLoad && input.isTrainingDay && input.trainStartMin !== undefined && input.trainStartMin < 14 * 60);
  const _wOf = (r: string): number => {
    if (r === 'preSleep') return 0;
    let v = CARB_W[r] ?? 0.5;
    if (r === 'dinner' && input.eveningLowCarb) v *= 0.5;
    if (morningTrainLoad) {
      if (r === 'dinner') v *= 2.0;      // вечер: много углеводов (сохраняет eveningLowCarb если был)
      if (r === 'breakfast') v *= 0.5; // утро: меньше (сессия уже завтра)
      if (r === 'postw') v *= 1.5;          // сразу после утренней сессии — загрузка
    }
    // eveningLowCarb «снижаем ужин, повышаем обед» — после всех модификаторов
    // размазывать освобождённые 0.35 по всем нельзя, бустим обед на +20% когда eveningLowCarb
    if (input.eveningLowCarb && r === 'lunch') v *= 1.2;
    return v;
  };
  const _wSum = _roles.reduce((s, r) => s + _wOf(r), 0) || 1;
  const _carbForRaw = (r: string): number => _keep.has(r) ? Math.round(carbsTotal * _wOf(r) / _wSum) : 0;
  // P2: reconcile rounding — сумма _carbForRaw может отличаться от carbsTotal на ±3-6г
  const _carbFor = (() => {
    const vals: Record<string, number> = {};
    let sum = 0;
    for (const r of _roles) { vals[r] = _carbForRaw(r); sum += vals[r]; }
    const diff = carbsTotal - sum;
    if (diff !== 0 && _roles.length > 0) {
      const last = _roles[_roles.length - 1];
      vals[last] = Math.max(0, vals[last] + diff);
    }
    return (r: string) => vals[r] ?? 0;
  })();
  const breakC = _carbFor('breakfast');
  const lunchC = _carbFor('lunch');
  const dinnerC = _carbFor('dinner');
  const prewCarbG = _carbFor('prew');
  const postwCarbG = _carbFor('postw');
  const snackC = _carbFor('snack');
  const snack2C = _carbFor('snack2');
  const snack3C = _carbFor('snack3');
  const snack4C = _carbFor('snack4');
  const fatTotal = Math.max(fatFloorG, adjustedFatG || input.goalFatG);

  // Snack on non-training days to fill MPS gap (lunch 12:30 → dinner 19:00 = 6.5h)
  // P2-fix: бюджет перекуса сразу 25г (mTOR порог), а не 15г с добивкой сывороткой — тогда usedP/residualP корректны
  const snackP = Math.max(25, Math.round(mpsPerMeal * 0.6));
  const snackF = Math.round(fatTotal * 0.10);
  const hasSnack = _keep.has('snack');

  // fat distribution учитывает pre-sleep (~8г жира) — снижаем долю ужина.
  const preSleepFatG = (_keep.has('preSleep') && wantPreSleep) ? 8 : 0;
  // #5 Менструальный low-GI: в лютеиновую/менструацию строго низкий GI (≤50).
  // P2-fix: не мутируем pool.carbSlow напрямую (влияет на завтрак и другие приёмы), используем копию
  if (input.carbGiPref === 'low' && pool.carbSlow.length > 0) {
    const _strictLowGi = pool.carbSlow.filter((f: FoodItem) => (f.gi || 0) <= 50);
    if (_strictLowGi.length >= 3) pool.carbSlow = [..._strictLowGi];
  }
  // ИНВАРИАНТ БЕЛКА — равномерно от веса: protein = weightKg * gPerKg → делится ПОРОВНУ по основным приёмам
  // (peri pre/post — фиксированные 25/35 как часть общего пула, остаток делится поровну по regular)
  const regularCount = _regular.length;
  const periProteinFixed = trainWindow ? (PREW_PROTEIN_G + POSTW_FAST_PROTEIN_G) : 0;
  const evenRegularP = (() => {
    if (regularCount === 0) return 0;
    if (trainWindow) {
      const rem = Math.max(0, (adjustedProteinG || input.goalProteinG) - periProteinFixed);
      return Math.max(20, Math.round(rem / regularCount));
    }
    return Math.max(20, Math.round((adjustedProteinG || input.goalProteinG) / Math.max(1, regularCount)));
  })();
  const mealBudget = {
    breakfast: { p: evenRegularP, c: breakC, f: Math.round(fatTotal * 0.20) },
    lunch: { p: evenRegularP, c: lunchC, f: Math.round(fatTotal * 0.15) },
    // D-28: при «загрузке под утреннюю тренировку» ужин — минимум жиров (≤8 г), много углеводов.
    dinner: { p: evenRegularP, c: dinnerC, f: morningTrainLoad ? Math.min(8, Math.round(fatTotal * 0.08)) : Math.max(8, Math.round(fatTotal * 0.22) - preSleepFatG) },
    prew: (_keep.has('prew') && trainWindow) ? { p: PREW_PROTEIN_G, c: prewCarbG, f: PREW_FAT_MAX_G } : null,
    postw: (_keep.has('postw') && trainWindow) ? { p: POSTW_FAST_PROTEIN_G, c: postwCarbG, f: 0 } : null,
    snack: _keep.has('snack') ? { p: evenRegularP, c: snackC, f: snackF } : null,
    snack2: _keep.has('snack2') ? { p: evenRegularP, c: snack2C, f: snackF } : null,
    snack3: _keep.has('snack3') ? { p: evenRegularP, c: snack3C, f: snackF } : null,
    snack4: _keep.has('snack4') ? { p: evenRegularP, c: snack4C, f: snackF } : null,
  };
  // preSleep — также равномерно (как часть regular), но если wantPreSleep — он уже в evenRegularP; коррекция не нужна
  if (_keep.has('preSleep') && wantPreSleep) {
    // preSleep уже получил evenRegularP как часть regular; если он 0 из-за peri вычета — гарантируем минимум 20г
    (mealBudget as any).preSleep = { p: evenRegularP, c: 0, f: preSleepFatG };
  }

  const usedP = mealBudget.breakfast.p + mealBudget.lunch.p + mealBudget.dinner.p + (mealBudget.prew?.p || 0) + (mealBudget.postw?.p || 0) + (mealBudget.snack?.p || 0) + (mealBudget.snack2?.p || 0) + (mealBudget.snack3?.p || 0) + (mealBudget.snack4?.p || 0) + ((mealBudget as any).preSleep?.p || 0);
  const goalProteinTarget = adjustedProteinG || input.goalProteinG;
  let residualP = usedP >= goalProteinTarget ? 0 : Math.max(20, goalProteinTarget - usedP);
  // Если pre-sleep исключён (мало приёмов) — остаток белка распределяется между
  // завтраком и обедом 50/50, чтобы не превышать MPS-потолок ~40г за один приём.
  // Раньше весь residualP сливался в обед, что давало 60-80г белка за один приём.
  if (!_keep.has('preSleep') && residualP > 0) {
    const halfP = Math.round(residualP / 2);
    mealBudget.breakfast.p += halfP;
    mealBudget.lunch.p += residualP - halfP;
    residualP = 0;
  }

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
    `Белок равномерно: ${evenRegularP}г/приём (всего ${adjustedProteinG}г / ${_regular.length} основных${trainWindow ? ` + ${periProteinFixed}г peri` : ''} = ${adjustedProteinG}г, per100 invariant)`,
    `MPS: ≥25г + лейцин 2.5г/приём, интервал 3–5 ч`,
  );

  // 1. Завтрак — белок + медленные углеводы + жиры + ягоды ─────────────
  const breakfastRot = rotationForMeal(0);
  // N7: завтрак-шаблон (детерминированный состав).
  const _bfTmpl = (input.breakfastTemplate && input.breakfastTemplate !== 'auto')
    ? BREAKFAST_TEMPLATES.find(t => t.id === input.breakfastTemplate)
    : null;
  const _dairyExcluded = combinedExcluded.has('milk') || combinedExcluded.has('kefir') ||
    (input.allergenTags ? [...input.allergenTags].some(t => t === 'dairy' || t === 'молочные' || t === 'лактоза') : false);
  // П.3 (диетология): если задан шаблон — завтрак строится ИЗ шаблона (полноценный состав),
  // а не пуловым подбором, который затем «дополнялся» шаблоном (было два углевода/«всё подряд»).
  // Кокосовое масло/семена (по выбору) применяем поверх шаблона, как и в пуловом пути.
  let breakfast: Meal;
  if (_bfTmpl) {
    const _tmplTargetKcal = mealBudget.breakfast ? mealBudget.breakfast.p * 4 + mealBudget.breakfast.c * 4 + mealBudget.breakfast.f * 9 : undefined;
    breakfast = buildBreakfastFromTemplate(_bfTmpl, tBreakfast, combinedExcluded, input.allergenTags, _tmplTargetKcal);
    const _extraSeed = FOOD_DB.find(f => f.id === 'chia_seeds' && !combinedExcluded.has(f.id))
      || FOOD_DB.find(f => f.id === 'flaxseed' && !combinedExcluded.has(f.id));
    if (input.coconutOilBoost) {
      const _co = FOOD_DB.find(f => f.id === 'coconut_oil' && !combinedExcluded.has(f.id));
      if (_co && !breakfast.items.some(it => it.id === 'coconut_oil')) breakfast.items.push(makeItem(_co, 10, 'fat'));
    }
    if (_extraSeed && !breakfast.items.some(it => it.id === _extraSeed.id)) breakfast.items.push(makeItem(_extraSeed, 10, 'fat'));
    breakfast.totals = breakfast.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + (it.fiber || 0), leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
  } else {
  // E8: молоко к завтраку и кокосовое масло (по выбору пользователя, с учётом исключений).
  const _breakfastExtras: { food: FoodItem; grams: number; role?: MealItem['role'] }[] = [];
  if (input.addMilkToBreakfast && !_dairyExcluded) {
    const _milk = FOOD_DB.find(f => f.id === 'milk' && !combinedExcluded.has(f.id));
    if (_milk) _breakfastExtras.push({ food: _milk, grams: 200, role: 'liquid' });
  }
  if (input.coconutOilBoost) {
    const _co = FOOD_DB.find(f => f.id === 'coconut_oil' && !combinedExcluded.has(f.id));
    if (_co) _breakfastExtras.push({ food: _co, grams: 10, role: 'fat' });
  }
  // D-28 П10: омега-3 семена (чиа/льняное) в завтрак — небольшой ALA-буст к утреннему приёму
  // (жирорастворимые + клетчатка), с учётом исключений пользователя.
  const _seed = FOOD_DB.find(f => f.id === 'chia_seeds' && !combinedExcluded.has(f.id))
    || FOOD_DB.find(f => f.id === 'flaxseed' && !combinedExcluded.has(f.id));
  if (_seed) _breakfastExtras.push({ food: _seed, grams: 10, role: 'fat' });
  breakfast = buildWholeMeal({
    label: 'Завтрак', time: tBreakfast, type: 'breakfast', refeedDay: input.refeedDay, fiberCapG: input.fiberCapG,
    mealPreferredIds: input.preferredByMeal?.['Завтрак'],
    preferredByMealFull: input.preferredByMeal,
    proteinG: mealBudget.breakfast.p,
    carbG: mealBudget.breakfast.c,
    fatG: mealBudget.breakfast.f,
    pool, proteinRotationIds: breakfastRot.ids, seed: seedBase + 1,
    // D-28 П10: овощи НЕ на завтраке (маркер обеда/ужина); завтрак = белок + медленные
    // углеводы + ягоды/фрукт + жиры. Раньше includeVeg>=5 добавлял брокколи в завтрак.
    includeVeg: false, includeFruit: true, breakfast: true, breakfastStyle: input.breakfastStyle,
    extraLiquids: _breakfastExtras.length > 0 ? _breakfastExtras : undefined,
    preferredIds: effectivePreferred, dayUsedPreferredIds,
    lockedIds: input.lockedIds, recentIds: effRecentIds(), hardRecentIds: effHardRecentIds,
    rationales: [
      `Завтрак: белок (${breakfastRot.label}) + медленные углеводы (овсяная основа) + ягоды + жиры`,
      'MPS-запуск после ночного голода: яйца/творог/сыворотка — лейцин ≥2.5 г',
      'Овсянка — низкий ГИ + бета-глюкан: стабильная глюкоза и сытость до обеда',
      'Ягоды — антоцианы, защита от свободных радикалов',
      _seed ? `Семена (${_seed.name}) — омега-3 ALA + клетчатка` : '',
    ].filter(Boolean),
    isWorkDay: input.isWorkDay, workStartMin: input.workStartMin, workEndMin: input.workEndMin, portableMode: input.portableMode,
  });
  }
  meals.push(breakfast);
  markUsed(breakfast);

  // 2. Обед — основной цельный приём ─────────────────────────────────────
  const lunchRot = rotationForMeal(1);
 
  const lunch = buildWholeMeal({
    label: 'Обед', time: tLunch, type: 'lunch', refeedDay: input.refeedDay, fiberCapG: input.fiberCapG,
    mealPreferredIds: input.preferredByMeal?.['Обед'],
    preferredByMealFull: input.preferredByMeal,
    proteinG: mealBudget.lunch.p,
    carbG: mealBudget.lunch.c,
    fatG: mealBudget.lunch.f,
    pool, proteinRotationIds: lunchRot.ids, seed: seedBase + 2,
    includeVeg: true, includeFruit: false,
    preferredIds: effectivePreferred, dayUsedPreferredIds,
    lockedIds: input.lockedIds, recentIds: effRecentIds(), hardRecentIds: effHardRecentIds,
    vegColorIdx: (input.dayOffset ?? 0), // lunch: green day 0, red day 1, orange day 2...
    rationales: [
      `Обед: цельная пища (${lunchRot.label} + злак + овощи + жиры)`,
      'Поддержание MPS — четверть суточного белка',
    ],
    isWorkDay: input.isWorkDay, workStartMin: input.workStartMin, workEndMin: input.workEndMin, portableMode: input.portableMode,
  });
  meals.push(lunch);
  markUsed(lunch);

  // P1.4: 2b. Snack 15:00 — нетренировочный день (MPS gap fill)
  if (hasSnack && mealBudget.snack) {
    const snackRot = rotationForMeal(3);
    const snack = buildWholeMeal({
      label: 'Полдник', time: _snackTimeOf('snack'), type: 'snack', refeedDay: input.refeedDay, fiberCapG: input.fiberCapG,
      mealPreferredIds: input.preferredByMeal?.['Полдник'],
    preferredByMealFull: input.preferredByMeal,
    proteinG: mealBudget.snack.p,
      carbG: mealBudget.snack.c,
      fatG: mealBudget.snack.f,
      snack: true,
      pool, proteinRotationIds: snackRot.ids, seed: seedBase + 8,
      includeVeg: false, includeFruit: true,
      preferredIds: effectivePreferred, dayUsedPreferredIds,
      lockedIds: input.lockedIds, recentIds: effRecentIds(), hardRecentIds: effHardRecentIds,
      rationales: [
        `Полдник: лёгкий белок (${snackRot.label}) + фрукт — поддержание MPS (интервал 3ч от обеда)`,
        'Заполняет окно 6.5ч между обедом и ужином — предотвращает катаболизм',
      ],
      isWorkDay: input.isWorkDay, workStartMin: input.workStartMin, workEndMin: input.workEndMin, portableMode: input.portableMode,
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
      label: 'Перекус', time: _snackTimeOf('snack2'), type: 'snack2', refeedDay: input.refeedDay, fiberCapG: input.fiberCapG,
      mealPreferredIds: input.preferredByMeal?.['Перекус'],
    preferredByMealFull: input.preferredByMeal,
    proteinG: mealBudget.snack2.p, carbG: mealBudget.snack2.c, fatG: mealBudget.snack2.f,
      pool, proteinRotationIds: snack2Rot.ids, seed: seedBase + 13,
      includeVeg: false, includeFruit: true, snack: true,
      preferredIds: effectivePreferred, dayUsedPreferredIds, lockedIds: input.lockedIds, recentIds: effRecentIds(), hardRecentIds: effHardRecentIds,
      rationales: ['Второй перекус: поддержка MPS + углеводное окно при большом числе приёмов'],
      isWorkDay: input.isWorkDay, workStartMin: input.workStartMin, workEndMin: input.workEndMin, portableMode: input.portableMode,
    });
    meals.push(snack2); markUsed(snack2);
  }

  // E6: третий/четвёртый перекус (для 8-10 приёмов) — в оставшиеся самые большие разрывы.
  {
    const _slots: { label: string; type: 'snack3' | 'snack4'; seed: number }[] = [
      { label: 'Перекус', type: 'snack3', seed: seedBase + 27 },
      { label: 'Перекус', type: 'snack4', seed: seedBase + 31 },
    ];
    for (const s of _slots) {
      const mb = mealBudget[s.type];
      if (_keep.has(s.type) && mb) {
        const rot = rotationForMeal(s.type === 'snack3' ? 6 : 7);
        const m = buildWholeMeal({
          label: s.label, time: _snackTimeOf(s.type), type: s.type, refeedDay: input.refeedDay, fiberCapG: input.fiberCapG,
          mealPreferredIds: input.preferredByMeal?.[s.label],
          preferredByMealFull: input.preferredByMeal,
          proteinG: mb.p, carbG: mb.c, fatG: mb.f,
          pool, proteinRotationIds: rot.ids, seed: s.seed,
          includeVeg: false, includeFruit: true, snack: true,
          preferredIds: effectivePreferred, dayUsedPreferredIds, lockedIds: input.lockedIds, recentIds: effRecentIds(), hardRecentIds: effHardRecentIds,
          rationales: [`${s.label}: поддержка MPS при большом числе приёмов (равномерное распределение белка)`],
          isWorkDay: input.isWorkDay, workStartMin: input.workStartMin, workEndMin: input.workEndMin, portableMode: input.portableMode,
        });
        meals.push(m); markUsed(m);
      }
    }
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
    const intra = buildIntraWorkout(intraTime, seedBase + 4, pool, _carbFor('intra'));
    meals.push(intra);
    notes.push(`Intra-workout: EAA + циклодекстрин (${_carbFor('intra')} г — доля от дневного КБЖУ, поддержание глюкозы на длинной тренировке)`);
  }

  // 5. Post-workout (через 30 мин после окончания сессии) ─────────────
  if (trainWindow && mealBudget.postw && input.trainStartMin) {
    const postTime = fmtMin(postwMin);
    const postw = buildPostWorkout(postTime, 'Пост-трен', seedBase + 5, pool, effectivePreferred, { lockedIds: input.lockedIds, recentIds: effRecentIds(), hardRecentIds: effHardRecentIds }, postwCarbG);
    meals.push(postw);
    markUsed(postw);
    notes.push(`Post-workout: сыворотка + быстрые углеводы через 30 мин после окончания тренировки (${_sessionMin} мин) — анаболическое окно`);
  }

  // 6. Ужин — основная порция жиров и белковый ротационный ─────────────
  const dinnerRot = rotationForMeal(2);
  const dinner = buildWholeMeal({
    label: 'Ужин', time: tDinner, type: 'dinner', refeedDay: input.refeedDay, fiberCapG: input.fiberCapG,
    mealPreferredIds: input.preferredByMeal?.['Ужин'],
    preferredByMealFull: input.preferredByMeal,
    proteinG: mealBudget.dinner.p,
    carbG: mealBudget.dinner.c,
    fatG: mealBudget.dinner.f,
    pool, proteinRotationIds: dinnerRot.ids, seed: seedBase + 6,
    includeVeg: true, includeFruit: false,
    preferredIds: effectivePreferred, dayUsedPreferredIds,
    lockedIds: input.lockedIds, recentIds: effRecentIds(), hardRecentIds: effHardRecentIds,
    vegColorIdx: (input.dayOffset ?? 0) + 2, // dinner: different color than lunch
    rationales: [
      `Ужин: ${dinnerRot.label} + 30% жиров — медленная абсорбция на ночь`,
      'Поддержание MPS — обязательный приём после 4–5 ч без белка',
      'Овощи — клетчатка + витамины K/C + фитонутриенты',
    ],
    isWorkDay: input.isWorkDay, workStartMin: input.workStartMin, workEndMin: input.workEndMin, portableMode: input.portableMode,
  });
  meals.push(dinner);
  markUsed(dinner);

  // 7. Pre-sleep — казеин + Mg + мелатонин — равномерно (evenRegularP), не 0.7*mps
  const preSleepSeed = seedBase + 7 + randomSalt * 13;
  const preSleep = (_keep.has('preSleep') && wantPreSleep && Math.max(residualP, evenRegularP) > 10) ? buildPreSleep(tPreSleep, preSleepSeed, pool, Math.max(residualP, evenRegularP), { lockedIds: input.lockedIds, recentIds: effRecentIds(), hardRecentIds: effHardRecentIds, preferredIds: effectivePreferred, excludedIds: combinedExcluded, allergenTags: input.allergenTags }) : null;
  if (preSleep) { meals.push(preSleep); markUsed(preSleep); notes.push('Pre-sleep: казеин + Mg + мелатонин-источник для ночного восстановления'); }

  // ─── Этап 4: синхронизация приёмов с инъекциями (инсулин/ГР/ИГФ) ─────
  // Раньше привязка к уколу была только в классическом fallback-пути (Context.buildDay).
  // Здесь она реализована в активном V2-движке (БАГ-15/16).
  const _injList = input.injections || [];
  const _toMinOf = (t?: string): number | null => {
    if (!t) return null;
    const [h, m] = t.split(':').map(Number);
    return (!isNaN(h) && !isNaN(m)) ? h * 60 + m : null;
  };
  const _hasMealNear = (min: number, tol = 30): boolean => meals.some(m => {
    const mt = _toMinOf(m.time); return mt !== null && Math.abs(mt - min) <= tol;
  });
  const _injectMealAt = (min: number, label: string, note: string, carbG = 40, proteinG = 25): void => {
    const t = fmtTime(min);
    // Малый белково-углеводный приём (лёгкий, без жиров) — для сопровождения укола.
    // D-28+ fix (жалоба «инсулин и на тренировке так мало углеводов»): порция углеводов
    // теперь дозируется (carbG), а не жёстко 40 г — для инсулина она считается от дозы (~10 г/1 ЕД).
    const source = pool.fastProtein[0] || pool.proteinSolid[0];
    const carb = pool.carbFast[0] || pool.carbSlow[0];
    const items: MealItem[] = [];
    if (source) items.push(makeItem(source, proteinG, 'fast_protein'));
    if (carb) items.push(makeItem(carb, carbG, 'carb_fast'));
    if (items.length === 0) return;
    const totals = items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
    meals.push({ label, time: t, items, totals, type: 'snack', target: { p: proteinG, c: carbG, f: 0 }, rationale: [note], mpsCheck: { proteinG: totals.p, leucineG: Math.round(totals.leucine_mg) / 1000, triggers_mTOR: totals.leucine_mg >= 2500 && totals.p >= 25 } });
    notes.push(note);
  };

  // 4a. Инсулин: быстрые углеводы в окне укола (правило ~10 г на 1 ЕД; жиры минимум).
  // D-28+ fix: углеводы под инсулин масштабируются от ДОЗЫ (≈10 г/1 ЕД), а не фикс. 40 г.
  // Короткий/ультракороткий инсулин в пик (обычно перед едой/тренировкой) требует больше быстрых
  // углеводов, чем базальный фон, — плоский 40 г не обеспечивал гликемическую безопасность.
  const _insulinInjs = _injList.filter(i => (i.type || '').toLowerCase().includes('инсулин'));
  for (const inj of _insulinInjs) {
    const injMin = _toMinOf(inj.time) ?? (inj.esterType === 'long' ? 22 * 60 : 8 * 60);
    if (!_hasMealNear(injMin)) {
      const isBolus = inj.esterType !== 'long';
      const dose = Number(inj.dose) || (isBolus ? 8 : 10);
      // ~10 г быстрых углеводов на 1 ЕД болюсного инсулина; кап 120 г на один приём (безопасность).
      const carbG = Math.max(30, Math.min(120, Math.round(dose * 10)));
      const label = `⚡ Углеводы под инсулин (${inj.name || 'инсулин'})`;
      _injectMealAt(injMin, label, `${label} — быстрые углеводы ${carbG} г при уколе ${dose} ЕД (≈10 г/1 ЕД, без жиров для скорости всасывания)`, carbG);
    }
  }

  // 4b. ИГФ-1: приём вокруг тренировки (по trainTiming) — белок + быстрые углеводы.
  const _igfInjs = _injList.filter(i => (i.type || '').includes('ИФР') || (i.type || '').includes('IGF'));
  if (_igfInjs.length > 0 && input.trainStartMin) {
    const t0 = _igfInjs[0];
    const wantBefore = t0.trainTiming !== 'after' && t0.trainTiming !== 'none';
    const wantAfter = t0.trainTiming === 'after' || t0.trainTiming === 'both';
    if (wantBefore && !_hasMealNear(input.trainStartMin - 45, 30)) {
      const min = input.trainStartMin - 45;
      _injectMealAt(min, '⚡ ИГФ-1 до тренировки (белок+декстроза)', 'ИГФ-1 до трены — изолят + быстрые углеводы (потенцирует анаболическое окно)');
    }
    if (wantAfter && !_hasMealNear(input.trainStartMin + 60, 30)) {
      const min = input.trainStartMin + 60;
      _injectMealAt(min, '⚡ ИГФ-1 после тренировки (белок+декстроза)', 'ИГФ-1 после трены — изолят + быстрые углеводы (анаболическое окно)');
    }
  }

  // 4c. ГР: вечерний/ночной приём (белок + минимум жиров) — не конфликтует с пре-сном.
  const _ghInjs = _injList.filter(i => (i.type || '') === 'ГР' || (i.type || '').includes('GHRP') || (i.type || '').includes('CJC') || (i.type || '').includes('sermorelin'));
  if (_ghInjs.length > 0) {
    const ghMin = _toMinOf(_ghInjs[0].time) ?? 22 * 60;
    if (!_hasMealNear(ghMin, 40)) {
      // Если укол в окне пре-сна — пре-сн приём уже есть (казенн), не дублируем.
      const _preSleepMin = _toMinOf(tPreSleep);
      if (!(_preSleepMin !== null && Math.abs(_preSleepMin - ghMin) <= 40)) {
        _injectMealAt(ghMin, '🌙 ГР: белковый приём на ночь', 'ГР (соматотропин) на ночь — белок без жиров для пика секреции и ночного восстановления');
      }
    }
  }

  // Sort meals by time (chronological order)
  meals.sort((a, b) => {
    const toMin = (t: string) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m; };
    return toMin(a.time) - toMin(b.time);
  });

  // ─── E4: предупреждение перегрузки приёма + предложение увеличить приёмы ──
  // Если крупяная порция приёма упёрлась в кап (280/350 г), а углеводная цель дня
  // не достигнута — «некуда впихнуть продукты». Подсказываем увеличить число приёмов.
  {
    const toMin = (t: string) => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + m; };
    const overloaded = meals.filter(m => m.items.some(it => {
      if (it.role !== 'carb_slow') return false;
      const food = FOOD_DB.find(f => f.id === it.id);
      if (!food) return (it.amount || 0) >= maxGrainPerMeal(input.budget);
      const cap = carbPortionCap(food);
      return (it.amount || 0) >= cap - 1;
    }));
    if (overloaded.length > 0) {
      const grainCap = maxGrainPerMeal(input.budget);
      const names = overloaded.map(m => m.label).join(', ');
      notes.push(`⚠ Перегрузка приёма: в «${names}» порция каши/крупы упёрлась в лимит ${grainCap} г. Углеводы дня не добиваются — увеличьте число приёмов пищи (сейчас ${input.mealsCount}, минимум ${Math.min(6, input.mealsCount + 1)}), чтобы распределить нагрузку.`);
    }
    // E2 (spacing note): слишком большие или слишком малые интервалы между белковыми приёмами.
    const _times = meals.map(m => toMin(m.time)).filter((v): v is number => !isNaN(v)).sort((a, b) => a - b);
    if (_times.length >= 2) {
      let minGap = Infinity, maxGap = 0, maxGapFrom = '', maxGapTo = '';
      for (let i = 1; i < _times.length; i++) { const g = _times[i] - _times[i - 1]; if (g > 0) { if (g > maxGap) { maxGap = g; maxGapFrom = meals[_times.indexOf(_times[i - 1])]?.label || ''; maxGapTo = meals[_times.indexOf(_times[i])]?.label || ''; } minGap = Math.min(minGap, g); } }
      // D-28 fix (жалоба «6 часов между приёмами»): порог >5ч (5ч — верх MPS-окна 3–5ч,
      // штатный расклад завтрак→обед), имя промежутка добавлено.
      if (maxGap > 5 * 60) {
        notes.push(`⏱ Большой интервал ${Math.round(maxGap / 60)} ч между «${maxGapFrom}» и «${maxGapTo}» — белок распределён неравномерно. Увеличьте число приёмов (сейчас ${input.mealsCount}) или сдвиньте время обеда/ужина, чтобы интервалы были 3–5 ч.`);
      }
      if (minGap < 60 && minGap !== Infinity) {
        notes.push(`⏱ Приёмы слишком близко (<${Math.round(minGap)} мин) — разнесите их минимум на 2.5 ч, чтобы поддержать MPS-окно.`);
      }
    }
    // D-28 fix (жалоба «нет предупреждения о нехватке приёмов»): при <5 приёмах явно
    // предупреждаем, что КБЖУ распределяется неравномерно и белок не покрывает окна MPS.
    if (input.mealsCount < 5) {
      notes.push(`⚠ Мало приёмов пищи (${input.mealsCount}): КБЖУ распределяется неравномерно, крупные порции перегружают ЖКТ, белковые окна 3–5 ч не покрываются. Рекомендуется 5–6 приёмов (завтрак/обед/ужин + 2–3 перекуса).`);
    }
  }

  // Fix: полдник/перекус 0 У — гарантируем минимум 10г углеводов если цель >5г
  for (const m of meals) {
    if ((m.type === 'snack' || m.type === 'snack2' || m.type === 'snack3' || m.type === 'snack4') && m.target && (m.target.c || 0) > 5 && (m.totals.c || 0) < 5) {
      const fb = FOOD_DB.find(f => f.id === 'oats' || f.id === 'oats_dry') || pool.carbSlow[0] || pool.carbFast[0];
      if (fb && !m.items.some((it:any)=> it.id===fb.id)) {
        const grams = Math.min(carbPortionCap(fb), 30);
        const r = grams/100;
        const pN = Math.round((fb.protein||0)*r), fN = Math.round((fb.fat||0)*r), cN = Math.round((fb.carbs||0)*r);
        const it: MealItem = { id: fb.id, name: fb.name, amount: grams, role: 'carb_slow' as const, kcal: Math.round(4*pN+9*fN+4*cN), p: pN, f: fN, c: cN, fiber: Math.round((fb.fiber||0)*r), leucine_mg: Math.round(getLeucine(fb)*r) };
        m.items.push(it);
        m.totals = m.items.reduce((acc:any, it:any)=>({kcal:acc.kcal+it.kcal,p:acc.p+it.p,f:acc.f+it.f,c:acc.c+it.c,fiber:acc.fiber+(it.fiber||0),leucine_mg:acc.leucine_mg+(it.leucine_mg||0)}),{kcal:0,p:0,f:0,c:0,fiber:0,leucine_mg:0});
      }
    }
  }

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
  // Aug 28: добавка уважает аллергены/непереносимости/категории (раньше только excludedIds —
  // «лосось в обед» при аллергии на рыбу).
  {
    const _o3Allowed = (f: any): boolean => {
      if (!(input.excludedIds||new Set()).has(f.id)) { /* pass */ } else return false;
      const _ua: Set<string> = input.allergenTags || new Set<string>();
      const diet = FOOD_ALLERGEN_DIET[f.id];
      const tags = (diet && Array.isArray(diet.allergens)) ? diet.allergens : (f.allergens || []);
      if (_ua.size > 0 && [..._ua].some((t: string) => tags.includes(t))) return false;
      if (input.intolerances && !filterByIntolerance(f, input.intolerances)) return false;
      if (input.categoryPref && !matchesCategoryPref(f, input.categoryPref)) return false;
      return true;
    };
    const omega3Ids = new Set(['salmon','mackerel','sardines','red_fish','flaxseed','chia_seeds','walnuts']);
    const hasOmega3 = meals.some(m => m.items.some(it => omega3Ids.has(it.id)));
    if (!hasOmega3 && !input.isVegetarian) {
      const fish = FOOD_DB.find(f => (f.id === 'salmon' || f.id === 'mackerel') && _o3Allowed(f));
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
      const vegOmega = [f => f.id === 'flaxseed', f => f.id === 'chia_seeds', f => f.id === 'walnuts']
        .map(pred => FOOD_DB.find(f => pred(f) && _o3Allowed(f)))
        .find(Boolean);
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
          const newAmount = snapPortionG(food, Math.min(maxGramPerItem(_currentBudget, mealCapScaleOf(meal)), item.amount + addGrams));
          const factor = newAmount / (item.amount || 1);
          item.amount = newAmount; item.kcal = Math.round(item.kcal * factor); item.p = Math.round(item.p * factor); item.f = Math.round(item.f * factor); item.c = Math.round(item.c * factor); item.fiber = Math.round(item.fiber * factor); item.leucine_mg = Math.round((item.leucine_mg || 0) * factor);
        });
        meals.forEach(m => { m.totals = m.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 }); });
        // P2-fix: добавлены fiber и leucine_mg в day totals (были stale после fat scaling)
        totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.fiber = meals.reduce((s, m) => s + (m.totals.fiber||0), 0); totals.leucine_mg = meals.reduce((s, m) => s + (m.totals.leucine_mg||0), 0);
      }
    }
  }
  // P4: Protein overshoot correction — if protein >10% over goal, scale down protein items (preserve MPS min 25g/meal)
  {
    const goalP = adjustedProteinG || input.goalProteinG;
    const devP = (totals.p - goalP) / Math.max(1, goalP);
    if (devP > 0.10) {
      const excessP = totals.p - goalP;
      // D-28 fix (жалоба «мелкие порции 15-20 г в peri-workout»): сокращаем СНАЧАЛА
      // цельно-продуктовые белки (курица/рыба/творог), а не сыворотку pre/post/intra —
      // иначе коррекция ужимала whey_isolate до 9-10 г, ломая анаболическое окно.
      const allProteinItems = meals.flatMap(m => m.items.filter(it => it.role === 'protein' || it.role === 'fast_protein' || it.role === 'slow_protein').map(it => ({ meal: m, item: it })));
      const wholeItems = allProteinItems.filter(({ item }) => item.role === 'protein');
      const proteinItems = wholeItems.length > 0 ? wholeItems : allProteinItems;
      if (proteinItems.length > 0) {
        const reducePerItem = excessP / proteinItems.length;
        proteinItems.forEach(({ meal, item }) => {
          const food = FOOD_DB.find(f => f.id === item.id);
          if (!food || !food.protein) return;
          const reduceGrams = Math.round(reducePerItem / food.protein * 100);
          // Быстрый/медленный белок (сыворотка/казеин) не режем ниже 20 г — минимум MPS-порции.
          const floor = (item.role === 'fast_protein' || item.role === 'slow_protein') ? 20 : 10;
          const newAmount = snapPortionG(food, Math.max(floor, item.amount - reduceGrams));
          const factor = newAmount / (item.amount || 1);
          item.amount = newAmount;
          item.kcal = Math.round(item.kcal * factor); item.p = Math.round(item.p * factor); item.f = Math.round(item.f * factor); item.c = Math.round(item.c * factor); item.fiber = Math.round(item.fiber * factor); item.leucine_mg = Math.round((item.leucine_mg || 0) * factor);
        });
        meals.forEach(m => { m.totals = m.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 }); });
        // P2-fix: добавлены fiber и leucine_mg (были stale после protein scaling)
        totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0); totals.fiber = meals.reduce((s, m) => s + (m.totals.fiber||0), 0); totals.leucine_mg = meals.reduce((s, m) => s + (m.totals.leucine_mg||0), 0);
      }
    }
  }
  // P4-CARB: Carb overshoot correction — if carbs >10% over goal, scale down carb items.
  // FIX: раньше был только protein overshoot и fat deficit, но НЕ было carb overshoot —
  // в simple/minimal режиме движок генерировал +200г углеводов от цели без коррекции.
  {
    const goalC = carbsTotal;
    const devC = (totals.c - goalC) / Math.max(1, goalC);
    if (devC > 0.10) {
      const excessC = totals.c - goalC;
      const carbItems = meals.flatMap(m => m.items.filter(it => it.role === 'carb_slow' || it.role === 'carb_fast' || it.role === 'fruit').map(it => ({ meal: m, item: it })));
      if (carbItems.length > 0) {
        const reducePerItem = excessC / carbItems.length;
        carbItems.forEach(({ meal, item }) => {
          const food = FOOD_DB.find(f => f.id === item.id);
          if (!food || !food.carbs) return;
          const reduceGrams = Math.round(reducePerItem / food.carbs * 100);
          const floor = 10;
          const newAmount = snapPortionG(food, Math.max(floor, item.amount - reduceGrams));
          const factor = newAmount / (item.amount || 1);
          item.amount = newAmount; item.kcal = Math.round(item.kcal * factor); item.p = Math.round(item.p * factor); item.f = Math.round(item.f * factor); item.c = Math.round(item.c * factor); item.fiber = Math.round(item.fiber * factor); item.leucine_mg = Math.round((item.leucine_mg || 0) * factor);
        });
        meals.forEach(m => { m.totals = m.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 }); });
        totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0); totals.fiber = meals.reduce((s, m) => s + (m.totals.fiber||0), 0); totals.leucine_mg = meals.reduce((s, m) => s + (m.totals.leucine_mg||0), 0);
      }
    }
  }
  if (_qualityMode === 'full') notes.push(`Сводка MPS: ${feedings} feedings × ${mpsSummary.avg_protein_per_meal_g} г/meal, ${mpsSummary.avg_leucine_g} г лейцина (порог ${LEU_THRESHOLD_MG / 1000} г)`);
  notes.push(`Диверсификация: ${uniqueFoods} уникальных продуктов (${Object.keys(categories).length} категорий)`);
  if (input.refeedDay) notes.push('🔄 Refeed-день: быстрые/низкоклетчаточные углеводы, овощи легче — приоритет гликогеновому ре-синтезу (лептин/психологическая разгрузка)');
  if (morningTrainLoad) notes.push('🌅 Загрузка под утреннюю тренировку: вечером много углеводов, минимум жиров, умеренный белок — гликоген и энергия к утренней сессии.');
  if (input.isCutting) notes.push('Сушка: повышенная плотность белка, заниженные углеводы у ужина');
  if (_qualityMode === 'full' && mpsSummary.prePostWindow) notes.push('Pre/post-workout окно реализовано (полноценное анаболическое обеспечение тренировки)');
  // Fiber check
  const fiberG = Math.round(totals.fiber);
  const fiberTarget = input.sex === 'female' ? 25 : 35;
  // Этап 5/7: низкая клетчатка намеренна на рефид-дне или пик-дне с низким fiberMaxG
  // (освобождение места углеводам) — не предупреждаем.
  const _lightFiberIntent = !!input.refeedDay || (typeof input.fiberCapG === 'number' && input.fiberCapG < 35);
  if (!_lightFiberIntent && fiberG < fiberTarget * 0.7) {
    notes.push(`⚠ Клетчатка: ${fiberG}г / ${fiberTarget}г — добавьте овощи/цельнозерновые/ягоды (+${Math.round((fiberTarget - fiberG) / 3)}г порцию овощей)`);
  } else if (fiberG >= fiberTarget || _lightFiberIntent) {
    notes.push(`✅ Клетчатка: ${fiberG}г / ${fiberTarget}г${_lightFiberIntent ? ' (намеренно ниже — углеводы загрузки)' : ''}`);
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
          const newAmount = snapPortionG(food, Math.min(maxGramPerItem(_currentBudget, mealCapScaleOf(meal)), item.amount + addGrams));
          const factor = newAmount / (item.amount || 1);
          item.amount = newAmount; item.kcal = Math.round(item.kcal * factor); item.p = Math.round(item.p * factor); item.f = Math.round(item.f * factor); item.c = Math.round(item.c * factor); item.fiber = Math.round(item.fiber * factor); item.leucine_mg = Math.round((item.leucine_mg || 0) * factor);
        });
        meals.forEach(m => { m.totals = m.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 }); });
        // P2-fix: добавлены fiber и leucine_mg (были stale после iterative correction)
        totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0); totals.fiber = meals.reduce((s, m) => s + (m.totals.fiber||0), 0); totals.leucine_mg = meals.reduce((s, m) => s + (m.totals.leucine_mg||0), 0);
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
      // D-28 П10: белок pre-sleep не трогаем грубой коррекцией (его размер задаёт buildPreSleep ≤ ~45 г).
      const isProtein = roles.includes('protein') || roles.includes('fast_protein') || roles.includes('slow_protein');
      const items = meals.flatMap(m => m.items.filter(it => (roles.includes(it.role)) && !(isProtein && m.type === 'presleep')).map(item => ({ item, meal: m })));
      if (items.length === 0) return;
      const scale = Math.max(0.88, Math.min(1.12, 1 + dev * 0.65));
      items.forEach(({ item, meal }) => {
        const suppMin = SUPPLEMENT_MAX_G[item.id] ? 5 : floor;
        const rawNew = Math.round(item.amount * scale);
        // D-18: respect the realistic grain-portion ceiling when sizing carb items, so the
        // daily-macro correction loops can't inflate a 280g buckwheat bowl back to 365g+ to
        // close a carb deficit. A small total shortfall is preferable to an absurd portion.
        // Aug 28: капы масштабируются от цели приёма (mealCapScaleOf) — большие приёмы не режутся капом «среднего».
        const _ms = mealCapScaleOf(meal);
        let upCap = maxGramPerItem(_currentBudget, _ms);
        if (item.role === 'carb_slow' || item.role === 'carb_fast') {
          const fd = FOOD_DB.find(f => f.id === item.id);
          if (fd) upCap = carbPortionCap(fd, _ms);
        }
        // D-28+ fix (жалоба «500 г клюквы»): фрукт — это порция-«добавка», а не углеводный
        // носитель; коррекция макросов не должна раздувать его выше реалистичных 150 г.
        if (item.role === 'fruit') upCap = FRUIT_PORTION_CAP_G;
        // D-28+ fix: цельный белок (курица/рыба/творог) тоже не раздувается коррекцией за 300 г
        // на приём — иначе прецизионная подгонка давала «лосось 316 г». Aug 28: кап ×scale (до 1.25).
        if (item.role === 'protein') upCap = Math.min(upCap, Math.round(300 * Math.min(_ms, 1.25)));
        // FIX: snap к сетке ТОЛЬКО для порошков/добавок (сыворотка/казеин/креатин) —
        // 30г = 1 скуп, не 34г = 1.1 скупа. Для цельных продуктов snap ломает сходимость.
        const fd2 = FOOD_DB.find(f => f.id === item.id);
        const isPowder = fd2?.category === 'supplement';
        const newAmount = isPowder && fd2 ? snapPortionG(fd2, Math.max(suppMin, Math.min(upCap, rawNew))) : Math.max(suppMin, Math.min(upCap, rawNew));
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
      // D-28 П10: при ДОБАВЛЕНИИ белка НЕ раздуваем pre-sleep (его размер задаёт buildPreSleep,
      // казеин ≤ ~45 г, потолок MPS). При убавлении pre-sleep можно резать.
      const addPool = macro === 'protein' ? candidates.filter(c => c.meal.type !== 'presleep') : candidates;
      if (addPool.length === 0) return false;
      best = addPool.reduce((a, b) => {
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
    // Aug 28: капы точной подгонки — от цели приёма-хозяина item'а.
    const _bestMs = mealCapScaleOf(best.meal);
    let maxAmount = suppMax ?? maxGramPerItem(_currentBudget, _bestMs);
    // D-18: grain carb items are capped at maxGrainPerMeal even during precise
    // adjustment — don't push a single buckwheat/rice portion above a realistic bowl.
    if (!suppMax && (best.item.role === 'carb_slow' || best.item.role === 'carb_fast') && carbPortionCap(best.food, _bestMs) < maxAmount) {
      maxAmount = carbPortionCap(best.food, _bestMs);
    }
    // D-28+ fix (жалоба «500 г клюквы»): fruit-порции не раздуваются точной подгонкой.
    if (!suppMax && best.item.role === 'fruit') maxAmount = Math.min(maxAmount, FRUIT_PORTION_CAP_G);
    // D-28+ fix: цельный белок не раздувается за 300 г на приём (иначе «лосось 316 г»).
    if (!suppMax && best.item.role === 'protein') maxAmount = Math.min(maxAmount, Math.round(300 * Math.min(_bestMs, 1.25)));
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

  // P4b (Aug 28): ФИНАЛЬНАЯ белковая коррекция — после FINAL SNAP (см. ниже, перед посадкой).

  // D-23: активное закрытие дефицита микронутриентов (dietology: план должен быть
  // микронутриентно-адекватным, а не только диагностированным). Добавляем целевой
  // продукт для самого критичного дефицита (<60% RDA) в самый лёгкий приём, затем
  // пересчитываем макро-totals — kcal пересчитается блоком Atwater ниже.
  const microBoost = _qualityMode === 'full'
    ? activelyCloseTopDeficiency(meals, !!input.isVegetarian, input.sex || 'male', input.excludedIds || new Set(), { allergenTags: input.allergenTags, intolerances: input.intolerances, categoryPref: input.categoryPref })
    : { note: null };
  if (microBoost.note) {
    notes.push('🧬 ' + microBoost.note);
    totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0); totals.fiber = meals.reduce((s, m) => s + (m.totals.fiber||0), 0); totals.leucine_mg = meals.reduce((s, m) => s + (m.totals.leucine_mg||0), 0);
  }
  // D-28 П10: микро-добавка (напр. лосось 100 г = ~20 г белка) добавляется ПОСЛЕ preciseAdjust,
  // поэтому могла раздувать дневной белок за цель (жалоба «белок не распределён»). Если белок
  // перелетел цель >5% — ужимаем добавленный белковый «veg»-источник до соответствия.
  {
    const goalP2 = adjustedProteinG || input.goalProteinG;
    let devP2 = (totals.p - goalP2) / Math.max(1, goalP2);
    let guardVeg = 6;
    while (devP2 > 0.05 && guardVeg-- > 0) {
      const proteinVeg = meals.flatMap(m => m.items.map((it, i) => ({ m, it, i })).filter(x => x.it.role === 'veg' && (x.it.p || 0) >= 10));
      if (proteinVeg.length === 0) break;
      const excessP = totals.p - goalP2;
      const item = proteinVeg.sort((a, b) => (b.it.p || 0) - (a.it.p || 0))[0];
      const food = FOOD_DB.find(f => f.id === item.it.id);
      if (!food || !food.protein) break;
      const newAmount = Math.max(30, item.it.amount - Math.round(excessP / food.protein * 100));
      if (newAmount >= item.it.amount) break;
      const r = newAmount / (item.it.amount || 1);
      item.it.amount = newAmount; item.it.kcal = Math.round(item.it.kcal * r); item.it.p = Math.round(item.it.p * r); item.it.f = Math.round(item.it.f * r); item.it.c = Math.round(item.it.c * r); item.it.fiber = Math.round((item.it.fiber || 0) * r); item.it.leucine_mg = Math.round((item.it.leucine_mg || 0) * r);
      item.m.totals = item.m.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + (it.fiber || 0), leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
      totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0); totals.fiber = meals.reduce((s, m) => s + (m.totals.fiber || 0), 0); totals.leucine_mg = meals.reduce((s, m) => s + (m.totals.leucine_mg || 0), 0);
      devP2 = (totals.p - goalP2) / Math.max(1, goalP2);
    }
  }

  // ─── Atwater kcal: totals.kcal = P*4 + C*4 + F*9 (соответствует макросам) ───
  totals.kcal = Math.round(totals.p * 4 + totals.c * 4 + totals.f * 9);
  meals.forEach(m => { m.totals.kcal = Math.round(m.totals.p * 4 + m.totals.c * 4 + m.totals.f * 9); });
  const deficiencyClosure = _qualityMode === 'full'
    ? closeFoodDeficiencies(meals, !!input.isVegetarian, input.sex || 'male')
    : [];
  if (deficiencyClosure.length > 0) notes.push(...deficiencyClosure);
  // #1 Микронутриентный coverage: фазо-зависимые RDA + верхние пределы + structured summary.
  // Считаем ПОСЛЕ activelyCloseTopDeficiency (учитывает добавленный продукт).
  const _microItems = meals.flatMap(m => m.items.map(it => ({ id: it.id, amount: it.amount })));
  const _microRes = _qualityMode === 'full' ? analyzeMicroCoverage(
    sumMicros(_microItems, FOOD_DB as any),
    input.sex || 'male', input.weightKg, input.cyclePhase as any, !!input.isTrainingDay, input.calciumTargetOverride, input.sodiumTargetOverride,
  ) : { coverage: [], topDeficitNutrient: null, surpluses: [], totals: {} };
  // D-28 fix (жалоба «при дефиците нутриентов изотоник не включается»):
  // изотоник добавлялся ТОЛЬКО в intra-workout длинных сессий (≥75 мин). Теперь при
  // дефиците Na/электролитов на ЛЮБОМ тренировочном дне изотоник попадает в
  // пост-тренировочный/intra приём (регидратация + электролиты + углеводы).
  if (_qualityMode === 'full' && input.isTrainingDay) {
    const _mt = (_microRes.totals || {}) as Record<string, number>;
    const _naNow = _mt['Na'] || 0;
    const _kNow = _mt['K'] || 0;
    const _naTarget = input.isTrainingDay ? Math.max(3000, Math.round(3000 + input.weightKg * 5)) : 2300;
    const _isoDeficit = _naNow < _naTarget * 0.6 || (_kNow > 0 && _kNow / Math.max(1, _naNow) > 5 && _naNow < 1500);
    const _hasIso = meals.some(m => m.items.some(it => (it.id === 'isotonic' || it.id === 'drink_isotonic') || (it.name || '').toLowerCase().includes('изотон')));
    if (_isoDeficit && !_hasIso && pool.isotonic) {
      const _targetMeal = meals.find(m => m.type === 'postworkout') || meals.find(m => m.type === 'intra') || meals.filter(m => m.totals.p > 0).sort((a, b) => (b.totals.p || 0) - (a.totals.p || 0))[0] || meals[meals.length - 1];
      if (_targetMeal) {
        const _isoG = Math.min(25, SUPPLEMENT_MAX_G[pool.isotonic.id] ?? 25);
        _targetMeal.items.push(makeItem(pool.isotonic, _isoG, 'liquid'));
        _targetMeal.totals = _targetMeal.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + (it.fiber || 0), leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
        totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0); totals.fiber = meals.reduce((s, m) => s + (m.totals.fiber || 0), 0); totals.leucine_mg = meals.reduce((s, m) => s + (m.totals.leucine_mg || 0), 0);
        notes.push(`⚡ Дефицит натрия/электролитов (${Math.round(_naNow)} мг Na) на тренировочном дне — добавлен изотоник (${pool.isotonic.name}) ${_isoG} г: Na/K/Mg + углеводы, регидратация.`);
      }
    }
  }
  // Nutrients already covered by closeFoodDeficiencies (avoid duplicate deficit notes).
  const _existingMicroKeys = new Set(['Fe','Mg','Zn','K','Ca','Omega3','Se','VitC','VitD','VitB12','VitB9']);
  for (const c of _qualityMode === 'full' ? _microRes.coverage : []) {
    if (c.status === 'low') { notes.push(`🟡 ${c.nutrient}: ${c.actual}${c.unit}/${c.target}${c.unit} (${c.pct}%) — близко к дефициту`); }
    else if (c.status === 'deficit' && !_existingMicroKeys.has(c.nutrient)) { notes.push(`⚠ ${c.nutrient}: ${c.actual}${c.unit}/${c.target}${c.unit} (${c.pct}%) — дефицит`); }
  }
  if (_qualityMode === 'full' && _microRes.surpluses.length > 0) notes.push(..._microRes.surpluses);
  // #1 женская фаза цикла: проброс заметки в plan notes.
  if (input.menstrualPhaseNote) notes.push(input.menstrualPhaseNote);
  // #2 Электролиты: натриевый баланс + K:Na соотношение.
  if (_qualityMode === 'full') {
    const totals = _microRes.totals as Record<string, number>;
    const na = totals['Na'] || 0;
    const k = totals['K'] || 0;
    const naTarget = input.isTrainingDay ? Math.max(3000, Math.round(3000 + input.weightKg * 5)) : 2300;
    if (na < 1500 && input.sodiumTargetOverride === undefined) { // peak-week управляет Na намеренно
      const gapMg = Math.round(naTarget - na);
      const saltG = Math.round(gapMg / 400 * 10) / 10; // 1г соли ≈ 400мг Na
      notes.push(`🧂 Натрий низкий: ${Math.round(na)}мг / цель ${naTarget}мг. На тренировочном дне риск гипонатриемии (потеря с потом). Добавьте ~${saltG}г соли в приёмы.`);
    }
    if (na > 5000 && input.sodiumTargetOverride === undefined) {
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

  // FINAL SNAP: граммовки 100% круглые — все продукты к сетке (41→50, 97→100, 203→200)
  {
      for (const m of meals) {
        for (const it of m.items) {
          const fd = FOOD_DB.find(f => f.id === it.id);
          if (!fd) continue;
          const snapped = snapPortionG(fd, it.amount);
          if (snapped !== it.amount && it.amount > 0) {
            const factor = snapped / it.amount;
            it.amount = snapped;
            it.kcal = Math.round(it.kcal * factor);
            it.p = Math.round(it.p * factor * 10) / 10;
            it.f = Math.round(it.f * factor * 10) / 10;
            it.c = Math.round(it.c * factor * 10) / 10;
            it.fiber = Math.round((it.fiber || 0) * factor * 10) / 10;
            it.leucine_mg = Math.round((it.leucine_mg || 0) * factor);
          }
        }
        m.totals = m.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + (it.fiber || 0), leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
      }
      totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0);
      totals.p = Math.round(meals.reduce((s, m) => s + m.totals.p, 0) * 10) / 10;
      totals.f = Math.round(meals.reduce((s, m) => s + m.totals.f, 0) * 10) / 10;
      totals.c = Math.round(meals.reduce((s, m) => s + m.totals.c, 0) * 10) / 10;
      totals.fiber = Math.round(meals.reduce((s, m) => s + (m.totals.fiber || 0), 0) * 10) / 10;
      totals.leucine_mg = meals.reduce((s, m) => s + (m.totals.leucine_mg || 0), 0);
  }

  // P4b (Aug 28): ФИНАЛЬНАЯ белковая коррекция — ПОСЛЕ FINAL SNAP (сетка мяса/рыбы от 100 г
  // возвращала урезанный D-23-лосось 30г → 100г, +14 г белка) и ДО посадки (иначе ккал после
  // резки белка не добирается). Включает veg-роль с белком ≥10 г (D-23-добавки: лосось/печень).
  // БЕЗ snapPortionG — сетка мяса/рыбы [100,150,200...] возвращала урезанные 95г → 100г.
  {
    const goalP4b = adjustedProteinG || input.goalProteinG;
    let guard4b = 6;
    let devP4b = (totals.p - goalP4b) / Math.max(1, goalP4b);
    while (devP4b > 0.05 && guard4b-- > 0) {
      const excess4b = totals.p - goalP4b;
      const all4b = meals.flatMap(m => m.items.filter(it => ((it.role === 'protein' || it.role === 'fast_protein' || it.role === 'slow_protein') || (it.role === 'veg' && (it.p || 0) >= 10))).map(it => ({ meal: m, item: it })));
      const whole4b = all4b.filter(({ item }) => item.role === 'protein');
      const items4b = whole4b.length > 0 ? whole4b : all4b;
      if (items4b.length === 0) break;
      const reducePer4b = excess4b / items4b.length;
      let cutAny4b = false;
      items4b.forEach(({ item }) => {
        const food = FOOD_DB.find(f => f.id === item.id);
        if (!food || !food.protein) return;
        const reduceGrams = Math.round(reducePer4b / food.protein * 100);
        const floor4b = (item.role === 'fast_protein' || item.role === 'slow_protein') ? 20 : (item.role === 'veg' ? 30 : 10);
        const newAmount = Math.max(floor4b, Math.round(item.amount - reduceGrams));
        if (newAmount >= item.amount) return;
        cutAny4b = true;
        const factor = newAmount / (item.amount || 1);
        item.amount = newAmount;
        item.kcal = Math.round(item.kcal * factor); item.p = Math.round(item.p * factor); item.f = Math.round(item.f * factor); item.c = Math.round(item.c * factor); item.fiber = Math.round(item.fiber * factor); item.leucine_mg = Math.round((item.leucine_mg || 0) * factor);
      });
      if (!cutAny4b) break;
      meals.forEach(m => { m.totals = m.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + it.fiber, leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 }); });
      totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0); totals.fiber = meals.reduce((s, m) => s + (m.totals.fiber||0), 0); totals.leucine_mg = meals.reduce((s, m) => s + (m.totals.leucine_mg||0), 0);
      devP4b = (totals.p - goalP4b) / Math.max(1, goalP4b);
    }
  }

  // P4c (Aug 28): финальный ЖИР-кламп — зеркально P4b. Snap-сетка (масло 28→30, сливочное
  // 21→50) и kcal-догон раздували жиры дня за fatTotal×1.10 → разбег с целью карточки.
  {
    const _fatCeil = Math.max(fatTotal * 1.10, input.goalFatG * 1.10, input.weightKg * 0.8 * 1.05);
    let guard4c = 5;
    let overF = totals.f - _fatCeil;
    while (overF > 1 && guard4c-- > 0) {
      const fatItems4c = meals.flatMap(m => m.items.filter(it => it.role === 'fat' && (it.amount || 0) > 12).map(it => ({ meal: m, item: it })));
      if (fatItems4c.length === 0) break;
      const biggest = fatItems4c.sort((a, b) => (b.item.f || 0) - (a.item.f || 0))[0];
      const food4c = FOOD_DB.find(f => f.id === biggest.item.id);
      if (!food4c || !food4c.fat) break;
      const cutGrams = Math.max(3, Math.min(biggest.item.amount - 10, Math.round(overF / food4c.fat * 100)));
      const newAmount4c = Math.max(10, biggest.item.amount - cutGrams);
      if (newAmount4c >= biggest.item.amount) break;
      const factor4c = newAmount4c / (biggest.item.amount || 1);
      biggest.item.amount = newAmount4c;
      biggest.item.kcal = Math.round(biggest.item.kcal * factor4c); biggest.item.p = Math.round(biggest.item.p * factor4c); biggest.item.f = Math.round(biggest.item.f * factor4c); biggest.item.c = Math.round(biggest.item.c * factor4c); biggest.item.fiber = Math.round((biggest.item.fiber || 0) * factor4c); biggest.item.leucine_mg = Math.round((biggest.item.leucine_mg || 0) * factor4c);
      biggest.meal.totals = biggest.meal.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + (it.fiber || 0), leucine_mg: acc.leucine_mg + (it.leucine_mg || 0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
      totals.p = meals.reduce((s, m) => s + m.totals.p, 0); totals.kcal = meals.reduce((s, m) => s + m.totals.kcal, 0); totals.f = meals.reduce((s, m) => s + m.totals.f, 0); totals.c = meals.reduce((s, m) => s + m.totals.c, 0); totals.fiber = meals.reduce((s, m) => s + (m.totals.fiber||0), 0); totals.leucine_mg = meals.reduce((s, m) => s + (m.totals.leucine_mg||0), 0);
      overF = totals.f - _fatCeil;
    }
  }

  // Строгая 4-осевая посадка ≤3% по каждому параметру (ккал,Б,Ж,У) и общему КБЖУ — 2026-08-27.
  // preSleep — опционально (если уже хватает белка, не форсируем), intra — только при
  // привязке к тренировке (allowIntraWorkout). Белок режется только если он сам worst-over.
  {
    const goals = { kcal: input.goalKcal||0, p: input.goalProteinG||0, f: input.goalFatG||0, c: input.goalCarbsG||0 };
    const maxDev = () => Math.max(
      goals.kcal ? Math.abs(totals.kcal - goals.kcal)/goals.kcal : 0,
      goals.p ? Math.abs(totals.p - goals.p)/goals.p : 0,
      goals.f ? Math.abs(totals.f - goals.f)/goals.f : 0,
      goals.c ? Math.abs(totals.c - goals.c)/goals.c : 0
    );
    let guard = 60;
    while (maxDev() > 0.0301 && guard-- > 0) {
      const devK = goals.kcal ? (totals.kcal - goals.kcal)/goals.kcal : 0;
      const devP = goals.p ? (totals.p - goals.p)/goals.p : 0;
      const devF = goals.f ? (totals.f - goals.f)/goals.f : 0;
      const devC = goals.c ? (totals.c - goals.c)/goals.c : 0;
      const abs = { k: Math.abs(devK), p: Math.abs(devP), f: Math.abs(devF), c: Math.abs(devC) };
      let worst: 'k'|'p'|'f'|'c' = 'k';
      if (abs.p > abs[worst]) worst = 'p';
      if (abs.f > abs[worst]) worst = 'f';
      if (abs.c > abs[worst]) worst = 'c';
      // k → мапим на доминирующий макро для точечной коррекции
      let effWorst: 'p'|'f'|'c' = worst === 'k'
        ? (abs.p >= abs.c && abs.p >= abs.f ? 'p' : abs.c >= abs.f ? 'c' : 'f')
        : worst as any;
      const target = effWorst === 'p' ? goals.p : effWorst === 'f' ? goals.f : goals.c;
      const cur = effWorst === 'p' ? totals.p : effWorst === 'f' ? totals.f : totals.c;
      const need = target - cur; // >0 недобор, <0 перебор
      if (Math.abs(need) < 0.5) break;
      if (need < 0) {
        // Перебор: урезать самый калорийный НЕ-белковый (кроме случая когда белок сам worst)
        let bMi=-1,bIi=-1,bSaved=0;
        meals.forEach((m,mi)=> (m.items||[]).forEach((it:any,ii:number)=>{
          const role=(it as any).role||'';
          const isProtein = role==='protein'||role==='slow_protein'||role==='fast_protein';
          if (isProtein && effWorst!=='p' && devP <= 0.03) return;
          if ((it.amount||0) < 20) return;
          const per100 = effWorst==='p' ? (FOOD_DB.find((f:any)=>f.id===it.id)?.protein||0) : effWorst==='c' ? (FOOD_DB.find((f:any)=>f.id===it.id)?.carbs||0) : (FOOD_DB.find((f:any)=>f.id===it.id)?.fat||0);
          if (per100<=0) return;
          const saved = (it.kcal||0) * 0.12;
          if (saved > bSaved) { bSaved=saved; bMi=mi; bIi=ii; }
        }));
        if (bIi<0 || bSaved < 10) break;
        const meal = meals[bMi]; const it = meal.items[bIi];
        const na = Math.max(15, Math.round(it.amount * 0.85));
        const r2 = na/(it.amount||1);
        it.p = +(it.p * r2).toFixed(1); it.f = +(it.f * r2).toFixed(1); it.c = +(it.c * r2).toFixed(1);
        it.kcal = Math.round(4*it.p + 9*it.f + 4*it.c);
        it.amount = na;
        it.fiber = Math.round((it.fiber||0)*r2*10)/10;
        it.leucine_mg = Math.round((it.leucine_mg||0)*r2);
        meal.totals = meal.items.reduce((acc:any,x:any)=>({kcal:acc.kcal+x.kcal,p:acc.p+x.p,f:acc.f+x.f,c:acc.c+x.c,fiber:acc.fiber+(x.fiber||0),leucine_mg:acc.leucine_mg+(x.leucine_mg||0)}),{kcal:0,p:0,f:0,c:0,fiber:0,leucine_mg:0});
      } else {
        // Недобор: добавить лучший продукт по effWorst из FOOD_DB.
        // Aug 28 (жалоба «что попало без учёта настроек»): пул добавки проходит ПОЛНЫЙ
        // набор гейтов — excludedIds + аллергены + непереносимости + категории (раньше
        // только excludedIds → «творог в перекус» при молочной аллергии). Пул — только
        // осмысленные степлы по роли (для 'c' — крупы/крахмалы ≥15 г углей/100 г, для 'f'
        // — жиры ≥30 г/100 г: масла/орехи, для 'p' — белок ≥10) и НЕ фрукты/лаймы.
        const _userAllerg: Set<string> = input.allergenTags || new Set<string>();
        const _foodAllowed = (f: any): boolean => {
          if (input.excludedIds?.has(f.id)) return false;
          if (_currentExcludedIds && _currentExcludedIds.has(f.id)) return false;
          if (f.category === 'supplement' && !['whey_isolate', 'whey_protein', 'casein', 'supp_pea_protein'].includes(f.id)) return false;
          const diet = FOOD_ALLERGEN_DIET[f.id];
          const tags = (diet && Array.isArray(diet.allergens)) ? diet.allergens : (f.allergens || []);
          if (_userAllerg.size > 0 && [..._userAllerg].some((t: string) => tags.includes(t))) return false;
          if (input.intolerances && !filterByIntolerance(f, input.intolerances)) return false;
          if (input.categoryPref && !matchesCategoryPref(f, input.categoryPref)) return false;
          return true;
        };
        const pool = FOOD_DB.filter((f:any)=>{
          if (!_foodAllowed(f)) return false;
          // Aug 28: пул добавки — «чистые» степлы по роли с МИНИМАЛЬНЫМ белковым side-эффектом:
          // для 'c' — продукты с белком ≤6 г/100 (лайм/мёд/сахар — победители плотности; овсянка/
          // отруби с 13-15 г белка/100 раздували белок дня на +15%), для 'f' — то же (масла, не орехи).
          if (effWorst==='p') return (f.protein||0) > 10 && (f.carbs||0) <= 8;
          if (effWorst==='c') return (f.carbs||0) > 8 && (f.protein||0) <= 6;
          return (f.fat||0) > 8 && (f.protein||0) <= 6;
        }).sort((a:any,b:any)=>{
          const av = effWorst==='p' ? (a.protein||0)/(a.kcal||1) : effWorst==='c' ? (a.carbs||0)/(a.kcal||1) : (a.fat||0)/(a.kcal||1);
          const bv = effWorst==='p' ? (b.protein||0)/(b.kcal||1) : effWorst==='c' ? (b.carbs||0)/(b.kcal||1) : (b.fat||0)/(b.kcal||1);
          return bv - av;
        });
        const _macroGoal = effWorst==='p' ? goals.p : effWorst==='c' ? goals.c : goals.f;
        const _macroCur = effWorst==='p' ? totals.p : effWorst==='c' ? totals.c : totals.f;
        const _mealShareRatio = (m:any) => {
          const t = m.target; const tk = t ? (t.p||0)*4 + (t.c||0)*4 + (t.f||0)*9 : 0;
          if (tk <= 0) return 2;
          return (m.totals?.kcal || 0) / tk;
        };
        const _candMeals = meals.filter((m:any)=> m.type !== 'presleep' && m.type !== 'intra' && m.type !== 'breakfast');
        let targetMeal = _candMeals.length > 0
          ? _candMeals.reduce((a:any,b:any)=>(_mealShareRatio(a) <= _mealShareRatio(b) ? a : b))
          : (meals[meals.length-1] || meals[0]);
        // Aug 28: если в приёме-цели уже есть item той же РОЛИ — добивка идёт В НЕГО
        // (его продуктом), а не новым «вторым гарниром» (иначе «рис + 30г риса» / второй гарнир).
        const _roleGroup: string[] = effWorst==='p' ? ['protein','fast_protein','slow_protein'] : effWorst==='c' ? ['carb_slow','carb_fast'] : ['fat'];
        const _mergeProteinCap = effWorst==='p' ? 999 : 6; // side-эффект белка для c/f добавок
        const _mergeItem = targetMeal.items.find((x:any) => {
          if (!_roleGroup.includes(x.role) || (x.amount||0) <= 0) return false;
          const _fd = FOOD_DB.find((f:any) => f.id === x.id);
          if (!_fd) return false;
          return (_fd.protein||0) <= _mergeProteinCap;
        });
        let best: any = null; let per100 = 0;
        const _needG = Math.min(need, _macroGoal * 1.03 - _macroCur);
        if (_mergeItem) {
          const _fd = FOOD_DB.find((f:any) => f.id === _mergeItem.id);
          const _v = _fd ? (effWorst==='p' ? (_fd.protein||0) : effWorst==='c' ? (_fd.carbs||0) : (_fd.fat||0)) : 0;
          if (_v > 0 && _foodAllowed(_fd)) { best = _fd; per100 = _v; }
        }
        if (!best) {
          best = pool[0];
          if (!best) break;
          per100 = effWorst==='p' ? (best.protein||0) : effWorst==='c' ? (best.carbs||0) : (best.fat||0);
        }
        // Aug 28: добавка не раздувает макрос за цель ×1.03 (kcal-недобор мапится в макро —
        // раньше «догон ккал» жиром вылетал за пол жиров ×1.1 → разбег КБЖУ). Флор 10 г —
        // чтобы цикл не выходил раньше времени (перебор side-эффектов режет ветка need<0).
        let grams = Math.max(10, Math.min(150, Math.round(Math.max(0, _needG) / per100 * 100 / 10) * 10));
        const r = grams/100;
        const p2=Math.round((best.protein||0)*r), f2=Math.round((best.fat||0)*r), c2=Math.round((best.carbs||0)*r);
        const it:any = { id: best.id, name: best.name, amount: grams, role: effWorst==='p'?'protein':effWorst==='c'?'carb_slow':'fat', kcal: Math.round(4*p2+9*f2+4*c2), p:p2, f:f2, c:c2, fiber: Math.round((best.fiber||0)*r), leucine_mg: 0 };
        // Один и тот же продукт НЕ дублируется item'ом в приёме — мерджим граммы в существующий
        // (раньше посадка клепала «лайм 150 + лайм 150 + лайм 140» в одном приёме).
        const _exist = targetMeal.items.find((x:any) => x.id === best.id);
        if (_exist) {
          const rr = (_exist.amount + grams) / (_exist.amount || 1);
          _exist.amount = _exist.amount + grams;
          _exist.p = +(_exist.p * rr).toFixed(1); _exist.f = +(_exist.f * rr).toFixed(1); _exist.c = +(_exist.c * rr).toFixed(1);
          _exist.kcal = Math.round(4*_exist.p + 9*_exist.f + 4*_exist.c);
          _exist.fiber = Math.round((_exist.fiber||0)*rr*10)/10;
          _exist.leucine_mg = Math.round((_exist.leucine_mg||0)*rr);
        } else {
          targetMeal.items.push(it);
        }
        targetMeal.totals = targetMeal.items.reduce((acc:any,x:any)=>({kcal:acc.kcal+x.kcal,p:acc.p+x.p,f:acc.f+x.f,c:acc.c+x.c,fiber:acc.fiber+(x.fiber||0),leucine_mg:acc.leucine_mg+(x.leucine_mg||0)}),{kcal:0,p:0,f:0,c:0,fiber:0,leucine_mg:0});
      }
      totals.kcal = meals.reduce((s:any,m:any)=>s+m.totals.kcal,0);
    totals.p = Math.round(meals.reduce((s, m) => s + m.totals.p, 0) * 10) / 10;
    totals.f = Math.round(meals.reduce((s, m) => s + m.totals.f, 0) * 10) / 10;
    totals.c = Math.round(meals.reduce((s, m) => s + m.totals.c, 0) * 10) / 10;
    totals.fiber = Math.round(meals.reduce((s, m) => s + (m.totals.fiber || 0), 0) * 10) / 10;
    totals.leucine_mg = meals.reduce((s, m) => s + (m.totals.leucine_mg || 0), 0);
  }
  }

  return {
    dayIndex: (input.dayOffset ?? 0),
    isTrainingDay: input.isTrainingDay,
    meals,
    totals,
    mpsSummary,
    diversity: { uniqueFoods, categories },
    microSummary: { coverage: _microRes.coverage, topDeficitNutrient: _microRes.topDeficitNutrient },
    notes,
  };
  } finally {
    // P0-4: освобождаем pickCtx — даже если генерация выбросила исключение, prefs не утекут в следующий план.
    _pickCtx._locked = false;
    _pickCtx.tasteProfile = undefined;
    _pickCtx.deprioritizedIds = undefined;
    _pickCtx.categoryPref = undefined;
    _tasteProfile = undefined;
    _deprioritizedIds = undefined;
    _categoryPref = undefined;
    _qualityMode = 'full';
    _currentExcludedIds = undefined;
  }
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
  // Direct match in micros (primary source) — с нормализацией единиц (Omega3 г→мг)
  const direct = m?.[field];
  if (direct !== undefined) {
    if (field === 'Omega3' && direct < 100) return direct * 1000;
    return direct;
  }
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
// Aug 28: продукт уважает аллергены/непереносимости/категории (opts) — раньше только excludedIds.
function activelyCloseTopDeficiency(meals: Meal[], isVegetarian: boolean, sex: 'male'|'female'|'other', excludedIds: Set<string>, opts?: { allergenTags?: Set<string>; intolerances?: Intolerances; categoryPref?: CategoryPref }): { note: string | null } {
  const _foodAllowed = (f: any): boolean => {
    if (excludedIds.has(f.id)) return false;
    if (!opts) return true;
    const diet = FOOD_ALLERGEN_DIET[f.id];
    const tags = (diet && Array.isArray(diet.allergens)) ? diet.allergens : (f.allergens || []);
    if (opts.allergenTags && opts.allergenTags.size > 0 && [...opts.allergenTags].some((t: string) => tags.includes(t))) return false;
    if (opts.intolerances && !filterByIntolerance(f, opts.intolerances)) return false;
    if (opts.categoryPref && !matchesCategoryPref(f, opts.categoryPref)) return false;
    return true;
  };
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
  const food = [FOOD_DB.find(f => f.id === sourceId), FOOD_DB.find(f => f.id === cfg.foodId)].find(f => f && _foodAllowed(f));
  if (!food || excludedIds.has(food.id)) return { note: null };
  // если продукт уже в плане — не дублируем (добавим note-флаг через closeFoodDeficiencies)
  if (meals.flatMap(m => m.items).some(it => it.id === food.id)) return { note: null };
  // в самый лёгкий приём, НО не pre-sleep: микро-добавка продукта
  // (напр. лосось 100 г = 20 г белка/13 г жира) не должна раздувать ночной казеиновый приём —
  // иначе pre-sleep уходит за 60 г белка (жалоба «белок не распределён»).
  // D-28+ fix (диетология): также НЕ добавляем в завтрак — иначе «добивка» омега-3 (лосось/
  // печень) попадала в творожную/овсяную кашу («творог + лосось»). Рыбные источники омега-3
  // и так добавляются отдельным Omega-3-проходом в обед; завтрак остаётся «завтрашним».
  // Aug 28: НЕ добавляем и в пери-тренировочные приёмы (prew/intra/postw — это напитки:
  // «EAA + лосось» — бессмыслица и раздуватель белка).
  let target = meals.find(m => !['presleep','breakfast','preworkout','intra','postworkout'].includes(m.type) && !m.type.startsWith('snack')) || meals.find(m => !['presleep','breakfast','preworkout','intra','postworkout'].includes(m.type)) || meals.find(m => m.type !== 'presleep') || meals[0];
  for (const m of meals) if (!['presleep','breakfast','preworkout','intra','postworkout'].includes(m.type) && !m.type.startsWith('snack') && (m.totals.kcal || 0) < (target.totals.kcal || 0)) target = m;
  const grams = cfg.foodG;
  const item = makeItem(food, grams, 'veg');
  target.items.push(item);
  target.totals = target.items.reduce((acc, it) => ({ kcal: acc.kcal + it.kcal, p: acc.p + it.p, f: acc.f + it.f, c: acc.c + it.c, fiber: acc.fiber + (it.fiber||0), leucine_mg: acc.leucine_mg + (it.leucine_mg||0) }), { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, leucine_mg: 0 });
  const effRda = worstKey === 'Fe' ? (sex === 'male' ? 8 : 18) : cfg.rda;
  const added = Math.round(getMicroFromFood(food, worstKey) * grams / 100);
  const before = Math.round(microTotals[worstKey] || 0);
  return { note: `${food.name} ${grams}г → закрытие дефицита ${worstKey}: +${added} ${cfg.unit} (${before}→${before + added}/${effRda} ${cfg.unit})` };
}
