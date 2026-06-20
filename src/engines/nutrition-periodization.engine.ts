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
    name: 'Каша рисовая на молоке', meal: 'breakfast', prepTimeMin: 20,
    kcal: 320, protein: 12, fat: 8, carbs: 52,
    ingredients: ['Рис круглозёрный 50г', 'Молоко 300мл', 'Сливочное масло 10г', 'Стевия'],
    instructions: ['Рис залить молоком, довести до кипения', 'Варить 15 мин на слабом огне, помешивая', 'Добавить масло, перемешать'],
    tags: ['завтрак', 'классика', 'вегетарианское'],
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
    name: 'Киноа с овощами и нутом', meal: 'lunch', prepTimeMin: 20,
    kcal: 420, protein: 18, fat: 14, carbs: 58,
    ingredients: ['Киноа 80г', 'Нут варёный 150г', 'Перец болгарский 1/2', 'Огурец 1 шт', 'Оливковое масло 1 ст.л.', 'Лимон'],
    instructions: ['Отварить киноа 15 мин', 'Нарезать овощи кубиками', 'Смешать киноа, нут, овощи', 'Заправить маслом и лимоном'],
    tags: ['обед', 'веган', 'здоровое'],
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
    name: 'Тыквенный суп-пюре', meal: 'lunch', prepTimeMin: 25,
    kcal: 280, protein: 14, fat: 12, carbs: 32,
    ingredients: ['Тыква 300г', 'Морковь 1 шт', 'Лук 1 шт', 'Кокосовое молоко 100мл', 'Имбирь', 'Тыквенные семечки'],
    instructions: ['Нарезать тыкву и овощи кубиками', 'Варить в 300мл воды 20 мин', 'Измельчить блендером в пюре', 'Добавить кокосовое молоко, прогреть', 'Посыпать семечками'],
    tags: ['обед', 'суп', 'вегетарианское'],
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
    name: 'Яблоко с арахисовой пастой', meal: 'snack', prepTimeMin: 2,
    kcal: 260, protein: 10, fat: 14, carbs: 28,
    ingredients: ['Яблоко 1 шт', 'Арахисовая паста 25г'],
    instructions: ['Нарезать яблоко дольками', 'Макать в арахисовую пасту'],
    tags: ['перекус', 'быстро', 'без готовки', 'веган'],
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
    name: 'Кефир с отрубями', meal: 'snack', prepTimeMin: 2,
    kcal: 150, protein: 14, fat: 6, carbs: 14,
    ingredients: ['Кефир 250мл', 'Отруби овсяные 15г', 'Стевия'],
    instructions: ['Всыпать отруби в кефир', 'Размешать и дать постоять 2 мин', 'Пить или есть ложкой'],
    tags: ['перекус', 'быстро', 'клетчатка'],
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
