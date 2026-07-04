import { FOOD_DB, type FoodItem } from '../core/nutrition-database';
import { loadCustomFoods, type CustomFoodEntry } from './meal-tier-generator.engine';

export interface NutrientTarget {
  nutrient: string;
  label: string;
  target: number;
  unit: string;
  /** Which v2 field to read from FoodItem (dot-separated path) */
  field: string;
  /** Which v2 field to read per100g */
  field100: string;
}

export interface NutrientGap {
  nutrient: string;
  label: string;
  current: number;
  target: number;
  deficit: number;
  unit: string;
  percentCovered: number;
}

export interface GapFillerSuggestion {
  foodId: string;
  name: string;
  category: FoodItem['category'];
  nutrientPer100g: number;
  gramsToFill: number;
  kcalCost: number;
  efficiencyScore: number;
  proteinG: number;
}

export interface NutrientGapResult {
  gaps: NutrientGap[];
  suggestions: Record<string, GapFillerSuggestion[]>;
  summary: {
    totalNutrients: number;
    deficits: number;
    marginal: number;
    ok: number;
  };
}

const NUTRIENT_TARGETS: NutrientTarget[] = [
  { nutrient: 'potassium', label: 'Калий', target: 3500, unit: 'мг', field: 'electrolytes_100g.potassium_mg', field100: 'potassium_mg' },
  { nutrient: 'magnesium', label: 'Магний', target: 400, unit: 'мг', field: 'electrolytes_100g.magnesium_mg', field100: 'magnesium_mg' },
  { nutrient: 'calcium', label: 'Кальций', target: 1000, unit: 'мг', field: 'electrolytes_100g.calcium_mg', field100: 'calcium_mg' },
  { nutrient: 'sodium', label: 'Натрий', target: 2000, unit: 'мг', field: 'electrolytes_100g.sodium_mg', field100: 'sodium_mg' },
  { nutrient: 'phosphorus', label: 'Фосфор', target: 1000, unit: 'мг', field: 'electrolytes_100g.phosphorus_mg', field100: 'phosphorus_mg' },
  { nutrient: 'zinc', label: 'Цинк', target: 15, unit: 'мг', field: 'trace_elements_100g.zinc_mg', field100: 'zinc_mg' },
  { nutrient: 'iron', label: 'Железо', target: 18, unit: 'мг', field: 'trace_elements_100g.iron_total_mg', field100: 'iron_total_mg' },
  { nutrient: 'selenium', label: 'Селен', target: 55, unit: 'мкг', field: 'trace_elements_100g.selenium_mcg', field100: 'selenium_mcg' },
  { nutrient: 'copper', label: 'Медь', target: 1.0, unit: 'мг', field: 'trace_elements_100g.copper_mg', field100: 'copper_mg' },
  { nutrient: 'manganese', label: 'Марганец', target: 2.3, unit: 'мг', field: 'trace_elements_100g.manganese_mg', field100: 'manganese_mg' },
  { nutrient: 'iodine', label: 'Йод', target: 150, unit: 'мкг', field: 'trace_elements_100g.iodine_mcg', field100: 'iodine_mcg' },
  { nutrient: 'chromium', label: 'Хром', target: 35, unit: 'мкг', field: 'trace_elements_100g.chromium_mcg', field100: 'chromium_mcg' },
  { nutrient: 'leucine', label: 'Лейцин', target: 3000, unit: 'мг', field: 'amino_acid_profile_100g.leucine_mg', field100: 'leucine_mg' },
  { nutrient: 'isoleucine', label: 'Изолейцин', target: 1500, unit: 'мг', field: 'amino_acid_profile_100g.isoleucine_mg', field100: 'isoleucine_mg' },
  { nutrient: 'valine', label: 'Валин', target: 1500, unit: 'мг', field: 'amino_acid_profile_100g.valine_mg', field100: 'valine_mg' },
  { nutrient: 'lysine', label: 'Лизин', target: 2000, unit: 'мг', field: 'amino_acid_profile_100g.lysine_mg', field100: 'lysine_mg' },
  { nutrient: 'methionine', label: 'Метионин', target: 1000, unit: 'мг', field: 'amino_acid_profile_100g.methionine_mg', field100: 'methionine_mg' },
  { nutrient: 'arginine', label: 'Аргинин', target: 2000, unit: 'мг', field: 'amino_acid_profile_100g.arginine_mg', field100: 'arginine_mg' },
  { nutrient: 'glutamine', label: 'Глутамин', target: 3000, unit: 'мг', field: 'amino_acid_profile_100g.glutamine_mg', field100: 'glutamine_mg' },
  { nutrient: 'tryptophan', label: 'Триптофан', target: 250, unit: 'мг', field: 'amino_acid_profile_100g.tryptophan_mg', field100: 'tryptophan_mg' },
  { nutrient: 'threonine', label: 'Треонин', target: 1000, unit: 'мг', field: 'amino_acid_profile_100g.threonine_mg', field100: 'threonine_mg' },
  { nutrient: 'cysteine', label: 'Цистеин', target: 500, unit: 'мг', field: 'amino_acid_profile_100g.cysteine_mg', field100: 'cysteine_mg' },
  { nutrient: 'omega3', label: 'Омега-3', target: 2000, unit: 'мг', field: 'macro_100g.omega_3_mg', field100: 'omega_3_mg' },
  { nutrient: 'vitamin_a', label: 'Витамин A', target: 900, unit: 'мкг', field: 'vitamins_100g.vitamin_a_mcg', field100: 'vitamin_a_mcg' },
  { nutrient: 'vitamin_c', label: 'Витамин C', target: 90, unit: 'мг', field: 'vitamins_100g.vitamin_c_mg', field100: 'vitamin_c_mg' },
  { nutrient: 'vitamin_d', label: 'Витамин D', target: 15, unit: 'мкг', field: 'vitamins_100g.vitamin_d_mcg', field100: 'vitamin_d_mcg' },
  { nutrient: 'vitamin_e', label: 'Витамин E', target: 15, unit: 'мг', field: 'vitamins_100g.vitamin_e_mg', field100: 'vitamin_e_mg' },
  { nutrient: 'vitamin_k', label: 'Витамин K', target: 120, unit: 'мкг', field: 'vitamins_100g.vitamin_k_mcg', field100: 'vitamin_k_mcg' },
  { nutrient: 'vitamin_b1', label: 'Витамин B1', target: 1.2, unit: 'мг', field: 'vitamins_100g.vitamin_b1_mg', field100: 'vitamin_b1_mg' },
  { nutrient: 'vitamin_b2', label: 'Витамин B2', target: 1.3, unit: 'мг', field: 'vitamins_100g.vitamin_b2_mg', field100: 'vitamin_b2_mg' },
  { nutrient: 'vitamin_b3', label: 'Витамин B3', target: 16, unit: 'мг', field: 'vitamins_100g.vitamin_b3_mg', field100: 'vitamin_b3_mg' },
  { nutrient: 'vitamin_b5', label: 'Витамин B5', target: 5, unit: 'мг', field: 'vitamins_100g.vitamin_b5_mg', field100: 'vitamin_b5_mg' },
  { nutrient: 'vitamin_b6', label: 'Витамин B6', target: 1.7, unit: 'мг', field: 'vitamins_100g.vitamin_b6_mg', field100: 'vitamin_b6_mg' },
  { nutrient: 'vitamin_b7', label: 'Витамин B7', target: 30, unit: 'мкг', field: 'vitamins_100g.vitamin_b7_mcg', field100: 'vitamin_b7_mcg' },
  { nutrient: 'vitamin_b9', label: 'Фолат (B9)', target: 400, unit: 'мкг', field: 'vitamins_100g.vitamin_b9_mcg', field100: 'vitamin_b9_mcg' },
  { nutrient: 'vitamin_b12', label: 'Витамин B12', target: 2.4, unit: 'мкг', field: 'vitamins_100g.vitamin_b12_mcg', field100: 'vitamin_b12_mcg' },
  { nutrient: 'fiber', label: 'Клетчатка', target: 30, unit: 'г', field: 'fiber', field100: 'fiber' },
  { nutrient: 'creatine', label: 'Креатин', target: 1000, unit: 'мг', field: 'bioactive_compounds_100g.creatine_mg', field100: 'creatine_mg' },
  { nutrient: 'taurine', label: 'Таурин', target: 500, unit: 'мг', field: 'bioactive_compounds_100g.taurine_mg', field100: 'taurine_mg' },
  { nutrient: 'coenzyme_q10', label: 'Коэнзим Q10', target: 30, unit: 'мг', field: 'specific_compounds_100g.coenzyme_q10_mg', field100: 'coenzyme_q10_mg' },
  { nutrient: 'polyphenols', label: 'Полифенолы', target: 500, unit: 'мг', field: 'specific_compounds_100g.polyphenols_mg', field100: 'polyphenols_mg' },
  { nutrient: 'flavonoids', label: 'Флавоноиды', target: 200, unit: 'мг', field: 'specific_compounds_100g.flavonoids_mg', field100: 'flavonoids_mg' },
];

