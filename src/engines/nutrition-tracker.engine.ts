import { NutritionTargets, FoodItem } from '../core/types';
import { NUTRITION_MACRO_RANGES, MICRONUTRIENT_TARGETS } from '../core/constants';
import { FoodItem as DBFood } from '../core/nutrition-database';

export interface MealLog {
  id: string; date: string; time: string;
  items: Array<{ id: string; name: string; qty: number; kcal: number; p: number; f: number; c: number; fiber: number }>;
  total: { kcal: number; p: number; f: number; c: number; fiber: number; water: number; steps: number };
}

export function calcNutritionTargets(weightKg: number, heightCm: number, age: number, sex: 'male'|'female', pal: number, goal: string, bfPct?: number): NutritionTargets {
  const bmrKatch = bfPct ? 370 + 21.6 * (weightKg * (100 - bfPct) / 100) : 0;
  const bmrMifflin = sex === 'male' ? 10*weightKg + 6.25*heightCm - 5*age + 5 : 10*weightKg + 6.25*heightCm - 5*age - 161;
  const bmr = bfPct ? Math.max(bmrMifflin, bmrKatch) : bmrMifflin;
  const tdee = bmr * pal;
  let kcal = tdee;
  if (goal === 'bulk') kcal += Math.min(500, tdee * 0.15);
  else if (goal === 'cut') kcal = Math.max(bmr, tdee * 0.8);
  else if (goal === 'recomp') kcal += 100;

  const range = NUTRITION_MACRO_RANGES[goal] || NUTRITION_MACRO_RANGES.maintenance;
  const [pMin, pMax] = range.protein;
  const protein = Math.round(((pMin+pMax)/2) * weightKg);
  const [fMin, fMax] = range.fats;
  const fats = Math.max(0.8*weightKg, Math.round(((fMin+fMax)/2) * weightKg));
  const carbs = Math.max(150, Math.round((kcal - protein*4 - fats*9)/4));
  
  const micros: Record<string, number> = {};
  Object.entries(MICRONUTRIENT_TARGETS).forEach(([k, v]) => {
    micros[k] = goal === 'cut' ? Math.round(v.amount * 1.15) : v.amount;
  });
  return { bmr: Math.round(bmr), tdee: Math.round(tdee), kcal: Math.round(kcal), protein, fats, carbs, water: Math.round((0.033*weightKg+0.5)*10)/10, fiber: sex==='male'?35:25, micros };
}

export function calcAdherence(log: MealLog['total'], target: NutritionTargets): { kcal: number; pro: number; water: number; score: number } {
  const kcalD = Math.abs(log.kcal - target.kcal) / target.kcal;
  const proD = Math.abs(log.p - target.protein) / target.protein;
  const waterD = Math.abs(log.water - target.water) / target.water;
  return {
    kcal: Math.max(0, Math.min(100, Math.round((1-kcalD)*100))),
    pro: Math.max(0, Math.min(100, Math.round((1-proD)*100))),
    water: Math.max(0, Math.min(100, Math.round((1-waterD)*100))),
    score: Math.round(((1-kcalD)*0.4 + (1-proD)*0.35 + (1-waterD)*0.25)*100)
  };
}

export function getWeeklyAnalytics(logs: MealLog[], today: string): { daysLogged: number; avgKcal: number; trend: 'up'|'down'|'stable'; adherenceAvg: number } {
  const week = logs.filter(l => {
    const d = new Date(l.date);
    const now = new Date(today);
    return (now.getTime() - d.getTime()) <= 7*24*60*60*1000;
  });
  const avgKcal = week.length ? Math.round(week.reduce((s,l)=>s+l.total.kcal,0)/week.length) : 0;
  const trend = week.length < 3 ? 'stable' : avgKcal > week[0].total.kcal*1.05 ? 'up' : avgKcal < week[0].total.kcal*0.95 ? 'down' : 'stable';
  return { daysLogged: week.length, avgKcal, trend, adherenceAvg: week.length ? Math.round(week.reduce((s,l)=>s+calcAdherence(l.total, {kcal:2200,protein:160,fats:70,carbs:250,water:3,fiber:35,bmr:1600,tdee:2200,micros:{}}).score,0)/week.length) : 0 };
}

