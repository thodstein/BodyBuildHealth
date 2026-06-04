import { FOOD_DB, getTopByProtein, getTopByCarbs, getTopByFat, type FoodFilter } from '../core/nutrition-database';
import type { NutritionTargets } from '../core/types';

export interface MealSlot {
  time: string;
  label: string;
  foods: MealFood[];
  totalKcal: number;
  totalP: number;
  totalF: number;
  totalC: number;
  pharmaNotes: string[];
  timingNote: string;
  isTrainingDay?: boolean;
}

export interface MealFood {
  id: string;
  name: string;
  grams: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  reason: string;
}

export interface DayMealPlan {
  meals: MealSlot[];
  totals: { kcal: number; protein: number; fat: number; carbs: number; water: number; fiber: number };
  warnings: string[];
  pharmaRules: PharmaRule[];
}

export interface PharmaRule {
  drug: string;
  rule: 'with_food' | 'empty_stomach' | 'carbs_required' | 'limit_potassium' | 'extra_water' | 'extra_magnesium' | 'avoid_sun' | 'with_fats';
  gramsCarbs?: number;
  details: string;
}

export interface MealPlanOptions {
  dietType?: 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'mediterranean';
  foodAllergies?: string[];
  foodIntolerances?: string[];
  excludedFoods?: string[];
  isTrainingDay?: boolean;
  trainingTime?: 'morning' | 'afternoon' | 'evening' | null;
  mealsPerDay?: number;
}

const FOOD_REQUIREMENTS: Record<string, 'with_food' | 'empty_stomach' | 'any' | 'carbs_required'> = {
  methand: 'with_food', oxan: 'with_food', stan: 'with_food', trena: 'with_food', halo: 'with_food',
  mk677: 'empty_stomach', cjc1295: 'empty_stomach', ghrp6: 'empty_stomach', ipamorelin: 'empty_stomach',
  berberine: 'with_food', omega3: 'with_food', magnesium: 'any', nac: 'any', tudca: 'any',
  telmisartan: 'any', nebivolol: 'any',
  ins_short: 'carbs_required', ins_aspart: 'carbs_required', ins_long: 'any', ins_detemir: 'any',
};

const PHARMA_NUTRITION_RULES: Record<string, PharmaRule[]> = {
  'ins_short': [{ drug: 'Инсулин короткий', rule: 'carbs_required', gramsCarbs: 60, details: 'Обязательно 50-80 г углеводов в приём вокруг инъекции для предотвращения гипогликемии.' }],
  'ins_aspart': [{ drug: 'Инсулин аспарт', rule: 'carbs_required', gramsCarbs: 50, details: 'Обязательно 40-60 г углеводов в приём вокруг инъекции.' }],
  'methand': [{ drug: 'Метандростенолон', rule: 'with_fats', details: 'Принимать с пищей, содержащей 10-15 г жиров для лучшей абсорбции (17α-алкилированный).' }],
  'oxan': [{ drug: 'Оксандролон', rule: 'with_fats', details: 'Принимать с пищей + жиры 10-15 г. 17α-алкилированный, гепатотоксичный.' }],
  'stan': [{ drug: 'Станозолол', rule: 'with_fats', details: 'Принимать с едой + жирами. Гепатотоксичный, снижает ЛПВП.' }],
  'trena': [{ drug: 'Туринабол', rule: 'with_food', details: 'Принимать с едой. 17α-алкилированный.' }],
  'mk677': [{ drug: 'Ibutamoren MK-677', rule: 'empty_stomach', details: 'На ночь натощак (за 30 мин до казеина). Усиливает выброс ГР на 70-90%.' }],
  'cjc1295': [{ drug: 'CJC-1295', rule: 'empty_stomach', details: 'Натощак. Не есть за 1 ч до и 30 мин после инъекции.' }],
  'ghrp6': [{ drug: 'GHRP-6', rule: 'empty_stomach', details: 'Натощак. Не есть за 1 ч до и 30 мин после. Может вызывать голод.' }],
  'кленбутерол': [{ drug: 'Кленбутерол', rule: 'extra_magnesium', details: 'Снижает K/Mg/таурин. Добавьте курагу, гречку, магний 400 мг, таурин 2 г.' }],
  'телмисартан': [{ drug: 'Телмисартан', rule: 'limit_potassium', details: 'Повышает K. Ограничьте калий до 3 г/день. Исключите: бананы (>400 мг K), картофель, шпинат, авокадо.' }],
  'метформин': [{ drug: 'Метформин', rule: 'with_food', details: 'Снижает B12/фолат. Добавьте метилкобаламин 1000 мкг/мес. Принимать с едой для снижения GI-побочек.' }],
  'статины': [{ drug: 'Статины', rule: 'with_food', details: 'Снижают CoQ10, повышают ALT. Добавьте CoQ10 200 мг. Принимать на ночь.' }],
  'анастрозол': [{ drug: 'Анастрозол', rule: 'with_fats', details: 'Снижает E2 → боли в суставы. Добавьте Омега-3 3 г + коллаген 10 г. Принимать с жирами.' }],
  'диклофенак': [{ drug: 'Диклофенак', rule: 'with_food', details: 'Повреждает слизистую ЖКТ. Добавьте яблоки, брокколи, кефир. Принимать с едой обязательно.' }],
  'мелоксикам': [{ drug: 'Мелоксикам', rule: 'with_food', details: 'Меньше GI-токсичности чем диклофенак, но нужна защита. Принимать с едой.' }],
};

