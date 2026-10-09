/**
 * recipe-decompose.ts — чистый слой «рецепт → продукты» БЕЗ зависимости от
 * UI/планировщика. Выделен ИЗ `IndividualPlan/recipe-engine` (и `food-availability`)
 * специально, чтобы `recipe-db.ts` мог синхронизировать шапки рецептов при сборке
 * БД, не импортируя тяжёлый чанк планировщика.
 *
 * Причина выделения (APK-boot TDZ): `recipe-db` (чанк recipe-db) статически звал
 * `syncRecipeHeaderFromDecomposition` из чанка nutrition-plan (куда Vite кладёт всё
 * под `IndividualPlan/`). Получался цикл чанков nutrition-plan → recipe-db →
 * nutrition-plan, и на старте APK `recipe-db` исполнялся раньше инициализации
 * `CANNED_SUBSTITUTE` в nutrition-plan → `ReferenceError: Cannot access 'f_' before
 * initialization` (приложение не грузилось). Здесь — единый источник декомпозиции,
 * зависящий только от `core/nutrition-database`, поэтому цикл разорван: и recipe-db,
 * и recipe-engine, и food-availability импортируют ЭТОТ модуль (дублирования нет).
 */

import { FOOD_DB } from '../core/nutrition-database';
import type { FoodItem } from '../core/nutrition-database';
import type { Recipe } from '../engines/nutrition-periodization.engine';
import type { MealItem } from '../ui/screens/NutritionScreen_parts/IndividualPlan/meal-plan-engine';

/** Консервы (tuna_canned, canned_*, *_canned_*) — вне автогенерации полностью. */
export function isCannedFoodId(id: string): boolean {
  return /canned/i.test(id || '');
}

/**
 * Соусы/приправы (sauce_*, mayo*, ketchup*) — приправа, а не белковая/углеводная база.
 * Причина: категория 'other' у соусов раньше валилась в роль 'protein'
 * (recipe-engine.roleForFood) → applyRealisticFloors поднимал соевый соус 15 г до
 * 80 г «белкового пола». Имя-матч ограничен категорией 'other' и исключает готовые
 * блюда (префиксы ru-, int-, snack-, drink-), у которых «майонез» упомянут в описании.
 */
export function isSauceCondimentFood(f: { id?: string; name?: string; category?: string }): boolean {
  const id = (f.id || '').toLowerCase();
  if (/^(sauce_|mayo_|mayonnaise|ketchup)/.test(id)) return true;
  if (/^(ru_|int_|snack_|drink_)/.test(id)) return false;
  if (f.category !== 'other') return false;
  const name = (f.name || '').toLowerCase();
  return /соус|сальса|майонез|кетчуп|горчиц|терияк|срирач|кочхуджан|васаби|уксус|sauce|salsa|mayo|ketchup|mustard|vinegar|sriracha|wasabi/.test(name);
}

/**
 * Замена консервов свежими 1-в-1 С СОХРАНЕНИЕМ ПОЗИЦИИ в пуле (не удаление!).
 * Простое выкидывание id сдвигает индексы seeded-пиков и ломает сходимость
 * несвязанных сценариев (доказано: D-24 −33% от бана). Дубль свежего id в пуле —
 * осознанно (вес ×2 на свежак вместо консервы, длина пула цела).
 */
export const CANNED_SUBSTITUTE: Record<string, string> = {
  tuna_canned: 'tuna_steak',
  cod_roe_canned: 'sardines',
  crab_meat_canned: 'seafood_shrimp_tiger',
  protein_squid_canned: 'pollock',
  protein_mussels_canned: 'seafood_shrimp_tiger',
  canned_green_peas: 'peas_green',
  canned_corn_sweet: 'corn',
  canned_tomatoes: 'tomato',
  canned_olives_green: 'avocado',
  milk_coconut_canned: 'coconut_urbec',
  veg_bamboo_shoots_canned: 'celery',
};

export function roleForFood(food: FoodItem): MealItem['role'] {
  const cat = food.category;
  // P0-2 (соусы ≠ белок): категория 'other' у соусов/приправ раньше валилась в
  // 'protein' → пол реалистичных порций поднимал соевый соус 15 г до 80 г.
  // Приправа семантически ближе к жиру (кап 10 г, без «белкового пола»).
  if (isSauceCondimentFood(food)) return 'fat';
  if (cat === 'supplement') return 'fast_protein';
  if (cat === 'dairy') return 'slow_protein';
  if (cat === 'grain' || cat === 'carb') return 'carb_slow';
  if (cat === 'fat') return 'fat';
  if (cat === 'veg_fruit') {
    const lid = (food.id || '').toLowerCase();
    if (['spinach','broccoli','cabbage','kale','cucumber','tomato','pepper','carrot','onion','lettuce'].some(k => lid.includes(k))) return 'veg';
    return 'fruit';
  }
  return 'protein';
}

