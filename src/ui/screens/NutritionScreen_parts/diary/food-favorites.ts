/**
 * food-favorites.ts — избранные продукты (⭐) дневника и каталога.
 *
 * Раньше в `he_food_favs` лежали только id, а список избранного собирался
 * поиском по FOOD_DB. Продукты сетей (`retail:…`) и продукты, распознанные с
 * упаковки, в FOOD_DB не живут — они молча пропадали из «Избранного» и из
 * «Быстрого добавления». Теперь рядом с id лежит снимок продукта
 * (`he_food_favs_meta`), поэтому избранным может быть любой продукт.
 * Старый формат (массив строк) читается как есть — миграция не нужна.
 */
import { FOOD_DB } from '../../../../core/nutrition-database';

export interface FavFood {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  category?: string;
}

const IDS_KEY = 'he_food_favs';
const META_KEY = 'he_food_favs_meta';
/** Сколько последних продуктов держим в избранном. */
const LIMIT = 100;

function readJson<T>(key: string, fallback: T): T {
  try {
    if (typeof localStorage === 'undefined') return fallback;
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return (parsed ?? fallback) as T;
  } catch {
    return fallback;
  }
}

export function readFavIds(): string[] {
  const value = readJson<unknown>(IDS_KEY, []);
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

export function readFavMeta(): Record<string, FavFood> {
  const value = readJson<unknown>(META_KEY, {});
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, FavFood>)
    : {};
}

export function isFavorite(id: string): boolean {
  return !!id && readFavIds().includes(id);
}

/**
 * Положить в начало избранного (как «недавние»): последнее добавленное всегда
 * под рукой. `limit` меньше 100 — для авто-избранного из поиска.
 */
export function touchFavorite(food: FavFood, limit: number = LIMIT): void {
  if (!food || !food.id) return;
  try {
    const ids = [food.id, ...readFavIds().filter(id => id !== food.id)].slice(0, limit);
    const meta = readFavMeta();
    meta[food.id] = {
      id: food.id,
      name: food.name || 'Продукт',
      kcal: Number(food.kcal) || 0,
      protein: Number(food.protein) || 0,
      fat: Number(food.fat) || 0,
      carbs: Number(food.carbs) || 0,
      category: food.category,
    };
    localStorage.setItem(IDS_KEY, JSON.stringify(ids));
    localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch { /* приватный режим / квота */ }
}

export function addFavorite(food: FavFood): void {
  touchFavorite(food);
}

export function removeFavorite(id: string): void {
  if (!id) return;
  try {
    localStorage.setItem(IDS_KEY, JSON.stringify(readFavIds().filter(x => x !== id)));
    const meta = readFavMeta();
    if (meta[id]) {
      delete meta[id];
      localStorage.setItem(META_KEY, JSON.stringify(meta));
    }
  } catch { /* ignore */ }
}

/** Возвращает новое состояние: true — теперь в избранном. */
export function toggleFavorite(food: FavFood): boolean {
  if (isFavorite(food.id)) {
    removeFavorite(food.id);
    return false;
  }
  addFavorite(food);
  return true;
}

/** id → продукт: сначала FOOD_DB, затем снимок (сети, свои продукты). */
export function resolveFavorites(): FavFood[] {
  const meta = readFavMeta();
  const out: FavFood[] = [];
  const seen = new Set<string>();
  for (const id of readFavIds()) {
    if (seen.has(id)) continue;
    const fromDb = (FOOD_DB as any[]).find(f => f && f.id === id);
    const food: FavFood | undefined = fromDb || meta[id];
    if (!food || !food.name) continue;
    seen.add(id);
    out.push({
      id,
      name: food.name,
      kcal: Number((food as any).kcal) || 0,
      protein: Number((food as any).protein) || 0,
      fat: Number((food as any).fat) || 0,
      carbs: Number((food as any).carbs) || 0,
      category: (food as any).category,
    });
  }
  return out;
}
