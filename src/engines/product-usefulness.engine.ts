import { FOOD_DB } from '../core/nutrition-database';
import type { FoodItem } from '../core/nutrition-database';

export interface UsefulnessOptions {
  goal?: string;
  weightKg?: number;
  workoutsPerWeek?: number;
  hasAAS?: boolean;
  hasInsulin?: boolean;
  pricePerKg?: number;
  enableA: boolean;
  enableB: boolean;
  enableC: boolean;
  /** override current hour for timing (0-23) */
  hourOverride?: number;
}

export interface UsefulnessScore {
  total: number;
  maxPossible: number;
  breakdown: {
    proteinDensity: number;
    microDensity: number;
    fiberQuality: number;
    tierScore: number;
    aminoScore: number;
  };
  contextBonus: {
    goalMatch: number;
    timingMatch: number;
    pharmaMatch: number;
  };
  costEfficiency: {
    proteinCostRub: number;
    leucineCostRub: number;
    efficiencyScore: number;
  } | null;
  label: string;
  color: string;
}

const MEALS_PER_DAY = 4.5;
const DAILY_RDA: Record<string, number> = {
  Ca: 1000, Fe: 14, Mg: 420, P: 700, K: 3500, Zn: 11, Se: 55, Cu: 0.9, Mn: 2.3,
  VitA: 900, VitB1: 1.2, VitB2: 1.3, VitB3: 16, VitB5: 5, VitB6: 1.7, VitB9: 400, VitB12: 2.4,
  VitC: 90, VitD: 15, VitE: 15, VitK: 120, Omega3: 1600,
};
const MICRO_RDA: Record<string, number> = Object.fromEntries(
  Object.entries(DAILY_RDA).map(([k, v]) => [k, Math.round((v / MEALS_PER_DAY) * 100) / 100])
);

const ESTIMATED_PRICES: Record<string, number> = {
  chicken_breast: 350, turkey_breast: 400, beef_lean: 500, beef_medium: 450, beef_fat: 350, pork_tenderloin: 350,
  pork_loin: 350, lamb: 600, veal: 700, rabbit: 550, duck: 500, goose: 550,
  salmon: 900, tuna_canned: 400, tuna: 600, cod: 500, pollock: 250, mackerel: 350, herring: 280, sardines: 300,
  salmon_canned: 500, shrimp: 700, squid: 400, mussels: 350, trout: 650, pangasius: 250, perch: 400, carp: 300,
  eggs: 150, egg_whole: 150, egg_white: 200, quail_eggs: 400,
  cottage_cheese: 300, greek_yogurt: 350, kefir: 80, milk: 70, milk_skim: 65, cheese: 600, mozzarella: 500,
  parmesan: 1200, ricotta: 400, sour_cream: 250, yogurt: 150, butter: 400,
  whey: 1200, casein: 1300, whey_isolate: 1500, soy_isolate: 900, pea_protein: 1000, collagen: 2000,
  rice_white: 100, rice_brown: 120, pasta: 90, buckwheat: 110, oats: 80, oatmeal: 70, potatoes: 50,
  sweet_potato: 100, bread_whole: 100, bread_white: 80, bread_rye: 90, couscous: 120, quinoa: 250, bulgur: 110,
  lentils: 130, chickpeas: 150, beans: 120, peas: 100, soybeans: 200, tofu: 250, tempeh: 300,
  olive_oil: 600, avocado_oil: 700, butter_ghee: 500, coconut_oil: 350, sunflower_oil: 120, flax_oil: 400,
  broccoli: 200, spinach: 250, tomato: 150, cucumber: 100, avocado: 400, carrot: 100, onion: 60, garlic: 200,
  bell_pepper: 250, zucchini: 120, eggplant: 150, cabbage: 80, cauliflower: 150, pumpkin: 100,
  apple: 120, banana: 100, orange: 130, berries: 600, grapes: 200, watermelon: 50, pineapple: 250, mango: 300,
  walnuts: 800, almonds: 700, peanuts: 400, hazelnuts: 900, cashews: 650,
  honey: 400, sugar: 80, jam: 200,
  chocolate_dark: 800, chocolate_milk: 300,
};

function countMicrosPresent(food: FoodItem): number {
  if (!food.micros) return 0;
  return Object.entries(MICRO_RDA).filter(([key, rda]) => {
    const val = food.micros?.[key];
    return val != null && val > 0 && val >= rda * 0.05;
  }).length;
}