export function makeMealItem(food: FoodItem, grams: number, role: MealItem['role']): MealItem {
  const cleanGrams = Math.max(5, Math.round(grams / 5) * 5);
  const r = cleanGrams / 100;
  const p = Math.round((food.protein || 0) * r * 10) / 10;
  const f = Math.round((food.fat || 0) * r * 10) / 10;
  const c = Math.round((food.carbs || 0) * r * 10) / 10;
  // KBЖУ-консистентность ≤3%: kcal из формулы (FOOD_DB-дрейф не наследуем)
  const kcal = Math.round(4 * p + 9 * f + 4 * c);
  // P1-агрегаты: лейцин больше не константа 0. Тот же канон, что в ручных операциях:
  // профиль аминокислот из БД, иначе консервативный фолбэк 75 мг/г белка.
  // Раньше recipe-путь писал 0 → суммы лейцина/дня и MPS-выводы были занижены.
  const leuPer100 = (food as any).amino_acid_profile_100g?.leucine_mg
    ?? ((food.micros as any)?.Leucine != null ? (food.micros as any).Leucine : Math.round((food.protein || 0) * 75));
  return {
    id: food.id, name: food.name, amount: cleanGrams, role,
    kcal,
    p,
    f,
    c,
    fiber: Math.round((food.fiber || 0) * r * 10) / 10,
    leucine_mg: Math.round(leuPer100 * r),
  };
}

/**
 * «Сырая» декомпозиция ingredientIds × portions → FOOD_DB БЕЗ масштабирования под kcal шапки.
 * Это фактически съедаемые Б/Ж/У автора раскладки (до scaleToRecipeKcal). Единственный
 * источник — decomposeRecipe и syncRecipeHeaderFromDecomposition (нет дублирования логики).
 */
export function decomposeRecipeRaw(recipe: Recipe): MealItem[] {
  const items: MealItem[] = [];
  const used = new Set<string>();
  if (!recipe.ingredientIds || recipe.ingredientIds.length === 0) return items;
  for (const fid of recipe.ingredientIds) {
    // P2-фикс: дедуп по СУБСТИТУИРОВАННОМУ id. Раньше проверялся сырой fid, а в used
    // клался _fid → рецепт с двумя консервами, сходящимися в один свежий аналог, дублировал ингредиент.
    const _fid = isCannedFoodId(fid) ? (CANNED_SUBSTITUTE[fid] ?? fid) : fid;
    if (used.has(_fid)) continue;
    const food = FOOD_DB.find(f => f.id === _fid);
    if (!food) continue;
    const grams = recipe.portions?.[fid] ?? 100;
    const item = makeMealItem(food, grams, roleForFood(food));
    items.push(item);
    used.add(_fid);
  }
  // Если порций мало и есть молоко (milk: true в завтраках) — добавим ТОЛЬКО если
  // пользователь явно указал молоко в ингредиентах (раньше 200 мл навязывались каждому
  // завтраку → искажение декомпозиции и КБЖУ).
  if (items.length > 0 && recipe.meal === 'breakfast' && !used.has('milk')
    && ((recipe.portions && Object.prototype.hasOwnProperty.call(recipe.portions, 'milk'))
      || (recipe.ingredients || []).some(i => /молок/i.test(i)))) {
    const milk = FOOD_DB.find(f => f.id === 'milk');
    if (milk) items.push(makeMealItem(milk, 200, 'liquid'));
  }
  return items;
}

/**
 * Синхронизация шапки рецепта с декомпозицией (план единого источника, остаток):
 * protein/fat/carbs пересчитываются из ФАКТИЧЕСКОЙ раскладки (ingredientIds × portions →
 * FOOD_DB, тот же путь, что decomposeRecipe), kcal = 4Б+4У+9Ж. Раньше шапка была авторской
 * заявкой и расходилась с раскладкой у 953/994 рецептов (жир ×2.9–3.9) — теперь «показано =
 * съедается»: приём в плане несёт те же макросы, что шапка рецепта. Легаси-рецепты без
 * ingredientIds не трогаются (декомпозиции нет).
 */
export function syncRecipeHeaderFromDecomposition(recipe: Recipe): Recipe {
  if (!recipe.ingredientIds || recipe.ingredientIds.length === 0) return recipe;
  const items = decomposeRecipeRaw(recipe);
  if (items.length === 0) return recipe;
  const p = Math.round(items.reduce((s, i) => s + i.p, 0));
  const f = Math.round(items.reduce((s, i) => s + i.f, 0));
  const c = Math.round(items.reduce((s, i) => s + i.c, 0));
  const kcal = Math.max(50, Math.round((4 * p + 9 * f + 4 * c) / 5) * 5);
  return { ...recipe, protein: p, fat: f, carbs: c, kcal };
}