const MEAL_TEMPLATES: Record<string, { time: string; label: string; timingNote: string; macroPct: { p: number; f: number; c: number } }[]> = {
  bulk: [
    { time: '07:00', label: 'Завтрак', timingNote: 'Белки + медленные углеводы. 17α-оральники — с едой. Пептиды ГР — натощак.', macroPct: { p: 0.25, f: 0.25, c: 0.25 } },
    { time: '10:00', label: 'Перекус', timingNote: 'Лёгкий белок + фрукт. Аминокислотный триггер mTOR.', macroPct: { p: 0.1, f: 0.1, c: 0.1 } },
    { time: '12:30', label: 'Обед', timingNote: 'Полноценный приём. Омега-3/береберин — с едой.', macroPct: { p: 0.25, f: 0.25, c: 0.15 } },
    { time: '15:00', label: 'Предтренировочный', timingNote: 'Казеин или лёгкий белок + углеводы. Креатин — здесь.', macroPct: { p: 0.1, f: 0.05, c: 0.1 } },
    { time: '17:00', label: 'После тренировки', timingNote: 'Быстрый белок + высокий GI. Инсулин — обязательные углеводы!', macroPct: { p: 0.15, f: 0.05, c: 0.2 } },
    { time: '19:30', label: 'Ужин', timingNote: 'Белки + жиры + овощи. Омега-3 — с едой.', macroPct: { p: 0.15, f: 0.25, c: 0.1 } },
    { time: '22:00', label: 'Перед сном', timingNote: 'Казеин/творог — антикатаболизм. MK-677 — натощак за 30 мин до.', macroPct: { p: 0.05, f: 0.05, c: 0.0 } },
  ],
  cut: [
    { time: '07:30', label: 'Завтрак', timingNote: 'Белки + минимум углеводов. Омега-3 с едой.', macroPct: { p: 0.3, f: 0.3, c: 0.1 } },
    { time: '12:00', label: 'Обед', timingNote: 'Белки + жиры + овощи + умеренные углеводы.', macroPct: { p: 0.3, f: 0.3, c: 0.2 } },
    { time: '15:30', label: 'Предтренировочный', timingNote: 'Лёгкий белок + немного углеводов.', macroPct: { p: 0.1, f: 0.1, c: 0.1 } },
    { time: '17:30', label: 'После тренировки', timingNote: 'Быстрый белок + углеводы для восстановления.', macroPct: { p: 0.15, f: 0.1, c: 0.15 } },
    { time: '20:00', label: 'Ужин', timingNote: 'Белки + жиры. Минимум углеводов.', macroPct: { p: 0.2, f: 0.2, c: 0.05 } },
    { time: '22:00', label: 'Перед сном', timingNote: 'Казеин 30-40 г — антикатаболизм 6-8 ч.', macroPct: { p: 0.05, f: 0.0, c: 0.0 } },
  ],
  maintenance: [
    { time: '08:00', label: 'Завтрак', timingNote: 'Белки + углеводы + жиры. Равномерное распределение.', macroPct: { p: 0.25, f: 0.25, c: 0.25 } },
    { time: '12:30', label: 'Обед', timingNote: 'Полноценный приём. Омега-3/добавки — с едой.', macroPct: { p: 0.3, f: 0.3, c: 0.25 } },
    { time: '16:00', label: 'Перекус', timingNote: 'Белок + фрукт или орехи.', macroPct: { p: 0.1, f: 0.1, c: 0.1 } },
    { time: '19:30', label: 'Ужин', timingNote: 'Белки + жиры + овощи.', macroPct: { p: 0.25, f: 0.25, c: 0.2 } },
    { time: '22:00', label: 'Перед сном', timingNote: 'Казеин/творог — по желанию.', macroPct: { p: 0.05, f: 0.05, c: 0.0 } },
  ],
  recomp: [
    { time: '07:30', label: 'Завтрак', timingNote: 'Белки + жиры + минимум углеводов. Тренировочный день — добавить углеводы.', macroPct: { p: 0.25, f: 0.3, c: 0.1 } },
    { time: '10:30', label: 'Перекус', timingNote: 'Лёгкий белок. Пептиды — натощак.', macroPct: { p: 0.1, f: 0.05, c: 0.05 } },
    { time: '13:00', label: 'Обед', timingNote: 'Белки + жиры + овощи. Береберин — с едой.', macroPct: { p: 0.25, f: 0.25, c: 0.15 } },
    { time: '16:30', label: 'После тренировки', timingNote: 'Белок + углеводы (только в тренировочный день).', macroPct: { p: 0.15, f: 0.1, c: 0.15 } },
    { time: '19:30', label: 'Ужин', timingNote: 'Белки + жиры + клетчатка.', macroPct: { p: 0.2, f: 0.3, c: 0.05 } },
    { time: '22:00', label: 'Перед сном', timingNote: 'Казеин 30 г.', macroPct: { p: 0.05, f: 0.0, c: 0.0 } },
  ],
  strength: [
    { time: '07:00', label: 'Завтрак', timingNote: 'Белки + углеводы за 2 ч до тренировки.', macroPct: { p: 0.2, f: 0.2, c: 0.25 } },
    { time: '10:00', label: 'Перекус', timingNote: 'Креатин + лёгкий белок.', macroPct: { p: 0.1, f: 0.1, c: 0.1 } },
    { time: '12:30', label: 'Обед', timingNote: 'Полный приём. Углеводы для энергии.', macroPct: { p: 0.25, f: 0.2, c: 0.2 } },
    { time: '15:00', label: 'Предтренировочный', timingNote: 'Углеводы + белок за 1.5 ч. Кофеин опционально.', macroPct: { p: 0.1, f: 0.05, c: 0.15 } },
    { time: '17:30', label: 'После тренировки', timingNote: 'Быстрый белок + углеводы. Инсулин — углеводы!', macroPct: { p: 0.2, f: 0.1, c: 0.2 } },
    { time: '20:00', label: 'Ужин', timingNote: 'Белки + жиры + овощи.', macroPct: { p: 0.2, f: 0.25, c: 0.1 } },
    { time: '22:30', label: 'Перед сном', timingNote: 'Казеин 40 г. MK-677 — натощак.', macroPct: { p: 0.05, f: 0.1, c: 0.0 } },
  ],
  rehab: [
    { time: '08:00', label: 'Завтрак', timingNote: 'Антиоксиданты (ягоды, овощи) + белки. Омега-3 с едой.', macroPct: { p: 0.25, f: 0.25, c: 0.2 } },
    { time: '12:00', label: 'Обед', timingNote: 'Полноценный приём. Омега-3 + коллаген.', macroPct: { p: 0.25, f: 0.25, c: 0.2 } },
    { time: '15:30', label: 'Полдник', timingNote: 'Белок + фрукты. Витамин C — синергия с NAC.', macroPct: { p: 0.1, f: 0.1, c: 0.1 } },
    { time: '19:00', label: 'Ужин', timingNote: 'Белки + жиры + овощи. BPC-157 — натощак за 30 мин.', macroPct: { p: 0.25, f: 0.25, c: 0.15 } },
    { time: '21:30', label: 'Перед сном', timingNote: 'Казеин 30-40 г. Магний — на ночь.', macroPct: { p: 0.1, f: 0.1, c: 0.0 } },
  ],
};

