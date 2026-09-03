/**
 * planner-weight-mode.ts — G1 (HIGH-VOLUME план, разд. 6): единый режим веса «сырое/готовое».
 *
 * Проблема: FOOD_DB держит обе меры рядом (oats варёный 71 ккал vs oats_dry 367 ккал,
 * rice_white варёный 130 ккал), а план смешивает их в одном дне и даже в одном рецепте
 * без подписи меры — пользователь взвешивает «как написано» с ошибкой ×2.5–3 по крупам.
 *
 * Решение (display-слой, математика per100 НЕ трогается):
 *  - WeightMode: 'cooked' (дефолт, «как на тарелке») | 'raw' («как взвешивать сухим»);
 *  - DRY_TO_COOKED: коэффициенты разваривания для пересчёта отображения;
 *  - displayAmount(): граммы + суффикс меры для бейджа порции;
 *  - toRawPurchaseAmount(): граммы для закупок (покупаем сырую крупу);
 *  - recipeMeasureLint(): ловит смесь сухой+готовой крупы в одном рецепте.
 *
 * Персист: localStorage 'he_planner_weight_mode'.
 */
import { FOOD_DB } from '../../../../core/nutrition-database';

export type WeightMode = 'cooked' | 'raw';
export const WEIGHT_MODE_KEY = 'he_planner_weight_mode';

/** Коэффициент «сырое → готовое» (вес готового = сухой × k). Кулинарные нормы развара. */
export const DRY_TO_COOKED: Record<string, number> = {
  rice: 2.8,
  buckwheat: 2.5,
  oats: 3.0,
  pasta: 2.4,
  bulgur: 2.6,
  lentils: 2.3,
  chickpeas: 2.4,
  beans: 2.4,
  millet: 2.7,
  barley: 2.7,
  quinoa: 2.8,
  couscous: 2.5,
};

const DRY_PATTERNS: Array<{ test: RegExp; key: string }> = [
  { test: /rice|рис/, key: 'rice' },
  { test: /buckwheat|греч/, key: 'buckwheat' },
  { test: /oats|овся|oat_|геркулес|хлопья/, key: 'oats' },
  { test: /pasta|macaroni|spaghetti|noodle|макарон|паста|лапша/, key: 'pasta' },
  { test: /bulgur|булгур/, key: 'bulgur' },
  { test: /lentil|чечевиц/, key: 'lentils' },
  { test: /chickpea|нут/, key: 'chickpeas' },
  { test: /bean|фасоль|beans/, key: 'beans' },
  { test: /millet|пшен/, key: 'millet' },
  { test: /barley|перлов|ячмен/, key: 'barley' },
  { test: /quinoa|киноа/, key: 'quinoa' },
  { test: /couscous|кус-кус|кускус/, key: 'couscous' },
];

function dryKeyFor(foodId: string): string | null {
  const id = (foodId || '').toLowerCase();
  for (const { test, key } of DRY_PATTERNS) {
    if (test.test(id)) return key;
  }
  return null;
}

export type FoodWeightState = 'dry' | 'cooked' | 'other';

/** Мера продукта в каталоге: сухая крупа vs готовое блюдо vs прочее. */
export function foodWeightState(foodId: string): FoodWeightState {
  try {
    const f: any = FOOD_DB.find(x => x.id === foodId);
    const st = f?.foodState as string | undefined;
    if (st === 'dry') return 'dry';
    if (st === 'cooked') return 'cooked';
    // Fallback по плотности для круп без флага: ≥300 ккал = сухая мера.
    if (f && (f.category === 'grain' || f.category === 'carb') && (f.kcal || 0) >= 300 && dryKeyFor(foodId)) {
      return 'dry';
    }
    if (f && dryKeyFor(foodId) && (f.category === 'grain' || f.category === 'carb')) return 'cooked';
    return 'other';
  } catch {
    return 'other';
  }
}

/** Коэффициент развара для продукта (1 = не крупа / неизвестно). */
export function cookFactorFor(foodId: string): number {
  const key = dryKeyFor(foodId);
  if (!key) return 1;
  return DRY_TO_COOKED[key] || 1;
}

/**
 * Отображаемая порция: граммы в выбранном режиме + суффикс меры.
 * Математика КБЖУ не меняется — конвертится только число на экране.
 */
export function displayAmount(foodId: string, amountG: number, mode: WeightMode): { grams: number; suffix: string } {
  const st = foodWeightState(foodId);
  const k = cookFactorFor(foodId);
  if (st === 'dry' && mode === 'cooked' && k > 1) {
    return { grams: Math.round(amountG * k), suffix: 'гот.' };
  }
  if (st === 'cooked' && mode === 'raw' && k > 1) {
    return { grams: Math.max(5, Math.round(amountG / k)), suffix: 'сух.' };
  }
  if (st === 'dry') return { grams: Math.round(amountG), suffix: 'сух.' };
  if (st === 'cooked' && (FOOD_DB.find(x => x.id === foodId) as any)?.category !== undefined) {
    // Суффикс «гот.» ставим только крупам/крахмалистым — мясо/овощи не шумят.
    if (k > 1) return { grams: Math.round(amountG), suffix: 'гот.' };
  }
  return { grams: Math.round(amountG), suffix: '' };
}

/**
 * Вес для закупок: покупаем сырую крупу. Готовая крупа → пересчёт в сухую,
 * сухая и всё остальное — как есть.
 */
export function toRawPurchaseAmount(foodId: string, amountG: number): number {
  const st = foodWeightState(foodId);
  const k = cookFactorFor(foodId);
  if (st === 'cooked' && k > 1) return Math.max(1, Math.round(amountG / k));
  return Math.round(amountG);
}

export function readWeightMode(): WeightMode {
  try {
    return localStorage.getItem(WEIGHT_MODE_KEY) === 'raw' ? 'raw' : 'cooked';
  } catch {
    return 'cooked';
  }
}

export function writeWeightMode(mode: WeightMode): void {
  try {
    localStorage.setItem(WEIGHT_MODE_KEY, mode);
  } catch {}
}

/**
 * Линт рецепта: ДВЕ КРУПЯНЫЕ ОСНОВЫ в разных мерах в одном блюде (напр. рис 150 гот. +
 * гречка 80 сух.) — пользователь не поймёт, что взвешивать сухим, а что готовым.
 * Мелкая сухая панировка/связка (<50 г: oats_dry 20 в фарш) — не нарушение: это не
 * основа, а ингредиент, суффикс «сух.» на бейдже её однозначно помечает.
 * portions опционален (без него — строгая проверка по одним id).
 */
export function recipeMeasureLint(ingredientIds: string[] | undefined, portions?: Record<string, number>): string[] {
  if (!ingredientIds || ingredientIds.length === 0) return [];
  const g = (id: string) => (portions ? portions[id] ?? 100 : 100);
  const dry = ingredientIds.filter(id => foodWeightState(id) === 'dry' && g(id) >= 50);
  const cooked = ingredientIds.filter(id => foodWeightState(id) === 'cooked' && cookFactorFor(id) > 1 && g(id) >= 100);
  if (dry.length > 0 && cooked.length > 0) {
    return [`смесь мер: сухое (${dry.join(', ')}) + готовое (${cooked.join(', ')})`];
  }
  return [];
}
