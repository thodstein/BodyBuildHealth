/**
 * Meal Planning System + Grocery Generator + Meal Prep Calendar
 *
 * Weekly Meal Planner: generates 7-day meal plans from macro targets
 * Grocery List Generator: auto-generates shopping list from meal plan
 * Meal Prep Calendar: batch cooking schedule with timing
 * Portion Guide: visual portion size reference
 * Food Swap Database: healthy substitutions
 * Eating Out Guide: how to order at restaurants for macros
 * Meal Timing Optimizer: circadian nutrition, training day vs rest day
 *
 * @module meal-planning-system
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface DailyMealPlan {
  day: string;
  dayName: string;
  isTrainingDay: boolean;
  meals: {
    name: string;
    time: string;
    foods: { name: string; amount: number; unit: string; kcal: number; protein: number; fat: number; carbs: number }[];
    totalKcal: number;
    totalProtein: number;
  }[];
  dailyKcal: number;
  dailyProtein: number;
  dailyFat: number;
  dailyCarbs: number;
}

export interface GroceryCategory {
  name: string;
  items: { name: string; quantity: number; unit: string; estimatedCost: number; notes: string }[];
}

export interface MealPrepTask {
  time: string;
  task: string;
  durationMin: number;
  category: 'cook' | 'chop' | 'portion' | 'clean' | 'store';
}

export interface FoodSwap {
  original: string;
  swap: string;
  reason: string;
  kcalSaved: number;
  proteinGained: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Weekly Meal Plan Generator
// ═══════════════════════════════════════════════════════════════════════════

const FOOD_TEMPLATES = {
  breakfast_bulk: [
    { name: 'Овсянка на молоке', amount: 100, unit: 'г', kcal: 370, protein: 12, fat: 7, carbs: 60 },
    { name: 'Яйца цельные', amount: 3, unit: 'шт', kcal: 230, protein: 19, fat: 16, carbs: 1 },
    { name: 'Тост цельнозерновой', amount: 2, unit: 'шт', kcal: 200, protein: 10, fat: 3, carbs: 32 },
    { name: 'Банан', amount: 1, unit: 'шт', kcal: 110, protein: 1, fat: 0, carbs: 27 },
  ],
  breakfast_cut: [
    { name: 'Яичные белки', amount: 200, unit: 'г', kcal: 104, protein: 22, fat: 0.4, carbs: 1.4 },
    { name: 'Овсянка на воде', amount: 60, unit: 'г', kcal: 210, protein: 7, fat: 4, carbs: 36 },
    { name: 'Ягоды замороженные', amount: 100, unit: 'г', kcal: 51, protein: 1, fat: 0.3, carbs: 12 },
  ],
  lunch_standard: [
    { name: 'Куриная грудка', amount: 200, unit: 'г', kcal: 330, protein: 62, fat: 7, carbs: 0 },
    { name: 'Рис басмати', amount: 150, unit: 'г', kcal: 520, protein: 11, fat: 1, carbs: 115 },
    { name: 'Брокколи', amount: 200, unit: 'г', kcal: 68, protein: 6, fat: 0.8, carbs: 14 },
    { name: 'Оливковое масло', amount: 10, unit: 'мл', kcal: 88, protein: 0, fat: 10, carbs: 0 },
  ],
  dinner_standard: [
    { name: 'Лосось / Говядина', amount: 200, unit: 'г', kcal: 360, protein: 40, fat: 21, carbs: 0 },
    { name: 'Картофель / Батат', amount: 250, unit: 'г', kcal: 215, protein: 4, fat: 0.3, carbs: 48 },
    { name: 'Овощной салат', amount: 200, unit: 'г', kcal: 60, protein: 3, fat: 1, carbs: 10 },
  ],
  snack_standard: [
    { name: 'Греческий йогурт', amount: 200, unit: 'г', kcal: 194, protein: 20, fat: 10, carbs: 8 },
    { name: 'Миндаль', amount: 30, unit: 'г', kcal: 175, protein: 6, fat: 15, carbs: 6 },
  ],
  post_workout: [
    { name: 'Сывороточный протеин', amount: 40, unit: 'г', kcal: 160, protein: 32, fat: 1, carbs: 4 },
    { name: 'Банан', amount: 1, unit: 'шт', kcal: 110, protein: 1, fat: 0, carbs: 27 },
    { name: 'Белый рис', amount: 150, unit: 'г', kcal: 195, protein: 4, fat: 0, carbs: 43 },
  ],
};

export function generateWeeklyMealPlan(
  trainingDays: number[], goal: 'bulk' | 'cut' | 'maintenance',
  targetKcal: number, targetProtein: number,
): DailyMealPlan[] {
  const days = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
  const plan: DailyMealPlan[] = [];

  for (let d = 0; d < 7; d++) {
    const isTraining = trainingDays.includes(d);
    const meals: DailyMealPlan['meals'] = [];

    // Breakfast
    const bf = goal === 'cut' ? FOOD_TEMPLATES.breakfast_cut : FOOD_TEMPLATES.breakfast_bulk;
    const bfKcal = bf.reduce((s, f) => s + f.kcal, 0);
    const bfProt = bf.reduce((s, f) => s + f.protein, 0);
    meals.push({ name: 'Завтрак', time: '08:00', foods: bf, totalKcal: bfKcal, totalProtein: bfProt });

    // Lunch
    const lunch = FOOD_TEMPLATES.lunch_standard;
    const lKcal = lunch.reduce((s, f) => s + f.kcal, 0);
    const lProt = lunch.reduce((s, f) => s + f.protein, 0);
    meals.push({ name: 'Обед', time: '14:00', foods: lunch, totalKcal: lKcal, totalProtein: lProt });

    // Post-workout (training days only)
    if (isTraining) {
      const pw = FOOD_TEMPLATES.post_workout;
      const pwKcal = pw.reduce((s, f) => s + f.kcal, 0);
      const pwProt = pw.reduce((s, f) => s + f.protein, 0);
      meals.push({ name: 'Пост-тренировка', time: '17:30', foods: pw, totalKcal: pwKcal, totalProtein: pwProt });
    }

    // Snack
    const snack = FOOD_TEMPLATES.snack_standard;
    const sKcal = snack.reduce((s, f) => s + f.kcal, 0);
    const sProt = snack.reduce((s, f) => s + f.protein, 0);
    meals.push({ name: 'Перекус', time: '17:00', foods: snack, totalKcal: sKcal, totalProtein: sProt });

    // Dinner
    const dinner = FOOD_TEMPLATES.dinner_standard;
    const dKcal = dinner.reduce((s, f) => s + f.kcal, 0);
    const dProt = dinner.reduce((s, f) => s + f.protein, 0);
    meals.push({ name: 'Ужин', time: '20:00', foods: dinner, totalKcal: dKcal, totalProtein: dProt });

    // Night snack (cut only — casein)
    if (goal === 'cut') {
      const night = [{ name: 'Казеин / Творог 0%', amount: 200, unit: 'г', kcal: 170, protein: 36, fat: 1.2, carbs: 6.6 }];
      meals.push({ name: 'Перед сном', time: '22:30', foods: night, totalKcal: 170, totalProtein: 36 });
    }

    const dailyKcal = meals.reduce((s, m) => s + m.totalKcal, 0);
    const dailyProt = meals.reduce((s, m) => s + m.totalProtein, 0);

    plan.push({
      day: days[d], dayName: days[d], isTrainingDay: isTraining,
      meals, dailyKcal, dailyProtein: dailyProt,
      dailyFat: Math.round(dailyKcal * 0.25 / 9),
      dailyCarbs: Math.round((dailyKcal - dailyProt * 4 - Math.round(dailyKcal * 0.25 / 9) * 9) / 4),
    });
  }

  return plan;
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Grocery List Generator
// ═══════════════════════════════════════════════════════════════════════════

export function generateGroceryList(plan: DailyMealPlan[]): GroceryCategory[] {
  const items = new Map<string, { quantity: number; unit: string }>();

  for (const day of plan) {
    for (const meal of day.meals) {
      for (const food of meal.foods) {
        const key = food.name;
        const existing = items.get(key);
        if (existing) existing.quantity += food.amount * 7;
        else items.set(key, { quantity: food.amount * 7, unit: food.unit });
      }
    }
  }

  const categories: Record<string, GroceryCategory> = {
    'Мясо / Рыба / Яйца': { name: 'Мясо / Рыба / Яйца', items: [] },
    'Молочные продукты': { name: 'Молочные продукты', items: [] },
    'Крупы / Хлеб': { name: 'Крупы / Хлеб', items: [] },
    'Овощи / Фрукты': { name: 'Овощи / Фрукты', items: [] },
    'Орехи / Масла': { name: 'Орехи / Масла', items: [] },
    'Спортпит': { name: 'Спортпит', items: [] },
  };

  const foodCategory: Record<string, string> = {
    'Куриная грудка': 'Мясо / Рыба / Яйца', 'Лосось / Говядина': 'Мясо / Рыба / Яйца',
    'Яйца цельные': 'Мясо / Рыба / Яйца', 'Яичные белки': 'Мясо / Рыба / Яйца',
    'Греческий йогурт': 'Молочные продукты', 'Казеин / Творог 0%': 'Молочные продукты',
    'Овсянка на молоке': 'Крупы / Хлеб', 'Овсянка на воде': 'Крупы / Хлеб',
    'Рис басмати': 'Крупы / Хлеб', 'Белый рис': 'Крупы / Хлеб',
    'Тост цельнозерновой': 'Крупы / Хлеб',
    'Картофель / Батат': 'Овощи / Фрукты', 'Брокколи': 'Овощи / Фрукты',
    'Овощной салат': 'Овощи / Фрукты', 'Ягоды замороженные': 'Овощи / Фрукты',
    'Банан': 'Овощи / Фрукты',
    'Миндаль': 'Орехи / Масла', 'Оливковое масло': 'Орехи / Масла',
    'Сывороточный протеин': 'Спортпит',
  };

  for (const [name, data] of items) {
    const cat = foodCategory[name] || 'Овощи / Фрукты';
    const costPerUnit: Record<string, number> = {
      'Куриная грудка': 400, 'Лосось / Говядина': 800, 'Яйца цельные': 120, 'Рис басмати': 150,
      'Овсянка на молоке': 100, 'Брокколи': 200, 'Банан': 100, 'Миндаль': 400,
      'Греческий йогурт': 200, 'Картофель / Батат': 100, 'Оливковое масло': 600,
    };
    categories[cat].items.push({
      name, quantity: Math.round(data.quantity), unit: data.unit,
      estimatedCost: Math.round((data.quantity / (data.unit === 'шт' ? 1 : data.unit === 'мл' ? 1000 : 1000)) * (costPerUnit[name] || 200)),
      notes: data.unit === 'шт' ? '' : `~${Math.round(data.quantity / 1000)} кг`,
    });
  }

  return Object.values(categories).filter(c => c.items.length > 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Meal Prep Calendar
// ═══════════════════════════════════════════════════════════════════════════

export function generateMealPrepSchedule(): MealPrepTask[] {
  return [
    { time: '12:00', task: 'Разогреть духовку до 200°C', durationMin: 1, category: 'cook' },
    { time: '12:02', task: 'Помыть и нарезать куриную грудку', durationMin: 10, category: 'chop' },
    { time: '12:12', task: 'Замариновать курицу (соль, перец, чеснок, паприка)', durationMin: 3, category: 'cook' },
    { time: '12:15', task: 'Поставить рис вариться (1 стакан риса : 2 стакана воды)', durationMin: 2, category: 'cook' },
    { time: '12:17', task: 'Помыть и нарезать брокколи/овощи', durationMin: 8, category: 'chop' },
    { time: '12:25', task: 'Курицу на противень, в духовку на 22-25 мин', durationMin: 2, category: 'cook' },
    { time: '12:27', task: 'Помыть и нарезать овощи для салата', durationMin: 8, category: 'chop' },
    { time: '12:35', task: 'Картофель/батат нарезать кубиками, на второй противень', durationMin: 5, category: 'chop' },
    { time: '12:40', task: 'Картофель в духовку (рядом с курицей)', durationMin: 1, category: 'cook' },
    { time: '12:41', task: 'Проверить рис — должен быть готов. Выключить.', durationMin: 1, category: 'cook' },
    { time: '12:45', task: 'Сварить яйца (10 мин после закипания)', durationMin: 2, category: 'cook' },
    { time: '12:50', task: 'Достать курицу из духовки, проверить готовность', durationMin: 1, category: 'cook' },
    { time: '13:00', task: 'Брокколи в пароварку/микроволновку на 3-4 мин', durationMin: 1, category: 'cook' },
    { time: '13:05', task: 'Разложить по контейнерам: курица+рис+брокколи (5 порций)', durationMin: 15, category: 'portion' },
    { time: '13:20', task: 'Разложить салат по контейнерам', durationMin: 5, category: 'portion' },
    { time: '13:25', task: 'Картофель достать, разложить', durationMin: 5, category: 'portion' },
    { time: '13:30', task: 'Яйца очистить, в контейнер', durationMin: 5, category: 'portion' },
    { time: '13:35', task: 'Помыть посуду, протереть столы', durationMin: 10, category: 'clean' },
    { time: '13:45', task: 'Убрать контейнеры в холодильник', durationMin: 3, category: 'store' },
    { time: '13:48', task: '🎉 Готово! 5 дней еды за 2 часа.', durationMin: 0, category: 'store' },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Food Swap Database
// ═══════════════════════════════════════════════════════════════════════════

const FOOD_SWAPS: FoodSwap[] = [
  { original: 'Свинина жирная', swap: 'Куриная грудка', reason: 'Меньше жира, больше белка на калорию', kcalSaved: 200, proteinGained: 12 },
  { original: 'Рис белый', swap: 'Рис бурый', reason: 'Больше клетчатки и микроэлементов', kcalSaved: 10, proteinGained: 1 },
  { original: 'Сок апельсиновый', swap: 'Апельсин целый', reason: 'Клетчатка, меньше сахара, больше сытости', kcalSaved: 80, proteinGained: 0 },
  { original: 'Майонез', swap: 'Греческий йогурт', reason: 'Белок вместо жира, меньше калорий', kcalSaved: 600, proteinGained: 10 },
  { original: 'Сметана 20%', swap: 'Творог 0% взбитый', reason: 'Белок, кальций, меньше жира', kcalSaved: 150, proteinGained: 15 },
  { original: 'Сахар в чай/кофе', swap: 'Стевия / Эритрит', reason: '0 калорий, не влияет на инсулин', kcalSaved: 40, proteinGained: 0 },
  { original: 'Масло сливочное (жарка)', swap: 'Спрей масло (1 сек)', reason: 'Минимум калорий, антипригарный эффект', kcalSaved: 100, proteinGained: 0 },
  { original: 'Хлеб белый', swap: 'Хлеб цельнозерновой', reason: 'Клетчатка, больше белка, ниже GI', kcalSaved: 0, proteinGained: 4 },
  { original: 'Паста обычная', swap: 'Паста из чечевицы/нута', reason: 'В 2-3 раза больше белка', kcalSaved: 0, proteinGained: 15 },
  { original: 'Рисовые хлебцы', swap: 'Овсянка', reason: 'Больше клетчатки, сытнее, медленнее углеводы', kcalSaved: 0, proteinGained: 5 },
  { original: 'Газировка', swap: 'Вода с газом + лимон', reason: '0 калорий, без сахара', kcalSaved: 140, proteinGained: 0 },
  { original: 'Молочный шоколад', swap: 'Тёмный шоколад 85%', reason: 'Меньше сахара, антиоксиданты, магний', kcalSaved: 0, proteinGained: 4 },
  { original: 'Картофель фри', swap: 'Картофель запечённый', reason: 'Без масла, меньше калорий', kcalSaved: 200, proteinGained: 0 },
  { original: 'Пиво', swap: 'Водка + содовая + лайм', reason: 'Меньше калорий, без углеводов', kcalSaved: 100, proteinGained: 0 },
  { original: 'Соус BBQ', swap: 'Горчица / Сальса', reason: 'Минимум сахара и калорий', kcalSaved: 60, proteinGained: 0 },
  { original: 'Гранола магазинная', swap: 'Овсянка + орехи + мёд', reason: 'Контроль ингредиентов, меньше сахара', kcalSaved: 100, proteinGained: 3 },
];

export function getFoodSwaps(): FoodSwap[] { return FOOD_SWAPS; }
export function getSwapsByOriginal(food: string): FoodSwap[] { return FOOD_SWAPS.filter(s => s.original.toLowerCase().includes(food.toLowerCase())); }

// ═══════════════════════════════════════════════════════════════════════════
// 5. Portion Guide (Visual)
// ═══════════════════════════════════════════════════════════════════════════

export const PORTION_GUIDE: { food: string; visual: string; amount: string; kcal: number; protein: number }[] = [
  { food: 'Куриная грудка', visual: 'Ладонь (без пальцев)', amount: '120-150 г', kcal: 200, protein: 35 },
  { food: 'Лосось', visual: 'Ладонь + пальцы', amount: '150-180 г', kcal: 310, protein: 30 },
  { food: 'Рис варёный', visual: 'Кулак', amount: '150-200 г', kcal: 250, protein: 5 },
  { food: 'Овсянка сухая', visual: 'Пол-кулака', amount: '40-50 г', kcal: 185, protein: 6 },
  { food: 'Орехи', visual: 'Горсть (пол-ладони)', amount: '30 г', kcal: 175, protein: 6 },
  { food: 'Авокадо', visual: 'Половина среднего', amount: '70-80 г', kcal: 112, protein: 1.4 },
  { food: 'Сыр', visual: 'Указательный + средний палец', amount: '30-40 г', kcal: 120, protein: 10 },
  { food: 'Оливковое масло', visual: 'Большой палец (от основания до кончика)', amount: '1 ст.л. (15 мл)', kcal: 135, protein: 0 },
  { food: 'Овощи', visual: 'Два кулака', amount: '200-300 г', kcal: 60, protein: 4 },
  { food: 'Ягоды', visual: 'Кулак', amount: '100-150 г', kcal: 60, protein: 1 },
  { food: 'Картофель', visual: 'Кулак', amount: '200-250 г', kcal: 170, protein: 4 },
  { food: 'Протеиновый порошок', visual: '1 scoop', amount: '30-40 г', kcal: 150, protein: 30 },
];

// ═══════════════════════════════════════════════════════════════════════════
// Export
// ═══════════════════════════════════════════════════════════════════════════

export function getPortionGuide() { return PORTION_GUIDE; }