function getEffectiveGoal(profileGoal?: string): string {
  const map: Record<string, string> = {
    mass: 'bulk', strength: 'strength', cut: 'cut', cutting: 'cut',
    fat_loss: 'cut', maintenance: 'maintenance', recomposition: 'recomp',
    recomp: 'recomp', rehab: 'rehab', health: 'health', fitness: 'fitness',
  };
  return map[profileGoal || ''] || 'maintenance';
}

const GOAL_MAP_RU: Record<string, string> = {
  bulk: 'Набор массы', cut: 'Сушка', maintenance: 'Поддержание',
  strength: 'Сила', recomp: 'Рекомпозиция', rehab: 'Реабилитация', health: 'Здоровье', fitness: 'Фитнес',
};

export { GOAL_MAP_RU };

const AAS_CONFLICT_KEYWORDS = ['высокое железо', 'эстроген', 'фитоэстроген', 'пролактин', 'кортизол', 'ароматаза'];
const AAS_SYNERGY_KEYWORDS = ['витамин D', 'цинк', 'магний', 'омега-3', 'CoQ10', 'Q10', 'печень', 'гепато'];
const INSULIN_SYNERGY_KEYWORDS = ['хром', 'магний', 'калий', 'таурин', 'альфа-липоевая'];
const INSULIN_CONFLICT_KEYWORDS = ['высокий сахар', 'быстрый углевод', 'высокий GI', 'фруктоза'];

export function calcProductUsefulness(
  food: FoodItem,
  opts: UsefulnessOptions
): UsefulnessScore {
  const kcal = food.kcal || 1;
  const protein = food.protein || 0;
  const fat = food.fat || 0;
  const carbs = food.carbs || 0;
  const fiber = food.fiber || 0;

  const proteinDensity = Math.min(30, Math.round((protein * 10 / kcal) * 6));
  const microCount = countMicrosPresent(food);
  const microDensity = Math.min(30, microCount * 3);
  const fiberScore = Math.min(20, Math.round((fiber * 5 / kcal) * 80));
  const tierScoreMap: Record<string, number> = { basic: 5, mid: 12, max: 20 };
  const tierScore = tierScoreMap[food.tier || 'basic'] || 5;

  // Amino acid score (leucine + BCAA)
  const leu = food.micros?.Leucine || 0;
  const ile = food.micros?.Isoleucine || 0;
  const val = food.micros?.Valine || 0;
  const leuScore = Math.min(15, Math.round(leu * 5));          // 3g/100g = 15 pts
  const bcaaTotal = leu + ile + val;
  const bcaaScore = Math.min(10, Math.round(bcaaTotal * 2));   // 5g/100g = 10 pts
  const aminoScore = leuScore + bcaaScore;

  const goal = opts.goal ? getEffectiveGoal(opts.goal) : 'maintenance';
  const bestFor = food.bestFor || [];
  const goalMatch = bestFor.includes(goal) ? 15 : bestFor.length === 0 ? 5 : 0;

  const currentHour = opts.hourOverride != null ? opts.hourOverride : new Date().getHours();
  const timingMap: Record<string, number[]> = {
    morning: [5, 11], lunch: [11, 15], dinner: [17, 21],
    after_train: [6, 22], before_sleep: [21, 24], any: [0, 24],
  };
  const timingRanges = timingMap[food.timing || 'any'] || [0, 24];
  const timeOk = currentHour >= timingRanges[0] && currentHour <= timingRanges[1];
  const timingMatch = food.timing && food.timing !== 'any' && timeOk ? 5 : 0;

  let pharmaMatch = 0;
  if (food.pharmaNote) {
    const noteLower = food.pharmaNote.toLowerCase();
    if (opts.hasAAS) {
      if (AAS_CONFLICT_KEYWORDS.some(k => noteLower.includes(k))) pharmaMatch -= 8;
      else if (AAS_SYNERGY_KEYWORDS.some(k => noteLower.includes(k))) pharmaMatch += 8;
    }
    if (opts.hasInsulin) {
      if (INSULIN_SYNERGY_KEYWORDS.some(k => noteLower.includes(k))) pharmaMatch += 5;
      if (INSULIN_CONFLICT_KEYWORDS.some(k => noteLower.includes(k))) pharmaMatch -= 5;
    }
  }

  const rawA = opts.enableA ? (proteinDensity + microDensity + fiberScore + tierScore + aminoScore) : 0;
  const rawB = opts.enableB ? (goalMatch + timingMatch + pharmaMatch) : 0;
  const rawTotal = rawA + rawB;

  const maxA = opts.enableA ? 105 : 0;
  const maxB = opts.enableB ? 28 : 0;
  let maxPossible = maxA + maxB;

  const normTotal = maxPossible > 0 ? Math.round(rawTotal / maxPossible * 100) : 0;
  const total = Math.max(0, Math.min(100, normTotal));

  let costEfficiency: UsefulnessScore['costEfficiency'] = null;
  if (opts.enableC) {
    const price = opts.pricePerKg || ESTIMATED_PRICES[food.id];
    if (price && protein > 0) {
      const proteinCostRub = Math.round(price / (protein * 10));
      const leucineCostRub = leu > 0 ? Math.round(price * 100 / leu * 10) / 10 : 0;
      const efficiencyScore = Math.max(0, Math.min(100, Math.round(80 - proteinCostRub * 2)));
      costEfficiency = { proteinCostRub, leucineCostRub, efficiencyScore };
    }
  }

  if (opts.enableC && costEfficiency) {
    maxPossible = 100;
  } else if (opts.enableC) {
    maxPossible = maxA + maxB;
  }

  const label = total >= 75 ? 'Отлично' : total >= 55 ? 'Хорошо' : total >= 40 ? 'Средне' : 'Низкая';
  const color = total >= 75 ? '#22c55e' : total >= 55 ? '#3b82f6' : total >= 40 ? '#f59e0b' : '#ef4444';

  return {
    total, maxPossible,
    breakdown: { proteinDensity, microDensity, fiberQuality: fiberScore, tierScore, aminoScore },
    contextBonus: { goalMatch, timingMatch, pharmaMatch },
    costEfficiency, label, color,
  };
}

