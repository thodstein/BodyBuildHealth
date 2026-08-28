/**
 * recipe-engine.ts — интеграция рецептов в планировщик питания.
 *
 * Проблема: рецепты существовали в базе (recipe-db.ts), но НЕ участвовали в генерации
 * плана — только ручная замена приёма через replaceMealWithRecipe. Движок генерировал
 * «рис + варёная курица» вместо вкусных рецептов.
 *
 * Решение:
 *   1. decomposeRecipe → MealItem[] (рецепт → продукты с граммовками)
 *   2. pickRecipeForMeal — подбор рецепта под приём (КБЖУ-цель, allergies, skill, time)
 *   3. flavorCompatibilityScore — оценка совместимости рецептов в дне (вкус+синергия)
 *   4. cookSkillForFrequency — соответствие навыка/частоты готовки рецептам
 */

import type { Recipe } from '../../../../engines/nutrition-periodization.engine';
import { FOOD_DB } from '../../../../core/nutrition-database';
import type { FoodItem } from '../../../../core/nutrition-database';
import type { MealItem } from './meal-plan-engine';

export type CookSkill = 'basic' | 'medium' | 'advanced';
export type CookFrequency = 'daily' | 'every_3_days' | 'weekly';

export interface CookProfile {
  skill: CookSkill;
  timePerDayMin: number;       // минут на готовку в день
  frequency: CookFrequency;    // как часто готовит
  batchCooking: boolean;       // готовит ли впрок
}

export interface RecipeMatchOptions {
  mealType: 'breakfast' | 'lunch' | 'snack' | 'snack2' | 'dinner' | 'preworkout' | 'postworkout' | 'presleep';
  targetKcal: number;
  targetProteinG: number;
  targetCarbsG: number;
  targetFatG: number;
  excludedIds: Set<string>;
  currentItemIds?: Set<string>;  // FIX: продукты уже в приёме — бонус за совпадение
  allergenTags?: Set<string>;
  cookProfile?: CookProfile;
  isVegetarian?: boolean;
  maxPrepTimeMin?: number;     // лимит времени на готовку (из cookProfile.timePerDayMin / mealsCount)
  preferredRecipeNames?: Set<string>;
  goal?: 'mass' | 'cut' | 'recomp' | 'maintenance' | 'bulk';
}

// ─── Декомпозиция рецепта в MealItem[] ─────────────────────────────────

/**
 * Превращает рецепт в массив MealItem с реальными граммовками.
 * Если recipe.ingredientIds + portions заданы — использует их напрямую.
 * Иначе парсит ingredients (строки вида "Куриная грудка 200г") и матчит с FOOD_DB по имени.
 */
