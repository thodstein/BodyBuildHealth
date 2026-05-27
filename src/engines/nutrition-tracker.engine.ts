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