function getNutrientValue(food: FoodItem, target: NutrientTarget): number {
  const path = target.field.split('.');
  let val: any = food;
  for (const key of path) {
    if (val == null) return 0;
    val = val[key];
  }
  return typeof val === 'number' ? val : 0;
}

function customFoodToFoodItem(entry: CustomFoodEntry): FoodItem {
  return {
    id: entry.id,
    name: entry.name,
    category: entry.category,
    kcal: entry.kcal,
    protein: entry.protein,
    fat: entry.fat,
    carbs: entry.carbs,
    fiber: entry.fiber,
    gi: 0,
    servingSize: entry.servingSize,
    tier: 'basic',
    electrolytes_100g: {
      potassium_mg: entry.potassium_mg,
      magnesium_mg: entry.magnesium_mg,
      calcium_mg: entry.calcium_mg,
      sodium_mg: entry.sodium_mg,
      phosphorus_mg: entry.phosphorus_mg,
    },
    trace_elements_100g: {
      zinc_mg: entry.zinc_mg,
      iron_total_mg: entry.iron_mg,
      selenium_mcg: entry.selenium_mcg,
      copper_mg: entry.copper_mg,
      manganese_mg: entry.manganese_mg,
      iodine_mcg: entry.iodine_mcg,
      chromium_mcg: entry.chromium_mcg,
    },
    amino_acid_profile_100g: {
      leucine_mg: entry.leucine_mg,
      isoleucine_mg: entry.isoleucine_mg,
      valine_mg: entry.valine_mg,
      lysine_mg: entry.lysine_mg,
      methionine_mg: entry.methionine_mg,
      arginine_mg: entry.arginine_mg,
      glutamine_mg: entry.glutamine_mg,
      tryptophan_mg: entry.tryptophan_mg,
      threonine_mg: entry.threonine_mg,
      cysteine_mg: entry.cysteine_mg,
    },
    vitamins_100g: {
      vitamin_a_mcg: entry.vitamin_a_mcg,
      vitamin_c_mg: entry.vitamin_c_mg,
      vitamin_d_mcg: entry.vitamin_d_mcg,
      vitamin_e_mg: entry.vitamin_e_mg,
      vitamin_k_mcg: entry.vitamin_k_mcg,
      vitamin_b1_mg: entry.vitamin_b1_mg,
      vitamin_b2_mg: entry.vitamin_b2_mg,
      vitamin_b3_mg: entry.vitamin_b3_mg,
      vitamin_b5_mg: entry.vitamin_b5_mg,
      vitamin_b6_mg: entry.vitamin_b6_mg,
      vitamin_b7_mcg: entry.vitamin_b7_mcg,
      vitamin_b9_mcg: entry.vitamin_b9_mcg,
      vitamin_b12_mcg: entry.vitamin_b12_mcg,
    },
    macro_100g: {
      omega_3_mg: entry.omega3_mg,
    },
    bioactive_compounds_100g: {
      creatine_mg: entry.creatine_mg,
      taurine_mg: entry.taurine_mg,
    },
    specific_compounds_100g: {
      coenzyme_q10_mg: entry.coenzyme_q10_mg,
      polyphenols_mg: entry.polyphenols_mg,
      flavonoids_mg: entry.flavonoids_mg,
    },
  };
}

