// ============================================================
// nutrition-hgi.engine.ts — Hunger & Glycemic Index Engine
// HGI = composite score combining: GI, insulin index, fiber,
// protein, fat content, and meal composition
// ============================================================

export interface HGIFoodInput {
  name: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  gi?: number;      // glycemic index (0-100)
  ii?: number;      // insulin index (0-150)
  servingG?: number;
}

export interface HGIResult {
  hgiScore: number;        // 0-100 composite HGI score
  hungerScore: number;     // 0-100 (higher = more satiating)
  glycemicLoad: number;    // GL = (GI × carbs_available) / 100
  insulinLoad: number;     // Estimated insulin demand
  label: string;           // 'Очень низкий' | 'Низкий' | 'Средний' | 'Высокий' | 'Очень высокий'
  color: string;
  recommendations: string[];
}

export interface HGIMealInput {
  foods: HGIFoodInput[];
  timing?: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_workout' | 'post_workout';
}

// ─── Single Food HGI ───

const GI_DEFAULTS: Record<string, number> = {
  protein: 0, dairy: 30, carb: 65, veg_fruit: 40, fat: 0, grain: 55, supplement: 20, other: 50,
};

export function calculateHGI(input: HGIFoodInput): HGIResult {
  const gi = input.gi || GI_DEFAULTS['other'] || 50;
  const fiber = input.fiber || 0;
  const protein = input.protein || 0;
  const fat = input.fat || 0;
  const carbs = input.carbs || 0;
  const kcal = input.kcal || 0;
  const availableCarbs = Math.max(0, carbs - fiber);

  // Glycemic Load
  const glycemicLoad = (gi * availableCarbs) / 100;

  // Insulin Load estimation (accounts for protein-induced insulin)
  const insulinLoad = glycemicLoad + protein * 0.3 + fat * 0.1;

  // Hunger Score (how satiating the food is)
  // Fiber + protein + fat → satiety. Higher = more filling
  const hungerScore = Math.min(100, (protein * 2 + fiber * 3 + fat * 1.5 + (100 - gi) * 0.15));

  // HGI Score — composite (lower = better metabolic profile)
  // Weighted combination of GL, insulin demand, and satiety
  const hgiScore = Math.min(100, Math.max(0,
    (glycemicLoad / Math.max(1, availableCarbs)) * 40 +
    (insulinLoad / Math.max(1, availableCarbs + protein)) * 25 +
    (100 - hungerScore / 2) * 0.3 +
    (gi > 70 ? 15 : gi > 55 ? 10 : gi > 40 ? 5 : 0)
  ));

  const label = hgiScore < 20 ? 'Очень низкий' : hgiScore < 40 ? 'Низкий' : hgiScore < 60 ? 'Средний' : hgiScore < 80 ? 'Высокий' : 'Очень высокий';
  const color = hgiScore < 20 ? '#22c55e' : hgiScore < 40 ? '#4ade80' : hgiScore < 60 ? '#f59e0b' : hgiScore < 80 ? '#f97316' : '#ef4444';

  const recommendations: string[] = [];
  if (gi > 70) recommendations.push('Высокий ГИ — добавьте белок или клетчатку для замедления усвоения');
  if (fiber < 3) recommendations.push('Низкое содержание клетчатки — добавьте овощи или отруби');
  if (protein < 10 && kcal > 100) recommendations.push('Низкое содержание белка — добавьте источник протеина');
  if (hungerScore < 30) recommendations.push('Низкая сытость — сочетайте с белком и жирами');

  return {
    hgiScore: Math.round(hgiScore),
    hungerScore: Math.round(hungerScore),
    glycemicLoad: Math.round(glycemicLoad * 10) / 10,
    insulinLoad: Math.round(insulinLoad * 10) / 10,
    label,
    color,
    recommendations,
  };
}

// ─── Meal HGI (combined foods) ───

export function calculateMealHGI(input: HGIMealInput): HGIResult {
  if (!input.foods.length) {
    return { hgiScore: 0, hungerScore: 0, glycemicLoad: 0, insulinLoad: 0, label: 'Нет данных', color: '#888', recommendations: [] };
  }

  const totalProtein = input.foods.reduce((s, f) => s + f.protein, 0);
  const totalFat = input.foods.reduce((s, f) => s + f.fat, 0);
  const totalCarbs = input.foods.reduce((s, f) => s + f.carbs, 0);
  const totalFiber = input.foods.reduce((s, f) => s + f.fiber, 0);
  const totalKcal = input.foods.reduce((s, f) => s + f.kcal, 0);

  // Weighted GI
  const totalCarbGrams = input.foods.reduce((s, f) => s + Math.max(0, f.carbs - (f.fiber || 0)), 0);
  const weightedGI = totalCarbGrams > 0
    ? input.foods.reduce((s, f) => s + (f.gi || GI_DEFAULTS['other']) * Math.max(0, f.carbs - (f.fiber || 0)), 0) / totalCarbGrams
    : 0;

  const result = calculateHGI({
    name: 'meal',
    kcal: totalKcal,
    protein: totalProtein,
    fat: totalFat,
    carbs: totalCarbs,
    fiber: totalFiber,
    gi: Math.round(weightedGI),
  });

  // Override recommendations for meals
  if (totalProtein / totalKcal * 4 < 0.15) result.recommendations.push('Мало белка в приёме — добавьте мясо/рыбу/яйца');
  if (totalFiber < 5) result.recommendations.push('Добавьте овощи для клетчатки');

  return result;
}