function buildFoodFilter(opts?: MealPlanOptions): FoodFilter | undefined {
  if (!opts) return undefined;
  const excludeIds: string[] = [...(opts.excludedFoods ?? [])];
  return {
    dietType: opts.dietType,
    excludeAllergens: opts.foodAllergies,
    excludedIds: excludeIds.length > 0 ? excludeIds : undefined,
  };
}

const REST_DAY_LABEL_MAP: Record<string, string> = {
  'Предтренировочный': 'Лёгкий перекус',
  'После тренировки': 'Полдник',
};

export function generateDayMealPlan(
  targets: NutritionTargets,
  goal: string,
  courseEntries: Array<{ substanceId: string; substanceName: string; doseValue: number; frequency: string | number }>,
  trainingTime: 'morning' | 'afternoon' | 'evening' | null,
  drugs?: string[],
  options?: MealPlanOptions,
): DayMealPlan {
  const isTrainDay = options?.isTrainingDay ?? true;
  const filter = buildFoodFilter(options);
  const template = MEAL_TEMPLATES[goal] || MEAL_TEMPLATES.maintenance;
  const desiredMeals = options?.mealsPerDay ?? template.length;
  const meals: MealSlot[] = [];
  const warnings: string[] = [];
  const pharmaRules: PharmaRule[] = [];

  if (options?.dietType && options.dietType !== 'omnivore') {
    warnings.push(`Диета: ${options.dietType}. Продукты отфильтрованы.`);
  }
  if (options?.foodAllergies && options.foodAllergies.length > 0) {
    warnings.push(`Аллергены исключены: ${options.foodAllergies.join(', ')}`);
  }

  if (courseEntries) {
    for (const entry of courseEntries) {
      const sid = entry.substanceId.toLowerCase();
      const rules = PHARMA_NUTRITION_RULES[sid];
      if (rules) pharmaRules.push(...rules);
    }
  }
  if (drugs) {
    for (const d of (drugs || [])) {
      const dl = d.toLowerCase();
      for (const [key, rules] of Object.entries(PHARMA_NUTRITION_RULES)) {
        if (dl.includes(key)) pharmaRules.push(...rules);
      }
    }
  }

  const potassiumLimit = pharmaRules.some(r => r.rule === 'limit_potassium');
  const carbsRequiredMeal = pharmaRules.find(r => r.rule === 'carbs_required');
  const needsExtraWater = pharmaRules.some(r => r.rule === 'extra_water');
  const needsExtraMg = pharmaRules.some(r => r.rule === 'extra_magnesium');
  const needsFats = pharmaRules.some(r => r.rule === 'with_fats');

  if (potassiumLimit) warnings.push('Телмисартан: ограничьте калий до 3 г/день. Исключены: бананы, картофель, шпинат, авокадо из рекомендаций.');
  if (carbsRequiredMeal) warnings.push(`Инсулин: обязательные ${carbsRequiredMeal.gramsCarbs} г углеводов вокруг инъекции.`);
  if (needsExtraWater) warnings.push('Тренболон: пейте минимум 4 л воды в день.');
  if (needsExtraMg) warnings.push('Кленбутерол: дополнительно Mg 400 мг + таурин 2 г.');

  let macroMultiplier = { p: 1, f: 1, c: 1, kcal: 1 };
  if (!isTrainDay) {
    macroMultiplier = { p: 1, f: 1.05, c: 0.85, kcal: 0.95 };
  }

  let slots = template;
  if (!isTrainDay) {
    slots = template.map(s => {
      const newLabel = REST_DAY_LABEL_MAP[s.label] || s.label;
      return { ...s, label: s.label === 'Предтренировочный' ? 'Лёгкий перекус' : s.label === 'После тренировки' ? 'Полдник' : s.label, macroPct: { ...s.macroPct } };
    });
  }

  if (desiredMeals < slots.length) {
    slots = slots.slice(0, desiredMeals);
  }

  for (let mi = 0; mi < slots.length; mi++) {
    const slot = slots[mi];
    let slotKcal = targets.kcal * slot.macroPct.c + targets.protein * 4 * slot.macroPct.p + targets.fats * 9 * slot.macroPct.f;
    slotKcal = Math.round((slotKcal || targets.kcal * (Object.values(slot.macroPct).reduce((a, b) => a + b, 0))) * macroMultiplier.kcal);
    const slotP = Math.round(targets.protein * slot.macroPct.p * macroMultiplier.p);
    const slotF = Math.round(targets.fats * slot.macroPct.f * macroMultiplier.f);
    const slotC = Math.round(targets.carbs * slot.macroPct.c * macroMultiplier.c);
    const slotFoods: MealFood[] = [];
    const mealNotes: string[] = [];
    let timingNote = slot.timingNote;

    if (!isTrainDay && (slot.label === 'Лёгкий перекус' || slot.label === 'Полдник')) {
      timingNote = 'День отдыха — лёгкий белок + клетчатка. Углеводы минимальны.';
    }

    const proteinFoods = getTopByProtein(8, filter).filter(f => !potassiumLimit || (f.name !== 'Банан' && f.name !== 'Картофель отварной'));
    const carbFoods = getTopByCarbs(8, filter).filter(f => !potassiumLimit || !['Банан', 'Картофель отварной'].includes(f.name));
    const fatFoods = getTopByFat(6, filter).filter(f => !potassiumLimit || !['Авокадо'].includes(f.name));

    let remainingP = slotP;
    let remainingC = slotC;
    let remainingF = slotF;

    const isMainMeal = slot.label === 'Завтрак' || slot.label === 'Обед' || slot.label === 'Ужин';
    const isWorkoutSlot = slot.label === 'После тренировки' || slot.label === 'Предтренировочный';
    const isSnack = slot.label === 'Перед сном' || slot.label === 'Перекус' || slot.label === 'Лёгкий перекус' || slot.label === 'Полдник';

    if (isMainMeal) {
      const mainProtein = proteinFoods[mi % proteinFoods.length];
      if (mainProtein) {
        const grams = Math.round((remainingP / mainProtein.protein) * 100);
        slotFoods.push({ id: mainProtein.id, name: mainProtein.name, grams, kcal: Math.round(mainProtein.kcal * grams / 100), protein: Math.round(mainProtein.protein * grams / 100), fat: Math.round(mainProtein.fat * grams / 100), carbs: Math.round(mainProtein.carbs * grams / 100), reason: mainProtein.description?.split('.')[0] || 'Основной белок' });
        remainingP -= Math.round(mainProtein.protein * grams / 100);
      }
    }

    if (isWorkoutSlot && isTrainDay) {
      const fastIds = options?.dietType === 'vegan' ? ['soy_protein'] : ['whey_protein'];
      const fastProtein = FOOD_DB.find(f => fastIds.includes(f.id) && (!filter || passesFilter(f, filter)));
      if (fastProtein && remainingP > 0) {
        const grams = Math.max(30, Math.round(remainingP / fastProtein.protein * 100));
        slotFoods.push({ id: fastProtein.id, name: fastProtein.name, grams, kcal: Math.round(fastProtein.kcal * grams / 100), protein: Math.round(fastProtein.protein * grams / 100), fat: Math.round(fastProtein.fat * grams / 100), carbs: Math.round(fastProtein.carbs * grams / 100), reason: 'Быстрый белок для mTOR' });
        remainingP -= Math.round(fastProtein.protein * grams / 100);
      }
    }

    if (isSnack) {
      const caseinIds = options?.dietType === 'vegan' ? ['soy_protein'] : ['cottage_cheese_5', 'casein'];
      let caseinFood: typeof FOOD_DB[number] | undefined;
      for (const cid of caseinIds) {
        const found = FOOD_DB.find(f => f.id === cid && (!filter || passesFilter(f, filter)));
        if (found) { caseinFood = found; break; }
      }
      if (caseinFood && remainingP > 0) {
        const grams = Math.min(200, Math.round(remainingP / caseinFood.protein * 100));
        slotFoods.push({ id: caseinFood.id, name: caseinFood.name, grams, kcal: Math.round(caseinFood.kcal * grams / 100), protein: Math.round(caseinFood.protein * grams / 100), fat: Math.round(caseinFood.fat * grams / 100), carbs: Math.round(caseinFood.carbs * grams / 100), reason: caseinFood.description?.split('.')[0] || 'Медленный белок' });
        remainingP -= Math.round(caseinFood.protein * grams / 100);
      }
    }

    if (remainingC > 20 && carbFoods.length > 0) {
      const carbFood = carbFoods[mi % carbFoods.length];
      const grams = Math.min(300, Math.round(remainingC / carbFood.carbs * 100));
      slotFoods.push({ id: carbFood.id, name: carbFood.name, grams, kcal: Math.round(carbFood.kcal * grams / 100), protein: Math.round(carbFood.protein * grams / 100), fat: Math.round(carbFood.fat * grams / 100), carbs: Math.round(carbFood.carbs * grams / 100), reason: carbFood.description?.split('.')[0] || 'Углеводы' });
    }

    if (needsFats && isMainMeal && remainingF > 5) {
      mealNotes.push('17α-оральники: принимайте с этим приёмом (с жирами 10-15 г)');
    }

    if (carbsRequiredMeal && isWorkoutSlot && isTrainDay) {
      mealNotes.push(`Инсулин: обязательные ${carbsRequiredMeal.gramsCarbs} г углеводов в этом приёме`);
    }

    for (const rule of pharmaRules) {
      if (rule.rule === 'empty_stomach' && (slot.label === 'Перед сном' || slot.label === 'Перекус' || slot.label === 'Лёгкий перекус' || slot.label === 'Завтрак')) {
        mealNotes.push(`${rule.drug}: ${rule.details}`);
      }
    }

    const totalKcal = slotFoods.reduce((s, f) => s + f.kcal, 0);
    const totalP = slotFoods.reduce((s, f) => s + f.protein, 0);
    const totalF = slotFoods.reduce((s, f) => s + f.fat, 0);
    const totalC = slotFoods.reduce((s, f) => s + f.carbs, 0);

    meals.push({ time: slot.time, label: slot.label, foods: slotFoods, totalKcal: totalKcal || Math.round(slotKcal), totalP: totalP || slotP, totalF: totalF || slotF, totalC: totalC || slotC, pharmaNotes: mealNotes, timingNote, isTrainingDay: isTrainDay });
  }

  const totals = {
    kcal: meals.reduce((s, m) => s + m.totalKcal, 0),
    protein: meals.reduce((s, m) => s + m.totalP, 0),
    fat: meals.reduce((s, m) => s + m.totalF, 0),
    carbs: meals.reduce((s, m) => s + m.totalC, 0),
    water: targets.water,
    fiber: targets.fiber,
  };

  return { meals, totals, warnings, pharmaRules };
}

function passesFilter(food: typeof FOOD_DB[number], filter: FoodFilter): boolean {
  if (filter.dietType) {
    const dt = filter.dietType;
    if (dt === 'vegan' && !(food.isVegan ?? food.dietTags?.includes('vegan'))) return false;
    if (dt === 'vegetarian' && !(food.isVegetarian ?? food.dietTags?.includes('vegetarian'))) return false;
    if (dt === 'pescatarian' && !((food.isVegetarian ?? food.dietTags?.includes('vegetarian')) || (food.dietTags?.includes('pescatarian')))) return false;
    if (dt === 'keto' && (food.carbs > 15) && food.id !== 'whey_protein') return false;
    if (dt === 'paleo' && food.dietTags && !food.dietTags.includes('paleo') && !food.dietTags.includes('whole30')) return false;
    if (dt === 'mediterranean' && food.dietTags && !food.dietTags.includes('mediterranean')) return false;
  }
  if (filter.excludeAllergens && filter.excludeAllergens.length > 0 && food.allergens) {
    if (filter.excludeAllergens.some(a => food.allergens!.includes(a))) return false;
  }
  if (filter.excludedIds && filter.excludedIds.includes(food.id)) return false;
  return true;
}