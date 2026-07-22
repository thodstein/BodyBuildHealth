/**
 * nutrition-micros.ts — Единый хелпер извлечения нутриентов из FoodItem.
 *
 * FOOD_DB хранит нутриенты в РАЗНЫх полях: большинство (723 продукта) в `micros`
 * (Ca/Fe/Mg/Zn/Se/K/Na/Vit*), а ~17-30 продуктов дополнительно в `electrolytes_100g`,
 * `trace_elements_100g`, `vitamins_100g`, `macro_100g`. Раньше разные движки читали
 * то одно, то другое → системные недорепорты (баг #4). Этот хелпер — единый
 * канонический источник: micros → alt-поля.
 */
import type { FoodItem } from "./nutrition-database";

type AnyRec = Record<string, number> | undefined;

/** Карта канонический-ключ → альтернативные имена полей в electrolytes/trace/vitamins/macro. */
const ALT_KEYS: Record<string, string[]> = {
  Ca:   ["calcium_mg", "Ca"],
  Fe:   ["iron_total_mg", "iron_mg", "Fe"],
  Mg:   ["magnesium_mg", "Mg"],
  Zn:   ["zinc_mg", "Zn"],
  Se:   ["selenium_mcg", "Se"],
  K:    ["potassium_mg", "K"],
  Na:   ["sodium_mg", "Na"],
  VitC: ["vitamin_c_mg", "VitC", "vitC"],
  VitD: ["vitamin_d_mcg", "VitD", "vitD"],
  VitB12: ["vitamin_b12_mcg", "VitB12"],
  VitB6: ["vitamin_b6_mg", "VitB6"],
  VitB9: ["vitamin_b9_mcg", "folate_mcg", "VitB9", "Folate"],
  VitA: ["vitamin_a_mcg", "VitA"],
  VitE: ["vitamin_e_mg", "VitE"],
  VitK: ["vitamin_k_mcg", "VitK"],
  VitB2: ["vitamin_b2_mg", "VitB2", "Riboflavin"],
  VitB3: ["vitamin_b3_mg", "VitB3", "Niacin"],
  Iodine: ["iodine_mcg", "I", "Iodine"],
  Omega3: ["omega_3_mg", "Omega3"],
  SatFat: ["saturated_fat_g", "saturated_fat_mg", "SatFat"],
  Cholesterol: ["cholesterol_mg", "Cholesterol"],
  Fiber: ["fiber_g", "Fiber"],
};

/**
 * Извлечь нутриент по каноническому ключу. Приоритет: food.micros[key] →
 * alt-поля (electrolytes_100g/trace_elements_100g/vitamins_100g/macro_100g).
 * Возвращает 0 если нет данных. БЕЗ фейковых fallback'ов (?? 200/100).
 */
export function getMicro(food: FoodItem, key: string): number {
  const m = food.micros as AnyRec;
  const direct = m?.[key];
  if (direct !== undefined && direct > 0) return direct;
  const alts = ALT_KEYS[key];
  if (alts) {
    const e = food.electrolytes_100g as AnyRec;
    const t = food.trace_elements_100g as AnyRec;
    const v = food.vitamins_100g as AnyRec;
    const mg = food.macro_100g as AnyRec;
    for (const k of alts) {
      const val = e?.[k] ?? t?.[k] ?? v?.[k] ?? mg?.[k];
      if (val !== undefined && val > 0) return val;
    }
  }
  return 0;
}

/** Сумма нутриента по списку продуктов с учётом граммовки. */
export function sumMicro(items: { food: FoodItem; grams: number }[], key: string): number {
  let s = 0;
  for (const it of items) s += getMicro(it.food, key) * (it.grams || 0) / 100;
  return s;
}
