/**
 * recipe-to-diary.ts — превращает рецепт (встроенный из базы «Кухни» или
 * пользовательский из «Моих рецептов») в полноценную запись дневника:
 * блюдо целиком + продукты с КБЖУ каждого.
 *
 * Чистый слой: без React и без тяжёлого чанка планировщика. Декомпозиция
 * ingredientIds × portions → FOOD_DB берётся из data/recipe-decompose (тот же
 * источник, что у планировщика и сборки RECIPE_DB), а свободный текст
 * пользовательских рецептов разбирается через каталог FOOD_DB
 * (nutrition-ocr-parser: findFood/quantityToGrams).
 */
import { decomposeRecipeRaw } from '../../../../data/recipe-decompose';
import { fillMissingMicros, findFood, quantityToGrams } from '../../../../engines/nutrition-ocr-parser';
import type { FoodItem } from '../../../../core/nutrition-database';
import type { Recipe } from '../../../../engines/nutrition-periodization.engine';
import type { DiaryItem } from '../types';
import type { DiaryRecipeComponent } from '../diary-storage';
import { toIngredientRows } from './user-recipes';

/**
 * Рецепт + состав с КБЖУ по продуктам. Пользовательский рецепт может хранить
 * КБЖУ ингредиентов, введённое руками (products вне каталога), — тогда состав
 * берём как есть, а не пересобираем из строк.
 */
export type RecipeWithIngredientRows = Recipe & { ingredientRows?: DiaryRecipeComponent[] };

const round0 = (v: number) => Math.round(Number.isFinite(v) ? v : 0);
const round1 = (v: number) => Math.round((Number.isFinite(v) ? v : 0) * 10) / 10;

function scaleComponent(c: DiaryRecipeComponent, factor: number): DiaryRecipeComponent {
  if (!Number.isFinite(factor) || factor === 1) return c;
  return {
    ...c,
    qty: Math.max(1, Math.round(c.qty * factor)),
    kcal: round0(c.kcal * factor),
    p: round1(c.p * factor),
    f: round1(c.f * factor),
    c: round1(c.c * factor),
  };
}

/** Подгоняет состав под заявленную калорийность рецепта (как scaleToRecipeKcal в плане). */
function scaleComponentsToKcal(components: DiaryRecipeComponent[], targetKcal: number): DiaryRecipeComponent[] {
  if (components.length === 0 || !(targetKcal > 0)) return components;
  const current = components.reduce((sum, c) => sum + (c.kcal || 0), 0);
  if (current <= 0) return components;
  const factor = targetKcal / current;
  if (Math.abs(factor - 1) < 0.05) return components;
  return components.map(c => scaleComponent(c, factor));
}

/**
 * Разбирает строку ингредиента «Куриная грудка 200 г» / «2 яйца» /
 * «Оливковое масло 1 ст. л.». Возвращает название без количества и граммы.
 */