export function analyzeNutrientGaps(
  products: { foodId: string; weightGrams: number }[],
): NutrientGapResult {
  const entries = products
    .map(p => {
      const food = FOOD_DB.find(f => f.id === p.foodId);
      return food ? { food, weightGrams: p.weightGrams } : null;
    })
    .filter((e): e is { food: FoodItem; weightGrams: number } => e !== null);

  const gaps: NutrientGap[] = [];
  const suggestions: Record<string, GapFillerSuggestion[]> = {};
  let deficits = 0;
  let marginal = 0;
  let ok = 0;

  const allFoods: FoodItem[] = [
    ...FOOD_DB,
    ...loadCustomFoods().map(customFoodToFoodItem),
  ];

  for (const target of NUTRIENT_TARGETS) {
    let total = 0;
    for (const e of entries) {
      total += getNutrientValue(e.food, target) * e.weightGrams / 100;
    }

    const pct = target.target > 0 ? Math.round(total / target.target * 100) : 100;
    const deficit = Math.max(0, target.target - total);

    const gap: NutrientGap = {
      nutrient: target.nutrient,
      label: target.label,
      current: Math.round(total * 10) / 10,
      target: target.target,
      deficit: Math.round(deficit * 10) / 10,
      unit: target.unit,
      percentCovered: Math.min(100, pct),
    };

    gaps.push(gap);

    if (pct < 50) deficits++;
    else if (pct < 80) marginal++;
    else ok++;

    if (deficit <= 0) continue;

    const rawFillers: GapFillerSuggestion[] = [];
    for (const food of allFoods) {
      const per100 = getNutrientValue(food, target);
      if (per100 <= 0) continue;
      const kcal = food.kcal || 1;
      const gramsToFill = (deficit / per100) * 100;
      if (gramsToFill <= 0 || gramsToFill > 30000) continue;
      const kcalCost = Math.round(kcal * gramsToFill / 100);
      const efficiency = per100 / Math.max(1, kcal);
      const proteinG = Math.round((food.protein || 0) * gramsToFill / 1000) / 10;
      rawFillers.push({
        foodId: food.id,
        name: food.name,
        category: food.category,
        nutrientPer100g: Math.round(per100 * 100) / 100,
        gramsToFill: Math.round(gramsToFill),
        kcalCost,
        efficiencyScore: Math.round(efficiency * 1000) / 10,
        proteinG,
      });
    }

    rawFillers.sort((a, b) => b.efficiencyScore - a.efficiencyScore);
    suggestions[target.nutrient] = rawFillers;
  }

  return {
    gaps,
    suggestions,
    summary: { totalNutrients: NUTRIENT_TARGETS.length, deficits, marginal, ok },
  };
}

