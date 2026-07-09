import { FOOD_DB, type FoodItem } from '../core/nutrition-database';
import { analyzeNutrientGaps, type NutrientGapResult, type NutrientGap, NUTRIENT_CATEGORIES } from './nutrient-gap-filler.engine';
import type { KbjuMatchResult, AdvancedFilter, KbjuTarget } from './kbju-food-match.engine';
import { calcKbjuMatchScore } from './kbju-food-match.engine';

export interface GapAwareScore extends KbjuMatchResult {
  gapsCovered: number;
  totalGaps: number;
  gapCoveragePct: number;
  isGapFiller: boolean;
  gapNutrients: string[];
  gapEfficiency: number;
  recommendedGrams: number;
  gramsDetail: { nutrient: string; label: string; deficit: number; per100g: number; gramsToFill: number }[];
}

const NUTRIENT_FIELD_MAP: Record<string, string> = {
  potassium: 'electrolytes_100g.potassium_mg',
  magnesium: 'electrolytes_100g.magnesium_mg',
  calcium: 'electrolytes_100g.calcium_mg',
  sodium: 'electrolytes_100g.sodium_mg',
  phosphorus: 'electrolytes_100g.phosphorus_mg',
  zinc: 'trace_elements_100g.zinc_mg',
  iron: 'trace_elements_100g.iron_total_mg',
  selenium: 'trace_elements_100g.selenium_mcg',
  copper: 'trace_elements_100g.copper_mg',
  manganese: 'trace_elements_100g.manganese_mg',
  iodine: 'trace_elements_100g.iodine_mcg',
  chromium: 'trace_elements_100g.chromium_mcg',
  leucine: 'amino_acid_profile_100g.leucine_mg',
  isoleucine: 'amino_acid_profile_100g.isoleucine_mg',
  valine: 'amino_acid_profile_100g.valine_mg',
  lysine: 'amino_acid_profile_100g.lysine_mg',
  methionine: 'amino_acid_profile_100g.methionine_mg',
  arginine: 'amino_acid_profile_100g.arginine_mg',
  glutamine: 'amino_acid_profile_100g.glutamine_mg',
  tryptophan: 'amino_acid_profile_100g.tryptophan_mg',
  threonine: 'amino_acid_profile_100g.threonine_mg',
  cysteine: 'amino_acid_profile_100g.cysteine_mg',
  omega3: 'macro_100g.omega_3_mg',
  vitamin_a: 'vitamins_100g.vitamin_a_mcg',
  vitamin_c: 'vitamins_100g.vitamin_c_mg',
  vitamin_d: 'vitamins_100g.vitamin_d_mcg',
  vitamin_e: 'vitamins_100g.vitamin_e_mg',
  vitamin_k: 'vitamins_100g.vitamin_k_mcg',
  vitamin_b1: 'vitamins_100g.vitamin_b1_mg',
  vitamin_b2: 'vitamins_100g.vitamin_b2_mg',
  vitamin_b3: 'vitamins_100g.vitamin_b3_mg',
  vitamin_b5: 'vitamins_100g.vitamin_b5_mg',
  vitamin_b6: 'vitamins_100g.vitamin_b6_mg',
  vitamin_b7: 'vitamins_100g.vitamin_b7_mcg',
  vitamin_b9: 'vitamins_100g.vitamin_b9_mcg',
  vitamin_b12: 'vitamins_100g.vitamin_b12_mcg',
  fiber: 'fiber',
  creatine: 'bioactive_compounds_100g.creatine_mg',
  taurine: 'bioactive_compounds_100g.taurine_mg',
  coenzyme_q10: 'specific_compounds_100g.coenzyme_q10_mg',
  polyphenols: 'specific_compounds_100g.polyphenols_mg',
  flavonoids: 'specific_compounds_100g.flavonoids_mg',
};

function getNutrientValueFromFood(food: FoodItem, field: string): number {
  const path = field.split('.');
  let val: any = food;
  for (const key of path) {
    if (val == null) return 0;
    val = val[key];
  }
  return typeof val === 'number' ? val : 0;
}

export function getGapCoverageForFood(
  food: FoodItem,
  gaps: NutrientGap[]
): { covered: number; total: number; nutrients: string[]; pct: number } {
  const deficitGaps = gaps.filter(g => g.deficit > 0);
  if (deficitGaps.length === 0) return { covered: 0, total: 0, nutrients: [], pct: 0 };

  const covered: string[] = [];
  for (const gap of deficitGaps) {
    const field = NUTRIENT_FIELD_MAP[gap.nutrient];
    if (!field) continue;
    const per100 = getNutrientValueFromFood(food, field);
    if (per100 <= 0) continue;
    const needed = gap.deficit;
    const gramsNeeded = (needed / per100) * 100;
    if (gramsNeeded <= 5000) covered.push(gap.nutrient);
  }

  return {
    covered: covered.length,
    total: deficitGaps.length,
    nutrients: covered,
    pct: Math.round((covered.length / Math.max(1, deficitGaps.length)) * 100),
  };
}

