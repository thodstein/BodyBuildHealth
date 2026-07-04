/**
 * Nutrition Periodization + Macro Cycling + Supplement Timing Engine
 *
 * Nutrition Periodization: adapts macros to training phases (bulk/cut/maintenance)
 * Macro Cycling: training day vs rest day macros, carb cycling, refeed protocols
 * Supplement Timing: when to take each supplement for max absorption/effect
 * Recipe Database: 20+ quick high-protein recipes with macros
 *
 * @module nutrition-periodization-engine
 */

import { FOOD_DB, compositeQualityScore, type FoodItem } from '../core/nutrition-database';
import { RECIPE_DB } from '../data/recipe-db';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface MacroPlan {
  phase: string;
  trainingDay: { kcal: number; protein: number; fat: number; carbs: number };
  restDay: { kcal: number; protein: number; fat: number; carbs: number };
  refeedDay?: { kcal: number; protein: number; fat: number; carbs: number };
  refeedFrequency: string;
  notes: string;
}

export interface CarbCyclePlan {
  days: { day: number; type: 'high' | 'medium' | 'low' | 'refeed'; kcal: number; protein: number; fat: number; carbs: number }[];
}

export interface SupplementTiming {
  name: string;
  morning: boolean;
  preWorkout: boolean;
  intraWorkout: boolean;
  postWorkout: boolean;
  evening: boolean;
  beforeBed: boolean;
  withFood: boolean;
  emptyStomach: boolean;
  dosage: string;
  notes: string;
}

