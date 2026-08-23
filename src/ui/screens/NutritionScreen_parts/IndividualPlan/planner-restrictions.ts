/**
 * planner-restrictions.ts — резолвер аллергенов и диет-ограничений в конкретные foodId.
 *
 * До этого аллергены/ограничения работали ТОЛЬКО в классическом (legacy) пути генерации
 * и только по тегам FOOD_ALLERGEN_DIET; в pro-движке (buildDayPlan) они игнорировались
 * полностью (excludedIds собирался без них). Этот модуль — единый источник истины:
 * оба пути генерации добавляют результат в excludedIds.
 *
 * Чистые функции — тестируются без React/localStorage.
 */

import { FOOD_ALLERGEN_DIET } from "../../../../core/nutrition-database";
import type { FoodItem } from "../../../../core/nutrition-database";

// Маппинг ID аллергена из ALLERGEN_LIST → теги-значения, используемые
// в FOOD_ALLERGEN_DIET[].allergens и FoodItem.allergens.
export const USER_ALLERGEN_TO_TAGS: Record<string, string[]> = {
  'лактоза': ['dairy'],
  'молочные': ['dairy'],
  'глютен': ['gluten'],
  'орехи': ['nuts', 'tree_nuts'],
  'арахис': ['peanuts'],
  'яйца': ['eggs'],
  'соя': ['soy'],
  'рыба': ['fish'],
  'морепродукты': ['shellfish'],
  'кунжут': ['sesame'],
  'горчица': ['mustard'],
  'сельдерей': ['celery'],
  'сульфиты': ['sulfites'],
  'люпин': ['lupin'],
};

/**
 * Текстовый фолбэк: продукт без тегов в FOOD_ALLERGEN_DIET определяем по имени.
 * ВАЖНО: 'белок' НЕ входит в паттерн яиц (ложные срабатывания: «Капуста белокочанная»,
 * «Сейтан (пшеничный белок)»). Реальные яичные продукты покрыты тегами eggs.
 */
export function allergenTextMatches(allergenId: string, foodName: string): boolean {
  const n = (foodName || '').toLowerCase();
  if (allergenId === 'лактоза' || allergenId === 'молочные') {
    // whey/casein порошок (сывороточный) — не считается молочным аллергеном per user: "протеин не аллерген"
    return /молок|сыр|творог|кефир|сливк|йогурт|сметан|морожен|лактоз/.test(n);
  }
  if (allergenId === 'глютен') {
    return /пшениц|мук|хлеб|макарон|пельмен|вареник|пицц|лаваш|булгур|кускус|манк|паниров|сухар|кляр|тест|блин|олад|круасс|багет|чиабат|лепёш|торт|пирож|пончик|печенье|крекер|вафл|глютен/.test(n);
  }
  if (allergenId === 'орехи') {
    return /миндаль|грецк|кешью|фундук|пекан|макадам|фисташк|орех|nut|almond|walnut|cashew|hazeln|pecan|pistach/.test(n);
  }
  if (allergenId === 'арахис') {
    return /арахис|peanut|groundnut|землян/.test(n);
  }
  if (allergenId === 'яйца') {
    return /яйц|яич|омлет|egg|майонез/.test(n);
  }
  if (allergenId === 'соя') {
    return /соя|соев|тофу|edamame|soy|мисо|miso|темпе|tamari/.test(n);
  }
  if (allergenId === 'рыба') {
    return /рыб|лосос|тунец|треск|палтус|скумбр|форель|сардин|сельдь|anchov|fish|salmon|tuna|cod|halibut/.test(n);
  }
  if (allergenId === 'морепродукты') {
    return /креветк|краб|лобстер|омар|мидии|кальмар|осьминог|shrimp|crab|lobster|mussel|squid|scallop|устриц|моллюск|ракушк|langoust/.test(n);
  }
  if (allergenId === 'кунжут') {
    return /кунжут|сезам|тахини|sesame|tahini/.test(n);
  }
  if (allergenId === 'горчица') {
    return /горчиц|mustard/.test(n);
  }
  if (allergenId === 'сельдерей') {
    return /сельдерей|celery/.test(n);
  }
  if (allergenId === 'сульфиты') {
    return /сульфит|sulfite|вино|пиво|сухофрукт/.test(n);
  }
  if (allergenId === 'люпин') {
    return /люпин|lupin/.test(n);
  }
  return false;
}

/** Теги аллергенов продукта: сначала FOOD_ALLERGEN_DIET (канонический источник), затем поле FoodItem.allergens. */
export function getFoodAllergenTags(foodId: string, foods: FoodItem[]): string[] {
  const diet = FOOD_ALLERGEN_DIET[foodId];
  if (diet && Array.isArray(diet.allergens)) return diet.allergens;
  const food = foods.find(f => f.id === foodId);
  return Array.isArray(food?.allergens) ? (food.allergens as string[]) : [];
}