export function getFoodNutrientProfile(foodId: string): { nutrient: string; label: string; value: number; unit: string; target: number; pct: number }[] {
  let food: FoodItem | undefined = FOOD_DB.find(f => f.id === foodId);
  if (!food) {
    const custom = loadCustomFoods().find(f => f.id === foodId);
    if (custom) food = customFoodToFoodItem(custom);
  }
  if (!food) return [];
  return NUTRIENT_TARGETS.map(t => {
    const val = getNutrientValue(food, t);
    const pct = t.target > 0 ? Math.round(val / t.target * 100) : 0;
    return { nutrient: t.nutrient, label: t.label, value: Math.round(val * 10) / 10, unit: t.unit, target: t.target, pct: Math.min(100, pct) };
  }).filter(r => r.value > 0).sort((a, b) => b.pct - a.pct);
}

export const NUTRIENT_CATEGORIES: Record<string, { label: string; nutrients: string[] }> = {
  electrolytes: { label: '⚡ Электролиты', nutrients: ['potassium', 'magnesium', 'calcium', 'sodium', 'phosphorus'] },
  trace: { label: '🔬 Микроэлементы', nutrients: ['zinc', 'iron', 'selenium', 'copper', 'manganese', 'iodine', 'chromium'] },
  amino_acids: { label: '🧬 Аминокислоты', nutrients: ['leucine', 'isoleucine', 'valine', 'lysine', 'methionine', 'arginine', 'glutamine', 'tryptophan', 'threonine', 'cysteine'] },
  vitamins: { label: '💊 Витамины', nutrients: ['vitamin_a', 'vitamin_c', 'vitamin_d', 'vitamin_e', 'vitamin_k', 'vitamin_b1', 'vitamin_b2', 'vitamin_b3', 'vitamin_b5', 'vitamin_b6', 'vitamin_b7', 'vitamin_b9', 'vitamin_b12'] },
  other: { label: '📦 Прочее', nutrients: ['omega3', 'fiber', 'creatine', 'taurine', 'coenzyme_q10', 'polyphenols', 'flavonoids'] },
};

