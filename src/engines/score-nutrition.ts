// ── Score Nutrition Engine — оценка качества питания по ТЗ-логике ──
// @deprecated — дубль. Используйте nutrition-report.engine + nutrition-quality.engine
// Оставлен для обратной совместимости (тесты). TDEE фикс 175/165 — неточный, hydration=mealCount.
// Risk_total = Σ(Factor_i * Weight_i)

import type { ModuleSystemScore, ModuleResult } from './score-engine';

// ─── Types ───

export interface NutritionInput {
  meals: Array<{
    foods: Array<{ id: string; name: string; grams: number; protein: number; fat: number; carbs: number; kcal: number; fiber: number }>;
  }>;
  weight: number;
  age: number;
  sex: 'male' | 'female';
  goal?: 'cut' | 'maintain' | 'bulk';
  activityLevel?: 'low' | 'moderate' | 'high';
}

interface NutritionDimension {
  id: string;
  label: string;
  icon: string;
  score: number;
  maxScore: number;
  details: string[];
}

// ─── Scoring Dimensions ───

const DIMENSION_CONFIG: Record<string, { label: string; icon: string; weight: number }> = {
  protein_quality: { label: 'Качество белка', icon: '🥩', weight: 1.4 },
  fat_profile: { label: 'Профиль жиров', icon: '🫒', weight: 1.2 },
  carb_quality: { label: 'Качество углеводов', icon: '🌾', weight: 1.0 },
  micronutrient: { label: 'Микронутриенты', icon: '🥦', weight: 1.3 },
  hydration: { label: 'Гидратация', icon: '💧', weight: 0.8 },
  processing: { label: 'Степень обработки', icon: '🏭', weight: 1.1 },
  meal_timing: { label: 'Режим питания', icon: '⏰', weight: 0.9 },
  kcal_balance: { label: 'Калорийность', icon: '⚡', weight: 1.0 },
};

const MEAL_COUNTS: Record<string, number> = { low: 2, moderate: 3, high: 5 };