export function calcGapEfficiency(food: FoodItem, gaps: NutrientGap[]): number {
  const deficitGaps = gaps.filter(g => g.deficit > 0);
  if (deficitGaps.length === 0) return 0;

  let totalNutrientsFilled = 0;
  let totalKcalCost = 0;

  for (const gap of deficitGaps) {
    const field = NUTRIENT_FIELD_MAP[gap.nutrient];
    if (!field) continue;
    const per100 = getNutrientValueFromFood(food, field);
    if (per100 <= 0) continue;
    const gramsNeeded = (gap.deficit / per100) * 100;
    if (gramsNeeded > 5000) continue;
    const kcalCost = (food.kcal || 1) * gramsNeeded / 100;
    totalNutrientsFilled += 1;
    totalKcalCost += kcalCost;
  }

  if (totalKcalCost === 0) return 0;
  return Math.round((totalNutrientsFilled / totalKcalCost) * 10000) / 100;
}

export function scoreFoodsWithGapPriority(
  foods: FoodItem[],
  target: KbjuTarget,
  gapResult: NutrientGapResult | null,
  currentKbju?: KbjuTarget,
  filter?: AdvancedFilter,
  maxResults = 20,
  gapWeight = 0.3,
): GapAwareScore[] {
  const baseResults = foods.map(f => calcKbjuMatchScore(f, target, currentKbju));
  const gaps = gapResult?.gaps || [];

  let results: GapAwareScore[] = baseResults.map(r => {
    const food = FOOD_DB.find(f => f.id === r.foodId);
    const coverage = food ? getGapCoverageForFood(food, gaps) : { covered: 0, total: 0, nutrients: [], pct: 0 };
    const gapEff = food ? calcGapEfficiency(food, gaps) : 0;

    const gapScore = coverage.total > 0 ? (coverage.pct / 100) * 100 : 0;
    const finalScore = Math.min(100, Math.round(r.matchScore * (1 - gapWeight) + gapScore * gapWeight));

    return {
      ...r,
      matchScore: finalScore,
      gapsCovered: coverage.covered,
      totalGaps: coverage.total,
      gapCoveragePct: coverage.pct,
      isGapFiller: coverage.covered > 0,
      gapNutrients: coverage.nutrients,
      gapEfficiency: gapEff,
      recommendedGrams: 100,
      gramsDetail: [],
    };
  });

  if (filter) {
    if (filter.diaasMin !== undefined) results = results.filter(r => (r.diaas || 0) >= (filter.diaasMin || 0));
    if (filter.giMax !== undefined) results = results.filter(r => r.gi <= (filter.giMax || 100));
    if (filter.pralMin !== undefined) results = results.filter(r => (r.pral ?? 0) >= (filter.pralMin || -100));
    if (filter.pralMax !== undefined) results = results.filter(r => (r.pral ?? 0) <= (filter.pralMax || 100));
    if (filter.fiberMin !== undefined) results = results.filter(r => r.fiber >= (filter.fiberMin || 0));
    if (filter.bbQualityMin !== undefined) results = results.filter(r => (r.bbQuality || 0) >= (filter.bbQualityMin || 0));
    if (filter.aminoScoreMin !== undefined) results = results.filter(r => (r.aminoScore || 0) >= (filter.aminoScoreMin || 0));
    if (filter.tierMin) {
      const tierRank: Record<string, number> = { basic: 1, mid: 2, max: 3 };
      const minRank = tierRank[filter.tierMin] || 0;
      results = results.filter(r => (tierRank[r.tier || 'basic'] || 0) >= minRank);
    }
    if (filter.excludeProcessed) results = results.filter(r => r.processingLevel !== 'высокая');
    if (filter.excludeHighGI) results = results.filter(r => r.gi < 70);
    if (filter.excludeAtherogenic) results = results.filter(r => r.atherogenicPotential !== 'HIGH');
    if (filter.excludeGlycation) results = results.filter(r => r.glycationPotential !== 'HIGH');
  }

  results.sort((a, b) => {
    if (a.isGapFiller !== b.isGapFiller) return a.isGapFiller ? -1 : 1;
    return b.matchScore - a.matchScore;
  });
  return results.slice(0, maxResults);
}

export interface GapSummary {
  catKey: string;
  catLabel: string;
  deficits: number;
  marginal: number;
  ok: number;
  nutrients: NutrientGap[];
}

export function buildGapSummary(gapResult: NutrientGapResult): GapSummary[] {
  return Object.entries(NUTRIENT_CATEGORIES).map(([catKey, cat]) => {
    const catGaps = gapResult.gaps.filter(g => cat.nutrients.includes(g.nutrient));
    return {
      catKey,
      catLabel: cat.label,
      deficits: catGaps.filter(g => g.percentCovered < 50).length,
      marginal: catGaps.filter(g => g.percentCovered >= 50 && g.percentCovered < 80).length,
      ok: catGaps.filter(g => g.percentCovered >= 80).length,
      nutrients: catGaps,
    };
  });
}