export function getPharmaInteractions(drugs: string[]): string {
  if (!drugs.length) return '✅ Нет активных препаратов.';
  const map: Record<string, string> = {
    'клeнбутерол': 'Снижает K/Mg/Таурин. Добавьте курагу, гречку, магний 400мг.',
    'телмисартан': 'Повышает K. Ограничьте калий до 3г/день.',
    'метформин': 'Снижает B12/фолат. Добавьте метилкобаламин 1000мкг.',
    'статины': 'Снижают CoQ10, повышают ALT. Добавьте 200мг CoQ10.',
    'анастрозол': 'Риск болей в суставах. Добавьте Омега-3 + Хондроитин.'
  };
  let txt = '';
  drugs.forEach(d => {
    const key = Object.keys(map).find(k => d.toLowerCase().includes(k));
    if (key) txt += `• ${key}: ${map[key]}\n`;
  });
  return txt || '⚠️ Взаимодействий не найдено.';
}

export interface FoodDBItem {
  id: string; name: string; kcal: number; p: number; f: number; c: number; fiber?: number; water?: number;
}

export const FOOD_DB: FoodDBItem[] = [
  { id: 'chicken_breast', name: 'куриная грудка', kcal: 165, p: 31, f: 3.6, c: 0, fiber: 0, water: 65 },
  { id: 'beef', name: 'говядина', kcal: 250, p: 26, f: 15, c: 0, fiber: 0, water: 59 },
  { id: 'salmon', name: 'лосось', kcal: 208, p: 20, f: 13, c: 0, fiber: 0, water: 64 },
  { id: 'eggs', name: 'яйца', kcal: 155, p: 13, f: 11, c: 1.1, fiber: 0, water: 75 },
  { id: 'cottage_cheese', name: 'творог', kcal: 121, p: 18, f: 5, c: 3.3, fiber: 0, water: 72 },
  { id: 'milk', name: 'молоко', kcal: 42, p: 3.4, f: 1, c: 5, fiber: 0, water: 88 },
  { id: 'kefir', name: 'кефир', kcal: 40, p: 3, f: 1, c: 4, fiber: 0, water: 90 },
  { id: 'buckwheat', name: 'гречка', kcal: 343, p: 13, f: 3.4, c: 72, fiber: 10, water: 10 },
  { id: 'rice', name: 'рис', kcal: 345, p: 7, f: 0.6, c: 79, fiber: 1.3, water: 10 },
  { id: 'oatmeal', name: 'овсянка', kcal: 389, p: 17, f: 7, c: 66, fiber: 11, water: 8 },
  { id: 'pasta', name: 'макароны', kcal: 350, p: 12, f: 1.5, c: 75, fiber: 3, water: 10 },
  { id: 'potato', name: 'картофель', kcal: 77, p: 2, f: 0.1, c: 17, fiber: 2.2, water: 79 },
  { id: 'whole_grain_bread', name: 'хлеб цельнозерновой', kcal: 247, p: 13, f: 3.4, c: 41, fiber: 7, water: 35 },
  { id: 'banana', name: 'банан', kcal: 96, p: 1.3, f: 0.4, c: 23, fiber: 2.6, water: 75 },
  { id: 'apple', name: 'яблоко', kcal: 52, p: 0.3, f: 0.2, c: 14, fiber: 2.4, water: 86 },
  { id: 'vegetable_salad', name: 'овощной салат', kcal: 35, p: 1.5, f: 1, c: 4, fiber: 2, water: 150 },
  { id: 'walnuts', name: 'орехи грецкие', kcal: 654, p: 15, f: 65, c: 14, fiber: 6.7, water: 4 },
  { id: 'cheese', name: 'сыр', kcal: 350, p: 25, f: 27, c: 0.5, fiber: 0, water: 40 },
  { id: 'whey_protein', name: 'протеин сывороточный', kcal: 400, p: 80, f: 5, c: 10, fiber: 0, water: 3 },
  { id: 'peanut_butter', name: 'арахисовая паста', kcal: 588, p: 25, f: 50, c: 20, fiber: 6, water: 1 },
  { id: 'avocado', name: 'авокадо', kcal: 160, p: 2, f: 15, c: 9, fiber: 7, water: 73 },
  { id: 'broccoli', name: 'брокколи', kcal: 34, p: 2.8, f: 0.4, c: 7, fiber: 2.6, water: 89 },
  { id: 'spinach', name: 'шпинат', kcal: 23, p: 2.9, f: 0.4, c: 3.6, fiber: 2.2, water: 91 },
  { id: 'tomato', name: 'томаты', kcal: 18, p: 0.9, f: 0.2, c: 3.9, fiber: 1.2, water: 95 },
  { id: 'cucumber', name: 'огурцы', kcal: 15, p: 0.7, f: 0.1, c: 3.6, fiber: 0.5, water: 96 },
  { id: 'onion', name: 'лук', kcal: 40, p: 1.1, f: 0.1, c: 9, fiber: 1.7, water: 89 },
  { id: 'carrot', name: 'морковь', kcal: 41, p: 0.9, f: 0.2, c: 10, fiber: 2.8, water: 88 },
  { id: 'beetroot', name: 'свекла', kcal: 43, p: 1.7, f: 0.2, c: 10, fiber: 2.8, water: 88 },
  { id: 'olive_oil', name: 'масло оливковое', kcal: 884, p: 0, f: 100, c: 0, fiber: 0, water: 0 },
  { id: 'honey', name: 'мед', kcal: 304, p: 0.3, f: 0, c: 82, fiber: 0.2, water: 17 },
];