export function scoreAllProducts(
  opts: UsefulnessOptions & { category?: string }
): { food: FoodItem; score: UsefulnessScore }[] {
  try {
    const filtered = opts.category && opts.category !== 'all'
      ? FOOD_DB.filter(f => f.category === opts.category)
      : FOOD_DB;
    return filtered.map(food => {
      try {
        return { food, score: calcProductUsefulness(food, opts) };
      } catch {
        return { food, score: {
          total: 0, maxPossible: 100,
          breakdown: { proteinDensity: 0, microDensity: 0, fiberQuality: 0, tierScore: 0, aminoScore: 0 },
          contextBonus: { goalMatch: 0, timingMatch: 0, pharmaMatch: 0 },
          costEfficiency: null, label: 'Низкая', color: '#ef4444',
        } };
      }
    }).sort((a, b) => b.score.total - a.score.total);
  } catch {
    return [];
  }
}

export function compareProducts(
  ids: string[],
  opts: UsefulnessOptions
): { food: FoodItem; score: UsefulnessScore }[] {
  return ids.map(id => {
    const food = FOOD_DB.find(f => f.id === id);
    if (!food) return null;
    return { food, score: calcProductUsefulness(food, opts) };
  }).filter(Boolean) as { food: FoodItem; score: UsefulnessScore }[];
}

export const CATEGORY_LABELS: Record<string, string> = {
  all: 'Все', protein: '🥩 Белок', carb: '🍚 Углеводы', fat: '🧈 Жиры',
  dairy: '🥛 Молочка', veg_fruit: '🥦 Овощи/Фрукты', grain: '🌾 Зерновые',
  supplement: '💊 Добавки', fast_food: '🍔 Фастфуд', other: '📦 Другое',
};

export interface MealProduct {
  foodId: string;
  weightGrams: number;
}

export interface SavedMeal {
  id: string;
  name: string;
  products: MealProduct[];
  createdAt: string;
}

export interface MealScore {
  compositeScore: number;
  maxPossible: number;
  totalKcal: number;
  totalProtein: number;
  totalFat: number;
  totalCarbs: number;
  totalFiber: number;
  totalWeight: number;
  microCoverage: { key: string; name: string; current: number; rda: number; percent: number }[];
  productScores: { foodId: string; name: string; weight: number; score: number; contribution: number }[];
  weakLink: { foodId: string; name: string; reason: string } | null;
  pfcRatio: { proteinPct: number; fatPct: number; carbsPct: number };
  kcalPerGram: number;
  label: string;
  color: string;
}

