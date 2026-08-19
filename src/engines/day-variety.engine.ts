/**
 * day-variety.engine.ts — «variety-скор» дня (доп. функция 9).
 *
 * Оценивает разнообразие рациона по числу уникальных категорий и продуктов FOOD_DB
 * за день. Однообразие (мало категорий) хуже для микронутриентной полноты.
 * Скор 0-10, label по порогам.
 */
import { FOOD_DB } from '../core/nutrition-database';

export interface DayVarietyInput {
  meals: { products: { foodId: string; weightGrams: number }[] }[];
}

export interface DayVarietyResult {
  categories: string[];
  distinctFoods: number;
  score: number;
  label: string;
  color: string;
  rationale: string;
}

export function computeDayVariety(input: DayVarietyInput): DayVarietyResult {
  const catSet = new Set<string>();
  const foodSet = new Set<string>();
  for (const m of (input.meals || [])) {
    for (const p of (m.products || [])) {
      if (!(p.weightGrams > 0)) continue;
      const f = FOOD_DB.find(x => x.id === p.foodId);
      if (!f) continue;
      foodSet.add(f.id);
      if (f.category) catSet.add(f.category);
    }
  }
  const categories = Array.from(catSet).sort();
  const distinctFoods = foodSet.size;
  // 6+ категорий → 9-10; каждая категория ≈ 1.5 балла; до +3 за разнообразие продуктов
  const score = Math.min(10, Math.round((categories.length * 1.5 + Math.min(3, distinctFoods / 4)) * 10) / 10);
  const label = score >= 8 ? 'Отлично' : score >= 5 ? 'Достаточно' : 'Однообразно';
  const color = score >= 8 ? '#22c55e' : score >= 5 ? '#f59e0b' : '#ef4444';
  const rationale = categories.length === 0
    ? 'Нет данных о продуктах.'
    : `Категорий: ${categories.length} (${categories.join(', ')}), уникальных продуктов: ${distinctFoods}. ${score >= 8 ? 'Разнообразие хорошее.' : score >= 5 ? 'Разнообразие среднее.' : 'Рацион однообразный — добавьте овощи/фрукты/разные белковые источники.'}`;
  return { categories, distinctFoods, score, label, color, rationale };
}
