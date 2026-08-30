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

export function saveCustomFood(entry: CustomFoodEntry): void {
  const foods = loadCustomFoods();
  const idx = foods.findIndex(f => f.id === entry.id);
  if (idx >= 0) foods[idx] = entry; else foods.push(entry);
  localStorage.setItem(CUSTOM_FOODS_KEY, JSON.stringify(foods));
}

export function loadCustomFoods(): CustomFoodEntry[] {
  try { const raw = localStorage.getItem(CUSTOM_FOODS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

export function deleteCustomFood(id: string): void {
  const foods = loadCustomFoods().filter(f => f.id !== id);
  localStorage.setItem(CUSTOM_FOODS_KEY, JSON.stringify(foods));
}

export function saveCustomTargets(targets: { kcal: number; protein: number; fat: number; carbs: number; fiber: number; water: number }): void {
  localStorage.setItem(CUSTOM_TARGETS_KEY, JSON.stringify(targets));
}

export function loadCustomTargets(): { kcal: number; protein: number; fat: number; carbs: number; fiber: number; water: number } | null {
  try { const raw = localStorage.getItem(CUSTOM_TARGETS_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}