export interface ComboItem {
  foodId: string;
  name: string;
  category: string;
  grams: number;
  kcal: number;
  coversNutrients: string[];
}

export interface NutrientCombo {
  items: ComboItem[];
  totalKcal: number;
  totalGrams: number;
  coveredNutrients: string[];
  allNutrientsCovered: boolean;
}

export function findBestCombo(
  products: { foodId: string; weightGrams: number }[],
  maxItems: number = 3,
): NutrientCombo[] {
  const gapResult = analyzeNutrientGaps(products);
  const deficits = gapResult.gaps.filter(g => g.deficit > 0 && g.percentCovered < 50);
  if (deficits.length === 0) return [];

  const allFoods: { food: FoodItem; isCustom: boolean }[] = [
    ...FOOD_DB.map(f => ({ food: f, isCustom: false })),
    ...loadCustomFoods().map(e => ({ food: customFoodToFoodItem(e), isCustom: true })),
  ];

  const combos: NutrientCombo[] = [];

  for (const foodA of allFoods) {
    const nutrientsA: string[] = [];
    const gramsA: Record<string, number> = {};

    for (const gap of deficits) {
      const per100 = getNutrientValue(foodA.food, NUTRIENT_TARGETS.find(t => t.nutrient === gap.nutrient)!);
      if (per100 <= 0) continue;
      const g = (gap.deficit / per100) * 100;
      if (g > 30000) continue;
      nutrientsA.push(gap.nutrient);
      gramsA[gap.nutrient] = g;
    }

    if (nutrientsA.length === 0) continue;

    const gramsForA = Object.keys(gramsA).length > 0
      ? Math.max(...Object.values(gramsA))
      : 100;
    const kcalA = Math.round(foodA.food.kcal * gramsForA / 100);

    const combo1: NutrientCombo = {
      items: [{
        foodId: foodA.food.id,
        name: foodA.food.name,
        category: foodA.food.category,
        grams: Math.round(gramsForA),
        kcal: kcalA,
        coversNutrients: [...new Set(nutrientsA)],
      }],
      totalKcal: kcalA,
      totalGrams: Math.round(gramsForA),
      coveredNutrients: [...new Set(nutrientsA)],
      allNutrientsCovered: new Set(nutrientsA).size >= deficits.length,
    };
    combos.push(combo1);

    if (combo1.allNutrientsCovered || maxItems < 2) continue;

    const remainingA = deficits.filter(g => !nutrientsA.includes(g.nutrient));
    if (remainingA.length === 0) continue;

    for (const foodB of allFoods) {
      if (foodB.food.id === foodA.food.id) continue;
      const nutrientsB: string[] = [];

      for (const gap of remainingA) {
        const per100 = getNutrientValue(foodB.food, NUTRIENT_TARGETS.find(t => t.nutrient === gap.nutrient)!);
        if (per100 <= 0) continue;
        const g = (gap.deficit / per100) * 100;
        if (g > 30000) continue;
        nutrientsB.push(gap.nutrient);
      }

      if (nutrientsB.length === 0) continue;

      const gramsB = nutrientsB.length > 0 ? 150 : 100;
      const kcalB = Math.round(foodB.food.kcal * gramsB / 100);

      const allCovered = [...new Set([...nutrientsA, ...nutrientsB])];
      const combo2: NutrientCombo = {
        items: [
          {
            foodId: foodA.food.id, name: foodA.food.name,
            category: foodA.food.category, grams: Math.round(gramsForA), kcal: kcalA,
            coversNutrients: [...new Set(nutrientsA)],
          },
          {
            foodId: foodB.food.id, name: foodB.food.name,
            category: foodB.food.category, grams: Math.round(gramsB), kcal: kcalB,
            coversNutrients: [...new Set(nutrientsB)],
          },
        ],
        totalKcal: kcalA + kcalB,
        totalGrams: Math.round(gramsForA + gramsB),
        coveredNutrients: allCovered,
        allNutrientsCovered: allCovered.length >= deficits.length,
      };
      combos.push(combo2);

      if (combo2.allNutrientsCovered || maxItems < 3) continue;

      const remainingB = remainingA.filter(g => !nutrientsB.includes(g.nutrient));
      if (remainingB.length === 0) continue;

      for (const foodC of allFoods) {
        if (foodC.food.id === foodA.food.id || foodC.food.id === foodB.food.id) continue;
        const nutrientsC: string[] = [];

        for (const gap of remainingB) {
          const per100 = getNutrientValue(foodC.food, NUTRIENT_TARGETS.find(t => t.nutrient === gap.nutrient)!);
          if (per100 <= 0) continue;
          const g = (gap.deficit / per100) * 100;
          if (g > 30000) continue;
          nutrientsC.push(gap.nutrient);
        }

        if (nutrientsC.length === 0) continue;

        const gramsC = 100;
        const kcalC = Math.round(foodC.food.kcal * gramsC / 100);
        const all3 = [...new Set([...nutrientsA, ...nutrientsB, ...nutrientsC])];

        combos.push({
          items: [
            { foodId: foodA.food.id, name: foodA.food.name, category: foodA.food.category, grams: Math.round(gramsForA), kcal: kcalA, coversNutrients: [...new Set(nutrientsA)] },
            { foodId: foodB.food.id, name: foodB.food.name, category: foodB.food.category, grams: Math.round(gramsB), kcal: kcalB, coversNutrients: [...new Set(nutrientsB)] },
            { foodId: foodC.food.id, name: foodC.food.name, category: foodC.food.category, grams: gramsC, kcal: kcalC, coversNutrients: [...new Set(nutrientsC)] },
          ],
          totalKcal: kcalA + kcalB + kcalC,
          totalGrams: Math.round(gramsForA + gramsB + gramsC),
          coveredNutrients: all3,
          allNutrientsCovered: all3.length >= deficits.length,
        });
      }
    }
  }

  combos.sort((a, b) => {
    const scoreA = a.coveredNutrients.length * 100 - a.totalKcal;
    const scoreB = b.coveredNutrients.length * 100 - b.totalKcal;
    return scoreB - scoreA;
  });

  const seen = new Set<string>();
  const unique: NutrientCombo[] = [];
  for (const c of combos) {
    const key = c.items.map(i => i.foodId).sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(c);
  }

  return unique.slice(0, 10);
}
