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

const RECIPE_DB: Recipe[] = [
  {
    name: 'Протеиновые овсяноблины', meal: 'breakfast', prepTimeMin: 10,
    kcal: 520, protein: 45, fat: 14, carbs: 52,
    ingredients: ['Овсяные хлопья 80г', 'Яйца 2 шт', 'Протеин 30г', 'Молоко 100мл', 'Разрыхлитель 1/2 ч.л.'],
    instructions: ['Смешать все ингредиенты в блендере', 'Жарить на антипригарной сковороде по 2 мин с каждой стороны', 'Подавать с ягодами или сиропом без сахара'],
    tags: ['завтрак', 'быстро', 'высокий белок'],
  },
  {
    name: 'Курица с рисом в одной кастрюле', meal: 'lunch', prepTimeMin: 25,
    kcal: 650, protein: 58, fat: 12, carbs: 75,
    ingredients: ['Куриная грудка 200г', 'Рис басмати 100г', 'Брокколи 200г', 'Соевый соус 2 ст.л.', 'Чеснок 2 зуб.', 'Имбирь'],
    instructions: ['Обжарить курицу кубиками 5 мин', 'Добавить рис + 200мл воды, варить 12 мин', 'Добавить брокколи, соевый соус, специи. 5 мин под крышкой'],
    tags: ['обед', 'meal prep', 'высокий белок'],
  },
  {
    name: 'Белковый смузи (1000 ккал)', meal: 'snack', prepTimeMin: 5,
    kcal: 980, protein: 65, fat: 35, carbs: 95,
    ingredients: ['Молоко 400мл', 'Протеин 40г', 'Банан 1 шт', 'Овсянка 50г', 'Арахисовая паста 30г', 'Мёд 1 ст.л.'],
    instructions: ['Всё в блендер на 30 сек', 'Пить сразу после тренировки'],
    tags: ['гейнер', 'пост-тренировка', 'быстро'],
  },
  {
    name: 'Творожная запеканка', meal: 'dinner', prepTimeMin: 40,
    kcal: 420, protein: 52, fat: 10, carbs: 28,
    ingredients: ['Творог 5% 400г', 'Яйца 2 шт', 'Протеин 20г', 'Стевия по вкусу', 'Ваниль'],
    instructions: ['Смешать до однородности', 'Выпекать 30 мин при 180°C', 'Остудить 10 мин'],
    tags: ['ужин', 'высокий белок', 'низкий жир'],
  },
  {
    name: 'Яичница болтунья с индейкой', meal: 'breakfast', prepTimeMin: 10,
    kcal: 480, protein: 48, fat: 28, carbs: 4,
    ingredients: ['Яйца 4 шт', 'Филе индейки 100г', 'Сливочное масло 10г', 'Зелень'],
    instructions: ['Обжарить индейку 3 мин', 'Влить яйца, перемешивать', 'Масло + зелень в конце'],
    tags: ['завтрак', 'кето', 'быстро'],
  },
  {
    name: 'Лосось с бататом и спаржей', meal: 'dinner', prepTimeMin: 30,
    kcal: 580, protein: 42, fat: 22, carbs: 48,
    ingredients: ['Лосось 200г', 'Батат 250г', 'Спаржа 150г', 'Оливковое масло', 'Лимон'],
    instructions: ['Батат в духовку 20 мин при 200°C', 'Лосось на сковороду 4 мин с каждой стороны', 'Спаржа бланшировать 3 мин'],
    tags: ['ужин', 'омега-3', 'здоровое'],
  },
  {
    name: 'Протеиновое мороженое', meal: 'snack', prepTimeMin: 5,
    kcal: 280, protein: 35, fat: 4, carbs: 22,
    ingredients: ['Греческий йогурт 200г', 'Протеин 30г', 'Замороженные ягоды 100г', 'Стевия'],
    instructions: ['Всё в блендер', 'Заморозить 2 часа, перемешивая каждые 30 мин'],
    tags: ['десерт', 'высокий белок', 'низкий жир'],
  },
  {
    name: 'Говядина с гречкой', meal: 'lunch', prepTimeMin: 20,
    kcal: 720, protein: 55, fat: 22, carbs: 68,
    ingredients: ['Говяжий фарш 5% 200г', 'Гречка 120г', 'Лук 1 шт', 'Томатная паста', 'Специи'],
    instructions: ['Обжарить лук + фарш 5 мин', 'Добавить гречку + 250мл воды', 'Томатная паста + специи. 15 мин под крышкой'],
    tags: ['обед', 'высокий белок', 'meal prep'],
  },

  {
    name: 'Ночной казеиновый пудинг', meal: 'dinner', prepTimeMin: 5,
    kcal: 250, protein: 38, fat: 4, carbs: 12,
    ingredients: ['Казеин 35г', 'Молоко 200мл', 'Какао 1 ч.л.', 'Стевия'],
    instructions: ['Всё смешать до консистенции пудинга', 'В холодильник на 20 мин'],
    tags: ['ужин', 'перед сном', 'высокий белок'],
  },
  {
    name: 'Рисовая манка с протеином', meal: 'breakfast', prepTimeMin: 10,
    kcal: 380, protein: 35, fat: 6, carbs: 52,
    ingredients: ['Рисовая мука/манка 50г', 'Молоко 250мл', 'Протеин (ваниль/клубника) 30г', 'Стевия'],
    instructions: ['Всыпать рисовую манку в кипящее молоко', 'Варить на медленном огне 3-5 мин, помешивая', 'Снять с огня, добавить протеин, перемешать'],
    tags: ['завтрак', 'быстро', 'высокий белок', 'рисовый крем'],
  },
  {
    name: 'Салат с тунцом и нутом', meal: 'lunch', prepTimeMin: 10,
    kcal: 450, protein: 42, fat: 14, carbs: 38,
    ingredients: ['Тунец консерв. 150г', 'Нут варёный 150г', 'Огурец 100г', 'Помидоры черри 100г', 'Оливковое масло 1 ст.л.', 'Лимонный сок'],
    instructions: ['Смешать тунец, нут, нарезанные овощи', 'Заправить маслом и лимонным соком', 'Подавать охлаждённым'],
    tags: ['обед', 'быстро', 'без готовки', 'высокий белок'],
  },
  {
    name: 'Индейка с киноа и шпинатом', meal: 'dinner', prepTimeMin: 25,
    kcal: 520, protein: 50, fat: 12, carbs: 48,
    ingredients: ['Филе индейки 200г', 'Киноа 80г', 'Шпинат 100г', 'Чеснок 2 зуб.', 'Оливковое масло 1 ст.л.'],
    instructions: ['Отварить киноа 15 мин', 'Обжарить индейку кусочками 6 мин', 'Добавить шпинат и чеснок, тушить 2 мин', 'Подавать с киноа'],
    tags: ['ужин', 'высокий белок', 'здоровое'],
  },
  {
    name: 'Омлет с овощами и фетой', meal: 'breakfast', prepTimeMin: 10,
    kcal: 380, protein: 35, fat: 22, carbs: 8,
    ingredients: ['Яйца 3 шт', 'Болгарский перец 1/2', 'Помидор 1 шт', 'Фета 30г', 'Оливковое масло 1 ч.л.'],
    instructions: ['Взбить яйца, нарезать овощи', 'Обжарить овощи 2 мин', 'Залить яйцами, посыпать фетой', 'Готовить под крышкой 5 мин'],
    tags: ['завтрак', 'быстро', 'овощи'],
  },
  {
    name: 'Стейк из говядины с бататом', meal: 'dinner', prepTimeMin: 20,
    kcal: 680, protein: 55, fat: 28, carbs: 45,
    ingredients: ['Говяжий стейк 250г', 'Батат 200г', 'Спаржа 100г', 'Сливочное масло 15г', 'Розмарин'],
    instructions: ['Запечь батат 15 мин при 200°C', 'Обжарить стейк по 4 мин с каждой стороны', 'Бланшировать спаржу 2 мин', 'Подавать с маслом и розмарином'],
    tags: ['ужин', 'высокий белок', 'кето'],
  },
  {
    name: 'Протеиновые панкейки', meal: 'breakfast', prepTimeMin: 10,
    kcal: 420, protein: 42, fat: 8, carbs: 46,
    ingredients: ['Протеин 30г', 'Яйца 2 шт', 'Овсяная мука 40г', 'Разрыхлитель', 'Молоко 60мл', 'Стевия'],
    instructions: ['Смешать все ингредиенты до однородности', 'Жарить на антипригарной сковороде по 2 мин', 'Полить сиропом без сахара'],
    tags: ['завтрак', 'быстро', 'высокий белок'],
  },
  {
    name: 'Гречка с куриной печенью', meal: 'lunch', prepTimeMin: 15,
    kcal: 520, protein: 44, fat: 14, carbs: 52,
    ingredients: ['Куриная печень 200г', 'Гречка 100г', 'Лук 1 шт', 'Морковь 1 шт', 'Сметана 10% 30г'],
    instructions: ['Отварить гречку 12 мин', 'Обжарить лук с морковью 3 мин', 'Добавить печень, жарить 5 мин', 'Добавить сметану, тушить 3 мин'],
    tags: ['обед', 'быстро', 'железо'],
  },
  {
    name: 'Смузи-боул с протеином', meal: 'snack', prepTimeMin: 5,
    kcal: 340, protein: 36, fat: 8, carbs: 32,
    ingredients: ['Протеин 25г', 'Замороженные ягоды 100г', 'Банан 1/2', 'Молоко 150мл', 'Гранола 20г', 'Семена чиа 5г'],
    instructions: ['Смешать протеин, ягоды, банан и молоко в блендере', 'Перелить в миску', 'Посыпать гранолой и чиа'],
    tags: ['перекус', 'быстро', 'высокий белок', 'десерт'],
  },
  {
    name: 'Сырники с протеином', meal: 'breakfast', prepTimeMin: 15,
    kcal: 420, protein: 38, fat: 12, carbs: 40,
    ingredients: ['Творог 5% 300г', 'Протеин 20г', 'Яйцо 1 шт', 'Рисовая мука 30г', 'Стевия'],
    instructions: ['Смешать творог, протеин, яйцо и муку до однородности', 'Сформировать сырники мокрыми руками', 'Жарить на антипригарной сковороде по 3 мин с каждой стороны'],
    tags: ['завтрак', 'высокий белок', 'быстро'],
  },
  {
    name: 'Рисовый крем с протеином', meal: 'breakfast', prepTimeMin: 15,
    kcal: 360, protein: 32, fat: 5, carbs: 48,
    ingredients: ['Рис круглозёрный 60г', 'Молоко 200мл', 'Протеин ванильный 25г', 'Стевия', 'Корица'],
    instructions: ['Отварить рис в молоке на медленном огне 12 мин до кремообразного состояния', 'Снять с огня, остудить 2 мин', 'Вмешать протеин до однородности', 'Посыпать корицей, подавать тёплым'],
    tags: ['завтрак', 'десерт', 'высокий белок', 'рисовый крем'],
  },
  {
    name: 'Яйца пашот с авокадо', meal: 'breakfast', prepTimeMin: 10,
    kcal: 360, protein: 24, fat: 26, carbs: 6,
    ingredients: ['Яйца 2 шт', 'Авокадо 1/2', 'Уксус 1 ст.л.', 'Соль, перец'],
    instructions: ['Вскипятить воду с уксусом, сделать воронку', 'Вбить яйцо в воронку, варить 3 мин', 'Выложить на авокадо, посолить'],
    tags: ['завтрак', 'здоровое', 'низкий уголь'],
  },
  {
    name: 'Тосты с авокадо и яйцом', meal: 'breakfast', prepTimeMin: 10,
    kcal: 420, protein: 22, fat: 24, carbs: 32,
    ingredients: ['Хлеб цельнозерновой 60г', 'Авокадо 1/2', 'Яйцо 1 шт', 'Лимонный сок', 'Хлопья чили'],
    instructions: ['Поджарить хлеб в тостере', 'Размять авокадо вилкой с лимонным соком', 'Сверху яйцо пашот или глазунья', 'Посыпать чили'],
    tags: ['завтрак', 'быстро', 'овощи'],
  },

  {
    name: 'Овсянка с ягодами и протеином', meal: 'breakfast', prepTimeMin: 8,
    kcal: 420, protein: 35, fat: 10, carbs: 52,
    ingredients: ['Овсяные хлопья 50г', 'Молоко 200мл', 'Протеин 25г', 'Замороженные ягоды 80г'],
    instructions: ['Сварить овсянку на молоке 5 мин', 'Снять с огня', 'Вмешать протеин, сверху ягоды'],
    tags: ['завтрак', 'быстро', 'высокий белок'],
  },
  {
    name: 'Блины гречневые с творогом', meal: 'breakfast', prepTimeMin: 15,
    kcal: 450, protein: 38, fat: 14, carbs: 48,
    ingredients: ['Гречневая мука 60г', 'Яйца 2 шт', 'Творог 5% 150г', 'Молоко 80мл', 'Соль, стевия'],
    instructions: ['Смешать муку, яйца, молоко в блендере', 'Выпекать блины на антипригарной сковороде', 'Завернуть творог в блины'],
    tags: ['завтрак', 'без глютена', 'высокий белок'],
  },
  {
    name: 'Пшенная каша с тыквой', meal: 'breakfast', prepTimeMin: 25,
    kcal: 340, protein: 10, fat: 8, carbs: 58,
    ingredients: ['Пшено 50г', 'Молоко 200мл', 'Тыква 100г', 'Сливочное масло 10г', 'Корица'],
    instructions: ['Тыкву нарезать кубиками, тушить 5 мин', 'Добавить пшено и молоко', 'Варить 15 мин, в конце масло и корицу'],
    tags: ['завтрак', 'осень', 'вегетарианское'],
  },
  {
    name: 'Гранола домашняя с йогуртом', meal: 'breakfast', prepTimeMin: 10,
    kcal: 400, protein: 28, fat: 16, carbs: 44,
    ingredients: ['Гранола без сахара 40г', 'Греческий йогурт 150г', 'Протеин 20г', 'Ягоды 50г', 'Мёд 1 ч.л.'],
    instructions: ['Смешать протеин с йогуртом до однородности', 'Выложить в миску', 'Посыпать гранолой и ягодами, полить мёдом'],
    tags: ['завтрак', 'быстро', 'без готовки'],
  },
  {
    name: 'Куриный суп с лапшой', meal: 'lunch', prepTimeMin: 30,
    kcal: 380, protein: 32, fat: 10, carbs: 42,
    ingredients: ['Куриная грудка 150г', 'Лапша яичная 50г', 'Морковь 1 шт', 'Лук 1 шт', 'Картофель 1 шт', 'Зелень'],
    instructions: ['Отварить курицу в 1л воды 20 мин, вынуть', 'В бульон добавить нарезанные овощи, варить 10 мин', 'Добавить лапшу, варить 5 мин', 'Курицу нарезать, вернуть в суп, посыпать зеленью'],
    tags: ['обед', 'суп', 'быстро'],
  },
  {
    name: 'Борщ с курицей', meal: 'lunch', prepTimeMin: 40,
    kcal: 350, protein: 28, fat: 10, carbs: 40,
    ingredients: ['Куриное бедро 150г', 'Свёкла 1 шт', 'Капуста 150г', 'Картофель 100г', 'Морковь 1 шт', 'Томатная паста 1 ст.л.'],
    instructions: ['Сварить бульон из курицы 25 мин', 'Добавить нарезанную капусту и картофель', 'Обжарить свёклу и морковь с томатной пастой', 'Добавить зажарку в суп, варить 10 мин'],
    tags: ['обед', 'суп', 'классика'],
  },
  {
    name: 'Паста с курицей и песто', meal: 'lunch', prepTimeMin: 20,
    kcal: 580, protein: 42, fat: 16, carbs: 62,
    ingredients: ['Паста из твёрдых сортов 80г', 'Куриная грудка 150г', 'Соус песто 30г', 'Пармезан 15г', 'Черри 50г'],
    instructions: ['Отварить пасту до al dente', 'Обжарить курицу кубиками 5 мин', 'Смешать пасту с песто и курицей', 'Добавить черри и пармезан'],
    tags: ['обед', 'высокий белок', 'итальянское'],
  },

  {
    name: 'Роллы из индейки с сыром', meal: 'lunch', prepTimeMin: 15,
    kcal: 360, protein: 40, fat: 16, carbs: 8,
    ingredients: ['Филе индейки 200г', 'Сыр моцарелла 50г', 'Шпинат 50г', 'Чеснок', 'Специи'],
    instructions: ['Отбить индейку толщиной 5мм', 'Выложить шпинат и сыр, свернуть рулетом', 'Закрепить зубочистками, запечь 15 мин при 200°C'],
    tags: ['обед', 'низкий уголь', 'высокий белок'],
  },
  {
    name: 'Куриные котлеты с гречкой', meal: 'lunch', prepTimeMin: 25,
    kcal: 520, protein: 46, fat: 16, carbs: 52,
    ingredients: ['Фарш куриный 200г', 'Гречка 100г', 'Лук 1/2', 'Яйцо 1 шт', 'Соль, перец'],
    instructions: ['Отварить гречку 12 мин', 'Смешать фарш, яйцо, мелко нарезанный лук', 'Сформировать котлеты, жарить по 5 мин с каждой стороны', 'Подавать с гречкой'],
    tags: ['обед', 'высокий белок', 'meal prep'],
  },
  {
    name: 'Ленивые голубцы', meal: 'lunch', prepTimeMin: 30,
    kcal: 480, protein: 38, fat: 18, carbs: 44,
    ingredients: ['Фарш говяжий 150г', 'Рис 60г', 'Капуста 200г', 'Морковь 1 шт', 'Томатная паста 2 ст.л.', 'Сметана 10% 30г'],
    instructions: ['Обжарить фарш 5 мин', 'Добавить нашинкованную капусту и морковь', 'Добавить рис и 150мл воды, тушить 20 мин', 'Вмешать томатную пасту и сметану, прогреть'],
    tags: ['обед', 'классика', 'высокий белок'],
  },

  {
    name: 'Салат с креветками и авокадо', meal: 'lunch', prepTimeMin: 10,
    kcal: 360, protein: 32, fat: 18, carbs: 14,
    ingredients: ['Креветки очищенные 150г', 'Авокадо 1/2', 'Микс салата 80г', 'Черри 80г', 'Оливковое масло 1 ст.л.', 'Лимон'],
    instructions: ['Отварить креветки 2 мин, остудить', 'Нарезать авокадо и черри', 'Смешать все ингредиенты с маслом и лимоном'],
    tags: ['обед', 'быстро', 'морепродукты'],
  },
  {
    name: 'Фалафель с лавашем и соусом', meal: 'lunch', prepTimeMin: 30,
    kcal: 520, protein: 22, fat: 16, carbs: 70,
    ingredients: ['Нут варёный 200г', 'Лаваш 60г', 'Чеснок', 'Кинза', 'Тхина 20г', 'Овощи'],
    instructions: ['Измельчить нут с чесноком и кинзой в комбайне', 'Сформировать шарики, запечь 20 мин при 200°C', 'Подавать в лаваше с овощами и соусом тхина'],
    tags: ['обед', 'веган', 'высокий уголь'],
  },
  {
    name: 'Рыбные котлеты с пюре', meal: 'lunch', prepTimeMin: 25,
    kcal: 460, protein: 38, fat: 14, carbs: 48,
    ingredients: ['Филе трески 200г', 'Картофель 200г', 'Молоко 50мл', 'Яйцо 1 шт', 'Панировочные сухари 15г'],
    instructions: ['Измельчить треску в фарш', 'Смешать с яйцом и сухарями, сформировать котлеты', 'Запечь 15 мин при 190°C', 'Отварить картофель, сделать пюре с молоком'],
    tags: ['обед', 'рыба', 'высокий белок'],
  },
  {
    name: 'Курица терияки с рисом', meal: 'lunch', prepTimeMin: 20,
    kcal: 580, protein: 48, fat: 10, carbs: 72,
    ingredients: ['Куриное бедро 200г', 'Рис 100г', 'Соус терияки 30мл', 'Сладкий перец 1/2', 'Кунжут'],
    instructions: ['Отварить рис 12 мин', 'Обжарить курицу кусочками 6 мин', 'Добавить перец и соус терияки, тушить 3 мин', 'Подавать с рисом, посыпать кунжутом'],
    tags: ['обед', 'азиатское', 'высокий белок'],
  },
  {
    name: 'Запечённая курица с овощами', meal: 'dinner', prepTimeMin: 35,
    kcal: 520, protein: 48, fat: 18, carbs: 34,
    ingredients: ['Куриные ножки 250г', 'Цукини 150г', 'Перец болгарский 1', 'Помидоры черри 100г', 'Чеснок', 'Прованские травы'],
    instructions: ['Нарезать овощи крупными кусками', 'Смешать с курицей, чесноком и травами', 'Запекать 30 мин при 190°C, перемешать в середине'],
    tags: ['ужин', 'здоровое', 'просто'],
  },
  {
    name: 'Свинина с яблоками и бататом', meal: 'dinner', prepTimeMin: 30,
    kcal: 620, protein: 42, fat: 22, carbs: 60,
    ingredients: ['Свиная вырезка 180г', 'Батат 200г', 'Яблоко 1 шт', 'Розмарин', 'Оливковое масло 1 ст.л.'],
    instructions: ['Нарезать батат дольками, запечь 20 мин при 200°C', 'Обжарить свинину 5 мин, затем добавить яблоко', 'Довести до готовности 5 мин под крышкой'],
    tags: ['ужин', 'осень', 'высокий белок'],
  },
  {
    name: 'Треска запечённая с овощами', meal: 'dinner', prepTimeMin: 25,
    kcal: 380, protein: 44, fat: 12, carbs: 20,
    ingredients: ['Филе трески 200г', 'Брокколи 150г', 'Черри 100г', 'Лимон', 'Оливковое масло'],
    instructions: ['Выложить рыбу и овощи на противень', 'Полить маслом и лимоном', 'Запекать 20 мин при 190°C'],
    tags: ['ужин', 'рыба', 'низкий уголь'],
  },
  {
    name: 'Куриное филе в кефирном маринаде', meal: 'dinner', prepTimeMin: 25,
    kcal: 460, protein: 50, fat: 12, carbs: 32,
    ingredients: ['Куриная грудка 200г', 'Кефир 100мл', 'Чеснок 2 зуб.', 'Рис 80г', 'Специи'],
    instructions: ['Замариновать курицу в кефире с чесноком на 30 мин+', 'Отварить рис 12 мин', 'Обжарить курицу на сильном огне по 4 мин', 'Подавать с рисом'],
    tags: ['ужин', 'высокий белок', 'просто'],
  },
  {
    name: 'Овощное рагу с курицей', meal: 'dinner', prepTimeMin: 30,
    kcal: 400, protein: 36, fat: 14, carbs: 34,
    ingredients: ['Куриная грудка 150г', 'Кабачок 150г', 'Баклажан 150г', 'Перец 1/2', 'Томатная паста 1 ст.л.', 'Зелень'],
    instructions: ['Нарезать курицу кубиками, обжарить 5 мин', 'Добавить нарезанные овощи', 'Томатная паста + 100мл воды, тушить 15 мин', 'Посыпать зеленью'],
    tags: ['ужин', 'овощи', 'лёгкое'],
  },
  {
    name: 'Фаршированный перец', meal: 'dinner', prepTimeMin: 40,
    kcal: 450, protein: 34, fat: 16, carbs: 44,
    ingredients: ['Перец болгарский 2 шт', 'Фарш говяжий 150г', 'Рис 50г', 'Морковь 1 шт', 'Томатный соус 100мл'],
    instructions: ['Отварить рис до полуготовности 7 мин', 'Смешать фарш с рисом и натёртой морковью', 'Начинить перцы', 'Тушить в томатном соусе 25 мин'],
    tags: ['ужин', 'классика', 'высокий белок'],
  },
  {
    name: 'Индейка с цветной капустой', meal: 'dinner', prepTimeMin: 20,
    kcal: 360, protein: 46, fat: 10, carbs: 18,
    ingredients: ['Филе индейки 200г', 'Цветная капуста 200г', 'Чеснок', 'Куркума', 'Оливковое масло'],
    instructions: ['Разобрать капусту на соцветия', 'Обжарить индейку кусочками 6 мин', 'Добавить капусту и специи, тушить 10 мин'],
    tags: ['ужин', 'низкий уголь', 'высокий белок'],
  },
  {
    name: 'Кальмары с рисом и овощами', meal: 'dinner', prepTimeMin: 20,
    kcal: 380, protein: 36, fat: 8, carbs: 44,
    ingredients: ['Кальмары 200г', 'Рис 70г', 'Перец 1/2', 'Морковь 1/2', 'Соевый соус', 'Имбирь'],
    instructions: ['Отварить рис 10 мин', 'Нарезать кальмары кольцами, обжарить 2 мин', 'Добавить овощи и соевый соус, тушить 4 мин', 'Подавать с рисом'],
    tags: ['ужин', 'морепродукты', 'быстро'],
  },
  {
    name: 'Куриные бедра запечённые', meal: 'dinner', prepTimeMin: 35,
    kcal: 560, protein: 44, fat: 32, carbs: 22,
    ingredients: ['Куриные бедра 250г', 'Картофель 200г', 'Розмарин', 'Чеснок', 'Паприка'],
    instructions: ['Натереть бедра специями', 'Нарезать картофель дольками', 'Запекать 30 мин при 200°C до золотистой корочки'],
    tags: ['ужин', 'просто', 'сытное'],
  },
  {
    name: 'Рататуй с курицей', meal: 'dinner', prepTimeMin: 30,
    kcal: 420, protein: 38, fat: 16, carbs: 36,
    ingredients: ['Куриная грудка 150г', 'Цукини 100г', 'Баклажан 100г', 'Перец 1/2', 'Помидоры 150г', 'Прованские травы'],
    instructions: ['Нарезать все овощи кружочками', 'Обжарить курицу до полуготовности', 'Выложить в форму слоями овощи и курицу', 'Запекать 20 мин при 190°C'],
    tags: ['ужин', 'здоровое', 'французское'],
  },
  {
    name: 'Уха из семги', meal: 'dinner', prepTimeMin: 25,
    kcal: 280, protein: 28, fat: 12, carbs: 12,
    ingredients: ['Сёмга 200г', 'Картофель 1 шт', 'Морковь 1/2', 'Лук 1/2', 'Лавровый лист', 'Зелень'],
    instructions: ['Нарезать рыбу и овощи', 'Варить 15 мин в 500мл воды с лавровым листом', 'Добавить зелень, выключить, дать настояться 5 мин'],
    tags: ['ужин', 'суп', 'рыба'],
  },
  {
    name: 'Стейк из лосося с киноа', meal: 'dinner', prepTimeMin: 20,
    kcal: 540, protein: 44, fat: 24, carbs: 38,
    ingredients: ['Лосось 200г', 'Киноа 80г', 'Спаржа 100г', 'Лимон', 'Оливковое масло'],
    instructions: ['Отварить киноа 15 мин', 'Обжарить лосось по 4 мин с каждой стороны', 'Бланшировать спаржу 3 мин', 'Подавать с киноа и лимоном'],
    tags: ['ужин', 'омега-3', 'высокий белок'],
  },
  {
    name: 'Протеиновые шарики (энерджи-боллы)', meal: 'snack', prepTimeMin: 10,
    kcal: 320, protein: 28, fat: 12, carbs: 32,
    ingredients: ['Протеин 30г', 'Овсянка 50г', 'Арахисовая паста 25г', 'Мёд 10г', 'Какао 1 ст.л.', 'Кокосовая стружка 10г'],
    instructions: ['Смешать все ингредиенты в миске до однородной массы', 'Скатать 8 шариков', 'Обвалять в кокосовой стружке', 'Охладить 30 мин в холодильнике'],
    tags: ['перекус', 'быстро', 'без готовки', 'высокий белок'],
  },
  {
    name: 'Творог с ягодами и орехами', meal: 'snack', prepTimeMin: 3,
    kcal: 280, protein: 30, fat: 12, carbs: 14,
    ingredients: ['Творог 5% 200г', 'Ягоды замороженные 80г', 'Грецкие орехи 20г'],
    instructions: ['Выложить творог в миску', 'Сверху ягоды и орехи', 'Перемешать и сразу подавать'],
    tags: ['перекус', 'быстро', 'без готовки', 'высокий белок'],
  },
  {
    name: 'Греческий йогурт с гранолой', meal: 'snack', prepTimeMin: 3,
    kcal: 250, protein: 22, fat: 8, carbs: 28,
    ingredients: ['Греческий йогурт 200г', 'Гранола 30г', 'Ягоды 50г'],
    instructions: ['Выложить йогурт в миску', 'Посыпать гранолой и ягодами'],
    tags: ['перекус', 'быстро', 'без готовки'],
  },

  {
    name: 'Банановые панкейки', meal: 'snack', prepTimeMin: 10,
    kcal: 300, protein: 18, fat: 6, carbs: 48,
    ingredients: ['Банан 1 шт', 'Яйцо 1 шт', 'Овсяная мука 30г', 'Разрыхлитель'],
    instructions: ['Размять банан вилкой', 'Смешать с яйцом и мукой', 'Жарить маленькие панкейки по 2 мин с каждой стороны'],
    tags: ['перекус', 'десерт', 'быстро'],
  },
  {
    name: 'Хумус с овощными палочками', meal: 'snack', prepTimeMin: 5,
    kcal: 220, protein: 12, fat: 14, carbs: 18,
    ingredients: ['Хумус 100г', 'Морковь 1 шт', 'Огурец 1/2', 'Перец сладкий 1/2'],
    instructions: ['Нарезать овощи соломкой', 'Выложить хумус в миску', 'Макать овощи в хумус'],
    tags: ['перекус', 'быстро', 'веган'],
  },

  {
    name: 'Сырные шарики с зеленью', meal: 'snack', prepTimeMin: 10,
    kcal: 340, protein: 28, fat: 24, carbs: 4,
    ingredients: ['Творожный сыр 150г', 'Сыр твёрдый 50г', 'Чеснок 1 зуб.', 'Укроп', 'Специи'],
    instructions: ['Натереть твёрдый сыр', 'Смешать с творожным сыром, чесноком и зеленью', 'Скатать шарики, охладить 15 мин'],
    tags: ['перекус', 'низкий уголь', 'высокий белок'],
  },
  {
    name: 'Куриный шашлык в духовке', meal: 'lunch', prepTimeMin: 30,
    kcal: 440, protein: 52, fat: 14, carbs: 22,
    ingredients: ['Куриная грудка 250г', 'Лук 1 шт', 'Лимон 1/2', 'Специи для шашлыка', 'Болгарский перец 1 шт'],
    instructions: ['Нарезать курицу кубиками 3см', 'Замариновать с луком и специями на 30 мин', 'Нанизать на шпажки с перцем', 'Запекать 20 мин при 200°C, перевернуть через 10 мин'],
    tags: ['обед', 'высокий белок', 'быстро'],
  },
  {
    name: 'Запеканка из брокколи с сыром', meal: 'dinner', prepTimeMin: 30,
    kcal: 360, protein: 28, fat: 18, carbs: 20,
    ingredients: ['Брокколи 300г', 'Яйца 3 шт', 'Сыр гауда 60г', 'Молоко 80мл', 'Чеснок'],
    instructions: ['Бланшировать брокколи 3 мин, разобрать', 'Взбить яйца с молоком', 'Выложить брокколи в форму, залить яйцами', 'Посыпать сыром, запечь 20 мин при 190°C'],
    tags: ['ужин', 'овощи', 'высокий белок'],
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // ДОПОЛНИТЕЛЬНЫЕ РЕЦЕПТЫ (всего 120) — бодибилдинг, интересные блюда
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Чизкейк протеиновый без выпечки', meal: 'snack', prepTimeMin: 15,
    kcal: 320, protein: 38, fat: 12, carbs: 18,
    ingredients: ['Творог обезжиренный 300г', 'Протеин кейк/ваниль 30г', 'Желатин 10г', 'Вода 60мл', 'Стевия'],
    instructions: ['Замочить желатин в воде на 10 мин, подогреть до растворения', 'Взбить творог с протеином блендером до крема', 'Влить желатин, взбить ещё раз', 'В форму, в холодильник на 2 часа'],
    tags: ['десерт', 'высокий белок', 'без выпечки'],
  },
  {
    name: 'Тортилья с курицей и гуакамоле', meal: 'lunch', prepTimeMin: 15,
    kcal: 480, protein: 44, fat: 18, carbs: 36,
    ingredients: ['Тортилья цельнозерновая 2 шт', 'Куриная грудка 150г', 'Авокадо 1/2', 'Помидор 1 шт', 'Лайм', 'Кинза', 'Сметана 10% 20г'],
    instructions: ['Обжарить курицу с солью и специями 6 мин, нарезать полосками', 'Размять авокадо с лаймом и кинзой', 'Выложить гуакамоле, курицу, помидор на тортилью', 'Добавить сметану и свернуть плотным рулетом'],
    tags: ['обед', 'мексиканское', 'быстро', 'высокий белок'],
  },
  {
    name: 'Филе индейки в горчично-медовом соусе', meal: 'dinner', prepTimeMin: 25,
    kcal: 440, protein: 54, fat: 12, carbs: 26,
    ingredients: ['Филе индейки 250г', 'Горчица дижонская 1 ст.л.', 'Мёд 1 ч.л.', 'Чеснок 2 зуб.', 'Розмарин', 'Батат 150г'],
    instructions: ['Смешать горчицу, мёд, чеснок и розмарин', 'Обмазать индейку маринадом, оставить на 10 мин', 'Запекать индейку с дольками батата 20 мин при 200°C', 'Полить оставшимся соусом при подаче'],
    tags: ['ужин', 'высокий белок', 'соус'],
  },
  {
    name: 'Скумбрия запечённая с лимоном и травами', meal: 'dinner', prepTimeMin: 25,
    kcal: 420, protein: 38, fat: 28, carbs: 4,
    ingredients: ['Скумбрия 300г', 'Лимон 1/2', 'Укроп', 'Петрушка', 'Чеснок 2 зуб.', 'Оливковое масло 1 ст.л.'],
    instructions: ['Выпотрошить скумбрию, сделать надрезы на боках', 'Вставить дольки лимона и чеснок в надрезы', 'Посыпать зеленью внутри и снаружи', 'Запекать 20 мин при 190°C'],
    tags: ['ужин', 'омега-3', 'кето', 'быстро'],
  },
  {
    name: 'Белок яичный омлет со шпинатом и рикоттой', meal: 'breakfast', prepTimeMin: 10,
    kcal: 320, protein: 42, fat: 12, carbs: 8,
    ingredients: ['Белки яичные 6 шт', 'Шпинат 80г', 'Рикотта 60г', 'Чеснок 1 зуб.', 'Соль, перец'],
    instructions: ['На сковороде обжарить шпинат с чесноком 1 мин', 'Влить взбитые белки', 'Выложить рикотту ложкой сверху', 'Готовить под крышкой 5 мин на слабом огне'],
    tags: ['завтрак', 'высокий белок', 'низкий жир', 'низкий уголь'],
  },
  {
    name: 'Куриная печень в сливочно-горчичном соусе', meal: 'lunch', prepTimeMin: 15,
    kcal: 380, protein: 36, fat: 18, carbs: 16,
    ingredients: ['Куриная печень 250г', 'Сливки 10% 100мл', 'Горчица зернистая 1 ст.л.', 'Лук 1 шт', 'Тимьян'],
    instructions: ['Обжарить лук до золотистого 3 мин', 'Добавить печень, жарить по 2 мин с каждой стороны', 'Влить сливки, добавить горчицу и тимьян', 'Тушить 5 мин до загустения соуса'],
    tags: ['обед', 'быстро', 'железо', 'печень'],
  },
  {
    name: 'Минтай в кляре из протеина', meal: 'dinner', prepTimeMin: 20,
    kcal: 380, protein: 46, fat: 12, carbs: 22,
    ingredients: ['Филе минтая 250г', 'Протеин без вкуса 25г', 'Яйцо 1 шт', 'Паприка', 'Куркума', 'Лимон'],
    instructions: ['Филе нарезать порционно, посолить', 'Смешать протеин, яйцо и специи в кляр', 'Обмакнуть каждый кусок в кляр', 'Жарить на антипригарной по 3 мин с каждой стороны'],
    tags: ['ужин', 'рыба', 'высокий белок', 'протеиновый кляр'],
  },
  {
    name: 'Крем-суп из брокколи с курицей', meal: 'lunch', prepTimeMin: 25,
    kcal: 340, protein: 36, fat: 12, carbs: 24,
    ingredients: ['Брокколи 300г', 'Куриная грудка 150г', 'Лук 1 шт', 'Чеснок 2 зуб.', 'Сливки 10% 80мл', 'Оливковое масло'],
    instructions: ['Обжарить лук с чесноком 2 мин', 'Добавить брокколи и 300мл воды, варить 12 мин', 'Измельчить блендером в пюре', 'Отдельно отварить и нарезать курицу', 'Добавить курицу и сливки, прогреть', 'Посыпать семечками тыквы'],
    tags: ['обед', 'суп', 'овощи', 'высокий белок'],
  },
  {
    name: 'Творожно-белковый мусс с манго', meal: 'snack', prepTimeMin: 5,
    kcal: 240, protein: 32, fat: 3, carbs: 22,
    ingredients: ['Творог обезжиренный 200г', 'Протеин ванильный 25г', 'Манго замороженное 80г', 'Молоко 30мл'],
    instructions: ['Взбить творог, протеин и молоко блендером до воздушного мусса', 'В блендер добавить манго, взбить ещё 15 сек', 'Переложить в креманку, подавать охлаждённым'],
    tags: ['перекус', 'десерт', 'быстро', 'высокий белок'],
  },
  {
    name: 'Котлеты из индейки с овсяными хлопьями', meal: 'lunch', prepTimeMin: 25,
    kcal: 380, protein: 42, fat: 14, carbs: 22,
    ingredients: ['Фарш индейки 200г', 'Овсяные хлопья 30г', 'Яйцо 1 шт', 'Лук 1/2', 'Чеснок 1 зуб.', 'Зелень'],
    instructions: ['Смешать фарш с яйцом, овсянкой, мелко рубленым луком', 'Посолить, добавить специи', 'Сформировать котлеты мокрыми руками', 'Жарить по 4-5 мин с каждой стороны на среднем огне'],
    tags: ['обед', 'высокий белок', 'meal prep', 'индейка'],
  },
  {
    name: 'Паста с креветками в сливочном соусе', meal: 'dinner', prepTimeMin: 20,
    kcal: 520, protein: 38, fat: 16, carbs: 54,
    ingredients: ['Паста феттучини/спагетти 70г', 'Креветки очищенные 180г', 'Сливки 10% 100мл', 'Чеснок 3 зуб.', 'Пармезан 15г', 'Зелень'],
    instructions: ['Отварить пасту до al dente', 'Обжарить чеснок 30 сек, добавить креветки, жарить 3 мин', 'Влить сливки, тушить 3 мин', 'Добавить пасту и пармезан, перемешать', 'Посыпать зеленью'],
    tags: ['ужин', 'морепродукты', 'итальянское', 'быстро'],
  },

  {
    name: 'Чечевичный суп с куриными фрикадельками', meal: 'lunch', prepTimeMin: 30,
    kcal: 420, protein: 38, fat: 12, carbs: 44,
    ingredients: ['Чечевица красная 80г', 'Фарш куриный 150г', 'Морковь 1 шт', 'Лук 1 шт', 'Томатная паста 1 ст.л.', 'Зелень'],
    instructions: ['Сформировать фрикадельки из фарша', 'Обжарить лук и морковь 3 мин', 'Добавить чечевицу и 600мл воды, варить 12 мин', 'Добавить фрикадельки и томатную пасту, варить 8 мин', 'Посыпать зеленью'],
    tags: ['обед', 'суп', 'высокий белок', 'сытное'],
  },
  {
    name: 'Салат с кальмарами, яйцом и огурцом', meal: 'lunch', prepTimeMin: 15,
    kcal: 280, protein: 34, fat: 10, carbs: 10,
    ingredients: ['Кальмары 200г', 'Яйца 2 шт', 'Огурец 1 шт', 'Сметана 10% 30г', 'Укроп', 'Соль, перец'],
    instructions: ['Отварить кальмары 3 мин, нарезать кольцами', 'Сварить яйца вкрутую, нарезать', 'Огурец нарезать соломкой', 'Заправить сметаной и зеленью'],
    tags: ['обед', 'морепродукты', 'быстро', 'высокий белок'],
  },
  {
    name: 'Рис басмати с курицей карри', meal: 'lunch', prepTimeMin: 25,
    kcal: 560, protein: 44, fat: 12, carbs: 66,
    ingredients: ['Куриная грудка 180г', 'Рис басмати 100г', 'Лук 1 шт', 'Кокосовое молоко 100мл', 'Паста карри 1 ст.л.', 'Кинза'],
    instructions: ['Отварить рис 12 мин', 'Обжарить лук 2 мин, добавить курицу кубиками, жарить 5 мин', 'Добавить пасту карри и кокосовое молоко', 'Тушить 8 мин, подавать с рисом и кинзой'],
    tags: ['обед', 'индийское', 'высокий белок', 'карри'],
  },
  {
    name: 'Белая рыба с томатами и маслинами', meal: 'dinner', prepTimeMin: 25,
    kcal: 360, protein: 42, fat: 16, carbs: 12,
    ingredients: ['Филе трески/хек 250г', 'Помидоры 200г', 'Маслины 50г', 'Чеснок 2 зуб.', 'Каперсы 1 ст.л.', 'Оливковое масло'],
    instructions: ['Выложить рыбу в форму', 'Нарезать помидоры дольками, смешать с маслинами и каперсами', 'Выложить овощи вокруг рыбы', 'Полить маслом, запекать 20 мин при 190°C'],
    tags: ['ужин', 'рыба', 'средиземноморское', 'низкий уголь'],
  },
  {
    name: 'Омлет-рулет с курицей и шпинатом', meal: 'breakfast', prepTimeMin: 15,
    kcal: 380, protein: 44, fat: 18, carbs: 6,
    ingredients: ['Яйца 4 шт', 'Куриная грудка варёная 100г', 'Шпинат 50г', 'Сыр сливочный 30г', 'Специи'],
    instructions: ['Взбить яйца, вылить тонким слоем на сковороду', 'Готовить 3 мин до схватывания', 'Выложить на омлет курицу, шпинат и сыр', 'Свернуть рулетом, прогреть 2 мин', 'Нарезать поперёк на порции'],
    tags: ['завтрак', 'высокий белок', 'низкий уголь', 'рулет'],
  },
  {
    name: 'Гранола белковая с орехами и сухофруктами', meal: 'breakfast', prepTimeMin: 30,
    kcal: 460, protein: 30, fat: 20, carbs: 44,
    ingredients: ['Овсяные хлопья 80г', 'Протеин сывороточный 25г', 'Орехи миндаль 30г', 'Мёд 15г', 'Масло кокосовое 10г', 'Клюква сушёная 20г'],
    instructions: ['Смешать овсянку, протеин, измельчённые орехи', 'Растопить мёд с кокосовым маслом, влить в смесь', 'Выложить на противень, запекать 20 мин при 160°C', 'Добавить клюкву после выпечки, хранить в банке'],
    tags: ['завтрак', 'высокий белок', 'домашняя гранола', 'meal prep'],
  },

  {
    name: 'Яйца скрэмбл с творогом и красной рыбой', meal: 'breakfast', prepTimeMin: 8,
    kcal: 380, protein: 38, fat: 22, carbs: 4,
    ingredients: ['Яйца 3 шт', 'Творог 5% 100г', 'Сёмга слабосолёная 50г', 'Укроп', 'Сливочное масло 10г'],
    instructions: ['Взбить яйца с творогом до однородности', 'На сковороде растопить масло', 'Влить яичную смесь, помешивать лопаткой 3 мин', 'Добавить нарезанную сёмгу и укроп, перемешать, снять с огня'],
    tags: ['завтрак', 'высокий белок', 'кето', 'быстро'],
  },
  {
    name: 'Салат с печенью трески и яйцом', meal: 'lunch', prepTimeMin: 10,
    kcal: 420, protein: 28, fat: 32, carbs: 8,
    ingredients: ['Печень трески консерв. 100г', 'Яйца 2 шт', 'Огурец 1 шт', 'Салатный микс 80г', 'Лимонный сок'],
    instructions: ['Отварить яйца, нарезать кубиками', 'Огурец нарезать, смешать с салатом', 'Добавить печень трески кусочками', 'Заправить лимонным соком (масло из печени уже есть)'],
    tags: ['обед', 'омега-3', 'быстро', 'без готовки'],
  },
  {
    name: 'Перец фаршированный индейкой и киноа', meal: 'dinner', prepTimeMin: 35,
    kcal: 400, protein: 38, fat: 12, carbs: 38,
    ingredients: ['Перец болгарский 2 шт', 'Фарш индейки 150г', 'Киноа 50г', 'Лук 1/2', 'Томатный соус 100мл', 'Петрушка'],
    instructions: ['Отварить киноа 12 мин', 'Смешать фарш с киноа, мелко рубленым луком и зеленью', 'Начинить перцы, выложить в сотейник', 'Залить томатным соусом, тушить 25 мин'],
    tags: ['ужин', 'высокий белок', 'овощи', 'meal prep'],
  },

  {
    name: 'Куриные сердечки в сметанном соусе', meal: 'lunch', prepTimeMin: 20,
    kcal: 340, protein: 36, fat: 16, carbs: 12,
    ingredients: ['Куриные сердечки 250г', 'Сметана 10% 80г', 'Лук 1 шт', 'Чеснок 2 зуб.', 'Горчица 1 ч.л.', 'Укроп'],
    instructions: ['Промыть сердечки, разрезать пополам', 'Обжарить лук 2 мин, добавить сердечки, жарить 7 мин', 'Добавить сметану, горчицу, чеснок', 'Тушить 10 мин под крышкой', 'Посыпать укропом'],
    tags: ['обед', 'субпродукты', 'быстро', 'железо'],
  },
  {
    name: 'Лаваш с тунцом и овощами (шаурма фит)', meal: 'lunch', prepTimeMin: 10,
    kcal: 380, protein: 34, fat: 14, carbs: 32,
    ingredients: ['Лаваш тонкий 1 шт', 'Тунец консерв. 150г', 'Огурец 1/2', 'Помидор 1 шт', 'Капуста пекинская 50г', 'Сметана 10% 30г', 'Чеснок'],
    instructions: ['Размять тунец вилкой', 'Нашинковать капусту, нарезать огурец и помидор', 'Смешать сметану с чесноком', 'Выложить начинку на лаваш, полить соусом', 'Свернуть плотно, обжарить на сухой сковороде по 2 мин с каждой стороны'],
    tags: ['обед', 'быстро', 'высокий белок', 'без готовки'],
  },
  {
    name: 'Тыквенно-имбирный суп с креветками', meal: 'dinner', prepTimeMin: 25,
    kcal: 320, protein: 28, fat: 12, carbs: 28,
    ingredients: ['Тыква 300г', 'Креветки очищенные 120г', 'Имбирь свежий 15г', 'Кокосовое молоко 100мл', 'Лук 1/2', 'Карри 1 ч.л.'],
    instructions: ['Тыкву нарезать, варить 15 мин', 'Добавить лук, имбирь, карри, варить 5 мин', 'Измельчить блендером, добавить кокосовое молоко', 'Отдельно обжарить креветки 3 мин', 'Подавать суп с креветками сверху'],
    tags: ['ужин', 'суп', 'морепродукты', 'имбирь'],
  },

  {
    name: 'Кабачковая лапша с фрикадельками из индейки', meal: 'dinner', prepTimeMin: 20,
    kcal: 340, protein: 38, fat: 14, carbs: 16,
    ingredients: ['Кабачки 2 шт', 'Фарш индейки 180г', 'Чеснок 2 зуб.', 'Томатный соус 100мл', 'Пармезан 10г', 'Базилик'],
    instructions: ['Сделать из кабачков спагетти ножом для овощей', 'Сформировать мини-фрикадельки, обжарить 6 мин', 'Добавить томатный соус и чеснок, тушить 5 мин', 'Добавить кабачковую лапшу, прогреть 2 мин', 'Посыпать пармезаном и базиликом'],
    tags: ['ужин', 'низкий уголь', 'овощи', 'высокий белок'],
  },
  {
    name: 'Салат с ростбифом и рукколой', meal: 'lunch', prepTimeMin: 15,
    kcal: 420, protein: 44, fat: 22, carbs: 10,
    ingredients: ['Говядина ростбиф 150г', 'Руккола 60г', 'Пармезан 20г', 'Черри 80г', 'Оливковое масло 1 ст.л.', 'Бальзамический уксус'],
    instructions: ['Нарезать ростбиф тонкими ломтиками', 'Выложить рукколу, сверху ростбиф', 'Добавить половинки черри', 'Полить маслом и уксусом, посыпать пармезаном'],
    tags: ['обед', 'итальянское', 'высокий белок', 'без готовки'],
  },
  {
    name: 'Творожный крем-суп с курицей', meal: 'lunch', prepTimeMin: 20,
    kcal: 360, protein: 40, fat: 12, carbs: 22,
    ingredients: ['Творожный сыр 80г', 'Куриная грудка 150г', 'Цветная капуста 200г', 'Чеснок 2 зуб.', 'Укроп'],
    instructions: ['Отварить цветную капусту 10 мин', 'Курицу отварить и нарезать кусочками', 'Пюрировать капусту с 200мл отвара блендером', 'Добавить творожный сыр, взбить, прогреть', 'Добавить курицу, посыпать укропом'],
    tags: ['обед', 'суп', 'высокий белок', 'крем-суп'],
  },
  {
    name: 'Греческий салат с протеином (тунец/курица)', meal: 'lunch', prepTimeMin: 10,
    kcal: 340, protein: 34, fat: 18, carbs: 12,
    ingredients: ['Тунец консерв. 150г или курица отварная 150г', 'Огурец 100г', 'Помидоры черри 100г', 'Фета 40г', 'Маслины 30г', 'Оливковое масло 1 ст.л.'],
    instructions: ['Нарезать овощи кубиками', 'Добавить тунец или курицу', 'Маслины и фета сверху', 'Полить маслом, перемешать'],
    tags: ['обед', 'греческий', 'быстро', 'высокий белок'],
  },
  {
    name: 'Куриные крылья в пармезановой панировке', meal: 'dinner', prepTimeMin: 35,
    kcal: 520, protein: 46, fat: 28, carbs: 18,
    ingredients: ['Куриные крылья 300г', 'Пармезан 30г', 'Панировочные сухари 20г', 'Яйцо 1 шт', 'Паприка', 'Чеснок в порошке'],
    instructions: ['Смешать пармезан, сухари и специи', 'Обмакнуть крылья в яйцо, затем в панировку', 'Запекать на решётке 30 мин при 200°C', 'Подавать с соусом на выбор'],
    tags: ['ужин', 'высокий белок', 'запечённое', 'панировка'],
  },


  {
    name: 'Бананово-белковый пудинг (чиа)', meal: 'snack', prepTimeMin: 5,
    kcal: 220, protein: 26, fat: 8, carbs: 20,
    ingredients: ['Семена чиа 20г', 'Протеин 20г', 'Молоко 200мл', 'Банан 1/2', 'Стевия'],
    instructions: ['Размять банан, смешать с молоком и протеином', 'Добавить семена чиа, размешать', 'Оставить в холодильнике на ночь', 'Утром размешать и можно есть'],
    tags: ['перекус', 'десерт', 'высокий белок', 'чиа'],
  },
  {
    name: 'Зразы куриные с сыром и зеленью', meal: 'lunch', prepTimeMin: 25,
    kcal: 420, protein: 46, fat: 18, carbs: 16,
    ingredients: ['Фарш куриный 200г', 'Сыр твёрдый 40г', 'Укроп', 'Петрушка', 'Чеснок 1 зуб.', 'Яйцо 1 шт'],
    instructions: ['Смешать фарш с яйцом, солью, специями', 'Натереть сыр, смешать с зеленью и чесноком', 'Сформировать лепёшку, выложить начинку, закрыть', 'Запечь 20 мин при 190°C или жарить по 5 мин с каждой стороны'],
    tags: ['обед', 'высокий белок', 'с начинкой', 'meal prep'],
  },
  {
    name: 'Утиная грудка с яблочно-клюквенным соусом', meal: 'dinner', prepTimeMin: 30,
    kcal: 540, protein: 38, fat: 26, carbs: 38,
    ingredients: ['Утиная грудка 200г', 'Яблоко 1 шт', 'Клюква сушёная 20г', 'Мёд 1 ч.л.', 'Имбирь', 'Батат 150г'],
    instructions: ['Надрезать кожу утки ромбиками', 'Обжарить утку кожей вниз 7 мин, затем перевернуть на 4 мин', 'Отдельно потушить яблоко кубиками с клюквой, мёдом и имбирём', 'Нарезать утку ломтиками', 'Подавать с соусом и запечённым бататом'],
    tags: ['ужин', 'птица', 'праздничное', 'изысканное'],
  },
  {
    name: 'Белок яичный пирог с курицей и брокколи', meal: 'lunch', prepTimeMin: 35,
    kcal: 340, protein: 42, fat: 10, carbs: 18,
    ingredients: ['Яичные белки 6 шт', 'Куриная грудка варёная 150г', 'Брокколи 150г', 'Молоко 50мл', 'Специи'],
    instructions: ['Брокколи разобрать, бланшировать 3 мин', 'Курицу нарезать кубиками', 'Взбить белки с молоком, солью', 'Выложить курицу и брокколи в форму, залить белковой смесью', 'Запекать 25 мин при 180°C'],
    tags: ['обед', 'высокий белок', 'низкий жир', 'низкий уголь'],
  },
  {
    name: 'Свиные стейки с грушевым чатни', meal: 'dinner', prepTimeMin: 25,
    kcal: 520, protein: 44, fat: 24, carbs: 34,
    ingredients: ['Свиная шея/карбонат 200г', 'Груша 1 шт', 'Лук красный 1/2', 'Уксус бальзамический 1 ст.л.', 'Мёд 1 ч.л.', 'Тимьян'],
    instructions: ['Нарезать грушу и лук кубиками', 'Тушить с уксусом и мёдом 10 мин до соуса', 'Обжарить свиной стейк по 5 мин с каждой стороны', 'Полить грушевым чатни, украсить тимьяном'],
    tags: ['ужин', 'свинина', 'изысканное', 'соус'],
  },
  {
    name: 'Завтрак мексиканский (чаквайл) с яйцом', meal: 'breakfast', prepTimeMin: 15,
    kcal: 420, protein: 34, fat: 18, carbs: 32,
    ingredients: ['Яйца 2 шт', 'Фарш индейки 100г', 'Перец болгарский 1/2', 'Помидоры 100г', 'Черная фасоль 80г', 'Авокадо 1/4', 'Чили, кинза'],
    instructions: ['Обжарить фарш 4 мин, добавить перец и помидоры', 'Добавить фасоль, тушить 5 мин', 'Сделать углубления, вбить яйца', 'Накрыть крышкой, готовить 5 мин до желаемой степени яиц', 'Подавать с авокадо и кинзой'],
    tags: ['завтрак', 'мексиканское', 'сытное', 'высокий белок'],
  },
  {
    name: 'Салат с курицей, манго и орехом кешью', meal: 'lunch', prepTimeMin: 15,
    kcal: 400, protein: 38, fat: 16, carbs: 28,
    ingredients: ['Куриная грудка 150г', 'Манго 100г', 'Салатный микс 80г', 'Кешью 20г', 'Лайм', 'Оливковое масло', 'Мёд 1 ч.л.'],
    instructions: ['Отварить или обжарить курицу, нарезать', 'Манго нарезать соломкой', 'Смешать салат, курицу, манго, кешью', 'Заправка: масло, сок лайма, мёд'],
    tags: ['обед', 'фруктовый', 'высокий белок', 'летнее'],
  },
  {
    name: 'Овсянка солёная с яйцом и авокадо (сэвэри)', meal: 'breakfast', prepTimeMin: 8,
    kcal: 420, protein: 28, fat: 20, carbs: 38,
    ingredients: ['Овсяные хлопья 50г', 'Вода 150мл', 'Яйцо 1 шт', 'Авокадо 1/4', 'Соевый соус 1 ч.л.', 'Кунжут', 'Зелёный лук'],
    instructions: ['Сварить овсянку на воде 5 мин', 'Сверху выложить яйцо пашот', 'Добавить ломтики авокадо', 'Полить соевым соусом, посыпать кунжутом и луком'],
    tags: ['завтрак', 'несладкая', 'овощи', 'оригинальное'],
  },
  {
    name: 'Рыбные палочки из трески в протеиновой панировке', meal: 'lunch', prepTimeMin: 20,
    kcal: 340, protein: 42, fat: 10, carbs: 20,
    ingredients: ['Филе трески 200г', 'Протеин без вкуса 30г', 'Яйцо 1 шт', 'Паприка', 'Куркума', 'Лимон'],
    instructions: ['Нарезать рыбу полосками 2×8см', 'Смешать протеин со специями', 'Обмакнуть полоски в яйцо, затем в протеин', 'Запекать 15 мин при 200°C (или на антипригарной сковороде 3 мин с каждой стороны)'],
    tags: ['обед', 'рыба', 'высокий белок', 'панировка'],
  },
  {
    name: 'Куриный паприкаш с цукини', meal: 'dinner', prepTimeMin: 25,
    kcal: 400, protein: 44, fat: 14, carbs: 24,
    ingredients: ['Куриное филе 200г', 'Цукини 200г', 'Сметана 10% 80г', 'Паприка сладкая 1 ст.л.', 'Лук 1 шт', 'Чеснок 2 зуб.'],
    instructions: ['Нарезать курицу кубиками, обжарить 5 мин', 'Добавить лук, цукини кубиками, жарить 5 мин', 'Добавить паприку и чеснок', 'Влить сметану, тушить 8 мин до готовности'],
    tags: ['ужин', 'венгерское', 'высокий белок', 'быстро'],
  },
  {
    name: 'Индейка с ананасом и карри', meal: 'dinner', prepTimeMin: 18,
    kcal: 400, protein: 44, fat: 10, carbs: 34,
    ingredients: ['Филе индейки 200г', 'Ананас свежий/конс. 100г', 'Кокосовое молоко 80мл', 'Паста карри 1 ст.л.', 'Имбирь', 'Кинза', 'Рис жасмин 50г'],
    instructions: ['Отварить рис 10 мин', 'Нарезать индейку кубиками, обжарить 5 мин', 'Добавить ананас кубиками, пасту карри и имбирь', 'Влить кокосовое молоко, тушить 5 мин', 'Подавать с рисом и кинзой'],
    tags: ['ужин', 'тайское', 'высокий белок', 'азиатское'],
  },


  {
    name: 'Кролик тушёный в сметане с черносливом', meal: 'dinner', prepTimeMin: 45,
    kcal: 480, protein: 46, fat: 18, carbs: 32,
    ingredients: ['Кролик (тушка) 300г', 'Сметана 10% 100г', 'Чернослив 50г', 'Лук 1 шт', 'Морковь 1 шт', 'Лавровый лист', 'Тимьян'],
    instructions: ['Разобрать кролика на порционные куски', 'Обжарить со всех сторон 8 мин', 'Добавить лук и морковь, жарить 4 мин', 'Залить 200мл воды, сметану, лавровый лист', 'Тушить 30 мин до мягкости', 'За 10 мин до конца добавить чернослив'],
    tags: ['ужин', 'диетическое', 'высокий белок', 'изысканное'],
  },

  {
    name: 'Куриный пирог с овощами (фит-киш)', meal: 'dinner', prepTimeMin: 40,
    kcal: 380, protein: 40, fat: 16, carbs: 20,
    ingredients: ['Куриная грудка 150г', 'Яйца 3 шт', 'Цукини 100г', 'Перец 1/2', 'Лук 1/2', 'Молоко 80мл', 'Сыр твёрдый 30г'],
    instructions: ['Курицу отварить, нарезать мелкими кубиками', 'Овощи нарезать, обжарить 4 мин', 'Взбить яйца с молоком и солью', 'Смешать курицу, овощи, залить яичной смесью', 'Посыпать сыром, запечь 30 мин при 190°C'],
    tags: ['ужин', 'высокий белок', 'пирог', 'овощи'],
  },
  {
    name: 'Салат с говядиной, гранатом и грецким орехом', meal: 'dinner', prepTimeMin: 15,
    kcal: 460, protein: 38, fat: 26, carbs: 24,
    ingredients: ['Говядина отварная 150г', 'Гранат 1/2', 'Грецкие орехи 20г', 'Руккола 80г', 'Сыр фета 30г', 'Оливковое масло', 'Бальзамический крем'],
    instructions: ['Нарезать говядину тонкими ломтиками', 'Выложить рукколу, говядину, зёрна граната', 'Покрошить фету и орехи', 'Полить маслом и бальзамическим кремом'],
    tags: ['ужин', 'салат', 'высокий белок', 'праздничное'],
  },
  {
    name: 'Яйца бенедикт с лососем (фит-версия)', meal: 'breakfast', prepTimeMin: 15,
    kcal: 400, protein: 36, fat: 24, carbs: 12,
    ingredients: ['Яйца 2 шт', 'Сёмга слабосолёная 60г', 'Хлеб цельнозерновой 30г', 'Греческий йогурт 60г', 'Горчица дижонская 1 ч.л.', 'Лимонный сок', 'Уксус для пашот'],
    instructions: ['Сделать яйца пашот (вода+уксус, воронка, 3 мин)', 'Поджарить хлеб', 'Соус: смешать йогурт, горчицу, лимонный сок', 'Выложить на хлеб: сёмгу, яйцо пашот, соус'],
    tags: ['завтрак', 'высокий белок', 'изысканное', 'бенедикт'],
  },
  {
    name: 'Куриная грудка, фаршированная шпинатом и рикоттой', meal: 'dinner', prepTimeMin: 30,
    kcal: 420, protein: 56, fat: 16, carbs: 8,
    ingredients: ['Куриная грудка 250г', 'Шпинат 100г', 'Рикотта 60г', 'Чеснок 1 зуб.', 'Соль, перец', 'Оливковое масло'],
    instructions: ['Сделать кармашек в грудке острым ножом', 'Обжарить шпинат с чесноком 1 мин', 'Смешать шпинат с рикоттой', 'Начинить кармашек, заколоть зубочисткой', 'Обжарить 3 мин с каждой стороны, затем 15 мин в духовке при 190°C'],
    tags: ['ужин', 'высокий белок', 'фаршированное', 'низкий уголь'],
  },
  {
    name: 'Плов с курицей (фит-версия без масла)', meal: 'lunch', prepTimeMin: 35,
    kcal: 500, protein: 42, fat: 8, carbs: 62,
    ingredients: ['Куриное бедро без кожи 200г', 'Рис длиннозёрный 100г', 'Морковь 1 шт', 'Лук 1 шт', 'Чеснок 3 зуб.', 'Зира', 'Куркума', 'Барбарис опционально'],
    instructions: ['Нарезать курицу кубиками, обжарить без масла 6 мин', 'Добавить лук и натёртую морковь, тушить 5 мин', 'Добавить рис, залить 250мл воды', 'Добавить специи и целые зубчики чеснока', 'Накрыть крышкой, варить 15 мин на слабом огне', 'Выключить, не открывать 5 мин'],
    tags: ['обед', 'плов', 'высокий белок', 'узбекское'],
  },
  {
    name: 'Куриные желудки тушёные с луком и сметаной', meal: 'lunch', prepTimeMin: 35,
    kcal: 340, protein: 38, fat: 14, carbs: 14,
    ingredients: ['Куриные желудки 300г', 'Лук 2 шт', 'Сметана 10% 80г', 'Морковь 1 шт', 'Лавровый лист', 'Соль, перец'],
    instructions: ['Промыть желудки, разрезать пополам', 'Отварить 20 мин в подсоленной воде', 'Обжарить лук с морковью 4 мин', 'Добавить желудки и сметану, тушить 10 мин', 'Подавать с гарниром из гречки или овощей'],
    tags: ['обед', 'субпродукты', 'недорогое', 'высокий белок'],
  },
  {
    name: 'Протеиновые вафли', meal: 'breakfast', prepTimeMin: 10,
    kcal: 360, protein: 38, fat: 10, carbs: 30,
    ingredients: ['Протеин 30г', 'Яйца 2 шт', 'Овсяная мука 30г', 'Молоко 40мл', 'Разрыхлитель', 'Стевия'],
    instructions: ['Смешать все ингредиенты в блендере до однородного теста', 'Выпекать в вафельнице 4 мин', 'Подавать с ягодами и сиропом без сахара'],
    tags: ['завтрак', 'высокий белок', 'быстро', 'вафли'],
  },

  {
    name: 'Котлеты рыбные из горбуши с творогом', meal: 'lunch', prepTimeMin: 22,
    kcal: 360, protein: 40, fat: 16, carbs: 12,
    ingredients: ['Горбуша консервированная 200г', 'Творог 5% 100г', 'Яйцо 1 шт', 'Лук 1/2', 'Укроп', 'Кукурузная мука 15г'],
    instructions: ['Размять горбушу вилкой, удалить кости', 'Смешать с творогом, яйцом, рубленым луком и укропом', 'Добавить кукурузную муку для связки', 'Сформировать котлеты, запечь 18 мин при 190°C'],
    tags: ['обед', 'рыба', 'высокий белок', 'быстро'],
  },
  {
    name: 'Вок с креветками и овощами', meal: 'dinner', prepTimeMin: 15,
    kcal: 380, protein: 34, fat: 10, carbs: 40,
    ingredients: ['Креветки 160г', 'Рисовая лапша 60г', 'Брокколи 80г', 'Морковь 1/2', 'Перец 1/2', 'Соевый соус 2 ст.л.', 'Кунжутное масло 1 ч.л.', 'Имбирь'],
    instructions: ['Замочить лапшу в кипятке 5 мин, слить', 'Обжарить креветки с имбирём 2 мин', 'Добавить нарезанные овощи, жарить 4 мин вок', 'Добавить лапшу, соевый соус и кунжутное масло', 'Тщательно перемешать, прогревать 2 мин', 'Посыпать кунжутом'],
    tags: ['ужин', 'азиатское', 'быстро', 'морепродукты'],
  },
  {
    name: 'Творожно-тыквенная запеканка с протеином', meal: 'breakfast', prepTimeMin: 35,
    kcal: 360, protein: 36, fat: 6, carbs: 40,
    ingredients: ['Тыква 200г', 'Творог обезжиренный 200г', 'Протеин ванильный 25г', 'Яйца 2 шт', 'Корица', 'Стевия'],
    instructions: ['Тыкву нарезать, запечь 15 мин при 190°C или отварить', 'Измельчить тыкву в пюре', 'Смешать творог, тыквенное пюре, протеин, яйца, корицу', 'Выложить в форму, запекать 20 мин при 180°C', 'Остудить 10 мин, нарезать порционно'],
    tags: ['завтрак', 'высокий белок', 'осень', 'запеканка'],
  },
  {
    name: 'Говядина стейк «Рамп» с зелёным маслом', meal: 'dinner', prepTimeMin: 15,
    kcal: 520, protein: 48, fat: 32, carbs: 4,
    ingredients: ['Говяжий стейк 200г', 'Сливочное масло 20г', 'Петрушка', 'Укроп', 'Чеснок 1 зуб.', 'Лимонная цедра'],
    instructions: ['Смешать масло с рубленой зеленью, чесноком и цедрой', 'Сформировать в рулет, убрать в морозилку 5 мин', 'Обжарить стейк по 4 мин с каждой стороны', 'Дать отдохнуть 3 мин', 'Сверху выложить кружок зелёного масла'],
    tags: ['ужин', 'стейк', 'высокий белок', 'кето', 'ресторан'],
  },
  {
    name: 'Сэндвич с куриным шницелем и кетчупом без сахара', meal: 'lunch', prepTimeMin: 15,
    kcal: 440, protein: 44, fat: 14, carbs: 36,
    ingredients: ['Куриная грудка 150г', 'Хлеб цельнозерновой 2 куска', 'Яйцо 1 шт', 'Панировочные сухари 15г', 'Салат айсберг', 'Кетчуп без сахара 20г', 'Паприка'],
    instructions: ['Отбить курицу тонко, посолить', 'Обмакнуть в яйцо и сухари с паприкой', 'Запечь или обжарить 6 мин с каждой стороны', 'Поджарить хлеб, собрать сэндвич: хлеб, салат, шницель, кетчуп'],
    tags: ['обед', 'быстро', 'высокий белок', 'сэндвич'],
  },
  {
    name: 'Смузи-боул протеиновый «Красный бархат»', meal: 'snack', prepTimeMin: 5,
    kcal: 300, protein: 34, fat: 6, carbs: 30,
    ingredients: ['Протеин шоколад 30г', 'Свёкла варёная 50г', 'Кефир 200мл', 'Банан 1/2', 'Какао 1 ст.л.', 'Кокосовая стружка'],
    instructions: ['Все ингредиенты в блендер', 'Взбить 30 сек до густой консистенции', 'Перелить в миску', 'Посыпать кокосовой стружкой и дроблёным миндалём'],
    tags: ['перекус', 'десерт', 'высокий белок', 'быстро', 'свёкла'],
  },
  {
    name: 'Индейка с брюссельской капустой и беконом', meal: 'dinner', prepTimeMin: 22,
    kcal: 460, protein: 50, fat: 20, carbs: 18,
    ingredients: ['Филе индейки 200г', 'Брюссельская капуста 200г', 'Бекон 20г', 'Чеснок 2 зуб.', 'Оливковое масло', 'Бальзамический уксус'],
    instructions: ['Брюссельскую капусту разрезать пополам, обжарить 5 мин', 'Добавить бекон кусочками, жарить 3 мин', 'Отодвинуть, обжарить индейку с чесноком 6 мин', 'Перемешать всё, сбрызнуть бальзамиком', 'Запекать 5 мин при 200°C'],
    tags: ['ужин', 'низкий уголь', 'высокий белок', 'овощи'],
  },

  {
    name: 'Грибной суп-пюре с куриными кнелями', meal: 'lunch', prepTimeMin: 30,
    kcal: 300, protein: 28, fat: 12, carbs: 20,
    ingredients: ['Шампиньоны 250г', 'Куриный фарш 100г', 'Лук 1 шт', 'Картофель 1 шт', 'Сливки 10% 50мл', 'Тимьян', 'Яйцо 1 шт'],
    instructions: ['Обжарить грибы с луком 5 мин', 'Добавить картофель кубиками и 400мл воды, варить 12 мин', 'Измельчить блендером, добавить сливки', 'Кнели: смешать фарш с яйцом, сформировать шарики', 'Добавить кнели в суп, варить 5 мин', 'Подавать с тимьяном'],
    tags: ['обед', 'суп', 'грибы', 'высокий белок'],
  },
  {
    name: 'Спагетти болоньезе из индейки', meal: 'lunch', prepTimeMin: 25,
    kcal: 480, protein: 40, fat: 12, carbs: 58,
    ingredients: ['Паста спагетти 70г', 'Фарш индейки 180г', 'Томаты в собственном соку 200г', 'Лук 1 шт', 'Морковь 1 шт', 'Чеснок 2 зуб.', 'Базилик'],
    instructions: ['Отварить пасту до al dente', 'Обжарить фарш 5 мин, добавить лук и морковь', 'Жарить 4 мин, добавить томаты и чеснок', 'Тушить 15 мин до загустения', 'Подавать пасту с соусом и базиликом'],
    tags: ['обед', 'итальянское', 'высокий белок', 'медленные угли'],
  },

  {
    name: 'Куриные рулетики с вялеными томатами и моцареллой', meal: 'dinner', prepTimeMin: 25,
    kcal: 420, protein: 48, fat: 18, carbs: 12,
    ingredients: ['Куриная грудка 200г', 'Моцарелла 50г', 'Вяленые томаты 30г', 'Базилик', 'Оливковое масло', 'Шпажки'],
    instructions: ['Отбить курицу тонким пластом', 'Выложить моцареллу, вяленые томаты и базилик', 'Свернуть плотный рулет, закрепить шпажками', 'Обжарить со всех сторон 6 мин', 'Довести до готовности в духовке 12 мин при 190°C'],
    tags: ['ужин', 'итальянское', 'высокий белок', 'рулет'],
  },
  {
    name: 'Салат нисуаз фит (тунец, фасоль, яйцо)', meal: 'lunch', prepTimeMin: 15,
    kcal: 380, protein: 36, fat: 16, carbs: 22,
    ingredients: ['Тунец консерв. 150г', 'Фасоль стручковая 100г', 'Яйца 2 шт', 'Черри 80г', 'Маслины 30г', 'Оливковое масло', 'Горчица 1 ч.л.'],
    instructions: ['Отварить яйца и стручковую фасоль 5 мин', 'Нарезать яйца дольками, черри пополам', 'Выложить на тарелку: салат, фасоль, тунец, яйца, маслины', 'Заправка: масло, горчица, соль, перец'],
    tags: ['обед', 'французское', 'высокий белок', 'салат'],
  },
  {
    name: 'Рисовая каша с тыквой и протеином', meal: 'breakfast', prepTimeMin: 18,
    kcal: 380, protein: 32, fat: 6, carbs: 56,
    ingredients: ['Рис круглозёрный 50г', 'Молоко 250мл', 'Тыква 100г', 'Протеин ванильный 25г', 'Корица', 'Стевия'],
    instructions: ['Отварить рис в молоке 12 мин', 'Тыкву нарезать кубиками, добавить к рису', 'Варить 5 мин до мягкости тыквы', 'Снять с огня, вмешать протеин и корицу', 'Подавать тёплой'],
    tags: ['завтрак', 'осень', 'высокий белок', 'десерт'],
  },


  {
    name: 'Суп с фрикадельками и шпинатом', meal: 'lunch', prepTimeMin: 25,
    kcal: 340, protein: 34, fat: 14, carbs: 20,
    ingredients: ['Фарш куриный 150г', 'Шпинат 100г', 'Яйцо 1 шт', 'Лук 1/2', 'Морковь 1/2', 'Рис 30г', 'Зелень'],
    instructions: ['Смешать фарш с яйцом, сформировать маленькие фрикадельки', 'Довести до кипения 800мл воды, добавить рис', 'Через 5 мин добавить фрикадельки', 'Спустя 8 мин добавить шпинат и натёртую морковь', 'Варить 3 мин, посыпать зеленью'],
    tags: ['обед', 'суп', 'высокий белок', 'быстро'],
  },
  {
    name: 'Острая курица по-корейски (фит-таккокби)', meal: 'dinner', prepTimeMin: 25,
    kcal: 380, protein: 44, fat: 12, carbs: 26,
    ingredients: ['Куриные бёдра без кожи 250г', 'Перец чили 1/2', 'Чеснок 3 зуб.', 'Имбирь 10г', 'Соевый соус 2 ст.л.', 'Рисовый уксус 1 ст.л.', 'Кунжут', 'Рис 70г'],
    instructions: ['Нарезать курицу кубиками', 'Паста: соевый соус, уксус, рубленый чили, чеснок, имбирь', 'Обжарить курицу 6 мин', 'Залить пастой, тушить 10 мин', 'Отварить рис, подавать курицу сверху, посыпать кунжутом'],
    tags: ['ужин', 'корейское', 'острое', 'высокий белок'],
  },


  {
    name: 'Куриное филе «Пармезан» (фит-шницель)', meal: 'dinner', prepTimeMin: 25,
    kcal: 440, protein: 52, fat: 16, carbs: 22,
    ingredients: ['Куриная грудка 200г', 'Пармезан 25г', 'Яйцо 1 шт', 'Панировочные сухари 15г', 'Томатный соус 80мл', 'Моцарелла 30г'],
    instructions: ['Отбить курицу толщиной 1см', 'Панировка: яйцо → смесь сухарей+пармезан', 'Запечь 15 мин при 190°C', 'Сверху томатный соус и моцарелла', 'Запекать ещё 5 мин до расплавления сыра'],
    tags: ['ужин', 'итальянское', 'высокий белок', 'сыр'],
  },
  {
    name: 'Булгур с индейкой и гранатовой заправкой', meal: 'lunch', prepTimeMin: 25,
    kcal: 480, protein: 42, fat: 14, carbs: 48,
    ingredients: ['Филе индейки 180г', 'Булгур 70г', 'Гранат 1/4', 'Петрушка', 'Мята', 'Лимон', 'Оливковое масло'],
    instructions: ['Отварить булгур 12 мин', 'Обжарить индейку кубиками 6 мин', 'Смешать булгур с индейкой и зеленью', 'Заправка: оливковое масло, лимон, зёрна граната'],
    tags: ['обед', 'восточное', 'высокий белок', 'булгур'],
  },


  {
    name: 'Творожное печенье с шоколадными каплями', meal: 'snack', prepTimeMin: 25,
    kcal: 280, protein: 32, fat: 8, carbs: 22,
    ingredients: ['Творог обезжиренный 200г', 'Протеин шоколад 25г', 'Кокосовая мука 20г', 'Яйцо 1 шт', 'Стевия', 'Какао-крупка 10г'],
    instructions: ['Смешать творог, протеин, муку, яйцо, стевию', 'Вмешать какао-крупку', 'Сформировать печенья, выложить на противень', 'Выпекать 15 мин при 180°C', 'Остудить на решётке'],
    tags: ['перекус', 'десерт', 'высокий белок', 'печенье'],
  },
  {
    name: 'Запечённые куриные ножки в медово-соевом глазуре', meal: 'dinner', prepTimeMin: 40,
    kcal: 480, protein: 42, fat: 22, carbs: 30,
    ingredients: ['Куриные ножки 300г', 'Соевый соус 2 ст.л.', 'Мёд 1 ст.л.', 'Чеснок 3 зуб.', 'Имбирь 15г', 'Кунжут'],
    instructions: ['Смешать соевый соус, мёд, чеснок, имбирь', 'Замариновать ножки минимум 30 мин', 'Запекать 30 мин при 200°C, поливая маринадом', 'Посыпать кунжутом, запечь ещё 3 мин'],
    tags: ['ужин', 'азиатское', 'высокий белок', 'хрустящие'],
  },



];

let _recipesWithUsefulness: Recipe[] | null = null;

export function getRecipes(): Recipe[] {
  if (!_recipesWithUsefulness) {
    _recipesWithUsefulness = RECIPE_DB.map(r => ({
      ...r,
      usefulness: calculateRecipeUsefulness(r),
    }));
  }
  return _recipesWithUsefulness;
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