export interface Recipe {
  name: string;
  meal: string;
  prepTimeMin: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  ingredients: string[];
  instructions: string[];
  tags: string[];
  usefulness?: number;
  description?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Nutrition Periodization
// ═══════════════════════════════════════════════════════════════════════════

export function calculateMacroPlan(
  weightKg: number, bodyFatPercent: number, goal: 'bulk' | 'cut' | 'maintenance' | 'recomp',
  trainingDaysPerWeek: number, phaseIntensity: 'low' | 'medium' | 'high',
): MacroPlan {
  const lbm = weightKg * (1 - bodyFatPercent / 100);
  const bmr = 370 + 21.6 * lbm;
  const pal = 1.2 + trainingDaysPerWeek * 0.075 + (phaseIntensity === 'high' ? 0.1 : 0);
  const tdee = Math.round(bmr * pal);

  let trainingKcal: number, restKcal: number;
  let proteinG: number, fatG: number;

  if (goal === 'bulk') {
    trainingKcal = tdee + 400;
    restKcal = tdee + 200;
    proteinG = Math.round(weightKg * 2.2);
    fatG = Math.round(weightKg * 0.9);
  } else if (goal === 'cut') {
    trainingKcal = tdee - 300;
    restKcal = tdee - 500;
    proteinG = Math.round(weightKg * 2.5);
    fatG = Math.round(weightKg * 0.7);
  } else if (goal === 'recomp') {
    trainingKcal = tdee + 200;
    restKcal = tdee - 100;
    proteinG = Math.round(weightKg * 2.3);
    fatG = Math.round(weightKg * 0.8);
  } else {
    trainingKcal = tdee;
    restKcal = tdee;
    proteinG = Math.round(weightKg * 2.0);
    fatG = Math.round(weightKg * 0.85);
  }

  const trainingCarbs = Math.round((trainingKcal - proteinG * 4 - fatG * 9) / 4);
  const restCarbs = Math.round((restKcal - proteinG * 4 - fatG * 9) / 4);

  let refeedDay: MacroPlan['refeedDay'] | undefined;
  let refeedFreq = 'Нет';

  if (goal === 'cut' && bodyFatPercent < 15) {
    refeedDay = {
      kcal: tdee + 200,
      protein: Math.round(weightKg * 2.0),
      fat: Math.round(weightKg * 0.5),
      carbs: Math.round(((tdee + 200) - weightKg * 2.0 * 4 - weightKg * 0.5 * 9) / 4),
    };
    refeedFreq = '1×/нед (лептиновый рефид)';
  }

  return {
    phase: goal === 'bulk' ? 'Набор' : goal === 'cut' ? 'Сушка' : goal === 'recomp' ? 'Рекомпозиция' : 'Поддержание',
    trainingDay: { kcal: trainingKcal, protein: proteinG, fat: fatG, carbs: trainingCarbs },
    restDay: { kcal: restKcal, protein: proteinG, fat: fatG, carbs: restCarbs },
    refeedDay,
    refeedFrequency: refeedFreq,
    notes: goal === 'cut'
      ? 'Дефицит 300-500 ккал. Рефид 1×/нед при BF<15%. Кардио: 3-4×/нед по 30мин.'
      : goal === 'bulk'
        ? 'Профицит 200-400 ккал. Контролируйте набор (0.3-0.5 кг/нед). При >0.7 кг — снизьте ккал.'
        : 'Поддержание. Корректируйте по тренду веса.',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Carb Cycling
// ═══════════════════════════════════════════════════════════════════════════

export function generateCarbCycle(
  trainingDays: number[], // 0=Mon..6=Sun, indices of training days
  baseKcal: number, proteinG: number, fatG: number,
): CarbCyclePlan {
  const days: CarbCyclePlan['days'] = [];
  const restCarbs = Math.round((baseKcal * 0.85 - proteinG * 4 - fatG * 9) / 4);
  const trainingCarbs = Math.round((baseKcal * 1.15 - proteinG * 4 - fatG * 9) / 4);

  for (let d = 0; d < 7; d++) {
    const isTraining = trainingDays.includes(d);
    const type = isTraining ? 'high' : 'low';
    const kcal = isTraining
      ? Math.round(proteinG * 4 + fatG * 9 + trainingCarbs * 4)
      : Math.round(proteinG * 4 + fatG * 9 + restCarbs * 4);
    const carbs = isTraining ? trainingCarbs : restCarbs;

    days.push({
      day: d, type, kcal, protein: proteinG, fat: fatG, carbs,
    });
  }

  return { days };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Supplement Timing
// ═══════════════════════════════════════════════════════════════════════════

const SUPPLEMENT_TIMING_DB: SupplementTiming[] = [
  {
    name: 'Сывороточный протеин', morning: false, preWorkout: true, intraWorkout: false,
    postWorkout: true, evening: false, beforeBed: false, withFood: false, emptyStomach: false,
    dosage: '30-50 г', notes: 'Идеально сразу после тренировки. С водой или молоком.',
  },
  {
    name: 'Казеин', morning: false, preWorkout: false, intraWorkout: false,
    postWorkout: false, evening: false, beforeBed: true, withFood: false, emptyStomach: false,
    dosage: '30-40 г', notes: 'Медленный белок. Перед сном для ночного анаболизма. С водой.',
  },
  {
    name: 'Креатин моногидрат', morning: true, preWorkout: true, intraWorkout: false,
    postWorkout: true, evening: false, beforeBed: false, withFood: false, emptyStomach: false,
    dosage: '5 г/день', notes: 'Постоянный приём. С углеводами для лучшего усвоения. Фаза загрузки не обязательна.',
  },
  {
    name: 'Омега-3', morning: true, preWorkout: false, intraWorkout: false,
    postWorkout: false, evening: true, beforeBed: false, withFood: true, emptyStomach: false,
    dosage: '3-6 г EPA+DHA', notes: 'С жирной пищей для лучшей абсорбции. Разделить на 2 приёма.',
  },
  {
    name: 'Витамин D3 + K2', morning: true, preWorkout: false, intraWorkout: false,
    postWorkout: false, evening: false, beforeBed: false, withFood: true, emptyStomach: false,
    dosage: '5000 МЕ D3 + 100 мкг K2', notes: 'С первым приёмом пищи, содержащим жиры.',
  },
  {
    name: 'Магний (бисглицинат)', morning: false, preWorkout: false, intraWorkout: false,
    postWorkout: false, evening: true, beforeBed: true, withFood: false, emptyStomach: true,
    dosage: '400-600 мг', notes: 'Перед сном. Расслабляет мышцы, улучшает качество сна.',
  },
  {
    name: 'Цинк', morning: false, preWorkout: false, intraWorkout: false,
    postWorkout: false, evening: true, beforeBed: true, withFood: true, emptyStomach: false,
    dosage: '25-50 мг', notes: 'С едой (может вызвать тошноту натощак). Не с кальцием одновременно.',
  },
  {
    name: 'TUDCA', morning: true, preWorkout: false, intraWorkout: false,
    postWorkout: false, evening: true, beforeBed: false, withFood: true, emptyStomach: false,
    dosage: '500-1000 мг', notes: 'Разделить на 2 приёма с едой. Основная защита печени на оральных ААС.',
  },
  {
    name: 'NAC', morning: true, preWorkout: false, intraWorkout: false,
    postWorkout: false, evening: true, beforeBed: false, withFood: false, emptyStomach: false,
    dosage: '600-1200 мг 2×/день', notes: 'Антиоксидант. Лучше на пустой желудок, но можно с едой.',
  },
  {
    name: 'Мелатонин', morning: false, preWorkout: false, intraWorkout: false,
    postWorkout: false, evening: false, beforeBed: true, withFood: false, emptyStomach: true,
    dosage: '3-5 мг', notes: 'За 30-60 мин до сна. При тренболоновой бессоннице — обязательно.',
  },
  {
    name: 'Берберин', morning: true, preWorkout: false, intraWorkout: false,
    postWorkout: false, evening: true, beforeBed: false, withFood: true, emptyStomach: false,
    dosage: '500 мг 3×/день', notes: 'За 20-30 мин до еды. Инсулиносенситайзер. При ГР/инсулине.',
  },
  {
    name: 'BCAA/EAA', morning: false, preWorkout: true, intraWorkout: true,
    postWorkout: false, evening: false, beforeBed: false, withFood: false, emptyStomach: false,
    dosage: '10-15 г', notes: 'Во время тренировки. Снижает катаболизм при тренировках натощак.',
  },
];

export function getSupplementTimings(): SupplementTiming[] {
  return SUPPLEMENT_TIMING_DB;
}

export function getTimingForTime(timeOfDay: 'morning' | 'pre_workout' | 'intra' | 'post_workout' | 'evening' | 'bed'): SupplementTiming[] {
  const key = timeOfDay === 'morning' ? 'morning' : timeOfDay === 'pre_workout' ? 'preWorkout'
    : timeOfDay === 'intra' ? 'intraWorkout' : timeOfDay === 'post_workout' ? 'postWorkout'
    : timeOfDay === 'evening' ? 'evening' : 'beforeBed';
  return SUPPLEMENT_TIMING_DB.filter(s => (s as any)[key]);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Recipe Database
// ═══════════════════════════════════════════════════════════════════════════

/** Нормализует строку для поиска: нижний регистр, без скобок, без цифр/единиц */
function norm(s: string): string {
  return s.toLowerCase().replace(/[()]/g, ' ').replace(/[^а-яёa-z\s]/gi, ' ').replace(/\s+/g, ' ').trim();
}

/** Извлекает примерный вес в граммах из строки ингредиента */
function extractGrams(s: string): number {
  const g = s.match(/(\d+)\s*г/);
  if (g) return parseInt(g[1], 10);
  const ml = s.match(/(\d+)\s*мл/);
  if (ml) return parseInt(ml[1], 10);
  const pcs = s.match(/^(\d+)\s*шт/);
  if (pcs) return parseInt(pcs[1], 10) * 60;
  const tbl = s.match(/(\d+)\s*ст\.?\s*л/);
  if (tbl) return parseInt(tbl[1], 10) * 14;
  const tsp = s.match(/(\d+)\s*ч\.?\s*л/);
  if (tsp) return parseInt(tsp[1], 10) * 5;
  return 100;
}

/**
 * Сопоставляет строку ингредиента рецепта с записью в FOOD_DB.
 * Возвращает { food, grams } или null если не найдено.
 */
function matchIngredient(ingredient: string): { food: FoodItem; grams: number } | null {
  const ingNorm = norm(ingredient);
  if (!ingNorm || ingNorm.length < 2) return null;
  const grams = extractGrams(ingredient);
  const ingWords = ingNorm.split(' ').filter(w => w.length >= 3);

  let bestMatch: { food: FoodItem; score: number } | null = null;

  for (const food of FOOD_DB) {
    const foodNorm = norm(food.name);
    const foodWords = foodNorm.split(' ').filter(w => w.length >= 3);

    let score = 0;
    for (const iw of ingWords) {
      if (foodNorm.includes(iw)) {
        score += iw.length >= 5 ? 3 : 2;
      }
      for (const fw of foodWords) {
        if (fw === iw) score += 4;
        else if (fw.startsWith(iw) || iw.startsWith(fw)) score += 3;
        else if (fw.includes(iw) || iw.includes(fw)) score += 2;
      }
    }

    if (score >= 2 && (!bestMatch || score > bestMatch.score)) {
      bestMatch = { food, score };
    }
  }

  // Hand-crafted fallback matches for common ingredient names
  if (!bestMatch || bestMatch.score < 4) {
    const n = ingNorm;
    const fallback: Record<string, string> = {
      'куриная груд': 'chicken_breast', 'куриное филе': 'chicken_breast', 'филе курин': 'chicken_breast',
      'индейк': 'turkey_breast', 'филе индейк': 'turkey_breast',
      'говядин': 'beef_lean', 'говяж': 'beef_lean', 'стейк': 'beef_lean',
      'лосос': 'salmon', 'семг': 'salmon', 'форел': 'salmon',
      'тунец': 'tuna_canned',
      'яйц': 'egg_whole',
      'протеин': 'whey_protein', 'сывороточ': 'whey_protein',
      'казеин': 'casein',
      'рис': 'rice_white', 'басмат': 'rice_white',
      'овсян': 'oats', 'хлопь': 'oats',
      'гречк': 'buckwheat',
      'киноа': 'quinoa',
      'батат': 'sweet_potato',
      'картоф': 'potato_boiled',
      'банан': 'banana',
      'творог': 'cottage_cheese_5',
      'молок': 'milk',
      'йогурт': 'yogurt_greek',
      'кефир': 'kefir',
      'оливков': 'olive_oil',
      'авокадо': 'avocado',
      'орех': 'nuts_mix', 'миндал': 'nuts_mix', 'грецк': 'nuts_mix',
      'семен': 'seeds', 'чиа': 'seeds', 'льн': 'seeds',
      'броккол': 'broccoli',
      'масло сливоч': 'butter',
      'шпинат': 'spinach',
      'огурец': 'cucumber',
      'помидор': 'tomato', 'томат': 'tomato', 'черри': 'tomato',
      'перец болгар': 'pepper',
      'яблок': 'apple',
      'ягод': 'berries',
      'макарон': 'pasta_durum',
      'хлеб': 'bread_rye', 'ржаной': 'bread_rye',
      'сыр': 'cheese_hard', 'фет': 'cheese_hard',
      'свин': 'pork_tenderloin',
      'креветк': 'shrimp',
      'нут': 'chickpeas',
      'чечевиц': 'lentils',
      'скумбр': 'fish_oil_food', 'сел': 'fish_oil_food',
      'арахисов': 'peanut_butter',
    };
    for (const [key, id] of Object.entries(fallback)) {
      if (n.includes(key)) {
        const f = FOOD_DB.find(x => x.id === id);
        if (f) return { food: f, grams };
      }
    }
    return null;
  }

  return { food: bestMatch.food, grams };
}

/** Вычисляет полезность рецепта (1-10) на основе ингредиентов и макросов */
export function calculateRecipeUsefulness(recipe: Recipe): number {
  const matches = recipe.ingredients
    .map(ing => matchIngredient(ing))
    .filter((m): m is { food: FoodItem; grams: number } => m !== null);

  if (matches.length === 0) {
    return scoreFromMacros(recipe);
  }

  const totalWeight = matches.reduce((s, m) => s + m.grams, 0);
  const weightedFoodScore = totalWeight > 0
    ? matches.reduce((s, m) => s + compositeQualityScore(m.food) * m.grams, 0) / totalWeight
    : 5;

  const macroBonus = macroModifier(recipe);
  let score = weightedFoodScore * 0.7 + macroBonus * 0.3;
  score = Math.max(1, Math.min(10, score));
  return Math.round(score * 10) / 10;
}

function scoreFromMacros(r: Recipe): number {
  const proteinPct = r.kcal > 0 ? (r.protein * 4) / r.kcal : 0;
  let score = 5.0;
  if (proteinPct > 0.25) score += 1.0;
  if (proteinPct > 0.35) score += 1.0;
  if (r.fat < 15) score += 0.5;
  if (r.carbs < 40) score += 0.5;
  if (r.protein >= 30) score += 0.5;
  return Math.max(1, Math.min(10, score));
}

function macroModifier(r: Recipe): number {
  const proteinPct = r.kcal > 0 ? (r.protein * 4) / r.kcal : 0;
  let score = 5.0;
  if (proteinPct > 0.25) score += 1.5;
  if (proteinPct > 0.35) score += 1.5;
  if (proteinPct > 0.45) score += 1.0;
  if (r.fat < 10 && r.protein >= 25) score += 0.5;
  if (r.protein >= 40) score += 1.0;
  if (r.protein >= 50) score += 0.5;
  if (r.ingredients.length >= 5) score += 0.5;
  if (r.ingredients.length >= 7) score += 0.5;
  return Math.max(1, Math.min(10, score));
}

/** Вычисляет полезность для пользовательского рецепта (только по макросам) */
export function calculateUserRecipeUsefulness(r: { kcal: number; protein: number; fat: number; carbs: number; ingredients?: string[] }): number {
  if (r.ingredients && r.ingredients.length > 0) {
    const matches = r.ingredients
      .map(ing => matchIngredient(ing))
      .filter((m): m is { food: FoodItem; grams: number } => m !== null);
    if (matches.length > 0) {
      const totalWeight = matches.reduce((s, m) => s + m.grams, 0);
      const weightedFoodScore = totalWeight > 0
        ? matches.reduce((s, m) => s + compositeQualityScore(m.food) * m.grams, 0) / totalWeight
        : 5;
      let score = weightedFoodScore * 0.6 + macroModifier(r as Recipe) * 0.4;
      score = Math.max(1, Math.min(10, score));
      return Math.round(score * 10) / 10;
    }
  }
  return scoreFromMacros(r as Recipe);
}

export function getRecipes(): Recipe[] {
  return RECIPE_DB;
}

export function getRecipesByMeal(meal: string): Recipe[] {
  return getRecipes().filter(r => r.meal === meal);
}

export function getRecipesByTag(tag: string): Recipe[] {
  return getRecipes().filter(r => r.tags.includes(tag));
}

export function getHighProteinRecipes(minProtein: number = 40): Recipe[] {
  return getRecipes().filter(r => r.protein >= minProtein);
}