const MICRO_NAMES: Record<string, string> = {
  Ca: 'Кальций', Fe: 'Железо', Mg: 'Магний', P: 'Фосфор', K: 'Калий', Zn: 'Цинк', Se: 'Селен',
  VitA: 'A', VitB1: 'B1', VitB2: 'B2', VitB3: 'B3', VitB5: 'B5', VitB6: 'B6', VitB9: 'B9', VitB12: 'B12',
  VitC: 'C', VitD: 'D', VitE: 'E', VitK: 'K', Omega3: 'Омега-3',
};

export function calcMealScore(
  products: MealProduct[],
  opts: UsefulnessOptions
): MealScore {
  let totalWeight = 0, totalKcal = 0, totalProtein = 0, totalFat = 0, totalCarbs = 0, totalFiber = 0;
  const microTotals: Record<string, number> = {};
  const productScores: MealScore['productScores'] = [];

  for (const mp of products) {
    const food = FOOD_DB.find(f => f.id === mp.foodId);
    if (!food) continue;
    const ratio = mp.weightGrams / 100;
    totalWeight += mp.weightGrams;
    totalKcal += (food.kcal || 0) * ratio;
    totalProtein += (food.protein || 0) * ratio;
    totalFat += (food.fat || 0) * ratio;
    totalCarbs += (food.carbs || 0) * ratio;
    totalFiber += (food.fiber || 0) * ratio;

    if (food.micros) {
      for (const [key, val] of Object.entries(food.micros)) {
        if (val != null) {
          const nv = key === 'Omega3' && val < 100 ? val * 1000 : val;
          microTotals[key] = (microTotals[key] || 0) + nv * ratio;
        }
      }
    }

    const score = calcProductUsefulness(food, opts);
    productScores.push({
      foodId: food.id,
      name: food.name,
      weight: mp.weightGrams,
      score: score.total,
      contribution: 0,
    });
  }

  const totalScoreWeighted = productScores.reduce((sum, ps) => sum + ps.score * ps.weight, 0);
  const totalWeightForScore = productScores.reduce((sum, ps) => sum + ps.weight, 0);
  const compositeScore = totalWeightForScore > 0
    ? Math.round(totalScoreWeighted / totalWeightForScore)
    : 0;

  productScores.forEach(ps => {
    ps.contribution = totalWeightForScore > 0
      ? Math.round(ps.score * ps.weight / totalWeightForScore)
      : 0;
  });

  const weakLink = productScores.length > 0
    ? productScores.reduce((worst, ps) => ps.score < worst.score ? ps : worst)
    : null;
  const weakLinkResult = weakLink && weakLink.score < (compositeScore - 10)
    ? { foodId: weakLink.foodId, name: weakLink.name, reason: `Скор ${weakLink.score} тянет приём вниз (средний ${compositeScore})` }
    : null;

  const totalKcalForRatio = totalKcal || 1;
  const pfcRatio = {
    proteinPct: Math.round(totalProtein * 4 / totalKcalForRatio * 100),
    fatPct: Math.round(totalFat * 9 / totalKcalForRatio * 100),
    carbsPct: Math.round(totalCarbs * 4 / totalKcalForRatio * 100),
  };

  const microCoverage: MealScore['microCoverage'] = Object.entries(MICRO_RDA)
    .filter(([key]) => microTotals[key] != null && microTotals[key] > 0)
    .map(([key, rda]) => ({
      key,
      name: MICRO_NAMES[key] || key,
      current: Math.round(microTotals[key] * 10) / 10,
      rda,
      percent: Math.min(500, Math.round(microTotals[key] / rda * 100)),
    }))
    .sort((a, b) => b.percent - a.percent);

  const kcalPerGram = totalWeight > 0 ? Math.round(totalKcal / totalWeight * 10) / 10 : 0;

  const label = compositeScore >= 75 ? 'Отлично' : compositeScore >= 55 ? 'Хорошо' : compositeScore >= 40 ? 'Средне' : 'Низкая';
  const color = compositeScore >= 75 ? '#22c55e' : compositeScore >= 55 ? '#3b82f6' : compositeScore >= 40 ? '#f59e0b' : '#ef4444';

  return {
    compositeScore,
    maxPossible: 100,
    totalKcal: Math.round(totalKcal),
    totalProtein: Math.round(totalProtein * 10) / 10,
    totalFat: Math.round(totalFat * 10) / 10,
    totalCarbs: Math.round(totalCarbs * 10) / 10,
    totalFiber: Math.round(totalFiber * 10) / 10,
    totalWeight: Math.round(totalWeight),
    microCoverage,
    productScores,
    weakLink: weakLinkResult,
    pfcRatio,
    kcalPerGram,
    label,
    color,
  };
}
