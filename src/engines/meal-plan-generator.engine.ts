/**
 * Meal Plan Generator — Weekly nutrition plans from macro targets.
 *
 * ⚠️ DEPRECATED (A6, эпик «Профессиональный планировщик», Aug 29 2026): ЭТОТ ДВИЖОК МЁРТВЫЙ.
 * Реальная генерация идёт через `src/ui/screens/NutritionScreen_parts/IndividualPlan/meal-plan-engine.ts`
 * → `buildDayPlan()` (V2-движок, 3800+ строк: квоты, диетология, посадка ±3%).
 * Здесь: 30 захардкоженных продуктов + Math.random() без сидирования — ловушка для
 * будущих вызовов. Живой импорт остался только как тип MealPlanInput в bb-contest-prep.
 * НЕ ИСПОЛЬЗОВАТЬ для генерации. Удаление — после отвязки типа в bb-contest-prep.
 *
 * @module meal-plan-generator
 * @deprecated Используйте IndividualPlan/meal-plan-engine.buildDayPlan
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface MealItem {
  name: string;
  amount: number;    // grams
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  category: 'protein' | 'carb' | 'fat' | 'vegetable' | 'fruit' | 'dairy' | 'supplement';
}

export interface MealSlot {
  name: string;
  time: string;
  items: MealItem[];
  totals: { kcal: number; protein: number; fat: number; carbs: number };
}

export interface DailyMealPlan {
  day: number;
  meals: MealSlot[];
  totals: { kcal: number; protein: number; fat: number; carbs: number };
  targetDeviation: { kcal: number; protein: number; fat: number; carbs: number };
}

export interface MealPlanInput {
  targetKcal: number;
  targetProtein: number;
  targetFat: number;
  targetCarbs: number;
  days: number;
  preferences: {
    excludePork?: boolean;
    excludeFish?: boolean;
    excludeDairy?: boolean;
    highCarb?: boolean;
    keto?: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Food Database (per 100g)
// ═══════════════════════════════════════════════════════════════════════════

interface FoodItem {
  name: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  category: MealItem['category'];
  portion: number; // typical portion in grams
}

const FOOD_DB: FoodItem[] = [
  // ── Proteins ──
  { name: 'Куриная грудка', kcal: 165, protein: 31, fat: 3.6, carbs: 0, category: 'protein', portion: 200 },
  { name: 'Куриное бедро', kcal: 185, protein: 24, fat: 10, carbs: 0, category: 'protein', portion: 200 },
  { name: 'Индейка филе', kcal: 135, protein: 30, fat: 1.5, carbs: 0, category: 'protein', portion: 200 },
  { name: 'Говядина (стейк)', kcal: 250, protein: 26, fat: 16, carbs: 0, category: 'protein', portion: 200 },
  { name: 'Говяжий фарш 5%', kcal: 137, protein: 21, fat: 5, carbs: 0, category: 'protein', portion: 200 },
  { name: 'Свиная вырезка', kcal: 155, protein: 22, fat: 7, carbs: 0, category: 'protein', portion: 150 },
  { name: 'Лосось', kcal: 208, protein: 20, fat: 13, carbs: 0, category: 'protein', portion: 200 },
  { name: 'Тунец (консерв.)', kcal: 116, protein: 26, fat: 1, carbs: 0, category: 'protein', portion: 150 },
  { name: 'Белая рыба (треска)', kcal: 82, protein: 18, fat: 1, carbs: 0, category: 'protein', portion: 200 },
  { name: 'Яйца цельные', kcal: 155, protein: 13, fat: 11, carbs: 1.1, category: 'protein', portion: 150 },
  { name: 'Яичные белки', kcal: 52, protein: 11, fat: 0.2, carbs: 0.7, category: 'protein', portion: 200 },
  { name: 'Творог 5%', kcal: 121, protein: 17, fat: 5, carbs: 3, category: 'protein', portion: 200 },
  { name: 'Творог 0%', kcal: 85, protein: 18, fat: 0.6, carbs: 3.3, category: 'protein', portion: 200 },
  { name: 'Греческий йогурт', kcal: 97, protein: 10, fat: 5, carbs: 4, category: 'protein', portion: 200 },
  { name: 'Сыр (чеддер)', kcal: 402, protein: 25, fat: 33, carbs: 1.3, category: 'protein', portion: 50 },

  // ── Carbs ──
  { name: 'Рис басмати', kcal: 350, protein: 7, fat: 0.5, carbs: 78, category: 'carb', portion: 150 },
  { name: 'Рис жасмин', kcal: 348, protein: 7, fat: 0.3, carbs: 79, category: 'carb', portion: 150 },
  { name: 'Бурый рис', kcal: 342, protein: 8, fat: 2, carbs: 72, category: 'carb', portion: 150 },
  { name: 'Гречка', kcal: 343, protein: 13, fat: 3.4, carbs: 70, category: 'carb', portion: 150 },
  { name: 'Овсянка', kcal: 370, protein: 12, fat: 7, carbs: 60, category: 'carb', portion: 80 },
  { name: 'Макароны', kcal: 350, protein: 12, fat: 1.5, carbs: 72, category: 'carb', portion: 150 },
  { name: 'Картофель', kcal: 77, protein: 2, fat: 0.1, carbs: 17, category: 'carb', portion: 250 },
  { name: 'Батат', kcal: 86, protein: 1.6, fat: 0.1, carbs: 20, category: 'carb', portion: 250 },
  { name: 'Белый хлеб', kcal: 265, protein: 9, fat: 3.2, carbs: 49, category: 'carb', portion: 60 },
  { name: 'Цельнозерновой хлеб', kcal: 247, protein: 13, fat: 3.4, carbs: 41, category: 'carb', portion: 60 },
  { name: 'Бананы', kcal: 89, protein: 1.1, fat: 0.3, carbs: 23, category: 'fruit', portion: 150 },
  { name: 'Яблоки', kcal: 52, protein: 0.3, fat: 0.2, carbs: 14, category: 'fruit', portion: 150 },

  // ── Fats ──
  { name: 'Оливковое масло', kcal: 884, protein: 0, fat: 100, carbs: 0, category: 'fat', portion: 15 },
  { name: 'Авокадо', kcal: 160, protein: 2, fat: 15, carbs: 9, category: 'fat', portion: 100 },
  { name: 'Миндаль', kcal: 579, protein: 21, fat: 50, carbs: 22, category: 'fat', portion: 30 },
  { name: 'Грецкий орех', kcal: 654, protein: 15, fat: 65, carbs: 14, category: 'fat', portion: 30 },
  { name: 'Арахисовая паста', kcal: 588, protein: 25, fat: 50, carbs: 20, category: 'fat', portion: 30 },
  { name: 'Сливочное масло', kcal: 717, protein: 0.9, fat: 81, carbs: 0.1, category: 'fat', portion: 15 },

  // ── Vegetables ──
  { name: 'Брокколи', kcal: 34, protein: 2.8, fat: 0.4, carbs: 7, category: 'vegetable', portion: 200 },
  { name: 'Шпинат', kcal: 23, protein: 2.9, fat: 0.4, carbs: 3.6, category: 'vegetable', portion: 200 },
  { name: 'Огурцы', kcal: 15, protein: 0.7, fat: 0.1, carbs: 3, category: 'vegetable', portion: 200 },
  { name: 'Помидоры', kcal: 18, protein: 0.9, fat: 0.2, carbs: 3.9, category: 'vegetable', portion: 200 },
  { name: 'Сладкий перец', kcal: 31, protein: 1, fat: 0.3, carbs: 6, category: 'vegetable', portion: 150 },
  { name: 'Морковь', kcal: 41, protein: 0.9, fat: 0.2, carbs: 10, category: 'vegetable', portion: 150 },
  { name: 'Овощная смесь', kcal: 35, protein: 2, fat: 0.3, carbs: 6, category: 'vegetable', portion: 200 },

  // ── Supplements ──
  { name: 'Сывороточный протеин', kcal: 400, protein: 80, fat: 5, carbs: 8, category: 'supplement', portion: 30 },
  { name: 'Казеин', kcal: 360, protein: 80, fat: 2, carbs: 8, category: 'supplement', portion: 30 },
  { name: 'Гейнер', kcal: 380, protein: 25, fat: 3, carbs: 65, category: 'supplement', portion: 100 },
  { name: 'BCAA', kcal: 400, protein: 100, fat: 0, carbs: 0, category: 'supplement', portion: 10 },
];

// ═══════════════════════════════════════════════════════════════════════════
// Meal slot templates
// ═══════════════════════════════════════════════════════════════════════════

const MEAL_SLOTS: { name: string; time: string; categories: string[] }[] = [
  { name: 'Завтрак', time: '08:00', categories: ['protein', 'carb', 'fruit', 'dairy'] },
  { name: 'Второй завтрак', time: '11:00', categories: ['protein', 'fruit', 'dairy'] },
  { name: 'Обед', time: '14:00', categories: ['protein', 'carb', 'vegetable', 'fat'] },
  { name: 'Полдник', time: '16:30', categories: ['protein', 'carb', 'fruit'] },
  { name: 'Ужин', time: '19:00', categories: ['protein', 'carb', 'vegetable', 'fat'] },
  { name: 'Перед сном', time: '22:00', categories: ['protein', 'dairy', 'supplement'] },
];

// ═══════════════════════════════════════════════════════════════════════════
// Generator
// ═══════════════════════════════════════════════════════════════════════════

function pickFood(category: string, exclude: string[] = []): FoodItem {
  const candidates = FOOD_DB.filter(f => f.category === category && !exclude.includes(f.name));
  if (candidates.length === 0) return FOOD_DB.filter(f => f.category === category)[0];
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function calcPortion(food: FoodItem, targetKcal: number, totalMealKcal: number): number {
  const ratio = targetKcal / Math.max(1, totalMealKcal);
  return Math.round(food.portion * Math.min(1.5, Math.max(0.5, ratio)));
}

export function generateMealPlan(input: MealPlanInput): DailyMealPlan[] {
  const plans: DailyMealPlan[] = [];
  const excludeList: string[] = [];
  if (input.preferences.excludePork) excludeList.push('Свиная вырезка');
  if (input.preferences.excludeFish) excludeList.push('Лосось', 'Тунец (консерв.)', 'Белая рыба (треска)');
  if (input.preferences.excludeDairy) excludeList.push('Творог 5%', 'Творог 0%', 'Греческий йогурт', 'Сыр (чеддер)');

  for (let day = 0; day < input.days; day++) {
    const meals: MealSlot[] = [];
    const dailyKcal = input.targetKcal + (Math.random() - 0.5) * 100;
    const kcalPerMeal = dailyKcal / 6;

    for (const slot of MEAL_SLOTS) {
      const items: MealItem[] = [];

      // Main protein
      const protein = pickFood('protein', excludeList);
      items.push({ ...protein, amount: calcPortion(protein, kcalPerMeal * 0.5, protein.kcal) });

      // Carb (if in slot categories)
      if (slot.categories.includes('carb') && !input.preferences.keto) {
        const carb = pickFood('carb', excludeList);
        items.push({ ...carb, amount: calcPortion(carb, kcalPerMeal * 0.35, carb.kcal) });
      }

      // Fat
      if (slot.categories.includes('fat')) {
        const fat = pickFood('fat', excludeList);
        items.push({ ...fat, amount: fat.portion });
      }

      // Veggie
      if (slot.categories.includes('vegetable')) {
        const veg = pickFood('vegetable');
        items.push({ ...veg, amount: veg.portion });
      }

      // Fruit
      if (slot.categories.includes('fruit')) {
        const fruit = pickFood('fruit');
        items.push({ ...fruit, amount: fruit.portion });
      }

      // Supplement (post-workout or bedtime)
      if (slot.categories.includes('supplement') && (slot.name === 'Перед сном' || slot.name === 'Второй завтрак')) {
        const sup = slot.name === 'Перед сном' ? FOOD_DB.find(f => f.name === 'Казеин')! : FOOD_DB.find(f => f.name === 'Сывороточный протеин')!;
        items.push({ ...sup, amount: 30 });
      }

      const totals = items.reduce((s, i) => ({
        kcal: s.kcal + Math.round(i.kcal * i.amount / 100),
        protein: s.protein + Math.round(i.protein * i.amount / 100),
        fat: s.fat + Math.round(i.fat * i.amount / 100),
        carbs: s.carbs + Math.round(i.carbs * i.amount / 100),
      }), { kcal: 0, protein: 0, fat: 0, carbs: 0 });

      meals.push({ name: slot.name, time: slot.time, items, totals });
    }

    const dayTotals = meals.reduce((s, m) => ({
      kcal: s.kcal + m.totals.kcal,
      protein: s.protein + m.totals.protein,
      fat: s.fat + m.totals.fat,
      carbs: s.carbs + m.totals.carbs,
    }), { kcal: 0, protein: 0, fat: 0, carbs: 0 });

    plans.push({
      day: day + 1,
      meals,
      totals: dayTotals,
      targetDeviation: {
        kcal: dayTotals.kcal - input.targetKcal,
        protein: dayTotals.protein - input.targetProtein,
        fat: dayTotals.fat - input.targetFat,
        carbs: dayTotals.carbs - input.targetCarbs,
      },
    });
  }

  return plans;
}