export function analyzeNutrition(input: NutritionInput): ModuleResult {
  const { meals, weight, age, sex, goal, activityLevel } = input;

  // Aggregate daily totals
  let totalKcal = 0, totalProtein = 0, totalFat = 0, totalCarbs = 0, totalFiber = 0;
  const mealCount = meals.filter(m => m.foods.length > 0).length;
  for (const meal of meals) {
    for (const f of meal.foods) {
      totalKcal += f.kcal;
      totalProtein += f.protein;
      totalFat += f.fat;
      totalCarbs += f.carbs;
      totalFiber += f.fiber;
    }
  }

  // TDEE estimate (Mifflin-St Jeor)
  const bmr = sex === 'male'
    ? 10 * weight + 6.25 * 175 - 5 * age + 5
    : 10 * weight + 6.25 * 165 - 5 * age - 161;
  const pal = activityLevel === 'low' ? 1.375 : activityLevel === 'moderate' ? 1.55 : 1.725;
  const tdee = Math.round(bmr * pal);

  // Phase 1: Score each dimension (TZ: Factor_i)
  const dimensions: NutritionDimension[] = [];

  // Protein quality
  const proteinPerKg = weight > 0 ? totalProtein / weight : 0;
  const proteinScore = Math.min(100, (proteinPerKg / 2.0) * 100);
  dimensions.push({
    id: 'protein_quality', label: 'Качество белка', icon: '🥩',
    score: Math.round(proteinScore),
    maxScore: 100,
    details: [`${totalProtein.toFixed(1)}г белка (${proteinPerKg.toFixed(1)} г/кг)`],
  });

  // Fat profile
  const fatCalPct = totalKcal > 0 ? (totalFat * 9 / totalKcal) * 100 : 0;
  const fatScore = Math.min(100, Math.max(0, 100 - Math.abs(fatCalPct - 30) * 3));
  dimensions.push({
    id: 'fat_profile', label: 'Профиль жиров', icon: '🫒',
    score: Math.round(fatScore),
    maxScore: 100,
    details: [`${totalFat.toFixed(1)}г жиров (${fatCalPct.toFixed(0)}% от ккал)`],
  });

  // Carb quality (fiber density)
  const fiberPer1000Kcal = totalKcal > 0 ? (totalFiber / totalKcal) * 1000 : 0;
  const carbScore = Math.min(100, (fiberPer1000Kcal / 14) * 100);
  dimensions.push({
    id: 'carb_quality', label: 'Качество углеводов', icon: '🌾',
    score: Math.round(carbScore),
    maxScore: 100,
    details: [`${totalCarbs.toFixed(1)}г углеводов, ${totalFiber.toFixed(1)}г клетчатки (${fiberPer1000Kcal.toFixed(1)}г/1000ккал)`],
  });

  // Micronutrient density (proxy: fiber + protein quality)
  const microScore = Math.round((proteinScore * 0.4 + carbScore * 0.6));
  dimensions.push({
    id: 'micronutrient', label: 'Микронутриенты', icon: '🥦',
    score: Math.min(100, microScore),
    maxScore: 100,
    details: [`Плотность микронутриентов: ${microScore}%`],
  });

  // Hydration (meal count proxy)
  const hydScore = Math.min(100, (mealCount / 5) * 100);
  dimensions.push({
    id: 'hydration', label: 'Режим питания', icon: '💧',
    score: Math.round(hydScore * 100) / 100,
    maxScore: 100,
    details: [`${mealCount} приёмов пищи/день`],
  });

  // Processing score (estimated from protein sources diversity)
  const processingScore = totalKcal > 0 ? Math.min(100, Math.round((totalFiber / 25) * 100)) : 50;
  dimensions.push({
    id: 'processing', label: 'Степень обработки', icon: '🏭',
    score: processingScore,
    maxScore: 100,
    details: [`Оценка по клетчатке: ${processingScore}%`],
  });

  // Meal timing (meal count regularity)
  const expectedMeals = MEAL_COUNTS[activityLevel || 'moderate'];
  const timingScore = Math.min(100, (mealCount / expectedMeals) * 100);
  dimensions.push({
    id: 'meal_timing', label: 'Режим питания', icon: '⏰',
    score: Math.round(timingScore),
    maxScore: 100,
    details: [`${mealCount}/${expectedMeals} приёмов`],
  });

  // Kcal balance
  let kcalScore = 50;
  if (tdee > 0) {
    const ratio = totalKcal / tdee;
    if (goal === 'cut') kcalScore = Math.max(0, 100 - Math.abs(ratio - 0.8) * 200);
    else if (goal === 'bulk') kcalScore = Math.max(0, 100 - Math.abs(ratio - 1.15) * 200);
    else kcalScore = Math.max(0, 100 - Math.abs(ratio - 1.0) * 200);
  }
  dimensions.push({
    id: 'kcal_balance', label: 'Калорийность', icon: '⚡',
    score: Math.round(kcalScore),
    maxScore: 100,
    details: [`${Math.round(totalKcal)}/${tdee} ккал (${tdee > 0 ? Math.round((totalKcal / tdee) * 100) : 0}%)`],
  });

  // Phase 2: Convert dimensions to systems (TZ: Σ(Risk_factor_i * Weight_i))
  const systems: ModuleSystemScore[] = [];
  for (const dim of dimensions) {
    const config = DIMENSION_CONFIG[dim.id];
    if (!config) continue;
    const deficit = 100 - dim.score;
    const weightedScore = Math.min(100, Math.round(deficit * config.weight));
    let level: 'low' | 'moderate' | 'high' = 'low';
    if (weightedScore >= 60) level = 'high';
    else if (weightedScore >= 30) level = 'moderate';
    systems.push({
      id: dim.id,
      label: config.label,
      icon: config.icon,
      rawScore: Math.round(deficit),
      weightedScore,
      level,
      coverage: 0, afterSupport: weightedScore, reduction: 0,
    });
  }

  systems.sort((a, b) => b.weightedScore - a.weightedScore);

  const overallRaw = systems.length > 0 ? Math.max(...systems.map(s => s.weightedScore)) : 0;

  // Phase 3: Recommendations
  const recommendations: string[] = [];
  const high = systems.filter(s => s.weightedScore >= 60);
  const moderate = systems.filter(s => s.weightedScore >= 30 && s.weightedScore < 60);

  if (high.length > 0) {
    recommendations.push(`⚠ Критические пробелы в питании: ${high.map(s => s.label).join(', ')}.`);
  }
  if (moderate.length > 0) {
    recommendations.push(`⚡ Требуют улучшения: ${moderate.map(s => s.label).join(', ')}.`);
  }
  if (totalProtein < weight * 1.6) {
    recommendations.push(`🥩 Увеличьте белок до ${(weight * 2).toFixed(0)}г/сут (сейчас ${totalProtein.toFixed(0)}г).`);
  }
  if (totalFiber < 25) {
    recommendations.push(`🌾 Добавьте клетчатку: овощи, зелень, цельнозерновые (цель ${25 - Math.round(totalFiber)}г).`);
  }
  if (mealCount < 3) {
    recommendations.push(`⏰ Увеличьте частоту приёмов до 3-4 раз/день для стабильного анаболизма.`);
  }
  if (overallRaw < 30) {
    recommendations.push('✅ Питание сбалансировано. Поддерживайте текущий режим.');
  }

  return {
    module: 'nutrition',
    timestamp: new Date().toISOString(),
    profile: { weight, age, sex },
    systems,
    overallRaw,
    overallAfterSupport: overallRaw,
    recommendations,
    supportCount: 0,
    details: {
      calories: Math.round(totalKcal), tdee,
      protein: Math.round(totalProtein * 10) / 10,
      fat: Math.round(totalFat * 10) / 10,
      carbs: Math.round(totalCarbs * 10) / 10,
      fiber: Math.round(totalFiber * 10) / 10,
      dimensions: dimensions.map(d => ({ id: d.id, score: d.score, details: d.details })),
    },
  };
}

export function generateNutritionReport(result: ModuleResult): string {
  let text = `🥗 АНАЛИЗ КАЧЕСТВА ПИТАНИЯ\n`;
  text += `${'═'.repeat(40)}\n`;
  text += `📅 ${new Date(result.timestamp).toLocaleString('ru-RU')}\n`;
  text += `👤 ${result.profile.weight}кг · ${result.profile.age}лет\n\n`;

  const d = result.details as any;
  text += `📊 МАКРОНУТРИЕНТЫ\n`;
  text += `  🔥 ${d.calories} ккал (TDEE ${d.tdee} ккал)\n`;
  text += `  🥩 Белок: ${d.protein}г\n`;
  text += `  🫒 Жиры: ${d.fat}г\n`;
  text += `  🌾 Углеводы: ${d.carbs}г\n`;
  text += `  🌿 Клетчатка: ${d.fiber}г\n\n`;

  text += `📊 СИСТЕМЫ ПИТАНИЯ\n`;
  for (const s of result.systems) {
    const icon = s.level === 'high' ? '🔴' : s.level === 'moderate' ? '🟡' : '🟢';
    text += `  ${icon} ${s.icon} ${s.label}: ${s.weightedScore}%\n`;
  }
  text += '\n';

  text += `💡 РЕКОМЕНДАЦИИ\n`;
  for (const r of result.recommendations) text += `  • ${r}\n`;

  text += `\n${'═'.repeat(40)}\n✅ Score Nutrition Engine v2`;
  return text;
}
