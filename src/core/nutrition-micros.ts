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

/**
 * Клетчатка на 100 г продукта.
 *
 * В `FOOD_DB` клетчатка лежит в верхнеуровневом `fiber` (395 позиций с >0),
 * в записях OFF/USDA — тоже в `fiber`, а распознанная этикетка/фото кладёт её
 * в канон `micros.fiber_g`. Приоритет: верхнеуровневое `fiber` → `micros.fiber_g`.
 * Нет данных — 0 (никаких «типичных 5 г»).
 */
export function fiberPer100(food: { fiber?: number; micros?: Record<string, number> } | null | undefined): number {
  if (!food) return 0;
  const top = Number(food.fiber);
  if (Number.isFinite(top) && top > 0) return top;
  const m = food.micros;
  const canon = Number(m?.fiber_g ?? m?.Fiber);
  return Number.isFinite(canon) && canon > 0 ? canon : 0;
}

/** Клетчатка порции в граммах, округлённая до 0.1 г. Нет данных — 0. */
export function fiberPortionG(per100: number, grams: number): number {
  if (!(per100 > 0) || !(grams > 0)) return 0;
  return Math.round(((per100 * grams) / 100) * 10) / 10;
}

/**
 * Добавить `fiber_g` в микросы ПОРЦИИ. Существующее значение не перетираем:
 * этикетка/фото могли дать точную клетчатку, а каталог — среднюю по продукту.
 * Пустой результат (ни микросов, ни клетчатки) → undefined, чтобы не плодить `{}`.
 */
export function addFiberMicros(
  micros: Record<string, number> | undefined,
  food: { fiber?: number; micros?: Record<string, number> } | null | undefined,
  grams: number,
): Record<string, number> | undefined {
  const base: Record<string, number> = micros ? { ...micros } : {};
  // `Fiber` — второй ключ того же нутриента (есть у ~7 позиций FOOD_DB). Дневные
  // итоги суммируют ЛЮБЫЕ ключи, а UI читает только `fiber_g`, поэтому переносим
  // значение в канон и убираем дубль: иначе клетчатка терялась (у `Fiber` нет
  // подписи в UI) или считалась дважды (оба ключа в одной записи).
  if (Number(base.Fiber) > 0) {
    if (!(Number(base.fiber_g) > 0)) base.fiber_g = Number(base.Fiber);
    delete base.Fiber;
  }
  const add = fiberPortionG(fiberPer100(food), grams);
  if (add > 0 && !(Number(base.fiber_g) > 0)) base.fiber_g = add;
  return Object.keys(base).length > 0 ? base : undefined;
}
