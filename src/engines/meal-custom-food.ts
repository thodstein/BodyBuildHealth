/**
 * meal-custom-food.ts — пользовательские продукты (CustomFood) + кастомные цели.
 * Вынесено из meal-tier-generator.engine.ts (Эпик B5: tier-генератор был мёртвым кодом —
 * живыми оставались только эти экспорты; consumers: NutritionCustomFood.tsx,
 * nutrient-gap-filler.engine.ts).
 */
import type { FoodItem } from '../core/nutrition-database';

export interface CustomFoodEntry {
  id: string;
  name: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  category: FoodItem['category'];
  servingSize: string;
  /** Штрихкод упаковки — по нему продукт находится сканером без сети. */
  barcode?: string;
  brand?: string;
  description?: string;
  /** Откуда продукт: вручную, с фото этикетки, из сканера. */
  source?: 'manual' | 'label_photo' | 'barcode';
  /** Сырой OCR-текст этикетки (только для source=label_photo, для сверки). */
  labelText?: string;
  potassium_mg?: number;
  magnesium_mg?: number;
  calcium_mg?: number;
  sodium_mg?: number;
  phosphorus_mg?: number;
  zinc_mg?: number;
  iron_mg?: number;
  selenium_mcg?: number;
  copper_mg?: number;
  manganese_mg?: number;
  iodine_mcg?: number;
  chromium_mcg?: number;
  omega3_mg?: number;
  vitamin_a_mcg?: number;
  vitamin_c_mg?: number;
  vitamin_d_mcg?: number;
  vitamin_e_mg?: number;
  vitamin_k_mcg?: number;
  vitamin_b1_mg?: number;
  vitamin_b2_mg?: number;
  vitamin_b3_mg?: number;
  vitamin_b5_mg?: number;
  vitamin_b6_mg?: number;
  vitamin_b7_mcg?: number;
  vitamin_b9_mcg?: number;
  vitamin_b12_mcg?: number;
  leucine_mg?: number;
  isoleucine_mg?: number;
  valine_mg?: number;
  lysine_mg?: number;
  methionine_mg?: number;
  arginine_mg?: number;
  glutamine_mg?: number;
  tryptophan_mg?: number;
  threonine_mg?: number;
  cysteine_mg?: number;
  creatine_mg?: number;
  taurine_mg?: number;
  coenzyme_q10_mg?: number;
  polyphenols_mg?: number;
  flavonoids_mg?: number;
}

const CUSTOM_FOODS_KEY = 'custom_foods_v1';
const CUSTOM_TARGETS_KEY = 'custom_targets_v1';

/** Событие для экранов поиска/дневника — «база своих продуктов изменилась». */
export const CUSTOM_FOODS_CHANGED_EVENT = 'he:custom-foods-changed';

function notifyChanged(): void {
  try { window.dispatchEvent(new CustomEvent(CUSTOM_FOODS_CHANGED_EVENT)); } catch { /* no window (tests/SSR) */ }
}

function normalizeBarcode(raw: string | undefined): string {
  return String(raw ?? '').replace(/\D/g, '').trim();
}

/** GTIN пишут с ведущим нулём и без — сравниваем оба варианта. */
function barcodeVariants(raw: string | undefined): string[] {
  const bc = normalizeBarcode(raw);
  if (!bc) return [];
  const variants = new Set([bc]);
  if (bc.length === 12) variants.add(`0${bc}`);
  if (bc.length === 13 && bc.startsWith('0')) variants.add(bc.slice(1));
  return [...variants];
}

function normalizeName(raw: string): string {
  return String(raw ?? '').toLowerCase().replace(/ё/g, 'е').replace(/[^a-zа-я0-9]+/gi, ' ').trim();
}

export function saveCustomFood(entry: CustomFoodEntry): void {
  const foods = loadCustomFoods();
  const idx = foods.findIndex(f => f.id === entry.id);
  if (idx >= 0) foods[idx] = entry; else foods.push(entry);
  try { localStorage.setItem(CUSTOM_FOODS_KEY, JSON.stringify(foods)); } catch { /* quota */ }
  notifyChanged();
}

