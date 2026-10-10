/**
 * planner-micro-reader.ts — ЕДИНЫЙ читатель микронутриентов продукта (P1-фикс «два
 * сумматора»). Раньше существовало две независимые реализации:
 *  - meal-plan-engine.getMicroFromFood: читает `micros` + v2-контейнеры
 *    (electrolytes/vitamins/trace/macro) + IU→мкг нормализацию (VitD ÷40);
 *  - planner-micro-coverage.sumMicros: читал ТОЛЬКО `food.micros`.
 * Следствие: отчёт «Микронутриенты» показывал 0/дефицит у продуктов, чьи значения
 * лежат v2-контейнерах (у лосося VitD только в vitamins_100g), при этом ноты движка
 * те же микро видели — отчёт и план противоречили друг другу на одном дне.
 *
 * Канон для всех читателей — эта функция. VitD IU→мкг (÷40) — §3F-честность FAO.
 */

import type { FoodItem } from "../../../../core/nutrition-database";

export function getMicroFromFood(food: FoodItem, field: string): number {
  const m = food.micros as Record<string, number> | undefined;
  const e = food.electrolytes_100g as Record<string, number> | undefined;
  const t = food.trace_elements_100g as Record<string, number> | undefined;
  const v = food.vitamins_100g as Record<string, number> | undefined;
  const mg = food.macro_100g as Record<string, number> | undefined;
  // Direct match in micros (primary source) — с нормализацией единиц (Omega3 г→мг)
  const direct = m?.[field];
  if (direct !== undefined) {
    if (field === 'Omega3' && direct < 100) return direct * 1000;
    return direct;
  }
  // Field-specific fallbacks for alternative naming
  const fieldMap: Record<string, string[]> = {
    Fe: ['iron_total_mg'], Mg: ['magnesium_mg'], Zn: ['zinc_mg'], K: ['potassium_mg'],
    Ca: ['calcium_mg'], Se: ['selenium_mcg'],
    VitC: ['vitamin_c_mg'], VitD: ['vitamin_d_mcg'], VitB12: ['vitamin_b12_mcg'], VitB9: ['vitamin_b9_mcg'],
    Omega3: ['omega_3_mg'],
  };
  const altKeys = fieldMap[field];
  if (altKeys) {
    for (const key of altKeys) {
      const val = e?.[key] ?? t?.[key] ?? v?.[key] ?? mg?.[key];
      if (val !== undefined) {
        // §3F-честность: дрейф единиц в FOOD_DB — vitamin_d_mcg 87/500 у яйца/лосося
        // физиологически невозможны в мкг (это IU). Нормализуем IU→мкг (÷40), иначе
        // «+500 мкг VitD» в ноте и ложные превышения UL 100.
        if (field === 'VitD' && key === 'vitamin_d_mcg' && val > 50) return Math.round((val / 40) * 10) / 10;
        return val;
      }
    }
  }
  return 0;
}
