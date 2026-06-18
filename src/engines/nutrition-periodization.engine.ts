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
    name: 'Тунец с авокадо', meal: 'lunch', prepTimeMin: 5,
    kcal: 380, protein: 38, fat: 18, carbs: 12,
    ingredients: ['Тунец консерв. 150г', 'Авокадо 1/2', 'Лимонный сок', 'Цельнозерновой хлеб 60г', 'Соль, перец'],
    instructions: ['Размять тунец + авокадо', 'Лимонный сок + специи', 'На хлеб'],
    tags: ['обед', 'быстро', 'без готовки'],
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
    ingredients: ['Рисовая мука/манка 50г', 'Молоко 250мл (можно заменить на воду)', 'Протеин (ваниль/клубника) 30г', 'Стевия/сахарозаменитель'],
    instructions: ['Всыпать рисовую манку в кипящее молоко/воду', 'Варить на медленном огне 3-5 мин, помешивая', 'Снять с огня, добавить протеин, перемешать до однородности'],
    tags: ['завтрак', 'быстро', 'высокий белок', 'рисовый крем'],
  },
];

export function getRecipes(): Recipe[] { return RECIPE_DB; }

export function getRecipesByMeal(meal: string): Recipe[] {
  return RECIPE_DB.filter(r => r.meal === meal);
}

export function getRecipesByTag(tag: string): Recipe[] {
  return RECIPE_DB.filter(r => r.tags.includes(tag));
}

export function getHighProteinRecipes(minProtein: number = 40): Recipe[] {
  return RECIPE_DB.filter(r => r.protein >= minProtein);
}