export function decomposeRecipe(recipe: Recipe): MealItem[] {
  const items: MealItem[] = [];
  const used = new Set<string>();

  // Путь 1: явные ingredientIds + portions (новые рецепты)
  if (recipe.ingredientIds && recipe.ingredientIds.length > 0) {
    for (const fid of recipe.ingredientIds) {
      if (used.has(fid)) continue;
      const food = FOOD_DB.find(f => f.id === fid);
      if (!food) continue;
      const grams = recipe.portions?.[fid] ?? 100;
      const item = makeMealItem(food, grams, roleForFood(food));
      items.push(item);
      used.add(fid);
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
    return scaleToRecipeKcal(items, recipe);
  }

  // Путь 2: парсинг ingredients (строки) — fallback для старых рецептов
  for (const ing of recipe.ingredients) {
    const parsed = parseIngredient(ing);
    if (!parsed) continue;
    const food = findFoodByName(parsed.foodName);
    if (!food || used.has(food.id)) continue;
    const item = makeMealItem(food, parsed.grams, roleForFood(food));
    items.push(item);
    used.add(food.id);
  }
  return scaleToRecipeKcal(items, recipe);
}

function scaleToRecipeKcal(items: MealItem[], recipe: Recipe): MealItem[] {
  if (items.length === 0) return items;
  const currentKcal = items.reduce((s, i) => s + i.kcal, 0);
  if (currentKcal <= 0) return items;
  const scale = recipe.kcal / currentKcal;
  if (Math.abs(scale - 1) < 0.05) return items; // ±5% — не масштабируем
  return items.map(it => {
    const newAmount = Math.max(5, Math.round(it.amount * scale / 5) * 5);
    const r2 = newAmount / (it.amount || 1);
    const p = Math.round(it.p * r2 * 10) / 10;
    const f = Math.round(it.f * r2 * 10) / 10;
    const c = Math.round(it.c * r2 * 10) / 10;
    return {
      ...it,
      amount: newAmount,
      kcal: Math.round(4 * p + 9 * f + 4 * c),
      p,
      f,
      c,
      fiber: Math.round((it.fiber || 0) * r2 * 10) / 10,
      leucine_mg: Math.round((it.leucine_mg || 0) * r2),
    };
  });
}

interface ParsedIngredient { foodName: string; grams: number; }

function parseIngredient(ing: string): ParsedIngredient | null {
  // "Куриная грудка 200г" → { foodName: "куриная грудка", grams: 200 }
  // "Яйца 2 шт" → { foodName: "яйца", grams: 120 } (2 шт × 60г)
  // "Оливковое масло 1 ст.л." → { foodName: "оливковое масло", grams: 15 }
  const m = ing.match(/^(.+?)\s+(\d+(?:[.,]\d+)?)\s*(кг|г|гр|мл|шт|ст\.л\.|ч\.л\.|стакан)?/i);
  if (!m) return { foodName: ing.replace(/\d+.*$/, '').trim(), grams: 100 };
  const foodName = m[1].trim();
  const qty = parseFloat(m[2].replace(',', '.'));
  const unit = (m[3] || '').toLowerCase();
  let grams = 100;
  if (unit === 'кг') grams = qty * 1000;
  else if (unit === 'г' || unit === 'гр' || unit === 'мл') grams = qty;
  else if (unit === 'шт') grams = qty * 60;     // средний размер яйца/фрукта
  else if (unit === 'ст.л.') grams = qty * 15;
  else if (unit === 'ч.л.') grams = qty * 5;
  else if (unit === 'стакан') grams = qty * 200;
  else grams = qty; // без единицы — считаем граммами
  return { foodName: foodName.toLowerCase(), grams: Math.max(5, Math.round(grams)) };
}

function findFoodByName(name: string): FoodItem | undefined {
  const lower = name.toLowerCase().trim();
  // Точное совпадение по name
  let food = FOOD_DB.find(f => (f.name || '').toLowerCase() === lower);
  if (food) return food;
  // Частичное совпадение по name
  food = FOOD_DB.find(f => (f.name || '').toLowerCase().includes(lower) || lower.includes((f.name || '').toLowerCase()));
  if (food) return food;
  // По id (если name похож на id)
  food = FOOD_DB.find(f => f.id.toLowerCase().includes(lower.replace(/\s+/g, '_')));
  if (food) return food;
  // Ключевые слова
  const kwMap: Record<string, string> = {
    'куриная грудка': 'chicken_breast', 'курица': 'chicken_breast', 'грудка': 'chicken_breast',
    'индейка': 'turkey_breast', 'говядина': 'beef_lean', 'стейк': 'beef_steak',
    'рис': 'rice_white', 'баскати': 'rice_basmati', 'басмати': 'rice_basmati',
    'гречка': 'buckwheat', 'овсянка': 'oats', 'овсяные хлопья': 'oats', 'хлопья': 'corn_flakes',
    'брокколи': 'broccoli', 'шпинат': 'spinach', 'томаты': 'tomato', 'помидор': 'tomato',
    'яйца': 'egg_whole', 'яйцо': 'egg_whole', 'белок': 'egg_white',
    'творог': 'cottage_cheese_5', 'молоко': 'milk', 'кефир': 'kefir', 'йогурт': 'yogurt_greek',
    'лосось': 'salmon', 'форель': 'trout', 'тунец': 'tuna_fresh',
    'миндаль': 'almonds', 'грецкие орехи': 'walnuts', 'орехи': 'walnuts',
    'авокадо': 'avocado', 'банан': 'banana', 'яблоко': 'apple',
    'оливковое масло': 'olive_oil', 'масло': 'butter', 'сливочное масло': 'butter',
    'протеин': 'whey_isolate', 'сыворотка': 'whey_isolate', 'казеин': 'casein',
    'семена чиа': 'chia_seeds', 'чиа': 'chia_seeds', 'льняное семя': 'flaxseed',
    'финики': 'dates', 'курага': 'dried_apricots', 'изюм': 'raisins',
    'чечевица': 'lentils', 'нут': 'chickpeas', 'тофу': 'tofu',
    'картофель': 'potato_boiled', 'сладкий картофель': 'sweet_potato',
    'перец': 'red_pepper', 'болгарский перец': 'red_pepper',
    'лук': 'onion', 'чеснок': 'garlic', 'имбирь': 'ginger',
    'соевый соус': 'soy_sauce', 'мед': 'honey', 'корица': 'cinnamon',
  };
  for (const [kw, fid] of Object.entries(kwMap)) {
    if (lower.includes(kw)) {
      const f = FOOD_DB.find(x => x.id === fid);
      if (f) return f;
    }
  }
  return undefined;
}

function roleForFood(food: FoodItem): MealItem['role'] {
  const cat = food.category;
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

function makeMealItem(food: FoodItem, grams: number, role: MealItem['role']): MealItem {
  const cleanGrams = Math.max(5, Math.round(grams / 5) * 5);
  const r = cleanGrams / 100;
  const p = Math.round((food.protein || 0) * r * 10) / 10;
  const f = Math.round((food.fat || 0) * r * 10) / 10;
  const c = Math.round((food.carbs || 0) * r * 10) / 10;
  // KBЖУ-консистентность ≤3%: kcal из формулы (FOOD_DB-дрейф не наследуем)
  const kcal = Math.round(4 * p + 9 * f + 4 * c);
  return {
    id: food.id, name: food.name, amount: cleanGrams, role,
    kcal,
    p,
    f,
    c,
    fiber: Math.round((food.fiber || 0) * r * 10) / 10,
    leucine_mg: 0,
  };
}

// ─── Подбор рецепта под приём ──────────────────────────────────────────

/**
 * Оценивает насколько рецепт подходит под приём пищи.
 * Возвращает score 0-100 (выше = лучше).
 */
export function scoreRecipeForMeal(recipe: Recipe, opts: RecipeMatchOptions): number {
  let score = 50;
  let hardReject = false;

  // 1. Тип приёма (breakfast/lunch/dinner/snack) — match по recipe.meal
  const mealMatch: Record<string, string[]> = {
    breakfast: ['breakfast'],
    lunch: ['lunch'],
    dinner: ['dinner'],
    snack: ['snack', 'snack2'],
    snack2: ['snack', 'snack2'],
    preworkout: ['snack', 'preworkout'],
    postworkout: ['snack', 'postworkout'],
    presleep: ['presleep', 'snack'],
  };
  const acceptableMeals = mealMatch[opts.mealType] || ['lunch', 'dinner'];
  if (acceptableMeals.includes(recipe.meal)) score += 20;
  else { score -= 15; }  // непоходящий meal-тип — серьёзный штраф

  // 2. КБЖУ-соответствие (±15% — отлично, ±30% — норм).
  // Aug 28: ветка >0.80 была МЕРТВА (перекрыта >0.50), а рецепты с девиацией >55% всё равно
  // проходили порог 35-40 и выбирались («ужатые рецепты»). Теперь >55% — hardReject:
  // масштабирование порции (scaleToMealTarget ×0.7-2.2) в режиме «по рецептам» всё равно
  // вытянет рецепт к цели приёма, но за пределами ×2.2 это уже другой рецепт.
  const kcalRatio = recipe.kcal / Math.max(50, opts.targetKcal);
  const kcalDeviation = Math.abs(kcalRatio - 1);
  if (kcalDeviation < 0.15) score += 15;
  else if (kcalDeviation < 0.30) score += 8;
  else if (kcalDeviation < 0.55) score -= 10;
  else { hardReject = true; }

  const proteinRatio = recipe.protein / Math.max(10, opts.targetProteinG);
  if (Math.abs(proteinRatio - 1) < 0.25) score += 10;
  else if (proteinRatio < 0.5) score -= 15;  // усиленный штраф (было -10)

  // 3. usefulness (если задано)
  if (typeof recipe.usefulness === 'number') {
    score += (recipe.usefulness - 5) * 3; // 8.5 → +10.5, 7.0 → +6
  }

  // 4. Время готовки — не больше лимита
  const maxTime = opts.maxPrepTimeMin ?? 60;
  if (recipe.prepTimeMin <= maxTime) score += 5;
  else if (recipe.prepTimeMin > maxTime * 1.5) score -= 15;
  else score -= 5;

  // 5. Навык готовки
  if (opts.cookProfile) {
    const skillMatch: Record<CookSkill, string[]> = {
      basic: ['easy'],
      medium: ['easy', 'medium'],
      advanced: ['easy', 'medium', 'hard'],
    };
    const diff = recipe.difficulty || (recipe.prepTimeMin <= 10 ? 'easy' : recipe.prepTimeMin <= 25 ? 'medium' : 'hard');
    if (skillMatch[opts.cookProfile.skill].includes(diff)) score += 5;
    else score -= 25;  // усиленный штраф (было -20)

    // Частота готовки: weekly → предпочитаем batchFriendly
    if (opts.cookProfile.frequency === 'weekly' && recipe.batchFriendly) score += 10;
    if (opts.cookProfile.frequency === 'daily' && recipe.prepTimeMin <= 20) score += 5;
    if (opts.cookProfile.frequency === 'every_3_days' && recipe.batchFriendly && recipe.prepTimeMin <= 30) score += 5;
  }

  // 6. Исключения/аллергены — проверяем через декомпозицию
  if (recipe.ingredientIds) {
    for (const fid of recipe.ingredientIds) {
      if (opts.excludedIds.has(fid)) { hardReject = true; break; }
    }
  } else {
    // Проверяем по ингредиентам-строкам (менее точно)
    for (const ing of recipe.ingredients) {
      const lower = ing.toLowerCase();
      if (opts.isVegetarian && ['кури','говядин','свин','баран','индей','утка','гусь','кролик','телятин','печен','сердце','язык','мозг','ножки','крылыш','бедро','фарш','рыб','лосос','форел','тунец','скумбри','сельд','сард','кревет','миди','кальмар','осьмин','устриц','икра','угорь'].some(k => lower.includes(k))) {
        hardReject = true; break;
      }
    }
  }

  // 7. Предпочтения пользователя
  if (opts.preferredRecipeNames?.has(recipe.name)) score += 15;

  // 8. Бонус за совпадение с продуктами в приёме — рецепт из тех же продуктов
  if (opts.currentItemIds && opts.currentItemIds.size > 0) {
    let overlap = 0;
    if (recipe.ingredientIds) {
      for (const fid of recipe.ingredientIds) { if (opts.currentItemIds.has(fid)) overlap++; }
    }
    score += overlap * 8;  // +8 за каждый совпадающий продукт
  }

  // 9. Цель (масса/сушка/рекомп) — бонус за теги
  if (opts.goal) {
    const tagsLower = (recipe.tags || []).map(t => t.toLowerCase());
    const has = (kw: string) => tagsLower.some(t => t.includes(kw));
    if (opts.goal === 'mass' || opts.goal === 'bulk') {
      if (has('масса') || has('масс') || has('гейнер') || has('набор') || has('bulk') || has('meal prep')) score += 8;
      if (has('высокий белок') && recipe.protein >= 40) score += 5;
    } else if (opts.goal === 'cut') {
      if (has('сушка') || has('сушк') || has('шред') || has('рельеф') || has('низкий жир') || has('низкий уголь') || has('леан')) score += 8;
      if (recipe.fat <= 12 && recipe.protein >= 35) score += 5;
    } else if (opts.goal === 'recomp' || opts.goal === 'maintenance') {
      if (has('рекомп') || has('поддержка') || has('пп') || has('здоровое') || has('сбалансир')) score += 6;
    }
    if (has('бодибилдинг')) score += 5;
    if (has('пп')) score += 3;
  }

  // Непрерывный тай-брейк: средняя дистанция макросов от цели слегка понижает скор,
  // чтобы среди «насыщенных» 100-балльников побеждал ближайший по КБЖУ, а не первый в БД.
  const parts: Array<[number, number]> = [
    [recipe.kcal, opts.targetKcal], [recipe.protein, opts.targetProteinG],
    [recipe.fat, opts.targetFatG], [recipe.carbs, opts.targetCarbsG],
  ];
  let distSum = 0; let distN = 0;
  for (const [val, tgt] of parts) {
    if (tgt > 0) { distSum += Math.abs(val - tgt) / tgt; distN++; }
  }
  if (distN > 0) score -= Math.min(8, (distSum / distN) * 100 / 12);

  if (hardReject) score = 0;  // жёсткий reject (исключённый ингредиент / девиация >55%) — не кандидат
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Средняя относительная дистанция макросов рецепта от цели (0..∞, меньше = ближе).
 * Используется как тай-брейк при равном скоринге.
 */
export function recipeMacroDistance(recipe: Recipe, opts: Pick<RecipeMatchOptions, 'targetKcal' | 'targetProteinG' | 'targetCarbsG' | 'targetFatG'>): number {
  const parts: Array<[number, number]> = [
    [recipe.kcal, opts.targetKcal], [recipe.protein, opts.targetProteinG],
    [recipe.fat, opts.targetFatG], [recipe.carbs, opts.targetCarbsG],
  ];
  let sum = 0; let n = 0;
  for (const [val, tgt] of parts) {
    if (tgt > 0) { sum += Math.abs(val - tgt) / tgt; n++; }
  }
  return n > 0 ? sum / n : 999;
}

/**
 * Подбирает лучший рецепт для приёма пищи.
 * Возвращает рецепт или null (если нет подходящих).
 */
export function pickRecipeForMeal(
  recipes: Recipe[],
  opts: RecipeMatchOptions,
): Recipe | null {
  const scored = recipes
    .map(r => ({ recipe: r, score: scoreRecipeForMeal(r, opts), dist: recipeMacroDistance(r, opts) }))
    .filter(x => x.score >= 40) // минимальный порог
    // Ранг: бонусно-«накрученные» рецепты могут быть сбиты дистанцией до цели полностью
    .sort((a, b) => (b.score - Math.min(b.score, b.dist * 100 / 4)) - (a.score - Math.min(a.score, a.dist * 100 / 4)));
  return scored.length > 0 ? scored[0].recipe : null;
}

/**
 * Подбирает несколько рецептов (для выбора «несколько на выбор»).
 */
export function pickRecipesForMeal(
  recipes: Recipe[],
  opts: RecipeMatchOptions,
  count: number = 3,
): Recipe[] {
  return recipes
    .map(r => ({ recipe: r, score: scoreRecipeForMeal(r, opts), dist: recipeMacroDistance(r, opts) }))
    .filter(x => x.score >= 35)
    .sort((a, b) => (b.score - Math.min(b.score, b.dist * 100 / 4)) - (a.score - Math.min(a.score, a.dist * 100 / 4)))
    .slice(0, count)
    .map(x => x.recipe);
}

// ─── Совместимость рецептов (вкус + синергия) ──────────────────────────

/**
 * Оценивает совместимость двух рецептов в одном дне.
 * Выше score — лучше сочетаются (0-100).
 */
export function flavorCompatibilityScore(recipeA: Recipe, recipeB: Recipe): number {
  let score = 50;
  // Разные meal-типы — хорошо (завтрак ≠ обед)
  if (recipeA.meal !== recipeB.meal) score += 10;
  // Одинаковые flavorProfile — хорошо (сладкое утро + сладкое утро)
  if (recipeA.flavorProfile && recipeB.flavorProfile) {
    const fpA = recipeA.flavorProfile;
    const fpB = recipeB.flavorProfile;
    let overlap = 0;
    for (const key of ['sweet','salty','sour','spicy','umami'] as const) {
      if ((fpA[key] ?? 0) > 1 && (fpB[key] ?? 0) > 1) overlap++;
    }
    score += overlap * 5;
  }
  // pairsWith — явная совместимость
  if (recipeA.pairsWith?.includes(recipeB.name)) score += 15;
  if (recipeB.pairsWith?.includes(recipeA.name)) score += 15;
  // Разные белковые источники — разнообразие
  const proteinA = recipeA.ingredients.join(' ').toLowerCase();
  const proteinB = recipeB.ingredients.join(' ').toLowerCase();
  const hasChicken = (s: string) => s.includes('кури') || s.includes('грудк');
  const hasFish = (s: string) => s.includes('рыб') || s.includes('лосос') || s.includes('туне');
  const hasBeef = (s: string) => s.includes('говядин') || s.includes('стейк') || s.includes('фарш');
  if ((hasChicken(proteinA) && hasFish(proteinB)) || (hasFish(proteinA) && hasBeef(proteinB)) || (hasChicken(proteinA) && hasBeef(proteinB))) {
    score += 10; // разные источники белка
  }
  return Math.max(0, Math.min(100, score));
}

// ─── Навык готовки и частота ───────────────────────────────────────────

export function defaultCookProfile(): CookProfile {
  return { skill: 'basic', timePerDayMin: 30, frequency: 'daily', batchCooking: false };
}

export function cookProfileFromSettings(s: any): CookProfile {
  const skill: CookSkill = s?.cookingSkill === 'advanced' ? 'advanced' : s?.cookingSkill === 'medium' ? 'medium' : 'basic';
  const freq: CookFrequency = s?.cookingFrequency === 'weekly' ? 'weekly' : s?.cookingFrequency === 'every_3_days' ? 'every_3_days' : 'daily';
  return {
    skill,
    timePerDayMin: typeof s?.cookTimeMin === 'number' ? s.cookTimeMin : 30,
    frequency: freq,
    batchCooking: !!s?.batchCooking,
  };
}

/**
 * Возвращает лимит времени на готовку одного приёма (для pickRecipeForMeal).
 * daily → timePerDayMin / mealsCount
 * every_3_days → timePerDayMin × 3 / mealsCount (готовит на 3 дня)
 * weekly → timePerDayMin × 7 / mealsCount (готовит на неделю)
 */
export function prepTimeBudgetPerMeal(profile: CookProfile, mealsCount: number): number {
  const total = profile.timePerDayMin;
  const days = profile.frequency === 'daily' ? 1 : profile.frequency === 'every_3_days' ? 3 : 7;
  return Math.round((total * days) / Math.max(1, mealsCount));
}

/**
 * Фильтрует рецепты по навыку готовки.
 * basic → только easy (≤15 мин), medium → easy+medium (≤30 мин), advanced → все.
 */
export function filterByCookSkill(recipes: Recipe[], skill: CookSkill): Recipe[] {
  const allowed: Record<CookSkill, string[]> = {
    basic: ['easy'],
    medium: ['easy', 'medium'],
    advanced: ['easy', 'medium', 'hard'],
  };
  return recipes.filter(r => {
    const diff = r.difficulty || (r.prepTimeMin <= 10 ? 'easy' : r.prepTimeMin <= 25 ? 'medium' : 'hard');
    return allowed[skill].includes(diff);
  });
}