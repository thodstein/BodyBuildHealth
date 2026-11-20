/**
 * user-recipes.ts — единое хранилище пользовательских рецептов и избранного.
 *
 * В приложении исторически две «мои рецепты»-базы:
 *  - `he_recipes`   — Кухня (Рецепты → «Мои рецепты»);
 *  - `he_user_recipes` — конструктор рецептов планировщика.
 * Из-за этого рецепт, созданный в одном месте, не находился в другом. Здесь
 * один нормализованный список: читаем оба ключа и склеиваем по названию,
 * новый рецепт пишем в ОБА ключа (planer-совместимый формат), а удаление
 * убирает его отовсюду.
 *
 * Избранное — тот же ключ, что у планировщика (`he_recipe_fav`, массив имён),
 * поэтому звёздочка в дневнике/Кухне сразу видна планировщику и наоборот.
 */

export const USER_RECIPES_KEY = 'he_recipes';
export const PLANNER_RECIPES_KEY = 'he_user_recipes';
export const FAVORITE_RECIPES_KEY = 'he_recipe_fav';

export interface UserRecipeRecord {
  id: string;
  name: string;
  ingredients: string[];
  instructions: string[];
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  /** Приём пищи в терминах планировщика: breakfast/lunch/dinner/snack. */
  meal?: string;
  prepTimeMin?: number;
  tags?: string[];
  description?: string;
  createdAt?: number;
  /** Откуда пришёл рецепт — только для отладки/миграции. */
  source?: 'kitchen' | 'planner';
}

export interface UserRecipeInput {
  name: string;
  ingredients?: string[] | string;
  instructions?: string[] | string;
  kcal?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  meal?: string;
  prepTimeMin?: number;
  tags?: string[] | string;
  description?: string;
}

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const slug = (text: string): string => {
  let h = 5381;
  const s = text.toLowerCase().replace(/ё/g, 'е');
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h).toString(36);
};

function toLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return [];
}

function toTags(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(item => String(item || '').trim()).filter(Boolean);
  if (typeof value === 'string') return value.split(',').map(tag => tag.trim()).filter(Boolean);
  return [];
}

export function recipeKey(name: string): string {
  return String(name || '').toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ').trim();
}

export function normalizeUserRecipe(raw: any, source?: 'kitchen' | 'planner'): UserRecipeRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const name = String(raw.name || '').trim();
  if (!name) return null;
  return {
    id: String(raw.id || `user-${slug(name)}`),
    name,
    ingredients: toLines(raw.ingredients),
    instructions: toLines(raw.instructions),
    kcal: num(raw.kcal),
    protein: num(raw.protein ?? raw.p),
    fat: num(raw.fat ?? raw.f),
    carbs: num(raw.carbs ?? raw.c),
    ...(typeof raw.meal === 'string' && raw.meal ? { meal: raw.meal } : {}),
    ...(num(raw.prepTimeMin ?? raw.prepTime) ? { prepTimeMin: num(raw.prepTimeMin ?? raw.prepTime) } : {}),
    ...(toTags(raw.tags).length > 0 ? { tags: toTags(raw.tags) } : {}),
    ...(typeof raw.description === 'string' && raw.description.trim() ? { description: raw.description } : {}),
    ...(num(raw.createdAt) ? { createdAt: num(raw.createdAt) } : {}),
    ...(source ? { source } : {}),
  };
}

function readJsonArray(key: string): any[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeJsonArray(key: string, value: unknown[]): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode / quota */ }
}

