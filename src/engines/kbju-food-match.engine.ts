/**
 * KBJU Food Match Engine — Оценка соответствия продукта целевым КБЖУ
 * для ручного сбора рациона (Компоновщик).
 * Обычный режим: подбор по КБЖУ
 * Продвинутый режим: + параметры полезности (DIAAS, GI, PRAL, обработка, амино)
 */
import { FOOD_DB, calcBBQualityScore, type FoodItem } from '../core/nutrition-database';
import { getMicro } from '../core/nutrition-micros';
import { calcDIAAS } from './product-usefulness-v2.engine';

export interface KbjuTarget {
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface KbjuMatchResult {
  foodId: string;
  foodName: string;
  category: string;
  matchScore: number;
  label: string;
  color: string;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  gi: number;
  tier?: string;
  // Advanced fields
  diaas?: number;
  diaasLimitingAA?: string;
  pral?: number;
  bbQuality?: number;
  aminoScore?: number;
  insulinIndex?: number;
  omega3mg?: number;
  saturatedFat?: number;
  processingLevel?: string;
  atherogenicPotential?: string;
  glycationPotential?: string;
}

export interface AdvancedFilter {
  diaasMin?: number;
  giMax?: number;
  pralMin?: number;
  pralMax?: number;
  fiberMin?: number;
  bbQualityMin?: number;
  aminoScoreMin?: number;
  tierMin?: 'basic' | 'mid' | 'max';
  excludeProcessed?: boolean;
  excludeHighGI?: boolean;
  excludeAtherogenic?: boolean;
  excludeGlycation?: boolean;
}

const LIMITING_AA_RU: Record<string, string> = {
  histidine: 'гистидин', isoleucine: 'изолейцин', leucine: 'лейцин', lysine: 'лизин',
  methionine_cystine: 'мет+цис', phenylalanine_tyrosine: 'фен+тир', threonine: 'треонин',
  tryptophan: 'триптофан', valine: 'валин',
};

function calcAminoScore(f: FoodItem): number {
  const a = f.amino_acid_profile_100g;
  if (!a) return 0;
  const leucine = (a.leucine_mg || 0) / 1000;
  const bcaa = ((a.leucine_mg || 0) + (a.isoleucine_mg || 0) + (a.valine_mg || 0)) / 1000;
  let score = 0;
  if (leucine >= 2.5) score += 4;
  else if (leucine >= 1.5) score += 2;
  else if (leucine > 0) score += 1;
  if (bcaa >= 5) score += 4;
  else if (bcaa >= 3) score += 2;
  else if (bcaa > 0) score += 1;
  return score; // 0-8
}

function getProcessingLevel(f: FoodItem): string {
  if (f.tier === 'basic') return 'высокая';
  if (f.tier === 'mid') return 'средняя';
  if (f.tier === 'max') return 'минимальная';
  const cat = f.category;
  if (cat === 'fast_food') return 'высокая';
  if (cat === 'supplement') return 'спортпит';
  return 'неизвестно';
}

export function calcKbjuMatchScore(food: FoodItem, target: KbjuTarget, currentKbju?: KbjuTarget): KbjuMatchResult {
  const remaining = currentKbju
    ? {
        kcal: Math.max(0, target.kcal - currentKbju.kcal),
        protein: Math.max(0, target.protein - currentKbju.protein),
        fat: Math.max(0, target.fat - currentKbju.fat),
        carbs: Math.max(0, target.carbs - currentKbju.carbs),
      }
    : target;

  const per100 = { kcal: food.kcal, protein: food.protein, fat: food.fat, carbs: food.carbs };
  const totalGap = remaining.protein + remaining.fat + remaining.carbs || 1;

  // Calculate macro COMPOSITION match (%, not absolute grams) — compare food profile to gap profile
  const foodMacroSum = food.protein + food.fat + food.carbs || 1;
  const gapSum = remaining.protein + remaining.fat + remaining.carbs || 1;
  const proteinFill = remaining.protein > 0
    ? Math.min(1, (food.protein / foodMacroSum) / Math.max(0.001, remaining.protein / gapSum))
    : 0;
  const fatFill = remaining.fat > 0
    ? Math.min(1, (food.fat / foodMacroSum) / Math.max(0.001, remaining.fat / gapSum))
    : 0;
  const carbsFill = remaining.carbs > 0
    ? Math.min(1, (food.carbs / foodMacroSum) / Math.max(0.001, remaining.carbs / gapSum))
    : 0;

  // Primary macro match: is the food's primary macro the one most needed?
  const maxGap = Math.max(remaining.protein, remaining.fat, remaining.carbs);
  const primaryFoodMacro = Math.max(food.protein, food.fat, food.carbs);
  const primaryGapMatch =
    (maxGap === remaining.protein && primaryFoodMacro === food.protein) ||
    (maxGap === remaining.fat && primaryFoodMacro === food.fat) ||
    (maxGap === remaining.carbs && primaryFoodMacro === food.carbs);

  // Macro alignment score (0-60)
  let macroScore = 0;
  if (totalGap > 0) {
    // Calculate weighted fill
    const pWeight = remaining.protein / totalGap;
    const fWeight = remaining.fat / totalGap;
    const cWeight = remaining.carbs / totalGap;
    macroScore = Math.round((proteinFill * pWeight + fatFill * fWeight + carbsFill * cWeight) * 40);
    if (primaryGapMatch) macroScore += 10;
  }

  // Kcal efficiency: how many kcal does it cost to fill macros?
  const macroPerKcal = (food.protein + food.fat + food.carbs) / Math.max(1, food.kcal);
  const kcalScore = Math.round(Math.min(25, macroPerKcal * 25));

  // Quality bonus
  const bbQ = food.bb_quality_score || calcBBQualityScore(food);
  const qualityBonus = Math.round(Math.min(25, bbQ * 2));

  const score = Math.min(100, macroScore + kcalScore + qualityBonus);

  let label = 'Не подходит'; let color = '#ef4444';
  if (score >= 75) { label = 'Идеально'; color = '#00e68a'; }
  else if (score >= 55) { label = 'Хорошо'; color = '#22c55e'; }
  else if (score >= 35) { label = 'Средне'; color = '#f59e0b'; }

  // Канонический DIAAS: те же reference/digestibility/Tyr/reliability, что и V2-скоринг.
  const diaas = calcDIAAS(food);

  return {
    foodId: food.id,
    foodName: food.name,
    category: food.category,
    matchScore: score,
    label,
    color,
    kcal: food.kcal,
    protein: food.protein,
    fat: food.fat,
    carbs: food.carbs,
    fiber: food.fiber || 0,
    gi: food.gi || 0,
    tier: food.tier,
    diaas: diaas.diaas,
    diaasLimitingAA: LIMITING_AA_RU[diaas.limitingAA] || diaas.limitingAA,
    pral: food.electrolytes_100g?.pral_index,
    bbQuality: food.bb_quality_score || calcBBQualityScore(food),
    aminoScore: calcAminoScore(food),
    insulinIndex: food.macro_100g?.insulin_index,
    omega3mg: getMicro(food, 'Omega3'),
    saturatedFat: getMicro(food, 'SatFat'),
    processingLevel: getProcessingLevel(food),
    atherogenicPotential: food.metabolic_flags?.atherogenic_potential,
    glycationPotential: food.metabolic_flags?.glycation_potential,
  };
}

export function scoreFoodsForKBJU(
  foods: FoodItem[],
  target: KbjuTarget,
  currentKbju?: KbjuTarget,
  filter?: AdvancedFilter,
  maxResults = 20,
  excludeSupplements = true,
): KbjuMatchResult[] {
  let results = foods
    .filter(f => !excludeSupplements || f.category !== 'supplement')
    .map(f => calcKbjuMatchScore(f, target, currentKbju));

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

  results.sort((a, b) => b.matchScore - a.matchScore);
  return results.slice(0, maxResults);
}

/**
 * Извлекает вес порции в граммах из строки servingSize.
 * "100 г" → 100, "1 шт (60 г)" → 60, "2 ст.л. (30 мл)" → 30, "1 порция" → 100
 */
export function parseServingSizeGrams(servingSize?: string): number {
  if (!servingSize) return 100;
  // P0-fix: parseFloat вместо parseInt — иначе «12.5 г» → 12, «0.5 г креатин» → 100 (fallback), теряли точность и портили замены
  // Priority: match "(N г)" or "(N мл)" in parentheses (most specific) — поддерживает дроби и запятую
  const mParen = servingSize.match(/\((\d+(?:[.,]\d+)?)\s*(?:г|g|мл|ml)\)/i);
  if (mParen) { const v = parseFloat(mParen[1].replace(',', '.')); if (v > 0) return Math.round(v); }
  // Direct "N г" / "N g" / "N мл" / "N ml"
  const mDirect = servingSize.match(/(\d+(?:[.,]\d+)?)\s*(?:г|g|мл|ml)/i);
  if (mDirect) { const v = parseFloat(mDirect[1].replace(',', '.')); if (v > 0) return Math.round(v); }
  // Fallback: first number, but only if it seems like grams (not "2 шт" = 2 pieces)
  const n = servingSize.match(/(\d+(?:[.,]\d+)?)/);
  if (n) {
    const v = parseFloat(n[1].replace(',', '.'));
    if (v === 0) return 100; // "0 г" → use default
    if (v >= 10) return Math.round(v);   // likely grams
    // Small numbers (< 10) could be pieces ("2 шт") → use default
    return 100;
  }
  return 100;
}

/** Весовые коэффициенты распределения КБЖУ по приёмам */
const MEAL_WEIGHT: Record<string, number> = {
  'завтрак': 0.2, 'завтрак1': 0.15, 'завтрак2': 0.15,
  'обед': 0.3, 'ужин': 0.25, 'перекус': 0.1, 'перекус1': 0.1, 'перекус2': 0.1,
  'ланч': 0.2, 'полдник': 0.15,
};
const DEFAULT_MEAL_WEIGHT = 0; // unrecognized meals get 0 weight, normalized via 1/mealCount

export function getMealKBJUTarget(dayPlan: any, mealIdx: number): KbjuTarget | null {
  if (!dayPlan?.totals || !dayPlan?.meals) return null;
  const mealCount = dayPlan.meals.length || 1;
  const meal = dayPlan.meals[mealIdx];
  const label = (meal?.label || '').toLowerCase().replace(/[^а-яёa-z0-9]/g, '');
  const weight = MEAL_WEIGHT[label] || DEFAULT_MEAL_WEIGHT;
  const totalWeight = dayPlan.meals.reduce((s: number, m: any) => {
    const l = (m?.label || '').toLowerCase().replace(/[^а-яёa-z0-9]/g, '');
    return s + (MEAL_WEIGHT[l] || DEFAULT_MEAL_WEIGHT);
  }, 0);
  const ratio = totalWeight > 0 ? weight / totalWeight : 1 / mealCount;
  return {
    kcal: Math.round(dayPlan.totals.kcal * ratio),
    protein: Math.round(dayPlan.totals.p * ratio),
    fat: Math.round(dayPlan.totals.f * ratio),
    carbs: Math.round(dayPlan.totals.c * ratio),
  };
}

export function getMealCurrentKBJU(dayPlan: any, mealIdx: number): KbjuTarget | null {
  if (!dayPlan?.meals?.[mealIdx]?.totals) return null;
  const t = dayPlan.meals[mealIdx].totals;
  return { kcal: t.kcal || 0, protein: t.p || 0, fat: t.f || 0, carbs: t.c || 0 };
}

/** Максимальная разовая доза добавок (г) */
export const SUPPLEMENT_DOSE_CAP: Record<string, number> = {
  creatine: 10, whey_isolate: 60, whey_protein: 60, whey_concentrate: 60,
  casein: 60, casein_micellar: 60, bcaa: 20, supp_eaas: 20,
  glutamine: 15, supp_hmb: 6, supp_beta_alanine: 6, supp_citrulline_dl_malate: 12,
  supp_agmatine_sulfate: 2, supp_l_carnitine_tartrate: 4, supp_alpha_gpc: 2,
  amylopectin: 80, dextrose: 80, coll_hydro: 20, supp_taurine: 5, supp_glycine: 5,
  supp_carnitine: 2, supp_beta_alanine_time: 6, supp_citrulline_malate: 12,
  supp_arg_aakg: 8, supp_ornithine_akg: 8, supp_collagen_peptides: 20,
  supp_collagen_hydro: 20, supp_beef_protein: 60, supp_egg_protein: 60,
  supp_soy_isolate: 60, supp_pea_protein: 60, supp_rice_protein: 60,
  supp_hemp_protein: 60, supp_pumpkin_protein: 60, rice_protein: 60,
  supp_pea_protein_iso: 60, supp_beef_protein_iso: 60, supp_egg_white_powder: 60,
  supp_goat_whey: 60, supp_hydrolyzed_whey: 60, supp_mass_gainer: 100,
  mass_gainer: 100, protein_bar: 80, bar_protein: 80,
  supp_probiotics: 2, supp_digestive_enzymes: 2, supp_zma: 4,
  supp_melatonin: 1, supp_5htp: 1, supp_gaba: 3, supp_phenibut: 1,
  supp_ashwagandha: 2, supp_rhodiola: 2, supp_cordyceps: 2, supp_reishi: 2,
  supp_bacopa_monnieri: 1, supp_lions_maine: 2, supp_phosphatidylserine: 1,
  supp_l_theanine: 1, supp_potassium_citrate: 3, supp_boron_glycinate: 1,
  supp_chromium_picolinate: 1, supp_iodine_kelp: 1, supp_mct_powder: 30,
  supp_greens_powder: 10, supp_beetroot_powder: 15, supp_electrolyte_tabs: 4,
  supp_ketone_esters: 30, supp_glycerol: 10, supp_sodium_bicarbonate: 5,
  pre_workout: 15, supp_creatine_hcl: 5, aminos_complex: 15, isotonic: 30,
  supp_acetyl_carnitine: 2, supp_tyrosine: 3,
  supp_betaine: 5, supp_cla: 3, supp_bone_broth_protein: 25,
  // Р-2.3 (Aug 28): клетчаточные добавки — дозировки, не еда (псиллиум 300 г = 240 г
  // клетчатки — опасно; порция 10 г)
  psyllium_husk: 15, glucomannan: 10, inulin: 20, wheat_bran_supplement: 30,
};

/** Дефолтная доза (г), если ID нет в кап-карте */
const DEFAULT_SUPP_DOSE = 30;

export function getSupplementDose(id: string): number {
  return SUPPLEMENT_DOSE_CAP[id] ?? DEFAULT_SUPP_DOSE;
}

/** Возвращает список добавок с пересчитанными КБЖУ на разовую дозу */
export function buildSupplementPortions(): {
  id: string; name: string; category: string; servingSize: string;
  kcal: number; protein: number; fat: number; carbs: number; fiber: number; doseG: number;
}[] {
  return FOOD_DB
    .filter(f => f.category === 'supplement')
    .map(f => {
      const doseG = getSupplementDose(f.id);
      const r = doseG / 100;
      const sv = f.servingSize || `${doseG} г`;
      return {
        id: f.id, name: f.name, category: f.category, servingSize: sv,
        kcal: Math.round((f.kcal || 0) * r),
        protein: Math.round((f.protein || 0) * r * 10) / 10,
        fat: Math.round((f.fat || 0) * r * 10) / 10,
        carbs: Math.round((f.carbs || 0) * r * 10) / 10,
        fiber: Math.round((f.fiber || 0) * r * 10) / 10,
        doseG,
      };
    });
}

export type { FoodItem };