export function getGapAwareComboResult(
  mealProducts: { foodId: string; weightGrams: number }[],
  maxItems = 3,
): { gaps: NutrientGapResult; suggestions: GapAwareScore[] } {
  const gapResult = analyzeNutrientGaps(mealProducts);
  const deficitGaps = gapResult.gaps.filter(g => g.deficit > 0 && g.percentCovered < 50);
  if (deficitGaps.length === 0) return { gaps: gapResult, suggestions: [] };

  const scored = FOOD_DB.map(food => {
    const coverage = getGapCoverageForFood(food, deficitGaps);
    const eff = calcGapEfficiency(food, deficitGaps);

    const gramsDetail: { nutrient: string; label: string; deficit: number; per100g: number; gramsToFill: number }[] = [];
    for (const gap of deficitGaps) {
      const field = NUTRIENT_FIELD_MAP[gap.nutrient];
      if (!field) continue;
      const per100 = getNutrientValueFromFood(food, field);
      if (per100 <= 0) continue;
      const gramsToFill = Math.round((gap.deficit / per100) * 100);
      if (gramsToFill > 5000) continue;
      gramsDetail.push({ nutrient: gap.nutrient, label: gap.label, deficit: gap.deficit, per100g: per100, gramsToFill });
    }

    const maxGramsToFill = gramsDetail.length > 0
      ? Math.max(...gramsDetail.map(d => d.gramsToFill))
      : 100;
    const recommendedGrams = Math.min(500, Math.max(50, maxGramsToFill));

    return {
      food,
      coveredCount: coverage.covered,
      totalGaps: coverage.total,
      nutrients: coverage.nutrients,
      efficiency: eff,
      kcal: food.kcal || 1,
      protein: food.protein || 0,
      recommendedGrams,
      gramsDetail,
    };
  })
    .filter(s => s.coveredCount > 0)
    .sort((a, b) => {
      const effA = a.coveredCount / a.kcal;
      const effB = b.coveredCount / b.kcal;
      return effB - effA;
    })
    .slice(0, maxItems);

  const suggestions: GapAwareScore[] = scored.map(s => ({
    foodId: s.food.id,
    foodName: s.food.name,
    category: s.food.category,
    matchScore: Math.round((s.coveredCount / Math.max(1, s.totalGaps)) * 100),
    label: s.coveredCount >= Math.ceil(s.totalGaps / 2) ? 'Закрывает' : 'Частично',
    color: s.coveredCount >= Math.ceil(s.totalGaps / 2) ? '#00e68a' : '#f59e0b',
    kcal: s.kcal,
    protein: s.protein,
    fat: s.food.fat || 0,
    carbs: s.food.carbs || 0,
    fiber: s.food.fiber || 0,
    gi: s.food.gi || 0,
    gapsCovered: s.coveredCount,
    totalGaps: s.totalGaps,
    gapCoveragePct: Math.round((s.coveredCount / Math.max(1, s.totalGaps)) * 100),
    isGapFiller: true,
    gapNutrients: s.nutrients,
    gapEfficiency: s.efficiency,
    recommendedGrams: s.recommendedGrams,
    gramsDetail: s.gramsDetail,
  }));

  return { gaps: gapResult, suggestions };
}

export function applyGapComboToPlan(
  dayPlan: any,
  mealIdx: number,
  comboItems: { foodId: string; weightGrams: number }[],
): any {
  if (!dayPlan?.meals?.[mealIdx]) return dayPlan;
  const meals = JSON.parse(JSON.stringify(dayPlan.meals));
  const meal = meals[mealIdx];

  for (const item of comboItems) {
    const food = FOOD_DB.find(f => f.id === item.foodId);
    if (!food) continue;
    const ratio = item.weightGrams / 100;
    meal.items.push({
      name: food.name,
      id: food.id,
      amount: item.weightGrams,
      kcal: Math.round((food.kcal || 0) * ratio),
      p: Math.round((food.protein || 0) * ratio * 10) / 10,
      f: Math.round((food.fat || 0) * ratio * 10) / 10,
      c: Math.round((food.carbs || 0) * ratio * 10) / 10,
    });
  }

  meal.totals = {
    kcal: meal.items.reduce((s: number, i: any) => s + (i.kcal || 0), 0),
    p: meal.items.reduce((s: number, i: any) => s + (i.p || 0), 0),
    f: meal.items.reduce((s: number, i: any) => s + (i.f || 0), 0),
    c: meal.items.reduce((s: number, i: any) => s + (i.c || 0), 0),
  };

  meals[mealIdx] = meal;
  const totals = {
    kcal: meals.reduce((s: number, m: any) => s + (m.totals?.kcal || 0), 0),
    p: meals.reduce((s: number, m: any) => s + (m.totals?.p || 0), 0),
    f: meals.reduce((s: number, m: any) => s + (m.totals?.f || 0), 0),
    c: meals.reduce((s: number, m: any) => s + (m.totals?.c || 0), 0),
  };

  return { ...dayPlan, meals, totals };
}