export function searchFood(query: string): FoodDBItem[] {
  const q = query.toLowerCase();
  return FOOD_DB.filter(f => f.name.toLowerCase().includes(q) || f.id.toLowerCase().includes(q));
}

export function getFoodById(id: string): FoodDBItem | undefined {
  return FOOD_DB.find(f => f.id === id);
}

export interface MealDiary {
  date: string;
  meals: {
    type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
    items: { foodId: string; name: string; weight: number; kcal: number; p: number; f: number; c: number }[];
  }[];
}

function loadAllDiaries(): MealDiary[] {
  try {
    const raw = localStorage.getItem('nutrition_diary');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAllDiaries(diaries: MealDiary[]): void {
  localStorage.setItem('nutrition_diary', JSON.stringify(diaries));
}

export function getDiary(date: string): MealDiary {
  const diaries = loadAllDiaries();
  return diaries.find(d => d.date === date) || { date, meals: [] };
}

export function getDiaryRange(startDate: string, endDate: string): MealDiary[] {
  const diaries = loadAllDiaries();
  const start = new Date(startDate).getTime();
  const end = new Date(endDate).getTime();
  return diaries.filter(d => {
    const t = new Date(d.date).getTime();
    return t >= start && t <= end;
  });
}

export function addMealEntry(date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', foodId: string, weight: number): MealDiary {
  const diaries = loadAllDiaries();
  let diary = diaries.find(d => d.date === date);
  if (!diary) {
    diary = { date, meals: [] };
    diaries.push(diary);
  }
  let meal = diary.meals.find(m => m.type === mealType);
  if (!meal) {
    meal = { type: mealType, items: [] };
    diary.meals.push(meal);
  }
  const food = getFoodById(foodId);
  if (!food) return diary;
  const scale = weight / 100;
  meal.items.push({
    foodId,
    name: food.name,
    weight,
    kcal: Math.round(food.kcal * scale),
    p: Math.round(food.p * scale * 10) / 10,
    f: Math.round(food.f * scale * 10) / 10,
    c: Math.round(food.c * scale * 10) / 10,
  });
  saveAllDiaries(diaries);
  return diary;
}

export function removeMealEntry(date: string, mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack', foodId: string): MealDiary {
  const diaries = loadAllDiaries();
  const diary = diaries.find(d => d.date === date);
  if (!diary) return { date, meals: [] };
  const meal = diary.meals.find(m => m.type === mealType);
  if (!meal) return diary;
  const idx = meal.items.findIndex(i => i.foodId === foodId);
  if (idx !== -1) meal.items.splice(idx, 1);
  saveAllDiaries(diaries);
  return diary;
}

export function getDailyTotals(date: string): { kcal: number; p: number; f: number; c: number; fiber: number; water: number } {
  const diary = getDiary(date);
  let kcal = 0, p = 0, f = 0, c = 0, fiber = 0, water = 0;
  for (const meal of diary.meals) {
    for (const item of meal.items) {
      kcal += item.kcal;
      p += item.p;
      f += item.f;
      c += item.c;
      const food = getFoodById(item.foodId);
      if (food) {
        const scale = item.weight / 100;
        fiber += (food.fiber || 0) * scale;
        water += (food.water || 0) * scale;
      }
    }
  }
  return { kcal: Math.round(kcal), p: Math.round(p * 10) / 10, f: Math.round(f * 10) / 10, c: Math.round(c * 10) / 10, fiber: Math.round(fiber * 10) / 10, water: Math.round(water * 10) / 10 };
}

export function saveDiary(diary: MealDiary): void {
  const diaries = loadAllDiaries();
  const idx = diaries.findIndex(d => d.date === diary.date);
  if (idx !== -1) diaries[idx] = diary;
  else diaries.push(diary);
  saveAllDiaries(diaries);
}