export function parseIngredientLine(line: string, food?: FoodItem): { name: string; grams: number } {
  const text = String(line || '').trim().replace(/\s+/g, ' ');
  if (!text) return { name: '', grams: 100 };
  const unitRe = '(г|гр|грамм(?:а|ов)?|мл|шт|яйц(?:о|а)?|ст\\.?\\s*л\\.?|ч\\.?\\s*л\\.?|стакан(?:а)?|ломт(?:ик|ика|иков)?|кусок|кусоч(?:ек|ка|ков)|порци(?:я|и|й)|зубчик(?:а|ов)?|щепот(?:ь|и|ка))';
  const re = new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*${unitRe}?`, 'gi');
  let last: RegExpExecArray | null = null;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) last = match;
  if (!last) return { name: text, grams: 100 };
  const unit = (last[2] || '').toLowerCase();
  const tail = text.slice(last.index + last[0].length).trim();
  // «Творог 5%» — это жирность, а не порция: без единицы измерения и без
  // числа в конце строки такое число граммами не считаем.
  const followedByPercent = text[last.index + last[0].length] === '%';
  const looksLikePortion = Boolean(unit) || (tail.length === 0 && !followedByPercent && last.index > 0);
  if (!looksLikePortion) return { name: text, grams: 100 };
  let name = (text.slice(0, last.index) + ' ' + text.slice(last.index + last[0].length))
    .replace(/\s+/g, ' ')
    .replace(/[\s,;:–—-]+$/g, '')
    .trim();
  // «2 яйца» / «1 стакан» — продукт спрятан в единице измерения.
  if (!name) {
    if (/яйц/.test(unit)) name = 'яйцо';
    else if (/стакан/.test(unit)) name = 'стакан';
  }
  const value = Number.parseFloat(last[1].replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return { name: name || text, grams: 100 };
  const grams = Math.max(1, Math.round(quantityToGrams(`${value} ${unit}`.trim(), food)));
  return { name: name || text, grams };
}

/** Строки ингредиентов пользовательского рецепта → продукты с КБЖУ. */
export function componentsFromIngredientLines(lines: string[]): DiaryRecipeComponent[] {  const out: DiaryRecipeComponent[] = [];
  for (const raw of lines || []) {
    const parsed = parseIngredientLine(raw);
    if (!parsed.name) continue;
    // Продукт ищем по названию без количества; граммы пересчитываем уже с
    // найденным продуктом — иначе «2 яйца» стали бы 200 г вместо 100 г.
    const food = findFood(parsed.name);
    const grams = food ? parseIngredientLine(raw, food).grams : parsed.grams;
    const name = parsed.name;
    if (!food) {
      // Название и количество сохраняем — пользователь видит состав рецепта,
      // даже если продукт не удалось сопоставить с каталогом.
      out.push({ name, qty: grams, kcal: 0, p: 0, f: 0, c: 0 });
      continue;
    }
    const factor = grams / 100;
    out.push({
      name: food.name,
      qty: grams,
      kcal: round0((food.kcal || 0) * factor),
      p: round1((food.protein || 0) * factor),
      f: round1((food.fat || 0) * factor),
      c: round1((food.carbs || 0) * factor),
      foodId: food.id,
    });
  }
  return out;
}

/**
 * Готовый состав рецепта (КБЖУ на вес каждого продукта) → компоненты записи.
 * Введённые руками значения не пересчитываются; если строка осталась без КБЖУ,
 * пробуем подставить каталог — так «Соус 30 г» не превращается в нули.
 */
export function componentsFromRecipeRows(rows: DiaryRecipeComponent[]): DiaryRecipeComponent[] {
  return (rows || [])
    .filter(row => String(row?.name || '').trim())
    .map(row => {
      const name = String(row.name).trim();
      const qty = Math.max(1, Math.round(Number(row.qty) || 100));
      const entered = (Number(row.kcal) || 0) > 0
        || (Number(row.p) || 0) > 0
        || (Number(row.f) || 0) > 0
        || (Number(row.c) || 0) > 0;
      if (entered) {
        // Введённое руками КБЖУ — источник истины. foodId не додумываем по
        // похожему названию: чужой продукт в анализаторе хуже, чем пропуск.
        return {
          name,
          qty,
          kcal: round0(Number(row.kcal) || 0),
          p: round1(Number(row.p) || 0),
          f: round1(Number(row.f) || 0),
          c: round1(Number(row.c) || 0),
          ...(row.foodId ? { foodId: row.foodId } : {}),
        };
      }
      const food = findFood(name);
      if (!food) return { name, qty, kcal: 0, p: 0, f: 0, c: 0 };
      const factor = qty / 100;
      return {
        name: food.name,
        qty,
        kcal: round0((food.kcal || 0) * factor),
        p: round1((food.protein || 0) * factor),
        f: round1((food.fat || 0) * factor),
        c: round1((food.carbs || 0) * factor),
        foodId: food.id,
      };
    });
}

/** Состав любого рецепта (встроенного или пользовательского) в продуктах. */
export function recipeComponents(recipe: RecipeWithIngredientRows): DiaryRecipeComponent[] {
  // Пользователь ввёл КБЖУ по продуктам — это источник истины, каталог не главный.
  if (Array.isArray(recipe.ingredientRows) && recipe.ingredientRows.length > 0) {
    return componentsFromRecipeRows(recipe.ingredientRows);
  }
  const decomposed = decomposeRecipeRaw(recipe);
  if (decomposed.length > 0) {
    const components = decomposed.map<DiaryRecipeComponent>(item => ({
      name: item.name,
      qty: Math.max(1, Math.round(item.amount)),
      kcal: round0(item.kcal),
      p: round1(item.p),
      f: round1(item.f),
      c: round1(item.c),
      foodId: item.id,
    }));
    return scaleComponentsToKcal(components, recipe.kcal);
  }
  return componentsFromIngredientLines(recipe.ingredients || []);
}

/** Пользовательский рецепт из «Моих рецептов» (Кухня) → объект формы Recipe. */
export function customRecipeToRecipe(raw: any): RecipeWithIngredientRows {
  const ingredientRows = toIngredientRows(raw?.ingredientRows);
  return {
    name: String(raw?.name || 'Мой рецепт'),
    meal: typeof raw?.meal === 'string' ? raw.meal : 'other',
    prepTimeMin: Number(raw?.prepTimeMin) || 0,
    kcal: Number(raw?.kcal) || 0,
    protein: Number(raw?.protein) || 0,
    fat: Number(raw?.fat) || 0,
    carbs: Number(raw?.carbs) || 0,
    ingredients: Array.isArray(raw?.ingredients) ? raw.ingredients.map(String) : [],
    ...(ingredientRows.length > 0 ? { ingredientRows } : {}),
    instructions: Array.isArray(raw?.instructions)
      ? raw.instructions.map(String)
      : typeof raw?.instructions === 'string' && raw.instructions.trim()
        ? [raw.instructions]
        : [],
    tags: Array.isArray(raw?.tags) ? raw.tags.map(String) : [],
    description: typeof raw?.description === 'string' ? raw.description : undefined,
  };
}

export interface RecipeDiaryEntryOptions {
  /** Множитель порции: 0.5 / 1 / 1.5 / 2. */
  servings?: number;
  /** Рецепт из «Моих рецептов» (Кухня → ＋ Рецепт). */
  custom?: boolean;
}

/**
 * Готовая запись для дневника. `kcal/p/f/c` — на 100 г записи (как у любого
 * продукта в очереди), `qty` — общий вес порции; `recipe.components` хранит
 * КБЖУ каждого продукта.
 */
export function buildRecipeDiaryEntry(recipe: RecipeWithIngredientRows, opts: RecipeDiaryEntryOptions = {}): DiaryItem {
  const servings = Math.max(0.25, Math.min(5, Number(opts.servings) || 1));
  let components = recipeComponents(recipe);
  if (servings !== 1) components = components.map(c => scaleComponent(c, servings));

  const totalKcal = components.reduce((sum, c) => sum + (c.kcal || 0), 0);
  const totalP = components.reduce((sum, c) => sum + (c.p || 0), 0);
  const totalF = components.reduce((sum, c) => sum + (c.f || 0), 0);
  const totalC = components.reduce((sum, c) => sum + (c.c || 0), 0);
  const totalWeight = components.reduce((sum, c) => sum + (c.qty || 0), 0);

  // Если каталог не сопоставил ни один продукт — не теряем рецепт: в дневник
  // уходят заявленные автором КБЖУ и общий вес (состав остаётся текстовыми
  // строками, если они были).
  const fallbackKcal = round0((recipe.kcal || 0) * servings);
  const fallbackP = round1((recipe.protein || 0) * servings);
  const fallbackF = round1((recipe.fat || 0) * servings);
  const fallbackC = round1((recipe.carbs || 0) * servings);
  const weight = totalWeight > 0 ? Math.max(10, Math.round(totalWeight)) : 100 * servings;
  const kcal = totalWeight > 0 && totalKcal > 0 ? totalKcal : fallbackKcal;
  const p = totalWeight > 0 && totalKcal > 0 ? totalP : fallbackP;
  const f = totalWeight > 0 && totalKcal > 0 ? totalF : fallbackF;
  const c = totalWeight > 0 && totalKcal > 0 ? totalC : fallbackC;

  const per100 = (value: number, decimals = 1) => {
    const factor = 10 ** decimals;
    return Math.round((value / weight) * 100 * factor) / factor;
  };

  return {
    name: recipe.name,
    // 2 знака после запятой: итог по записи остаётся равным сумме продуктов
    // даже при некрасивом общем весе (например, 437 г).
    kcal: per100(kcal, 2),
    p: per100(p),
    f: per100(f),
    c: per100(c),
    qty: weight,
    category: 'other',
    recipe: {
      name: recipe.name,
      servings,
      totalWeight: weight,
      components,
      ...(opts.custom ? { custom: true } : {}),
    },
  };
}

/**
 * Микронутриенты блюда = сумма микронутриентов его продуктов (в граммах состава).
 * Без этого рецепт — целый приём — выпадает из отчёта по витаминам/минералам:
 * в дневнике у записи-блюда нет своего foodId, сопоставить её с каталогом нельзя.
 */
export function recipeMicros(components: DiaryRecipeComponent[]): Record<string, number> | undefined {
  const total: Record<string, number> = {};
  let filled = false;
  for (const component of components || []) {
    const grams = Number(component?.qty) || 0;
    if (grams <= 0) continue;
    const micros = fillMissingMicros(String(component?.name || ''), grams);
    for (const [key, value] of Object.entries(micros)) {
      const amount = Number(value);
      if (!Number.isFinite(amount) || amount <= 0) continue;
      total[key] = Math.round(((total[key] || 0) + amount) * 100) / 100;
      filled = true;
    }
  }
  return filled ? total : undefined;
}

/** Пересчитывает состав записи при изменении её веса в редакторе дневника. */
export function scaleDiaryRecipeMeta(
  recipe: DiaryItem['recipe'] | undefined,
  factor: number,
): DiaryItem['recipe'] | undefined {
  if (!recipe || !Array.isArray(recipe.components) || recipe.components.length === 0) return recipe;
  if (!Number.isFinite(factor) || factor <= 0 || Math.abs(factor - 1) < 0.001) return recipe;
  return {
    ...recipe,
    totalWeight: Math.max(1, Math.round(recipe.totalWeight * factor)),
    components: recipe.components.map(c => scaleComponent(c, factor)),
  };
}