/** Все пользовательские рецепты из обеих баз, без дублей по названию. */
export function readUserRecipes(): UserRecipeRecord[] {
  const out: UserRecipeRecord[] = [];
  const seen = new Set<string>();
  const push = (list: any[], source: 'kitchen' | 'planner') => {
    for (const raw of list) {
      const recipe = normalizeUserRecipe(raw, source);
      if (!recipe) continue;
      const key = recipeKey(recipe.name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(recipe);
    }
  };
  // Кухня — главный источник для UI; планировщик дополняет его своими рецептами.
  push(readJsonArray(USER_RECIPES_KEY), 'kitchen');
  push(readJsonArray(PLANNER_RECIPES_KEY), 'planner');
  return out.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

/** Есть ли рецепт с таким названием в какой-либо из баз. */
export function hasUserRecipe(name: string): boolean {
  const key = recipeKey(name);
  return readUserRecipes().some(recipe => recipeKey(recipe.name) === key);
}

/**
 * Создаёт рецепт в обеих базах и возвращает нормализованную запись.
 * Планировщик читает `he_user_recipes` (объекты с prepTime/meal/tags),
 * Кухня — `he_recipes`; пишем совместимую с обоими форму.
 */
export function createUserRecipe(input: UserRecipeInput): UserRecipeRecord {
  const now = Date.now();
  const recipe: UserRecipeRecord = {
    id: `r-${now}-${Math.random().toString(36).slice(2, 7)}`,
    name: String(input.name || '').trim(),
    ingredients: toLines(input.ingredients),
    instructions: toLines(input.instructions),
    kcal: num(input.kcal),
    protein: num(input.protein),
    fat: num(input.fat),
    carbs: num(input.carbs),
    meal: input.meal || 'lunch',
    prepTimeMin: num(input.prepTimeMin) || 10,
    tags: toTags(input.tags),
    ...(String(input.description || '').trim() ? { description: String(input.description).trim() } : {}),
    createdAt: now,
    source: 'kitchen',
  };

  const kitchenRaw = readJsonArray(USER_RECIPES_KEY);
  writeJsonArray(USER_RECIPES_KEY, [...kitchenRaw.filter(r => recipeKey(r?.name) !== recipeKey(recipe.name)), recipe]);

  const plannerRaw = readJsonArray(PLANNER_RECIPES_KEY);
  const plannerRecipe = {
    ...recipe,
    prepTime: recipe.prepTimeMin,
    userCreated: true,
  };
  writeJsonArray(PLANNER_RECIPES_KEY, [...plannerRaw.filter(r => recipeKey(r?.name) !== recipeKey(recipe.name)), plannerRecipe]);

  return recipe;
}

/** Удаляет рецепт из обеих баз (по id или, если id не совпал, по названию). */
export function deleteUserRecipe(recipe: { id?: string; name?: string }): UserRecipeRecord[] {
  const id = recipe?.id ? String(recipe.id) : '';
  const key = recipe?.name ? recipeKey(recipe.name) : '';
  const removeFrom = (list: any[]) => list.filter(raw => {
    const rawId = raw?.id ? String(raw.id) : '';
    const matchesId = Boolean(id) && rawId === id;
    const matchesName = Boolean(key) && recipeKey(String(raw?.name || '')) === key;
    return !matchesId && !matchesName;
  });
  writeJsonArray(USER_RECIPES_KEY, removeFrom(readJsonArray(USER_RECIPES_KEY)));
  writeJsonArray(PLANNER_RECIPES_KEY, removeFrom(readJsonArray(PLANNER_RECIPES_KEY)));
  return readUserRecipes();
}

/** Имена избранных рецептов (общий ключ с планировщиком). */
export function readFavoriteRecipeNames(): string[] {
  return readJsonArray(FAVORITE_RECIPES_KEY).filter((name): name is string => typeof name === 'string' && Boolean(name));
}

export function isFavoriteRecipe(name: string): boolean {
  const key = recipeKey(name);
  return readFavoriteRecipeNames().some(favorite => recipeKey(favorite) === key);
}

/** Переключает избранное; возвращает новое состояние рецепта. */
export function toggleRecipeFavorite(name: string): boolean {
  const target = String(name || '').trim();
  if (!target) return false;
  const key = recipeKey(target);
  const current = readFavoriteRecipeNames();
  const exists = current.some(favorite => recipeKey(favorite) === key);
  const next = exists ? current.filter(favorite => recipeKey(favorite) !== key) : [...current, target];
  writeJsonArray(FAVORITE_RECIPES_KEY, next);
  return !exists;
}

/** Убирает рецепт из избранного (например, когда сам рецепт удалён). */
export function removeRecipeFavorite(name: string): void {
  const key = recipeKey(name);
  const current = readFavoriteRecipeNames();
  const next = current.filter(favorite => recipeKey(favorite) !== key);
  if (next.length !== current.length) writeJsonArray(FAVORITE_RECIPES_KEY, next);
}
