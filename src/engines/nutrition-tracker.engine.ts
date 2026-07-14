/**
 * Nutrition Tracker Engine — Food diary, macros, meal templates, water tracking.
 *
 * Features:
 *  - Quick food log (name, kcal, protein, fat, carbs)
 *  - Daily macro summary with visual bars
 *  - Weekly history
 *  - Meal templates (breakfast, lunch, dinner, snack, post-workout)
 *  - Water tracking with goal
 *  - Calorie surplus/deficit calculation
 *
 * Data stored in localStorage under 'he_nutrition_log'.
 *
 * @module nutrition-tracker-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface FoodEntry {
  id: string;
  date: string;          // YYYY-MM-DD
  time: string;          // HH:MM
  meal: 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'post_workout' | 'other';
  name: string;
  amount: number;        // grams
  kcal: number;
  protein: number;       // grams
  fat: number;           // grams
  carbs: number;         // grams
}

export interface WaterEntry {
  date: string;
  amountMl: number;      // ml
}

export interface DailyMacros {
  date: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  waterMl: number;
  entries: number;
  meals: Record<string, { kcal: number; protein: number; entries: number }>;
}

export interface MacroTargets {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  waterMl: number;
}

export interface NutritionStats {
  today: DailyMacros;
  yesterday: DailyMacros;
  weekAvg: { kcal: number; protein: number; fat: number; carbs: number };
  streak: number;       // consecutive days logged
  totalDays: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Meal Templates (quick-add)
// ═══════════════════════════════════════════════════════════════════════════

export interface MealTemplate {
  id: string;
  name: string;
  meal: FoodEntry['meal'];
  foods: { name: string; amount: number; kcal: number; protein: number; fat: number; carbs: number }[];
}

export const MEAL_TEMPLATES: MealTemplate[] = [
  {
    id: 'breakfast_gainer', name: 'Завтрак (набор)', meal: 'breakfast',
    foods: [
      { name: 'Овсянка', amount: 100, kcal: 370, protein: 12, fat: 7, carbs: 60 },
      { name: 'Яйца цельные', amount: 150, kcal: 230, protein: 19, fat: 16, carbs: 1 },
      { name: 'Банан', amount: 120, kcal: 110, protein: 1, fat: 0, carbs: 27 },
      { name: 'Молоко 2.5%', amount: 300, kcal: 160, protein: 9, fat: 7, carbs: 14 },
    ],
  },
  {
    id: 'lunch_standard', name: 'Обед (стандарт)', meal: 'lunch',
    foods: [
      { name: 'Куриная грудка', amount: 200, kcal: 330, protein: 62, fat: 7, carbs: 0 },
      { name: 'Рис басмати', amount: 150, kcal: 520, protein: 11, fat: 1, carbs: 115 },
      { name: 'Овощной салат', amount: 200, kcal: 60, protein: 3, fat: 1, carbs: 10 },
      { name: 'Оливковое масло', amount: 15, kcal: 135, protein: 0, fat: 15, carbs: 0 },
    ],
  },
  {
    id: 'post_workout', name: 'Пост-тренировочный', meal: 'post_workout',
    foods: [
      { name: 'Сывороточный протеин', amount: 40, kcal: 160, protein: 32, fat: 1, carbs: 4 },
      { name: 'Банан', amount: 150, kcal: 135, protein: 2, fat: 0, carbs: 34 },
      { name: 'Белый рис', amount: 150, kcal: 195, protein: 4, fat: 0, carbs: 43 },
    ],
  },
  {
    id: 'dinner_cut', name: 'Ужин (сушка)', meal: 'dinner',
    foods: [
      { name: 'Белая рыба', amount: 200, kcal: 180, protein: 40, fat: 2, carbs: 0 },
      { name: 'Брокколи', amount: 200, kcal: 70, protein: 6, fat: 1, carbs: 12 },
      { name: 'Авокадо', amount: 50, kcal: 80, protein: 1, fat: 8, carbs: 4 },
    ],
  },
  {
    id: 'snack_protein', name: 'Перекус (белковый)', meal: 'snack',
    foods: [
      { name: 'Творог 5%', amount: 200, kcal: 240, protein: 34, fat: 10, carbs: 6 },
      { name: 'Миндаль', amount: 30, kcal: 175, protein: 6, fat: 15, carbs: 6 },
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════════════════

const FOOD_KEY = 'he_food_log';
const WATER_KEY = 'he_water_log';

export function loadFoodLog(): FoodEntry[] {
  try { return JSON.parse(localStorage.getItem(FOOD_KEY) || '[]'); } catch { return []; }
}

function saveFoodLog(entries: FoodEntry[]) {
  entries.sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));
  try { localStorage.setItem(FOOD_KEY, JSON.stringify(entries.slice(-1000))); } catch {}
}

export function addFood(entry: Omit<FoodEntry, 'id'>): FoodEntry[] {
  if (!isFinite(entry.kcal) || entry.kcal < 0) entry.kcal = 0;
  if (!isFinite(entry.protein) || entry.protein < 0) entry.protein = 0;
  if (!isFinite(entry.fat) || entry.fat < 0) entry.fat = 0;
  if (!isFinite(entry.carbs) || entry.carbs < 0) entry.carbs = 0;
  if (!isFinite(entry.amount) || entry.amount < 0) entry.amount = 100;
  const entries = loadFoodLog();
  entries.push({ ...entry, id: 'food_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6) });
  saveFoodLog(entries);
  return entries;
}

export function addMealTemplate(templateId: string, date?: string): FoodEntry[] {
  const tmpl = MEAL_TEMPLATES.find(t => t.id === templateId);
  if (!tmpl) return loadFoodLog();

  const today = date || new Date().toISOString().slice(0, 10);
  const now = new Date().toTimeString().slice(0, 5);
  const entries = loadFoodLog();

  for (const food of tmpl.foods) {
    entries.push({
      id: 'food_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      date: today,
      time: now,
      meal: tmpl.meal,
      name: food.name,
      amount: food.amount,
      kcal: food.kcal,
      protein: food.protein,
      fat: food.fat,
      carbs: food.carbs,
    });
  }

  saveFoodLog(entries);
  return entries;
}

export function removeFood(id: string): FoodEntry[] {
  const entries = loadFoodLog().filter(e => e.id !== id);
  saveFoodLog(entries);
  return entries;
}

// Water
export function loadWaterLog(): WaterEntry[] {
  try { return JSON.parse(localStorage.getItem(WATER_KEY) || '[]'); } catch { return []; }
}

export function addWater(amountMl: number): WaterEntry[] {
  if (!isFinite(amountMl) || amountMl <= 0) return loadWaterLog();
  const today = new Date().toISOString().slice(0, 10);
  const entries = loadWaterLog();
  const existing = entries.find(e => e.date === today);
  if (existing) existing.amountMl += amountMl;
  else entries.push({ date: today, amountMl });
  try { localStorage.setItem(WATER_KEY, JSON.stringify(entries.slice(-90))); } catch {}
  return entries;
}

// ═══════════════════════════════════════════════════════════════════════════
// Analytics
// ═══════════════════════════════════════════════════════════════════════════

export function getDailyMacros(date: string): DailyMacros {
  const foods = loadFoodLog().filter(f => f.date === date);
  const water = loadWaterLog().find(w => w.date === date);
  const meals: Record<string, { kcal: number; protein: number; entries: number }> = {};

  for (const f of foods) {
    if (!meals[f.meal]) meals[f.meal] = { kcal: 0, protein: 0, entries: 0 };
    meals[f.meal].kcal += f.kcal;
    meals[f.meal].protein += f.protein;
    meals[f.meal].entries++;
  }

  return {
    date,
    kcal: foods.reduce((s, f) => s + f.kcal, 0),
    protein: foods.reduce((s, f) => s + f.protein, 0),
    fat: foods.reduce((s, f) => s + f.fat, 0),
    carbs: foods.reduce((s, f) => s + f.carbs, 0),
    waterMl: water?.amountMl || 0,
    entries: foods.length,
    meals,
  };
}

export function getNutritionStats(targets?: MacroTargets): NutritionStats | null {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const todayMacros = getDailyMacros(today);
  const yesterdayMacros = getDailyMacros(yesterday);

  if (todayMacros.entries === 0 && yesterdayMacros.entries === 0) return null;

  // Week average
  const weekFoods = loadFoodLog().filter(f => {
    const d = new Date(f.date);
    const weekAgo = new Date(Date.now() - 7 * 86400000);
    return d >= weekAgo;
  });
  const daysWithFood = new Set(weekFoods.map(f => f.date)).size || 1;
  const weekAvg = {
    kcal: Math.round(weekFoods.reduce((s, f) => s + f.kcal, 0) / daysWithFood),
    protein: Math.round(weekFoods.reduce((s, f) => s + f.protein, 0) / daysWithFood),
    fat: Math.round(weekFoods.reduce((s, f) => s + f.fat, 0) / daysWithFood),
    carbs: Math.round(weekFoods.reduce((s, f) => s + f.carbs, 0) / daysWithFood),
  };

  // Streak
  let streak = 0;
  const allFood = loadFoodLog();
  const dates = [...new Set(allFood.map(f => f.date))].sort().reverse();
  const todayDate = new Date(today);
  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(todayDate);
    expected.setDate(expected.getDate() - i);
    if (dates[i] === expected.toISOString().slice(0, 10)) streak++;
    else break;
  }

  return {
    today: todayMacros,
    yesterday: yesterdayMacros,
    weekAvg,
    streak,
    totalDays: [...new Set(allFood.map(f => f.date))].length,
  };
}

export function getWeeklyHistory(): { date: string; kcal: number; protein: number; fat: number; carbs: number }[] {
  const foods = loadFoodLog();
  const weekMap = new Map<string, { kcal: number; protein: number; fat: number; carbs: number }>();

  for (const f of foods) {
    const d = f.date;
    if (!weekMap.has(d)) weekMap.set(d, { kcal: 0, protein: 0, fat: 0, carbs: 0 });
    const w = weekMap.get(d)!;
    w.kcal += f.kcal;
    w.protein += f.protein;
    w.fat += f.fat;
    w.carbs += f.carbs;
  }

  return [...weekMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, m]) => ({ date, ...m }));
}

// ═══════════════════════════════════════════════════════════════════════════
// Adherence calculator (used by health-score.engine.ts)
// ═══════════════════════════════════════════════════════════════════════════

export interface AdherenceTarget {
  kcal: number;
  protein: number;
  fats?: number;
  carbs?: number;
  [key: string]: any;
}

export function calcAdherence(
  actual: { kcal: number; protein?: number; p?: number; fat?: number; f?: number; carbs?: number; c?: number },
  target: AdherenceTarget,
): { score: number; deviation: { kcal: number; protein: number } } {
  const actualKcal = actual.kcal || 0;
  const actualProtein = actual.protein || actual.p || 0;
  const targetProtein = target.protein || 0;

  const kcalDev = target.kcal > 0 ? Math.abs(actualKcal - target.kcal) / target.kcal : 0;
  const protDev = targetProtein > 0 ? Math.abs(actualProtein - targetProtein) / targetProtein : 0;

  const score = Math.round(Math.max(0, 100 - kcalDev * 50 - protDev * 30));
  return { score, deviation: { kcal: Math.round(kcalDev * 100), protein: Math.round(protDev * 100) } };
}