/**
 * Сохранить продукт, не плодя дубли: один и тот же штрихкод — одна запись,
 * а продукт с фото этикетки без штрихкода обновляет совпадение по названию.
 * Возвращает актуальную запись с постоянным id.
 */
export function saveOrUpdateCustomFood(entry: CustomFoodEntry): CustomFoodEntry {
  const foods = loadCustomFoods();
  const barcode = normalizeBarcode(entry.barcode);
  const name = normalizeName(entry.name);
  let idx = -1;
  if (barcode) {
    idx = foods.findIndex(f => barcodeVariants(f.barcode).includes(barcode));
  }
  if (idx < 0 && name) {
    idx = foods.findIndex(f => normalizeName(f.name) === name);
  }
  if (idx >= 0) {
    const merged: CustomFoodEntry = { ...foods[idx], ...entry, id: foods[idx].id };
    foods[idx] = merged;
    try { localStorage.setItem(CUSTOM_FOODS_KEY, JSON.stringify(foods)); } catch { /* quota */ }
    notifyChanged();
    return merged;
  }
  foods.push(entry);
  try { localStorage.setItem(CUSTOM_FOODS_KEY, JSON.stringify(foods)); } catch { /* quota */ }
  notifyChanged();
  return entry;
}

export function loadCustomFoods(): CustomFoodEntry[] {
  try { const raw = localStorage.getItem(CUSTOM_FOODS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

export function findCustomFoodByBarcode(raw: string | undefined): CustomFoodEntry | null {
  const variants = barcodeVariants(raw);
  if (variants.length === 0) return null;
  const foods = loadCustomFoods();
  for (const variant of variants) {
    const hit = foods.find(f => barcodeVariants(f.barcode).includes(variant));
    if (hit) return hit;
  }
  return null;
}

/** Запись своей еды → FoodItem для поиска в дневнике. */
export function customFoodToFoodItem(entry: CustomFoodEntry): FoodItem {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category || 'other',
    kcal: Math.max(0, entry.kcal || 0),
    protein: Math.max(0, entry.protein || 0),
    fat: Math.max(0, entry.fat || 0),
    carbs: Math.max(0, entry.carbs || 0),
    fiber: Math.max(0, entry.fiber || 0),
    gi: 0,
    servingSize: entry.servingSize || '100 г',
    description: entry.description || (entry.source === 'label_photo' ? 'С фото упаковки' : 'Свой продукт'),
    tier: 'basic',
    micros: {
      Na: entry.sodium_mg,
      K: entry.potassium_mg,
      Mg: entry.magnesium_mg,
      Ca: entry.calcium_mg,
      P: entry.phosphorus_mg,
      Zn: entry.zinc_mg,
      Fe: entry.iron_mg,
      Se: entry.selenium_mcg,
      VitA: entry.vitamin_a_mcg,
      VitC: entry.vitamin_c_mg,
      VitD: entry.vitamin_d_mcg,
      VitE: entry.vitamin_e_mg,
      VitK: entry.vitamin_k_mcg,
      VitB12: entry.vitamin_b12_mcg,
    },
  };
}

export function deleteCustomFood(id: string): void {
  const foods = loadCustomFoods().filter(f => f.id !== id);
  try { localStorage.setItem(CUSTOM_FOODS_KEY, JSON.stringify(foods)); } catch { /* quota */ }
  notifyChanged();
}

export function saveCustomTargets(targets: { kcal: number; protein: number; fat: number; carbs: number; fiber: number; water: number }): void {
  localStorage.setItem(CUSTOM_TARGETS_KEY, JSON.stringify(targets));
}

export function loadCustomTargets(): { kcal: number; protein: number; fat: number; carbs: number; fiber: number; water: number } | null {
  try { const raw = localStorage.getItem(CUSTOM_TARGETS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