/** Совпадает ли продукт с конкретным аллергеном пользователя (для предупреждений после генерации). */
export function matchesSelectedAllergen(food: FoodItem, allergenId: string, foods: FoodItem[]): boolean {
  const tags = getFoodAllergenTags(food.id, foods);
  const values = USER_ALLERGEN_TO_TAGS[allergenId] || [allergenId];
  if (values.some(v => tags.includes(v))) return true;
  return allergenTextMatches(allergenId, food.name);
}

/**
 * ID продуктов, исключаемых выбранными аллергенами.
 * Алгоритм: тег-совпадение (FOOD_ALLERGEN_DIET / FoodItem.allergens) + текстовый фолбэк
 * для продуктов без тегов. Одного совпадения достаточно.
 */
export function resolveAllergenFoodIds(foods: FoodItem[], allergens: string[]): Set<string> {
  const result = new Set<string>();
  if (!Array.isArray(allergens) || allergens.length === 0) return result;
  for (const food of foods) {
    const tags = getFoodAllergenTags(food.id, foods);
    for (const a of allergens) {
      if (typeof a !== 'string' || !a) continue;
      const values = USER_ALLERGEN_TO_TAGS[a] || [a];
      if (values.some(v => tags.includes(v))) { result.add(food.id); break; }
      if (allergenTextMatches(a, food.name)) { result.add(food.id); break; }
    }
  }
  return result;
}

// ─── Диет-ограничения (dietPrefs) ───

const MIN_PROCESSED_IDS = [
  'sausage', 'bacon', 'ham', 'kfc_wings', 'kfc_soup', 'kfc_bucket', 'mcd_big_mac', 'mcd_royale',
  'bk_whopper', 'vt_big_smoke', 'pizza_margherita', 'french_fries', 'chips', 'nuggets', 'mayonnaise',
  'ketchup', 'cream_sauce', 'marmalade', 'cookie', 'chocolate', 'ice_cream', 'condensed_milk',
  'cheese_processed', 'bouillon_cube', 'soda', 'coca_cola', 'juice_apple', 'juice_orange', 'bread_white',
];

/**
 * ID продуктов, исключаемых диет-ограничениями: no_dairy, no_gluten, min_sugar, min_processed.
 * no_dairy/no_gluten добавляют теги в общий резолвер аллергенов (в вызывающем коде), поэтому
 * здесь — только прямые ограничения min_sugar/min_processed.
 */
export function resolveDietRestrictionIds(foods: FoodItem[], dietPrefs: string[]): Set<string> {
  const result = new Set<string>();
  if (!Array.isArray(dietPrefs) || dietPrefs.length === 0) return result;
  const set = new Set(dietPrefs);
  if (set.has('min_sugar')) {
    foods.filter(f => (f.carbs || 0) > 15 && (f.gi || 0) > 60).forEach(f => result.add(f.id));
  }
  if (set.has('min_processed')) {
    MIN_PROCESSED_IDS.forEach(id => result.add(id));
  }
  return result;
}

/** Теги, которые активируют no_dairy/no_gluten — добавляются к тегам аллергенов. */
export function dietRestrictionTags(dietPrefs: string[]): string[] {
  const result: string[] = [];
  if (!Array.isArray(dietPrefs)) return result;
  if (dietPrefs.includes('no_dairy')) result.push('dairy');
  if (dietPrefs.includes('no_gluten')) result.push('gluten');
  return result;
}

/** Число продуктов FOOD_DB, исключённых именно аллергенами (для баннера в UI). */
export function countExcludedByAllergens(foods: FoodItem[], allergens: string[]): number {
  return resolveAllergenFoodIds(foods, allergens).size;
}

/** Единый резолвер: аллергены + dietPrefs → полный набор foodId для excludedIds. */
export function resolveAllExcludedFoodIds(foods: FoodItem[], allergens: string[], dietPrefs: string[]): Set<string> {
  const result = resolveAllergenFoodIds(foods, allergens);
  for (const id of resolveDietRestrictionIds(foods, dietPrefs)) result.add(id);
  // no_dairy/no_gluten: исключить по тегу через FOOD_ALLERGEN_DIET / FoodItem.allergens
  // + текстовый фолбэк для продуктов без тегов (лаваш, хлеб, сырники и т.п.)
  const extraTags = dietRestrictionTags(dietPrefs);
  if (extraTags.length > 0) {
    const tagToAllergen: Record<string, string> = { dairy: 'молочные', gluten: 'глютен' };
    for (const food of foods) {
      const diet = FOOD_ALLERGEN_DIET[food.id];
      // no_dairy diet excludes all non-dairyFree (including whey порошок) even if allergen "молочные" doesn't
      if (extraTags.includes('dairy') && diet && diet.isDairyFree === false) { result.add(food.id); continue; }
      const tags = getFoodAllergenTags(food.id, foods);
      if (extraTags.some(t => tags.includes(t))) { result.add(food.id); continue; }
      for (const t of extraTags) {
        const allergenId = tagToAllergen[t];
        if (allergenId && allergenTextMatches(allergenId, food.name)) { result.add(food.id); break; }
      }
    }
  }
  return result;
}
