import { FOOD_DB_SUPPLEMENT } from './nutrition-database-supplement';

/**
 * ИНВАРИАНТ per100 — ЕДИНСТВЕННОЕ ПРАВИЛО КБЖУ
 * ─────────────────────────────────────────────
 * Все FoodItem хранят КБЖУ на 100 г съедобной части в ЯВНО указанном виде:
 *  - 'cooked' = готовый продукт (варёный/запечённый): рис белый 130/28/100г готового, гречка 110/20/100г готового, курица 165/31/100г готового
 *  - 'dry' = сухой/сыпучий (крупа сухая): рис сухой ~360/80/100г сухого, овсяные хлопья сухие 370/83/100г сухого
 *  - 'raw' = сырой (мясо сырое, овощи сырые): говядина сырая 215/23/100г сырого
 *  - 'powder' = порошок/концентрат: whey 400/80/100г порошка
 *  - 'liquid' = жидкость: молоко 52/3/100г (мл≈г), кефир 40/3/100г
 *  - 'as_is' = как есть (фрукт, орех): банан 89/1/100г как есть
 * servingSize — только ПОДСКАЗКА порции отображения ("1 шт (60г)", "30 г", "200 мл"), НЕ меняет per100!
 * Любой расчёт: kcal = kcal_per100 * grams/100. Никаких perServing записей.
 * При добавлении нового продукта ОБЯЗАТЕЛЬНО указывать foodState и per100 значения.
 */
export interface FoodItem {
  id: string;
  name: string;
  category: 'protein' | 'carb' | 'fat' | 'dairy' | 'veg_fruit' | 'grain' | 'supplement' | 'fast_food' | 'other';
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
  fiber: number;
  gi: number;
  servingSize: string;
  /** Вид продукта для per100: cooked/dry/raw/powder/liquid/as_is — отображается на карточке "100г готового/сухого" */
  foodState?: 'raw' | 'cooked' | 'dry' | 'powder' | 'liquid' | 'as_is';
  description?: string;
  bestFor?: string[];
  timing?: string;
  pharmaNote?: string;
  tier?: 'basic' | 'mid' | 'max';
  allergens?: string[];
  isVegetarian?: boolean;
  isVegan?: boolean;
  isGlutenFree?: boolean;
  isDairyFree?: boolean;
  dietTags?: string[];
  micros?: {
    Ca?: number; Fe?: number; Mg?: number; P?: number; K?: number; Na?: number;
    Zn?: number; Se?: number; Cu?: number; Mn?: number;
    VitA?: number; VitB1?: number; VitB2?: number; VitB3?: number; VitB5?: number; VitB6?: number; VitB9?: number; VitB12?: number;
    I?: number;
    VitC?: number; VitD?: number; VitE?: number; VitK?: number;
    Omega3?: number; Cholesterol?: number;
    OleicAcid?: number; Lycopene?: number; Leucine?: number; Isoleucine?: number; Valine?: number;
    Caffeine?: number; BetaAlanine?: number; Citrulline?: number;
    Glycine?: number; Proline?: number; Hydroxyproline?: number;
    [key: string]: number | undefined;
  };
  // ─── v2: AdvancedProductCard extension (all optional — doesn't break old code) ───
  bb_quality_score?: number;
  macro_100g?: {
    proteins_animal?: number; proteins_plant?: number;
    fats_saturated?: number; fats_monounsaturated?: number; fats_polyunsaturated?: number;
    omega_3_mg?: number; omega_6_mg?: number;
    mct_oil_g?: number; cholesterol_mg?: number;
    carbs_sugar?: number; insulin_index?: number;
  };
  amino_acid_profile_100g?: {
    leucine_mg?: number; isoleucine_mg?: number; valine_mg?: number;
    lysine_mg?: number; methionine_mg?: number;
    arginine_mg?: number; glutamine_mg?: number;
    tryptophan_mg?: number; phenylalanine_mg?: number;
    threonine_mg?: number; histidine_mg?: number; cysteine_mg?: number;
  };
  electrolytes_100g?: {
    sodium_mg?: number; potassium_mg?: number; magnesium_mg?: number;
    calcium_mg?: number; phosphorus_mg?: number; pral_index?: number;
  };
  vitamins_100g?: {
    vitamin_a_mcg?: number; vitamin_c_mg?: number; vitamin_d_mcg?: number;
    vitamin_e_mg?: number; vitamin_k_mcg?: number;
    vitamin_b1_mg?: number; vitamin_b2_mg?: number; vitamin_b3_mg?: number;
    vitamin_b5_mg?: number; vitamin_b6_mg?: number; vitamin_b7_mcg?: number;
    vitamin_b9_mcg?: number; vitamin_b12_mcg?: number;
  };
  trace_elements_100g?: {
    iron_total_mg?: number; iron_heme_mg?: number;
    zinc_mg?: number; selenium_mcg?: number;
    copper_mg?: number; manganese_mg?: number;
    iodine_mcg?: number; chromium_mcg?: number;
  };
  bioactive_compounds_100g?: {
    creatine_mg?: number; beta_alanine_mg?: number; taurine_mg?: number;
    lignan_mg?: number; indol_3_carbinol_mg?: number;
  };
  gastro_tags?: {
    fodmap_group?: 'HIGH' | 'LOW';
    enzyme_demand_score?: number;
    gastric_emptying_speed?: 'FAST' | 'MEDIUM' | 'SLOW';
    allergen_flags?: string[];
    gut_irritant_potential?: 'HIGH' | 'LOW';
  };
  metabolic_flags?: {
    atherogenic_potential?: 'HIGH' | 'LOW';
    glycation_potential?: 'HIGH' | 'LOW';
    ammonia_source_level?: 'HIGH' | 'MEDIUM' | 'LOW';
    heavy_metal_risk?: 'HIGH' | 'LOW' | 'MEDIUM';
    cns_impact?: 'STIMULANT' | 'SEDATIVE' | 'NEUTRAL';
    goitrogenic_potential?: 'HIGH' | 'LOW';
    hepatoprotective?: boolean;
    anabolic_potential?: 'HIGH' | 'MEDIUM' | 'LOW';
    detox_support_level?: 'HIGH' | 'MEDIUM' | 'LOW';
    histamine_level?: 'HIGH' | 'MEDIUM' | 'LOW';
    insulin_sensitivity_impact?: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    thyroid_support_level?: 'HIGH' | 'MEDIUM' | 'LOW';
  };
  specific_compounds_100g?: {
    polyphenols_mg?: number; flavonoids_mg?: number;
    curcumin_mg?: number; sulforaphane_mg?: number;
    resveratrol_mg?: number; lectins_mg?: number;
    oxalates_mg?: number; phytoestrogens_mg?: number;
    alpha_lipoic_acid_mg?: number; coenzyme_q10_mg?: number;
    berberine_mg?: number;
  };
}

/** Вычисляет BB Quality Score из макросов продукта (без привязки к профилю) */
export function calcBBQualityScore(f: FoodItem): number {
  let score = 5.0;
  const totalProtein = (f.macro_100g?.proteins_animal ?? 0) + (f.macro_100g?.proteins_plant ?? 0);
  if (totalProtein > 20) score += 1.0;
  const o3 = f.macro_100g?.omega_3_mg ?? f.micros?.Omega3 ?? 0;
  if (o3 > 300) score += 1.0;
  const satFat = f.macro_100g?.fats_saturated ?? 0;
  if (satFat < 5) score += 0.5;
  if (f.fiber > 4) score += 0.5;
  if (f.gi < 50 && (f.macro_100g?.insulin_index ?? 75) < 60) score += 0.5;
  if (satFat > 10) score -= 1.0;
  if (f.gi > 80) score -= 1.0;
  if (f.metabolic_flags?.atherogenic_potential === 'HIGH') score -= 1.0;
  if (f.metabolic_flags?.glycation_potential === 'LOW') score += 0.5;
  if (f.metabolic_flags?.heavy_metal_risk === 'LOW') score += 0.5;
  const leu = f.amino_acid_profile_100g?.leucine_mg ?? f.micros?.Leucine ?? 0;
  if (leu > 1500) score += 1.0;
  return Math.round(Math.max(1.0, Math.min(10.0, score)) * 10) / 10;
}

/** Композитный рейтинг качества: bb_quality_score + все метаболические флаги + аминокислоты + ЖКТ */
export function compositeQualityScore(f: FoodItem): number {
  let s = calcBBQualityScore(f);
  const mf = f.metabolic_flags || {};
  const gt = f.gastro_tags || {};
  const aa = f.amino_acid_profile_100g || {};
  const el = f.electrolytes_100g || {};
  const sc = f.specific_compounds_100g || {};
  // Метаболические флаги
  if (mf.ammonia_source_level === 'HIGH') s -= 0.5;
  if (mf.ammonia_source_level === 'MEDIUM') s -= 0.2;
  if (mf.heavy_metal_risk === 'MEDIUM') s -= 0.3;
  if (mf.cns_impact === 'SEDATIVE') s -= 0.3;
  if (mf.anabolic_potential === 'HIGH') s += 0.5;
  if (mf.anabolic_potential === 'MEDIUM') s += 0.2;
  if (mf.hepatoprotective) s += 0.5;
  if (mf.insulin_sensitivity_impact === 'POSITIVE') s += 0.5;
  if (mf.insulin_sensitivity_impact === 'NEGATIVE') s -= 0.5;
  if (mf.detox_support_level === 'HIGH') s += 0.3;
  if (mf.detox_support_level === 'MEDIUM') s += 0.1;
  if (mf.goitrogenic_potential === 'HIGH') s -= 0.3;
  if (mf.histamine_level === 'HIGH') s -= 0.3;
  if (mf.thyroid_support_level === 'HIGH') s += 0.3;
  // ЖКТ
  if (gt.gut_irritant_potential === 'HIGH') s -= 0.3;
  if ((gt.enzyme_demand_score || 0) > 7) s -= 0.2;
  if (gt.fodmap_group === 'HIGH') s -= 0.2;
  // Аминокислоты
  if ((aa.leucine_mg || 0) > 2000) s += 0.5;
  else if ((aa.leucine_mg || 0) > 1000) s += 0.2;
  if ((aa.arginine_mg || 0) > 1000) s += 0.3;
  if ((aa.glutamine_mg || 0) > 1000) s += 0.2;
  // Электролиты
  if ((el.potassium_mg || 0) > 300) s += 0.3;
  if ((el.magnesium_mg || 0) > 50) s += 0.3;
  if ((el.pral_index || 0) < -5) s += 0.2;
  // Специфические соединения
  if ((sc.polyphenols_mg || 0) > 100) s += 0.3;
  if ((sc.curcumin_mg || 0) > 10) s += 0.3;
  if ((sc.sulforaphane_mg || 0) > 5) s += 0.2;
  if ((sc.resveratrol_mg || 0) > 1) s += 0.2;
  // Ограничения
  if ((sc.oxalates_mg || 0) > 200) s -= 0.2;
  if ((sc.lectins_mg || 0) > 500) s -= 0.2;
  return Math.round(Math.max(1.0, Math.min(10.0, s)) * 10) / 10;
}

/** Заполняет v2-поля расчётными значениями на основе существующих данных */
export function enrichFoodItemV2(f: FoodItem): FoodItem {
  const m = f.micros || {};
  const isAnimal = ['protein', 'dairy'].includes(f.category);
  const isPlant = ['veg_fruit', 'grain', 'fat', 'carb'].includes(f.category);
  const isRedMeat = ['beef', 'lamb', 'pork', 'veal', 'steak', 'minced', 'liver', 'heart'].some(k => f.id.includes(k));
  const isFish = ['salmon', 'tuna', 'cod', 'pollock', 'mackerel', 'herring', 'sardines', 'trout', 'fish', 'shrimp', 'mussels'].some(k => f.id.includes(k));
  const isDairy = f.category === 'dairy';
  const isSupplement = f.category === 'supplement';
  const isBeverage = f.category === 'other' || f.id.includes('drink') || f.id.includes('juice') || f.id.includes('coffee') || f.id.includes('tea');
  const isGrain = ['rice', 'oats', 'buckwheat', 'quinoa', 'pasta', 'noodles', 'bread', 'cereal', 'flakes', 'granola', 'muesli'].some(k => f.id.includes(k));
  const isFruit = f.category === 'veg_fruit' && (f.gi > 40 || f.carbs > 8);
  const isVegetable = f.category === 'veg_fruit' && !isFruit;
  const isNut = ['almond', 'walnut', 'nut', 'seed', 'peanut', 'cashew', 'pistachio', 'hazelnut'].some(k => f.id.includes(k));
  const isLegume = ['lentil', 'chickpea', 'bean', 'peas', 'soy', 'tofu', 'tempeh'].some(k => f.id.includes(k));
  const isEgg_sup = f.id.includes('egg');
  // ─── Supplement-specific classifiers ───
  const isSuppAnimal = isSupplement && (['whey','casein','collagen','milk','beef','egg'].some(k => f.id.includes(k)) || f.name.includes('сывор') || f.name.includes('казеин'));
  const isSuppPlant = isSupplement && (['soy','pea','rice','hemp','pumpkin','sunflower','almond','walnut'].some(k => f.id.includes(k)));
  const isSuppCreatine = isSupplement && f.id.includes('creatine');
  const isSuppBCAA = isSupplement && (f.id.includes('bcaa') || f.id.includes('eaa') || f.id.includes('amino'));
  const isSuppFishOil = isSupplement && (f.id.includes('fish_oil') || f.id.includes('omega') || f.id.includes('epa') || f.id.includes('dha'));
  const hasCaffeine = m.Caffeine ? true : f.id.includes('caffeine') || f.id.includes('pre_workout');
  const hasAshwagandha = f.id.includes('ashwagandha') || f.id.includes('withania');
  const hasCordyceps = f.id.includes('cordyceps');
  const hasReishi = f.id.includes('reishi');
  const hasRhodiola = f.id.includes('rhodiola');
  const hasMilkThistle = f.id.includes('milk_thistle') || f.id.includes('silymarin');
  const hasCollagen = f.id.includes('collagen') || f.id.includes('gelatin');
  const hasProbiotics = f.id.includes('probiotic') || f.id.includes('digestive');
  const hasBetaine = f.id.includes('betaine') || f.id.includes('tmg');
  const hasHMB = f.id.includes('hmb');
  const hasCLA = f.id.includes('cla');
  const hasCarnitine = f.id.includes('carnitine');
  const hasCitrulline = f.id.includes('citrulline');
  const hasTaurine = f.id.includes('taurine');
  const hasCarnosine = f.id.includes('carnosine') || f.id.includes('beta_alanine');
  // Merge supplement type into isAnimal/isPlant for correct macro assignment
  const effectiveAnimal = isAnimal || isSuppAnimal || (isSupplement && f.protein > 15 && !isSuppPlant);
  const effectivePlant = isPlant || isSuppPlant || (isSupplement && f.id.includes('soy'));

  // saturated fat ratio by food type
  let satRatio = 0.35;
  if (isRedMeat) satRatio = 0.42;
  else if (isFish) satRatio = 0.18;
  else if (isDairy) satRatio = 0.62;
  else if (isNut) satRatio = 0.12;
  else if (isGrain) satRatio = 0.2;
  else if (isLegume) satRatio = 0.13;
  else if (f.category === 'fat') satRatio = 0.5;
  const monoRatio = 0.4;
  const polyRatio = 0.25;

  f.macro_100g = {
    proteins_animal: effectiveAnimal ? f.protein : 0,
    proteins_plant: effectivePlant ? f.protein : 0,
    fats_saturated: Math.round(f.fat * satRatio * 10) / 10,
    fats_monounsaturated: Math.round(f.fat * monoRatio * 10) / 10,
    fats_polyunsaturated: Math.round(f.fat * polyRatio * 10) / 10,
    omega_3_mg: m.Omega3 ?? (isFish || isSuppFishOil ? Math.round(f.fat * 180) : isNut ? Math.round(f.fat * 50) : hasCarnitine ? 100 : 0),
    omega_6_mg: isNut ? Math.round(f.fat * 200) : isGrain || isLegume ? Math.round(f.fat * 80) : isRedMeat ? Math.round(f.fat * 30) : 0,
    mct_oil_g: f.id.includes('coconut') || f.id.includes('mct') ? f.fat * (isSupplement ? 0.9 : 0.6) : 0,
    cholesterol_mg: m.Cholesterol ?? (effectiveAnimal && !isFish ? Math.round(f.fat * 5) : isFish ? Math.round(f.fat * 4) : isSuppFishOil ? Math.round(f.fat * 4) : 0),
    carbs_sugar: f.id.includes('sugar') || f.id.includes('syrup') || f.id.includes('honey') || f.id.includes('dextrose') || f.id.includes('maltodextrin') ? f.carbs * 0.9 : Math.round(f.carbs * (isFruit ? 0.5 : 0.08) * 10) / 10,
    insulin_index: Math.min(120, f.gi + (isDairy ? 60 : isGrain ? 5 : isSupplement ? 5 : 10)),
  };

  // Amino acid ratios: animal vs plant
  const aaFactor = isLegume ? 0.65 : isGrain ? 0.55 : effectiveAnimal || isFish ? 1.0 : isSuppBCAA ? 1.5 : hasCollagen ? 0.6 : 0.75;
  f.amino_acid_profile_100g = {
    leucine_mg: m.Leucine ?? Math.round(f.protein * 85 * aaFactor),
    isoleucine_mg: m.Isoleucine ?? Math.round(f.protein * 48 * aaFactor),
    valine_mg: m.Valine ?? Math.round(f.protein * 50 * aaFactor),
    lysine_mg: Math.round(f.protein * (isGrain ? 25 : isLegume ? 35 : isNut ? 22 : 38) * aaFactor),
    methionine_mg: Math.round(f.protein * 12 * (isLegume ? 0.5 : 1)),
    arginine_mg: Math.round(f.protein * (isNut ? 60 : 32) * aaFactor),
    glutamine_mg: Math.round(f.protein * (isGrain ? 35 : isAnimal ? 55 : 40) * aaFactor),
    tryptophan_mg: Math.round(f.protein * (isFish ? 8 : isNut ? 10 : 6) * aaFactor),
    phenylalanine_mg: Math.round(f.protein * 22 * aaFactor),
    threonine_mg: Math.round(f.protein * 23 * aaFactor),
    histidine_mg: Math.round(f.protein * 15 * aaFactor),
    cysteine_mg: Math.round(f.protein * (isLegume ? 5 : 8) * aaFactor),
  };

  f.electrolytes_100g = {
    sodium_mg: m.Na ?? (isDairy ? 300 : isFish ? 60 : isRedMeat ? 55 : isGrain ? 2 : isBeverage ? 20 : isVegetable ? 10 : 50),
    potassium_mg: m.K ?? (isFish ? 350 : isRedMeat ? 310 : isNut ? 500 : isGrain ? 150 : isVegetable ? 300 : isFruit ? 180 : isDairy ? 140 : isLegume ? 400 : 200),
    magnesium_mg: m.Mg ?? (isNut ? 200 : isGrain ? 80 : isLegume ? 80 : isFish ? 30 : isRedMeat ? 23 : isVegetable ? 25 : isDairy ? 12 : 20),
    calcium_mg: m.Ca ?? (isDairy ? 120 : isNut ? 150 : isLegume ? 50 : isFish ? 12 : isVegetable ? 40 : isRedMeat ? 10 : 15),
    phosphorus_mg: m.P ?? (isAnimal ? 200 : isGrain ? 250 : isNut ? 350 : isDairy ? 180 : isLegume ? 150 : isVegetable ? 50 : 100),
    pral_index: isRedMeat ? 8 : isFish ? 6 : isDairy ? 5 : isGrain ? 2 : isLegume ? 1 : isNut ? -2 : isVegetable ? -5 : isFruit ? -4 : -1,
  };

  f.vitamins_100g = {
    vitamin_a_mcg: m.VitA ?? (isRedMeat ? 5 : isFish ? 8 : isVegetable ? 100 : isDairy ? 60 : isFruit ? 10 : 0),
    vitamin_c_mg: m.VitC ?? (isVegetable ? 15 : isFruit ? 25 : 0),
    vitamin_d_mcg: m.VitD ?? (isFish ? 150 : isDairy ? 0.5 : isRedMeat ? 0.3 : 0),
    vitamin_e_mg: m.VitE ?? (isNut ? 15 : isVegetable ? 0.5 : isGrain ? 0.3 : 0.1),
    vitamin_k_mcg: m.VitK ?? (isVegetable ? 80 : 0),
    vitamin_b1_mg: m.VitB1 ?? (isGrain ? 0.3 : isRedMeat ? 0.08 : isLegume ? 0.2 : 0.05),
    vitamin_b2_mg: m.VitB2 ?? (isDairy ? 0.25 : isRedMeat ? 0.2 : isEgg_sup ? 0.3 : 0.1),
    vitamin_b3_mg: m.VitB3 ?? (isRedMeat ? 6 : isFish ? 8 : isGrain ? 1.5 : isLegume ? 1.2 : 0.5),
    vitamin_b5_mg: m.VitB5 ?? (isRedMeat ? 0.6 : isFish ? 0.5 : isGrain ? 0.3 : 0.2),
    vitamin_b6_mg: m.VitB6 ?? (isRedMeat ? 0.4 : isFish ? 0.5 : isGrain ? 0.1 : isLegume ? 0.15 : 0.1),
    vitamin_b7_mcg: m.VitB7 ?? (isRedMeat ? 3 : isFish ? 2 : isGrain ? 5 : 1),
    vitamin_b9_mcg: m.VitB9 ?? (isLegume ? 150 : isVegetable ? 60 : isGrain ? 25 : isRedMeat ? 6 : isFruit ? 15 : 5),
    vitamin_b12_mcg: m.VitB12 ?? (isRedMeat ? 2.5 : isFish ? 2 : isDairy ? 0.5 : 0),
  };
  
  f.trace_elements_100g = {
    iron_total_mg: m.Fe ?? (isRedMeat ? 2.5 : isFish ? 0.5 : isLegume ? 3 : isGrain ? 2 : isVegetable ? 0.8 : 0.3),
    iron_heme_mg: isAnimal ? (m.Fe ?? (isRedMeat ? 2.5 : isFish ? 0.5 : 0.3)) * 0.6 : 0,
    zinc_mg: m.Zn ?? (isRedMeat ? 4.5 : isFish ? 0.6 : isLegume ? 1.5 : isNut ? 3 : isGrain ? 1.5 : isVegetable ? 0.4 : 0.3),
    selenium_mcg: m.Se ?? (isFish ? 30 : isRedMeat ? 20 : isNut ? 10 : isGrain ? 15 : 2),
    copper_mg: m.Cu ?? (isRedMeat ? 0.1 : isNut ? 0.6 : isLegume ? 0.3 : 0.05),
    manganese_mg: m.Mn ?? (isGrain ? 2 : isLegume ? 0.8 : isVegetable ? 0.2 : 0.05),
    iodine_mcg: m.I ?? (isFish ? 50 : isDairy ? 10 : 2),
    chromium_mcg: isGrain ? 5 : isRedMeat ? 3 : isVegetable ? 2 : 0,
  };

  f.bioactive_compounds_100g = {
    creatine_mg: isSuppCreatine ? 88000 : isRedMeat ? Math.round(f.protein * 10) : isFish ? Math.round(f.protein * 5) : 0,
    beta_alanine_mg: m.BetaAlanine ?? (hasCarnosine ? 1000 : isRedMeat ? Math.round(f.protein * 3) : 0),
    taurine_mg: hasTaurine ? 1000 : isFish ? Math.round(f.protein * 2) : isRedMeat ? Math.round(f.protein * 1.5) : 0,
    lignan_mg: f.id.includes('flax') || f.id.includes('linseed') ? 300 : f.id.includes('sesame') ? 50 : f.id.includes('bread') ? 20 : 0,
    indol_3_carbinol_mg: f.id.includes('broccoli') || f.id.includes('cabbage') || f.id.includes('cauliflower') ? 45 : f.id.includes('kale') ? 35 : 0,
  };

  f.gastro_tags = {
    fodmap_group: isSupplement ? 'LOW' : (f.fiber > 3 && !isGrain) || isDairy || f.id.includes('apple') ? 'LOW' : 'HIGH',
    enzyme_demand_score: isSupplement ? 1 : isRedMeat && f.protein > 20 ? 7 : isNut ? 5 : isGrain ? 3 : isLegume ? 5 : isDairy ? 3 : isFish ? 3 : isVegetable ? 2 : 3,
    gastric_emptying_speed: isSupplement ? 'FAST' : f.fiber > 6 ? 'SLOW' : f.fat > 20 ? 'SLOW' : isGrain || isLegume ? 'SLOW' : isFish ? 'FAST' : 'MEDIUM',
    allergen_flags: f.allergens,
    gut_irritant_potential: isDairy && !isSupplement || isLegume && f.fiber > 5 ? 'HIGH' : f.gi > 70 ? 'HIGH' : isSupplement ? 'LOW' : 'LOW',
  };

  f.metabolic_flags = {
    atherogenic_potential: (f.macro_100g?.fats_saturated ?? 0) > 8 ? 'HIGH' : 'LOW',
    glycation_potential: f.gi > 70 || (f.macro_100g?.carbs_sugar ?? 0) > 10 ? 'HIGH' : f.gi > 50 ? 'HIGH' : isSupplement ? 'LOW' : 'LOW',
    ammonia_source_level: isRedMeat && f.protein > 22 ? 'HIGH' : effectiveAnimal ? 'MEDIUM' : isLegume ? 'MEDIUM' : 'LOW',
    heavy_metal_risk: isSuppFishOil && !f.id.includes('mcg') ? 'MEDIUM' : f.id.includes('tuna') || f.id.includes('mackerel') || f.id.includes('herring') || f.id.includes('shark') || f.id.includes('swordfish') ? 'MEDIUM' : 'LOW',
    cns_impact: hasCaffeine ? 'STIMULANT' : hasAshwagandha || hasRhodiola ? 'SEDATIVE' : hasCordyceps ? 'STIMULANT' : (f.amino_acid_profile_100g?.tryptophan_mg ?? 0) > 200 ? 'SEDATIVE' : 'NEUTRAL',
    goitrogenic_potential: f.id.includes('broccoli') || f.id.includes('cabbage') || f.id.includes('cauliflower') || f.id.includes('kale') ? 'HIGH' : 'LOW',
    hepatoprotective: hasMilkThistle || hasAshwagandha || hasCordyceps || hasReishi || f.id.includes('broccoli') || f.id.includes('artichoke') || f.id.includes('curcumin') || f.id.includes('liver') ? true : false,
    anabolic_potential: isSuppCreatine || hasHMB ? 'MEDIUM' : effectiveAnimal && f.protein > 22 ? 'HIGH' : effectiveAnimal && f.protein > 15 ? 'MEDIUM' : isLegume && f.protein > 10 ? 'MEDIUM' : 'LOW',
    detox_support_level: hasMilkThistle || hasAshwagandha || hasCordyceps || hasReishi || hasBetaine ? 'HIGH' : isVegetable && f.fiber > 3 ? 'MEDIUM' : 'LOW',
    histamine_level: isFish ? 'MEDIUM' : isDairy || isRedMeat ? 'MEDIUM' : 'LOW',
    insulin_sensitivity_impact: hasCLA || f.fiber > 5 ? 'POSITIVE' : f.gi > 70 ? 'NEGATIVE' : isNut ? 'POSITIVE' : 'NEUTRAL',
    thyroid_support_level: f.id.includes('thyroid') || (isFish && (f.trace_elements_100g?.iodine_mcg ?? 0) > 30) ? 'MEDIUM' : 'LOW',
  };

  f.specific_compounds_100g = {
    polyphenols_mg: hasAshwagandha ? 300 : hasCordyceps ? 200 : isFruit ? 100 : isVegetable ? 60 : isNut ? 200 : isLegume ? 80 : isGrain ? 15 : (isBeverage && (f.id.includes('coffee') || f.id.includes('tea'))) ? 200 : 0,
    flavonoids_mg: isFruit ? 40 : isVegetable ? 20 : isLegume ? 25 : isNut ? 10 : hasMilkThistle ? 500 : 0,
    curcumin_mg: f.id.includes('turmeric') || f.id.includes('curcuma') ? 100 : 0,
    sulforaphane_mg: f.id.includes('broccoli') || f.id.includes('cauliflower') || f.id.includes('cabbage') ? 45 : 0,
    resveratrol_mg: f.id.includes('grape') || f.id.includes('blueberry') || f.id.includes('peanut') || f.id.includes('pistachio') ? 5 : f.id.includes('cocoa') || f.id.includes('chocolate') ? 3 : 0,
    lectins_mg: isLegume ? 150 : isGrain ? 30 : isNut ? 10 : 0,
    oxalates_mg: f.id.includes('spinach') ? 750 : f.id.includes('beetroot') ? 600 : f.id.includes('rhubarb') ? 500 : f.id.includes('kale') ? 20 : f.id.includes('almond') ? 120 : isNut ? 30 : isLegume ? 20 : isVegetable ? 10 : 0,
    phytoestrogens_mg: f.id.includes('soy') || f.id.includes('tofu') || f.id.includes('tempeh') ? 50 : f.id.includes('flax') || f.id.includes('linseed') ? 200 : isLegume ? 5 : 0,
    alpha_lipoic_acid_mg: isRedMeat ? 3 : f.id.includes('broccoli') ? 3 : f.id.includes('spinach') ? 2 : isFish ? 1 : isEgg_sup ? 0.5 : isVegetable ? 1 : hasCarnitine ? 100 : 0,
    coenzyme_q10_mg: isRedMeat ? 3 : isFish ? 4 : isNut ? 1 : isEgg_sup ? 2 : f.id.includes('chicken') ? 1.5 : f.id.includes('broccoli') ? 0.9 : isVegetable ? 0.5 : 0,
    berberine_mg: f.id.includes('barberry') || f.id.includes('goldenseal') || f.id.includes('oregon_grape') ? 50 : 0,
  };

  f.bb_quality_score = calcBBQualityScore(f);
  return f;
}

export const FOOD_DB: FoodItem[] = [
  { id: 'chicken_breast', name: 'Куриная грудка (вареная)', category: 'protein', kcal: 165, protein: 31, fat: 3.6, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Классический базовый белок — минимум жира, максимум протеина. Идеальна для ежедневного рациона и сушки.',
    bestFor: ['maintenance', 'cut', 'recomp'], timing: 'any', pharmaNote: 'Нейтральный продукт, нет фармако-конфликтов', tier: 'basic',
    micros: { Ca: 11, Fe: 0.7, Mg: 29, P: 200, K: 256, Na: 68, Zn: 0.8, Se: 22, VitB3: 13.7, VitB6: 0.6, VitB12: 0.3 } },
  { id: 'turkey_breast', name: 'Индейка (грудка вареная)', category: 'protein', kcal: 135, protein: 29, fat: 1, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Средний уровень — больше триптофана, чем в курице, улучшает сон и восстановление. Меньше жира, богаче по аминокислотному профилю.',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'after_train', pharmaNote: 'Триптофан поддерживает серотонин — полезно при приёме ингибиторов ароматазы', tier: 'mid',
    micros: { Ca: 14, Fe: 0.5, Mg: 27, P: 220, K: 250, Na: 47, Zn: 1.1, Se: 25, VitB3: 11.8, VitB6: 0.5 } },
  { id: 'beef_lean', name: 'Говядина постная (тушеная)', category: 'protein', kcal: 200, protein: 26, fat: 10, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Максимальная категория — железо, цинк, B12, креатин. Ключевой продукт для набора массы и поддержки кроветворения.',
    bestFor: ['bulk', 'strength', 'recomp'], timing: 'lunch', pharmaNote: 'Высокое железо и B12 — компенсирует потерю от метформина', tier: 'max',
    micros: { Ca: 12, Fe: 2.6, Mg: 22, P: 210, K: 315, Na: 58, Zn: 5.5, Se: 16, VitB3: 5.4, VitB6: 0.4, VitB12: 2.5, Cholesterol: 70 } },
  { id: 'salmon', name: 'Лосось/Семга (запеченная)', category: 'protein', kcal: 208, protein: 20, fat: 13, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Максимум — Омега-3 EPA/DHA 2.5 г, витамин D 500 IU, высококачественный белок. Анти-воспаление, суставы, сердце.',
    bestFor: ['bulk', 'recomp', 'rehab'], timing: 'lunch', pharmaNote: 'Омега-3 компенсирует потерю CoQ10 от статинов и боли в суставах от анастрозола', tier: 'max',
    micros: { Ca: 12, Fe: 0.3, Mg: 30, P: 240, K: 350, Na: 56, Zn: 0.6, Se: 31, VitB3: 8.5, VitB12: 3.2, Omega3: 2.5 } },
  { id: 'tuna_canned', name: 'Тунец консервированный', category: 'protein', kcal: 116, protein: 25, fat: 1, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Средний — высокое содержание белка при минимуме жира. Удобный и доступный источник протеина.',
    bestFor: ['cut', 'maintenance'], timing: 'any', pharmaNote: 'Осторожно при повышенном уровне ртути — не более 3 раз/неделю', tier: 'mid',
    micros: { Ca: 11, Fe: 1.0, Mg: 30, P: 220, K: 220, Na: 338, Zn: 0.6, Se: 58, VitB3: 18.7, VitB6: 0.3, VitB12: 2.8 } },
  { id: 'egg_whole', name: 'Яйцо куриное целое', category: 'protein', kcal: 155, protein: 13, fat: 11, carbs: 1.1, fiber: 0, gi: 0, servingSize: '1 шт (60 г)',
    description: 'Базовый — эталонный белок (PDCAAS 1.0), лецитин, холин, витамины A/D/E. Желток содержит холестерин — сырьё для синтеза тестостерона.',
    bestFor: ['bulk', 'maintenance', 'strength'], timing: 'morning', pharmaNote: 'Холин поддерживает печень — синергия с TUDCA/NAC', tier: 'basic',
    micros: { Ca: 56, Fe: 1.8, Mg: 12, P: 198, K: 138, Na: 142, Zn: 1.1, Se: 31, VitA: 149, VitB2: 0.5, VitB12: 0.9, VitD: 2, Cholesterol: 373 } },
  { id: 'egg_white', name: 'Белок яичный', category: 'protein', kcal: 52, protein: 11, fat: 0, carbs: 0.7, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Базовый для сушки — чистый белок без жира. Идеален для увеличения протеина без калорий.',
    bestFor: ['cut', 'recomp'], timing: 'morning', pharmaNote: 'Нет фармако-конфликтов', tier: 'basic',
    micros: { Ca: 7, Fe: 0.1, Mg: 11, P: 15, K: 163, Na: 166, Zn: 0.03, Se: 13, VitB2: 0.4 } },
  { id: 'pork_tenderloin', name: 'Свиная вырезка', category: 'protein', kcal: 150, protein: 22, fat: 6, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Средний — нежирная свинина, богата тиамином (B1), цинком. Хорошая альтернатива курице.',
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'B1 поддерживает нервную систему при курсе ААС', tier: 'mid',
    micros: { Ca: 6, Fe: 0.9, Mg: 28, P: 230, K: 370, Na: 52, Zn: 2.4, Se: 33, VitB1: 0.9, VitB6: 0.5, VitB12: 0.6 } },
  { id: 'whey_protein', name: 'Протеин сывороточный', category: 'supplement', kcal: 400, protein: 80, fat: 5, carbs: 6.7, fiber: 0, gi: 15, servingSize: '30 г (1 скуп)', foodState: 'powder',
    description: 'Базовая добавка — быстрый аминокислотный пик через 30 мин. Leucine 2.5 г — триггер mTOR для синтеза мышц. per100 порошка.',
    bestFor: ['bulk', 'cut', 'recomp', 'strength'], timing: 'after_train', pharmaNote: 'Усвоение ускоряется при приёме с углеводами', tier: 'basic',
    micros: { Ca: 890, Fe: 3.3, Mg: 443, P: 1777, K: 1667, Na: 2223, Zn: 16.7, VitB2: 2.23 } },
  { id: 'casein', name: 'Казеин', category: 'supplement', kcal: 367, protein: 73.3, fat: 3.3, carbs: 10, fiber: 0, gi: 10, servingSize: '30 г', foodState: 'powder',
    description: 'Медленный белок — аминокислотный поток 6-8 часов. Защита мышц ночью, анти-катаболизм. per100 порошка.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'before_sleep', pharmaNote: 'Замедляет всасывание — избегать одновременно с препаратами, требующими быстрого действия', tier: 'mid',
    micros: { Ca: 890, Fe: 1.1, Mg: 177, P: 1890, K: 1110, Na: 1667, Zn: 4.43 } },

  { id: 'rice_white', name: 'Рис белый (вареный)', category: 'grain', kcal: 130, protein: 2.7, fat: 0.3, carbs: 28, fiber: 0.4, gi: 73, servingSize: '100 г',
    description: 'Базовый углевод — быстро усваивается, высокий GI. Идеален после тренировки для восстановления гликогена.',
    bestFor: ['bulk', 'strength'], timing: 'after_train', pharmaNote: 'Высокий GI — не рекомендуется при инсулинорезистентности и метформине', tier: 'basic',
    micros: { Ca: 10, Fe: 0.2, Mg: 12, P: 43, K: 35, Na: 1, Zn: 0.5, VitB1: 0.02, VitB3: 0.4 } },
  { id: 'rice_brown', name: 'Рис бурый/дикий', category: 'grain', kcal: 112, protein: 2.6, fat: 0.9, carbs: 23, fiber: 1.8, gi: 50, servingSize: '100 г',
    description: 'Средний — ниже GI, больше клетчатки и микроэлементов (Mg, Zn, Se). Стабильная энергия.',
    bestFor: ['maintenance', 'recomp'], timing: 'lunch', pharmaNote: 'Mg в буром рисе — дополнительный источник при дефиците от кленбутерола', tier: 'mid',
    micros: { Ca: 10, Fe: 0.4, Mg: 44, P: 150, K: 79, Na: 5, Zn: 0.6, Se: 12, VitB1: 0.19, VitB3: 2.6, VitB6: 0.15 } },
  { id: 'oats', name: 'Овсянка (на воде)', category: 'grain', kcal: 71, protein: 2.5, fat: 1.4, carbs: 12, fiber: 1.7, gi: 55, servingSize: '100 г',
    description: 'Базовый утренний углевод — β-глюкан снижает холестерин, стабилизирует сахар. Долгое насыщение.',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'morning', pharmaNote: 'β-глюкан синергичен с телмисартаном — снижение холестерина', tier: 'basic',
    micros: { Ca: 54, Fe: 4.7, Mg: 177, P: 410, K: 400, Na: 2, Zn: 3.9, Se: 34, VitB1: 0.76, VitB3: 0.9, VitB6: 0.12 } },
  { id: 'buckwheat', name: 'Гречка (вареная)', category: 'grain', kcal: 110, protein: 4.2, fat: 1.1, carbs: 20, fiber: 2.7, gi: 45, servingSize: '100 г',
    description: 'Средний — супер-крупа. Рутин укрепляет сосуды, Mg 85 мг/100 г, железо, клетчатка. Низкий GI.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'lunch', pharmaNote: 'Mg + рутин компенсируют потери калия и магния от кленбутерола', tier: 'mid',
    micros: { Ca: 18, Fe: 2.2, Mg: 85, P: 200, K: 340, Na: 1, Zn: 1.5, Se: 3, VitB1: 0.1, VitB3: 1.8, VitB6: 0.2 } },
  { id: 'quinoa', name: 'Киноа', category: 'grain', kcal: 120, protein: 4.4, fat: 1.9, carbs: 21, fiber: 2.8, gi: 53, servingSize: '100 г',
    description: 'Максимум — полный аминокислотный профиль (редкость для злаков), Fe, Mg, Mn. Суперфуд для набора.',
    bestFor: ['bulk', 'recomp'], timing: 'lunch', pharmaNote: 'Без глютена — подходит при гастрите от НПВС и пептидов BPC-157', tier: 'max',
    micros: { Ca: 17, Fe: 1.5, Mg: 64, P: 150, K: 170, Na: 1, Zn: 1.1, Se: 2, VitB1: 0.11, VitB3: 1.5, VitB6: 0.12, VitB9: 42 } },
  { id: 'bread_rye', name: 'Хлеб ржаной', category: 'grain', kcal: 214, protein: 6.5, fat: 1.2, carbs: 43, fiber: 5.5, gi: 60, servingSize: '1 ломтик (35 г)',
    description: 'Базовый — клетчатка 5.5 г/100 г, ниже GI чем пшеничный. Поддержка кишечника.',
    bestFor: ['maintenance', 'bulk'], timing: 'any', pharmaNote: 'Клетчатка замедляет всасывание — разводить по времени с препаратами', tier: 'basic',
    micros: { Ca: 22, Fe: 1.6, Mg: 44, P: 140, K: 180, Na: 430, Zn: 1.2, VitB1: 0.18 } },
  { id: 'pasta_durum', name: 'Макароны из твердых сортов', category: 'grain', kcal: 135, protein: 5, fat: 0.6, carbs: 27, fiber: 2.1, gi: 45, servingSize: '100 г',
    description: 'Средний — твердые сорта (durum) дают стабильный GI, медленную энергию. Добавка к основному рациону.',
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Умеренный GI — подходит при приёме метформина', tier: 'mid',
    micros: { Ca: 18, Fe: 1.3, Mg: 35, P: 140, K: 160, Na: 5, Zn: 0.9, VitB1: 0.09, VitB3: 1.5 } },
  { id: 'potato_boiled', name: 'Картофель отварной', category: 'carb', kcal: 82, protein: 2, fat: 0.1, carbs: 17, fiber: 1.5, gi: 65, servingSize: '1 шт (150 г)',
    description: 'Базовый — калий 420 мг/100 г (больше чем в банане!). Восстановление электролитов после тренировки.',
    bestFor: ['bulk', 'strength', 'maintenance'], timing: 'after_train', pharmaNote: 'Высокий калий — ОСТОРОЖНО при телмисартане (повышает K)', tier: 'basic',
    micros: { Ca: 12, Fe: 0.6, Mg: 22, P: 54, K: 420, Na: 5, Zn: 0.3, VitC: 20, VitB6: 0.3 } },
  { id: 'sweet_potato', name: 'Батат', category: 'carb', kcal: 86, protein: 1.6, fat: 0.1, carbs: 20, fiber: 3, gi: 44, servingSize: '100 г',
    description: 'Средний — низкий GI, β-каротин, витамин A. Лучше картофеля для сушки и стабильной энергии.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'lunch', pharmaNote: 'Низкий K в отличие от картофеля — безопасно с телмисартаном', tier: 'mid',
    micros: { Ca: 30, Fe: 0.6, Mg: 25, P: 47, K: 340, Na: 55, Zn: 0.3, VitA: 709, VitC: 2.4, VitB6: 0.2 } },
  { id: 'banana', name: 'Банан', category: 'veg_fruit', kcal: 89, protein: 1.1, fat: 0.3, carbs: 23, fiber: 2.6, gi: 51, servingSize: '1 шт (118 г)',
    description: 'Базовый — быстрый углевод + калий 358 мг. Удобный перекус до/после тренировки.',
    bestFor: ['bulk', 'strength'], timing: 'after_train', pharmaNote: 'Калий — ОСТОРОЖНО при телмисартане', tier: 'basic',
    micros: { Ca: 5, Fe: 0.3, Mg: 27, P: 22, K: 358, Na: 1, Zn: 0.2, VitB6: 0.4, VitC: 8.7 } },
  { id: 'apple', name: 'Яблоко', category: 'veg_fruit', kcal: 52, protein: 0.3, fat: 0.2, carbs: 14, fiber: 2.4, gi: 36, servingSize: '1 шт (180 г)',
    description: 'Базовый — пектин (клетчатка), низкий GI, антиоксиданты. Поддержка ЖКТ и кишечника.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'any', pharmaNote: 'Пектин помогает при гастрите от НПВС (диклофенак, мелоксикам)', tier: 'basic',
    micros: { Ca: 6, Fe: 0.1, Mg: 5, P: 11, K: 107, Na: 1, Zn: 0.04, VitC: 4.6 } },
  { id: 'berries', name: 'Ягоды (микс)', category: 'veg_fruit', kcal: 40, protein: 0.6, fat: 0.2, carbs: 9, fiber: 2.4, gi: 25, servingSize: '100 г',
    description: 'Средний — антоцианы, витамин C, антиоксиданты. Анти-воспалительный продукт номер 1.',
    bestFor: ['cut', 'maintenance', 'rehab'], timing: 'morning', pharmaNote: 'Витамин C + антиоксиданты — синергия с NAC и BPC-157 для восстановления', tier: 'mid',
    micros: { Ca: 15, Fe: 0.3, Mg: 7, P: 12, K: 80, Na: 1, Zn: 0.1, VitC: 14, VitK: 7 } },

  { id: 'olive_oil', name: 'Оливковое масло', category: 'fat', kcal: 884, protein: 0, fat: 100, carbs: 0, fiber: 0, gi: 0, servingSize: '1 ст.л. (14 г)',
    description: 'Базовый — олеиновая кислота (Омега-9), снижает LDL-холестерин и воспаление. Основа средиземноморской диеты.',
    bestFor: ['maintenance', 'cut', 'recomp', 'bulk'], timing: 'any', pharmaNote: 'Снижает ALT — защитный эффект для печени при ААС', tier: 'basic',
    micros: { Ca: 1, Fe: 0.6, Mg: 0, P: 0, K: 1, Na: 2, Zn: 0, VitE: 14.4, VitK: 60 } },
  { id: 'avocado', name: 'Авокадо', category: 'fat', kcal: 160, protein: 2, fat: 15, carbs: 9, fiber: 7, gi: 10, servingSize: '1/2 шт (70 г)',
    description: 'Средний — мононенасыщенные жиры, клетчатка 7 г/100 г, калий 485 мг, витамин E. Суперфуд для суставов и сердца.',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'lunch', pharmaNote: 'Калий 485 мг — ОСТОРОЖНО при телмисартане', tier: 'mid',
    micros: { Ca: 12, Fe: 0.5, Mg: 29, P: 52, K: 485, Na: 7, Zn: 0.6, VitB6: 0.3, VitC: 10, VitE: 2.1, VitK: 21 } },
  { id: 'nuts_mix', name: 'Орехи (грецкие/миндаль)', category: 'fat', kcal: 654, protein: 20, fat: 60, carbs: 14, fiber: 7, gi: 15, servingSize: '30 г',
    description: 'Средний — Омега-3 ALA (грецкие), витамин E (миндаль), Mg 130 мг/30 г. Перекус с пользой.',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'any', pharmaNote: 'Mg в орехах компенсирует дефицит от кленбутерола', tier: 'mid',
    micros: { Ca: 70, Fe: 2.8, Mg: 130, P: 340, K: 440, Na: 3, Zn: 2.8, Se: 3, VitB1: 0.2, VitB3: 1.6, VitE: 5, Omega3: 3 } },
  { id: 'seeds', name: 'Семена льна/чиа', category: 'fat', kcal: 534, protein: 18, fat: 31, carbs: 29, fiber: 27, gi: 1, servingSize: '1 ст.л. (10 г)',
    description: 'Максимум — Омега-3 ALA, лигнаны (фитоэстрогены), клетчатка 27 г/100 г. Супер-добавка для ЖКТ и гормонов.',
    bestFor: ['cut', 'recomp', 'rehab'], timing: 'morning', pharmaNote: 'Лигнаны мягко модулируют эстроген — полезно при анастрозоле (не конкурирует)', tier: 'max',
    micros: { Ca: 255, Fe: 5.7, Mg: 350, P: 560, K: 500, Na: 25, Zn: 5.2, Se: 25, VitB1: 1.6, VitB3: 4.5, Omega3: 18 } },
  { id: 'butter', name: 'Сливочное масло', category: 'fat', kcal: 717, protein: 0.9, fat: 81, carbs: 0.1, fiber: 0, gi: 0, servingSize: '10 г',
    description: 'Базовый — бутират (короткоцепочечные жиры), витамины A/D/E/K2. В умеренных количествах — польза для кишечника и гормонов.',
    bestFor: ['bulk', 'strength'], timing: 'morning', pharmaNote: 'Насыщенные жиры — холестерин → сырье для тестостерона (умеренно!)', tier: 'basic',
    micros: { Ca: 24, Fe: 0.02, Mg: 2, P: 24, K: 24, Na: 550, Zn: 0.05, VitA: 684, VitE: 2.3, Cholesterol: 215 } },
  { id: 'fish_oil_food', name: 'Скумбрия/Сельдь (запеченная)', category: 'fat', kcal: 262, protein: 17, fat: 20, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г',
    description: 'Максимум — Омега-3 EPA/DHA 2.5-3 г, витамин D 1000 IU, CoQ10. Главный пищевой источник Омега-3.',
    bestFor: ['bulk', 'recomp', 'rehab'], timing: 'lunch', pharmaNote: 'Омега-3 + CoQ10 = синергия при статинах и анастрозоле', tier: 'max',
    micros: { Ca: 12, Fe: 0.5, Mg: 30, P: 240, K: 350, Na: 80, Zn: 0.6, Se: 40, VitD: 25, VitB12: 8, Omega3: 2500 } },

  { id: 'cottage_cheese_5', name: 'Творог 5%', category: 'dairy', kcal: 121, protein: 18, fat: 5, carbs: 2, fiber: 0, gi: 30, servingSize: '100 г',
    description: 'Базовый — казеин 80%, медленный белок. Идеален на ночь для антикатаболизма. Кальций 120 мг.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'before_sleep', pharmaNote: 'Казеин на ночь — синергия с казеиновым протеином для защиты мышц', tier: 'basic',
    micros: { Ca: 120, Fe: 0.1, Mg: 8, P: 150, K: 80, Na: 330, Zn: 0.4, VitB2: 0.2, VitB12: 0.5 } },
  { id: 'kefir', name: 'Кефир 1%', category: 'dairy', kcal: 40, protein: 3, fat: 1, carbs: 4, fiber: 0, gi: 15, servingSize: '200 мл',
    description: 'Базовый — пробиотики, Ca, белок. Поддержка микрофлоры кишечника, улучшение пищеварения.',
    bestFor: ['cut', 'maintenance'], timing: 'morning', pharmaNote: 'Пробиотики синергичны с пребиотиками (клетчатка) — улучшают усвоение добавок', tier: 'basic',
    micros: { Ca: 130, Fe: 0.1, Mg: 12, P: 100, K: 150, Na: 50, Zn: 0.3, VitB2: 0.1, VitB12: 0.3 } },
  { id: 'yogurt_greek', name: 'Греческий йогурт 2%', category: 'dairy', kcal: 60, protein: 10, fat: 2, carbs: 3.6, fiber: 0, gi: 25, servingSize: '150 г',
    description: 'Средний — концентрированный белок, пробиотики. Лучше обычного йогурта по белку в 2-3 раза.',
    bestFor: ['cut', 'recomp', 'maintenance'], timing: 'any', pharmaNote: 'Ca + пробиотики — поддержка при длительном курсе ААС', tier: 'mid',
    micros: { Ca: 110, Fe: 0.1, Mg: 11, P: 135, K: 140, Na: 50, Zn: 0.4, VitB2: 0.3, VitB12: 0.7 } },
  { id: 'milk', name: 'Молоко 2.5%', category: 'dairy', kcal: 52, protein: 2.8, fat: 2.5, carbs: 4.7, fiber: 0, gi: 30, servingSize: '200 мл',
    description: 'Базовый — Ca 240 мг/стакан, витамин D (если обогащён), белок. Классический масс-гейнер.',
    bestFor: ['bulk', 'strength'], timing: 'morning', pharmaNote: 'Высокий инсулиновый отклик — не подходит при метформине/инсулинорезистентности', tier: 'basic',
    micros: { Ca: 120, Fe: 0.03, Mg: 11, P: 90, K: 150, Na: 50, Zn: 0.4, VitB2: 0.2, VitB12: 0.4, VitD: 1, Cholesterol: 10 } },
  { id: 'cheese_hard', name: 'Сыр твердый (Российский)', category: 'dairy', kcal: 350, protein: 24, fat: 27, carbs: 0.3, fiber: 0, gi: 0, servingSize: '30 г',
    description: 'Средний — концентрированный Ca 720 мг/100 г, белок, витамин K2 (если из травяного молока).',
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Высокий Na и насыщ. жиры — ограничить при гипертонии (телмисартан)', tier: 'mid',
    micros: { Ca: 720, Fe: 0.2, Mg: 25, P: 510, K: 80, Na: 620, Zn: 3, VitA: 200, VitB2: 0.3, Cholesterol: 90 } },

  { id: 'broccoli', name: 'Брокколи (отварная)', category: 'veg_fruit', kcal: 35, protein: 2.4, fat: 0.4, carbs: 7, fiber: 3.3, gi: 15, servingSize: '100 г',
    description: 'Базовый — сульфорафан (анти-рак), индол-3-карбинол (эстроген-метаболизм), витамин C 90 мг, Ca 47 мг.',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'any', pharmaNote: 'Индол-3-карбинол поддерживает метаболизм эстрогена — синергия с анастрозолом', tier: 'basic',
    micros: { Ca: 47, Fe: 0.7, Mg: 21, P: 66, K: 316, Na: 33, Zn: 0.4, Se: 2.5, VitC: 89, VitK: 101, VitB9: 63 } },
  { id: 'spinach', name: 'Шпинат', category: 'veg_fruit', kcal: 23, protein: 2.9, fat: 0.4, carbs: 3.6, fiber: 2.2, gi: 15, servingSize: '100 г',
    description: 'Средний — Fe 2.7 мг, Mg 79 мг, K 558 мг, фолат 194 мкг. Супер-зелень для кроветворения.',
    bestFor: ['cut', 'recomp'], timing: 'lunch', pharmaNote: 'Fe + фолат — компенсация B12/фолатного дефицита от метформина', tier: 'mid',
    micros: { Ca: 99, Fe: 2.7, Mg: 79, P: 49, K: 558, Na: 79, Zn: 0.5, Se: 1, VitA: 469, VitC: 28, VitB9: 194, VitK: 483 } },
  { id: 'cucumber', name: 'Огурец', category: 'veg_fruit', kcal: 15, protein: 0.7, fat: 0.1, carbs: 2.9, fiber: 0.5, gi: 10, servingSize: '1 шт (150 г)',
    description: 'Базовый — вода 95%, минимум калорий. Наполнение желудка, гидратация. Для сушки идеален.',
    bestFor: ['cut'], timing: 'any', pharmaNote: 'Нет фармако-конфликтов', tier: 'basic',
    micros: { Ca: 16, Fe: 0.3, Mg: 13, P: 24, K: 147, Na: 2, Zn: 0.2, VitC: 2.8, VitK: 16 } },
  { id: 'tomato', name: 'Помидор', category: 'veg_fruit', kcal: 18, protein: 0.9, fat: 0.2, carbs: 3.9, fiber: 1.2, gi: 10, servingSize: '1 шт (120 г)',
    description: 'Базовый — ликопин (антиоксидант), витамин C 14 мг, K 237 мг. Поддержка простаты.',
    bestFor: ['maintenance', 'cut'], timing: 'any', pharmaNote: 'Ликопин — синергия с пальметто для защиты простаты', tier: 'basic',
    micros: { Ca: 10, Fe: 0.3, Mg: 11, P: 24, K: 237, Na: 5, Zn: 0.2, VitC: 14, VitA: 42, VitK: 7.9 } },
  { id: 'pepper', name: 'Болгарский перец', category: 'veg_fruit', kcal: 27, protein: 1.3, fat: 0, carbs: 5.3, fiber: 2.1, gi: 15, servingSize: '1 шт (150 г)',
    description: 'Средний — витамин C 128 мг (больше цитрусовых!), β-каротин. Антиоксидантная защита.',
    bestFor: ['cut', 'maintenance'], timing: 'any', pharmaNote: 'Витамин C — синергия с NAC для антиоксидантной защиты печени', tier: 'mid',
    micros: { Ca: 7, Fe: 0.4, Mg: 12, P: 20, K: 175, Na: 4, Zn: 0.2, VitC: 128, VitA: 157, VitB6: 0.3 } },

  { id: 'shawarma', name: 'Шаурма средняя', category: 'fast_food', kcal: 550, protein: 25, fat: 22, carbs: 58, fiber: 2, gi: 65, servingSize: '1 шт (350 г)',
    description: 'Фастфуд — если нет выбора, выбирайте без соуса. Белок есть, но Na и трансжиры высокие.',
    bestFor: [], timing: 'lunch', pharmaNote: 'Трансжиры усиливают воспаление — избегать при курсе ААС', tier: 'basic',
    micros: { Na: 800, Cholesterol: 50 } },
  { id: 'pizza_margherita', name: 'Пицца Маргарита', category: 'fast_food', kcal: 240, protein: 9, fat: 8, carbs: 32, fiber: 2, gi: 70, servingSize: '1 кусок (120 г)',
    description: 'Фастфуд — рафинированная мука, высокий GI. Лишний раз — не стоит.',
    bestFor: [], timing: 'lunch', pharmaNote: 'Высокий GI + Na — усугубляет задержку воды на курсе', tier: 'basic',
    micros: { Na: 600, Cholesterol: 30 } },
  { id: 'burger', name: 'Бургер классический', category: 'fast_food', kcal: 480, protein: 22, fat: 24, carbs: 42, fiber: 1.5, gi: 68, servingSize: '1 шт (250 г)',
    description: 'Фастфуд — белок есть, но трансжиры, Na, высокий GI. Резервный вариант.',
    bestFor: [], timing: 'lunch', pharmaNote: 'Na + трансжиры — усугубляют гипертонию и дислипидемию', tier: 'basic',
    micros: { Na: 700, Cholesterol: 60 } },

  { id: 'kfc_wings', name: 'KFC Острые крылья 6 шт', category: 'fast_food', kcal: 510, protein: 36, fat: 32, carbs: 14, fiber: 0.5, gi: 55, servingSize: '6 шт (210 г)',
    description: 'Куриные крылья KFC в панировке. Высокий белок, много жира. Соус отдельно.',
    bestFor: ['bulk'], timing: 'lunch', pharmaNote: 'Панировка и трансжиры — при диете ограничить', tier: 'basic',
    micros: { Na: 1200, Cholesterol: 150 } },
  { id: 'kfc_strip', name: 'KFC Стрипсы 3 шт', category: 'fast_food', kcal: 340, protein: 26, fat: 18, carbs: 16, fiber: 0.3, gi: 60, servingSize: '3 шт (140 г)',
    description: 'Куриные стрипсы KFC. Меньше жира чем крылья, хороший источник белка.',
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: '', tier: 'mid',
    micros: { Na: 900, Cholesterol: 100 } },
  { id: 'kfc_bucket', name: 'KFC Ведро 8 крыльев', category: 'fast_food', kcal: 680, protein: 48, fat: 42, carbs: 18, fiber: 0.5, gi: 55, servingSize: '8 шт (280 г)',
    description: 'Большая порция крыльев KFC. Максимум белка среди фастфуда.',
    bestFor: ['bulk'], timing: 'lunch', pharmaNote: 'Высокий Na — контроль АД', tier: 'basic',
    micros: { Na: 1600, Cholesterol: 200 } },
  { id: 'kfc_cheese_potato', name: 'KFC Картофель с сыром', category: 'fast_food', kcal: 310, protein: 8, fat: 16, carbs: 34, fiber: 2, gi: 75, servingSize: '1 порция (200 г)',
    description: 'Картофель KFC с сырным соусом. Быстрые углеводы, мало белка.',
    bestFor: [], timing: 'snack', pharmaNote: 'Высокий GI — не до тренировки', tier: 'basic',
    micros: { Na: 500, Cholesterol: 30 } },
  { id: 'kfc_coleslaw', name: 'KFC Коул слоу', category: 'fast_food', kcal: 170, protein: 2, fat: 12, carbs: 15, fiber: 1.5, gi: 45, servingSize: '1 порция (150 г)',
    description: 'Капустный салат KFC. Минимум белка, клетчатка есть.',
    bestFor: [], timing: 'side', pharmaNote: '', tier: 'basic',
    micros: { Na: 300, Cholesterol: 10, K: 200 } },

  { id: 'mcd_big_mac', name: 'McDonald\'s Big Mac', category: 'fast_food', kcal: 540, protein: 25, fat: 30, carbs: 45, fiber: 2, gi: 68, servingSize: '1 шт (220 г)',
    description: 'Биг Мак — классика. Средний белок, много жира, булка как основной углевод.',
    bestFor: ['bulk'], timing: 'lunch', pharmaNote: 'Трансжиры, Na 1000мг — не чаще 1р/нед', tier: 'basic',
    micros: { Na: 1000, Cholesterol: 80, Ca: 100, Fe: 3 } },
  { id: 'mcd_mcnuggets', name: 'McDonald\'s Макнаггетс 6 шт', category: 'fast_food', kcal: 270, protein: 15, fat: 16, carbs: 18, fiber: 0, gi: 55, servingSize: '6 шт (120 г)',
    description: 'Куриные наггетсы. Умеренный белок, минимум углеводов.',
    bestFor: ['maintenance'], timing: 'lunch', pharmaNote: 'С соусом +150 ккал', tier: 'mid',
    micros: { Na: 600, Cholesterol: 50 } },
  { id: 'mcd_royale', name: 'McDonald\'s Royal Cheeseburger', category: 'fast_food', kcal: 620, protein: 32, fat: 36, carbs: 44, fiber: 1.5, gi: 65, servingSize: '1 шт (260 г)',
    description: 'Двойной чизбургер Royal. Высокий белок для фастфуда.',
    bestFor: ['bulk'], timing: 'lunch', pharmaNote: 'Na 1100мг — следить за водным балансом', tier: 'basic',
    micros: { Na: 1100, Cholesterol: 100, Ca: 200, Fe: 3.5 } },
  { id: 'mcd_fillet_o_fish', name: 'McDonald\'s Filet-o-Fish', category: 'fast_food', kcal: 330, protein: 16, fat: 16, carbs: 34, fiber: 1, gi: 62, servingSize: '1 шт (160 г)',
    description: 'Рыбный бургер. Меньше калорий, средний белок.',
    bestFor: ['maintenance'], timing: 'lunch', pharmaNote: '', tier: 'mid',
    micros: { Na: 700, Cholesterol: 50 } },
  { id: 'mcd_chicken_salad', name: 'McDonald\'s Гриль-салат с курицей', category: 'fast_food', kcal: 280, protein: 28, fat: 12, carbs: 14, fiber: 3, gi: 40, servingSize: '1 порция (250 г)',
    description: 'Салат с курицей-гриль. Лучший выбор по БЖУ в Макдаке.',
    bestFor: ['cut', 'maintenance'], timing: 'lunch', pharmaNote: 'Без заправки — оптимальный вариант', tier: 'mid',
    micros: { Na: 500, Cholesterol: 60, K: 400, vitA: 300 } },

  { id: 'bk_whopper', name: 'Burger King Whopper', category: 'fast_food', kcal: 660, protein: 28, fat: 40, carbs: 50, fiber: 2.5, gi: 66, servingSize: '1 шт (290 г)',
    description: 'Воппер. Самый калорийный, много жира и белка.',
    bestFor: ['bulk'], timing: 'lunch', pharmaNote: 'Na 1200мг — следить за АД', tier: 'basic',
    micros: { Na: 1200, Cholesterol: 90, Ca: 150, Fe: 4 } },
  { id: 'bk_chicken', name: 'Burger King Куриный бургер', category: 'fast_food', kcal: 400, protein: 24, fat: 18, carbs: 36, fiber: 1, gi: 62, servingSize: '1 шт (200 г)',
    description: 'Куриный бургер BK. Средний вариант по КБЖУ.',
    bestFor: ['maintenance'], timing: 'lunch', pharmaNote: '', tier: 'mid',
    micros: { Na: 800, Cholesterol: 60 } },
  { id: 'bk_nuggets', name: 'Burger King Наггетсы 8 шт', category: 'fast_food', kcal: 380, protein: 22, fat: 22, carbs: 24, fiber: 0.3, gi: 55, servingSize: '8 шт (160 г)',
    description: 'Наггетсы BK. Хороший белок, умеренные жиры.',
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: '', tier: 'mid',
    micros: { Na: 700, Cholesterol: 65 } },

  { id: 'kfc_mashed', name: 'KFC Картофельное пюре', category: 'fast_food', kcal: 120, protein: 2, fat: 4, carbs: 20, fiber: 1, gi: 70, servingSize: '1 порция (150 г)',
    description: 'Гарнир KFC. Практически одни углеводы.', bestFor: [], timing: 'side', pharmaNote: '', tier: 'basic', micros: { Na: 350, K: 250 } },

  { id: 'kfc_twister', name: 'KFC Твистер', category: 'fast_food', kcal: 450, protein: 22, fat: 22, carbs: 42, fiber: 2, gi: 62, servingSize: '1 шт (220 г)',
    description: 'Лаваш KFC с курицей и овощами. Средний белок, удобно есть на ходу.',
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Соус увеличивает калорийность — просить без соуса', tier: 'mid', micros: { Na: 900, Cholesterol: 60 } },
  { id: 'kfc_boxmaster', name: 'KFC Боксмастер', category: 'fast_food', kcal: 580, protein: 28, fat: 30, carbs: 48, fiber: 1.5, gi: 62, servingSize: '1 шт (240 г)',
    description: 'Большой лаваш KFC с курицей, сыром и беконом. Много жира.',
    bestFor: ['bulk'], timing: 'lunch', pharmaNote: 'Na 1100мг — ограничить при гипертонии', tier: 'basic', micros: { Na: 1100, Cholesterol: 80, Ca: 100 } },
  { id: 'kfc_wrap_grill', name: 'KFC Гриль-ролл', category: 'fast_food', kcal: 340, protein: 26, fat: 14, carbs: 28, fiber: 2.5, gi: 50, servingSize: '1 шт (180 г)',
    description: 'Ролл с курицей-гриль. Лучший выбор по БЖУ в KFC.',
    bestFor: ['cut', 'maintenance'], timing: 'lunch', pharmaNote: 'Оптимальный вариант в KFC', tier: 'mid', micros: { Na: 600, Cholesterol: 55 } },
  { id: 'kfc_potato_wedges', name: 'KFC Картофель по-деревенски', category: 'fast_food', kcal: 280, protein: 4, fat: 14, carbs: 35, fiber: 3, gi: 70, servingSize: '1 порция (180 г)',
    description: 'Картофель дольками с кожурой и специями. Клетчатка сохранена.',
    bestFor: [], timing: 'side', pharmaNote: '', tier: 'basic', micros: { Na: 400, K: 500, VitC: 8 } },

  { id: 'bk_chicken_fries', name: 'Burger King Куриные фри', category: 'fast_food', kcal: 320, protein: 18, fat: 20, carbs: 16, fiber: 0.5, gi: 50, servingSize: '1 порция (130 г)',
    description: 'Куриные полоски BK. Умеренный белок, удобный формат.',
    bestFor: ['maintenance'], timing: 'lunch', pharmaNote: '', tier: 'mid', micros: { Na: 650, Cholesterol: 55 } },
  { id: 'bk_long_chicken', name: 'Burger King Лонг Чикен', category: 'fast_food', kcal: 460, protein: 24, fat: 22, carbs: 42, fiber: 1.5, gi: 60, servingSize: '1 шт (200 г)',
    description: 'Удлинённый куриный бургер BK. Стандартный фастфуд-набор.',
    bestFor: ['bulk'], timing: 'lunch', pharmaNote: '', tier: 'basic', micros: { Na: 850, Cholesterol: 60 } },
  { id: 'bk_chicken_salad', name: 'Burger King Салат с курицей', category: 'fast_food', kcal: 260, protein: 24, fat: 12, carbs: 14, fiber: 3, gi: 40, servingSize: '1 порция (230 г)',
    description: 'Салат с курицей-гриль. Хороший вариант при диете.',
    bestFor: ['cut', 'maintenance'], timing: 'lunch', pharmaNote: 'Без заправки — оптимально', tier: 'mid', micros: { Na: 450, Cholesterol: 50, K: 350, VitA: 200 } },
  { id: 'bk_onion_rings', name: 'Burger King Кольца луковые', category: 'fast_food', kcal: 310, protein: 4, fat: 18, carbs: 34, fiber: 2, gi: 68, servingSize: '1 порция (140 г)',
    description: 'Луковые кольца в панировке. Минимум белка, много жира.',
    bestFor: [], timing: 'snack', pharmaNote: '', tier: 'basic', micros: { Na: 500 } },

  { id: 'vt_big_smoke', name: 'Вкусно и точка Биг Смоук', category: 'fast_food', kcal: 580, protein: 28, fat: 32, carbs: 46, fiber: 2, gi: 65, servingSize: '1 шт (250 г)',
    description: 'Аналог Big Tasty. Говяжья котлета, сыр, бекон, соус гриль.',
    bestFor: ['bulk'], timing: 'lunch', pharmaNote: 'Na 1100мг, насыщенные жиры — не чаще 1р/нед', tier: 'basic', micros: { Na: 1100, Cholesterol: 90, Ca: 150, Fe: 3.5 } },
  { id: 'vt_cheeseburger', name: 'Вкусно и точка Чизбургер', category: 'fast_food', kcal: 300, protein: 16, fat: 14, carbs: 30, fiber: 1, gi: 60, servingSize: '1 шт (160 г)',
    description: 'Классический чизбургер. Стандартный фастфуд.',
    bestFor: ['maintenance'], timing: 'lunch', pharmaNote: '', tier: 'mid', micros: { Na: 600, Cholesterol: 45, Ca: 80 } },
  { id: 'vt_chicken_burger', name: 'Вкусно и точка Чикен Бургер', category: 'fast_food', kcal: 380, protein: 22, fat: 18, carbs: 34, fiber: 1.5, gi: 58, servingSize: '1 шт (180 г)',
    description: 'Куриный бургер. Средний вариант по БЖУ, меньше жира чем говяжий.',
    bestFor: ['maintenance'], timing: 'lunch', pharmaNote: '', tier: 'mid', micros: { Na: 700, Cholesterol: 55 } },
  { id: 'vt_nuggets', name: 'Вкусно и точка Наггетсы 6 шт', category: 'fast_food', kcal: 280, protein: 16, fat: 16, carbs: 20, fiber: 0.3, gi: 55, servingSize: '6 шт (120 г)',
    description: 'Куриные наггетсы. Быстро, удобно, умеренный белок.',
    bestFor: ['maintenance', 'bulk'], timing: 'lunch', pharmaNote: '', tier: 'mid', micros: { Na: 650, Cholesterol: 50 } },
  { id: 'vt_grill_chicken', name: 'Вкусно и точка Гриль-курица', category: 'fast_food', kcal: 320, protein: 38, fat: 14, carbs: 10, fiber: 2, gi: 40, servingSize: '1 порция (200 г)',
    description: 'Куриная грудка-гриль. Отличный белок, минимум жира. Лучший выбор.',
    bestFor: ['cut', 'maintenance'], timing: 'lunch', pharmaNote: 'Лучший вариант сети для спортсмена', tier: 'max', micros: { Na: 500, Cholesterol: 85, K: 350, VitB6: 0.5 } },
  { id: 'vt_double_cheese', name: 'Вкусно и точка Двойной Чизбургер', category: 'fast_food', kcal: 440, protein: 28, fat: 24, carbs: 34, fiber: 1, gi: 62, servingSize: '1 шт (200 г)',
    description: 'Две котлеты, две порции сыра. Высокий белок для фастфуда.',
    bestFor: ['bulk'], timing: 'lunch', pharmaNote: 'Хороший вариант при наборе массы', tier: 'mid', micros: { Na: 850, Cholesterol: 90, Ca: 200, Fe: 3 } },
  { id: 'vt_caesar_salad', name: 'Вкусно и точка Цезарь', category: 'fast_food', kcal: 340, protein: 28, fat: 18, carbs: 16, fiber: 3, gi: 40, servingSize: '1 порция (280 г)',
    description: 'Салат Цезарь с курицей. Хорошая клетчатка и белок.',
    bestFor: ['cut', 'maintenance'], timing: 'lunch', pharmaNote: 'Заправку пополам — оптимально', tier: 'mid', micros: { Na: 550, Cholesterol: 60, K: 300, VitA: 150 } },
  { id: 'vt_fries', name: 'Вкусно и точка Картофель фри', category: 'fast_food', kcal: 290, protein: 3, fat: 14, carbs: 38, fiber: 3, gi: 72, servingSize: '1 порция средняя (140 г)',
    description: 'Классический картофель фри. Быстрые углеводы, мало белка.',
    bestFor: [], timing: 'snack', pharmaNote: 'Высокий GI — не до тренировки', tier: 'basic', micros: { Na: 350, K: 400 } },

  { id: 'creatine', name: 'Креатин моногидрат', category: 'supplement', kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, gi: 0, servingSize: '5 г',
    description: 'Базовая добавка — +10-15% сила, +1-2 кг масса. Насыщает фосфокреатин, ускоряет АТФ-ресинтез.',
    bestFor: ['bulk', 'strength', 'maintenance'], timing: 'after_train', pharmaNote: 'Удерживает воду в мышцах — не влияет на почки при нормальной дозе 5 г', tier: 'basic',
    micros: {} },
  { id: 'bcaa', name: 'BCAA 2:1:1', category: 'supplement', kcal: 20, protein: 5, fat: 0, carbs: 0, fiber: 0, gi: 0, servingSize: '10 г',
    description: 'Средний — лейцин (mTOR), изолейцин, валин. При достаточном белке из еды — опционально.',
    bestFor: ['cut', 'recomp'], timing: 'after_train', pharmaNote: 'При достаточном белке рационе — дублирование', tier: 'mid',
    micros: {} },
  { id: 'glutamine', name: 'Глютамин', category: 'supplement', kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, gi: 0, servingSize: '5 г',
    description: 'Средний — поддержка кишечника (энтероциты), иммунитет. При стрессе/курсе — полезен.',
    bestFor: ['rehab', 'maintenance'], timing: 'any', pharmaNote: 'Поддержка ЖКТ — синергия с BPC-157 и пробиотиками', tier: 'mid',
    micros: {} },
  { id: 'vitamin_complex', name: 'Мультивитамин', category: 'supplement', kcal: 5, protein: 0, fat: 0, carbs: 1, fiber: 0, gi: 0, servingSize: '1 табл',
    description: 'Базовый — страховка от дефицитов. Не заменяет разнообразное питание.',
    bestFor: ['maintenance', 'bulk', 'cut', 'recomp'], timing: 'morning', pharmaNote: 'Принимать с едой — усвоение жироворастворимых (A/D/E/K)', tier: 'basic',
    micros: { Ca: 100, Fe: 10, Mg: 50, Zn: 15, Se: 55, VitA: 900, VitB1: 1.5, VitB2: 1.7, VitB3: 20, VitB5: 10, VitB6: 2, VitB9: 400, VitB12: 6, VitC: 90, VitD: 15, VitE: 15 } },
  { id: 'fish_oil', name: 'Рыбий жир (Омега-3)', category: 'supplement', kcal: 90, protein: 0, fat: 10, carbs: 0, fiber: 0, gi: 0, servingSize: '1 капсула (1 г)',
    description: 'Базовая добавка — EPA/DHA 300 мг/капс. Сердце, суставы, мозг, анти-воспаление. 2-4 капс/день.',
    bestFor: ['maintenance', 'bulk', 'cut', 'recomp', 'rehab'], timing: 'any', pharmaNote: 'Синергия с анастрозолом (суставы) и статинами (CoQ10-дефицит)', tier: 'basic',
    micros: { Omega3: 1000 } },

  { id: 'chicken_thigh', name: 'Куриное бедро', category: 'protein', kcal: 209, protein: 26, fat: 15, carbs: 0, fiber: 0, gi: 0, servingSize: "150 г",
    description: 'Куриное бедро — больше жира и вкуса, чем грудка. Богаче цинком и железом, подходит для набора массы.',
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Выше цинк и железо чем в грудке', tier: 'basic',
    micros: { Fe: 1.3, Zn: 2.6, Se: 18, VitB6: 0.4, VitB12: 0.3, VitA: 12, P: 175 } },
  { id: 'shrimp', name: 'Креветки', category: 'protein', kcal: 99, protein: 24, fat: 0.3, carbs: 0.2, fiber: 0, gi: 0, servingSize: "120 г",
    bestFor: ['cut', 'recomp', 'maintenance'], timing: 'dinner', pharmaNote: 'Высокий селен, йод, низкокалорийны', tier: 'mid',
    micros: { Se: 38, Zn: 1.1, Cu: 0.3, P: 200, VitB12: 1.1, Omega3: 300 } },
  { id: 'tuna_steak', name: 'Тунец стейк', category: 'protein', kcal: 144, protein: 23, fat: 5, carbs: 0, fiber: 0, gi: 0, servingSize: "150 г",
    description: 'Стейк из тунца — высокий белок, омега-3, селен и B12. Премиальный источник протеина.',
    bestFor: ['cut', 'recomp', 'maintenance'], timing: 'dinner', pharmaNote: 'Высокое содержание B12 и селена', tier: 'max',
    micros: { Se: 46, VitB6: 0.8, VitB12: 9.0, VitD: 5, Omega3: 1500, P: 250, Mg: 30 } },
  { id: 'sardines', name: 'Сардины', category: 'protein', kcal: 208, protein: 25, fat: 11, carbs: 0, fiber: 0, gi: 0, servingSize: "100 г",
    description: 'Мелкая рыба с максимальным омега-3 (2.2 г), кальцием и B12. Цельная пища для сердечно-сосудистой системы.',
    bestFor: ['maintenance', 'bulk'], timing: 'lunch', pharmaNote: 'Омега-3, кальций, витамин D, B12', tier: 'mid',
    micros: { Omega3: 2200, Ca: 382, Se: 37, VitB12: 8.9, VitD: 5, P: 350, Na: 350 } },
  { id: 'mackerel', name: 'Скумбрия', category: 'protein', kcal: 262, protein: 24, fat: 18, carbs: 0, fiber: 0, gi: 0, servingSize: "150 г",
    bestFor: ['bulk', 'maintenance'], timing: 'dinner', pharmaNote: 'Очень высокое содержание омега-3 и B12', tier: 'mid',
    micros: { Omega3: 2600, Se: 44, VitB12: 13, VitD: 4, P: 280 } },

  { id: 'lentils', name: 'Чечевица', category: 'carb', kcal: 116, protein: 9, fat: 0.4, carbs: 20, fiber: 8, gi: 30, servingSize: "150 г",
    bestFor: ['maintenance', 'recomp', 'bulk'], timing: 'lunch', pharmaNote: 'Растительный белок, железо, фолат', tier: 'basic',
    micros: { Fe: 3.3, Mg: 47, P: 180, K: 370, Zn: 1.3, VitB6: 0.2, VitB9: 180 } },
  { id: 'chickpeas', name: 'Нут', category: 'carb', kcal: 164, protein: 8.9, fat: 2.6, carbs: 27, fiber: 8, gi: 28, servingSize: "150 г",
    bestFor: ['maintenance', 'bulk'], timing: 'lunch', pharmaNote: 'Хороший источник растительного белка', tier: 'basic',
    micros: { Fe: 2.9, Mg: 48, P: 168, K: 290, Zn: 1.5, VitB6: 0.2, VitB9: 172 } },
  { id: 'peas_green', name: 'Зелёный горошек', category: 'veg_fruit', kcal: 81, protein: 5.4, fat: 0.2, carbs: 14, fiber: 5, gi: 39, servingSize: "100 г",
    bestFor: ['maintenance', 'bulk', 'recomp'], timing: 'lunch', pharmaNote: 'Витамины K, C, B1, фолат', tier: 'basic',
    micros: { VitK: 24.8, VitC: 40, VitB1: 0.27, VitB9: 65, Fe: 1.5, Mg: 33, P: 108, Zn: 1.2 } },
  { id: 'corn', name: 'Кукуруза', category: 'carb', kcal: 86, protein: 3.3, fat: 1.4, carbs: 19, fiber: 2.7, gi: 52, servingSize: "150 г",
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Богата клетчаткой, тиамином', tier: 'basic',
    micros: { VitB1: 0.2, Mg: 37, P: 89, K: 270, VitC: 7, Fe: 0.5 } },
  { id: 'grapefruit', name: 'Грейпфрут', category: 'veg_fruit', kcal: 42, protein: 0.8, fat: 0.1, carbs: 11, fiber: 1.6, gi: 25, servingSize: "200 г",
    bestFor: ['cut', 'recomp'], timing: 'snack', pharmaNote: 'Низкий ГИ, витамин C, нарингин', tier: 'basic',
    micros: { VitC: 31, VitA: 3, K: 135, VitB1: 0.04 } },
  { id: 'pear', name: 'Груша', category: 'veg_fruit', kcal: 57, protein: 0.4, fat: 0.1, carbs: 15, fiber: 3.1, gi: 38, servingSize: "180 г",
    bestFor: ['maintenance', 'cut'], timing: 'snack', pharmaNote: 'Пектин, антиоксиданты', tier: 'basic',
    micros: { VitC: 4, K: 116, Cu: 0.1, VitK: 4.4 } },

  { id: 'cabbage', name: 'Капуста белокочанная', category: 'veg_fruit', kcal: 25, protein: 1.3, fat: 0.1, carbs: 6, fiber: 2.5, gi: 10, servingSize: "200 г",
    bestFor: ['cut', 'recomp', 'maintenance'], timing: 'lunch', pharmaNote: 'Витамин C, K, сульфорафан', tier: 'basic',
    micros: { VitC: 37, VitK: 76, VitB6: 0.1, Mn: 0.16, Fe: 0.5 } },
  { id: 'carrot', name: 'Морковь', category: 'veg_fruit', kcal: 41, protein: 0.9, fat: 0.2, carbs: 10, fiber: 2.8, gi: 39, servingSize: "150 г",
    bestFor: ['maintenance', 'cut'], timing: 'any', pharmaNote: 'Бета-каротин, витамин A', tier: 'basic',
    micros: { VitA: 835, VitC: 6, VitK: 13.2, K: 320 } },
  { id: 'zucchini', name: 'Кабачок', category: 'veg_fruit', kcal: 17, protein: 1.2, fat: 0.3, carbs: 3.1, fiber: 1, gi: 15, servingSize: "200 г",
    bestFor: ['cut', 'recomp'], timing: 'lunch', pharmaNote: 'Очень низкокалорийный, калий', tier: 'basic',
    micros: { VitC: 18, K: 260, VitA: 10, Mg: 18 } },
  { id: 'eggplant', name: 'Баклажан', category: 'veg_fruit', kcal: 25, protein: 1, fat: 0.2, carbs: 6, fiber: 3, gi: 20, servingSize: "200 г",
    bestFor: ['cut', 'maintenance'], timing: 'lunch', pharmaNote: 'Антоцианы, назунин', tier: 'basic',
    micros: { VitC: 2, K: 230, Mg: 14, Mn: 0.23 } },

  { id: 'kefir_2', name: 'Кефир 2%', category: 'dairy', kcal: 51, protein: 3.4, fat: 2, carbs: 4, fiber: 0, gi: 15, servingSize: "250 г",
    bestFor: ['maintenance', 'recomp', 'cut'], timing: 'any', pharmaNote: 'Пробиотики, кальций, белок', tier: 'basic',
    micros: { Ca: 120, P: 95, VitB2: 0.13, VitB12: 0.4, K: 135 } },
  { id: 'yogurt_natural', name: 'Йогурт натуральный', category: 'dairy', kcal: 60, protein: 4, fat: 1.5, carbs: 7, fiber: 0, gi: 15, servingSize: "200 г",
    bestFor: ['maintenance', 'cut', 'recomp'], timing: 'snack', pharmaNote: 'Пробиотики', tier: 'basic',
    micros: { Ca: 140, P: 100, VitB2: 0.17, VitB12: 0.5 } },
  { id: 'ryazhenka', name: 'Ряженка', category: 'dairy', kcal: 66, protein: 3, fat: 3.2, carbs: 4.1, fiber: 0, gi: 15, servingSize: "250 г",
    bestFor: ['maintenance', 'bulk'], timing: 'any', pharmaNote: 'Пробиотики, легкоусвояемый белок', tier: 'basic',
    micros: { Ca: 130, P: 90, VitA: 25, VitB2: 0.14 } },
  { id: 'sour_cream_15', name: 'Сметана 15%', category: 'dairy', kcal: 160, protein: 2.6, fat: 15, carbs: 3.6, fiber: 0, gi: 15, servingSize: "50 г",
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Витамин A, D, E, K2', tier: 'basic',
    micros: { Ca: 85, VitA: 55, VitD: 0.5, VitE: 0.6 } },
  { id: 'whey_isolate', name: 'Изолят сывороточного белка', category: 'supplement', kcal: 380, protein: 88, fat: 1, carbs: 1, fiber: 0, gi: 0, servingSize: "30 г",
    description: 'Чистый белок 88% — минимум жира и углеводов. Быстрая абсорбция, идеален для сушки и восстановления.',
    bestFor: ['cut', 'recomp', 'bulk', 'maintenance', 'strength'], timing: 'post', pharmaNote: 'Быстрая абсорбция, высокая биодоступность', tier: 'mid',
    micros: { Ca: 500, P: 300, Mg: 30, Na: 300 } },

  { id: 'almonds', name: 'Миндаль', category: 'fat', kcal: 579, protein: 21, fat: 50, carbs: 22, fiber: 12, gi: 15, servingSize: "30 г",
    bestFor: ['maintenance', 'bulk', 'recomp'], timing: 'snack', pharmaNote: 'Витамин E, Mg, мононенасыщенные жиры', tier: 'mid',
    micros: { VitE: 25, Mg: 270, Ca: 269, P: 481, Fe: 3.7, Mn: 2.2, Zn: 3.1 } },
  { id: 'walnuts', name: 'Грецкие орехи', category: 'fat', kcal: 654, protein: 15, fat: 65, carbs: 14, fiber: 6.7, gi: 15, servingSize: "30 г",
    bestFor: ['maintenance', 'bulk'], timing: 'snack', pharmaNote: 'Омега-3 ALA, антиоксиданты', tier: 'mid',
    micros: { Omega3: 9000, Mg: 158, P: 346, Cu: 1.6, Mn: 3.4, VitE: 0.7, Zn: 3.1 } },
  { id: 'peanut_butter', name: 'Арахисовая паста', category: 'fat', kcal: 588, protein: 25, fat: 50, carbs: 20, fiber: 6, gi: 13, servingSize: "30 г",
    description: 'Высококалорийная паста — белок 25 г, мононенасыщенные жиры. Удобный источник калорий на массонаборе.',
    bestFor: ['bulk', 'maintenance'], timing: 'snack', pharmaNote: 'Высококалорийная, мононенасыщенные жиры', tier: 'basic',
    micros: { VitE: 9, Mg: 170, P: 340, Zn: 3.3, VitB3: 13, Fe: 1.7 } },
  { id: 'sunflower_seeds', name: 'Семена подсолнечника', category: 'fat', kcal: 584, protein: 21, fat: 51, carbs: 20, fiber: 8.6, gi: 35, servingSize: "30 г",
    bestFor: ['bulk', 'maintenance'], timing: 'snack', pharmaNote: 'Витамин E, селен, магний', tier: 'mid',
    micros: { VitE: 35, Se: 53, Mg: 330, P: 660, Zn: 5.3, VitB1: 1.5, Cu: 1.8 } },
  { id: 'flaxseed', name: 'Семена льна', category: 'fat', kcal: 534, protein: 18, fat: 42, carbs: 29, fiber: 27, gi: 15, servingSize: "20 г",
    description: 'Омега-3 ALA 22.8 г/100г, лигнаны, растворимая клетчатка 27 г. Поддержка гормонального фона и ЖКТ.',
    bestFor: ['maintenance', 'cut', 'recomp'], timing: 'any', pharmaNote: 'Омега-3 ALA, лигнаны', tier: 'mid',
    micros: { Omega3: 22800, Mg: 392, P: 642, Mn: 2.5, VitB1: 1.6, Fe: 5.7, Cu: 1.2 } },
  { id: 'dark_chocolate', name: 'Тёмный шоколад 85%', category: 'fat', kcal: 598, protein: 10, fat: 47, carbs: 30, fiber: 13, gi: 20, servingSize: "25 г",
    bestFor: ['maintenance'], timing: 'snack', pharmaNote: 'Флавоноиды, Fe, Mg, цинк', tier: 'mid',
    micros: { Fe: 12, Mg: 230, Cu: 2.5, Mn: 2.1, Zn: 3.3, P: 310, K: 700 } },

  { id: 'tofu', name: 'Тофу', category: 'protein', kcal: 76, protein: 8, fat: 4.8, carbs: 1.9, fiber: 0.3, gi: 15, servingSize: "150 г",
    bestFor: ['cut', 'recomp', 'maintenance'], timing: 'lunch', pharmaNote: 'Растительный белок, изофлавоны, Ca', tier: 'mid',
    micros: { Ca: 350, Fe: 5.4, Mg: 30, P: 120, Zn: 0.8 } },
  { id: 'tempeh', name: 'Темпе', category: 'protein', kcal: 192, protein: 19, fat: 11, carbs: 7.6, fiber: 0, gi: 15, servingSize: "100 г",
    bestFor: ['maintenance', 'recomp', 'bulk'], timing: 'lunch', pharmaNote: 'Ферментированный соевый белок, витамин K2', tier: 'max',
    micros: { Ca: 111, Fe: 2.7, Mg: 81, P: 260, VitB2: 0.1, Zn: 1.1 } },
  { id: 'seitan', name: 'Сейтан (пшеничный белок)', category: 'protein', kcal: 141, protein: 75, fat: 1.9, carbs: 14, fiber: 0.8, gi: 0, servingSize: "100 г",
    bestFor: ['bulk', 'recomp'], timing: 'lunch', pharmaNote: 'Высокое содержание белка, без лактозы', tier: 'max',
    micros: { Fe: 5.2, P: 50, Se: 27, Zn: 0.6 } },

  { id: 'beetroot', name: 'Свёкла', category: 'veg_fruit', kcal: 43, protein: 1.6, fat: 0.2, carbs: 10, fiber: 2.8, gi: 61, servingSize: "200 г",
    bestFor: ['maintenance', 'recomp'], timing: 'lunch', pharmaNote: 'Нитраты → NO, улучшает кровоток', tier: 'mid',
    micros: { VitC: 5, K: 325, Fe: 0.8, Mn: 0.3, Mg: 23 } },
  { id: 'celery', name: 'Сельдерей', category: 'veg_fruit', kcal: 16, protein: 0.7, fat: 0.2, carbs: 3, fiber: 1.6, gi: 15, servingSize: "200 г",
    bestFor: ['cut', 'recomp'], timing: 'any', pharmaNote: 'Мочегонное, калий, флавоноиды', tier: 'basic',
    micros: { VitK: 29, K: 260, VitA: 22, VitC: 3 } },
  { id: 'green_bean', name: 'Стручковая фасоль', category: 'veg_fruit', kcal: 31, protein: 1.8, fat: 0.2, carbs: 7, fiber: 2.7, gi: 15, servingSize: "150 г",
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'lunch', pharmaNote: 'Клетчатка, витамин C, K', tier: 'basic',
    micros: { VitC: 12, VitK: 43, Fe: 1, Mg: 25, K: 210, Mn: 0.2 } },
  { id: 'asparagus', name: 'Спаржа', category: 'veg_fruit', kcal: 20, protein: 2.2, fat: 0.1, carbs: 3.9, fiber: 2.1, gi: 15, servingSize: "150 г",
    bestFor: ['cut', 'recomp'], timing: 'dinner', pharmaNote: 'Фолат, витамин K, мочегонное', tier: 'max',
    micros: { VitK: 50, VitB9: 52, VitC: 6, VitE: 1.1, Fe: 0.6, K: 200 } },
  { id: 'mushrooms', name: 'Шампиньоны', category: 'veg_fruit', kcal: 22, protein: 3.1, fat: 0.3, carbs: 3.3, fiber: 1, gi: 10, servingSize: "150 г",
    bestFor: ['cut', 'recomp', 'maintenance'], timing: 'lunch', pharmaNote: 'Витамин D (при UV-обработке), селен', tier: 'basic',
    micros: { Se: 8, VitB2: 0.3, VitB3: 3.5, VitD: 0.2, Cu: 0.4, Zn: 0.5 } },
  { id: 'seaweed_nori', name: 'Нори (морские водоросли)', category: 'veg_fruit', kcal: 35, protein: 5.8, fat: 0.3, carbs: 5.1, fiber: 0.3, gi: 10, servingSize: "10 г",
    bestFor: ['maintenance', 'recomp'], timing: 'any', pharmaNote: 'Йод, витамин B12, железо', tier: 'mid',
    micros: { Fe: 1.8, VitA: 127, VitC: 4, VitB12: 1.4, Zn: 1.1, Mn: 0.3 } },

  { id: 'watermelon', name: 'Арбуз', category: 'veg_fruit', kcal: 30, protein: 0.6, fat: 0.2, carbs: 8, fiber: 0.4, gi: 76, servingSize: "300 г",
    bestFor: ['maintenance'], timing: 'snack', pharmaNote: 'Цитруллин → аргинин, NO-продукция', tier: 'basic',
    micros: { VitC: 8, VitA: 28, K: 112, Mg: 10 } },
  { id: 'pineapple', name: 'Ананас', category: 'veg_fruit', kcal: 50, protein: 0.5, fat: 0.1, carbs: 13, fiber: 1.4, gi: 59, servingSize: "150 г",
    bestFor: ['maintenance', 'bulk'], timing: 'post', pharmaNote: 'Бромелайн (противовоспалительное)', tier: 'basic',
    micros: { VitC: 48, Mn: 1.0, VitB1: 0.08, VitB6: 0.1, Cu: 0.1, Mg: 12 } },
  { id: 'kiwi', name: 'Киви', category: 'veg_fruit', kcal: 61, protein: 1.1, fat: 0.5, carbs: 15, fiber: 3, gi: 39, servingSize: "100 г",
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'snack', pharmaNote: 'Витамин C > апельсина, клетчатка', tier: 'basic',
    micros: { VitC: 93, VitK: 40, VitE: 1.5, K: 312, VitB9: 25 } },
  { id: 'pomegranate', name: 'Гранат', category: 'veg_fruit', kcal: 83, protein: 1.7, fat: 1.2, carbs: 19, fiber: 4, gi: 35, servingSize: "150 г",
    bestFor: ['maintenance', 'recomp'], timing: 'snack', pharmaNote: 'Антиоксиданты, пуниковая кислота', tier: 'mid',
    micros: { VitC: 10, VitK: 16, K: 236, Fe: 0.3, VitB9: 38 } },

  { id: 'rice_noodles', name: 'Рисовая лапша', category: 'carb', kcal: 364, protein: 0.6, fat: 0.1, carbs: 82, fiber: 0.5, gi: 53, servingSize: "100 г",
    description: 'Быстрые углеводы без глютена — низкий ГИ 53. Удобный гарнир для предтренировочного приёма.',
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Быстрые углеводы, низкий ГИ', tier: 'basic',
    micros: { Fe: 0.2, Mg: 4, P: 7 } },
  { id: 'tortilla_wheat', name: 'Тортилья пшеничная', category: 'carb', kcal: 312, protein: 8, fat: 8, carbs: 50, fiber: 3, gi: 30, servingSize: "60 г",
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Удобный формат, средний ГИ', tier: 'basic',
    micros: { Fe: 2.5, VitB1: 0.3, VitB9: 30, Mg: 20, P: 110, Na: 400 } },
  { id: 'granola', name: 'Гранола', category: 'carb', kcal: 471, protein: 10, fat: 20, carbs: 64, fiber: 6, gi: 55, servingSize: "50 г",
    bestFor: ['bulk'], timing: 'breakfast', pharmaNote: 'Овсяная основа + орехи, высококалорийная', tier: 'mid',
    micros: { Fe: 3, Mg: 75, P: 230, Zn: 2, VitE: 3, Se: 12 } },
  { id: 'dried_apricots', name: 'Курага', category: 'carb', kcal: 241, protein: 3.4, fat: 0.4, carbs: 63, fiber: 7, gi: 30, servingSize: "40 г",
    bestFor: ['bulk', 'maintenance'], timing: 'snack', pharmaNote: 'Калий, железо, бета-каротин', tier: 'basic',
    micros: { K: 1162, Fe: 2.7, VitA: 127, Mg: 32, P: 67, VitB3: 2.6 } },

  { id: 'protein_bar', name: 'Протеиновый батончик', category: 'supplement', kcal: 350, protein: 30, fat: 15, carbs: 28, fiber: 3, gi: 40, servingSize: "60 г",
    bestFor: ['maintenance', 'recomp', 'cut'], timing: 'snack', pharmaNote: 'Удобный перекус, быстрый белок', tier: 'mid',
    micros: { Ca: 52, Fe: 0.3, Mg: 37, P: 205, K: 259, Na: 111, Zn: 1.1, Se: 38, VitB12: 1.1, VitE: 1.3 } },
  { id: 'greek_yogurt', name: 'Греческий йогурт (2%)', category: 'dairy', kcal: 59, protein: 10, fat: 2, carbs: 3.6, fiber: 0, gi: 20, servingSize: '100 г',
    bestFor: ['maintenance', 'recomp', 'cut'], timing: 'any', pharmaNote: 'Пробиотики + белок — поддержка кишечника и восстановление', tier: 'mid',
    micros: { Ca: 38, Fe: 0.7, Mg: 27, P: 54, K: 475, Na: 36, Zn: 0.3, Se: 0.6, VitA: 961, VitC: 2.4 } },
  { id: 'blueberries', name: 'Черника', category: 'veg_fruit', kcal: 57, protein: 0.7, fat: 0.3, carbs: 14, fiber: 2.4, gi: 53, servingSize: '100 г',
    bestFor: ['cut', 'maintenance', 'rehab'], timing: 'any', pharmaNote: 'Антоцианы — мощнейший антиоксидант, нейропротекция', tier: 'max',
    micros: { Ca: 6, Fe: 0.3, Mg: 6, P: 12, K: 77, Na: 1, Zn: 0.2, Se: 0.1, VitC: 10, VitK: 19 } },
  { id: 'chia_seeds', name: 'Семена чиа', category: 'fat', kcal: 486, protein: 17, fat: 31, carbs: 42, fiber: 34, gi: 0, servingSize: '30 г',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'morning', pharmaNote: 'Омега-3 ALA + 34г клетчатки на 100г — суперфуд', tier: 'max',
    micros: { Ca: 16, Fe: 0.8, Mg: 23, P: 40, K: 325, Na: 78, Zn: 0.4, Se: 0.7, VitC: 5, VitB9: 80 } },
  { id: 'kale', name: 'Кейл (листовая капуста)', category: 'veg_fruit', kcal: 35, protein: 2.9, fat: 0.6, carbs: 6, fiber: 3.6, gi: 5, servingSize: '100 г',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'any', pharmaNote: 'Витамин K 390 мкг — коагуляция + костный метаболизм', tier: 'max',
    micros: { Ca: 269, Fe: 3.7, Mg: 270, P: 481, K: 733, Na: 1, Zn: 3.1, Se: 4.1, VitE: 25.6, VitB2: 1.1, VitB9: 50 } },
  { id: 'hemp_seeds', name: 'Семена конопли', category: 'fat', kcal: 553, protein: 31, fat: 49, carbs: 8, fiber: 4, gi: 0, servingSize: '30 г',
    bestFor: ['bulk', 'maintenance', 'recomp'], timing: 'any', pharmaNote: 'Омега-3:Омега-6 = 1:3 — идеальный баланс. Полноценный белок.', tier: 'max',
    micros: { Ca: 260, Fe: 1.8, Mg: 200, P: 210, K: 300, Na: 890, Zn: 1.2, Se: 0.7, VitA: 3920, VitC: 39, VitK: 10 } },
  { id: 'turmeric', name: 'Куркума (порошок)', category: 'supplement', kcal: 312, protein: 10, fat: 3.3, carbs: 67, fiber: 23, gi: 0, servingSize: '3 г (1 ч.л.)',
    bestFor: ['rehab', 'maintenance', 'recomp'], timing: 'any', pharmaNote: 'Куркумин — мощный противовоспалительный. Биодоступность + пиперин x10', tier: 'max',
    micros: { Ca: 183, Fe: 41.4, Mg: 193, P: 268, K: 2083, Na: 27, Zn: 4.3, Se: 4.5, VitC: 26, VitB6: 1.8, VitE: 3.1 } },
  { id: 'bone_broth', name: 'Костный бульон', category: 'protein', kcal: 15, protein: 3, fat: 0.5, carbs: 0.5, fiber: 0, gi: 0, servingSize: '250 мл',
    bestFor: ['rehab', 'maintenance', 'cut'], timing: 'any', pharmaNote: 'Коллаген + гиалуроновая кислота — суставы, связки, ЖКТ', tier: 'mid',
    micros: { Ca: 7, Fe: 0.2, Mg: 10, P: 11, K: 112, Na: 1, Se: 0.1, VitC: 8.1, VitA: 28 } },
  { id: 'edamame', name: 'Эдамаме (варёные)', category: 'veg_fruit', kcal: 121, protein: 12, fat: 5, carbs: 9, fiber: 5, gi: 25, servingSize: '100 г',
    bestFor: ['cut', 'maintenance', 'recomp'], timing: 'snack', pharmaNote: 'Фолат + железо + белок — поддержка кроветворения', tier: 'mid',
    micros: { Ca: 63, Fe: 2.3, Mg: 64, P: 169, K: 436, Na: 6, Zn: 1.0, Se: 1.5, VitB9: 311, VitK: 26 } },
  { id: 'feta_cheese', name: 'Сыр фета', category: 'dairy', kcal: 264, protein: 14, fat: 21, carbs: 4, fiber: 0, gi: 0, servingSize: '30 г',
    bestFor: ['bulk', 'maintenance'], timing: 'lunch', pharmaNote: 'Ca 360 мг/100г — но высок Na. Умеренное потребление.', tier: 'mid',
    micros: { Ca: 360, Fe: 0.3, Mg: 20, P: 280, K: 95, Na: 980, Zn: 2.0, Se: 15, VitB2: 0.4, VitB12: 1.1 } },
  { id: 'coffee_espresso', name: 'Кофе эспрессо', category: 'other', kcal: 2, protein: 0.1, fat: 0, carbs: 0, fiber: 0, gi: 0, servingSize: '30 мл',
    bestFor: ['cut', 'strength', 'maintenance'], timing: 'morning', pharmaNote: 'Кофеин — стимулянт ЦНС, эргогенный эффект. Антиоксидант.', tier: 'basic',
    micros: { Mg: 24, P: 2, K: 51, Na: 14 } },
  { id: 'green_tea', name: 'Зелёный чай', category: 'other', kcal: 1, protein: 0.2, fat: 0, carbs: 0.2, fiber: 0, gi: 0, servingSize: '200 мл',
    bestFor: ['cut', 'maintenance', 'rehab'], timing: 'any', pharmaNote: 'EGCG — антиоксидант, термогенный. Ингибирует COMT.', tier: 'mid',
    micros: { Ca: 2, Mg: 2, P: 1, K: 9, Na: 1, Fe: 0 } },
  // === User-specified nutrition items ===
  { id: 'beef_minced', name: 'Фарш говяжий', category: 'protein', kcal: 190, protein: 17, fat: 12, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г', description: 'Говяжий фарш до 10% жирности', tier: 'mid', allergens: [], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: [], micros: { Ca: 12, Fe: 2.3, Mg: 20, P: 180, K: 290, Na: 70, Zn: 4.8, Se: 14, VitB3: 5, VitB6: 0.35, VitB12: 2.2, Cholesterol: 75 } },
  { id: 'red_fish', name: 'Красная рыба', category: 'protein', kcal: 200, protein: 20, fat: 13, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г', description: 'Лосось/форель/семга. Не чаще 2р/нед', tier: 'max', allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['omega3'], micros: { Ca: 14, Fe: 0.4, Mg: 28, P: 230, K: 360, Na: 55, Zn: 0.5, Se: 28, VitB3: 7.5, VitB12: 3, VitD: 8, Omega3: 1800, Cholesterol: 55 } },
  { id: 'white_fish_cod', name: 'Треска', category: 'protein', kcal: 82, protein: 18, fat: 1, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г', description: 'Белая рыба, обезжиренный белок', tier: 'basic', allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: [], micros: { Ca: 10, Fe: 0.3, Mg: 25, P: 190, K: 360, Na: 75, Zn: 0.4, Se: 30, VitB3: 2, VitB12: 0.9, VitD: 0.9, Omega3: 200, Cholesterol: 45 } },
  { id: 'white_fish_halibut', name: 'Палтус', category: 'protein', kcal: 110, protein: 21, fat: 3, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г', description: 'Белая рыба, плотная', tier: 'mid', allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: [], micros: { Ca: 11, Fe: 0.3, Mg: 28, P: 210, K: 380, Na: 60, Zn: 0.4, Se: 35, VitB3: 4, VitB12: 1.2, VitD: 5, Omega3: 500, Cholesterol: 50 } },
  { id: 'white_fish_mintai', name: 'Минтай', category: 'protein', kcal: 72, protein: 16, fat: 1, carbs: 0, fiber: 0, gi: 0, servingSize: '100 г', description: 'Белая рыба, бюджетный вариант', tier: 'basic', allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: [], micros: { Ca: 15, Fe: 0.3, Mg: 30, P: 190, K: 340, Na: 80, Zn: 0.4, Se: 27, VitB3: 1.8, VitB12: 0.8, I: 50, Omega3: 300, Cholesterol: 40 } },
  { id: 'coconut_oil', name: 'Кокосовое масло', category: 'fat', kcal: 862, protein: 0, fat: 99, carbs: 0, fiber: 0, gi: 0, servingSize: '15 мл', description: 'MCT-жиры, быстрая энергия', tier: 'mid', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [], micros: { Ca: 1, Fe: 0.05, Mg: 0, P: 0, K: 0, Na: 0, Zn: 0, Se: 0, VitE: 0.1, VitK: 0.5 } },
  { id: 'coconut_urbec', name: 'Кокосовый урбеч', category: 'fat', kcal: 570, protein: 13, fat: 45, carbs: 27, fiber: 10, gi: 35, servingSize: '30 г', description: 'Паста из кокоса, MCT + клетчатка', tier: 'mid', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [], micros: { Ca: 15, Fe: 2.4, Mg: 50, P: 140, K: 400, Na: 20, Zn: 1.2, Se: 5, VitB1: 0.06, VitB3: 0.8, VitE: 0.5 } },
  { id: 'red_caviar', name: 'Красная икра', category: 'fat', kcal: 250, protein: 30, fat: 14, carbs: 1, fiber: 0, gi: 0, servingSize: '30 г', description: 'Омега-3, витамин D, B12', tier: 'max', allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['omega3'], micros: { Ca: 30, Fe: 2.5, Mg: 35, P: 300, K: 180, Na: 2200, Zn: 1, Se: 45, VitB12: 10, VitD: 6, VitE: 3, Omega3: 2000, Cholesterol: 250 } },
  { id: 'cream_of_rice', name: 'Cream of Rice', category: 'carb', kcal: 380, protein: 7, fat: 1, carbs: 82, fiber: 1, gi: 80, servingSize: '50 г', description: 'Рисовая каша, быстрые углеводы', tier: 'basic', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [], micros: { Ca: 5, Fe: 0.3, Mg: 10, P: 40, K: 30, Na: 1, Zn: 0.4, Se: 4, VitB1: 0.02, VitB3: 0.3 } },
  { id: 'whole_grain_bread', name: 'Хлеб цельнозерновой', category: 'carb', kcal: 250, protein: 9, fat: 3, carbs: 47, fiber: 7, gi: 50, servingSize: '40г', description: 'Сложные углеводы + клетчатка', bestFor: ['maintenance', 'bulk', 'recomp'], tier: 'mid', allergens: ['gluten'], isVegetarian: true, isVegan: true, isGlutenFree: false, isDairyFree: true, dietTags: [], micros: { Ca: 70, Fe: 2.5, Mg: 60, P: 170, K: 200, Na: 450, Zn: 1.5, Se: 20, VitB1: 0.2, VitB3: 3, VitB6: 0.15, VitE: 0.4 } },
  { id: 'corn_flakes', name: 'Кукурузные хлопья', category: 'carb', kcal: 360, protein: 7, fat: 1, carbs: 80, fiber: 3, gi: 80, servingSize: '30 г', description: 'Ограниченно. Без пшеницы', tier: 'mid', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['limited'], micros: { Ca: 3, Fe: 2, Mg: 10, P: 30, K: 70, Na: 600, Zn: 0.3, Se: 3, VitB1: 0.05, VitB3: 0.5, VitB6: 0.02, VitE: 0.1 } },
  { id: 'citrus', name: 'Цитрусовые', category: 'veg_fruit', kcal: 40, protein: 1, fat: 0, carbs: 10, fiber: 2, gi: 40, servingSize: '150г', description: 'Ограниченно. Витамин C', tier: 'mid', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['limited'], micros: { Ca: 40, Fe: 0.1, Mg: 10, P: 20, K: 160, Na: 2, Zn: 0.07, Se: 0.5, VitC: 50, VitA: 10, VitB9: 25, VitB1: 0.05 } },
  { id: 'green_apple', name: 'Зелёное яблоко', category: 'veg_fruit', kcal: 52, protein: 0, fat: 0, carbs: 14, fiber: 2, gi: 35, servingSize: '180г', description: 'Ограниченно. Низкий ГИ, пектин', tier: 'mid', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['limited'], micros: { Ca: 6, Fe: 0.1, Mg: 5, P: 11, K: 107, Na: 1, Zn: 0.04, Se: 0.3, VitC: 4.6, VitA: 3, VitB6: 0.04, VitK: 2 } },
  { id: 'dates', name: 'Финики', category: 'carb', kcal: 280, protein: 2, fat: 0, carbs: 70, fiber: 7, gi: 55, servingSize: '60г', description: 'Ограниченно. Высокая калорийность', tier: 'mid', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['limited'], micros: { Ca: 39, Fe: 0.9, Mg: 43, P: 62, K: 656, Na: 2, Zn: 0.3, Se: 0.5, VitB3: 1.3, VitB5: 0.4, VitB6: 0.2, VitK: 2.5 } },
  { id: 'marmalade', name: 'Мармелад', category: 'carb', kcal: 300, protein: 1, fat: 0, carbs: 75, fiber: 0, gi: 70, servingSize: '30 г', description: 'Ограниченно. Желатин + сахар', tier: 'mid', allergens: [], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['limited'], micros: { Ca: 5, Fe: 0.1, Mg: 2, P: 5, K: 10, Na: 20, Zn: 0.02, Se: 0.1, VitC: 1 } },
  { id: 'tomato_juice', name: 'Томатный сок', category: 'veg_fruit', kcal: 18, protein: 1, fat: 0, carbs: 4, fiber: 1, gi: 38, servingSize: '200 мл', description: 'Ограниченно. Ликопин, калий', tier: 'mid', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['limited'], micros: { Ca: 10, Fe: 0.4, Mg: 11, P: 20, K: 220, Na: 250, Zn: 0.2, Se: 0.5, VitC: 12, VitA: 23, Lycopene: 9 } },
  { id: 'amylopectin', name: 'Амилопектин', category: 'supplement', kcal: 380, protein: 0, fat: 0, carbs: 95, fiber: 0, gi: 95, servingSize: '30 г', description: 'Ограниченно. Периоркоут углеводы', tier: 'max', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['limited', 'peri-workout'], micros: { Ca: 0, Fe: 0, Mg: 0, P: 0, K: 0, Na: 0, Zn: 0, Se: 0 } },
  { id: 'dextrose', name: 'Декстроза', category: 'supplement', kcal: 370, protein: 0, fat: 0, carbs: 93, fiber: 0, gi: 100, servingSize: '20 г', description: 'Ограниченно. Посттренинговые углеводы', tier: 'max', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['limited', 'peri-workout'], micros: { Ca: 0, Fe: 0, Mg: 0, P: 0, K: 0, Na: 0, Zn: 0, Se: 0 } },
  { id: 'onion', name: 'Лук', category: 'veg_fruit', kcal: 40, protein: 1, fat: 0, carbs: 9, fiber: 2, gi: 15, servingSize: '80г', description: 'Клетчатка. Кверцетин', tier: 'basic', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [], micros: { Ca: 20, Fe: 0.2, Mg: 10, P: 30, K: 140, Na: 4, Zn: 0.1, Se: 0.5, VitC: 7, VitB6: 0.12, VitB9: 16, VitK: 0.4 } },
  { id: 'sauerkraut', name: 'Квашеная капуста', category: 'veg_fruit', kcal: 20, protein: 1, fat: 0, carbs: 4, fiber: 3, gi: 15, servingSize: '100 г', description: 'Пробиотик. Не ежедневно!', tier: 'mid', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['fermented'], micros: { Ca: 30, Fe: 0.6, Mg: 12, P: 20, K: 170, Na: 660, Zn: 0.2, Se: 0.5, VitC: 14, VitB6: 0.13, VitK: 13 } },
  { id: 'tomato_paste', name: 'Томатная паста', category: 'veg_fruit', kcal: 80, protein: 4, fat: 1, carbs: 17, fiber: 3, gi: 50, servingSize: '30 г', description: 'Специя. Концентрированный ликопин', tier: 'basic', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [], micros: { Ca: 25, Fe: 1.5, Mg: 22, P: 50, K: 550, Na: 50, Zn: 0.4, Se: 0.8, VitC: 8, VitA: 43, Lycopene: 35 } },
  { id: 'himalayan_salt', name: 'Гималайская соль', category: 'other', kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0, gi: 0, servingSize: '2 г', description: 'Специя. Минералы', tier: 'basic', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  { id: 'cod', name: 'Треска (отварная)', category: 'protein', kcal: 82, protein: 18, fat: 0.7, carbs: 0, fiber: 0, gi: 0, servingSize: '150 г', micros: { P: 180, K: 430, Se: 30, VitB12: 1.0, VitD: 1, Mg: 30, Zn: 0.5 }, tier: 'basic', allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  { id: 'turkey_leg', name: 'Индейка (бедро)', category: 'protein', kcal: 157, protein: 21, fat: 7, carbs: 0, fiber: 0, gi: 0, servingSize: '150 г', micros: { Fe: 1.4, Zn: 3.0, VitB3: 4.5, VitB6: 0.4, VitB12: 1.7, P: 200, Se: 26 }, tier: 'basic', allergens: [], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  { id: 'beef_liver', name: 'Говяжья печень', category: 'protein', kcal: 135, protein: 20, fat: 3.6, carbs: 5, fiber: 0, gi: 0, servingSize: '100 г', micros: { VitA: 9442, Fe: 6.2, Zn: 5.3, Cu: 9.7, VitB2: 2.8, VitB3: 13.2, VitB12: 59, P: 350, Se: 36 }, tier: 'basic', allergens: [], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  { id: 'pollock', name: 'Минтай', category: 'protein', kcal: 72, protein: 16, fat: 0.9, carbs: 0, fiber: 0, gi: 0, servingSize: '150 г', micros: { P: 200, K: 350, Se: 28, VitB12: 1.5, I: 50, Mg: 35 }, tier: 'basic', allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  { id: 'rabbit', name: 'Кролик', category: 'protein', kcal: 183, protein: 21, fat: 11, carbs: 0, fiber: 0, gi: 0, servingSize: '150 г', micros: { Fe: 3.3, Zn: 2.4, VitB3: 6.5, VitB12: 4.3, P: 210, K: 340, Mg: 25 }, tier: 'basic', allergens: [], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  { id: 'bulgur', name: 'Булгур (вареный)', category: 'grain', kcal: 83, protein: 3.1, fat: 0.2, carbs: 18.6, fiber: 4.5, gi: 46, servingSize: '150 г', micros: { Mg: 30, Fe: 1.0, P: 40, K: 70, Zn: 0.5, VitB3: 1.0, VitB6: 0.1 }, tier: 'basic', allergens: ['gluten'], isVegetarian: true, isVegan: true, isGlutenFree: false, isDairyFree: true, dietTags: [] },
  { id: 'millet', name: 'Пшено (вареное)', category: 'grain', kcal: 119, protein: 3.5, fat: 1.0, carbs: 23.7, fiber: 1.3, gi: 71, servingSize: '150 г', micros: { Mg: 44, P: 100, Fe: 0.6, K: 60, Zn: 1.2, VitB1: 0.1, VitB3: 1.3 }, tier: 'basic', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  { id: 'barley', name: 'Перловка (вареная)', category: 'grain', kcal: 123, protein: 2.3, fat: 0.4, carbs: 28, fiber: 3.8, gi: 28, servingSize: '150 г', micros: { Mg: 22, P: 54, Fe: 1.3, K: 93, Se: 8, VitB3: 2.0 }, tier: 'basic', allergens: ['gluten'], isVegetarian: true, isVegan: true, isGlutenFree: false, isDairyFree: true, dietTags: [] },
  { id: 'couscous', name: 'Кус-кус (вареный)', category: 'grain', kcal: 112, protein: 3.8, fat: 0.2, carbs: 23, fiber: 1.4, gi: 65, servingSize: '150 г', description: 'Быстрый гарнир из твёрдой пшеницы — готовится за 5 минут. Умеренный ГИ, подходит для основного рациона.', bestFor: ['bulk', 'maintenance'], micros: { Mg: 8, P: 22, Fe: 0.4, Se: 27, VitB3: 1.0, K: 58 }, tier: 'basic', allergens: ['gluten'], isVegetarian: true, isVegan: true, isGlutenFree: false, isDairyFree: true, dietTags: [] },
  { id: 'hummus', name: 'Хумус', category: 'fat', kcal: 166, protein: 8, fat: 10, carbs: 14, fiber: 6, gi: 10, servingSize: '100 г', micros: { Fe: 2.4, Mg: 71, P: 110, K: 228, Zn: 1.2, Cu: 0.5, Mn: 0.6, VitB9: 83 }, tier: 'basic', allergens: ['sesame'], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  { id: 'pumpkin_seeds', name: 'Тыквенные семечки', category: 'fat', kcal: 559, protein: 30, fat: 49, carbs: 11, fiber: 6, gi: 10, servingSize: '30 г', micros: { Mg: 535, Zn: 7.8, Fe: 8.8, P: 1170, K: 809, Mn: 4.5, Cu: 1.4, VitE: 2.2 }, tier: 'basic', allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto'] },
  { id: 'cashew', name: 'Кешью', category: 'fat', kcal: 553, protein: 18, fat: 44, carbs: 30, fiber: 3.3, gi: 25, servingSize: '30 г', micros: { Mg: 292, P: 490, Fe: 6.7, Zn: 5.8, Cu: 2.2, Mn: 1.6, VitK: 34, Se: 12 }, tier: 'basic', allergens: ['nuts'], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  {"id":"goose","name":"Гусь (запечённый)","category":"protein","kcal":305,"protein":23,"fat":22,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"Fe":3,"Zn":3,"P":230,"VitB3":4.5,"VitB12":0.5}},
  {"id":"lamb","name":"Баранина","category":"protein","kcal":282,"protein":17,"fat":23,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"Fe":2,"Zn":4.5,"P":190,"VitB3":5,"VitB12":2.3,"Se":15}},
  {"id":"venison","name":"Оленина","category":"protein","kcal":158,"protein":30,"fat":3.3,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"Fe":4,"Zn":3.5,"P":280,"VitB3":7,"VitB12":3,"Se":14}},
  {"id":"bison","name":"Мясо бизона","category":"protein","kcal":143,"protein":28,"fat":2.4,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"Fe":3.4,"Zn":4.6,"P":250,"VitB3":5.3,"VitB12":2.5,"Se":30}},
  {"id":"pork_shoulder","name":"Свиная лопатка","category":"protein","kcal":242,"protein":18,"fat":18,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"Fe":1,"Zn":3,"P":200,"VitB1":0.8,"VitB12":0.6}},
  {"id":"chicken_wings","name":"Куриные крылья","category":"protein","kcal":290,"protein":18,"fat":22,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"Fe":0.9,"Zn":1.8,"P":160,"VitB3":5.5,"VitB6":0.3}},
  {"id":"tuna_fresh","name":"Тунец свежий (стейк)","category":"protein","kcal":144,"protein":28,"fat":5,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"P":280,"K":530,"Se":46,"VitB3":11,"VitB12":9,"VitD":5,"Omega3":1500}},
  {"id":"salmon_atlantic","name":"Лосось атлантический","category":"protein","kcal":208,"protein":20,"fat":13,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"P":250,"K":400,"Se":30,"VitB12":3.2,"VitD":10,"Omega3":2500,"Ca":12}},
  {"id":"trout","name":"Форель","category":"protein","kcal":168,"protein":24,"fat":7,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"P":250,"K":400,"Se":20,"VitB12":2.8,"VitD":12,"Omega3":1200,"Ca":25}},
  {"id":"tilapia","name":"Тилапия","category":"protein","kcal":96,"protein":20,"fat":1.7,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"P":180,"K":350,"Se":40,"VitB3":4,"VitB12":1.6,"Mg":27}},
  {"id":"sea_bass","name":"Сибас","category":"protein","kcal":97,"protein":19,"fat":2,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"P":190,"K":320,"Se":32,"VitB12":1.8,"Mg":30}},
  {"id":"halibut","name":"Палтус","category":"protein","kcal":111,"protein":21,"fat":2.3,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"P":230,"K":450,"Se":45,"VitB12":1.2,"VitD":5,"Mg":30}},
  {"id":"mussels","name":"Мидии","category":"protein","kcal":86,"protein":12,"fat":2.2,"carbs":3.7,"fiber":0,"gi":0,"servingSize":"100 г","micros":{"Fe":4,"Zn":2.7,"Se":44,"VitB12":24,"Mn":3.4,"P":300}},
  {"id":"oysters","name":"Устрицы","category":"protein","kcal":81,"protein":9,"fat":2.3,"carbs":4.8,"fiber":0,"gi":0,"servingSize":"100 г","micros":{"Zn":90,"Fe":7,"Se":63,"VitB12":19,"Cu":4.5,"Mn":0.5}},
  {"id":"squid","name":"Кальмар","category":"protein","kcal":92,"protein":16,"fat":1.4,"carbs":3.1,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"Zn":1.8,"Se":45,"VitB12":1.3,"P":250,"Cu":1.4}},
  {"id":"crab","name":"Краб","category":"protein","kcal":87,"protein":18,"fat":1.1,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"Zn":3.5,"Se":38,"VitB12":10,"Cu":0.8,"P":230,"Mg":30}},
  {"id":"carp","name":"Карп","category":"protein","kcal":127,"protein":18,"fat":6,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"P":200,"K":350,"Se":12,"VitB12":1.5,"Omega3":500}},
  {"id":"zander","name":"Судак","category":"protein","kcal":84,"protein":19,"fat":0.8,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"P":220,"K":280,"Se":18,"VitB12":1,"Mg":25}},
  {"id":"herring","name":"Сельдь","category":"protein","kcal":262,"protein":18,"fat":18,"carbs":0,"fiber":0,"gi":0,"servingSize":"100 г","micros":{"Omega3":2400,"VitD":15,"VitB12":14,"Se":36,"P":300,"K":327}},
  {"id":"lamb_chops","name":"Бараньи рёбрышки","category":"protein","kcal":330,"protein":15,"fat":29,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"Fe":1.6,"Zn":4,"P":170,"VitB12":2.1,"Se":12}},
  {"id":"turkey_wings","name":"Крылья индейки","category":"protein","kcal":180,"protein":22,"fat":9,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"Fe":1.2,"Zn":2.5,"P":190,"VitB3":4.5,"VitB6":0.4}},
  {"id":"egg_duck","name":"Яйцо утиное","category":"protein","kcal":185,"protein":13,"fat":14,"carbs":1.5,"fiber":0,"gi":0,"servingSize":"1 шт (70 г)","micros":{"VitA":200,"Fe":2.7,"P":220,"VitB2":0.4,"VitB12":5.4,"Se":36,"Cholesterol":440}},
  {"id":"egg_quail","name":"Яйцо перепелиное","category":"protein","kcal":158,"protein":13,"fat":11,"carbs":0.4,"fiber":0,"gi":0,"servingSize":"5 шт (60 г)","micros":{"VitA":90,"Fe":3.6,"Zn":1.5,"VitB2":0.4,"VitB12":1.6,"Se":32,"P":226}},
  {"id":"omelette","name":"Омлет из 2 яиц","category":"protein","kcal":154,"protein":11,"fat":11,"carbs":1.2,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"VitA":160,"Fe":1.7,"P":200,"VitB2":0.4,"VitB12":1,"Se":30,"Zn":1}},
  {"id":"beef_steak_lean","name":"Стейк говяжий постный","category":"protein","kcal":170,"protein":28,"fat":5.5,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"Fe":2.8,"Zn":5.5,"P":220,"VitB3":5.5,"VitB12":2.5,"Se":18}},
  {"id":"veal","name":"Телятина","category":"protein","kcal":131,"protein":26,"fat":2.8,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"Fe":1.4,"Zn":3.8,"P":230,"VitB3":8,"VitB12":1.6,"Se":10}},
  {"id":"pork_neck","name":"Свиная шея","category":"protein","kcal":267,"protein":16,"fat":22,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"Fe":1.2,"Zn":3.2,"P":180,"VitB1":0.7,"VitB12":0.5}},
  {"id":"catfish","name":"Сом","category":"protein","kcal":125,"protein":17,"fat":6,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"P":200,"K":350,"VitB12":2,"Mg":23,"Se":15}},
  {"id":"beef_brisket","name":"Говяжья грудинка","category":"protein","kcal":250,"protein":21,"fat":18,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 г","micros":{"Fe":2.5,"Zn":6,"P":180,"VitB3":4.5,"VitB12":2,"Se":12}},
  {"id":"rice_basmati","name":"Рис басмати (вареный)","category":"grain","kcal":121,"protein":2.6,"fat":0.4,"carbs":25,"fiber":0.5,"gi":58,"servingSize":"150 г","micros":{"Mg":12,"P":43,"Fe":0.3,"K":35,"VitB1":0.02,"VitB3":0.4}},
  {"id":"rice_jasmine","name":"Рис жасмин (вареный)","category":"grain","kcal":129,"protein":2.5,"fat":0.3,"carbs":28,"fiber":0.3,"gi":68,"servingSize":"150 г","micros":{"Mg":10,"P":40,"Fe":0.2,"K":30,"VitB1":0.01,"VitB3":0.3}},
  {"id":"rice_wild","name":"Дикий рис (вареный)","category":"grain","kcal":101,"protein":3.9,"fat":0.3,"carbs":21,"fiber":1.8,"gi":45,"servingSize":"150 г","micros":{"Mg":30,"P":80,"Fe":0.6,"K":80,"Zn":2.2,"VitB6":0.15}},
  {"id":"rice_red","name":"Рис красный (вареный)","category":"grain","kcal":115,"protein":2.8,"fat":0.8,"carbs":24,"fiber":1.6,"gi":55,"servingSize":"150 г","micros":{"Mg":35,"P":70,"Fe":0.8,"K":70,"Zn":1.5,"VitB6":0.1}},
  {"id":"spaghetti","name":"Спагетти (вареные)","category":"grain","kcal":131,"protein":5,"fat":0.6,"carbs":25,"fiber":1.5,"gi":44,"servingSize":"150 г","micros":{"Mg":15,"P":40,"Fe":0.5,"VitB1":0.02,"VitB3":0.4}},
  {"id":"soba","name":"Соба (гречневая лапша)","category":"grain","kcal":99,"protein":5,"fat":0.7,"carbs":20,"fiber":1.5,"gi":46,"servingSize":"150 г","micros":{"Mg":50,"P":80,"Fe":0.8,"VitB1":0.03,"VitB3":0.5}},
  {"id":"udon","name":"Удон (пшеничная лапша)","category":"grain","kcal":105,"protein":3.2,"fat":0.3,"carbs":22,"fiber":0.8,"gi":55,"servingSize":"150 г","micros":{"Mg":8,"P":30,"VitB1":0.02}},
  {"id":"bread_white","name":"Хлеб белый","category":"grain","kcal":265,"protein":8,"fat":3.2,"carbs":49,"fiber":2.7,"gi":75,"servingSize":"1 ломтик (30 г)","micros":{"Ca":40,"Fe":0.9,"Mg":12,"VitB1":0.1,"VitB3":1.2}},
  {"id":"pita","name":"Пита","category":"grain","kcal":275,"protein":9,"fat":1.2,"carbs":56,"fiber":2.2,"gi":57,"servingSize":"1 шт (60 г)","micros":{"Ca":40,"Fe":1.5,"Mg":15,"VitB1":0.2,"VitB3":2}},
  {"id":"lavash","name":"Лаваш армянский","category":"grain","kcal":277,"protein":9,"fat":1.2,"carbs":57,"fiber":2,"gi":55,"servingSize":"1 лист (100 г)","micros":{"Ca":35,"Fe":1.3,"Mg":10,"VitB1":0.1,"VitB3":1.5}},
  {"id":"tortilla_corn","name":"Кукурузная тортилья","category":"grain","kcal":218,"protein":5.7,"fat":2.8,"carbs":45,"fiber":6.3,"gi":52,"servingSize":"1 шт (40 г)","micros":{"Ca":40,"Fe":0.5,"Mg":20,"P":70,"K":90,"VitB3":1}},
  {"id":"bread_protein","name":"Хлеб белковый","category":"grain","kcal":232,"protein":20,"fat":4,"carbs":30,"fiber":5,"gi":35,"servingSize":"1 ломтик (40 г)","micros":{"Ca":30,"Fe":1,"Mg":15,"VitB3":1}},
  {"id":"oats_instant","name":"Овсянка быстрого приготовления","category":"grain","kcal":367,"protein":12,"fat":6.5,"carbs":67,"fiber":8,"gi":79,"servingSize":"40 г (сух)","micros":{"Fe":4,"Mg":120,"P":350,"Zn":2.5,"VitB1":0.4,"VitB3":1}},
  {"id":"muesli","name":"Мюсли с орехами","category":"grain","kcal":350,"protein":9,"fat":8,"carbs":58,"fiber":7,"gi":55,"servingSize":"50 г","micros":{"Fe":3,"Mg":90,"P":250,"Zn":2,"VitB1":0.2,"VitB3":2}},
  {"id":"cornmeal","name":"Кукурузная каша (мамалыга)","category":"grain","kcal":96,"protein":2,"fat":1,"carbs":20,"fiber":2.5,"gi":68,"servingSize":"150 г","micros":{"Fe":0.5,"Mg":15,"P":30,"K":80,"VitB3":1}},
  {"id":"pancakes","name":"Блины (2 шт)","category":"grain","kcal":230,"protein":8,"fat":7,"carbs":34,"fiber":1,"gi":65,"servingSize":"100 г","micros":{"Ca":80,"Fe":0.8,"P":100,"VitB1":0.1}},
  {"id":"rice_cakes","name":"Рисовые хлебцы","category":"grain","kcal":375,"protein":7,"fat":3,"carbs":80,"fiber":2,"gi":82,"servingSize":"2 шт (20 г)","micros":{"Fe":0.5,"Mg":12,"P":40}},
  {"id":"rice_cream","name":"Рисовый крем (сухой завтрак)","category":"grain","kcal":362,"protein":7,"fat":1.5,"carbs":80,"fiber":0.5,"gi":82,"servingSize":"50 г (сух)","micros":{"Ca":10,"Fe":0.3,"Mg":8,"P":30,"VitB1":0.1,"VitB3":1.5}},
  {"id":"potato_mashed","name":"Картофельное пюре","category":"carb","kcal":88,"protein":2,"fat":3,"carbs":15,"fiber":1.5,"gi":74,"servingSize":"150 г","micros":{"K":380,"VitC":7,"Mg":15,"P":40}},
  {"id":"potato_baked","name":"Картофель запечённый","category":"carb","kcal":93,"protein":2.5,"fat":0.1,"carbs":21,"fiber":2.2,"gi":85,"servingSize":"200 г","micros":{"K":550,"VitC":15,"Mg":25,"P":60,"Fe":0.8}},
  {"id":"french_fries","name":"Картофель фри","category":"fast_food","kcal":312,"protein":3.4,"fat":15,"carbs":41,"fiber":3.8,"gi":75,"servingSize":"150 г","micros":{"K":580,"Na":250,"VitC":4}},
  {"id":"kharcho_soup","name":"Харчо (суп)","category":"fast_food","kcal":280,"protein":18,"fat":12,"carbs":24,"fiber":2,"gi":50,"servingSize":"300 мл"},
  {"id":"lagman","name":"Лагман","category":"fast_food","kcal":420,"protein":22,"fat":14,"carbs":52,"fiber":3,"gi":55,"servingSize":"350 г"},
  {"id":"dolma","name":"Долма","category":"fast_food","kcal":195,"protein":8,"fat":10,"carbs":18,"fiber":2.5,"gi":40,"servingSize":"200 г (6 шт)"},
  {"id":"khachapuri","name":"Хачапури по-аджарски","category":"fast_food","kcal":520,"protein":18,"fat":28,"carbs":48,"fiber":1.5,"gi":62,"servingSize":"1 шт (250 г)"},
  {"id":"chebureki","name":"Чебуреки (2 шт)","category":"fast_food","kcal":480,"protein":20,"fat":24,"carbs":44,"fiber":1,"gi":58,"servingSize":"2 шт (200 г)"},
  {"id":"pyanse","name":"Пян-се","category":"fast_food","kcal":320,"protein":16,"fat":14,"carbs":34,"fiber":2,"gi":55,"servingSize":"1 шт (180 г)"},
  {"id":"chicken_teriyaki","name":"Курица терияки с рисом","category":"fast_food","kcal":580,"protein":42,"fat":12,"carbs":76,"fiber":1.5,"gi":60,"servingSize":"350 г"},
  {"id":"wok_chicken","name":"WOK с курицей и овощами","category":"fast_food","kcal":440,"protein":35,"fat":10,"carbs":52,"fiber":4,"gi":50,"servingSize":"350 г"},
  {"id":"poke_salmon","name":"Поке с лососем","category":"fast_food","kcal":480,"protein":32,"fat":18,"carbs":48,"fiber":3,"gi":45,"servingSize":"320 г"},
  {"id":"tom_yam_shrimp","name":"Том Ям с креветками","category":"fast_food","kcal":220,"protein":18,"fat":14,"carbs":8,"fiber":1,"gi":25,"servingSize":"350 мл"},
  {"id":"miso_soup","name":"Мисо суп","category":"fast_food","kcal":60,"protein":5,"fat":2,"carbs":6,"fiber":0.5,"gi":20,"servingSize":"250 мл"},
  {"id":"ramen_egg","name":"Рамен с яйцом","category":"fast_food","kcal":620,"protein":28,"fat":22,"carbs":78,"fiber":2,"gi":65,"servingSize":"450 г"},
  {"id":"fried_rice_egg","name":"Жареный рис с яйцом","category":"fast_food","kcal":380,"protein":14,"fat":12,"carbs":54,"fiber":1.5,"gi":60,"servingSize":"300 г"},
  {"id":"chicken_curry_rice","name":"Курица карри с рисом","category":"fast_food","kcal":560,"protein":36,"fat":18,"carbs":62,"fiber":2.5,"gi":55,"servingSize":"350 г"},
  {"id":"schnitzel_chicken","name":"Шницель куриный","category":"fast_food","kcal":420,"protein":38,"fat":16,"carbs":28,"fiber":1,"gi":50,"servingSize":"200 г"},
  {"id":"kotleta_kiev","name":"Котлета по-киевски","category":"fast_food","kcal":510,"protein":34,"fat":32,"carbs":20,"fiber":0.5,"gi":40,"servingSize":"1 шт (200 г)"},
  {"id":"beef_stroganoff","name":"Бефстроганов с картофелем","category":"fast_food","kcal":540,"protein":32,"fat":22,"carbs":52,"fiber":3,"gi":55,"servingSize":"350 г"},
  {"id":"greek_gyros","name":"Греческий гирос","category":"fast_food","kcal":490,"protein":30,"fat":18,"carbs":50,"fiber":3,"gi":58,"servingSize":"300 г"},
  {"id":"falafel_pita","name":"Фалафель в пите","category":"fast_food","kcal":420,"protein":16,"fat":16,"carbs":54,"fiber":7,"gi":50,"servingSize":"1 шт (280 г)"},
  {"id":"tuna_sandwich","name":"Сэндвич с тунцом","category":"fast_food","kcal":380,"protein":24,"fat":14,"carbs":40,"fiber":2.5,"gi":48,"servingSize":"1 шт (220 г)"},
  {"id":"sweet_potato_fries","name":"Батат фри","category":"carb","kcal":190,"protein":2,"fat":9,"carbs":27,"fiber":3.5,"gi":55,"servingSize":"150 г","micros":{"VitA":850,"K":400,"VitC":15,"Mg":20}},
  {"id":"pelmeni","name":"Пельмени (говядина)","category":"protein","kcal":275,"protein":14,"fat":12,"carbs":29,"fiber":1,"gi":60,"servingSize":"200 г","micros":{"Fe":2,"Zn":3,"P":150,"VitB12":1}},
  {"id":"vareniki","name":"Вареники с творогом","category":"dairy","kcal":210,"protein":9,"fat":5,"carbs":32,"fiber":0.5,"gi":55,"servingSize":"200 г","micros":{"Ca":80,"P":120,"VitB2":0.2}},
  {"id":"cauliflower","name":"Цветная капуста","category":"veg_fruit","kcal":25,"protein":1.9,"fat":0.3,"carbs":5,"fiber":2,"gi":15,"servingSize":"150 г","micros":{"VitC":48,"VitK":15,"VitB9":57,"K":300,"Mg":15,"Mn":0.2}},
  {"id":"brussels_sprouts","name":"Брюссельская капуста","category":"veg_fruit","kcal":43,"protein":3.4,"fat":0.3,"carbs":9,"fiber":3.8,"gi":15,"servingSize":"150 г","micros":{"VitC":85,"VitK":177,"VitB9":61,"Fe":1.4,"K":389,"Mn":0.3}},
  {"id":"kale","name":"Кудрявая капуста (кейл)","category":"veg_fruit","kcal":49,"protein":4.3,"fat":0.9,"carbs":9,"fiber":3.6,"gi":15,"servingSize":"100 г","micros":{"VitA":481,"VitC":120,"VitK":817,"Ca":150,"Fe":1.5,"Mn":0.7}},
  {"id":"lettuce_iceberg","name":"Салат айсберг","category":"veg_fruit","kcal":14,"protein":0.9,"fat":0.1,"carbs":3,"fiber":1.2,"gi":15,"servingSize":"100 г","micros":{"VitA":25,"VitK":24,"K":140,"VitB9":29}},
  {"id":"lettuce_romaine","name":"Салат романо","category":"veg_fruit","kcal":17,"protein":1.2,"fat":0.3,"carbs":3.3,"fiber":2.1,"gi":15,"servingSize":"100 г","micros":{"VitA":436,"VitK":102,"VitC":24,"K":247,"VitB9":136}},
  {"id":"arugula","name":"Руккола","category":"veg_fruit","kcal":25,"protein":2.6,"fat":0.7,"carbs":3.6,"fiber":1.6,"gi":15,"servingSize":"60 г","micros":{"VitA":119,"VitK":108,"VitC":15,"Ca":160,"Fe":1.5,"K":370}},
  {"id":"bok_choy","name":"Пак-чой","category":"veg_fruit","kcal":13,"protein":1.5,"fat":0.2,"carbs":2.2,"fiber":1,"gi":15,"servingSize":"150 г","micros":{"VitA":167,"VitC":45,"VitK":46,"Ca":105,"K":252,"VitB9":66}},
  {"id":"artichoke","name":"Артишок","category":"veg_fruit","kcal":47,"protein":3.3,"fat":0.2,"carbs":11,"fiber":5.4,"gi":15,"servingSize":"100 г","micros":{"VitC":12,"VitK":15,"Mg":60,"K":370,"VitB9":68,"Mn":0.3}},
  {"id":"radish","name":"Редис","category":"veg_fruit","kcal":16,"protein":0.7,"fat":0.1,"carbs":3.4,"fiber":1.6,"gi":15,"servingSize":"100 г","micros":{"VitC":15,"K":233,"VitB9":25,"Ca":25,"Fe":0.4}},
  {"id":"daikon","name":"Дайкон","category":"veg_fruit","kcal":18,"protein":0.6,"fat":0.1,"carbs":4.1,"fiber":1.6,"gi":15,"servingSize":"100 г","micros":{"VitC":22,"K":227,"VitB9":28,"Ca":27}},
  {"id":"leek","name":"Лук-порей","category":"veg_fruit","kcal":61,"protein":1.5,"fat":0.3,"carbs":14,"fiber":1.8,"gi":32,"servingSize":"100 г","micros":{"VitA":83,"VitC":12,"VitK":47,"Fe":2.1,"K":180,"VitB9":64}},
  {"id":"garlic","name":"Чеснок","category":"veg_fruit","kcal":149,"protein":6.4,"fat":0.5,"carbs":33,"fiber":2.1,"gi":30,"servingSize":"3 зубчика (10 г)","micros":{"VitC":31,"Mn":1.7,"VitB6":1.2,"Se":14,"Ca":181,"P":153}},
  {"id":"pumpkin","name":"Тыква","category":"veg_fruit","kcal":26,"protein":1,"fat":0.1,"carbs":6.5,"fiber":0.5,"gi":75,"servingSize":"150 г","micros":{"VitA":426,"VitC":9,"K":340,"Mg":12,"VitB2":0.1}},
  {"id":"zucchini_yellow","name":"Цукини жёлтый","category":"veg_fruit","kcal":16,"protein":1.2,"fat":0.3,"carbs":3,"fiber":1,"gi":15,"servingSize":"150 г","micros":{"VitC":18,"K":260,"VitB6":0.1,"Mg":18}},
  {"id":"chili_pepper","name":"Перец чили","category":"veg_fruit","kcal":40,"protein":1.9,"fat":0.4,"carbs":9,"fiber":1.5,"gi":15,"servingSize":"1 шт (30 г)","micros":{"VitC":143,"VitA":48,"VitB6":0.5,"K":322,"Mn":0.2}},
  {"id":"okra","name":"Окра (бамия)","category":"veg_fruit","kcal":33,"protein":2,"fat":0.2,"carbs":7,"fiber":3.2,"gi":20,"servingSize":"100 г","micros":{"VitC":23,"VitK":31,"Mg":57,"K":299,"VitB9":60,"Mn":0.8}},
  {"id":"olives_green","name":"Оливки зелёные","category":"fat","kcal":145,"protein":1,"fat":15,"carbs":4,"fiber":3.3,"gi":15,"servingSize":"30 г","micros":{"VitE":3.8,"Ca":50,"Fe":0.5,"Na":1556,"Cu":0.1}},
  {"id":"olives_black","name":"Маслины","category":"fat","kcal":115,"protein":0.8,"fat":11,"carbs":6,"fiber":3.2,"gi":15,"servingSize":"30 г","micros":{"VitE":1.6,"Ca":88,"Fe":3.3,"Na":735,"Cu":0.2}},
  {"id":"bean_sprouts","name":"Проростки сои","category":"veg_fruit","kcal":30,"protein":3,"fat":0.2,"carbs":5,"fiber":1.8,"gi":15,"servingSize":"100 г","micros":{"VitC":13,"VitK":33,"Fe":0.9,"K":150,"VitB9":61}},
  {"id":"sauerkraut","name":"Квашеная капуста","category":"veg_fruit","kcal":19,"protein":0.9,"fat":0.1,"carbs":4.3,"fiber":2.9,"gi":15,"servingSize":"100 г","micros":{"VitC":15,"VitK":13,"Na":661,"Fe":1.5,"K":170}},
  {"id":"kimchi","name":"Кимчи","category":"veg_fruit","kcal":15,"protein":1.1,"fat":0.5,"carbs":2,"fiber":1.6,"gi":15,"servingSize":"50 г","micros":{"VitA":50,"VitC":2,"Na":498,"VitB6":0.2}},
  {"id":"ginger_root","name":"Имбирь (корень)","category":"veg_fruit","kcal":80,"protein":1.8,"fat":0.8,"carbs":18,"fiber":2,"gi":15,"servingSize":"10 г","micros":{"Mg":43,"K":415,"Mn":0.2,"VitB6":0.2}},
  {"id":"beetroot","name":"Свёкла (вареная)","category":"veg_fruit","kcal":44,"protein":1.7,"fat":0.2,"carbs":10,"fiber":2,"gi":64,"servingSize":"100 г","micros":{"VitB9":80,"Mn":0.3,"K":305,"Fe":0.8,"Mg":23}},
  {"id":"turnip","name":"Репа","category":"veg_fruit","kcal":28,"protein":0.9,"fat":0.1,"carbs":6.4,"fiber":1.8,"gi":30,"servingSize":"100 г","micros":{"VitC":21,"K":191,"Ca":30,"Mn":0.1}},
  {"id":"collard_greens","name":"Листовая капуста (коллард)","category":"veg_fruit","kcal":32,"protein":3,"fat":0.6,"carbs":5,"fiber":4,"gi":15,"servingSize":"100 г","micros":{"VitA":158,"VitC":35,"VitK":437,"Ca":141,"Mn":0.5,"VitB9":129}},
  {"id":"orange","name":"Апельсин","category":"veg_fruit","kcal":47,"protein":0.9,"fat":0.1,"carbs":12,"fiber":2.4,"gi":43,"servingSize":"1 шт (180 г)","micros":{"VitC":53,"VitA":11,"K":181,"VitB9":30,"Ca":40}},
  {"id":"tangerine","name":"Мандарин","category":"veg_fruit","kcal":53,"protein":0.8,"fat":0.3,"carbs":13,"fiber":1.8,"gi":42,"servingSize":"2 шт (150 г)","micros":{"VitC":27,"VitA":34,"K":150,"Ca":30}},
  {"id":"lemon","name":"Лимон","category":"veg_fruit","kcal":29,"protein":1.1,"fat":0.3,"carbs":9,"fiber":2.8,"gi":20,"servingSize":"1 шт (60 г)","micros":{"VitC":53,"Ca":26,"K":138,"VitB6":0.1}},
  {"id":"lime","name":"Лайм","category":"veg_fruit","kcal":30,"protein":0.7,"fat":0.2,"carbs":10,"fiber":2.8,"gi":20,"servingSize":"1 шт (60 г)","micros":{"VitC":29,"K":102,"Ca":33,"Fe":0.6}},
  {"id":"grapefruit","name":"Грейпфрут красный","category":"veg_fruit","kcal":42,"protein":0.8,"fat":0.1,"carbs":11,"fiber":1.6,"gi":25,"servingSize":"1/2 шт (200 г)","micros":{"VitC":31,"VitA":46,"K":135,"VitB1":0.04}},
  {"id":"strawberry","name":"Клубника","category":"veg_fruit","kcal":32,"protein":0.7,"fat":0.3,"carbs":8,"fiber":2,"gi":40,"servingSize":"150 г","micros":{"VitC":59,"Mn":0.4,"VitB9":24,"K":153}},
  {"id":"raspberry","name":"Малина","category":"veg_fruit","kcal":52,"protein":1.2,"fat":0.6,"carbs":12,"fiber":6.5,"gi":25,"servingSize":"100 г","micros":{"VitC":26,"Mn":0.7,"VitK":8,"K":151,"Mg":22}},
  {"id":"cherry","name":"Вишня","category":"veg_fruit","kcal":50,"protein":1,"fat":0.3,"carbs":12,"fiber":1.6,"gi":22,"servingSize":"100 г","micros":{"VitC":10,"VitA":64,"K":173,"Mn":0.1}},
  {"id":"peach","name":"Персик","category":"veg_fruit","kcal":39,"protein":0.9,"fat":0.3,"carbs":10,"fiber":1.5,"gi":42,"servingSize":"1 шт (150 г)","micros":{"VitA":16,"VitC":6.6,"K":190,"VitB3":0.8}},
  {"id":"nectarine","name":"Нектарин","category":"veg_fruit","kcal":44,"protein":1.1,"fat":0.3,"carbs":11,"fiber":1.7,"gi":43,"servingSize":"1 шт (140 г)","micros":{"VitA":17,"VitC":5.4,"K":200,"VitB3":1.1}},
  {"id":"apricot","name":"Абрикос","category":"veg_fruit","kcal":48,"protein":1.4,"fat":0.4,"carbs":11,"fiber":2,"gi":34,"servingSize":"3 шт (150 г)","micros":{"VitA":96,"VitC":10,"K":260,"VitB3":0.6,"Fe":0.4}},
  {"id":"plum","name":"Слива","category":"veg_fruit","kcal":46,"protein":0.7,"fat":0.3,"carbs":11,"fiber":1.4,"gi":40,"servingSize":"2 шт (100 г)","micros":{"VitC":10,"VitA":17,"K":157,"VitB3":0.4}},
  {"id":"persimmon","name":"Хурма","category":"veg_fruit","kcal":70,"protein":0.6,"fat":0.2,"carbs":18,"fiber":3.6,"gi":50,"servingSize":"1 шт (200 г)","micros":{"VitA":81,"VitC":7.5,"Mn":0.4,"K":161,"Fe":0.2}},
  {"id":"papaya","name":"Папайя","category":"veg_fruit","kcal":43,"protein":0.5,"fat":0.3,"carbs":11,"fiber":1.7,"gi":60,"servingSize":"200 г","micros":{"VitC":61,"VitA":47,"K":182,"VitB9":37,"Mg":21}},
  {"id":"passion_fruit","name":"Маракуйя","category":"veg_fruit","kcal":97,"protein":2.2,"fat":0.7,"carbs":23,"fiber":10.4,"gi":30,"servingSize":"3 шт (100 г)","micros":{"VitC":30,"VitA":64,"K":348,"Fe":1.6,"Mg":29,"P":68}},
  {"id":"coconut_fresh","name":"Кокос свежий","category":"fat","kcal":354,"protein":3.3,"fat":33,"carbs":15,"fiber":9,"gi":35,"servingSize":"50 г","micros":{"Mn":1.5,"Cu":0.4,"Fe":2.4,"K":356,"P":113,"Se":10}},
  {"id":"raisins","name":"Изюм","category":"carb","kcal":299,"protein":3.1,"fat":0.5,"carbs":79,"fiber":3.7,"gi":64,"servingSize":"30 г","micros":{"K":750,"Fe":1.9,"Ca":50,"VitB6":0.2,"Mg":32,"P":101}},
  {"id":"prunes","name":"Чернослив","category":"carb","kcal":240,"protein":2.2,"fat":0.4,"carbs":64,"fiber":7,"gi":29,"servingSize":"40 г","micros":{"K":730,"VitA":39,"VitK":60,"Fe":0.9,"Mg":41,"VitB6":0.2}},
  {"id":"dates_dried","name":"Финики сушёные","category":"carb","kcal":282,"protein":2.5,"fat":0.4,"carbs":75,"fiber":8,"gi":55,"servingSize":"40 г","micros":{"K":656,"Mg":43,"Fe":0.9,"VitB6":0.1,"Cu":0.2,"Mn":0.3,"P":62}},
  {"id":"dried_apricots","name":"Курага","category":"carb","kcal":241,"protein":3.4,"fat":0.4,"carbs":63,"fiber":7,"gi":30,"servingSize":"40 г","micros":{"VitA":127,"K":1162,"Fe":2.7,"Mg":32,"VitB3":2.6,"Cu":0.3,"Mn":0.2}},
  {"id":"milk_05","name":"Молоко 0.5%","category":"dairy","kcal":35,"protein":3,"fat":0.5,"carbs":4.8,"fiber":0,"gi":30,"servingSize":"200 мл","micros":{"Ca":120,"P":90,"VitB2":0.2,"VitB12":0.4,"K":150}},
  {"id":"milk_35","name":"Молоко 3.5%","category":"dairy","kcal":64,"protein":3,"fat":3.5,"carbs":4.7,"fiber":0,"gi":30,"servingSize":"200 мл","micros":{"Ca":120,"P":90,"VitB2":0.2,"VitB12":0.4,"VitA":30,"K":150}},
  {"id":"cottage_cheese_0","name":"Творог обезжиренный","category":"dairy","kcal":85,"protein":18,"fat":0.6,"carbs":3.3,"fiber":0,"gi":30,"servingSize":"150 г","micros":{"Ca":80,"P":150,"VitB2":0.3,"VitB12":0.5,"K":110}},
  {"id":"cottage_cheese_9","name":"Творог 9%","category":"dairy","kcal":159,"protein":16,"fat":9,"carbs":2.8,"fiber":0,"gi":30,"servingSize":"150 г","micros":{"Ca":110,"P":140,"VitB2":0.3,"VitB12":0.5,"K":100}},
  {"id":"yogurt_5","name":"Йогурт 5%","category":"dairy","kcal":72,"protein":4.5,"fat":5,"carbs":3.5,"fiber":0,"gi":30,"servingSize":"200 г","micros":{"Ca":140,"P":100,"VitB2":0.2,"VitB12":0.5,"K":180}},
  {"id":"skyr","name":"Скир","category":"dairy","kcal":60,"protein":11,"fat":0.2,"carbs":4,"fiber":0,"gi":30,"servingSize":"150 г","micros":{"Ca":120,"P":120,"VitB2":0.3,"VitB12":0.4,"K":130}},
  {"id":"cheese_mozzarella","name":"Моцарелла","category":"dairy","kcal":280,"protein":22,"fat":20,"carbs":2.2,"fiber":0,"gi":0,"servingSize":"50 г","micros":{"Ca":505,"P":350,"VitB2":0.3,"VitB12":1,"Zn":3,"Se":15}},
  {"id":"cheese_parmesan","name":"Пармезан","category":"dairy","kcal":431,"protein":38,"fat":29,"carbs":4.1,"fiber":0,"gi":0,"servingSize":"30 г","micros":{"Ca":1184,"P":700,"VitB2":0.4,"VitB12":1.2,"Zn":4,"Se":22}},
  {"id":"cheese_feta","name":"Фета","category":"dairy","kcal":264,"protein":14,"fat":21,"carbs":4.1,"fiber":0,"gi":0,"servingSize":"50 г","micros":{"Ca":493,"P":337,"VitB2":0.8,"VitB12":1.7,"Zn":2.9,"Na":1100}},
  {"id":"cheese_cheddar","name":"Чеддер","category":"dairy","kcal":403,"protein":25,"fat":33,"carbs":1.3,"fiber":0,"gi":0,"servingSize":"30 г","micros":{"Ca":721,"P":512,"VitB2":0.4,"VitB12":1.1,"Zn":4,"Se":28}},
  {"id":"cream_20","name":"Сливки 20%","category":"dairy","kcal":206,"protein":2.5,"fat":20,"carbs":3.7,"fiber":0,"gi":15,"servingSize":"30 г","micros":{"Ca":80,"VitA":200,"VitD":0.4,"VitE":0.5}},
  {"id":"ghee","name":"Топлёное масло (гхи)","category":"fat","kcal":900,"protein":0,"fat":100,"carbs":0,"fiber":0,"gi":0,"servingSize":"10 г","micros":{"VitA":300,"VitE":2.8,"VitK":8}},
  {"id":"coconut_oil","name":"Кокосовое масло","category":"fat","kcal":892,"protein":0,"fat":99,"carbs":0,"fiber":0,"gi":0,"servingSize":"10 г","micros":{"VitE":0.1,"VitK":0.5,"Fe":0.05}},
  {"id":"flaxseed_oil","name":"Льняное масло","category":"fat","kcal":884,"protein":0,"fat":100,"carbs":0,"fiber":0,"gi":0,"servingSize":"10 г","micros":{"Omega3":53000,"VitE":17.5,"VitK":9.2}},
  {"id":"sesame_oil","name":"Кунжутное масло","category":"fat","kcal":884,"protein":0,"fat":100,"carbs":0,"fiber":0,"gi":0,"servingSize":"10 г","micros":{"VitE":14,"VitK":13.6,"Zn":0.1,"Cu":0.1}},
  {"id":"avocado_oil","name":"Масло авокадо","category":"fat","kcal":884,"protein":0,"fat":100,"carbs":0,"fiber":0,"gi":0,"servingSize":"10 г","micros":{"VitE":5,"VitK":8,"OleicAcid":70}},
  {"id":"brazil_nuts","name":"Бразильский орех","category":"fat","kcal":659,"protein":14,"fat":67,"carbs":12,"fiber":7.5,"gi":15,"servingSize":"20 г","micros":{"Se":1917,"Mg":376,"P":725,"Zn":4.1,"Cu":1.7,"VitE":5.7}},
  {"id":"pecans","name":"Пекан","category":"fat","kcal":691,"protein":9,"fat":72,"carbs":14,"fiber":9.6,"gi":10,"servingSize":"30 г","micros":{"Mn":4.5,"Cu":1.2,"Zn":4.5,"Mg":121,"VitB1":0.7,"VitE":1.4}},
  {"id":"macadamia","name":"Макадамия","category":"fat","kcal":718,"protein":8,"fat":76,"carbs":14,"fiber":8.6,"gi":10,"servingSize":"30 г","micros":{"Mn":4.1,"Cu":0.8,"Mg":130,"Fe":3.7,"VitB1":1.2,"VitB3":2.5}},
  {"id":"pistachios","name":"Фисташки","category":"fat","kcal":560,"protein":20,"fat":45,"carbs":28,"fiber":10.6,"gi":15,"servingSize":"30 г","micros":{"VitB6":1.7,"Cu":1.3,"Mn":1.2,"P":490,"Mg":121,"K":1025,"Fe":3.9}},
  {"id":"pine_nuts","name":"Кедровые орехи","category":"fat","kcal":673,"protein":14,"fat":68,"carbs":13,"fiber":3.7,"gi":15,"servingSize":"20 г","micros":{"Mn":8.8,"VitE":9.3,"Mg":251,"P":575,"Zn":6.5,"Cu":1.3,"Fe":5.5}},
  {"id":"hazelnuts","name":"Фундук","category":"fat","kcal":628,"protein":15,"fat":61,"carbs":17,"fiber":9.7,"gi":15,"servingSize":"30 г","micros":{"VitE":15,"Mn":6.2,"Cu":1.7,"Mg":163,"Fe":4.7,"VitB6":0.6}},
  {"id":"hemp_seeds","name":"Семена конопли","category":"fat","kcal":553,"protein":33,"fat":49,"carbs":9,"fiber":4,"gi":0,"servingSize":"20 г","micros":{"Omega3":8800,"Mg":700,"Fe":8,"Zn":9.9,"P":1650,"Mn":7.6,"VitE":8,"VitB1":1.3}},
  {"id":"poppy_seeds","name":"Мак","category":"fat","kcal":525,"protein":18,"fat":42,"carbs":28,"fiber":20,"gi":35,"servingSize":"10 г","micros":{"Ca":1440,"Mn":6.7,"Mg":347,"P":870,"Fe":9.8,"Zn":8,"Cu":1.6}},
  {"id":"tahini","name":"Тахини (кунжутная паста)","category":"fat","kcal":595,"protein":17,"fat":54,"carbs":21,"fiber":9.3,"gi":15,"servingSize":"30 г","micros":{"Ca":426,"Fe":4.4,"Mg":95,"P":360,"Cu":1.6,"Zn":4.6,"Mn":1.5}},
  {"id":"dark_chocolate_90","name":"Шоколад 90%","category":"fat","kcal":592,"protein":10,"fat":52,"carbs":24,"fiber":14,"gi":20,"servingSize":"25 г","micros":{"Fe":12,"Mg":230,"Cu":2.5,"Mn":2.1,"Zn":3.3,"P":310,"K":700}},
  {"id":"hummus","name":"Хумус","category":"fat","kcal":166,"protein":8,"fat":10,"carbs":14,"fiber":6,"gi":10,"servingSize":"100 г","micros":{"Fe":2.4,"Mg":71,"P":110,"K":228,"Zn":1.2,"Cu":0.5,"Mn":0.6,"VitB9":83}},
  {"id":"sushi_salmon","name":"Суши с лососем (8 шт)","category":"protein","kcal":310,"protein":16,"fat":6,"carbs":48,"fiber":1,"gi":55,"servingSize":"250 г","micros":{"Omega3":800,"I":30,"VitD":5,"Na":800}},
  {"id":"borscht","name":"Борщ","category":"veg_fruit","kcal":57,"protein":3.8,"fat":2.5,"carbs":5.5,"fiber":1.5,"gi":30,"servingSize":"300 г","micros":{"VitA":250,"VitC":10,"Fe":1.2,"K":280,"Na":350}},
  {"id":"chicken_soup","name":"Куриный суп","category":"protein","kcal":36,"protein":3,"fat":1.2,"carbs":3.5,"fiber":0.5,"gi":30,"servingSize":"300 г","micros":{"K":200,"Na":400,"P":30,"VitB3":1.5}},
  {"id":"pea_soup","name":"Гороховый суп","category":"carb","kcal":68,"protein":4,"fat":1.5,"carbs":10,"fiber":3,"gi":35,"servingSize":"300 г","micros":{"Fe":1.5,"K":250,"VitB1":0.1,"P":80}},
  {"id":"pilaf","name":"Плов","category":"carb","kcal":210,"protein":7,"fat":8,"carbs":28,"fiber":1,"gi":60,"servingSize":"200 г","micros":{"Fe":1.5,"Zn":2,"VitB3":3,"P":120,"K":250}},
  {"id":"risotto","name":"Ризотто","category":"carb","kcal":168,"protein":4.5,"fat":6,"carbs":24,"fiber":0.5,"gi":55,"servingSize":"200 г","micros":{"Ca":30,"P":70,"VitB3":1.5,"K":150}},
  {"id":"soy_milk","name":"Соевое молоко","category":"dairy","kcal":43,"protein":3.3,"fat":1.5,"carbs":3.5,"fiber":0.5,"gi":30,"servingSize":"200 мл","micros":{"Ca":120,"Fe":0.6,"Mg":16,"P":50,"VitD":1}},
  {"id":"almond_milk","name":"Миндальное молоко","category":"dairy","kcal":17,"protein":0.4,"fat":1,"carbs":1.3,"fiber":0.2,"gi":30,"servingSize":"200 мл","micros":{"Ca":120,"VitE":3,"VitD":1,"Mg":6}},
  {"id":"oat_milk","name":"Овсяное молоко","category":"dairy","kcal":45,"protein":1,"fat":1.5,"carbs":6.5,"fiber":0.8,"gi":30,"servingSize":"200 мл","micros":{"Ca":120,"Fe":0.3,"VitD":1,"P":50}},
  {"id":"smoothie_berry","name":"Ягодный смузи","category":"veg_fruit","kcal":65,"protein":1.5,"fat":0.5,"carbs":14,"fiber":3,"gi":35,"servingSize":"250 мл","micros":{"VitC":20,"VitK":15,"K":200,"Mn":0.3}},
  {"id":"tomato_juice","name":"Томатный сок","category":"veg_fruit","kcal":17,"protein":0.9,"fat":0.1,"carbs":3.5,"fiber":0.4,"gi":35,"servingSize":"200 мл","micros":{"VitC":18,"VitA":42,"K":230,"Na":250,"Lycopene":9}},
  {"id":"orange_juice","name":"Апельсиновый сок","category":"veg_fruit","kcal":45,"protein":0.7,"fat":0.2,"carbs":10,"fiber":0.2,"gi":50,"servingSize":"200 мл","micros":{"VitC":50,"VitB9":30,"K":200,"Ca":11,"Mg":11}},
  {"id":"whey_concentrate","name":"Сывороточный концентрат","category":"supplement","kcal":380,"protein":70,"fat":6,"carbs":8,"fiber":0,"gi":0,"servingSize":"30 г","micros":{"Ca":200,"P":120,"Mg":30,"K":150}},
  {"id":"casein_micellar","name":"Мицеллярный казеин","category":"supplement","kcal":360,"protein":76,"fat":1.5,"carbs":8,"fiber":0,"gi":0,"servingSize":"30 г","micros":{"Ca":500,"P":350,"Mg":20,"K":100}},
  {"id":"mass_gainer","name":"Гейнер (масс-сет)","category":"supplement","kcal":370,"protein":30,"fat":4,"carbs":55,"fiber":2,"gi":45,"servingSize":"100 г","micros":{"Ca":100,"P":80,"Mg":20,"VitB3":2,"VitB6":0.3}},
  {"id":"bar_protein","name":"Протеиновый батончик","category":"supplement","kcal":320,"protein":25,"fat":12,"carbs":30,"fiber":5,"gi":35,"servingSize":"60 г","micros":{"Ca":80,"Fe":2,"P":150,"VitB12":0.5}},
  {"id":"aminos_complex","name":"Аминокислотный комплекс (EAA)","category":"supplement","kcal":10,"protein":2.5,"fat":0,"carbs":0,"fiber":0,"gi":0,"servingSize":"10 г","micros":{"Leucine":2500,"Isoleucine":1250,"Valine":1250}},
  {"id":"pre_workout","name":"Предтрен (стандарт)","category":"supplement","kcal":15,"protein":0,"fat":0,"carbs":3,"fiber":0,"gi":0,"servingSize":"15 г","micros":{"Caffeine":200,"BetaAlanine":3200,"Citrulline":6000,"VitB3":15,"VitB6":5,"VitB12":25}},
  {"id":"isotonic","name":"Изотоник","category":"supplement","kcal":80,"protein":0,"fat":0,"carbs":20,"fiber":0,"gi":50,"servingSize":"25 г","micros":{"Na":400,"K":200,"Mg":60,"Ca":50,"VitC":80}},
  {"id":"glutamine_powder","name":"Глютамин (порошок)","category":"supplement","kcal":16,"protein":4,"fat":0,"carbs":0,"fiber":0,"gi":0,"servingSize":"5 г","micros":{}},
  {"id":"collagen_hydrolysate","name":"Коллаген гидролизат","category":"supplement","kcal":360,"protein":90,"fat":0,"carbs":0,"fiber":0,"gi":0,"servingSize":"10 г","micros":{"Glycine":20000,"Proline":12000,"Hydroxyproline":10000}},
  {"id":"zma","name":"ZMA комплекс","category":"supplement","kcal":0,"protein":0,"fat":0,"carbs":0,"fiber":0,"gi":0,"servingSize":"3 капс","micros":{"Zn":30,"Mg":450,"VitB6":10.5}},

  {"id":"beef_ground_lean","name":"Govjazhij farsh (postnyj)","category":"protein","kcal":171,"protein":21,"fat":10,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 g","micros":{"Fe":2.7,"Zn":4.8,"P":200,"VitB3":4,"VitB12":2,"Se":15}},
  {"id":"pork_ribs","name":"Svinye rebryshki","category":"protein","kcal":340,"protein":16,"fat":30,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 g","micros":{"Fe":1,"Zn":3,"VitB1":0.5,"VitB12":0.5,"P":150}},
  {"id":"chicken_leg","name":"Kurinaja golen","category":"protein","kcal":185,"protein":19,"fat":11,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 g","micros":{"Fe":1,"Zn":2,"P":170,"VitB3":4.5,"VitB6":0.3}},
  {"id":"flounder","name":"Kambala","category":"protein","kcal":91,"protein":18,"fat":1.3,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 g","micros":{"P":180,"K":300,"Se":30,"VitB12":1,"Mg":25}},
  {"id":"lobster","name":"Omar/Lobster","category":"protein","kcal":90,"protein":19,"fat":0.9,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 g","micros":{"Zn":3,"Se":42,"VitB12":1.4,"Cu":1.5,"P":200}},
  {"id":"clams","name":"Molljuski","category":"protein","kcal":74,"protein":13,"fat":1,"carbs":3.6,"fiber":0,"gi":0,"servingSize":"100 g","micros":{"Fe":14,"Zn":2.7,"VitB12":11,"Se":30,"Cu":0.7,"Mn":0.5}},
  {"id":"pike","name":"Shjuka","category":"protein","kcal":84,"protein":18.4,"fat":1.1,"carbs":0,"fiber":0,"gi":0,"servingSize":"150 g","micros":{"P":200,"K":260,"Mg":25,"VitB12":1.2,"Se":15}},
     {"id":"sprat","name":"Kilka","category":"protein","kcal":137,"protein":17,"fat":7,"carbs":0,"fiber":0,"gi":0,"servingSize":"100 g","micros":{"Omega3":1600,"Ca":300,"VitD":6,"VitB12":11,"Se":30}},
  {id:"pork_tenderloin",name:"Свиная вырезка (варёная)",category:"protein",kcal:142,protein:22,fat:5.5,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:1.2,Zn:2.5,P:210,VitB1:0.9,VitB6:0.4,VitB12:0.7,Se:25}},
  {id:"pork_shoulder",name:"Свиная лопатка (тушёная)",category:"protein",kcal:230,protein:20,fat:16,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:1.5,Zn:3.5,P:190,VitB1:0.7,VitB3:4,VitB12:0.6,Se:22}},
  {id:"pork_ham",name:"Свиной окорок (варёный)",category:"protein",kcal:190,protein:24,fat:10,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:1,Zn:2.8,P:205,VitB1:0.8,VitB6:0.45,VitB12:0.65,Se:24}},
  {id:"pork_belly",name:"Свиная грудинка",category:"protein",kcal:320,protein:14,fat:29,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:0.8,Zn:2,VitB1:0.4,VitB12:0.5,P:145}},
  {id:"pork_neck",name:"Свиная шея",category:"protein",kcal:260,protein:18,fat:21,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:1.1,Zn:3,P:180,VitB1:0.65,VitB6:0.35,VitB12:0.55,Se:20}},
  {id:"pork_escalope",name:"Свиной эскалоп",category:"protein",kcal:175,protein:23,fat:9,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:1.2,Zn:2.7,P:210,VitB1:0.85,VitB3:4.5,VitB12:0.7,Se:23}},
  {id:"pork_heart",name:"Свиное сердце (варёное)",category:"protein",kcal:118,protein:17,fat:4.5,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:4.5,Zn:3,VitB12:5,VitB5:2.5,P:210,K:280,Se:15}},
  {id:"pork_kidney",name:"Свиные почки (варёные)",category:"protein",kcal:130,protein:19,fat:5,carbs:1,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:5,Zn:3.5,VitB12:8,Se:140,P:240,VitB2:1.5}},
  {id:"pork_tongue",name:"Свиной язык (варёный)",category:"protein",kcal:220,protein:16,fat:16,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:3,Zn:3,VitB12:3,P:170,K:250,Se:10}},
  {id:"pork_liver_raw",name:"Свиная печень (тушёная)",category:"protein",kcal:140,protein:21,fat:4,carbs:3,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:18,Zn:5.5,VitA:6500,VitB12:26,VitB2:3,VitB5:6,Cu:1,P:290}},
  {id:"chicken_thigh_skinless",name:"Куриное бедро (без кожи варёное)",category:"protein",kcal:195,protein:23,fat:11,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:1.2,Zn:2,P:185,VitB3:5,VitB6:0.35,VitB12:0.4,Se:20}},
  {id:"chicken_wing_baked",name:"Куриные крылья (запечённые)",category:"protein",kcal:250,protein:20,fat:18,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:0.9,Zn:1.5,P:160,VitB3:4,VitB6:0.3}},
  {id:"chicken_drumstick_noskin",name:"Куриная голень (без кожи варёная)",category:"protein",kcal:185,protein:19,fat:11,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:1,Zn:2,P:170,VitB3:4.5,VitB6:0.3,Se:15}},
  {id:"chicken_hearts",name:"Куриные сердца (варёные)",category:"protein",kcal:153,protein:15,fat:9,carbs:1,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:6,Zn:2,VitB12:7,P:180,K:270,Se:8}},
  {id:"chicken_liver_cooked",name:"Куриная печень (тушёная)",category:"protein",kcal:119,protein:17,fat:4.5,carbs:0.9,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:8.5,Zn:3.5,VitA:4000,VitB12:16,VitB2:1.8,VitB5:6,Cu:0.5,P:280}},
  {id:"chicken_gizzards",name:"Куриные желудки (варёные)",category:"protein",kcal:154,protein:27,fat:4,carbs:0.5,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:3,Zn:3,P:210,VitB12:1.5,Mg:22,Se:25}},
  {id:"chicken_mince_breast",name:"Куриный фарш (грудка)",category:"protein",kcal:143,protein:25,fat:4,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:0.7,Zn:1,P:190,VitB3:11,VitB6:0.5}},
  {id:"chicken_mince_mixed",name:"Куриный фарш (смешанный)",category:"protein",kcal:195,protein:20,fat:12,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:1,Zn:1.5,P:175,VitB3:6,VitB6:0.35}},
  {id:"turkey_thigh_meat",name:"Индейка (бедро варёное)",category:"protein",kcal:150,protein:24,fat:5,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:1.3,Zn:3,P:195,VitB3:7,VitB6:0.5,VitB12:0.4,Se:28}},
  {id:"turkey_wing_cooked",name:"Индейка (крыло варёное)",category:"protein",kcal:180,protein:22,fat:9,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:1.1,Zn:2.5,P:180,VitB3:5,VitB6:0.4}},
  {id:"turkey_mince_lean",name:"Индейка фарш (грудка)",category:"protein",kcal:120,protein:25,fat:2,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:0.6,Zn:1.3,P:210,VitB3:10,VitB6:0.5}},
  {id:"turkey_liver_cooked",name:"Индейка печень (варёная)",category:"protein",kcal:130,protein:18,fat:5,carbs:1,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:9,Zn:3,VitA:5000,VitB12:20,VitB2:2,Cu:0.6,P:300}},
  {id:"beef_tenderloin",name:"Говяжья вырезка (стейк)",category:"protein",kcal:180,protein:28,fat:7,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:3,Zn:5,P:220,VitB3:6,VitB6:0.5,VitB12:2.5,Se:18}},
  {id:"beef_chuck",name:"Говядина лопатка (тушёная)",category:"protein",kcal:220,protein:25,fat:13,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:2.8,Zn:6,P:200,VitB3:5,VitB12:2.2,Se:15}},
  {id:"beef_brisket",name:"Говяжья грудинка (варёная)",category:"protein",kcal:280,protein:22,fat:20,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:2.5,Zn:5.5,P:190,VitB12:2,VitB3:4}},
  {id:"beef_shank",name:"Говяжья голяшка (варёная)",category:"protein",kcal:190,protein:26,fat:8,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:3.2,Zn:7,P:200,VitB12:3,Glycine:3000,Proline:2000}},
  {id:"beef_ribeye",name:"Рибай стейк (жареный)",category:"protein",kcal:290,protein:23,fat:22,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:2.7,Zn:5,P:200,VitB3:5,VitB12:2.5,Se:17}},
  {id:"beef_striploin",name:"Стриплойн стейк (жареный)",category:"protein",kcal:210,protein:27,fat:11,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:2.9,Zn:5.2,P:215,VitB3:5.5,VitB12:2.5,Se:18}},
  {id:"beef_rump",name:"Говяжий огузок (варёный)",category:"protein",kcal:195,protein:26,fat:9,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:3,Zn:5.5,P:210,VitB12:2.5,VitB3:5}},
  {id:"beef_tongue_cooked",name:"Говяжий язык (варёный)",category:"protein",kcal:230,protein:16,fat:17,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:3.5,Zn:4,VitB12:3.5,P:180,K:260,Cholesterol:90}},
  {id:"beef_liver_stewed",name:"Говяжья печень (тушёная)",category:"protein",kcal:130,protein:20,fat:3.5,carbs:4,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:6.5,Zn:5.5,VitA:9000,VitB12:60,VitB2:2.5,Cu:9,P:350}},
  {id:"beef_kidney_cooked",name:"Говяжьи почки (варёные)",category:"protein",kcal:110,protein:18,fat:3,carbs:1,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:5.5,Zn:3,VitB12:27,Se:140,VitB2:2,P:250}},
  {id:"beef_heart_cooked",name:"Говяжье сердце (варёное)",category:"protein",kcal:140,protein:16,fat:7,carbs:2,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:6,Zn:3,VitB12:7,VitB5:2,P:220,Mg:25}},
  {id:"beef_tripe",name:"Говяжий рубец (варёный)",category:"protein",kcal:97,protein:13,fat:4,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Ca:150,Zn:2,P:80,VitB12:1.5,Mg:15,Se:10}},
  {id:"lamb_leg",name:"Баранья нога (запечённая)",category:"protein",kcal:230,protein:25,fat:14,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:2,Zn:4,P:200,VitB12:2.5,VitB3:6,Se:18}},
  {id:"lamb_loin",name:"Баранья корейка (запечённая)",category:"protein",kcal:270,protein:22,fat:19,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:1.8,Zn:3.5,P:190,VitB12:2.2,VitB3:5,Se:16}},
  {id:"lamb_shoulder_cut",name:"Баранья лопатка (тушёная)",category:"protein",kcal:260,protein:21,fat:19,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:2,Zn:4,P:185,VitB12:2.5,VitB3:5.5}},
  {id:"lamb_ribs",name:"Бараньи рёбрышки (запечённые)",category:"protein",kcal:310,protein:19,fat:26,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:1.5,Zn:3,P:170,VitB12:2,Se:14}},
  {id:"lamb_mince_meat",name:"Бараний фарш",category:"protein",kcal:250,protein:19,fat:19,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:1.8,Zn:3.5,P:180,VitB12:2.3}},
  {id:"lamb_liver_fried",name:"Баранья печень (жареная)",category:"protein",kcal:150,protein:20,fat:5,carbs:3,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:10,Zn:4,VitA:7500,VitB12:35,Cu:7,P:320}},
  {id:"venison",name:"Оленина (стейк жареный)",category:"protein",kcal:155,protein:30,fat:3,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:3.5,Zn:4,P:230,VitB12:3,VitB3:6,Se:14}},
  {id:"rabbit_meat",name:"Кролик (тушёный)",category:"protein",kcal:173,protein:28,fat:6,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:2.5,Zn:2.5,P:280,VitB12:3.5,VitB3:8,Mg:25}},
  {id:"quail_whole",name:"Перепел (целый запечённый)",category:"protein",kcal:180,protein:25,fat:9,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:4,Zn:3,P:240,VitB12:1.5,VitB6:0.5,Mg:30}},
  {id:"duck_breast_skinless",name:"Утиная грудка (без кожи запечённая)",category:"protein",kcal:140,protein:23,fat:5,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:3,Zn:3,P:190,VitB3:5,VitB12:0.5}},
  {id:"duck_leg_confit",name:"Утиная ножка (конфи)",category:"protein",kcal:280,protein:18,fat:22,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:2.5,Zn:2.5,P:170,VitB3:4}},
  {id:"goose_roasted",name:"Гусь (запечённый)",category:"protein",kcal:320,protein:16,fat:27,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:2.5,Zn:2,P:170,VitB3:3.5,VitB12:0.6}},
  {id:"pheasant",name:"Фазан (запечённый)",category:"protein",kcal:160,protein:27,fat:5,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:3,Zn:3,P:240,VitB3:6,VitB6:0.5}},
  {id:"horse_meat",name:"Конина (варёная)",category:"protein",kcal:167,protein:28,fat:5,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:4,Zn:4,P:210,VitB12:3,VitB3:5,Mg:28}},
  {id:"river_perch",name:"Окунь речной (запечённый)",category:"protein",kcal:110,protein:19,fat:3,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:200,K:280,Mg:30,VitB12:1.5,Se:15}},
  {id:"zander",name:"Судак (запечённый)",category:"protein",kcal:84,protein:19,fat:0.8,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:210,K:270,Mg:25,VitB12:1.5,Se:12}},
  {id:"carp_fish",name:"Карп (запечённый)",category:"protein",kcal:127,protein:17,fat:6,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:200,K:330,Mg:25,VitB12:1.5,VitD:2,Omega3:400,Zn:1.5}},
  {id:"crucian",name:"Карась (запечённый)",category:"protein",kcal:87,protein:17,fat:1.8,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:190,K:300,Mg:28,Ca:50,VitB12:1.2}},
  {id:"bream_fish",name:"Лещ (запечённый)",category:"protein",kcal:105,protein:17,fat:4,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:220,K:290,Mg:30,VitB12:1.5,Omega3:300,Zn:1}},
  {id:"tench",name:"Линь (запечённый)",category:"protein",kcal:110,protein:17,fat:4,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:200,K:280,Mg:25,VitB12:1.3,Fe:1}},
  {id:"burbot",name:"Налим (запечённый)",category:"protein",kcal:90,protein:19,fat:0.6,carbs:1,fiber:0,gi:0,servingSize:"150 г",micros:{P:210,K:300,Mg:30,VitB12:1.5,Se:14,VitD:1.5}},
  {id:"sturgeon",name:"Осетр (запечённый)",category:"protein",kcal:164,protein:18,fat:10,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:230,K:320,Mg:30,VitB12:2,Zn:1.5,VitD:3,Omega3:800}},
  {id:"sterlet",name:"Стерлядь (запечённая)",category:"protein",kcal:140,protein:18,fat:7,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:220,K:300,Mg:28,VitB12:2,VitD:2,Omega3:600}},
  {id:"trout_river_fish",name:"Форель речная (запечённая)",category:"protein",kcal:148,protein:20,fat:7,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:240,K:380,Mg:27,VitB12:3,VitD:4,Omega3:1000}},
  {id:"catfish",name:"Сом (запечённый)",category:"protein",kcal:120,protein:18,fat:5,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:200,K:300,Mg:25,VitB12:1.8,Se:16}},
  {id:"mackerel_atlantic",name:"Скумбрия атлантическая (запечённая)",category:"protein",kcal:205,protein:19,fat:14,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:250,K:320,Mg:30,VitB12:8,VitD:8,Omega3:2500,Se:40,VitB3:9}},
  {id:"herring_salted",name:"Сельдь атлантическая (солёная)",category:"protein",kcal:158,protein:18,fat:9,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Omega3:2000,VitD:10,VitB12:8,Se:40,Ca:60,P:250,Na:1200}},
  {id:"halibut_fish",name:"Палтус (запечённый)",category:"protein",kcal:140,protein:19,fat:6,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:240,K:450,Mg:30,VitB12:1.5,VitD:4,Omega3:500,Se:36}},
  {id:"sea_bass",name:"Сибас (запечённый)",category:"protein",kcal:97,protein:18,fat:2.5,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:200,K:310,Mg:30,VitB12:1.5,Se:28,Omega3:200}},
  {id:"sea_bream",name:"Дорадо (запечённый)",category:"protein",kcal:100,protein:19,fat:2.5,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:210,K:320,Mg:28,VitB12:1.5,Se:25,Omega3:250}},
  {id:"monkfish",name:"Морской чёрт (варёный)",category:"protein",kcal:97,protein:17,fat:1.5,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:190,K:350,Mg:32,VitB12:1.2,Se:35}},
  {id:"grouper",name:"Морской окунь (запечённый)",category:"protein",kcal:118,protein:25,fat:1.3,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:250,K:490,Mg:35,VitB12:0.8,Se:38,Omega3:300}},
  {id:"mullet",name:"Кефаль (запечённая)",category:"protein",kcal:140,protein:19,fat:5.5,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:200,K:350,Mg:30,VitB12:0.8,Omega3:400,Se:30}},
  {id:"red_snapper",name:"Красный люциан (варёный)",category:"protein",kcal:128,protein:26,fat:1.5,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:240,K:520,Mg:37,VitB12:3.5,Se:42,Omega3:350}},
  {id:"barramundi",name:"Баррамунди (запечённый)",category:"protein",kcal:120,protein:22,fat:3,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:210,K:380,Mg:35,VitB12:1.2,Omega3:600,Se:30}},
  {id:"langoustine",name:"Лангустин (варёный)",category:"protein",kcal:95,protein:20,fat:0.5,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:220,K:300,Mg:30,Zn:3,Se:40,VitB12:1.5}},
  {id:"sea_urchin",name:"Морской ёж (икра)",category:"protein",kcal:160,protein:12,fat:11,carbs:3,fiber:0,gi:0,servingSize:"50 г",micros:{P:200,K:300,Zn:5,Se:15,VitA:1000,VitE:2,Omega3:500}},
  {id:"anchovy_fresh",name:"Анчоус свежий (запечённый)",category:"protein",kcal:160,protein:21,fat:8,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{P:200,K:380,Ca:80,VitB12:1.5,Omega3:1400,Se:35}},
  {id:"smelt_fish",name:"Корюшка (жареная)",category:"protein",kcal:200,protein:17,fat:14,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:200,K:350,Ca:50,VitB12:2,Omega3:800,Se:25}},
  {id:"octopus",name:"Осьминог (варёный)",category:"protein",kcal:164,protein:30,fat:1.5,carbs:3,fiber:0,gi:0,servingSize:"150 г",micros:{P:280,K:630,Mg:60,Zn:3.5,Se:90,VitB12:20,Cu:0.7,Fe:5}},
  {id:"cuttlefish",name:"Каракатица (варёная)",category:"protein",kcal:148,protein:25,fat:1.5,carbs:1,fiber:0,gi:0,servingSize:"150 г",micros:{P:250,K:400,Mg:35,Zn:3,Se:65,VitB12:7,Cu:0.5}},
  {id:"scallop",name:"Морской гребешок (запечённый)",category:"protein",kcal:137,protein:24,fat:1,carbs:3,fiber:0,gi:0,servingSize:"150 г",micros:{P:300,K:340,Mg:50,Zn:2.5,Se:30,VitB12:2}},
  {id:"whelk",name:"Трубач (варёный)",category:"protein",kcal:137,protein:24,fat:0.4,carbs:8,fiber:0,gi:0,servingSize:"150 г",micros:{P:200,K:300,Mg:35,Zn:3,Se:65,VitB12:20,Cu:2}},
  {id:"abalone",name:"Морское ушко (абалон)",category:"protein",kcal:105,protein:17,fat:0.8,carbs:6,fiber:0,gi:0,servingSize:"100 г",micros:{P:190,K:250,Mg:50,Zn:1.5,Se:40,VitB12:1.5,Cu:0.5}},
  {id:"surimi",name:"Сурими (крабовые палочки)",category:"protein",kcal:120,protein:9,fat:3,carbs:15,fiber:0,gi:0,servingSize:"100 г",micros:{Na:800,Ca:20,P:120,Zn:0.3}},
  {id:"fish_roe_red",name:"Икра красная (лососёвая)",category:"protein",kcal:245,protein:26,fat:14,carbs:2,fiber:0,gi:0,servingSize:"30 г",micros:{P:370,K:250,Mg:10,VitA:1000,VitD:6,VitB12:7,Omega3:2500,Se:30,Na:800}},
  {id:"fish_roe_black",name:"Икра чёрная (осетровая)",category:"protein",kcal:260,protein:24,fat:16,carbs:4,fiber:0,gi:0,servingSize:"30 г",micros:{P:350,K:220,Mg:12,VitA:1500,VitD:8,VitB12:10,Omega3:3000,Se:35,Na:900}},
  {id:"egg_white_cooked",name:"Яичный белок (варёный)",category:"protein",kcal:52,protein:11,fat:0.2,carbs:0.7,fiber:0,gi:0,servingSize:"2 шт (100 г)",micros:{K:150,Mg:10,P:15,Na:160,Se:15,VitB2:0.4}},
  {id:"egg_yolk_cooked",name:"Яичный желток (варёный)",category:"protein",kcal:322,protein:16,fat:27,carbs:3.6,fiber:0,gi:0,servingSize:"2 шт (40 г)",micros:{P:390,K:109,Fe:2.7,Zn:2.3,Se:25,VitA:1440,VitD:5,VitB12:2,VitB2:0.5,Cholesterol:1080}},
  {id:"duck_egg",name:"Утиное яйцо (варёное)",category:"protein",kcal:185,protein:13,fat:14,carbs:1.5,fiber:0,gi:0,servingSize:"1 шт (70 г)",micros:{P:220,K:220,Fe:2.7,Zn:2,Se:35,VitA:540,VitB12:3.5,VitD:2}},
  {id:"quail_egg",name:"Перепелиное яйцо (варёное)",category:"protein",kcal:158,protein:13,fat:11,carbs:1.5,fiber:0,gi:0,servingSize:"5 шт (50 г)",micros:{P:226,K:132,Fe:3.6,Zn:3,Se:32,VitA:300,VitB12:1.6,VitB2:0.8}},
  {id:"goose_egg",name:"Гусиное яйцо (варёное)",category:"protein",kcal:185,protein:14,fat:13,carbs:1.4,fiber:0,gi:0,servingSize:"1 шт (100 г)",micros:{P:270,K:210,Fe:3.6,Zn:1.8,Se:25,VitA:540,VitB12:3,VitD:2}},
  {id:"ostrich_egg",name:"Страусиное яйцо",category:"protein",kcal:155,protein:13,fat:10,carbs:1.5,fiber:0,gi:0,servingSize:"50 г (1/20 шт)",micros:{P:200,K:180,Fe:2.5,Zn:1.5,Se:25,VitA:400,VitB12:2,VitD:1.5}},
  {id:"bread_borodinsky",name:"Хлеб бородинский",category:"grain",kcal:210,protein:6,fat:1,carbs:41,fiber:5.5,gi:55,servingSize:"50 г",micros:{Fe:2,Mg:30,P:120,Zn:1,VitB1:0.12,VitB2:0.06,VitB3:1,Mn:0.8}},
  {id:"bread_grain_whole",name:"Хлеб зерновой (цельнозерновой)",category:"grain",kcal:230,protein:8,fat:3,carbs:40,fiber:7,gi:50,servingSize:"50 г",micros:{Fe:2.5,Mg:60,P:200,Zn:1.5,VitB1:0.2,VitB3:3,Se:15,Mn:1}},
  {id:"bread_fitness",name:"Хлеб фитнес (с семенами)",category:"grain",kcal:250,protein:10,fat:6,carbs:36,fiber:8,gi:45,servingSize:"50 г",micros:{Fe:2.8,Mg:70,P:220,Zn:2,VitB1:0.2,VitB3:3.5,Se:18,Omega3:300}},
  {id:"bread_rye",name:"Хлеб ржаной",category:"grain",kcal:200,protein:6,fat:1,carbs:38,fiber:6,gi:50,servingSize:"50 г",micros:{Fe:1.8,Mg:35,P:130,Zn:1,VitB1:0.1,VitB3:1.5,Mn:0.7}},
  {id:"bread_pumpernickel",name:"Пумперникель",category:"grain",kcal:193,protein:5,fat:1,carbs:38,fiber:7,gi:50,servingSize:"50 г",micros:{Fe:2,Mg:40,P:140,Zn:1.2,VitB1:0.15,VitB3:2,Mn:0.8}},
  {id:"bread_flatbread_wheat",name:"Лаваш пшеничный",category:"grain",kcal:275,protein:9,fat:1.2,carbs:56,fiber:2,gi:70,servingSize:"80 г",micros:{Fe:2,Ca:30,P:130,Zn:1,VitB1:0.15}},
  {id:"bread_pita_wholewheat",name:"Пита цельнозерновая",category:"grain",kcal:262,protein:10,fat:1.7,carbs:46,fiber:7,gi:57,servingSize:"60 г",micros:{Fe:2.5,Mg:50,P:180,Zn:1.5,VitB1:0.2,VitB3:3}},
  {id:"bread_ciabatta",name:"Чиабатта",category:"grain",kcal:260,protein:9,fat:3,carbs:48,fiber:2,gi:72,servingSize:"80 г",micros:{Fe:1.8,Ca:40,P:120,Zn:1}},
  {id:"bread_baguette",name:"Французский багет",category:"grain",kcal:260,protein:8,fat:2,carbs:52,fiber:2,gi:78,servingSize:"50 г",micros:{Fe:1.2,Ca:30,P:100,Zn:0.5}},
  {id:"bread_gluten_free",name:"Хлеб безглютеновый (рисово-кукурузный)",category:"grain",kcal:240,protein:4,fat:5,carbs:44,fiber:3,gi:70,servingSize:"50 г",micros:{Ca:20,Fe:0.8,P:80,Zn:0.5}},
  {id:"bread_rice_cakes",name:"Хлебцы рисовые",category:"grain",kcal:380,protein:8,fat:2.5,carbs:78,fiber:1.5,gi:82,servingSize:"30 г (3 шт)",micros:{Ca:20,Fe:0.5,P:100,Zn:0.5}},
  {id:"bread_cornbread",name:"Кукурузный хлеб",category:"grain",kcal:300,protein:7,fat:8,carbs:48,fiber:3,gi:69,servingSize:"60 г",micros:{Fe:1.5,Ca:60,P:150,Mg:20,Zn:0.8}},
  {id:"cereal_wheat_porridge",name:"Каша пшеничная",category:"grain",kcal:105,protein:3,fat:0.4,carbs:21,fiber:1.5,gi:60,servingSize:"200 г",micros:{Fe:0.8,Mg:30,P:100,Zn:1,VitB1:0.1,VitB3:1.2}},
  {id:"cereal_rye_flakes",name:"Хлопья ржаные",category:"grain",kcal:340,protein:10,fat:2,carbs:65,fiber:12,gi:50,servingSize:"50 г (сухие)",micros:{Fe:3,Mg:80,P:250,Zn:2.5,VitB1:0.3,VitB3:2.5,Mn:1.5}},
  {id:"cereal_amaranth",name:"Амарант (каша)",category:"grain",kcal:155,protein:5.5,fat:2.5,carbs:26,fiber:3.5,gi:35,servingSize:"200 г",micros:{Fe:3.5,Mg:130,P:280,Zn:2,Mn:1.5,Ca:120,VitB9:40}},
  {id:"cereal_spelt_traditional",name:"Полба (каша)",category:"grain",kcal:120,protein:5,fat:1,carbs:23,fiber:3.5,gi:45,servingSize:"200 г",micros:{Fe:2.5,Mg:80,P:220,Zn:2,VitB3:3,Mn:1,VitB1:0.2}},
  {id:"cereal_teff",name:"Тефф (каша)",category:"grain",kcal:105,protein:3.5,fat:0.7,carbs:20,fiber:2.8,gi:40,servingSize:"200 г",micros:{Fe:3,Mg:60,P:170,Ca:120,Zn:1.5,VitB6:0.2,Mn:2}},
  {id:"cereal_sorghum",name:"Сорго (каша)",category:"grain",kcal:130,protein:3.5,fat:1,carbs:26,fiber:3,gi:50,servingSize:"200 г",micros:{Fe:2,Mg:70,P:180,Zn:1,Ca:30,VitB3:2}},
  {id:"cereal_millet_porridge",name:"Каша пшённая",category:"grain",kcal:110,protein:3.5,fat:1.2,carbs:21,fiber:1.3,gi:50,servingSize:"200 г",micros:{Fe:0.7,Mg:40,P:120,Zn:1,VitB1:0.1,VitB3:1,Cu:0.2}},
  {id:"cereal_pearl_barley",name:"Каша перловая",category:"grain",kcal:120,protein:3,fat:0.4,carbs:26,fiber:2.5,gi:45,servingSize:"200 г",micros:{Fe:1,Mg:35,P:130,Zn:1,Se:12,VitB1:0.1,VitB3:1}},
  {id:"cereal_semolina",name:"Каша манная",category:"grain",kcal:100,protein:3,fat:0.5,carbs:20,fiber:0.5,gi:75,servingSize:"200 г",micros:{Ca:80,Fe:0.5,P:80,Zn:0.5,VitB1:0.05}},
  {id:"cereal_couscous_wholewheat",name:"Кускус цельнозерновой",category:"grain",kcal:160,protein:6,fat:0.8,carbs:32,fiber:5,gi:55,servingSize:"200 г",micros:{Fe:1.5,Mg:50,P:180,Zn:1.2,VitB3:2.5}},
  {id:"cereal_quinoa_red",name:"Киноа красная (варёная)",category:"grain",kcal:120,protein:4.5,fat:2,carbs:21,fiber:2.8,gi:40,servingSize:"200 г",micros:{Fe:1.5,Mg:64,P:152,Zn:1,Ca:17,VitB9:42,Mn:0.6}},
  {id:"cereal_bulgur_fine",name:"Булгур мелкий",category:"grain",kcal:100,protein:3,fat:0.3,carbs:19,fiber:4.5,gi:48,servingSize:"200 г",micros:{Fe:1,Mg:32,P:70,Zn:0.5,VitB3:1.5,Mn:0.6}},
  {id:"cereal_oat_bran",name:"Овсяные отруби",category:"grain",kcal:246,protein:17,fat:7,carbs:50,fiber:15,gi:45,servingSize:"40 г (сухие)",micros:{Fe:5,Mg:235,P:500,Zn:3.5,VitB1:0.5,VitB3:1.5,Se:15}},
  {id:"cereal_wheat_bran",name:"Пшеничные отруби",category:"grain",kcal:216,protein:16,fat:4,carbs:25,fiber:43,gi:45,servingSize:"40 г (сухие)",micros:{Fe:7,Mg:300,P:600,Zn:4,VitB1:0.4,VitB3:3,Se:20,Mn:5}},
  {id:"cereal_muesli_toasted",name:"Мюсли запечённые (с орехами)",category:"grain",kcal:420,protein:10,fat:14,carbs:60,fiber:8,gi:55,servingSize:"50 г",micros:{Fe:2,Mg:70,P:200,Zn:1.5,VitE:3,Omega3:200}},
  {id:"pasta_egg_noodles",name:"Лапша яичная",category:"grain",kcal:145,protein:5,fat:2.5,carbs:26,fiber:1.5,gi:55,servingSize:"200 г (варёная)",micros:{Fe:1.5,Zn:0.8,VitB1:0.1,VitB2:0.08,Ca:20,Cholesterol:30}},
  {id:"pasta_soba_raw",name:"Соба (гречневая лапша сухая)",category:"grain",kcal:336,protein:14,fat:0.7,carbs:70,fiber:5,gi:50,servingSize:"80 г (сухая)",micros:{Fe:2,Mg:95,P:250,Zn:2,VitB1:0.3,VitB3:3,Mn:1}},
  {id:"pasta_wholewheat",name:"Паста цельнозерновая (варёная)",category:"grain",kcal:140,protein:5.5,fat:1,carbs:26,fiber:4,gi:50,servingSize:"200 г (варёная)",micros:{Fe:1.8,Mg:60,P:160,Zn:1.5,VitB1:0.15,VitB3:2.5}},
  {id:"pasta_gluten_free",name:"Паста безглютеновая (рис/кукуруза варёная)",category:"grain",kcal:160,protein:3,fat:1.5,carbs:33,fiber:1,gi:60,servingSize:"200 г (варёная)",micros:{Fe:0.5,Ca:5,P:50,Zn:0.3}},
  {id:"pasta_udon",name:"Удон (варёный)",category:"grain",kcal:120,protein:4,fat:0.2,carbs:25,fiber:0.5,gi:62,servingSize:"200 г (варёный)",micros:{Na:300,Ca:10,P:60,Zn:0.3}},
  {id:"pasta_rice_noodles",name:"Рисовая лапша (варёная)",category:"grain",kcal:110,protein:1.5,fat:0.2,carbs:25,fiber:0.3,gi:65,servingSize:"200 г (варёная)",micros:{Ca:5,Fe:0.3,P:30,Zn:0.2}},
  {id:"pasta_glass_noodles",name:"Стеклянная лапша (фунчоза варёная)",category:"grain",kcal:110,protein:0.2,fat:0.1,carbs:27,fiber:0.2,gi:55,servingSize:"200 г (варёная)",micros:{Ca:5,Fe:0.5,P:10}},
  {id:"pasta_lasagna",name:"Лазанья листы (варёные)",category:"grain",kcal:150,protein:5,fat:1.5,carbs:29,fiber:1.8,gi:55,servingSize:"100 г (2 листа)",micros:{Fe:1.2,Zn:0.8,Ca:20,P:100}},
  {id:"pasta_ravioli_meat",name:"Равиоли с мясом (варёные)",category:"grain",kcal:220,protein:12,fat:7,carbs:27,fiber:2,gi:55,servingSize:"200 г",micros:{Fe:1.5,Zn:1.5,Ca:40,P:120}},
  {id:"pasta_gnocchi",name:"Ньокки (варёные)",category:"grain",kcal:165,protein:4,fat:0.5,carbs:36,fiber:2,gi:65,servingSize:"200 г",micros:{Ca:20,Fe:0.8,P:60,Zn:0.5}},
  {id:"pasta_spaetzle",name:"Шпецле (варёные)",category:"grain",kcal:160,protein:6,fat:3,carbs:28,fiber:1.5,gi:55,servingSize:"200 г",micros:{Fe:1,Zn:0.8,Ca:30,Cholesterol:20}},
  {id:"pasta_orzo",name:"Орзо (варёное)",category:"grain",kcal:140,protein:5,fat:1,carbs:27,fiber:1.5,gi:58,servingSize:"200 г",micros:{Fe:1,Zn:0.8,Ca:15,P:90}},
  {id:"greens_watercress",name:"Водяной кресс (жеруха)",category:"veg_fruit",kcal:11,protein:2.3,fat:0.1,carbs:1.3,fiber:0.5,gi:15,servingSize:"100 г",micros:{Ca:120,Fe:0.2,Mg:21,P:60,K:330,VitC:43,VitA:1600,VitK:250,VitB9:9}},
  {id:"greens_mizuna",name:"Мизуна (японская горчица)",category:"veg_fruit",kcal:16,protein:2,fat:0.2,carbs:2,fiber:1.5,gi:15,servingSize:"100 г",micros:{Ca:130,Fe:1.5,Mg:20,P:50,K:400,VitC:35,VitA:1500,VitK:200,VitB9:40}},
  {id:"greens_tatsoi",name:"Татсои (татуей)",category:"veg_fruit",kcal:12,protein:1.8,fat:0.2,carbs:1.5,fiber:1.3,gi:15,servingSize:"100 г",micros:{Ca:100,Fe:1.2,Mg:18,P:45,K:350,VitC:30,VitA:2000,VitK:180,VitB9:35}},
  {id:"greens_purslane",name:"Портулак",category:"veg_fruit",kcal:20,protein:1.3,fat:0.2,carbs:2.5,fiber:1.5,gi:15,servingSize:"100 г",micros:{Ca:65,Fe:2,Mg:68,P:44,K:494,VitC:21,VitA:1320,Omega3:400,VitE:3}},
  {id:"greens_sorrel",name:"Щавель",category:"veg_fruit",kcal:22,protein:2,fat:0.3,carbs:3,fiber:2,gi:15,servingSize:"100 г",micros:{Ca:44,Fe:2.4,Mg:103,P:63,K:390,VitC:48,VitA:2000,VitK:200,VitB9:13}},
  {id:"greens_mache",name:"Валерианелла (полевой салат)",category:"veg_fruit",kcal:21,protein:2,fat:0.4,carbs:3.5,fiber:1.5,gi:15,servingSize:"100 г",micros:{Ca:100,Fe:2.2,Mg:25,P:50,K:460,VitC:38,VitA:3000,VitK:200,VitB9:70}},
  {id:"greens_chard",name:"Мангольд (листовая свёкла)",category:"veg_fruit",kcal:19,protein:1.8,fat:0.2,carbs:3.7,fiber:1.6,gi:15,servingSize:"100 г",micros:{Ca:51,Fe:1.8,Mg:81,P:46,K:379,VitC:30,VitA:3000,VitK:830,VitE:1.9}},
  {id:"greens_collard",name:"Коллард (листовая капуста)",category:"veg_fruit",kcal:32,protein:3,fat:0.6,carbs:5.5,fiber:4,gi:15,servingSize:"100 г",micros:{Ca:232,Fe:0.5,Mg:27,P:25,K:213,VitC:35,VitA:1900,VitK:437,VitB9:129}},
  {id:"greens_endive",name:"Эндивий",category:"veg_fruit",kcal:17,protein:1.2,fat:0.2,carbs:3.5,fiber:3.1,gi:15,servingSize:"100 г",micros:{Ca:52,Fe:0.8,Mg:15,P:28,K:314,VitC:6.5,VitA:1085,VitK:231,VitB9:142}},
  {id:"greens_radicchio",name:"Радиккьо (красный цикорий)",category:"veg_fruit",kcal:23,protein:1.4,fat:0.3,carbs:4.5,fiber:1.5,gi:15,servingSize:"100 г",micros:{Ca:19,Fe:0.6,Mg:13,P:40,K:302,VitC:8,VitA:1500,VitK:255,VitE:2.3}},
  {id:"root_jerusalem_artichoke",name:"Топинамбур (варёный)",category:"veg_fruit",kcal:73,protein:2,fat:0.1,carbs:17,fiber:2.5,gi:50,servingSize:"200 г",micros:{Fe:3.5,Mg:17,P:78,K:430,VitB1:0.2,VitB3:1.3,Inulin:16000}},
  {id:"root_black_radish",name:"Редька чёрная",category:"veg_fruit",kcal:35,protein:1.5,fat:0.2,carbs:6.5,fiber:2,gi:15,servingSize:"100 г",micros:{Ca:35,Fe:1.2,Mg:22,P:26,K:350,VitC:29,VitB9:25}},
  {id:"root_scorzonera",name:"Скорцонера (козелец)",category:"veg_fruit",kcal:82,protein:1.5,fat:0.3,carbs:18,fiber:4,gi:20,servingSize:"100 г",micros:{Ca:60,Fe:0.7,Mg:20,P:75,K:380,VitC:8,VitB1:0.1,VitB3:0.7,Inulin:10000}},
  {id:"root_lotus_root",name:"Корень лотоса (варёный)",category:"veg_fruit",kcal:74,protein:2,fat:0.1,carbs:16,fiber:3.1,gi:35,servingSize:"150 г",micros:{Ca:45,Fe:1.2,Mg:23,P:100,K:556,VitC:44,VitB6:0.3,Cu:0.3}},
  {id:"root_taro",name:"Таро (варёное)",category:"veg_fruit",kcal:142,protein:0.5,fat:0.1,carbs:35,fiber:5,gi:55,servingSize:"150 г",micros:{Ca:18,Fe:0.7,Mg:33,P:84,K:484,VitC:5,VitB6:0.3,VitE:2.4}},
  {id:"root_yucca",name:"Юкка/кассава (варёная)",category:"veg_fruit",kcal:160,protein:1.4,fat:0.3,carbs:38,fiber:1.8,gi:65,servingSize:"150 г",micros:{Ca:16,Fe:0.3,Mg:21,P:27,K:271,VitC:18,VitB9:27}},
  {id:"root_daikon",name:"Дайкон (редька белая)",category:"veg_fruit",kcal:18,protein:0.6,fat:0.1,carbs:4,fiber:1.6,gi:15,servingSize:"100 г",micros:{Ca:27,Fe:0.4,Mg:16,P:23,K:227,VitC:22,VitB9:28}},
  {id:"root_rutabaga",name:"Брюква (варёная)",category:"veg_fruit",kcal:39,protein:1.2,fat:0.2,carbs:8,fiber:2.5,gi:50,servingSize:"150 г",micros:{Ca:47,Fe:0.5,Mg:23,P:58,K:326,VitC:25,VitB1:0.08,VitB9:18}},
  {id:"root_turnip",name:"Репа (варёная)",category:"veg_fruit",kcal:28,protein:0.7,fat:0.1,carbs:6.5,fiber:2,gi:50,servingSize:"150 г",micros:{Ca:30,Fe:0.2,Mg:11,P:26,K:191,VitC:21,VitB9:9}},
  {id:"root_parsnip",name:"Пастернак (варёный)",category:"veg_fruit",kcal:71,protein:1.2,fat:0.3,carbs:16,fiber:3.5,gi:52,servingSize:"150 г",micros:{Ca:36,Fe:0.6,Mg:29,P:69,K:367,VitC:17,VitB9:44,VitE:1}},
  {id:"squash_patisson",name:"Патиссон (варёный)",category:"veg_fruit",kcal:24,protein:1.2,fat:0.1,carbs:4.5,fiber:1.5,gi:15,servingSize:"200 г",micros:{Ca:14,Mg:20,P:30,K:200,VitC:18}},
  {id:"squash_delicata",name:"Деликата (запечённая)",category:"veg_fruit",kcal:60,protein:1.5,fat:0.3,carbs:13,fiber:3,gi:15,servingSize:"200 г",micros:{Ca:40,Mg:35,P:50,K:300,VitA:1000,VitC:15}},
  {id:"squash_kabocha",name:"Кабоча (японская тыква запечённая)",category:"veg_fruit",kcal:70,protein:1.5,fat:0.2,carbs:16,fiber:2.5,gi:15,servingSize:"200 г",micros:{Ca:30,Mg:30,P:60,K:350,VitA:5000,VitC:18,VitE:1.5}},
  {id:"squash_spaghetti",name:"Спагетти-сквош (запечённый)",category:"veg_fruit",kcal:31,protein:0.6,fat:0.3,carbs:7,fiber:1.5,gi:20,servingSize:"200 г",micros:{Ca:23,Mg:12,P:12,K:108,VitC:3.5,VitA:100,VitB6:0.1}},
  {id:"squash_acorn",name:"Акорн-сквош (запечённый)",category:"veg_fruit",kcal:56,protein:1,fat:0.2,carbs:13,fiber:3,gi:15,servingSize:"200 г",micros:{Ca:46,Mg:40,P:45,K:437,VitA:1200,VitC:13,VitB6:0.2}},
  {id:"pepper_padron",name:"Перец падрон (жареный)",category:"veg_fruit",kcal:35,protein:1.2,fat:0.3,carbs:5,fiber:2,gi:15,servingSize:"100 г",micros:{Ca:20,Mg:15,P:30,K:210,VitC:80,VitA:500,VitB6:0.2}},
  {id:"pepper_shishito",name:"Перец шишито (жареный)",category:"veg_fruit",kcal:30,protein:1,fat:0.2,carbs:4.5,fiber:2,gi:15,servingSize:"100 г",micros:{Ca:18,Mg:12,P:25,K:200,VitC:70,VitA:400}},
  {id:"pepper_pimento",name:"Перец пименто (сладкий консервированный)",category:"veg_fruit",kcal:25,protein:0.8,fat:0.3,carbs:5,fiber:2,gi:15,servingSize:"100 г",micros:{Ca:10,Fe:0.5,P:20,K:170,VitC:85,VitA:800,Na:300}},
  {id:"pepper_poblano",name:"Перец поблано",category:"veg_fruit",kcal:20,protein:0.9,fat:0.2,carbs:4,fiber:1.5,gi:15,servingSize:"100 г",micros:{Ca:10,Fe:0.5,P:20,K:175,VitC:80,VitA:450}},
  {id:"pepper_anaheim",name:"Перец анахейм",category:"veg_fruit",kcal:26,protein:1,fat:0.2,carbs:5.5,fiber:1.5,gi:15,servingSize:"100 г",micros:{Ca:14,Fe:0.5,P:30,K:210,VitC:85,VitA:500}},
  {id:"canned_green_peas",name:"Зелёный горошек (консервированный)",category:"veg_fruit",kcal:81,protein:5,fat:0.4,carbs:15,fiber:4.5,gi:48,servingSize:"100 г",micros:{Fe:1,Zn:0.7,Ca:20,P:80,K:170,VitC:10,Na:300}},
  {id:"canned_corn_sweet",name:"Кукуруза консервированная",category:"veg_fruit",kcal:80,protein:3,fat:1,carbs:18,fiber:2,gi:55,servingSize:"100 г",micros:{Fe:0.4,Mg:20,P:70,K:190,Na:250,VitC:5}},
  {id:"canned_tomatoes",name:"Томаты консервированные (в с/соке)",category:"veg_fruit",kcal:25,protein:1.2,fat:0.2,carbs:4.5,fiber:1,gi:15,servingSize:"100 г",micros:{Ca:20,Fe:0.6,P:20,K:200,VitC:10,Lycopene:18000,VitA:200,Na:250}},
  {id:"canned_olives_green",name:"Оливки зелёные (консервированные)",category:"veg_fruit",kcal:145,protein:1,fat:15,carbs:3.8,fiber:3,gi:15,servingSize:"30 г (10 шт)",micros:{Ca:52,Fe:0.5,Cu:0.1,VitE:3.8,Na:900}},
  {id:"juice_tomato",name:"Томатный сок",category:"veg_fruit",kcal:17,protein:0.8,fat:0.2,carbs:3.5,fiber:0.4,gi:15,servingSize:"250 мл",micros:{Ca:10,Fe:0.4,Mg:11,P:20,K:235,VitC:18,Lycopene:9000,VitA:250,Na:250}},
  {id:"juice_carrot",name:"Морковный сок",category:"veg_fruit",kcal:40,protein:0.9,fat:0.2,carbs:9,fiber:0.8,gi:45,servingSize:"250 мл",micros:{Ca:24,Fe:0.5,Mg:14,P:42,K:292,VitC:8,VitA:9000,VitK:15,VitE:1}},
  {id:"berry_black_currant",name:"Чёрная смородина",category:"veg_fruit",kcal:55,protein:1,fat:0.4,carbs:13,fiber:4.5,gi:25,servingSize:"100 г",micros:{Ca:55,Fe:1.5,Mg:24,P:59,K:322,VitC:180,VitB5:0.4,VitB9:8,Anthocyanins:250}},
  {id:"berry_red_currant",name:"Красная смородина",category:"veg_fruit",kcal:43,protein:1.4,fat:0.2,carbs:9,fiber:4,gi:30,servingSize:"100 г",micros:{Ca:36,Fe:0.9,Mg:16,P:33,K:275,VitC:41,VitK:11,VitB9:8}},
  {id:"berry_white_currant",name:"Белая смородина",category:"veg_fruit",kcal:42,protein:1.2,fat:0.1,carbs:9.5,fiber:3.5,gi:30,servingSize:"100 г",micros:{Ca:30,Fe:0.8,Mg:15,P:30,K:260,VitC:40,VitK:10}},
  {id:"berry_gooseberry",name:"Крыжовник",category:"veg_fruit",kcal:44,protein:0.8,fat:0.6,carbs:10,fiber:4.5,gi:35,servingSize:"100 г",micros:{Ca:25,Fe:0.5,Mg:10,P:30,K:200,VitC:30,VitB5:0.3,VitE:0.4}},
  {id:"berry_cloudberry",name:"Морошка",category:"veg_fruit",kcal:51,protein:0.8,fat:0.7,carbs:9,fiber:6,gi:25,servingSize:"100 г",micros:{Ca:18,Fe:0.7,Mg:20,P:25,K:230,VitC:158,VitA:150,VitE:1.5,EllagicAcid:100}},
  {id:"berry_lingonberry",name:"Брусника",category:"veg_fruit",kcal:43,protein:0.7,fat:0.4,carbs:9,fiber:2.5,gi:25,servingSize:"100 г",micros:{Ca:25,Fe:0.4,Mg:7,P:16,K:85,VitC:11,VitA:40,VitE:1.5,BenzoicAcid:50}},
  {id:"berry_boysenberry",name:"Бойзенова ягода",category:"veg_fruit",kcal:50,protein:1.1,fat:0.5,carbs:12,fiber:5.3,gi:30,servingSize:"100 г",micros:{Ca:25,Fe:0.9,Mg:16,P:27,K:139,VitC:20,VitA:100,VitK:20,VitB9:63}},
  {id:"berry_huckleberry",name:"Гекльберри",category:"veg_fruit",kcal:57,protein:0.7,fat:0.4,carbs:14,fiber:3,gi:25,servingSize:"100 г",micros:{Ca:15,Fe:0.5,Mg:12,P:20,K:130,VitC:10,VitA:50}},
  {id:"berry_elderberry",name:"Бузина (ягоды)",category:"veg_fruit",kcal:73,protein:0.7,fat:0.5,carbs:18,fiber:7,gi:20,servingSize:"100 г",micros:{Ca:38,Fe:1.6,Mg:15,P:40,K:280,VitC:36,VitA:600,VitB6:0.2}},
  {id:"berry_aronia",name:"Арония (черноплодная рябина)",category:"veg_fruit",kcal:47,protein:1.5,fat:0.3,carbs:11,fiber:5.5,gi:25,servingSize:"100 г",micros:{Ca:30,Fe:1,Mg:20,P:50,K:250,VitC:21,VitA:200,Anthocyanins:500}},
  {id:"berry_acai",name:"Асаи (пюре замороженное)",category:"veg_fruit",kcal:70,protein:1,fat:5,carbs:5,fiber:3.5,gi:25,servingSize:"100 г",micros:{Ca:35,Fe:0.6,P:25,K:180,VitC:10,VitA:300,Omega3:120,Anthocyanins:350}},
  {id:"berry_golden_berry",name:"Физалис (золотая ягода)",category:"veg_fruit",kcal:53,protein:1.9,fat:0.7,carbs:11,fiber:4,gi:25,servingSize:"100 г",micros:{Ca:9,Fe:1,P:40,K:300,VitC:11,VitA:720,VitB3:2.8}},
  {id:"fruit_kaki",name:"Хурма (каки)",category:"veg_fruit",kcal:70,protein:0.6,fat:0.2,carbs:18,fiber:3.5,gi:53,servingSize:"200 г (1 шт)",micros:{Ca:8,Fe:0.3,Mg:9,P:17,K:161,VitC:7.5,VitA:162,VitB6:0.1,Mn:0.3}},
  {id:"fruit_cherimoya",name:"Черимойя",category:"veg_fruit",kcal:75,protein:1.5,fat:0.7,carbs:17,fiber:3,gi:35,servingSize:"150 г",micros:{Ca:10,Fe:0.3,Mg:17,P:26,K:287,VitC:12,VitB6:0.2,VitB2:0.1}},
  {id:"fruit_sapodilla",name:"Саподилла (саподилья)",category:"veg_fruit",kcal:83,protein:0.4,fat:1.1,carbs:20,fiber:5,gi:35,servingSize:"150 г",micros:{Ca:21,Fe:0.8,Mg:12,P:12,K:193,VitC:14,VitB9:14}},
  {id:"fruit_jackfruit",name:"Джекфрут (свежий)",category:"veg_fruit",kcal:95,protein:1.5,fat:0.3,carbs:25,fiber:3,gi:50,servingSize:"150 г",micros:{Ca:34,Fe:0.6,Mg:37,P:36,K:303,VitC:13,VitB6:0.3,VitB1:0.1}},
  {id:"fruit_durian",name:"Дуриан",category:"veg_fruit",kcal:147,protein:1.5,fat:5,carbs:25,fiber:3.5,gi:49,servingSize:"100 г",micros:{Ca:6,Fe:0.4,Mg:30,P:39,K:436,VitC:19,VitB6:0.3,VitB9:36,Mn:0.3}},
  {id:"fruit_mangosteen",name:"Мангостин (мангустин)",category:"veg_fruit",kcal:73,protein:0.4,fat:0.6,carbs:18,fiber:5,gi:25,servingSize:"100 г",micros:{Ca:12,Fe:0.3,Mg:13,P:8,K:48,VitC:2.9,VitB9:31,Xanthones:100}},
  {id:"fruit_carambola",name:"Карамбола (старфрут)",category:"veg_fruit",kcal:31,protein:1,fat:0.3,carbs:6.5,fiber:2.8,gi:30,servingSize:"100 г",micros:{Ca:3,Fe:0.1,Mg:10,P:12,K:133,VitC:34,VitB5:0.4}},
  {id:"fruit_kiwano",name:"Кивано (рогатая дыня)",category:"veg_fruit",kcal:44,protein:1.8,fat:1.3,carbs:7.5,fiber:1.5,gi:30,servingSize:"150 г",micros:{Ca:13,Fe:1.1,Mg:40,P:37,K:123,VitC:5,VitA:120,VitB6:0.1}},
  {id:"fruit_pepino",name:"Пепино (дынная груша)",category:"veg_fruit",kcal:30,protein:0.6,fat:0.1,carbs:7,fiber:1,gi:30,servingSize:"150 г",micros:{Ca:8,Fe:0.3,P:15,K:150,VitC:25,VitA:70}},
  {id:"fruit_lychee",name:"Личи (свежий)",category:"veg_fruit",kcal:66,protein:0.8,fat:0.4,carbs:17,fiber:1.3,gi:50,servingSize:"100 г",micros:{Ca:5,Fe:0.3,Mg:10,P:31,K:171,VitC:71,VitB6:0.1,Cu:0.1}},
  {id:"fruit_rambutan",name:"Рамбутан",category:"veg_fruit",kcal:82,protein:0.7,fat:0.2,carbs:21,fiber:0.9,gi:55,servingSize:"100 г",micros:{Ca:22,Fe:0.4,Mg:7,P:9,K:42,VitC:4.9,VitB3:1.3}},
  {id:"fruit_dragon_fruit",name:"Питайя (драгонфрут)",category:"veg_fruit",kcal:57,protein:1.1,fat:0.4,carbs:13,fiber:1.5,gi:35,servingSize:"150 г",micros:{Ca:11,Fe:0.3,Mg:36,P:25,K:216,VitC:4.5,VitB2:0.1,Mn:0.2}},
  {id:"fruit_persimmon_sharon",name:"Шарон (гибрид хурмы)",category:"veg_fruit",kcal:70,protein:0.5,fat:0.2,carbs:17,fiber:3,gi:50,servingSize:"200 г",micros:{Ca:6,Fe:0.2,Mg:7,P:15,K:180,VitC:6,VitA:150}},
  {id:"fruit_tamarind",name:"Тамаринд (свежий)",category:"veg_fruit",kcal:239,protein:2.8,fat:0.6,carbs:62,fiber:5,gi:23,servingSize:"50 г",micros:{Ca:74,Fe:2.8,Mg:92,P:113,K:628,VitC:3.5,VitB1:0.4,VitB3:1.9}},
  {id:"fruit_feijoa",name:"Фейхоа",category:"veg_fruit",kcal:55,protein:0.8,fat:0.4,carbs:13,fiber:3.5,gi:30,servingSize:"100 г",micros:{Ca:17,Fe:0.1,Mg:9,P:19,K:172,VitC:33,VitB9:23,I:20}},
  {id:"fruit_medlar",name:"Мушмула",category:"veg_fruit",kcal:47,protein:0.4,fat:0.2,carbs:12,fiber:2,gi:30,servingSize:"100 г",micros:{Ca:20,Fe:0.4,Mg:10,P:20,K:250,VitC:2,VitA:200}},
  {id:"dried_apple_rings",name:"Яблочные кольца (сушёные)",category:"carb",kcal:275,protein:1,fat:0.5,carbs:66,fiber:7.5,gi:35,servingSize:"40 г",micros:{Ca:14,Fe:1.1,Mg:9,P:25,K:320,VitC:2,VitB9:4}},
  {id:"dried_banana_chips",name:"Банановые чипсы (сушёные)",category:"carb",kcal:390,protein:2,fat:18,carbs:58,fiber:6,gi:55,servingSize:"40 г",micros:{Ca:10,Fe:1,Mg:35,P:50,K:520,VitC:1,VitB6:0.3}},
  {id:"dried_pear",name:"Груша сушёная",category:"carb",kcal:270,protein:1.5,fat:0.5,carbs:65,fiber:7,gi:35,servingSize:"40 г",micros:{Ca:10,Fe:1.2,Mg:20,P:40,K:500,VitC:2}},
  {id:"dried_peach",name:"Персик сушёный (курага персиковая)",category:"carb",kcal:280,protein:3,fat:0.5,carbs:68,fiber:8,gi:40,servingSize:"40 г",micros:{Ca:28,Fe:3,Mg:40,P:80,K:900,VitA:1000,VitB3:2.5}},
  {id:"dried_mango",name:"Манго сушёное",category:"carb",kcal:320,protein:2.5,fat:1.5,carbs:76,fiber:5,gi:50,servingSize:"40 г",micros:{Ca:20,Fe:0.5,Mg:25,P:40,K:500,VitA:2000,VitC:5}},
  {id:"dried_papaya",name:"Папайя сушёная",category:"carb",kcal:310,protein:0.5,fat:0.2,carbs:78,fiber:6,gi:55,servingSize:"40 г",micros:{Ca:20,Fe:0.5,Mg:15,P:20,K:350,VitA:500,VitC:10}},
  {id:"dried_cranberry",name:"Клюква сушёная (подслащ.)",category:"carb",kcal:270,protein:0.3,fat:0.5,carbs:67,fiber:5,gi:40,servingSize:"40 г",micros:{Ca:10,Fe:0.5,Mg:7,P:15,K:120,VitC:1,VitA:40}},
  {id:"dried_blueberry",name:"Черника сушёная",category:"carb",kcal:280,protein:0.7,fat:1,carbs:67,fiber:8,gi:35,servingSize:"40 г",micros:{Ca:5,Fe:0.5,Mg:10,P:20,K:120,VitC:2,VitA:200,Anthocyanins:200}},
  {id:"dried_kiwi",name:"Киви сушёное",category:"carb",kcal:300,protein:2.5,fat:1.5,carbs:70,fiber:8,gi:40,servingSize:"40 г",micros:{Ca:25,Fe:0.6,Mg:20,P:50,K:800,VitC:15,VitE:2}},
  {id:"dried_pineapple",name:"Ананас сушёный (без сахара)",category:"carb",kcal:290,protein:0.8,fat:0.2,carbs:73,fiber:5,gi:55,servingSize:"40 г",micros:{Ca:10,Fe:0.5,Mg:15,P:15,K:200,VitC:8,Mn:1}},
  {id:"cheese_brie",name:"Сыр бри",category:"dairy",kcal:334,protein:21,fat:28,carbs:0.5,fiber:0,gi:0,servingSize:"30 г",micros:{Ca:184,P:188,Zn:2.5,Se:15,VitA:170,VitB12:1.5,VitB2:0.5}},
  {id:"cheese_camembert",name:"Сыр камамбер",category:"dairy",kcal:300,protein:20,fat:24,carbs:0.5,fiber:0,gi:0,servingSize:"30 г",micros:{Ca:190,P:170,Zn:2.5,Se:15,VitA:240,VitB12:1.3,VitB2:0.6}},
  {id:"cheese_gouda",name:"Сыр гауда",category:"dairy",kcal:356,protein:25,fat:27,carbs:2.2,fiber:0,gi:0,servingSize:"30 г",micros:{Ca:220,P:160,Zn:3,Se:12,VitA:200,VitB12:1.7,VitK:2.4,mg:10}},
  {id:"cheese_edam",name:"Сыр эдам",category:"dairy",kcal:357,protein:25,fat:28,carbs:1.5,fiber:0,gi:0,servingSize:"30 г",micros:{Ca:220,P:160,Zn:3,Se:13,VitA:230,VitB12:1.6,Na:300}},
  {id:"cheese_emmental",name:"Сыр эмменталь",category:"dairy",kcal:380,protein:28,fat:30,carbs:1,fiber:0,gi:0,servingSize:"30 г",micros:{Ca:310,P:220,Zn:3.5,Se:12,VitA:300,VitB12:2,VitK:2.7}},
  {id:"cheese_gruyere",name:"Сыр грюйер",category:"dairy",kcal:413,protein:30,fat:32,carbs:1,fiber:0,gi:0,servingSize:"30 г",micros:{Ca:310,P:220,Zn:4,Se:15,VitA:270,VitB12:1.6,Na:330}},
  {id:"cheese_halloumi",name:"Сыр халлуми (гриль)",category:"dairy",kcal:321,protein:22,fat:25,carbs:2,fiber:0,gi:0,servingSize:"50 г",micros:{Ca:200,P:150,Zn:2.5,Na:1200,Se:10}},
  {id:"cheese_paneer",name:"Панир (индийский сыр)",category:"dairy",kcal:280,protein:20,fat:20,carbs:2,fiber:0,gi:0,servingSize:"100 г",micros:{Ca:150,P:150,Zn:1.5,Mg:15,VitA:100}},
  {id:"cheese_sulguni",name:"Сыр сулугуни",category:"dairy",kcal:285,protein:20,fat:22,carbs:1,fiber:0,gi:0,servingSize:"30 г",micros:{Ca:300,P:180,Zn:2,VitA:200,Na:400}},
  {id:"cheese_adygei",name:"Сыр адыгейский",category:"dairy",kcal:240,protein:19,fat:17,carbs:1.5,fiber:0,gi:0,servingSize:"50 г",micros:{Ca:260,P:130,Zn:2,Mg:15,VitB2:0.3,Na:350}},
  {id:"cheese_brynza",name:"Брынза (овечья)",category:"dairy",kcal:260,protein:15,fat:21,carbs:2,fiber:0,gi:0,servingSize:"50 г",micros:{Ca:500,P:350,Zn:3.5,VitA:250,VitB2:0.4,Na:1200}},
  {id:"cheese_mascarpone",name:"Маскарпоне",category:"dairy",kcal:390,protein:4,fat:42,carbs:4,fiber:0,gi:0,servingSize:"30 г",micros:{Ca:100,VitA:250,Na:60}},
  {id:"cheese_parmesan_grated",name:"Пармезан (тёртый)",category:"dairy",kcal:431,protein:38,fat:29,carbs:4.5,fiber:0,gi:0,servingSize:"15 г",micros:{Ca:370,P:220,Zn:4,Se:17,VitA:200,VitB12:1.5,Na:500}},
  {id:"cheese_processed",name:"Сыр плавленый",category:"dairy",kcal:305,protein:16,fat:25,carbs:5,fiber:0,gi:0,servingSize:"30 г",micros:{Ca:200,P:140,Zn:1.5,VitA:150,Na:800}},
  {id:"kefir_full_fat",name:"Кефир 3.2%",category:"dairy",kcal:56,protein:3.3,fat:3.2,carbs:4,fiber:0,gi:0,servingSize:"250 мл",micros:{Ca:120,P:90,Mg:12,Zn:0.5,VitB2:0.17,VitB12:0.4,VitA:50}},
  {id:"tvorog_grainy",name:"Творог зернёный (5%)",category:"dairy",kcal:130,protein:17,fat:5,carbs:3,fiber:0,gi:0,servingSize:"150 г",micros:{Ca:130,P:150,Zn:1,Mg:20,VitB2:0.3,Se:15}},
  {id:"whey_liquid",name:"Сыворотка молочная (жидкая)",category:"dairy",kcal:27,protein:0.9,fat:0.4,carbs:5,fiber:0,gi:0,servingSize:"250 мл",micros:{Ca:100,P:50,Mg:8,Zn:0.1,K:160,VitB2:0.15,VitB12:0.3}},
  {id:"ayran",name:"Айран (натуральный)",category:"dairy",kcal:30,protein:2,fat:1.5,carbs:2.5,fiber:0,gi:0,servingSize:"250 мл",micros:{Ca:100,P:70,Na:400,Zn:0.3}},
  {id:"tan",name:"Тан",category:"dairy",kcal:25,protein:1.5,fat:1,carbs:2.5,fiber:0,gi:0,servingSize:"250 мл",micros:{Ca:80,P:60,Na:600,Zn:0.3,Mg:10}},
  {id:"matsoni",name:"Мацони (грузинский йогурт)",category:"dairy",kcal:68,protein:3.5,fat:3.5,carbs:5,fiber:0,gi:0,servingSize:"200 мл",micros:{Ca:110,P:90,Mg:15,Zn:0.5,VitB2:0.18,VitB12:0.4}},
  {id:"kumys",name:"Кумыс",category:"dairy",kcal:40,protein:2,fat:1.5,carbs:5,fiber:0,gi:0,servingSize:"250 мл",micros:{Ca:90,P:80,Mg:10,Zn:0.3,VitB1:0.1,VitB2:0.12,AlcoholTraces:1}},
  {id:"buttermilk",name:"Пахта (1%)",category:"dairy",kcal:40,protein:3.3,fat:1,carbs:4.8,fiber:0,gi:0,servingSize:"250 мл",micros:{Ca:115,P:90,Mg:10,K:150,Zn:0.4,VitB2:0.15}},
  {id:"sour_cream_20",name:"Сметана 20%",category:"dairy",kcal:206,protein:2.5,fat:20,carbs:3.5,fiber:0,gi:0,servingSize:"30 г",micros:{Ca:85,P:60,VitA:150,VitB2:0.1,Zn:0.3}},
  {id:"yogurt_greek_5",name:"Греческий йогурт (5%)",category:"dairy",kcal:95,protein:8,fat:5,carbs:4.5,fiber:0,gi:0,servingSize:"200 мл",micros:{Ca:120,P:100,Zn:0.5,Mg:12,VitB2:0.2,VitB12:0.5}},
  {id:"milk_goat",name:"Молоко козье",category:"dairy",kcal:69,protein:3.6,fat:4,carbs:4.5,fiber:0,gi:0,servingSize:"250 мл",micros:{Ca:134,P:111,Mg:14,Zn:0.3,VitA:130,VitD:1.3,Se:3}},
  {id:"milk_sheep",name:"Молоко овечье",category:"dairy",kcal:108,protein:6,fat:7,carbs:5,fiber:0,gi:0,servingSize:"250 мл",micros:{Ca:193,P:158,Mg:18,Zn:0.6,VitA:200,VitB12:1,VitD:2}},
  {id:"condensed_milk_full",name:"Молоко сгущённое цельное",category:"dairy",kcal:321,protein:7.2,fat:8.5,carbs:55,fiber:0,gi:0,servingSize:"30 г",micros:{Ca:100,P:90,Zn:0.5,VitA:70}},
  {id:"cream_33",name:"Сливки 33%",category:"dairy",kcal:322,protein:2.5,fat:33,carbs:3.5,fiber:0,gi:0,servingSize:"30 мл",micros:{Ca:70,P:60,VitA:250,VitE:1.5}},
  {id:"cream_sour_10",name:"Сметана 10%",category:"dairy",kcal:119,protein:3,fat:10,carbs:3.5,fiber:0,gi:0,servingSize:"30 г",micros:{Ca:90,P:70,VitA:80,VitB2:0.1}},
  {id:"ice_cream_plombir",name:"Пломбир (мороженое)",category:"dairy",kcal:230,protein:4,fat:15,carbs:21,fiber:0,gi:0,servingSize:"80 г",micros:{Ca:120,P:100,VitA:150,VitB2:0.2,Zn:0.5}},
  {id:"oil_grapeseed",name:"Масло виноградных косточек",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл (1 ст.л.)",micros:{VitE:14,Omega6:65000,OleicAcid:16000}},
  {id:"oil_rice_bran",name:"Масло рисовых отрубей",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл (1 ст.л.)",micros:{VitE:13,Omega6:35000,OleicAcid:42000,Oryzanol:2000}},
  {id:"oil_peanut",name:"Масло арахисовое",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл (1 ст.л.)",micros:{VitE:15,Omega6:30000,OleicAcid:45000}},
  {id:"oil_corn",name:"Масло кукурузное",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл (1 ст.л.)",micros:{VitE:14,Omega6:53000,Phytosterol:1000}},
  {id:"oil_sunflower_unrefined",name:"Подсолнечное масло нерафинированное",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл (1 ст.л.)",micros:{VitE:41,Omega6:60000,OleicAcid:25000,VitK:5}},
  {id:"oil_camelina",name:"Рыжиковое масло",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл (1 ст.л.)",micros:{VitE:10,Omega3:35000,Omega6:17000,OleicAcid:15000,VitA:150}},
  {id:"oil_sesame",name:"Масло кунжутное (тёмное)",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл (1 ст.л.)",micros:{VitE:14,Omega6:40000,OleicAcid:40000,Sesamol:200,Ca:30}},
  {id:"oil_pumpkin_seed",name:"Тыквенное масло",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл (1 ст.л.)",micros:{VitE:15,Omega3:500,Omega6:45000,OleicAcid:30000,Zn:2,Phytosterol:2000}},
  {id:"oil_hemp",name:"Конопляное масло",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл (1 ст.л.)",micros:{VitE:10,Omega3:17000,Omega6:56000,GLA:2000,VitD:1}},
  {id:"oil_mustard",name:"Горчичное масло",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл (1 ст.л.)",micros:{VitE:9,Omega3:5000,OleicAcid:25000,ErucicAcid:30000,Se:5}},
  {id:"nut_kukui",name:"Орех кукуи (свечной)",category:"fat",kcal:626,protein:8,fat:64,carbs:10,fiber:7,gi:0,servingSize:"30 г",micros:{Ca:30,Fe:2,Mg:90,P:140,K:440,Zn:2,Se:5,VitB1:0.4,Mn:2}},
  {id:"nut_pili",name:"Орех пили",category:"fat",kcal:719,protein:11,fat:79,carbs:4,fiber:3,gi:0,servingSize:"30 г",micros:{Ca:40,Fe:1.5,Mg:130,P:220,K:410,Zn:2.5,VitE:5,Cu:0.5}},
  {id:"seed_poppy",name:"Семена мака",category:"fat",kcal:525,protein:18,fat:42,carbs:28,fiber:19,gi:0,servingSize:"15 г",micros:{Ca:1400,Fe:10,Mg:350,P:870,K:700,Zn:7,Se:13,Mn:6}},
  {id:"seed_fennel",name:"Семена фенхеля",category:"fat",kcal:345,protein:15,fat:15,carbs:52,fiber:40,gi:0,servingSize:"10 г",micros:{Ca:119,Fe:18,Mg:38,P:50,K:170,Zn:3.5,VitC:2,Mn:6}},
  {id:"seed_anise",name:"Семена аниса",category:"fat",kcal:337,protein:18,fat:16,carbs:50,fiber:14,gi:0,servingSize:"10 г",micros:{Ca:65,Fe:37,Mg:17,P:44,K:144,Zn:5,Se:0.5,Mn:2}},
  {id:"seed_celery",name:"Семена сельдерея",category:"fat",kcal:392,protein:18,fat:25,carbs:40,fiber:12,gi:0,servingSize:"10 г",micros:{Ca:176,Fe:45,Mg:44,P:55,K:140,Zn:7,Se:1.5,Mn:7}},
  {id:"seed_hulled_hemp",name:"Семена конопли очищенные",category:"fat",kcal:553,protein:32,fat:49,carbs:8,fiber:4,gi:0,servingSize:"30 г",micros:{Fe:7,Mg:700,P:1650,K:1200,Zn:10,Se:20,Omega3:7000,GLA:1000}},
  {id:"nut_baru",name:"Орех бару",category:"fat",kcal:540,protein:28,fat:38,carbs:24,fiber:18,gi:0,servingSize:"30 г",micros:{Ca:90,Fe:5,Mg:160,P:500,K:1000,Zn:4,VitE:3,Mn:2.5}},
  {id:"seed_nigella",name:"Чёрный тмин (калонджи)",category:"fat",kcal:375,protein:16,fat:22,carbs:50,fiber:38,gi:0,servingSize:"10 г",micros:{Ca:93,Fe:10,Mg:26,P:50,K:135,Zn:1.2,Thymoquinone:100}},
  {id:"seed_cumin",name:"Зира (кумин)",category:"fat",kcal:375,protein:18,fat:22,carbs:45,fiber:11,gi:0,servingSize:"10 г",micros:{Ca:93,Fe:66,Mg:37,P:50,K:179,Zn:4.8,Mn:3,Se:0.5}},
  {id:"ru_kasha_buckwheat_meat",name:"Каша гречневая с мясом",category:"other",kcal:150,protein:7,fat:6,carbs:18,fiber:3,gi:45,servingSize:"250 г",micros:{Fe:2,Zn:2,P:130,Mg:50,VitB3:3}},
  {id:"ru_stuffed_peppers",name:"Перец фаршированный (мясо+рис)",category:"other",kcal:120,protein:7,fat:5,carbs:12,fiber:2,gi:45,servingSize:"2 шт (300 г)",micros:{Ca:20,Fe:1.5,Zn:1.5,P:80,VitC:40,VitA:500}},
  {id:"ru_stuffed_cabbage",name:"Голубцы (мясо+рис в капусте)",category:"other",kcal:110,protein:6,fat:5,carbs:11,fiber:3,gi:45,servingSize:"2 шт (300 г)",micros:{Ca:40,Fe:1.2,Zn:1.5,P:80,VitC:25,VitA:400,VitK:40}},
  {id:"ru_beet_salad",name:"Салат из свёклы (с чесноком и майонезом)",category:"other",kcal:130,protein:2,fat:8,carbs:14,fiber:3,gi:35,servingSize:"150 г",micros:{Ca:30,Fe:1,P:40,K:300,VitC:10,VitA:50,VitB9:50}},
  {id:"ru_vinaigrette",name:"Винегрет",category:"other",kcal:90,protein:2,fat:4,carbs:13,fiber:3,gi:45,servingSize:"200 г",micros:{Ca:30,Fe:1.2,P:50,K:350,VitC:12,VitA:400,VitB9:30}},
  {id:"ru_shashlyk_pork",name:"Шашлык из свинины",category:"other",kcal:250,protein:20,fat:18,carbs:2,fiber:0,gi:0,servingSize:"200 г",micros:{Fe:2,Zn:3.5,P:200,VitB1:0.7,VitB3:5}},
  {id:"ru_kholodets",name:"Холодец (студень говяжий)",category:"other",kcal:180,protein:15,fat:12,carbs:2,fiber:0,gi:0,servingSize:"200 г",micros:{Ca:50,Fe:2,Zn:3,P:180,Glycine:5000,Proline:4000,Collagen:8000}},
  {id:"ru_blini_meat",name:"Блины с мясом",category:"other",kcal:230,protein:10,fat:10,carbs:26,fiber:1.5,gi:60,servingSize:"2 шт (200 г)",micros:{Ca:60,Fe:1.5,Zn:1.5,P:100,VitB1:0.1,Cholesterol:60}},
  {id:"ru_dumplings_meat",name:"Пельмени (свинина+говядина варёные)",category:"other",kcal:250,protein:12,fat:10,carbs:28,fiber:1.5,gi:55,servingSize:"200 г",micros:{Ca:30,Fe:1.5,Zn:1.5,P:100,VitB1:0.15,VitB3:3}},
  {id:"ru_okroshka_kvas",name:"Окрошка на квасе (с колбасой)",category:"other",kcal:65,protein:4,fat:3,carbs:6,fiber:1,gi:35,servingSize:"300 мл",micros:{Ca:30,Fe:0.5,P:70,K:250,VitC:10,VitB1:0.1}},
  {id:"ru_borscht",name:"Борщ (со сметаной)",category:"other",kcal:70,protein:3,fat:3,carbs:8,fiber:2,gi:45,servingSize:"300 мл",micros:{Ca:40,Fe:1.2,P:60,K:280,VitC:15,VitA:400,VitK:30}},
  {id:"ru_solyanka",name:"Солянка мясная сборная",category:"other",kcal:100,protein:6,fat:5,carbs:7,fiber:1,gi:45,servingSize:"300 мл",micros:{Ca:30,Fe:1.5,Zn:2,P:80,K:300,VitC:10,Na:800}},
  {id:"int_pasta_bolognese",name:"Паста болоньезе",category:"other",kcal:170,protein:8,fat:6,carbs:22,fiber:3,gi:50,servingSize:"300 г",micros:{Ca:40,Fe:2,Zn:1.5,P:100,VitA:300,VitB3:3,Lycopene:5000}},
  {id:"int_pad_thai",name:"Пад тай (с курицей)",category:"other",kcal:200,protein:10,fat:8,carbs:24,fiber:2,gi:55,servingSize:"300 г",micros:{Ca:30,Fe:1.5,Zn:1,P:100,K:300,Na:600}},
  {id:"int_tom_yum",name:"Том ям (с креветками)",category:"other",kcal:90,protein:8,fat:4,carbs:7,fiber:1,gi:35,servingSize:"300 мл",micros:{Ca:40,Fe:1,Zn:1,P:100,K:350,VitC:15,Na:700}},
  {id:"int_miso_soup",name:"Мисо-суп (с тофу)",category:"other",kcal:45,protein:3,fat:1.5,carbs:5,fiber:1,gi:35,servingSize:"300 мл",micros:{Ca:40,Fe:0.8,Zn:0.5,P:60,K:150,Na:800,Isoflavones:20}},
  {id:"int_bibimbap",name:"Бибимбап (с говядиной)",category:"other",kcal:180,protein:12,fat:7,carbs:18,fiber:3,gi:50,servingSize:"350 г",micros:{Ca:50,Fe:2,Zn:2,P:120,K:400,VitC:15,VitA:500}},
  {id:"int_chicken_shawarma",name:"Шаурма с курицей",category:"other",kcal:220,protein:15,fat:10,carbs:18,fiber:2,gi:50,servingSize:"250 г",micros:{Ca:60,Fe:1.5,Zn:2,P:130,VitC:10,VitA:300,Na:600}},
  {id:"int_doner_kebab",name:"Донер-кебаб (с телятиной)",category:"other",kcal:240,protein:16,fat:12,carbs:18,fiber:2,gi:50,servingSize:"250 г",micros:{Ca:50,Fe:2,Zn:2.5,P:140,VitC:8,VitA:250,Na:700}},
  {id:"int_curry_chicken",name:"Карри с курицей (индийский)",category:"other",kcal:170,protein:15,fat:8,carbs:10,fiber:2,gi:45,servingSize:"300 г",micros:{Ca:40,Fe:2,Zn:1.5,P:120,K:400,VitC:10,TurmericCurcumin:100}},
  {id:"int_sushi_salmon",name:"Суши (лосось, 6 шт)",category:"other",kcal:180,protein:10,fat:4,carbs:28,fiber:1,gi:55,servingSize:"6 шт (180 г)",micros:{Ca:20,Fe:0.5,Zn:0.5,P:80,Omega3:500,Na:400,I:15}},
  {id:"int_pho_bo",name:"Фо бо (суп с говядиной)",category:"other",kcal:80,protein:6,fat:2,carbs:10,fiber:1,gi:40,servingSize:"400 мл",micros:{Ca:30,Fe:1.5,Zn:1,P:70,K:250,Na:700,VitB3:2}},
  {id:"int_burrito_chicken",name:"Буррито с курицей",category:"other",kcal:210,protein:14,fat:8,carbs:20,fiber:4,gi:50,servingSize:"250 г",micros:{Ca:80,Fe:2,Zn:1.5,P:120,VitC:10,VitA:300,Na:600}},
  {id:"int_falafel_plate",name:"Фалафель (5 шт с соусом)",category:"other",kcal:250,protein:10,fat:12,carbs:28,fiber:6,gi:45,servingSize:"200 г",micros:{Ca:50,Fe:3,Zn:1.5,P:120,K:300,VitC:5,VitB9:50}},
  {id:"int_hummus",name:"Хумус (нутовая паста)",category:"other",kcal:166,protein:8,fat:10,carbs:14,fiber:6,gi:30,servingSize:"100 г",micros:{Ca:50,Fe:2.5,Zn:1.5,P:110,K:230,VitB9:60,Cu:0.5,Mn:0.8}},
  {id:"int_ratatouille",name:"Рататуй (овощное рагу)",category:"other",kcal:65,protein:1.5,fat:3,carbs:9,fiber:2.5,gi:35,servingSize:"250 г",micros:{Ca:30,Fe:0.6,P:40,K:350,VitC:25,VitA:800,VitK:15,Lycopene:5000}},
  {id:"sauerkraut",name:"Квашеная капуста",category:"veg_fruit",kcal:19,protein:1,fat:0.1,carbs:4,fiber:2.5,gi:15,servingSize:"150 г",micros:{Ca:30,Fe:0.7,Mg:13,P:20,K:170,VitC:20,VitK:13,Probiotics:5}},
  {id:"kimchi",name:"Кимчи",category:"veg_fruit",kcal:24,protein:1.5,fat:0.5,carbs:4,fiber:2,gi:15,servingSize:"100 г",micros:{Ca:40,Fe:0.9,Mg:12,P:30,K:150,VitC:20,VitA:300,VitK:20,Probiotics:5,Capsaicin:5,Na:600}},
  {id:"pickled_cucumber",name:"Огурцы солёные",category:"veg_fruit",kcal:11,protein:0.5,fat:0.2,carbs:2,fiber:0.5,gi:15,servingSize:"100 г",micros:{Ca:15,Na:800,K:120,VitK:15}},
  {id:"pickled_tomatoes",name:"Помидоры солёные",category:"veg_fruit",kcal:15,protein:1,fat:0.2,carbs:3,fiber:1,gi:15,servingSize:"100 г",micros:{Ca:15,Na:600,K:150,VitC:5,Lycopene:4000}},
  {id:"seaweed_wakame",name:"Вакаме (водоросли сушёные)",category:"veg_fruit",kcal:280,protein:16,fat:2,carbs:50,fiber:30,gi:0,servingSize:"10 г (сухие)",micros:{Ca:150,Fe:7,Mg:107,P:80,I:3500,K:450,Zn:2,VitK:3,Fucoxanthin:50}},
  {id:"seaweed_kombu",name:"Комбу (сушёная)",category:"veg_fruit",kcal:240,protein:10,fat:1,carbs:48,fiber:35,gi:0,servingSize:"10 г (сухая)",micros:{Ca:88,Fe:5,Mg:80,I:15000,K:800,Zn:1,VitB9:18,Fucoidan:100}},
  {id:"seaweed_nori",name:"Нори (сушёные листы)",category:"veg_fruit",kcal:300,protein:40,fat:4,carbs:45,fiber:36,gi:0,servingSize:"5 г (3 листа)",micros:{Ca:40,Fe:2,Mg:100,P:150,I:2000,K:400,VitA:500,VitB12:0.5,Zn:2}},
  {id:"brewers_yeast",name:"Дрожжи пивные (сухие)",category:"other",kcal:330,protein:48,fat:4,carbs:35,fiber:22,gi:0,servingSize:"15 г",micros:{Ca:200,Fe:17,Mg:230,P:1300,K:2000,Zn:10,Se:60,VitB1:15,VitB2:5,VitB3:40,VitB5:12,VitB6:5,VitB9:700,VitB12:1}}
,
  {id:"pork_knuckle",name:"Свиная рулька (варёная)",category:"protein",kcal:290,protein:20,fat:22,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{Fe:2,Zn:3.5,P:180,Glycine:3000,Proline:2500}},
  {id:"pork_ears",name:"Свиные уши (варёные)",category:"protein",kcal:230,protein:22,fat:15,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Ca:100,Collagen:12000,Glycine:8000,Proline:5000}},
  {id:"lamb_tongue",name:"Бараний язык (варёный)",category:"protein",kcal:210,protein:15,fat:16,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:3.2,Zn:3.5,VitB12:3.5,P:170,Cholesterol:85}},
  {id:"lamb_kidney",name:"Бараньи почки (варёные)",category:"protein",kcal:110,protein:17,fat:3.5,carbs:1,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:6,Zn:3,Se:130,VitB12:25,VitB2:2.5,P:250}},
  {id:"lamb_heart",name:"Баранье сердце (варёное)",category:"protein",kcal:135,protein:15,fat:7.5,carbs:2,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:6.5,Zn:3,VitB12:7,VitB5:2.2,P:210,K:260}},
  {id:"frog_legs",name:"Лягушачьи лапки",category:"protein",kcal:73,protein:16,fat:0.3,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:230,K:280,Mg:25,Zn:1.5,Se:15}},
  {id:"escargot",name:"Улитки (эскарго)",category:"protein",kcal:90,protein:16,fat:1.5,carbs:2,fiber:0,gi:0,servingSize:"100 г",micros:{Ca:200,Mg:250,P:150,K:380,Zn:1.5}},
  {id:"whitebait",name:"Мальки/белая рыбка (жареные)",category:"protein",kcal:280,protein:20,fat:22,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{Ca:200,P:400,VitD:5,Omega3:500,Se:25}},
  {id:"tilapia",name:"Тилапия (запечённая)",category:"protein",kcal:128,protein:26,fat:3,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:200,K:380,Mg:30,Se:40,VitB12:1.9,Omega3:200}},
  {id:"swordfish",name:"Меч-рыба (стейк жареный)",category:"protein",kcal:200,protein:25,fat:10,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:280,K:480,Mg:35,Se:65,VitB12:2,VitD:7,Omega3:800}},
  {id:"shark_steak",name:"Акула (стейк варёный)",category:"protein",kcal:130,protein:21,fat:4.5,carbs:0,fiber:0,gi:0,servingSize:"150 г",micros:{P:200,K:160,Mg:50,Se:35,VitB12:1.5}},
  {id:"eel_smoked",name:"Угорь копчёный",category:"protein",kcal:350,protein:18,fat:25,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{P:200,K:250,VitA:1800,VitD:10,Omega3:1500,Na:1200}},
  {id:"cod_roe_canned",name:"Икра трески (консервированная)",category:"protein",kcal:170,protein:22,fat:8,carbs:2,fiber:0,gi:0,servingSize:"30 г",micros:{P:280,K:200,Mg:15,VitD:5,Omega3:1000,Na:700}},
  {id:"crab_meat_canned",name:"Краб консервированный",category:"protein",kcal:85,protein:17,fat:1,carbs:0,fiber:0,gi:0,servingSize:"100 г",micros:{P:200,K:250,Zn:4,Se:40,Cu:0.5,Na:800}},
  {id:"cockles",name:"Сердцевидки (варёные)",category:"protein",kcal:54,protein:9,fat:0.5,carbs:3,fiber:0,gi:0,servingSize:"100 г",micros:{Fe:8,Zn:2,VitB12:15,Se:20,P:150}},
  {id:"bread_protein",name:"Хлеб белковый (фитнес-хлеб)",category:"grain",kcal:220,protein:18,fat:4,carbs:28,fiber:10,gi:40,servingSize:"50 г",micros:{Fe:2.5,Ca:60,Mg:50,P:180,Zn:1.5}},
  {id:"bread_crispbread",name:"Хрустящие хлебцы (ржаные)",category:"grain",kcal:350,protein:10,fat:2,carbs:65,fiber:16,gi:45,servingSize:"30 г",micros:{Fe:3,Mg:80,P:250,Zn:2.5,Se:10}},
  {id:"cereal_amaranth_popped",name:"Амарант воздушный (поп-амарант)",category:"grain",kcal:385,protein:14,fat:6,carbs:66,fiber:9,gi:35,servingSize:"30 г (сухой)",micros:{Fe:7,Mg:260,P:520,Zn:3.5,Ca:150}},
  {id:"cereal_brown_rice_porridge",name:"Каша рисовая бурая",category:"grain",kcal:115,protein:2.5,fat:0.9,carbs:23,fiber:1.8,gi:50,servingSize:"200 г",micros:{Fe:0.5,Mg:43,P:83,Zn:0.6,Se:11}},
  {id:"cereal_corn_grits",name:"Каша кукурузная (мамалыга)",category:"grain",kcal:100,protein:2.5,fat:1.5,carbs:19,fiber:2,gi:55,servingSize:"200 г",micros:{Fe:0.5,Mg:15,P:50,Zn:0.4,VitB3:1.5}},
  {id:"cereal_lentil_red_porridge",name:"Каша из красной чечевицы",category:"grain",kcal:110,protein:8,fat:0.5,carbs:19,fiber:4,gi:30,servingSize:"200 г",micros:{Fe:2.5,Zn:1.5,P:120,Mg:40,VitB9:150}},
  {id:"cereal_chickpea_porridge",name:"Каша нутовая",category:"grain",kcal:130,protein:7.5,fat:2.5,carbs:20,fiber:5,gi:30,servingSize:"200 г",micros:{Fe:2.5,Zn:1.5,P:170,Mg:50,VitB9:170}},
  {id:"pasta_conchiglie",name:"Конкилье (ракушки варёные)",category:"grain",kcal:145,protein:5,fat:1,carbs:28,fiber:1.5,gi:50,servingSize:"200 г",micros:{Fe:1.2,Zn:0.8,P:100}},
  {id:"pasta_fusilli_tricolore",name:"Фузилли триколоре (варёные)",category:"grain",kcal:155,protein:6,fat:2,carbs:28,fiber:3,gi:50,servingSize:"200 г",micros:{Fe:1.5,Zn:1,P:120,VitA:300}},
  {id:"pasta_tortellini_cheese",name:"Тортеллини с сыром (варёные)",category:"grain",kcal:230,protein:10,fat:7,carbs:32,fiber:2,gi:55,servingSize:"200 г",micros:{Ca:120,Fe:1,Zn:1,P:120}},
  {id:"veg_artichoke",name:"Артишок (варёный)",category:"veg_fruit",kcal:47,protein:3.5,fat:0.2,carbs:10,fiber:5.5,gi:20,servingSize:"150 г (1 шт)",micros:{Ca:21,Fe:1.3,Mg:60,P:90,K:370,VitC:12,VitB9:68,Inulin:4000}},
  {id:"veg_asparagus_green",name:"Спаржа зелёная (на гриле)",category:"veg_fruit",kcal:25,protein:2.5,fat:0.2,carbs:4,fiber:2,gi:15,servingSize:"150 г",micros:{Ca:24,Fe:2,Mg:14,P:52,K:202,VitC:8,VitA:750,VitK:41,VitB9:52}},
  {id:"veg_fennel_bulb",name:"Фенхель (луковица свежая)",category:"veg_fruit",kcal:31,protein:1.2,fat:0.2,carbs:7,fiber:3,gi:15,servingSize:"100 г",micros:{Ca:49,Fe:0.7,Mg:17,P:50,K:414,VitC:12,VitA:48,VitB9:27}},
  {id:"veg_bean_sprouts",name:"Ростки сои (свежие)",category:"veg_fruit",kcal:122,protein:13,fat:6.7,carbs:10,fiber:2,gi:25,servingSize:"100 г",micros:{Ca:67,Fe:2.1,Mg:72,P:164,K:484,VitC:15,VitB9:172}},
  {id:"veg_bamboo_shoots",name:"Побеги бамбука (варёные)",category:"veg_fruit",kcal:12,protein:1.5,fat:0.3,carbs:2.5,fiber:1.5,gi:15,servingSize:"150 г",micros:{Ca:13,Fe:0.3,Mg:5,P:20,K:533,VitB6:0.1}},
  {id:"veg_capers",name:"Каперсы (консервированные)",category:"veg_fruit",kcal:23,protein:2.4,fat:0.9,carbs:4.9,fiber:3,gi:15,servingSize:"15 г",micros:{Ca:40,Fe:1.7,Mg:33,P:10,K:40,Na:1200,Quercetin:50}},
  {id:"veg_hearts_of_palm",name:"Сердцевина пальмы (консервированная)",category:"veg_fruit",kcal:28,protein:2.5,fat:0.5,carbs:4.5,fiber:1.5,gi:15,servingSize:"100 г",micros:{Ca:18,Fe:3,Mg:10,P:65,K:180,VitB9:25,Zn:1}},
  {id:"veg_water_chestnut",name:"Водяной орех (чилим)",category:"veg_fruit",kcal:97,protein:1.4,fat:0.1,carbs:24,fiber:3,gi:55,servingSize:"100 г",micros:{Ca:11,Fe:0.1,Mg:22,P:63,K:584,VitB6:0.3,Cu:0.3}},
  {id:"veg_celery_root",name:"Корень сельдерея (варёный)",category:"veg_fruit",kcal:42,protein:1.3,fat:0.3,carbs:9,fiber:2,gi:35,servingSize:"150 г",micros:{Ca:40,Fe:0.8,Mg:17,P:100,K:300,VitC:8,VitK:30}},
  {id:"veg_jicama",name:"Хикама (свежая)",category:"veg_fruit",kcal:38,protein:0.7,fat:0.1,carbs:9,fiber:5,gi:15,servingSize:"150 г",micros:{Ca:12,Fe:0.6,Mg:12,P:18,K:150,VitC:20,VitB9:12,Inulin:3000}},
  {id:"fruit_kumquat",name:"Кумкват (свежий)",category:"veg_fruit",kcal:71,protein:1.9,fat:0.9,carbs:16,fiber:6.5,gi:35,servingSize:"80 г (5 шт)",micros:{Ca:62,Fe:0.9,Mg:20,P:19,K:186,VitC:44,VitA:290}},
  {id:"fruit_ugli_fruit",name:"Углифрут (танжело)",category:"veg_fruit",kcal:47,protein:0.6,fat:0.1,carbs:12,fiber:2,gi:35,servingSize:"150 г",micros:{Ca:15,Fe:0.2,Mg:10,P:15,K:180,VitC:50,VitA:100}},
  {id:"fruit_loquat",name:"Мушмула японская (локва)",category:"veg_fruit",kcal:47,protein:0.4,fat:0.2,carbs:12,fiber:1.7,gi:35,servingSize:"100 г",micros:{Ca:16,Fe:0.3,Mg:13,P:27,K:266,VitA:150,VitC:1}},
  {id:"fruit_soursop",name:"Гуанабана (саусеп)",category:"veg_fruit",kcal:66,protein:1,fat:0.3,carbs:17,fiber:3.3,gi:35,servingSize:"150 г",micros:{Ca:14,Fe:0.6,Mg:21,P:27,K:278,VitC:20,VitB6:0.1}},
  {id:"fruit_cactus_pear",name:"Плод кактуса (опунция)",category:"veg_fruit",kcal:41,protein:0.7,fat:0.5,carbs:10,fiber:3.6,gi:25,servingSize:"100 г",micros:{Ca:56,Fe:0.3,Mg:85,P:24,K:220,VitC:14,VitB6:0.1}},
  {id:"fruit_rosehip",name:"Шиповник (свежий)",category:"veg_fruit",kcal:162,protein:1.6,fat:0.3,carbs:38,fiber:24,gi:25,servingSize:"30 г (сухой)",micros:{Ca:169,Fe:3,Mg:41,P:77,K:600,VitC:800,VitA:4200,VitE:5}},
  {id:"fruit_sea_buckthorn",name:"Облепиха (свежая)",category:"veg_fruit",kcal:82,protein:1.2,fat:7,carbs:5,fiber:2,gi:25,servingSize:"50 г",micros:{Ca:30,Fe:0.8,Mg:15,P:15,K:200,VitC:200,VitA:250,VitE:5,Omega3:800}},
  {id:"fruit_barberry",name:"Барбарис (сушёный)",category:"veg_fruit",kcal:200,protein:2,fat:0.5,carbs:45,fiber:10,gi:30,servingSize:"30 г",micros:{Ca:30,Fe:0.5,VitC:30,Berberine:100}},
  {id:"fruit_irga",name:"Ирга (свежая)",category:"veg_fruit",kcal:45,protein:0.8,fat:0.3,carbs:10,fiber:2.5,gi:25,servingSize:"100 г",micros:{Ca:15,Fe:0.5,P:20,K:150,VitC:15,VitA:50,Anthocyanins:150}},
  {id:"fruit_cornelian_cherry_dogwood",name:"Кизил (свежий)",category:"veg_fruit",kcal:44,protein:1,fat:0.3,carbs:10,fiber:2,gi:25,servingSize:"100 г",micros:{Ca:30,Fe:0.5,P:30,K:350,VitC:50,VitA:300}},
  {id:"cheese_mozzarella_buffalo",name:"Моцарелла буффало",category:"dairy",kcal:280,protein:20,fat:22,carbs:2,fiber:0,gi:0,servingSize:"50 г",micros:{Ca:200,P:140,Zn:2,VitA:200,VitB12:1,Na:300}},
  {id:"cheese_cheddar",name:"Сыр чеддер",category:"dairy",kcal:403,protein:25,fat:33,carbs:1.5,fiber:0,gi:0,servingSize:"30 г",micros:{Ca:220,P:160,Zn:3.5,VitA:250,VitB12:0.9,Na:400}},
  {id:"cheese_feta",name:"Фета (овечья)",category:"dairy",kcal:264,protein:14,fat:21,carbs:4,fiber:0,gi:0,servingSize:"50 г",micros:{Ca:280,P:170,Zn:2.5,VitA:250,VitB12:1.5,Na:1100}},
  {id:"milk_almond_unsweet",name:"Молоко миндальное (без сахара)",category:"dairy",kcal:15,protein:0.5,fat:1.2,carbs:0.3,fiber:0.3,gi:0,servingSize:"250 мл",micros:{Ca:180,VitE:7,VitD:2}},
  {id:"milk_oat",name:"Молоко овсяное",category:"dairy",kcal:45,protein:1,fat:1.5,carbs:7,fiber:0.8,gi:35,servingSize:"250 мл",micros:{Ca:120,VitD:1.5,VitB12:1,Fe:0.5}},
  {id:"milk_coconut_canned",name:"Кокосовое молоко (консервированное)",category:"dairy",kcal:230,protein:2.5,fat:24,carbs:5,fiber:2,gi:0,servingSize:"100 мл",micros:{Ca:15,Fe:1.5,Mg:40,K:260,MCT:8000}},
  {id:"yogurt_skyr",name:"Скир (исландский йогурт 0%)",category:"dairy",kcal:66,protein:12,fat:0.2,carbs:4,fiber:0,gi:0,servingSize:"150 г",micros:{Ca:150,P:120,Zn:0.8,VitB12:0.5}},
  {id:"tvorog_0_percent",name:"Творог обезжиренный (0%)",category:"dairy",kcal:85,protein:18,fat:0.5,carbs:3,fiber:0,gi:0,servingSize:"150 г",micros:{Ca:120,P:130,Zn:1,Se:15,VitB2:0.25}},
  {id:"oil_black_cumin",name:"Масло чёрного тмина",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"10 мл",micros:{VitE:5,Omega6:60000,Thymoquinone:200,Nigellone:100}},
  {id:"oil_cedar",name:"Кедровое масло",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл",micros:{VitE:10,Omega3:15000,Omega6:45000,OleicAcid:25000,PinolenicAcid:12000}},
  {id:"seed_mustard_yellow",name:"Семена горчицы жёлтой",category:"fat",kcal:508,protein:26,fat:36,carbs:28,fiber:12,gi:0,servingSize:"10 г",micros:{Ca:26,Fe:9,Mg:37,P:84,K:138,Zn:6,Se:20,Sinigrin:500}},
  {id:"seed_coriander",name:"Семена кориандра",category:"fat",kcal:298,protein:12,fat:17,carbs:55,fiber:42,gi:0,servingSize:"10 г",micros:{Ca:70,Fe:16,Mg:33,P:41,K:126,Zn:4.8,Cu:0.9,Mn:1.9}},
  {id:"seed_cardamom",name:"Семена кардамона",category:"fat",kcal:311,protein:11,fat:7,carbs:68,fiber:28,gi:0,servingSize:"5 г",micros:{Ca:38,Fe:14,Mg:23,P:18,K:112,Zn:7,Cu:0.4,Mn:28}},
  {id:"nut_pecan",name:"Орех пекан",category:"fat",kcal:691,protein:9,fat:72,carbs:14,fiber:10,gi:0,servingSize:"30 г",micros:{Ca:20,Fe:0.8,Mg:35,P:95,K:120,Zn:1.3,VitE:1.5,Mn:1.3}},
  {id:"nut_brazil",name:"Бразильский орех",category:"fat",kcal:659,protein:14,fat:67,carbs:12,fiber:7,gi:0,servingSize:"15 г (2-3 шт)",micros:{Ca:24,Fe:0.4,Mg:56,P:109,K:93,Zn:0.6,Se:287,VitE:0.9,Mn:0.2,Cu:0.1}},
  {id:"seed_sunflower",name:"Семечки подсолнечника (очищенные)",category:"fat",kcal:584,protein:21,fat:51,carbs:20,fiber:8,gi:0,servingSize:"30 г",micros:{Fe:3.8,Mg:100,P:450,Zn:5,Se:15,VitE:10,VitB1:0.4,VitB3:2.4,Cu:0.5}},
  {id:"ru_cheburek",name:"Чебурек (с мясом жареный)",category:"other",kcal:300,protein:12,fat:18,carbs:24,fiber:1.5,gi:60,servingSize:"1 шт (180 г)",micros:{Ca:30,Fe:1.8,Zn:1.5,P:100,Na:500}},
  {id:"ru_coulibiac",name:"Кулебяка (с рыбой)",category:"other",kcal:250,protein:12,fat:10,carbs:28,fiber:2,gi:55,servingSize:"200 г",micros:{Ca:40,Fe:1.2,P:120,Omega3:300,Na:500}},
  {id:"ru_schi",name:"Щи (из свежей капусты с мясом)",category:"other",kcal:60,protein:4,fat:2.5,carbs:6,fiber:2,gi:35,servingSize:"300 мл",micros:{Ca:30,Fe:1,P:60,K:280,VitC:15,VitA:300,VitK:40}},
  {id:"int_ramen_pork",name:"Рамен (со свининой)",category:"other",kcal:200,protein:8,fat:8,carbs:25,fiber:1.5,gi:55,servingSize:"400 мл",micros:{Ca:30,Fe:1.5,P:80,K:300,Na:900}},
  {id:"int_ceviche",name:"Севиче (из белой рыбы)",category:"other",kcal:110,protein:18,fat:2,carbs:5,fiber:1,gi:15,servingSize:"200 г",micros:{Ca:20,Fe:0.5,P:180,K:400,VitC:25,Omega3:300}},
  {id:"int_poke_salmon",name:"Поке (с лососем)",category:"other",kcal:180,protein:12,fat:8,carbs:18,fiber:2,gi:50,servingSize:"250 г",micros:{Ca:30,Fe:0.8,Zn:1,P:120,Omega3:800,VitD:3,VitC:10}},
  {id:"int_satay_chicken",name:"Сатай куриный (с арахисовым соусом)",category:"other",kcal:230,protein:20,fat:12,carbs:10,fiber:2,gi:45,servingSize:"200 г (4 шт)",micros:{Fe:1.5,Zn:2,P:180,VitB3:6,Na:500}},
  {id:"int_quesadilla_cheese",name:"Кесадилья с сыром",category:"other",kcal:330,protein:14,fat:18,carbs:28,fiber:2,gi:60,servingSize:"200 г",micros:{Ca:250,Fe:1,Zn:1.5,P:150}},

  // ═══════════════════════════════════════════════════════
  // НОВЫЕ ПРОДУКТЫ ДЛЯ БОДИБИЛДИНГА — 200 ПОЗИЦИЙ
  // ═══════════════════════════════════════════════════════

  // ─── POULTRY: куриные и индюшачьи субпродукты ───
  {id:"poultry_chicken_liver",name:"Печень куриная (тушёная)",category:"protein",kcal:136,protein:21,fat:4.5,carbs:2.5,fiber:0,gi:0,servingSize:"150 г",tier:"max",bestFor:["mass","cutting","recomp"],timing:"morning",description:"Богатейший источник витамина A, B12, железа и меди. Поддерживает кроветворение на курсе ААС",micros:{Ca:10,Fe:9.0,Mg:19,Zn:3.1,K:290,VitA:3300,VitC:18}},
  {id:"poultry_chicken_heart",name:"Сердце куриное (тушёное)",category:"protein",kcal:153,protein:20,fat:7,carbs:0.5,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Постный субпродукт с CoQ10, таурином и железом. Укрепляет сердечно-сосудистую систему на курсе",micros:{Ca:8,Fe:4.5,Mg:17,Zn:2.2,K:230,CoQ10:15,Taurine:30}},
  {id:"poultry_chicken_gizzard",name:"Желудки куриные (варёные)",category:"protein",kcal:118,protein:19,fat:3.5,carbs:0.5,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Очень постный субпродукт с высоким содержанием белка. Хороший источник селена и цинка",micros:{Ca:12,Fe:3.1,Mg:15,Zn:2.8,Se:25}},
  {id:"poultry_chicken_wing",name:"Куриные крылья (запечённые)",category:"protein",kcal:210,protein:22,fat:13,carbs:0.5,fiber:0,gi:0,servingSize:"200 г",tier:"basic",bestFor:["mass","bulk"],timing:"any",description:"Крылья с кожей — выше жирность, больше вкуса. Годятся для читмила на массе",micros:{Ca:15,Fe:1.2,Mg:16,Zn:1.8,K:200}},
  {id:"poultry_chicken_back",name:"Куриная спинка (каркас)",category:"protein",kcal:180,protein:17,fat:12,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"basic",bestFor:["mass","bulk"],timing:"any",description:"Каркас с остатками мяса — основа для бульона с коллагеном для связок и суставов",micros:{Ca:25,Fe:1.0,Mg:12,Zn:1.5,K:150}},
  {id:"poultry_turkey_liver",name:"Печень индюшачья (тушёная)",category:"protein",kcal:150,protein:22,fat:5.5,carbs:3,fiber:0,gi:0,servingSize:"150 г",tier:"max",bestFor:["mass","cutting","recomp"],timing:"morning",description:"Нежнее куриной печени с тем же профилем витаминов. Высокое содержание витамина A — не чаще 2 раз/нед",micros:{Ca:12,Fe:8.5,Mg:20,Zn:3.5,K:310,VitA:2800,VitB12:20}},
  {id:"poultry_turkey_heart",name:"Сердце индюшачье",category:"protein",kcal:140,protein:19,fat:6,carbs:0.3,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["mass","cutting","maintenance"],timing:"any",description:"Постный субпродукт, богат CoQ10 и железом. Полезен при кардиотоксичных препаратах",micros:{Ca:7,Fe:4.0,Mg:18,Zn:2.0,K:220,CoQ10:18}},
  {id:"poultry_turkey_gizzard",name:"Желудки индюшачьи",category:"protein",kcal:120,protein:18,fat:4,carbs:0.5,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Крупнее и плотнее куриных, отличный источник хондроитина для суставов",micros:{Ca:10,Fe:3.5,Mg:14,Zn:2.5,Se:28}},
  {id:"poultry_turkey_wing",name:"Крыло индейки (запечённое)",category:"protein",kcal:195,protein:21,fat:11,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"basic",bestFor:["mass","bulk"],timing:"any",description:"Крупные мясистые крылья индейки — отличный источник белка для набора массы",micros:{Ca:12,Fe:1.1,Mg:15,Zn:1.9,K:230}},
  {id:"poultry_duck_liver",name:"Печень утиная (фуа-гра)",category:"protein",kcal:204,protein:16,fat:15,carbs:1.5,fiber:0,gi:0,servingSize:"100 г",tier:"mid",bestFor:["bulk","mass"],timing:"any",description:"Богата железом и витамином B12. Высокая жирность — для набора массы и вкуса",micros:{Ca:15,Fe:7.0,Mg:13,Zn:2.0,K:245,VitA:2300}},

  // ─── LAMB & GOAT ───
  {id:"lamb_loin_chop",name:"Баранья корейка (отбивная)",category:"protein",kcal:230,protein:24,fat:15,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"mid",bestFor:["mass","bulk","maintenance"],timing:"lunch",description:"Нежное мясо с высоким содержанием цинка и креатина. CLA — поддержка метаболизма",micros:{Ca:20,Fe:2.0,Mg:25,Zn:4.5,K:310,VitB12:2.5}},
  {id:"lamb_tongue",name:"Язык бараний",category:"protein",kcal:200,protein:17,fat:14,carbs:0.5,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["mass","maintenance"],timing:"any",description:"Нежный субпродукт, богат цинком и B12. Отличное разнообразие в рационе",micros:{Ca:14,Fe:2.5,Mg:16,Zn:3.8,K:260}},
  {id:"lamb_brain",name:"Мозг бараний",category:"protein",kcal:122,protein:11,fat:8.5,carbs:0,fiber:0,gi:0,servingSize:"100 г",tier:"basic",bestFor:["mass","bulk"],timing:"any",description:"Высочайшее содержание DHA (1.2г/100г) и фосфолипидов для мозга. Редкий деликатес",micros:{Ca:10,Fe:1.2,Mg:12,Zn:1.2,K:240,VitB12:7.0,Omega3:1200,Cholesterol:2000}},
  {id:"lamb_sweetbreads",name:"Зобная железа ягнёнка",category:"protein",kcal:180,protein:20,fat:11,carbs:0,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["mass","cutting","maintenance"],timing:"any",description:"Деликатесный субпродукт (thymus). Нежная текстура, богат витамином C и железом",micros:{Ca:12,Fe:3.0,Mg:18,Zn:2.5,K:280,VitC:25}},
  {id:"lamb_testicles",name:"Бараньи яйца/семенники",category:"protein",kcal:135,protein:18,fat:6,carbs:0,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["mass","bulk","strength"],timing:"any",description:"Высочайшее содержание цинка и андрогенов. Традиционный продукт для повышения либидо и силы",micros:{Ca:8,Fe:2.2,Mg:15,Zn:7.5,K:210,Se:35,T:5}},
  {id:"goat_leg_roast",name:"Козлятина (задняя нога)",category:"protein",kcal:170,protein:25,fat:7.5,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"mid",bestFor:["mass","cutting","maintenance"],timing:"any",description:"Постное мясо с высоким содержанием CLA и железа. Ниже жирности говядины, богаче микроэлементами",micros:{Ca:16,Fe:3.5,Mg:28,Zn:4.0,K:340,VitB12:2.2}},
  {id:"goat_shoulder",name:"Лопатка козья",category:"protein",kcal:185,protein:23,fat:9.5,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"basic",bestFor:["mass","maintenance"],timing:"any",description:"Мясо с умеренной жирностью, богато калием и фосфором. Отлично для тушения",micros:{Ca:14,Fe:3.2,Mg:26,Zn:3.5,K:330}},

  // ─── PORK SPECIALTY ───
  {id:"pork_head_cheese",name:"Зельц (свиной)",category:"protein",kcal:280,protein:18,fat:22,carbs:0.5,fiber:0,gi:0,servingSize:"100 г",tier:"basic",bestFor:["mass","bulk"],timing:"any",description:"Заливной прессованный продукт из головы. Богат коллагеном, хрящами и желатином для связок",micros:{Ca:30,Fe:1.8,Mg:10,Zn:2.5,K:150,Glycine:2000}},
  {id:"pork_blood_sausage",name:"Кровяная колбаса",category:"protein",kcal:275,protein:16,fat:22,carbs:3,fiber:0,gi:0,servingSize:"100 г",tier:"basic",bestFor:["mass","bulk"],timing:"any",description:"Богатейший источник железа (гемовое). Поднимает гемоглобин после длительных курсов ААС",micros:{Ca:15,Fe:8.0,Mg:14,Zn:2.0,K:180,VitB2:0.3,VitB12:1.5}},
  {id:"pork_liverwurst",name:"Ливерная колбаса",category:"protein",kcal:280,protein:15,fat:24,carbs:3,fiber:0,gi:0,servingSize:"100 г",tier:"basic",bestFor:["mass","bulk"],timing:"any",description:"Колбаса из печени с витамином A и железом. Удобный формат для быстрого перекуса",micros:{Ca:20,Fe:6.0,Mg:12,Zn:3.0,K:200,VitA:2000}},
  {id:"pork_chicharrones",name:"Шкварки (свиные)",category:"protein",kcal:420,protein:48,fat:24,carbs:0.5,fiber:0,gi:0,servingSize:"30 г",tier:"basic",bestFor:["cutting","maintenance"],timing:"snack",description:"Нулевой углевод, 48% белка — идеальный кето-снек. Богат коллагеном и глицином",micros:{Ca:25,Fe:0.5,Mg:14,Zn:1.2,Se:15,Glycine:2000}},
  {id:"cured_prosciutto",name:"Прошутто (Пармская ветчина)",category:"protein",kcal:250,protein:27,fat:16,carbs:0.5,fiber:0,gi:0,servingSize:"50 г",tier:"mid",bestFor:["mass","maintenance"],timing:"any",description:"Сыровяленая ветчина высшего сорта. Высокое содержание белка, натуральные жиры, минимум обработки",micros:{Ca:15,Fe:1.5,Mg:18,Zn:2.5,K:320,VitB1:0.5,VitB12:0.8}},
  {id:"cured_jamon_serrano",name:"Хамон серрано",category:"protein",kcal:240,protein:26,fat:15,carbs:0.5,fiber:0,gi:0,servingSize:"50 г",tier:"mid",bestFor:["mass","maintenance"],timing:"any",description:"Испанский сыровяленый окорок. Выдерживается 12-18 мес. Богат олеиновой кислотой и микроэлементами",micros:{Ca:16,Fe:1.8,Mg:20,Zn:2.8,K:310,VitB1:0.6}},
  {id:"cured_bresaola",name:"Брезаола",category:"protein",kcal:151,protein:32,fat:2.5,carbs:0,fiber:0,gi:0,servingSize:"50 г",tier:"max",bestFor:["mass","cutting","maintenance","recomp"],timing:"any",description:"Сыровяленая говядина с низким содержанием жира. 32г белка — идеальный вариант для сушки",micros:{Ca:18,Fe:2.8,Mg:22,Zn:4.0,K:350,VitB12:1.5}},
  {id:"cured_pastrami",name:"Пастрами (говяжья)",category:"protein",kcal:190,protein:22,fat:11,carbs:2,fiber:0,gi:0,servingSize:"100 г",tier:"mid",bestFor:["mass","maintenance"],timing:"any",description:"Копчёно-варёная говяжья грудинка со специями. Богата пряностями с антиоксидантными свойствами",micros:{Ca:20,Fe:2.5,Mg:20,Zn:3.5,K:300,VitB3:4.0}},
  {id:"cured_pepperoni",name:"Пепперони",category:"protein",kcal:350,protein:19,fat:30,carbs:2,fiber:0,gi:0,servingSize:"50 г",tier:"basic",bestFor:["mass","bulk"],timing:"any",description:"Острая салями с высоким содержанием жира и белка. Хороша для читмила и средиземноморской диеты",micros:{Ca:14,Fe:1.2,Mg:15,Zn:2.0,K:220}},
  {id:"cured_chorizo",name:"Чоризо (испанское)",category:"protein",kcal:330,protein:22,fat:26,carbs:3,fiber:0,gi:0,servingSize:"100 г",tier:"basic",bestFor:["mass","bulk"],timing:"any",description:"Сырокопчёная колбаса с паприкой. Пряная, жирная — подходит для разнообразия на массе",micros:{Ca:12,Fe:1.5,Mg:14,Zn:2.5,K:250}},

  // ─── EXOTIC & GAME ───
  {id:"exotic_ostrich_fillet",name:"Филе страуса (стейк)",category:"protein",kcal:130,protein:26,fat:2.5,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"max",bestFor:["mass","cutting","maintenance","recomp"],timing:"any",description:"Красное мясо с профилем как у индейки — суперпостное, высокий белок. Богато железом и креатином",micros:{Ca:8,Fe:3.5,Mg:24,Zn:3.0,Se:35,VitB12:2.0}},
  {id:"exotic_kangaroo_loin",name:"Филе кенгуру",category:"protein",kcal:145,protein:28,fat:2.5,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"max",bestFor:["mass","cutting","recomp"],timing:"any",description:"Экстремально постное мясо с 28% белка. Высочайшее содержание CLA и B12. Экологичный выбор",micros:{Ca:10,Fe:3.8,Mg:26,Zn:3.2,K:350,VitB12:4.0}},
  {id:"exotic_crocodile_fillet",name:"Филе крокодила",category:"protein",kcal:98,protein:22,fat:1.5,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"max",bestFor:["mass","cutting","recomp"],timing:"any",description:"Белейшее постное мясо — профиль жира как у рыбы (омега-3). Идеально для низкожировой диеты",micros:{Ca:12,Fe:0.5,Mg:22,Zn:1.5,Se:35,K:300,Omega3:300}},
  {id:"exotic_frog_legs",name:"Лягушачьи лапки",category:"protein",kcal:73,protein:16,fat:0.3,carbs:0,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["cutting","recomp","maintenance"],timing:"any",description:"Экзотическое постное мясо с нежной текстурой как у курицы. Богато калием и витамином A",micros:{Ca:25,Fe:0.8,Mg:18,Zn:0.5,K:420,VitA:100,VitC:5}},
  {id:"exotic_escargots",name:"Улитки (эскарго)",category:"protein",kcal:90,protein:16,fat:1.5,carbs:2,fiber:0,gi:0,servingSize:"100 г (12 шт)",tier:"mid",bestFor:["cutting","maintenance"],timing:"any",description:"Богаты белком при низкой калорийности. Йод, магний, селен и гликопротеины для иммунитета",micros:{Ca:170,Fe:3.5,Mg:250,K:250,Se:25,VitE:5,VitB12:1.5}},
  {id:"exotic_horse_steak",name:"Конина (стейк)",category:"protein",kcal:175,protein:26,fat:7,carbs:0.5,fiber:0,gi:0,servingSize:"200 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Постное красное мясо с высоким содержанием железа и креатина. Ниже холестерина говядины",micros:{Ca:14,Fe:4.0,Mg:24,Zn:3.5,K:380,VitB3:5.0,VitB12:2.8}},
  {id:"exotic_camel_hump",name:"Горб верблюжий",category:"protein",kcal:210,protein:22,fat:13,carbs:0,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["mass","bulk"],timing:"any",description:"Деликатесное жирное мясо с уникальным профилем аминокислот. Богато железом и цинком",micros:{Ca:12,Fe:3.5,Mg:20,Zn:4.0,K:290,VitB12:1.8}},

  // ─── FISH ───
  {id:"fish_swordfish_steak",name:"Рыба-меч (стейк)",category:"protein",kcal:155,protein:23,fat:6.5,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"mid",bestFor:["mass","maintenance","recomp"],timing:"lunch",description:"Плотный стейк с высоким содержанием селена и омега-3. Не чаще 2 раз/нед из-за ртути",micros:{Ca:9,Fe:0.9,Mg:35,Zn:0.6,K:420,Se:70,Omega3:1200,VitD:17}},
  {id:"fish_mahi_mahi",name:"Махи-махи (корифена)",category:"protein",kcal:105,protein:22,fat:1.2,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Плотная белая рыба с нейтральным вкусом. Высокое содержание калия и селена",micros:{Ca:10,Fe:1.0,Mg:30,Zn:0.5,K:480,Se:45,VitB3:7.0}},
  {id:"fish_monkfish_fillet",name:"Морской чёрт (филе)",category:"protein",kcal:82,protein:18,fat:1.2,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"mid",bestFor:["cutting","recomp","maintenance"],timing:"any",description:"Нежное белое филе с очень низкой жирностью. По текстуре напоминает лобстера",micros:{Ca:10,Fe:0.6,Mg:25,Zn:0.6,K:420,Se:40,VitB12:2.5}},
  {id:"fish_turbot",name:"Турбот (палтус)",category:"protein",kcal:105,protein:19,fat:2.5,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"max",bestFor:["mass","cutting","recomp"],timing:"any",description:"Элитная белая рыба с нежной текстурой. Высокое содержание селена и витамина B12",micros:{Ca:15,Fe:0.5,Mg:30,Zn:0.6,K:360,Se:55,VitB12:3.0,Omega3:500}},
  {id:"fish_sole_fillet",name:"Филе соли (морской язык)",category:"protein",kcal:90,protein:19,fat:1.2,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"mid",bestFor:["cutting","recomp","maintenance"],timing:"any",description:"Постная камбалообразная рыба. Минимальная калорийность при высоком содержании белка",micros:{Ca:10,Fe:0.3,Mg:20,Zn:0.4,K:280,Se:35,VitB12:1.8}},
  {id:"fish_haddock",name:"Пикша (филе)",category:"protein",kcal:82,protein:18,fat:0.7,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"mid",bestFor:["cutting","recomp","maintenance"],timing:"any",description:"Белая рыба с очень низкой жирностью. Богата селеном, йодом и витамином B3",micros:{Ca:14,Fe:0.5,Mg:25,Zn:0.4,K:350,Se:30,VitB3:10}},
  {id:"fish_hake",name:"Хек (филе)",category:"protein",kcal:78,protein:17,fat:0.7,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"mid",bestFor:["cutting","recomp","maintenance"],timing:"any",description:"Бюджетная нежирная рыба. Богата йодом, селеном и витамином B12. Отлично для сушки",micros:{Ca:10,Fe:0.4,Mg:22,Zn:0.4,K:310,Se:28,VitB12:1.2,I:150}},
  {id:"fish_whiting",name:"Мерланг (филе)",category:"protein",kcal:82,protein:17,fat:0.8,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Нежирная белая рыба. Доступный источник белка с мягким вкусом",micros:{Ca:12,Fe:0.3,Mg:20,Zn:0.3,K:290,Se:25}},
  {id:"fish_grouper_fillet",name:"Групер (филе)",category:"protein",kcal:95,protein:20,fat:1.2,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Плотная белая рыба с высоким содержанием калия и селена. Минимальный риск ртути",micros:{Ca:10,Fe:0.7,Mg:28,Zn:0.5,K:440,Se:40,VitB12:2.0}},
  {id:"fish_snapper_red",name:"Луциан красный (филе)",category:"protein",kcal:105,protein:21,fat:1.8,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Красная морская рыба с плотным мясом. Богата калием, селеном и витамином D",micros:{Ca:16,Fe:0.4,Mg:30,Zn:0.5,K:400,Se:45,VitD:13,VitB12:2.2}},
  {id:"fish_anchovy_fillets",name:"Анчоусы (филе в масле)",category:"protein",kcal:140,protein:20,fat:6.5,carbs:0,fiber:0,gi:0,servingSize:"50 г",tier:"mid",bestFor:["mass","maintenance"],timing:"any",description:"Мелкая жирная рыба с максимальной концентрацией омега-3. Интенсивный солёный вкус для салатов",micros:{Ca:180,Fe:2.5,Mg:28,Zn:1.2,K:280,Se:40,Omega3:2000}},
  {id:"fish_eel_fresh",name:"Угорь (копчёный)",category:"protein",kcal:235,protein:18,fat:18,carbs:0,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["mass","bulk"],timing:"any",description:"Жирная рыба с высоким содержанием EPA/DHA и витамина A. Очень питательный деликатес",micros:{Ca:20,Fe:0.7,Mg:22,Zn:2.0,K:300,Se:30,Omega3:2500,VitA:1200,VitD:5}},
  {id:"fish_pike",name:"Щука (филе)",category:"protein",kcal:95,protein:18,fat:1.2,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"mid",bestFor:["cutting","recomp","maintenance"],timing:"any",description:"Пресноводная хищная рыба с плотным постным мясом. Богата фосфором и калием",micros:{Ca:15,Fe:0.5,Mg:25,Zn:0.6,K:290,VitB12:1.8,VitD:8}},
  {id:"fish_perch",name:"Окунь речной (филе)",category:"protein",kcal:85,protein:17,fat:0.8,carbs:0,fiber:0,gi:0,servingSize:"200 г",tier:"mid",bestFor:["cutting","recomp"],timing:"any",description:"Постная пресноводная рыба с нежным сладковатым вкусом. Богата хромом и кобальтом",micros:{Ca:12,Fe:0.4,Mg:22,Zn:0.5,K:280,Se:20,Cr:15}},

  // ─── SEAFOOD ───
  {id:"seafood_crab_legs",name:"Крабовые ноги (камчатский)",category:"protein",kcal:88,protein:18,fat:1.2,carbs:0,fiber:0,gi:0,servingSize:"150 г",tier:"max",bestFor:["mass","cutting","recomp"],timing:"any",description:"Нежнейшее мясо с 18г белка при 88 ккал. Высочайшее содержание цинка, меди и селена",micros:{Ca:35,Fe:0.8,Mg:42,Zn:4.5,K:280,Se:40,Cu:0.6,VitB12:5.0}},
  {id:"seafood_crab_meat",name:"Крабовое мясо (консервы)",category:"protein",kcal:82,protein:17,fat:0.5,carbs:0,fiber:0,gi:0,servingSize:"100 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Консервированное мясо краба. Удобный вариант высокого белка для быстрых салатов",micros:{Ca:40,Fe:0.5,Mg:35,Zn:3.5,K:220,Se:35,VitB12:3.0}},
  {id:"seafood_lobster_tail",name:"Омар/лобстер (хвост)",category:"protein",kcal:92,protein:19,fat:1.5,carbs:0,fiber:0,gi:0,servingSize:"150 г",tier:"max",bestFor:["mass","cutting","recomp"],timing:"any",description:"Элитное морепродукт с плотным сладким мясом. Богат цинком, медью и витамином B12",micros:{Ca:30,Fe:0.4,Mg:35,Zn:3.2,Se:40,K:280,Cu:0.8,VitB12:4.0}},
  {id:"seafood_scallops",name:"Гребешки морские",category:"protein",kcal:88,protein:17,fat:1.2,carbs:2.5,fiber:0,gi:0,servingSize:"150 г",tier:"max",bestFor:["mass","cutting","recomp"],timing:"any",description:"Нежные моллюски с высоким содержанием B12, магния и калия. Быстрое приготовление 2-3 мин",micros:{Ca:12,Fe:0.3,Mg:45,Zn:1.5,Se:20,K:320,VitB12:2.5}},
  {id:"seafood_octopus",name:"Осьминог (варёный)",category:"protein",kcal:115,protein:20,fat:1.5,carbs:3.5,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Постный источник белка с высоким содержанием железа, B12 и таурина для сердца",micros:{Ca:60,Fe:5.5,Mg:35,Zn:1.7,Se:40,K:380,VitB12:10,Taurine:120}},
  {id:"seafood_squid",name:"Каракатица/кальмар (тушка)",category:"protein",kcal:85,protein:16,fat:1.5,carbs:1.5,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["cutting","recomp","maintenance"],timing:"any",description:"Постный морепродукт с высоким содержанием таурина. Хороший источник меди и селена",micros:{Ca:18,Fe:0.3,Mg:30,Zn:1.2,Se:35,K:300,Cu:0.8,Taurine:150}},
  {id:"seafood_clams",name:"Клемы (моллюски съедобные)",category:"protein",kcal:95,protein:16,fat:1.2,carbs:3.5,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Богатейший источник железа (14мг/100г) и B12. Энергия и восстановление для интенсивных тренировок",micros:{Ca:50,Fe:14,Mg:25,Zn:1.5,Se:20,K:300,VitB12:20,VitC:10}},
  {id:"seafood_cockles",name:"Коклы (морские сердцевидки)",category:"protein",kcal:82,protein:15,fat:0.5,carbs:4,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["cutting","recomp"],timing:"any",description:"Мелкие двустворчатые моллюски. Богаты железом и гликогеном для быстрой энергии",micros:{Ca:35,Fe:6.0,Mg:20,Zn:1.2,Se:22,K:260,VitB12:8}},
  {id:"seafood_conch",name:"Трубач/рапана (мясо)",category:"protein",kcal:110,protein:20,fat:1.2,carbs:3,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Крупный брюхоногий моллюск. Плотное мясо с 20г белка, богат цинком и железом",micros:{Ca:25,Fe:2.5,Mg:30,Zn:3.0,Se:28,K:320,VitB12:3.5}},
  {id:"seafood_geoduck",name:"Геодак (моллюск)",category:"protein",kcal:88,protein:17,fat:0.5,carbs:4,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["cutting","recomp"],timing:"any",description:"Крупный моллюск с хрустящим мясом. Богат селеном и железом при низкой калорийности",micros:{Ca:30,Fe:1.8,Mg:28,Zn:1.2,Se:35,K:310,VitB12:2.0}},

  // ─── PRESERVED FISH & ROE ───
  {id:"preserved_anchovy_salted",name:"Анчоусы солёные (бочковые)",category:"protein",kcal:168,protein:22,fat:8,carbs:0.5,fiber:0,gi:0,servingSize:"50 г",tier:"mid",bestFor:["mass","maintenance"],timing:"any",description:"Солёные анчоусы — концентрированный белок + омега-3. Требуют вымачивания перед готовкой",micros:{Ca:160,Fe:3.0,Mg:25,Zn:1.0,Se:35,Omega3:1800,Na:2500}},
  {id:"preserved_sprats_oil",name:"Шпроты (в масле)",category:"protein",kcal:245,protein:18,fat:18,carbs:0.5,fiber:0,gi:0,servingSize:"50 г",tier:"basic",bestFor:["mass","bulk"],timing:"any",description:"Копчёная балтийская килька в масле. Богата омега-3, витамином D и кальцием (с костями)",micros:{Ca:300,Fe:3.0,Mg:18,Zn:1.5,Se:25,Omega3:1500,VitD:12}},
  {id:"preserved_kippers",name:"Кипперс (копчёная сельдь)",category:"protein",kcal:210,protein:22,fat:13,carbs:0,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["mass","maintenance"],timing:"any",description:"Горячего копчения сельдь. Готовый продукт — достаточно разогреть. Высокое содержание омега-3",micros:{Ca:30,Fe:1.5,Mg:28,Zn:1.0,K:300,Omega3:2000,VitD:15,VitB12:4.0}},
  {id:"preserved_rollmops",name:"Рольмопсы (маринованная сельдь)",category:"protein",kcal:180,protein:15,fat:12,carbs:4,fiber:0,gi:0,servingSize:"150 г",tier:"basic",bestFor:["mass","maintenance"],timing:"any",description:"Филе сельди, свёрнутое рулетом с маринадом. Острый вкус, хороший источник омега-3",micros:{Ca:25,Fe:1.2,Mg:20,Zn:0.8,K:250,Omega3:1800,VitD:8}},
  {id:"preserved_caviar_salmon",name:"Икра лососёвая (красная)",category:"protein",kcal:200,protein:25,fat:12,carbs:1.5,fiber:0,gi:0,servingSize:"30 г",tier:"max",bestFor:["mass","strength","recomp"],timing:"any",description:"Элитный продукт — 25г белка при 200 ккал. Омега-3 EPA/DHA, лецитин, фосфор. Антивоспалительный эффект",micros:{Ca:20,Fe:2.5,Mg:30,Zn:0.8,Se:45,Omega3:2500,VitD:20,VitB12:8}},
  {id:"preserved_caviar_trout",name:"Икра форели (красная)",category:"protein",kcal:190,protein:24,fat:11,carbs:1.5,fiber:0,gi:0,servingSize:"30 г",tier:"max",bestFor:["mass","strength","recomp"],timing:"any",description:"Мелкая икра с 24г белка. Богата омега-3, фосфолипидами и гликопротеинами для иммунитета",micros:{Ca:18,Fe:2.0,Mg:28,Zn:0.7,Se:40,Omega3:2200,VitD:18,VitB12:7}},
  {id:"preserved_caviar_pollock",name:"Икра минтая (пробойная)",category:"protein",kcal:130,protein:20,fat:5,carbs:1,fiber:0,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Доступная икра с высоким содержанием белка. Богата фосфором и витамином D",micros:{Ca:15,Fe:1.5,Mg:25,Zn:0.5,Se:35,Omega3:1800,VitD:15}},
  {id:"preserved_caviar_black",name:"Икра осетровая (чёрная)",category:"protein",kcal:210,protein:26,fat:14,carbs:1,fiber:0,gi:0,servingSize:"30 г",tier:"max",bestFor:["mass","strength","recomp"],timing:"any",description:"Элитная икра с 26г белка. Максимальная концентрация омега-3, фосфолипидов и антиоксидантов",micros:{Ca:18,Fe:2.8,Mg:32,Zn:0.9,Se:50,Omega3:3000,VitD:22,VitB12:10}},

  // ─── DAIRY & CHEESE ───
  {id:"dairy_halloumi",name:"Халлуми (сыр для жарки)",category:"dairy",kcal:320,protein:21,fat:25,carbs:0.5,fiber:0,gi:0,servingSize:"100 г",tier:"mid",bestFor:["mass","maintenance","recomp"],timing:"any",description:"Греческий полутвёрдый сыр для жарки. Не плавится! 21г белка, богат кальцием",micros:{Ca:650,Fe:0.4,Mg:19,Zn:2.5,Na:700,VitA:200}},
  {id:"dairy_paneer",name:"Панир (индийский сыр)",category:"dairy",kcal:275,protein:19,fat:21,carbs:1.5,fiber:0,gi:0,servingSize:"100 г",tier:"mid",bestFor:["mass","maintenance","recomp"],timing:"any",description:"Домашний сыр — отжим творога под прессом. Высокий белок, богат кальцием и магнием",micros:{Ca:350,Fe:0.8,Mg:25,Zn:2.0,P:250,VitA:180}},
  {id:"dairy_mascarpone",name:"Маскарпоне",category:"dairy",kcal:435,protein:4.5,fat:45,carbs:4,fiber:0,gi:0,servingSize:"50 г",tier:"basic",bestFor:["bulk","mass"],timing:"any",description:"Итальянский сливочный сыр. Высокожировой продукт — отлично для кето и набора массы",micros:{Ca:100,Fe:0.2,Mg:8,Na:30,VitA:200}},
  {id:"dairy_creme_fraiche",name:"Крем-фреш",category:"dairy",kcal:292,protein:2.5,fat:30,carbs:3,fiber:0,gi:0,servingSize:"50 г",tier:"basic",bestFor:["bulk","mass"],timing:"any",description:"Французская ферментированная сметана. Жирные кислоты для гормонального баланса на курсе",micros:{Ca:80,Fe:0.1,Mg:6,K:100,VitA:150}},
  {id:"dairy_labneh",name:"Лабне (йогуртовый сыр)",category:"dairy",kcal:140,protein:14,fat:8,carbs:4,fiber:0,gi:0,servingSize:"100 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Концентрированный йогурт — 14г белка. Сливочный вкус, низкая лактоза. Синегрий с протеином",micros:{Ca:150,Fe:0.2,Mg:12,Zn:0.8,K:200,VitA:90,VitB12:0.5}},
  {id:"dairy_buttermilk",name:"Пахта (маслянка)",category:"dairy",kcal:35,protein:3.2,fat:0.5,carbs:4.5,fiber:0,gi:0,servingSize:"250 мл",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Побочный продукт сбивания масла. Низкокалорийный, богат лецитином и фосфолипидами",micros:{Ca:115,Fe:0.1,Mg:12,P:95,K:140,VitA:20,VitB2:0.2}},
  {id:"dairy_kumis",name:"Кумыс (из кобыльего молока)",category:"dairy",kcal:40,protein:2.2,fat:1.2,carbs:5,fiber:0,gi:0,servingSize:"250 мл",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Ферментированное кобылье молоко. Пробиотики, витамины группы B, низкая лактоза",micros:{Ca:90,Fe:0.2,Mg:10,K:150,VitC:10,VitB1:0.05,VitB2:0.15}},
  {id:"dairy_whey_liquid",name:"Сыворотка молочная (жидкая)",category:"dairy",kcal:24,protein:0.8,fat:0.1,carbs:5,fiber:0,gi:0,servingSize:"250 мл",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Жидкая сыворотка после створаживания. Богата лактоферрином, иммуноглобулинами и B2",micros:{Ca:25,Fe:0.1,Mg:8,K:140,VitB2:0.14,VitB5:0.3}},
  {id:"dairy_creamy_cottage_2",name:"Творог зернёный 2%",category:"dairy",kcal:86,protein:16,fat:2,carbs:3,fiber:0,gi:0,servingSize:"200 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Зернёный творог — 16г белка, низкая жирность. Идеален для вечернего приёма из-за медленного усвоения",micros:{Ca:120,Fe:0.3,Mg:16,Zn:0.8,P:210,Se:12,VitB2:0.2,VitB12:0.5}},
  {id:"dairy_fromage_blanc",name:"Фромаж блан 0%",category:"dairy",kcal:68,protein:13,fat:0.2,carbs:3.5,fiber:0,gi:0,servingSize:"150 г",tier:"mid",bestFor:["cutting","recomp","maintenance"],timing:"any",description:"Французский нежирный творог. Гладкая кремообразная текстура, 13г белка, практически без жира",micros:{Ca:100,Fe:0.1,Mg:10,Zn:0.5,P:150,VitB12:0.4}},
  {id:"dairy_goat_yogurt",name:"Йогурт козий (натуральный)",category:"dairy",kcal:68,protein:4.5,fat:3.5,carbs:4.5,fiber:0,gi:0,servingSize:"200 г",tier:"basic",bestFor:["mass","maintenance"],timing:"any",description:"Легче усваивается, чем коровий. Богат триглицеридами средней длины и пробиотиками",micros:{Ca:170,Fe:0.2,Mg:16,Zn:0.5,K:240,VitA:80,VitB2:0.3}},

  // ─── GRAINS ───
  {id:"grain_farro",name:"Фарро (полба итальянская)",category:"grain",kcal:130,protein:4.5,fat:0.8,carbs:27,fiber:3.5,gi:42,servingSize:"100 г (варёная)",tier:"mid",bestFor:["maintenance","recomp"],timing:"lunch",description:"Древняя итальянская пшеница. Выше белка, чем у риса. Богата магнием, цинком и клетчаткой",micros:{Ca:12,Fe:1.2,Mg:42,Zn:1.5,P:150,K:140,VitB3:1.5}},
  {id:"grain_freekeh",name:"Фрике (зелёная пшеница)",category:"grain",kcal:145,protein:5.5,fat:0.6,carbs:30,fiber:5,gi:40,servingSize:"100 г (варёная)",tier:"mid",bestFor:["maintenance","recomp"],timing:"lunch",description:"Копчёная зелёная пшеница. Низкий GI, высокое содержание клетчатки и пребиотиков",micros:{Ca:15,Fe:1.5,Mg:48,Zn:1.8,P:160,K:145,VitB6:0.2}},
  {id:"grain_rye_berries",name:"Рожь (цельное зерно)",category:"grain",kcal:128,protein:4.5,fat:1.2,carbs:27,fiber:5,gi:38,servingSize:"100 г (варёная)",tier:"mid",bestFor:["maintenance","recomp","cutting"],timing:"lunch",description:"Высочайшее содержание клетчатки (5г). Стабилизирует инсулин — идеально для инсулинорезистентности",micros:{Ca:12,Fe:1.2,Mg:35,Zn:1.5,P:140,K:155,VitB3:1.0}},
  {id:"grain_spelt_berries",name:"Спельта (цельное зерно)",category:"grain",kcal:135,protein:5,fat:0.8,carbs:28,fiber:3.5,gi:45,servingSize:"100 г (варёная)",tier:"mid",bestFor:["maintenance","recomp"],timing:"lunch",description:"Древняя пшеница с высоким содержанием белка. Легче усваивается, богата ниацином и магнием",micros:{Ca:10,Fe:1.4,Mg:45,Zn:1.4,P:150,K:150,VitB3:2.0}},
  {id:"grain_oat_groats",name:"Овсяная крупа (неплющёная)",category:"grain",kcal:118,protein:4.2,fat:2.1,carbs:21,fiber:4,gi:42,servingSize:"100 г (варёная)",tier:"mid",bestFor:["mass","maintenance","recomp"],timing:"morning",description:"Цельный овёс — долгая варка 30-40 мин. Максимум бета-глюкана для снижения холестерина",micros:{Ca:15,Fe:2.0,Mg:60,Zn:2.0,P:200,K:170,VitB1:0.3}},
  {id:"grain_quinoa_flakes",name:"Хлопья киноа",category:"grain",kcal:110,protein:4,fat:0.5,carbs:22,fiber:3,gi:38,servingSize:"100 г (варёные)",tier:"mid",bestFor:["maintenance","recomp"],timing:"morning",description:"Быстрая альтернатива киноа. Варить 3 мин. Богата лизином и железом для вегетарианцев",micros:{Ca:12,Fe:1.8,Mg:40,Zn:1.2,P:120,VitB2:0.1}},
  {id:"grain_coconut_flour",name:"Мука кокосовая",category:"grain",kcal:120,protein:2.5,fat:0.8,carbs:18,fiber:10,gi:35,servingSize:"30 г",tier:"mid",bestFor:["maintenance","recomp","cutting"],timing:"any",description:"Безглютеновая мука с высоким содержанием клетчатки. Впитывает в 4 раза больше жидкости чем пшеничная",micros:{Ca:35,Fe:1.5,Mg:30,Zn:0.8,K:280,Se:8}},
  {id:"grain_tapioca_starch",name:"Крахмал тапиоки",category:"grain",kcal:112,protein:0,fat:0,carbs:28,fiber:0,gi:65,servingSize:"30 г",tier:"basic",bestFor:["bulk","strength"],timing:"any",description:"Чистый крахмал из маниоки. Быстрая энергия — отлично для загрузки гликогена и интра-тренировок",micros:{Ca:8,Fe:0.3,K:5}},
  {id:"grain_arrowroot_starch",name:"Крахмал аррорута",category:"grain",kcal:112,protein:0,fat:0,carbs:28,fiber:0,gi:55,servingSize:"30 г",tier:"basic",bestFor:["bulk","strength"],timing:"any",description:"Легкоусвояемый крахмал. Идеален для протеинового хлеба и кето-выпечки",micros:{Ca:10,Fe:0.5,K:15}},

  // ─── FATS & OILS ───
  {id:"oil_ghee",name:"Гхи (топлёное масло)",category:"fat",kcal:895,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл",tier:"mid",bestFor:["bulk","mass"],timing:"any",description:"Топлёное масло без лактозы и казеина. Термостабильно до 250°C. Масляная кислота для здоровья ЖКТ",micros:{Ca:4,Fe:0.1,VitA:100,VitE:2.8,VitK:1.5}},
  {id:"oil_mct",name:"МСТ-масло (из кокоса)",category:"fat",kcal:860,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл",tier:"mid",bestFor:["cutting","recomp","keto"],timing:"morning",description:"Чистые среднецепочечные триглицериды C8+C10. Быстрая энергия без инсулина — идеально для кето",micros:{MCT:100000}},
  {id:"oil_sesame_toasted",name:"Масло кунжутное (тёплый отжим)",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл",tier:"mid",bestFor:["mass","maintenance"],timing:"any",description:"Ароматное масло из жареного кунжута. Богато сезамолом и олеиновой кислотой. Для азиатской кухни",micros:{VitE:3.5,Omega6:45000,Omega9:40000,Sesamol:100}},
  {id:"oil_chili",name:"Масло чили (с перцем)",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл",tier:"basic",bestFor:["bulk","maintenance"],timing:"any",description:"Острое масло для вкуса. Капсаицин ускоряет метаболизм и подавляет аппетит",micros:{VitE:2,Omega6:12000,Capsaicin:50}},
  {id:"oil_truffle",name:"Масло трюфельное (оливковое)",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл",tier:"mid",bestFor:["mass","maintenance"],timing:"any",description:"Оливковое масло с экстрактом трюфеля. Богато антиоксидантами. Для финальной ароматизации блюд",micros:{VitE:10,Omega9:72000,Polyphenols:200}},
  {id:"oil_soybean",name:"Масло соевое",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл",tier:"basic",bestFor:["bulk","mass"],timing:"any",description:"Недорогое масло с нейтральным вкусом. Богато омега-6 — использовать умеренно, комбинировать с омега-3",micros:{VitE:10,Omega3:7000,Omega6:51000}},
  {id:"fat_cocoa_butter",name:"Масло какао (сырое)",category:"fat",kcal:884,protein:0,fat:100,carbs:0,fiber:0,gi:0,servingSize:"30 г",tier:"mid",bestFor:["bulk","mass"],timing:"any",description:"Натуральный жир из какао-бобов. Богат стеариновой кислотой (нейтральный холестерин). Для кето-сладостей",micros:{VitE:1.5,VitK:2,Omega9:35000,Polyphenols:100}},
  {id:"fat_coconut_cream",name:"Кокосовые сливки",category:"fat",kcal:330,protein:3,fat:34,carbs:7,fiber:2,gi:0,servingSize:"100 мл",tier:"mid",bestFor:["bulk","mass","keto"],timing:"any",description:"Жирная фракция кокосового молока. MCT (C10+C12) для энергии и кетоза",micros:{Ca:20,Fe:2.5,Mg:35,K:280,MCT:25000,Omega6:300}},
  {id:"fat_tahini",name:"Тахини (кунжутная паста)",category:"fat",kcal:590,protein:18,fat:53,carbs:14,fiber:5,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass","maintenance","recomp"],timing:"any",description:"Кремовая паста из кунжута. Богата кальцием (430мг/100г), медью, магнием и лецитином",micros:{Ca:430,Fe:6.0,Mg:100,Zn:3.5,Cu:1.6,P:620,VitB1:1.2}},
  {id:"fat_peanut_flour_defatted",name:"Арахисовая мука обезжиренная",category:"fat",kcal:130,protein:14,fat:2,carbs:14,fiber:4,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Молотый обезжиренный арахис. 14г белка на 30г — идеально для протеиновых соусов и коктейлей",micros:{Ca:15,Fe:1.5,Mg:42,Zn:1.2,K:300,VitB3:4.0}},

  // ─── NUTS & SEEDS ───
  {id:"seed_hemp_hearts",name:"Сердцевина конопляного семени",category:"fat",kcal:565,protein:30,fat:48,carbs:9,fiber:3,gi:0,servingSize:"30 г",tier:"max",bestFor:["mass","cutting","recomp"],timing:"any",description:"Чищеные семена конопли — 30г белка на 100г. Полноценный аминокислотный профиль с GLA и SDA",micros:{Ca:45,Fe:4.5,Mg:250,Zn:4.0,K:440,Se:12,Omega3:8000,Omega6:25000,GLA:500}},
  {id:"seed_poppy",name:"Мак (семена)",category:"fat",kcal:525,protein:18,fat:42,carbs:28,fiber:20,gi:0,servingSize:"10 г",tier:"basic",bestFor:["mass","maintenance"],timing:"any",description:"Мелкие масличные семена. Богаты кальцием (1.4г/100г!), магнием, медью и омега-6",micros:{Ca:1400,Fe:9.0,Mg:340,Zn:2.0,Cu:1.6,P:900,VitB1:0.8}},
  {id:"seed_pumpkin_whole",name:"Тыквенные семечки (неочищенные)",category:"fat",kcal:446,protein:19,fat:45,carbs:12,fiber:4,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass","maintenance","recomp"],timing:"any",description:"Цельные семечки с шелухой. Высочайшее содержание цинка (7.8мг/100г) для тестостерона",micros:{Ca:45,Fe:5.5,Mg:245,Zn:7.8,P:1125,K:785,Se:7,VitB3:5,VitE:2}},
  {id:"nut_macadamia_roasted",name:"Макадамия (жареные)",category:"fat",kcal:718,protein:7.5,fat:76,carbs:14,fiber:8,gi:0,servingSize:"30 г",tier:"mid",bestFor:["bulk","mass"],timing:"any",description:"Самые жирные орехи — 76% мононенасыщенных жиров. Пальмитолеиновая кислота для жиросжигания",micros:{Ca:30,Fe:1.0,Mg:35,Zn:0.6,P:115,K:200,Cu:0.3,VitB1:0.5}},
  {id:"nut_hazelnut_roasted",name:"Фундук (лещина)",category:"fat",kcal:628,protein:15,fat:61,carbs:18,fiber:10,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass","maintenance"],timing:"any",description:"Богат витамином E (15мг/100г) — мощный антиоксидант. Высокое содержание марганца и меди",micros:{Ca:100,Fe:3.5,Mg:150,Zn:1.8,P:270,K:520,Cu:1.5,Mn:5.0,VitE:15}},
  {id:"nut_pistachio_roasted",name:"Фисташки (жареные)",category:"fat",kcal:560,protein:20,fat:45,carbs:28,fiber:10,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass","maintenance","recomp"],timing:"any",description:"Самый белковый орех — 20г белка. Лютеин для зрения, витамин B6 для гормонального фона",micros:{Ca:70,Fe:3.0,Mg:100,Zn:2.0,P:350,K:800,Cu:0.8,VitB6:1.5,VitE:3}},

  // ─── VEGETABLES ───
  {id:"veg_artichoke_heart",name:"Сердцевина артишока",category:"veg_fruit",kcal:65,protein:3.5,fat:0.2,carbs:14,fiber:7,gi:15,servingSize:"150 г",tier:"mid",bestFor:["cutting","recomp","maintenance"],timing:"any",description:"Богатейший источник клетчатки (7г/100г) и пребиотика инулина. Гепатопротектор — синегрия с TUDCA",micros:{Ca:45,Fe:1.4,Mg:50,Zn:0.5,K:370,VitC:12,VitK:25,VitB9:90}},
  {id:"veg_chayote",name:"Чайот (мексиканский огурец)",category:"veg_fruit",kcal:19,protein:0.8,fat:0.1,carbs:4,fiber:1.7,gi:15,servingSize:"200 г",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Низкокалорийный овощ. Богат фолиевой кислотой, витамином C и калием. Можно сырым и варёным",micros:{Ca:17,Fe:0.3,Mg:11,Zn:0.7,K:120,VitC:7.7,VitB9:40}},
  {id:"veg_romanesco",name:"Романеско (цветная капуста романская)",category:"veg_fruit",kcal:30,protein:2.5,fat:0.3,carbs:6,fiber:3,gi:15,servingSize:"150 г",tier:"mid",bestFor:["cutting","recomp"],timing:"any",description:"Фрактальная капуста с высоким содержанием сульфорафана. Антивоспалительный и антиоксидантный эффект",micros:{Ca:22,Fe:0.6,Mg:18,Zn:0.4,K:240,VitC:58,VitK:30,Sulforaphane:50}},
  {id:"veg_cardoon",name:"Кардон (испанский артишок)",category:"veg_fruit",kcal:25,protein:1.2,fat:0.2,carbs:5,fiber:3,gi:15,servingSize:"150 г",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Родственник артишока. Стебли богаты цинарином для желчеоттока и гепатопротекции",micros:{Ca:45,Fe:0.6,Mg:28,Zn:0.3,K:280,VitC:3,VitB9:40}},
  {id:"veg_samphire",name:"Самфир (морской укроп)",category:"veg_fruit",kcal:22,protein:1.5,fat:0.3,carbs:4,fiber:2,gi:0,servingSize:"100 г",tier:"mid",bestFor:["cutting","recomp"],timing:"any",description:"Суккулентное растение из солончаков. Природный источник йода и минералов. Солёный вкус — заменитель соли",micros:{Ca:44,Fe:1.5,Mg:55,Zn:0.4,K:400,I:80,VitC:30}},
  {id:"veg_purslane",name:"Портулак (огородный)",category:"veg_fruit",kcal:20,protein:0.9,fat:0.3,carbs:3.5,fiber:1.5,gi:0,servingSize:"100 г",tier:"max",bestFor:["cutting","recomp","maintenance"],timing:"any",description:"Рекордсмен по ALA-омега-3 среди наземных растений (350мг/100г). Антиоксиданты мелатонин и глутатион",micros:{Ca:30,Fe:1.5,Mg:35,Zn:0.5,K:360,Omega3:350,VitA:210,VitC:15,Melatonin:1}},
  {id:"veg_nettle",name:"Крапива (молодая)",category:"veg_fruit",kcal:35,protein:2.5,fat:0.2,carbs:6,fiber:4,gi:0,servingSize:"150 г",tier:"mid",bestFor:["cutting","recomp","detox"],timing:"any",description:"Суперфуд — 25% белка в сушёном виде. Богата железом, кальцием, кремнием и хлорофиллом",micros:{Ca:280,Fe:4.2,Mg:50,Zn:0.5,K:350,VitA:500,VitC:40,VitK:500}},
  {id:"veg_lamb_quarters",name:"Марь белая (лебеда)",category:"veg_fruit",kcal:33,protein:2.5,fat:0.3,carbs:5.5,fiber:2.5,gi:0,servingSize:"150 г",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Съедобное растение с высоким содержанием белка. Богата магнием, калием и витамином C",micros:{Ca:180,Fe:1.5,Mg:60,Zn:0.5,K:280,VitC:50,VitA:300}},
  {id:"veg_fiddlehead_fern",name:"Папоротник-орляк (побеги)",category:"veg_fruit",kcal:25,protein:2.5,fat:0.2,carbs:4,fiber:2.5,gi:0,servingSize:"150 г",tier:"mid",bestFor:["cutting","recomp"],timing:"any",description:"Молодые побеги папоротника с высокой концентрацией антиоксидантов. Богат калием и железом",micros:{Ca:20,Fe:1.2,Mg:20,Zn:0.5,K:250,VitA:200,VitC:20}},
  {id:"veg_jicama_mexican",name:"Хикама (мексиканская репа)",category:"veg_fruit",kcal:38,protein:0.7,fat:0.1,carbs:9,fiber:5,gi:15,servingSize:"150 г",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Хрустящий корнеплод с очень низкой калорийностью и высоким содержанием пребиотической клетчатки (инулин)",micros:{Ca:12,Fe:0.6,Mg:12,Zn:0.2,K:150,VitC:20}},

  // ─── FRUITS ───
  {id:"fruit_cherry_tart",name:"Вишня (свежая)",category:"veg_fruit",kcal:50,protein:1,fat:0.3,carbs:12,fiber:1.5,gi:22,servingSize:"150 г",tier:"mid",bestFor:["maintenance","recomp"],timing:"any",description:"Богата антоцианами для восстановления после тренировок. Натуральный мелатонин для сна",micros:{Ca:16,Fe:0.4,Mg:11,Zn:0.1,K:220,VitC:10,VitA:65,Anthocyanins:170,Melatonin:0.01}},
  {id:"fruit_goji_berries",name:"Ягоды годжи (сушёные)",category:"veg_fruit",kcal:320,protein:12,fat:2.5,carbs:70,fiber:11,gi:45,servingSize:"30 г",tier:"max",bestFor:["mass","maintenance","recomp"],timing:"any",description:"Это не суперфуд, а реальный источник белка среди ягод — 12% белка! Зеаксантин для зрения при ААС",micros:{Ca:55,Fe:4.0,Mg:60,Zn:1.5,K:400,Se:15,VitC:35,VitA:1600,VitB2:0.6}},
  {id:"fruit_lychee_fresh",name:"Личи (свежие)",category:"veg_fruit",kcal:66,protein:0.8,fat:0.4,carbs:16,fiber:1.3,gi:50,servingSize:"150 г",tier:"basic",bestFor:["maintenance","recomp"],timing:"any",description:"Ароматный тропический фрукт. Богат витамином C и калием. Освежающий перекус летом",micros:{Ca:5,Fe:0.3,Mg:10,Zn:0.1,K:170,VitC:72,VitB3:0.6}},
  {id:"fruit_dragonfruit",name:"Питахайя (драконий фрукт)",category:"veg_fruit",kcal:55,protein:1.1,fat:0.4,carbs:13,fiber:3,gi:25,servingSize:"150 г",tier:"mid",bestFor:["cutting","recomp"],timing:"any",description:"Низкокалорийный пребиотический фрукт. Богат клетчаткой и магнием. Антиоксиданты из мякоти с семенами",micros:{Ca:10,Fe:0.7,Mg:25,Zn:0.2,K:250,VitC:5,VitB3:0.3}},
  {id:"fruit_mulberry",name:"Шелковица (тутовая ягода)",category:"veg_fruit",kcal:43,protein:1.4,fat:0.4,carbs:10,fiber:1.7,gi:22,servingSize:"150 г",tier:"mid",bestFor:["cutting","recomp"],timing:"any",description:"Самый богатый белком фрукт — 1.4г/100г. Высочайшее содержание ресвератрола для сердца и сосудов",micros:{Ca:40,Fe:1.9,Mg:18,Zn:0.1,K:200,VitC:36,VitK:10,Resveratrol:2.5}},
  {id:"fruit_papaya_fresh",name:"Папайя (свежая)",category:"veg_fruit",kcal:43,protein:0.5,fat:0.3,carbs:11,fiber:1.7,gi:25,servingSize:"200 г",tier:"mid",bestFor:["cutting","recomp"],timing:"any",description:"Фермент папаин для улучшения усвоения белка. Богата витамином C (62мг) и витамином A",micros:{Ca:20,Fe:0.3,Mg:21,Zn:0.1,K:260,VitC:62,VitA:950,VitB9:38}},
  {id:"fruit_guava",name:"Гуава (свежая)",category:"veg_fruit",kcal:68,protein:2.5,fat:0.9,carbs:14,fiber:5.5,gi:25,servingSize:"150 г",tier:"max",bestFor:["cutting","recomp","maintenance"],timing:"any",description:"Рекордсмен по витамину C — 230мг/100г! Высокое содержание клетчатки (5.5г) и ликопина",micros:{Ca:20,Fe:0.3,Mg:22,Zn:0.2,K:420,VitC:230,VitA:625,VitB9:50,Lycopene:5000}},
  {id:"fruit_starfruit",name:"Карамбола (звёздчатый фрукт)",category:"veg_fruit",kcal:31,protein:1,fat:0.3,carbs:7,fiber:2.5,gi:20,servingSize:"150 г",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Низкокалорийный фрукт. Богат антиоксидантами и витамином C. Осторожно при почечной недостаточности — оксалаты",micros:{Ca:8,Fe:0.5,Mg:10,Zn:0.1,K:130,VitC:35,Oxalates:50}},

  // ─── SUPPLEMENTS & SPORTS NUTRITION ───
  {id:"supp_beef_protein_iso",name:"Протеин говяжий изолят",category:"supplement",kcal:110,protein:26,fat:0.5,carbs:1,fiber:0,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Изолят из говядины — полный аминокислотный профиль с креатином. Гипоаллергенная альтернатива сыворотке",micros:{Ca:50,Fe:1.0,Zn:2.0,Se:15,Creatine:500,Leucine:2400}},
  {id:"supp_egg_white_powder",name:"Яичный белок (порошок)",category:"supplement",kcal:110,protein:24,fat:0,carbs:1.5,fiber:0,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Пастеризованный яичный белок. PDCAAS 1.0, без лактозы и жира. Идеален для сушки",micros:{Ca:40,Fe:0.2,Se:25,Zn:0.1,Leucine:2200}},
  {id:"supp_collagen_hydro",name:"Коллаген гидролизованный",category:"supplement",kcal:110,protein:26,fat:0,carbs:0,fiber:0,gi:0,servingSize:"10 г",tier:"mid",bestFor:["maintenance","rehab","recomp"],timing:"any",description:"Гидролизованный коллаген типа I+III. Глицин, пролин и гидроксипролин для связок, суставов и кожи",micros:{Glycine:2000,Proline:1500,Hydroxyproline:1200}},
  {id:"supp_bone_broth_protein",name:"Коллаген костный бульон (протеин)",category:"supplement",kcal:95,protein:22,fat:0.5,carbs:0,fiber:0,gi:0,servingSize:"25 г",tier:"mid",bestFor:["mass","rehab","maintenance"],timing:"any",description:"Протеин из костного бульона. Богат глицином, глутамином и хондроитином для иммунитета и суставов",micros:{Ca:30,Mg:10,P:50,Glycine:2500,Glutamine:1500,Chondroitin:100}},
  {id:"supp_goat_whey",name:"Сывороточный протеин (козий)",category:"supplement",kcal:115,protein:23,fat:1.5,carbs:2.5,fiber:0,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Гипоаллергенный WPC из козьего молока. A2-бета-казеин — легче усваивается при непереносимости лактозы",micros:{Ca:180,Zn:1.5,Se:10,Leucine:2300}},
  {id:"supp_pea_protein_iso",name:"Гороховый протеин изолят",category:"supplement",kcal:110,protein:24,fat:1,carbs:1.5,fiber:0.5,gi:0,servingSize:"30 г",tier:"mid",bestFor:["mass","cutting","recomp","vegan"],timing:"any",description:"Один из лучших растительных белков (PDCAAS 0.92). Богат аргинином и лизином для NO и синтеза мышц",micros:{Fe:3.5,Zn:1.0,Leucine:2000,Arginine:2200}},
  {id:"supp_rice_protein",name:"Рисовый протеин",category:"supplement",kcal:105,protein:23,fat:1.5,carbs:1.5,fiber:0,gi:0,servingSize:"30 г",tier:"basic",bestFor:["mass","cutting","vegan"],timing:"any",description:"Гипоаллергенный растительный белок. Комбинировать с гороховым для полноценного аминокислотного профиля",micros:{Fe:1.0,Zn:0.5,Leucine:1800}},
  {id:"supp_hmb_ca",name:"HMB (кальция гидроксиметилбутират)",category:"supplement",kcal:10,protein:0,fat:0,carbs:0,fiber:0,gi:0,servingSize:"3 г",tier:"mid",bestFor:["cutting","recomp","maintenance"],timing:"after_train",description:"Антикатаболик — снижает распад мышечного белка через ингибирование MU RF-1. Эффективен на сушке и в начале курса",micros:{Ca:200}},
  {id:"supp_l_carnitine_tartrate",name:"L-карнитин тартрат",category:"supplement",kcal:8,protein:0,fat:0,carbs:0,fiber:0,gi:0,servingSize:"2 г",tier:"mid",bestFor:["cutting","recomp","rehab"],timing:"after_train",description:"Транспорт жирных кислот в митохондрии. Улучшает чувствительность к андрогенам и восстанавливает рецепторы",micros:{Carnitine:2000}},
  {id:"supp_alpha_gpc",name:"Alpha-GPC (альфа-глицерилфосфорилхолин)",category:"supplement",kcal:5,protein:0,fat:0,carbs:0,fiber:0,gi:0,servingSize:"600 мг",tier:"mid",bestFor:["mass","strength"],timing:"pre_workout",description:"Прекурсор ацетилхолина. Повышает силовой выход 5-10%. Синергия с креатином и кофеином",micros:{Choline:200}},
  {id:"supp_l_theanine",name:"L-теанин",category:"supplement",kcal:4,protein:0,fat:0,carbs:0,fiber:0,gi:0,servingSize:"200 мг",tier:"mid",bestFor:["maintenance","recomp"],timing:"any",description:"Аминокислота из зелёного чая. Альфа-волны для фокуса без сонливости. Cинергия с кофеином для предтреника",micros:{Theanine:200}},
  {id:"supp_creatine_hcl",name:"Креатин гидрохлорид (HCL)",category:"supplement",kcal:5,protein:0,fat:0,carbs:0,fiber:0,gi:0,servingSize:"2 г",tier:"mid",bestFor:["mass","strength"],timing:"any",description:"Высокая растворимость и биодоступность. Нет нагрузки и вздутия как у моногидрата. Доза 1.5-2г",micros:{Creatine:2000}},
  {id:"supp_glycerol",name:"Глицерол (жидкий)",category:"supplement",kcal:27,protein:0,fat:0,carbs:6.8,fiber:0,gi:0,servingSize:"5 г",tier:"mid",bestFor:["strength","mass"],timing:"pre_workout",description:"Гидратант — задерживает воду в мышцах. Улучшает венозность, пампинг и терморегуляцию на тренировке",micros:{Glycerol:5000}},
  {id:"supp_sodium_bicarbonate",name:"Бикарбонат натрия (сода)",category:"supplement",kcal:0,protein:0,fat:0,carbs:0,fiber:0,gi:0,servingSize:"3 г",tier:"basic",bestFor:["strength","mass"],timing:"pre_workout",description:"Буфер — связывает лактат. Отодвигает закисление на 15-30 сек. Принимать за 90 мин до тренировки",micros:{Na:825}},
  {id:"supp_beta_alanine_time",name:"Бета-аланин (пролонгированный)",category:"supplement",kcal:4,protein:0,fat:0,carbs:0,fiber:0,gi:0,servingSize:"3.2 г",tier:"mid",bestFor:["mass","strength"],timing:"pre_workout",description:"Повышает карнозин в мышцах на 40-60% за 4 недели. Отодвигает усталость на 10-15% в повторах 8-15",micros:{BetaAlanine:3200}},
  {id:"supp_citrulline_dl_malate",name:"Цитруллин малат 2:1",category:"supplement",kcal:8,protein:0,fat:0,carbs:2,fiber:0,gi:0,servingSize:"6 г",tier:"mid",bestFor:["strength","mass"],timing:"pre_workout",description:"Цикл мочевины → аргинин → NO. Пампинг, снижение усталости на 20%, вывод аммиака",micros:{Citrulline:4000,MalicAcid:2000}},
  {id:"supp_agmatine_sulfate",name:"Агматин сульфат",category:"supplement",kcal:4,protein:0,fat:0,carbs:0,fiber:0,gi:0,servingSize:"1 г",tier:"mid",bestFor:["strength","mass"],timing:"pre_workout",description:"Метаболит аргинина. NO-донор + ингибитор iNOS. Мощный пампинг, снижение нейропатической боли",micros:{Agmatine:1000}},
  {id:"supp_phosphatidylserine",name:"Фосфатидилсерин",category:"supplement",kcal:4,protein:0,fat:0.5,carbs:0,fiber:0,gi:0,servingSize:"100 мг",tier:"mid",bestFor:["maintenance","rehab"],timing:"before_sleep",description:"Фосфолипид — снижает кортизол на 20-30%. Улучшает восстановление и сон при высокоинтенсивных тренировках",micros:{PS:100}},
  {id:"supp_bacopa_monnieri",name:"Бакопа Монье (брахми)",category:"supplement",kcal:3,protein:0,fat:0,carbs:0,fiber:0,gi:0,servingSize:"300 мг",tier:"basic",bestFor:["maintenance","rehab"],timing:"any",description:"Адаптоген для памяти и нейрогенеза. Бакозиды улучшают когнитивные функции при PCT и курсе",micros:{Bacosides:60}},
  {id:"supp_lions_maine",name:"Ежовик гребенчатый (Lion's Mane)",category:"supplement",kcal:4,protein:0,fat:0,carbs:0,fiber:0,gi:0,servingSize:"500 мг",tier:"mid",bestFor:["maintenance","rehab","recomp"],timing:"morning",description:"Стимулирует NGF (фактор роста нервов) на 30%. Восстанавливает нейропластичность после курса ААС",micros:{NGF:100,Hericenones:50,Erinacines:30}},
  {id:"supp_potassium_citrate",name:"Калия цитрат",category:"supplement",kcal:2,protein:0,fat:0,carbs:0,fiber:0,gi:0,servingSize:"1 г",tier:"mid",bestFor:["mass","strength","maintenance"],timing:"any",description:"Калий + цитрат — ощелачивает кровь. Компенсирует потери калия от кленбутерола, диуретиков, инсулина",micros:{K:380}},
  {id:"supp_boron_glycinate",name:"Бор глицинат",category:"supplement",kcal:0,protein:0,fat:0,carbs:0,fiber:0,gi:0,servingSize:"3 мг",tier:"mid",bestFor:["mass","strength"],timing:"morning",description:"Повышает свободный тестостерон на 12-15% через снижение SHBG. Улучшает плотность костей и когницию",micros:{Boron:3}},
  {id:"supp_chromium_picolinate",name:"Хром пиколинат",category:"supplement",kcal:0,protein:0,fat:0,carbs:0,fiber:0,gi:0,servingSize:"200 мкг",tier:"basic",bestFor:["cutting","recomp"],timing:"morning",description:"Улучшает чувствительность к инсулину. Снижает тягу к сладкому на сушке. Синергия с берберином",micros:{Cr:200}},
  {id:"supp_iodine_kelp",name:"Йод (из ламинарии)",category:"supplement",kcal:2,protein:0,fat:0,carbs:0.5,fiber:0,gi:0,servingSize:"150 мкг",tier:"basic",bestFor:["maintenance","cutting"],timing:"morning",description:"Йод из морской капусты. Поддерживает щитовидную железу на низкоуглеводной диете и при приёме кленбутерола",micros:{I:150}},
  {id:"supp_mct_powder",name:"МСТ порошок (C8+C10)",category:"supplement",kcal:115,protein:0,fat:12,carbs:0,fiber:0,gi:0,servingSize:"15 г",tier:"mid",bestFor:["keto","cutting","recomp"],timing:"any",description:"Масло MCT в капсулированном порошке. Быстрая доставка кетонов без инсулинового ответа",micros:{MCT:12000}},
  {id:"supp_greens_powder",name:"Зелёный порошок (суперфуд)",category:"supplement",kcal:25,protein:1.5,fat:0.5,carbs:4,fiber:2,gi:0,servingSize:"5 г",tier:"mid",bestFor:["maintenance","cutting","detox"],timing:"morning",description:"Концентрат овощей и трав — хлорофилл, антиоксиданты, пробиотики. Поддерживает детокс печени на курсе",micros:{Fe:1.0,Mg:15,Zn:0.5,VitC:20,VitA:500,Chlorophyll:50}},
  {id:"supp_beetroot_powder",name:"Свекольный порошок (нитраты)",category:"supplement",kcal:20,protein:1,fat:0,carbs:4,fiber:1,gi:0,servingSize:"5 г",tier:"mid",bestFor:["strength","cardio"],timing:"pre_workout",description:"Нитраты → NO → расширение сосудов. Повышает выносливость на 10-15%. Снижает артериальное давление",micros:{Fe:0.5,K:150,VitC:5,Nitrates:300}},
  {id:"supp_electrolyte_tabs",name:"Электролитный комплекс (шипучий)",category:"supplement",kcal:5,protein:0,fat:0,carbs:1,fiber:0,gi:0,servingSize:"1 таб",tier:"mid",bestFor:["cutting","keto","strength"],timing:"any",description:"Na (200мг) + K (100мг) + Mg (50мг) + Ca (30мг). Регидратация на сушке, кето и в жару",micros:{Na:200,K:100,Mg:50,Ca:30}},
  {id:"supp_ketone_esters",name:"Кетоновые эфиры (BHB)",category:"supplement",kcal:40,protein:0,fat:0,carbs:0,fiber:0,gi:0,servingSize:"10 мл",tier:"basic",bestFor:["keto","cutting"],timing:"pre_workout",description:"Экзогенные кетоны (BHB). Мгновенный кетоз, энергия без сахара. Когнитивный фокус, снижение аппетита",micros:{BHB:5000}},

  // ─── CONDIMENTS, SAUCES & INGREDIENTS ───
  {id:"sauce_sriracha",name:"Срирача (острый соус)",category:"other",kcal:20,protein:0.5,fat:0.5,carbs:4,fiber:0.5,gi:0,servingSize:"15 мл",tier:"basic",bestFor:["cutting","maintenance"],timing:"any",description:"Острый соус из перца хабанеро. Капсаицин ускоряет метаболизм на 5-8%. Практически без калорий",micros:{Na:200,VitC:2,Capsaicin:10}},
  {id:"sauce_gochujang",name:"Кочхуджан (корейская паста)",category:"other",kcal:35,protein:1.2,fat:0.8,carbs:7,fiber:1,gi:0,servingSize:"15 г",tier:"basic",bestFor:["mass","maintenance"],timing:"any",description:"Ферментированная паста из красного перца. Пробиотики, капсаицин, глутамат — усилитель вкуса без MSG",micros:{Na:250,Fe:0.5,VitC:3}},
  {id:"sauce_miso_paste",name:"Мисо-паста (белая)",category:"other",kcal:35,protein:2.5,fat:1,carbs:5,fiber:1.5,gi:0,servingSize:"15 г",tier:"mid",bestFor:["maintenance","recomp"],timing:"any",description:"Ферментированная соевая паста. Пробиотики, изофлавоны, витамины группы B. Синергия с жирной рыбой",micros:{Ca:15,Fe:0.5,Mg:10,Zn:0.5,K:120,VitB2:0.1,VitB12:0.1}},
  {id:"sauce_wasabi",name:"Васаби (японский хрен)",category:"other",kcal:20,protein:0.5,fat:0.3,carbs:4,fiber:0.5,gi:0,servingSize:"10 г",tier:"basic",bestFor:["cutting","maintenance"],timing:"any",description:"Антимикробный и противовоспалительный корень. Изотиоцианаты для детокса печени",micros:{Ca:10,Fe:0.2,VitC:5,K:50}},
  {id:"sauce_fish_sauce",name:"Рыбный соус (нам пла)",category:"other",kcal:10,protein:1.5,fat:0,carbs:0.5,fiber:0,gi:0,servingSize:"15 мл",tier:"basic",bestFor:["cutting","maintenance"],timing:"any",description:"Ферментированный анчоусный экстракт. Природный глутамат для вкуса без калорий. Микро-доза йода и белка",micros:{Na:1400,Ca:10,I:5}},
  {id:"sauce_oyster",name:"Устричный соус",category:"other",kcal:25,protein:0.5,fat:0.3,carbs:5,fiber:0,gi:0,servingSize:"15 мл",tier:"basic",bestFor:["mass","maintenance"],timing:"any",description:"Густой соус из экстракта устриц. Богат цинком и глутаминовой кислотой для усиления вкуса",micros:{Ca:5,Fe:0.3,Zn:0.5,Na:600}},
  {id:"spice_nutritional_yeast",name:"Пищевые дрожжи (хлопья)",category:"other",kcal:40,protein:5,fat:0.5,carbs:4,fiber:2,gi:0,servingSize:"10 г",tier:"mid",bestFor:["mass","cutting","recomp"],timing:"any",description:"Деактивированные дрожжи — сырный вкус без сыра. B12 (8мкг/10г) для веганов, бета-глюканы для иммунитета",micros:{B12:8,VitB1:1.5,VitB2:1.0,VitB3:6,VitB6:1.0,Zn:1.5}},
  {id:"spice_garlic_powder",name:"Чеснок сушёный (порошок)",category:"other",kcal:15,protein:0.7,fat:0.1,carbs:3.2,fiber:0.5,gi:0,servingSize:"5 г",tier:"basic",bestFor:["maintenance","cutting"],timing:"any",description:"Концентрированный чеснок. Аллицин (при активации водой) — антибактериальный, снижает давление и холестерин",micros:{Ca:10,Fe:0.3,Mg:5,Zn:0.2,Se:1.5}},

  // ─── BEVERAGES ───
  {id:"drink_keto_coffee",name:"Кето-кофе (с маслом MCT)",category:"other",kcal:180,protein:0.5,fat:20,carbs:0.5,fiber:0,gi:0,servingSize:"250 мл",tier:"basic",bestFor:["keto","cutting"],timing:"morning",description:"Чёрный кофе + 15мл MCT + 15мл гхи. Кетоны + кофеин для энергии и жиросжигания до обеда",micros:{VitE:2,MCT:15000}},
  {id:"drink_apple_cider_vinegar",name:"Яблочный уксус (с водой)",category:"other",kcal:3,protein:0,fat:0,carbs:0.1,fiber:0,gi:0,servingSize:"250 мл (15мл уксуса)",tier:"mid",bestFor:["cutting","recomp"],timing:"morning",description:"Уксус перед едой — снижает гликемический ответ на 20-30%. Улучшает чувствительность к инсулину на сушке",micros:{K:15,AceticAcid:750}},
  {id:"drink_bone_broth",name:"Костный бульон (говяжий)",category:"other",kcal:30,protein:5,fat:1,carbs:0,fiber:0,gi:0,servingSize:"250 мл",tier:"mid",bestFor:["maintenance","rehab"],timing:"any",description:"Коллаген, глицин, глутамин и электролиты. Восстанавливает кишечник, суставы и иммунитет на курсе ААС",micros:{Ca:15,Mg:10,K:150,Na:300,Glycine:1500,Glutamine:500}},
  {id:"drink_keto_electrolyte",name:"Кето-электролит (вода с солью)",category:"other",kcal:0,protein:0,fat:0,carbs:0,fiber:0,gi:0,servingSize:"500 мл",tier:"basic",bestFor:["keto","cutting"],timing:"any",description:"Вода + гималайская соль + лимон. Na (500мг) и K (200мг) для профилактики кето-гриппа и судорог",micros:{Na:500,K:200}},
  {id:"drink_collagen_water",name:"Коллагеновая вода",category:"other",kcal:40,protein:10,fat:0,carbs:0,fiber:0,gi:0,servingSize:"250 мл",tier:"mid",bestFor:["maintenance","rehab"],timing:"any",description:"Напиток с гидролизованным коллагеном. 10г белка в порции. Для связок, суставов и кожи на курсе ААС",micros:{Glycine:1500,Proline:1000}},
  {id:"drink_hemp_milk",name:"Молоко конопляное",category:"other",kcal:60,protein:3,fat:4.5,carbs:1.5,fiber:0.5,gi:0,servingSize:"250 мл",tier:"mid",bestFor:["mass","maintenance","vegan"],timing:"any",description:"Растительное молоко с 3г белка, омега-3 (ALA) и GLA. Без лактозы, сои и глютена",micros:{Ca:100,Fe:0.8,Mg:25,Zn:0.5,K:120,Omega3:500,VitD:1.5,VitB12:1}},
  {id:"drink_keffir_water",name:"Кефир водный (тиби)",category:"other",kcal:15,protein:0.2,fat:0.1,carbs:3,fiber:0,gi:0,servingSize:"250 мл",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Ферментированный напиток на воде. Пробиотики (штаммы Lactobacillus, Bifidobacterium). Нулевая калорийность",micros:{K:30,Probiotics:100}},
  {id:"drink_karkade",name:"Каркаде (суданская роза)",category:"other",kcal:5,protein:0.1,fat:0,carbs:1,fiber:0,gi:0,servingSize:"250 мл",tier:"mid",bestFor:["cutting","recomp"],timing:"any",description:"Чай из гибискуса — антоцианы, снижает давление на 10% за 4 нед. Охлаждённый — идеальный освежитель на сушке",micros:{Fe:0.5,VitC:2,Anthocyanins:100}},
  {id:"drink_coconut_water",name:"Кокосовая вода (натуральная)",category:"other",kcal:19,protein:0.2,fat:0.2,carbs:3.7,fiber:0,gi:45,servingSize:"250 мл",tier:"mid",bestFor:["cutting","recomp","rehab"],timing:"after_train",description:"Природный изотонический напиток — K (250мг), Mg (25мг), Na (45мг). Регидрация после тренировки",micros:{K:250,Mg:25,Ca:20,Na:45,VitC:6,La:1}},
  {id:"veg_okra",name:"Окра (бамия)",category:"veg_fruit",kcal:33,protein:2,fat:0.1,carbs:7,fiber:3.2,gi:20,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Богата растворимой клетчаткой, мукополисахаридами — загущает бульоны, защищает слизистую ЖКТ. Витамин K (66% ДН), C, B9 (60%)",micros:{VitK:66,VitC:20,Folic:60,Mg:36,K:135,Ca:82}},
  {id:"veg_kohlrabi",name:"Кольраби",category:"veg_fruit",kcal:27,protein:1.7,fat:0.1,carbs:6,fiber:3.6,gi:20,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Капустный корнеплод — хрустящий, сочный, сладковатый. Калий (350мг), VitC (62мг), клетчатка. Можно сырым в салаты или тушёным",micros:{VitC:62,K:350,Cu:0.2,Mn:0.2}},
  {id:"veg_chard",name:"Мангольд (листовая свекла)",category:"veg_fruit",kcal:19,protein:1.8,fat:0.2,carbs:3.7,fiber:1.6,gi:15,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Листовая зелень — витамин K (700% ДН), магний (81мг), железо (1.8мг). Стебли цветные — бетацианины. Бланшировать 2 мин, тушить",micros:{VitK:700,VitC:30,Mg:81,Fe:1.8,K:379,VitA:36}},
  {id:"veg_jicama",name:"Хикама (ямбок)",category:"veg_fruit",kcal:38,protein:0.7,fat:0.1,carbs:9,fiber:4.9,gi:15,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Мексиканский корнеплод — хрустящий, сочный (90% воды), богат пребиотиком инулином (6г). Низкий ГИ. Термическая обработка не требуется",micros:{VitC:20,K:150,Mg:12,Inulin:6000}},
  {id:"veg_nopales",name:"Кактусовые листья (нопали),варёные",category:"veg_fruit",kcal:16,protein:1.3,fat:0.1,carbs:3.3,fiber:2,gi:15,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Кусочки кактуса Opuntia — растворимая клетчатка (пектины), снижают гликемию после еды на 30%. Кальций, магний, калий",micros:{VitC:15,Ca:120,Mg:50,K:220,Fe:0.5}},
  {id:"veg_celeriac",name:"Корень сельдерея (цельн.)",category:"veg_fruit",kcal:42,protein:1.5,fat:0.3,carbs:9.2,fiber:1.8,gi:35,servingSize:"100 г",tier:"basic",bestFor:["cutting","maintenance"],timing:"any",description:"Корнеплод — клетчатка, калий (300мг), VitC (8мг), VitK. Сырым в салаты, запечённый — замена картофеля (меньше калорий)",micros:{VitC:8,VitK:40,K:300,P:115,Mg:20}},
  {id:"veg_fennel",name:"Фенхель (луковица, сырой)",category:"veg_fruit",kcal:31,protein:1.2,fat:0.2,carbs:7.3,fiber:3.1,gi:20,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Луковица с анисовым вкусом. Витамин C (12мг), K (60% ДН), калий. Эфирные масла — снижают газообразование, улучшают ЖКТ",micros:{VitC:12,VitK:60,K:360,Fe:0.7,Mg:17,Ca:49}},
  {id:"veg_celerysticks",name:"Сельдерей черешковый",category:"veg_fruit",kcal:16,protein:0.7,fat:0.2,carbs:3,fiber:1.6,gi:15,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp","maintenance"],timing:"any",description:"Классический продукт для сушки — отрицательные калории (больше энергии на пережёвывание). Калий 260мг, VitK",micros:{VitK:50,K:260,Folic:36,Ca:40}},
  {id:"veg_radicchio",name:"Радиккио (красный цикорий)",category:"veg_fruit",kcal:23,protein:1.4,fat:0.1,carbs:4.5,fiber:0.9,gi:15,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Итальянский горький салат — антоцианы (в 2 раза больше чем в краснокочанной капусте), интибин (стимулирует пищеварение)",micros:{VitK:200,VitC:15,K:230,Folic:60,Cu:0.3}},
  {id:"veg_endive",name:"Эндивий/эскариол",category:"veg_fruit",kcal:17,protein:1.3,fat:0.2,carbs:3.4,fiber:3.1,gi:15,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Цикорийный салат — горьковатый вкус от интибина, много фолиевой кислоты (142% ДН), VitA, клетчатки. Для зелёных смузи и салатов",micros:{Folic:142,VitA:100,VitC:10,K:314,Ca:50}},
  {id:"veg_purslane",name:"Портулак (свежий)",category:"veg_fruit",kcal:16,protein:1.3,fat:0.1,carbs:3.4,fiber:1.7,gi:15,servingSize:"100 г",tier:"mid",bestFor:["cutting","recomp"],timing:"any",description:"Листовой овощ — рекордсмен среди зелени по ALA-омега-3 (400мг/100г). Глутатион, дофамин, мелатонин в растении. Свежим в салаты",micros:{Omega3:400,VitA:132,VitC:21,Fe:1.9,Mg:68,K:494,Melatonin:1}},
  {id:"veg_leek",name:"Лук-порей (варёный)",category:"veg_fruit",kcal:31,protein:1.5,fat:0.2,carbs:7.6,fiber:1.8,gi:35,servingSize:"100 г",tier:"basic",bestFor:["cutting","maintenance"],timing:"any",description:"Порей — кверцетин (23мг, инактивация гистамина), фолиевая, Fe (2.1мг). Варёный мягкий — для крем-супов и гарниров, сочетается с куриным бульоном",micros:{Folic:64,Fe:2.1,K:180,Mg:28,Quercetin:23,VitK:47}},
  {id:"fruit_goji_dried",name:"Ягоды годжи сушёные",category:"veg_fruit",kcal:349,protein:14,fat:0.4,carbs:77,fiber:13,gi:55,servingSize:"30 г",tier:"mid",bestFor:["maintenance","recomp"],timing:"snack",description:"14г белка/100г + 8 незаменимых аминокислот. Зеаксантин — защита сетчатки глаза (окулярные побочки SARMs). Цеин (полипептид), бетаин",micros:{VitC:48,Fe:6.8,Zeaxanthin:25,VitA:160,Cu:0.6,Selenium:50}},
  {id:"fruit_lychee",name:"Личи (свежие)",category:"veg_fruit",kcal:66,protein:0.8,fat:0.4,carbs:16.5,fiber:1.3,gi:57,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp"],timing:"snack",description:"Экзотический фрукт — олигонол (проантоцианидины А2) для противовирусной защиты (герпес на курсе). VitC (72мг/100г), калий",micros:{VitC:72,Cu:0.15,K:170,Folic:14,Oligonol:50}},
  {id:"fruit_passion",name:"Маракуйя",category:"veg_fruit",kcal:97,protein:2.2,fat:0.7,carbs:23.4,fiber:10.4,gi:30,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp","maintenance"],timing:"snack",description:"Рекордсмен по клетчатке (10.4г) — пектин снижает холестерин. Пассифлорин (лёгкое седативное). VitC, бета-каротин, K",micros:{VitC:30,VitA:42,Fe:1.6,K:348,Mg:29,Fiber:10}},
  {id:"fruit_feijoa",name:"Фейхоа",category:"veg_fruit",kcal:55,protein:0.7,fat:0.6,carbs:13,fiber:2.6,gi:40,servingSize:"100 г",tier:"basic",bestFor:["cutting","maintenance"],timing:"snack",description:"Рекордсмен по йоду (40-80мкг/100г) — защита щитовидной железы. Acetogenins (противоопухолевые). Витамин C (33мг)",micros:{VitC:33,Iodine:60,K:172,Folic:23,Fe:0.2}},
   {id:"fruit_pomelo",name:"Помело",category:"veg_fruit",kcal:38,protein:0.8,fat:0,carbs:9.6,fiber:1,gi:45,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp"],timing:"snack",description:"Крупнейший цитрус — нарингенин (метаболизм AAS через CYP3A4? — ингибирует, может повышать уровень пероральных). VitC (61мг), калий",micros:{VitC:61,K:216,Naringenin:200,VitA:3}},
  {id:"fruit_dragonfruit",name:"Питахайя (драконий фрукт)",category:"veg_fruit",kcal:60,protein:1.2,fat:0,carbs:13,fiber:3,gi:52,servingSize:"100 г",tier:"basic",bestFor:["cutting","maintenance"],timing:"snack",description:"Богат пребиотическими олигосахаридами (бетацианины), магний (40мг), VitC. Семена — ALA омега-3. Яркий цвет для эстетики блюд",micros:{VitC:9,Mg:40,Fe:0.7,Ca:18,K:160,Fiber:3}},
  {id:"fruit_quince",name:"Айва",category:"veg_fruit",kcal:57,protein:0.4,fat:0.1,carbs:15,fiber:1.9,gi:41,servingSize:"100 г",tier:"basic",bestFor:["cutting","maintenance"],timing:"snack",description:"Осенний фрукт — пектин, дубильные вещества (танины — защита слизистой ЖКТ от НПВС). Богата VitC (18мг), медью. Требует тепловой обработки",micros:{VitC:18,Cu:0.13,Fe:0.7,K:197,Folic:4}},
  {id:"fruit_medlar",name:"Мушмула (локва)",category:"veg_fruit",kcal:47,protein:0.4,fat:0.2,carbs:12,fiber:1.7,gi:40,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp"],timing:"snack",description:"Субтропический фрукт — корозоловая кислота (противовоспалительное, снижение глюкозы). Богата калием, бета-каротином. Сладко-кислая",micros:{VitA:76,VitC:1,K:266,Folic:12,Ca:16}},
  {id:"fruit_soursop",name:"Саусеп (сметанное яблоко)",category:"veg_fruit",kcal:66,protein:1,fat:0.3,carbs:16.8,fiber:3.3,gi:30,servingSize:"100 г",tier:"basic",bestFor:["cutting","maintenance"],timing:"snack",description:"Тропический фрукт — ацетогенины (annocatacin, противоопухолевые свойства), VitC (20мг), B9 (14мкг). Мягкая клетчатка. Свежим или смузи",micros:{VitC:20,Folic:14,K:278,Cu:0.1,Mg:21}},
  {id:"fruit_bilberry",name:"Черника (свежая/замороженная)",category:"veg_fruit",kcal:57,protein:0.7,fat:0.3,carbs:14.5,fiber:2.4,gi:53,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Антоцианы (миритиллин) — улучшение ночного зрения, укрепление капилляров (ретинопатия на курсе). VitK (19мкг), марганец (0.3мг)",micros:{VitK:19,Mn:0.3,Anthocyanins:250,VitC:16,Fiber:2.4}},
  {id:"fruit_cloudberry",name:"Морошка",category:"veg_fruit",kcal:40,protein:1.5,fat:0.8,carbs:8.6,fiber:3.3,gi:35,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp","maintenance"],timing:"any",description:"Северная ягода — эллаговая кислота (химиопротектор печени), VitC (160мг — 200% ДН), бензойная кислота (природный антисептик)",micros:{VitC:160,VitA:52,Fe:0.5,Ca:15,Ellagic:40}},
  {id:"fruit_cherimoya",name:"Черимойя (сахарное яблоко)",category:"veg_fruit",kcal:75,protein:1.6,fat:0.7,carbs:17.7,fiber:4.7,gi:32,servingSize:"100 г",tier:"basic",bestFor:["maintenance","recomp"],timing:"snack",description:"Закваска — кремообразная мякоть с 4.7г клетчатки, тиамин (B1), B6. Ацетогенины в косточках (НЕ есть, токсичны!). VitC (12мг)",micros:{VitB1:0.1,VitB6:0.2,VitC:12,K:287,Fiber:4.7}},
  {id:"fruit_salak",name:"Салак (змеиный фрукт)",category:"veg_fruit",kcal:82,protein:0.4,fat:0.2,carbs:21,fiber:4,gi:45,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp"],timing:"snack",description:"Тропический фрукт с зеленой кожицей — дубильные вещества (закрепление при диарее), калий, пектин. Сладко-терпкий, хрустящий",micros:{K:280,Fe:2.5,Ca:18,Fiber:4,VitC:8}},
  {id:"fruit_jackfruit",name:"Джекфрут (хлебное дерево)",category:"veg_fruit",kcal:95,protein:1.7,fat:0.6,carbs:23,fiber:1.5,gi:50,servingSize:"100 г",tier:"basic",bestFor:["mass","maintenance"],timing:"any",description:"Крупнейший древесный плод — текстура волокнистая ('веганское мясо'). Богат VitB6, C, калий. Семена жарят как каштаны (крахмал!)",micros:{VitB6:0.3,VitC:14,K:448,Cu:0.2,Mg:37}},
  {id:"fruit_starfruit",name:"Карамболь (старфрут)",category:"veg_fruit",kcal:31,protein:1,fat:0.3,carbs:6.7,fiber:2.8,gi:35,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp"],timing:"snack",description:"Звездчатый фрукт — щавелевая кислота (ОСТОРОЖНО: противопоказан при почечной недостаточности!), VitC (34мг), K, Cu. Кисловато-освежающий",micros:{VitC:34,K:133,Cu:0.14,Folic:12,Fiber:2.8}},
  // ─── Фрукты 5 ───
  {id:"fruit_rambutan",name:"Рамбутан",category:"veg_fruit",kcal:84,protein:0.7,fat:0.2,carbs:21,fiber:1.8,gi:45,servingSize:"100 г",tier:"basic",bestFor:["cutting","mass"],timing:"snack",description:"Волосатый тропический — VitC (4.9мг), медь (0.2мг), марганец (0.3мг). Сочная сладкая мякоть. Высокое содержание марганца для костей",micros:{VitC:5,Cu:0.2,Mn:0.3,Ca:22,Fe:0.4,K:42}},
  // ─── Зерновые 2 ───
  {id:"grain_polenta",name:"Полента (кукурузная крупа, варёная)",category:"grain",kcal:86,protein:2,fat:0.4,carbs:18,fiber:0.6,gi:48,servingSize:"150 г",tier:"basic",bestFor:["mass","maintenance"],timing:"any",description:"Кукурузная каша — медленные углеводы (амилопектин). Без глютена. Лактозафермент? — нет. Даёт плотный науглеводивание при массонаборе",micros:{VitA:13,Folic:19,Fe:0.5,P:53,K:57}},
  {id:"grain_matzo",name:"Маца (пресный хлеб)",category:"grain",kcal:391,protein:10,fat:1.4,carbs:83,fiber:3,gi:70,servingSize:"50 г",tier:"basic",bestFor:["mass","cutting"],timing:"any",description:"Пресный хлеб из белой муки — быстро переваривается, низкий объём в желудке. 10г белка/100г. Щадящий для ЖКТ диета BRAT",micros:{Fe:2.8,Se:30,Ca:15,B1:0.4,Niacin:4.5}},
  // ─── Протеин 1 ───
  {id:"protein_crayfish",name:"Раки (мясо, варёные)",category:"protein",kcal:87,protein:17.5,fat:1.2,carbs:0,fiber:0,gi:0,servingSize:"100 г",tier:"mid",bestFor:["cutting","recomp"],timing:"dinner",description:"Раковое мясо — 17.5г белка, 1.2г жира. Богат цинком (3.5мг), B12 (2.4мкг), селен (27мкг), медью. Минимум ртути",micros:{Zn:3.5,Se:27,Cu:0.5,B12:2.4,K:260,P:230}},
  {id:"protein_squid_canned",name:"Кальмары консервированные",category:"protein",kcal:78,protein:16,fat:1.2,carbs:0.5,fiber:0,gi:0,servingSize:"100 г",tier:"mid",bestFor:["cutting","recomp"],timing:"any",description:"Готовый белок 16г на 100г — удобно для быстрой закуски. Таурин, селен, B12. Меньше ртути чем тунец",micros:{Se:40,B12:1.8,Taurine:150,Zn:1.3,Fe:0.6}},
  {id:"protein_whelk",name:"Трубач (мясо)",category:"protein",kcal:88,protein:16.5,fat:1.3,carbs:1.5,fiber:0,gi:0,servingSize:"100 г",tier:"mid",bestFor:["cutting","recomp"],timing:"any",description:"Мясо морской улитки — 16.5г белка, жевательная текстура как осьминог. Магний (82мг), Zn (2.2мг), Fe (2.1мг). Селен (45мкг)",micros:{Mg:82,Zn:2.2,Fe:2.1,Se:45,B12:2.1}},
  {id:"protein_mussels_canned",name:"Мидии консервированные",category:"protein",kcal:86,protein:12,fat:4.5,carbs:1.3,fiber:0,gi:0,servingSize:"100 г",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Готовые мидии в масле — 12г белка, жирные кислоты (EPA/DHA ~0.5г). Цинк (1.6мг), Se (45мкг). Для салатов и закусок",micros:{Zn:1.6,Se:45,Fe:3.5,B12:12,Omega3:500}},
  // ─── Молочные 2 ───
  {id:"dairy_kefir_10",name:"Кефир 1% жирности",category:"dairy",kcal:40,protein:3,fat:1,carbs:4,fiber:0,gi:30,servingSize:"200 мл",tier:"basic",bestFor:["cutting","recomp","maintenance"],timing:"evening",description:"Пробиотики (10-30 штаммов Lb/kefiran), B2, B12, Ca (120мг). Кефиран — экзополисахарид, снижает холестерин и модулирует иммунитет",micros:{Ca:120,Probiotics:200,VitB2:0.14,B12:0.4,P:90}},
  {id:"dairy_ryazhenka",name:"Ряженка 2.5%",category:"dairy",kcal:54,protein:2.9,fat:2.5,carbs:4.2,fiber:0,gi:35,servingSize:"200 мл",tier:"basic",bestFor:["maintenance","recomp"],timing:"snack",description:"Топлёное молоко — карамелизованный сахар (лактоза + аминокислоты). Ca (124мг), A (24мкг). Легче усваивается чем кефир",micros:{Ca:124,VitA:24,VitB12:0.3,P:96}},
  {id:"dairy_ayran",name:"Айран (солёный йогурт)",category:"dairy",kcal:25,protein:1.3,fat:1.3,carbs:1.7,fiber:0,gi:25,servingSize:"200 мл",tier:"basic",bestFor:["cutting","recomp"],timing:"after_train",description:"Турецкий кисломолочный напиток — гидратация + соль (250мг Na) после тренировки. Пробиотики меньше чем в кефире, но приятный освежающий вкус",micros:{Na:250,Ca:90,Probiotics:50,B12:0.15}},
  // ─── Жиры 2 ───
  {id:"fat_ghee",name:"Топлёное масло гхи",category:"fat",kcal:900,protein:0.3,fat:100,carbs:0,fiber:0,gi:0,servingSize:"15 мл (1 ст.л.)",tier:"mid",bestFor:["maintenance","mass"],timing:"any",description:"Чистый молочный жир без лактозы и казеина. Точка дымления 250°C — жарка без канцерогенов. Витамины A, E, K2 (MK-4)",micros:{VitA:100,VitE:0.8,VitK2:1,Butyrate:500}},
  // ─── Прочее 3 ───
  {id:"other_seaweed_agar",name:"Агар-агар (порошок)",category:"other",kcal:306,protein:0.7,fat:0,carbs:80,fiber:8,gi:0,servingSize:"10 г",tier:"basic",bestFor:["cutting","recomp"],timing:"any",description:"Растительный желатин (полисахариды агарозы) — гель при 35°C. Клетчатка (8г/10г — 27% ДН). Безкалорийный загуститель для десертов",micros:{Fiber:8,Fe:1.9,Ca:55,Mg:13,K:85}},
  {id:"other_petitgrain_oil",name:"Масло горького апельсина (эфирное)",category:"other",kcal:0,protein:0,fat:0,carbs:0,fiber:0,gi:0,servingSize:"2 капли",tier:"mid",bestFor:["cutting","recomp"],timing:"morning",description:"Ароматерапия — линалоол и линалилацетат (седативный, снижает кортизол). Для диффузора, НЕ внутрь. + к липазу",micros:{Linalool:30}},
];

// ─── Merge supplement (510 products) into FOOD_DB ───
(FOOD_DB as FoodItem[]).push(...FOOD_DB_SUPPLEMENT);

// ─── per100 invariant: auto-fill foodState if missing ───────────────────────
/** Возвращает подпись вида "100г готового/сухого/сырого/порошка" */
export function foodStateLabel(s?: FoodItem['foodState']): string {
  switch (s) {
    case 'cooked': return '100г готового';
    case 'dry': return '100г сухого';
    case 'raw': return '100г сырого';
    case 'powder': return '100г порошка';
    case 'liquid': return '100г (мл)';
    case 'as_is': return '100г как есть';
    default: return '100г';
  }
}
(function fillFoodState() {
  for (const f of FOOD_DB as FoodItem[]) {
    if (f.foodState) continue;
    const id = (f.id || '').toLowerCase();
    const cat = f.category;
    // powder supplements
    if (cat === 'supplement' && (f.protein > 50 || id.includes('whey') || id.includes('casein') || id.includes('creatine') || id.includes('protein') || id.includes('mass') || id.includes('collagen') || id.includes('pept'))) {
      f.foodState = 'powder'; continue;
    }
    if (cat === 'supplement' && f.kcal < 30) { f.foodState = 'powder'; continue; }
    if (cat === 'grain') {
      // dry grains high kcal density >300 vs cooked ~80-130
      if (f.kcal >= 300) f.foodState = 'dry';
      else f.foodState = 'cooked';
      continue;
    }
    if (cat === 'protein') { f.foodState = 'cooked'; continue; }
    if (id.includes('drink') || id.includes('isotonic') || id.includes('isoton') || id.includes('water') || id.includes('juice') || id.includes('kvas') || id.includes('kombucha')) { f.foodState = 'liquid'; continue; }
    if (cat === 'dairy' || cat === 'carb') {
      if (id.includes('milk') || id.includes('kefir') || id.includes('yogurt') || id.includes('ryazhen') || id.includes('ayran') || id.includes('cream') || id.includes('drink')) f.foodState = 'liquid';
      else f.foodState = 'as_is';
      continue;
    }
    if (cat === 'fat' || cat === 'veg_fruit' || cat === 'other' || cat === 'fast_food') { f.foodState = 'as_is'; continue; }
    f.foodState = 'as_is';
  }
})();

export const FOOD_ALLERGEN_DIET: Record<string, { allergens: string[]; isVegetarian: boolean; isVegan: boolean; isGlutenFree: boolean; isDairyFree: boolean; dietTags: string[] }> = {
  chicken_breast: { allergens: [], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  turkey_breast: { allergens: [], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  beef_lean: { allergens: [], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  salmon: { allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  tuna_canned: { allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  egg_whole: { allergens: ['eggs'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  egg_white: { allergens: ['eggs'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto'] },
  pork_tenderloin: { allergens: [], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  whey_protein: { allergens: [], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['keto'] },
  casein: { allergens: [], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['keto'] },
  chicken_thigh: { allergens: [], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  shrimp: { allergens: ['shellfish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  tuna_steak: { allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  sardines: { allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  mackerel: { allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  tofu: { allergens: ['soy'], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  tempeh: { allergens: ['soy'], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  seitan: { allergens: ['gluten'], isVegetarian: true, isVegan: true, isGlutenFree: false, isDairyFree: true, dietTags: [] },
  rice_white: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  rice_cream: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  rice_brown: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  oats: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  buckwheat: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  quinoa: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  bread_rye: { allergens: ['gluten'], isVegetarian: true, isVegan: true, isGlutenFree: false, isDairyFree: true, dietTags: [] },
  pasta_durum: { allergens: ['gluten'], isVegetarian: true, isVegan: true, isGlutenFree: false, isDairyFree: true, dietTags: ['mediterranean'] },
  potato_boiled: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  sweet_potato: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo', 'mediterranean'] },
  lentils: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  chickpeas: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  corn: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  rice_noodles: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  tortilla_wheat: { allergens: ['gluten'], isVegetarian: true, isVegan: true, isGlutenFree: false, isDairyFree: true, dietTags: [] },
  granola: { allergens: ['gluten', 'tree_nuts'], isVegetarian: true, isVegan: true, isGlutenFree: false, isDairyFree: true, dietTags: [] },
  dried_apricots: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  banana: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  apple: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo', 'mediterranean'] },
  berries: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  broccoli: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  spinach: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  cucumber: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  tomato: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  pepper: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  cabbage: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  carrot: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo', 'mediterranean'] },
  zucchini: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  eggplant: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'mediterranean'] },
  peas_green: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['mediterranean'] },
  grapefruit: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  pear: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  beetroot: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  celery: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  green_bean: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'mediterranean'] },
  asparagus: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  mushrooms: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  seaweed_nori: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  watermelon: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  pineapple: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  kiwi: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo'] },
  pomegranate: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['paleo', 'mediterranean'] },
  olive_oil: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  avocado: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  nuts_mix: { allergens: ['tree_nuts'], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  seeds: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  butter: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['keto'] },
  fish_oil_food: { allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  almonds: { allergens: ['tree_nuts'], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  walnuts: { allergens: ['tree_nuts'], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo', 'mediterranean'] },
  peanut_butter: { allergens: ['peanuts'], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto'] },
  sunflower_seeds: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  flaxseed: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'paleo'] },
  dark_chocolate: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto'] },
  cottage_cheese_5: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['keto', 'mediterranean'] },
  kefir: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['mediterranean'] },
  yogurt_greek: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['keto', 'mediterranean'] },
  milk: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['mediterranean'] },
  cheese_hard: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['keto', 'mediterranean'] },
  kefir_2: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['mediterranean'] },
  yogurt_natural: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['mediterranean'] },
  ryazhenka: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['mediterranean'] },
  sour_cream_15: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['mediterranean'] },
  shawarma: { allergens: ['gluten', 'dairy'], isVegetarian: false, isVegan: false, isGlutenFree: false, isDairyFree: false, dietTags: [] },
  pizza_margherita: { allergens: ['dairy', 'gluten'], isVegetarian: true, isVegan: false, isGlutenFree: false, isDairyFree: false, dietTags: ['mediterranean'] },
  burger: { allergens: ['gluten', 'dairy'], isVegetarian: false, isVegan: false, isGlutenFree: false, isDairyFree: false, dietTags: [] },
  creatine: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto'] },
  bcaa: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto'] },
  glutamine: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: ['keto'] },
  vitamin_complex: { allergens: [], isVegetarian: true, isVegan: true, isGlutenFree: true, isDairyFree: true, dietTags: [] },
  fish_oil: { allergens: ['fish'], isVegetarian: false, isVegan: false, isGlutenFree: true, isDairyFree: true, dietTags: ['keto', 'mediterranean'] },
  whey_isolate: { allergens: ['dairy'], isVegetarian: true, isVegan: false, isGlutenFree: true, isDairyFree: false, dietTags: ['keto'] },
  protein_bar: { allergens: ['dairy', 'gluten'], isVegetarian: true, isVegan: false, isGlutenFree: false, isDairyFree: false, dietTags: [] },
};

function applyDietTags(foods: FoodItem[]): FoodItem[] {
  return foods.map(f => {
    const tags = FOOD_ALLERGEN_DIET[f.id];
    if (tags) {
      return { ...f, allergens: tags.allergens, isVegetarian: tags.isVegetarian, isVegan: tags.isVegan, isGlutenFree: tags.isGlutenFree, isDairyFree: tags.isDairyFree, dietTags: tags.dietTags };
    }
    return f;
  });
}

const RATION_TIERS: Record<string, { basic: string[]; mid: string[]; max: string[] }> = {
  protein: {
    basic: ['chicken_breast', 'egg_whole', 'egg_white', 'whey_protein', 'white_fish_cod', 'white_fish_mintai'],
    mid: ['turkey_breast', 'tuna_canned', 'pork_tenderloin', 'casein', 'beef_minced', 'white_fish_halibut'],
    max: ['beef_lean', 'salmon', 'red_fish'],
  },
  carb: {
    basic: ['rice_white', 'oats', 'potato_boiled', 'banana', 'cream_of_rice'],
    mid: ['rice_brown', 'buckwheat', 'pasta_durum', 'sweet_potato', 'rice_noodles', 'whole_grain_bread'],
    max: ['quinoa', 'berries'],
  },
  fat: {
    basic: ['olive_oil', 'butter'],
    mid: ['avocado', 'nuts_mix', 'yogurt_greek', 'coconut_oil', 'coconut_urbec'],
    max: ['seeds', 'fish_oil_food', 'red_caviar'],
  },
  dairy: {
    basic: ['cottage_cheese_5', 'kefir', 'milk'],
    mid: ['cheese_hard', 'yogurt_greek'],
    max: [],
  },
  veg_fruit: {
    basic: ['broccoli', 'cucumber', 'tomato', 'carrot', 'onion', 'tomato_paste'],
    mid: ['spinach', 'pepper', 'berries', 'beetroot', 'sauerkraut', 'green_apple', 'citrus', 'tomato_juice'],
    max: [],
  },
  supplement: {
    basic: ['creatine', 'fish_oil', 'vitamin_complex', 'supp_whey_hydro', 'supp_eaas', 'supp_collagen'],
    mid: ['bcaa', 'glutamine', 'casein', 'marmalade', 'corn_flakes', 'dates', 'supp_hmb', 'supp_cla', 'supp_zma', 'supp_beta_alanine'],
    max: ['amylopectin', 'dextrose', 'supp_mass_gainer', 'supp_citrulline', 'supp_cordyceps'],
  },
};

// ─── Extend RATION_TIERS with supplement products ───
(function extendRationTiers() {
  const extendedProtein = RATION_TIERS.protein;
  extendedProtein.basic.push(
    'poultry_duck_breast','poultry_turkey_drumstick','poultry_turkey_ground_lean',
    'fish_salmon_wild','fish_trout_rainbow','fish_tuna_steak',
    'meat_beef_ground_93','meat_beef_skirt','meat_beef_flank',
    'meat_game_venison','meat_game_rabbit',
    'seafood_shrimp_tiger','seafood_tuna_canned_water'
  );
  extendedProtein.mid.push(
    'poultry_duck_leg','poultry_turkey_wing','poultry_pheasant',
    'fish_halibut','fish_sea_bass','fish_cod_liver',
    'meat_lamb_leg_roast','meat_lamb_chop',
    'meat_beef_sirloin','meat_beef_ribeye_fresh',
    'meat_pork_tenderloin_raw','seafood_crab','seafood_scallops'
  );
  extendedProtein.max.push(
    'fish_salmon_atlantic','fish_eel','fish_red_snapper',
    'meat_beef_tenderloin_fresh','meat_beef_wagyu',
    'seafood_lobster','seafood_oysters',
    'egg_quail','egg_omega3'
  );
  RATION_TIERS.carb.basic.push('grain_barley','grain_couscous','grain_bulgur','grain_millet','grain_semolina','grain_wheat_germ');
  RATION_TIERS.carb.mid.push('grain_amaranth','grain_spelt','grain_wild_rice','grain_black_rice','grain_red_rice','grain_teff','bread_rye_crispbread','pasta_soba');
  RATION_TIERS.carb.max.push('grain_quinoa_red','grain_kamut','grain_einkorn','grain_teff_whole');
  RATION_TIERS.fat.basic.push('oil_grapeseed_cold','oil_coconut_extra','oil_flaxseed_cold');
  RATION_TIERS.fat.mid.push('oil_avocado_cold','oil_walnut_pressed','oil_sesame_toasted','oil_hemp_organic','nut_macadamia','nut_pecan','nut_brazil','seed_hemp','seed_poppy','seed_pumpkin');
  RATION_TIERS.fat.max.push('nut_pine','seed_chia','oil_macadamia','oil_perilla');
  RATION_TIERS.dairy.basic.push('dairy_mozzarella','dairy_ricotta','dairy_quark','dairy_skyr','dairy_kefir_0');
  RATION_TIERS.dairy.mid.push('cheese_parmesan','cheese_gouda','cheese_feta','cheese_halloumi','cheese_goat_soft','dairy_ayran','dairy_buttermilk','dairy_cream_10');
  RATION_TIERS.dairy.max.push('cheese_brie','cheese_camembert','cheese_blue','cheese_manchego','cheese_pecorino');
  RATION_TIERS.veg_fruit.basic.push(
    'veg_cauliflower','veg_kale','veg_zucchini_green','veg_arugula','veg_romaine','veg_celery_stalks',
    'fruit_apple_green','fruit_blueberry','fruit_strawberry','fruit_grapefruit',
    'mush_shiitake','mush_cremini','mush_portobello'
  );
  RATION_TIERS.veg_fruit.mid.push(
    'veg_brussels_sprouts','veg_asparagus_green','veg_bell_pepper_red','veg_cabbage_red','veg_daikon',
    'fruit_raspberry','fruit_blackberry','fruit_cherry','fruit_pomegranate_fresh',
    'mush_porcini','mush_maitake','mush_enoki',
    'herb_fresh_basil','herb_fresh_cilantro','herb_fresh_parsley'
  );
  RATION_TIERS.veg_fruit.max.push(
    'veg_artichoke_globe','veg_bok_choy','veg_collard_greens','veg_fennel',
    'fruit_goji_berry','fruit_acai','fruit_papaya',
    'mush_truffle','mush_chanterelle','mush_morel',
    'herb_fresh_mint','herb_fresh_rosemary','herb_fresh_thyme'
  );
  // ─── Extend supplement tier with new products ───
  RATION_TIERS.supplement.basic.push(
    'supp_whey_hydro','supp_eaas','supp_collagen','supp_peptopro',
    'supp_beef_isolate','supp_egg_protein','supp_soy_isolate','supp_pea_protein',
    'supp_probiotics'
  );
  RATION_TIERS.supplement.mid.push(
    'supp_beta_alanine','supp_citrulline','supp_carnitine','supp_taurine',
    'supp_zma','supp_melatonin','supp_5htp','supp_gaba',
    'supp_hmb','supp_cla',
    'supp_arginine','supp_ornithine','supp_ashwagandha','supp_rhodiola',
    'supp_cordyceps','supp_reishi',
    'supp_tyrosine','supp_betaine','supp_digestive_enzymes'
  );
  RATION_TIERS.supplement.max.push(
    'supp_mass_gainer','supp_pre_workout','supp_creatine_hcl',
    'supp_creatine_ethyl','supp_mct_oil','supp_carnosine',
    'supp_colostrum'
  );
})();

export interface FoodFilter {
  dietType?: 'omnivore' | 'vegetarian' | 'vegan' | 'pescatarian' | 'keto' | 'paleo' | 'mediterranean';
  excludeAllergens?: string[];
  excludedIds?: string[];
}

function matchesFilter(food: FoodItem, filter?: FoodFilter): boolean {
  if (!filter) return true;
  const tags = FOOD_ALLERGEN_DIET[food.id];
  if (filter.dietType === 'vegan' && tags && !tags.isVegan) return false;
  if (filter.dietType === 'vegetarian' && tags && !tags.isVegetarian) return false;
  if (filter.dietType === 'pescatarian' && tags && !tags.isVegetarian && !tags.allergens.includes('fish')) return false;
  if (filter.dietType === 'keto' && tags && !tags.dietTags.includes('keto') && food.carbs > 15) return false;
  if (filter.dietType === 'paleo' && tags && !tags.dietTags.includes('paleo') && food.category === 'dairy') return false;
  if (filter.dietType === 'mediterranean' && tags && !tags.dietTags.includes('mediterranean') && food.category === 'fast_food') return false;
  if (filter.excludeAllergens?.length && tags) {
    for (const a of filter.excludeAllergens) {
      if (tags.allergens.includes(a)) return false;
    }
  }
  if (filter.excludedIds?.includes(food.id)) return false;
  return true;
}

export function searchFood(query: string, filter?: FoodFilter): FoodItem[] {
  const q = query.toLowerCase().trim();
  if (!q) return [];
  return applyDietTags(FOOD_DB.filter(f =>
    (f.name.toLowerCase().includes(q) || f.category.includes(q)) && matchesFilter(f, filter)
  )).slice(0, 12);
}

export function getFoodById(id: string): FoodItem | undefined {
  const f = FOOD_DB.find(f => f.id === id);
  if (!f) return undefined;
  const tags = FOOD_ALLERGEN_DIET[id];
  if (tags) return { ...f, allergens: tags.allergens, isVegetarian: tags.isVegetarian, isVegan: tags.isVegan, isGlutenFree: tags.isGlutenFree, isDairyFree: tags.isDairyFree, dietTags: tags.dietTags };
  return f;
}

export function getFoodByCategory(cat: FoodItem['category'], filter?: FoodFilter): FoodItem[] {
  return applyDietTags(FOOD_DB.filter(f => f.category === cat && matchesFilter(f, filter)));
}

export function getFoodsByTier(cat: string, tier: 'basic' | 'mid' | 'max', filter?: FoodFilter): FoodItem[] {
  const ids = RATION_TIERS[cat]?.[tier] || [];
  return applyDietTags(ids.map(id => FOOD_DB.find(f => f.id === id.trim())).filter((f): f is FoodItem => !!f && matchesFilter(f, filter)));
}

export function getTopByProtein(limit: number, filter?: FoodFilter): FoodItem[] {
  return applyDietTags([...FOOD_DB]
    .filter(f => f.protein > 5 && f.category !== 'supplement' && matchesFilter(f, filter))
    .sort((a, b) => (b.protein / Math.max(b.kcal, 1)) - (a.protein / Math.max(a.kcal, 1)))
    .slice(0, limit));
}

export function getTopByCarbs(limit: number, filter?: FoodFilter): FoodItem[] {
  return applyDietTags([...FOOD_DB]
    .filter(f => f.carbs > 5 && f.gi <= 70 && f.category !== 'supplement' && matchesFilter(f, filter))
    .sort((a, b) => b.carbs - a.carbs)
    .slice(0, limit));
}

export function getTopByFat(limit: number, filter?: FoodFilter): FoodItem[] {
  return applyDietTags([...FOOD_DB]
    .filter(f => f.fat > 5 && f.category !== 'supplement' && matchesFilter(f, filter))
    .sort((a, b) => (b.fat / Math.max(b.kcal, 1)) - (a.fat / Math.max(a.kcal, 1)))
    .slice(0, limit));
}

export function getTopSupplements(limit: number, purpose?: 'protein' | 'pre_workout' | 'recovery' | 'general', filter?: FoodFilter): FoodItem[] {
  let filtered = [...FOOD_DB].filter(f => f.category === 'supplement' && matchesFilter(f, filter));
  if (purpose === 'protein') {
    filtered = filtered.filter(f => f.protein > 50);
  } else if (purpose === 'pre_workout') {
    filtered = filtered.filter(f => (f.micros?.Caffeine ?? 0) > 0 || f.id.includes('creatine') || f.id.includes('citrulline') || f.id.includes('beta_alanine'));
  } else if (purpose === 'recovery') {
    filtered = filtered.filter(f => f.id.includes('casein') || f.id.includes('collagen') || f.id.includes('zma') || f.id.includes('glutamine') || f.id.includes('bcaa'));
  }
  filtered.sort((a, b) => (b.bb_quality_score ?? 5) - (a.bb_quality_score ?? 5));
  return applyDietTags(filtered.slice(0, limit));
}

export { RATION_TIERS };

// ─── v2: enrich ALL products with calculated AdvancedProductCard fields ───
(function enrichAllProductsV2() {
  for (let i = 0; i < FOOD_DB.length; i++) {
    enrichFoodItemV2(FOOD_DB[i]);
  }
  // ─── Override top validation products with real data ───
  const overrides: Record<string, Partial<FoodItem>> = {
    // 1. Белый рис Басмати
    rice_white: {
      macro_100g: { proteins_animal:0,proteins_plant:2.7, fats_saturated:0.1,fats_monounsaturated:0.1,fats_polyunsaturated:0.1, omega_3_mg:10,omega_6_mg:50, mct_oil_g:0,cholesterol_mg:0, carbs_sugar:0.1,insulin_index:79 },
      amino_acid_profile_100g: { leucine_mg:230,isoleucine_mg:120,valine_mg:170,lysine_mg:100,methionine_mg:60,arginine_mg:220,glutamine_mg:500,tryptophan_mg:35,phenylalanine_mg:140,threonine_mg:100,histidine_mg:65,cysteine_mg:55 },
      electrolytes_100g: { sodium_mg:1,potassium_mg:35,magnesium_mg:12,calcium_mg:3,phosphorus_mg:33,pral_index:2 },
      vitamins_100g: { vitamin_a_mcg:0,vitamin_c_mg:0,vitamin_d_mcg:0,vitamin_e_mg:0.04,vitamin_k_mcg:0,vitamin_b1_mg:0.02,vitamin_b2_mg:0.01,vitamin_b3_mg:0.4,vitamin_b5_mg:0.3,vitamin_b6_mg:0.05,vitamin_b7_mcg:1,vitamin_b9_mcg:3,vitamin_b12_mcg:0 },
      trace_elements_100g: { iron_total_mg:0.2,iron_heme_mg:0,zinc_mg:0.5,selenium_mcg:5,copper_mg:0.07,manganese_mg:0.4,iodine_mcg:1,chromium_mcg:0 },
      bioactive_compounds_100g: { creatine_mg:0,beta_alanine_mg:0,taurine_mg:0,lignan_mg:0,indol_3_carbinol_mg:0 },
      gastro_tags: { fodmap_group:'LOW',enzyme_demand_score:2,gastric_emptying_speed:'FAST',allergen_flags:[],gut_irritant_potential:'LOW' },
      metabolic_flags: { atherogenic_potential:'LOW',glycation_potential:'LOW',ammonia_source_level:'LOW',heavy_metal_risk:'LOW',cns_impact:'NEUTRAL',goitrogenic_potential:'LOW',hepatoprotective:false,anabolic_potential:'LOW',detox_support_level:'LOW',histamine_level:'LOW',insulin_sensitivity_impact:'NEGATIVE',thyroid_support_level:'LOW' },
      specific_compounds_100g: { polyphenols_mg:5,flavonoids_mg:0,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:10,oxalates_mg:2,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0,berberine_mg:0 },
      bb_quality_score: 7.0,
    },
    // 2. Филе индейки
    turkey_breast: {
      macro_100g: { proteins_animal:29,proteins_plant:0, fats_saturated:0.3,fats_monounsaturated:0.2,fats_polyunsaturated:0.2, omega_3_mg:40,omega_6_mg:200, mct_oil_g:0,cholesterol_mg:55, carbs_sugar:0,insulin_index:35 },
      amino_acid_profile_100g: { leucine_mg:2250,isoleucine_mg:1350,valine_mg:1400,lysine_mg:2500,methionine_mg:750,arginine_mg:1800,glutamine_mg:3200,tryptophan_mg:350,phenylalanine_mg:1150,threonine_mg:1200,histidine_mg:900,cysteine_mg:300 },
      electrolytes_100g: { sodium_mg:47,potassium_mg:250,magnesium_mg:27,calcium_mg:14,phosphorus_mg:220,pral_index:9 },
      vitamins_100g: { vitamin_a_mcg:3,vitamin_c_mg:0,vitamin_d_mcg:5,vitamin_e_mg:0.3,vitamin_k_mcg:0,vitamin_b1_mg:0.04,vitamin_b2_mg:0.12,vitamin_b3_mg:11.8,vitamin_b5_mg:0.9,vitamin_b6_mg:0.5,vitamin_b7_mcg:2,vitamin_b9_mcg:7,vitamin_b12_mcg:0.4 },
      trace_elements_100g: { iron_total_mg:0.5,iron_heme_mg:0.3,zinc_mg:1.1,selenium_mcg:25,copper_mg:0.05,manganese_mg:0.01,iodine_mcg:2,chromium_mcg:3 },
      bioactive_compounds_100g: { creatine_mg:350,beta_alanine_mg:0,taurine_mg:15,lignan_mg:0,indol_3_carbinol_mg:0 },
      gastro_tags: { fodmap_group:'LOW',enzyme_demand_score:3,gastric_emptying_speed:'MEDIUM',allergen_flags:[],gut_irritant_potential:'LOW' },
      metabolic_flags: { atherogenic_potential:'LOW',glycation_potential:'LOW',ammonia_source_level:'MEDIUM',heavy_metal_risk:'LOW',cns_impact:'SEDATIVE',goitrogenic_potential:'LOW',hepatoprotective:false,anabolic_potential:'HIGH',detox_support_level:'LOW',histamine_level:'LOW',insulin_sensitivity_impact:'POSITIVE',thyroid_support_level:'LOW' },
      specific_compounds_100g: { polyphenols_mg:0,flavonoids_mg:0,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:0,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:2,berberine_mg:0 },
      bb_quality_score: 9.5,
    },
    // 3. Шпинат
    spinach: {
      macro_100g: { proteins_animal:0,proteins_plant:2.9, fats_saturated:0.1,fats_monounsaturated:0,fats_polyunsaturated:0.2, omega_3_mg:140,omega_6_mg:30, mct_oil_g:0,cholesterol_mg:0, carbs_sugar:0.4,insulin_index:15 },
      amino_acid_profile_100g: { leucine_mg:220,isoleucine_mg:150,valine_mg:160,lysine_mg:220,methionine_mg:50,arginine_mg:320,glutamine_mg:450,tryptophan_mg:40,phenylalanine_mg:130,threonine_mg:120,histidine_mg:65,cysteine_mg:35 },
      electrolytes_100g: { sodium_mg:79,potassium_mg:558,magnesium_mg:79,calcium_mg:99,phosphorus_mg:49,pral_index:-14 },
      vitamins_100g: { vitamin_a_mcg:469,vitamin_c_mg:28,vitamin_d_mcg:0,vitamin_e_mg:2,vitamin_k_mcg:483,vitamin_b1_mg:0.08,vitamin_b2_mg:0.19,vitamin_b3_mg:0.7,vitamin_b5_mg:0.3,vitamin_b6_mg:0.2,vitamin_b7_mcg:2,vitamin_b9_mcg:194,vitamin_b12_mcg:0 },
      trace_elements_100g: { iron_total_mg:2.7,iron_heme_mg:0,zinc_mg:0.5,selenium_mcg:1,copper_mg:0.13,manganese_mg:0.9,iodine_mcg:2,chromium_mcg:5 },
      bioactive_compounds_100g: { creatine_mg:0,beta_alanine_mg:0,taurine_mg:0,lignan_mg:0,indol_3_carbinol_mg:0 },
      gastro_tags: { fodmap_group:'LOW',enzyme_demand_score:2,gastric_emptying_speed:'FAST',allergen_flags:[],gut_irritant_potential:'LOW' },
      metabolic_flags: { atherogenic_potential:'LOW',glycation_potential:'LOW',ammonia_source_level:'LOW',heavy_metal_risk:'LOW',cns_impact:'NEUTRAL',goitrogenic_potential:'LOW',hepatoprotective:false,anabolic_potential:'LOW',detox_support_level:'HIGH',histamine_level:'LOW',insulin_sensitivity_impact:'POSITIVE',thyroid_support_level:'LOW' },
      specific_compounds_100g: { polyphenols_mg:150,flavonoids_mg:50,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:750,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:1,berberine_mg:0 },
      bb_quality_score: 8.0,
    },
    // 4. Яйцо цельное
    egg_whole: {
      macro_100g: { proteins_animal:13,proteins_plant:0, fats_saturated:3.3,fats_monounsaturated:4.1,fats_polyunsaturated:1.4, omega_3_mg:150,omega_6_mg:1140, mct_oil_g:0,cholesterol_mg:372, carbs_sugar:0.7,insulin_index:31 },
      amino_acid_profile_100g: { leucine_mg:1080,isoleucine_mg:670,valine_mg:760,lysine_mg:910,methionine_mg:380,arginine_mg:810,glutamine_mg:1680,tryptophan_mg:170,phenylalanine_mg:680,threonine_mg:600,histidine_mg:310,cysteine_mg:280 },
      electrolytes_100g: { sodium_mg:142,potassium_mg:126,magnesium_mg:10,calcium_mg:56,phosphorus_mg:198,pral_index:7 },
      vitamins_100g: { vitamin_a_mcg:160,vitamin_c_mg:0,vitamin_d_mcg:87,vitamin_e_mg:1.1,vitamin_k_mcg:0.3,vitamin_b1_mg:0.04,vitamin_b2_mg:0.46,vitamin_b3_mg:0.1,vitamin_b5_mg:1.4,vitamin_b6_mg:0.17,vitamin_b7_mcg:21,vitamin_b9_mcg:47,vitamin_b12_mcg:0.9 },
      trace_elements_100g: { iron_total_mg:1.8,iron_heme_mg:0.8,zinc_mg:1.3,selenium_mcg:31,copper_mg:0.07,manganese_mg:0.03,iodine_mcg:24,chromium_mcg:2 },
      bioactive_compounds_100g: { creatine_mg:0,beta_alanine_mg:0,taurine_mg:0,lignan_mg:0,indol_3_carbinol_mg:0 },
      gastro_tags: { fodmap_group:'LOW',enzyme_demand_score:3,gastric_emptying_speed:'MEDIUM',allergen_flags:['eggs'],gut_irritant_potential:'LOW' },
      metabolic_flags: { atherogenic_potential:'LOW',glycation_potential:'LOW',ammonia_source_level:'MEDIUM',heavy_metal_risk:'LOW',cns_impact:'NEUTRAL',goitrogenic_potential:'LOW',hepatoprotective:true,anabolic_potential:'HIGH',detox_support_level:'MEDIUM',histamine_level:'LOW',insulin_sensitivity_impact:'POSITIVE',thyroid_support_level:'MEDIUM' },
      specific_compounds_100g: { polyphenols_mg:0,flavonoids_mg:0,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:0,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0.5,berberine_mg:0 },
      bb_quality_score: 8.0,
    },
    // 5. Яичный белок
    egg_white: {
      macro_100g: { proteins_animal:11,proteins_plant:0, fats_saturated:0,fats_monounsaturated:0,fats_polyunsaturated:0, omega_3_mg:0,omega_6_mg:0, mct_oil_g:0,cholesterol_mg:0, carbs_sugar:0.7,insulin_index:25 },
      amino_acid_profile_100g: { leucine_mg:900,isoleucine_mg:560,valine_mg:640,lysine_mg:760,methionine_mg:320,arginine_mg:650,glutamine_mg:1400,tryptophan_mg:140,phenylalanine_mg:570,threonine_mg:500,histidine_mg:260,cysteine_mg:235 },
      electrolytes_100g: { sodium_mg:166,potassium_mg:163,magnesium_mg:11,calcium_mg:7,phosphorus_mg:15,pral_index:2 },
      vitamins_100g: { vitamin_a_mcg:0,vitamin_c_mg:0,vitamin_d_mcg:0,vitamin_e_mg:0,vitamin_k_mcg:0,vitamin_b1_mg:0,vitamin_b2_mg:0.44,vitamin_b3_mg:0.1,vitamin_b5_mg:0.3,vitamin_b6_mg:0,vitamin_b7_mcg:7,vitamin_b9_mcg:4,vitamin_b12_mcg:0.1 },
      trace_elements_100g: { iron_total_mg:0.1,iron_heme_mg:0,zinc_mg:0.03,selenium_mcg:20,copper_mg:0.02,manganese_mg:0.01,iodine_mcg:1,chromium_mcg:1 },
      bioactive_compounds_100g: { creatine_mg:0,beta_alanine_mg:0,taurine_mg:0,lignan_mg:0,indol_3_carbinol_mg:0 },
      gastro_tags: { fodmap_group:'LOW',enzyme_demand_score:1,gastric_emptying_speed:'FAST',allergen_flags:['eggs'],gut_irritant_potential:'LOW' },
      metabolic_flags: { atherogenic_potential:'LOW',glycation_potential:'LOW',ammonia_source_level:'MEDIUM',heavy_metal_risk:'LOW',cns_impact:'NEUTRAL',goitrogenic_potential:'LOW',hepatoprotective:false,anabolic_potential:'HIGH',detox_support_level:'MEDIUM',histamine_level:'LOW',insulin_sensitivity_impact:'POSITIVE',thyroid_support_level:'LOW' },
      specific_compounds_100g: { polyphenols_mg:0,flavonoids_mg:0,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:0,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0,berberine_mg:0 },
      bb_quality_score: 9.0,
    },
    // 6. Творог 0.5%
    cottage_cheese_5: {
      macro_100g: { proteins_animal:17,proteins_plant:0, fats_saturated:0.3,fats_monounsaturated:0.1,fats_polyunsaturated:0.01, omega_3_mg:5,omega_6_mg:10, mct_oil_g:0,cholesterol_mg:3, carbs_sugar:2.5,insulin_index:90 },
      amino_acid_profile_100g: { leucine_mg:1600,isoleucine_mg:950,valine_mg:1000,lysine_mg:1450,methionine_mg:450,arginine_mg:600,glutamine_mg:2200,tryptophan_mg:200,phenylalanine_mg:900,threonine_mg:800,histidine_mg:500,cysteine_mg:100 },
      electrolytes_100g: { sodium_mg:40,potassium_mg:120,magnesium_mg:12,calcium_mg:100,phosphorus_mg:190,pral_index:6 },
      vitamins_100g: { vitamin_a_mcg:5,vitamin_c_mg:0.3,vitamin_d_mcg:0,vitamin_e_mg:0,vitamin_k_mcg:0,vitamin_b1_mg:0.03,vitamin_b2_mg:0.26,vitamin_b3_mg:0.4,vitamin_b5_mg:0.6,vitamin_b6_mg:0.07,vitamin_b7_mcg:5,vitamin_b9_mcg:12,vitamin_b12_mcg:0.6 },
      trace_elements_100g: { iron_total_mg:0.1,iron_heme_mg:0,zinc_mg:0.4,selenium_mcg:10,copper_mg:0.04,manganese_mg:0.01,iodine_mcg:5,chromium_mcg:2 },
      bioactive_compounds_100g: { creatine_mg:0,beta_alanine_mg:0,taurine_mg:20,lignan_mg:0,indol_3_carbinol_mg:0 },
      gastro_tags: { fodmap_group:'HIGH',enzyme_demand_score:3,gastric_emptying_speed:'MEDIUM',allergen_flags:['dairy'],gut_irritant_potential:'HIGH' },
      metabolic_flags: { atherogenic_potential:'LOW',glycation_potential:'LOW',ammonia_source_level:'MEDIUM',heavy_metal_risk:'LOW',cns_impact:'NEUTRAL',goitrogenic_potential:'LOW',hepatoprotective:false,anabolic_potential:'MEDIUM',detox_support_level:'LOW',histamine_level:'LOW',insulin_sensitivity_impact:'NEGATIVE',thyroid_support_level:'LOW' },
      specific_compounds_100g: { polyphenols_mg:0,flavonoids_mg:0,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:0,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:1,berberine_mg:0 },
      bb_quality_score: 7.5,
    },
    // 7. Авокадо
    avocado: {
      macro_100g: { proteins_animal:0,proteins_plant:2, fats_saturated:2.1,fats_monounsaturated:9.8,fats_polyunsaturated:1.8, omega_3_mg:110,omega_6_mg:1690, mct_oil_g:0,cholesterol_mg:0, carbs_sugar:0.7,insulin_index:15 },
      amino_acid_profile_100g: { leucine_mg:140,isoleucine_mg:85,valine_mg:110,lysine_mg:130,methionine_mg:38,arginine_mg:90,glutamine_mg:280,tryptophan_mg:25,phenylalanine_mg:100,threonine_mg:75,histidine_mg:50,cysteine_mg:30 },
      electrolytes_100g: { sodium_mg:7,potassium_mg:485,magnesium_mg:29,calcium_mg:12,phosphorus_mg:52,pral_index:-6 },
      vitamins_100g: { vitamin_a_mcg:7,vitamin_c_mg:10,vitamin_d_mcg:0,vitamin_e_mg:2.1,vitamin_k_mcg:21,vitamin_b1_mg:0.07,vitamin_b2_mg:0.13,vitamin_b3_mg:1.7,vitamin_b5_mg:1.4,vitamin_b6_mg:0.26,vitamin_b7_mcg:3,vitamin_b9_mcg:81,vitamin_b12_mcg:0 },
      trace_elements_100g: { iron_total_mg:0.6,iron_heme_mg:0,zinc_mg:0.6,selenium_mcg:0.4,copper_mg:0.19,manganese_mg:0.14,iodine_mcg:1,chromium_mcg:3 },
      bioactive_compounds_100g: { creatine_mg:0,beta_alanine_mg:0,taurine_mg:0,lignan_mg:0,indol_3_carbinol_mg:0 },
      gastro_tags: { fodmap_group:'LOW',enzyme_demand_score:2,gastric_emptying_speed:'MEDIUM',allergen_flags:[],gut_irritant_potential:'LOW' },
      metabolic_flags: { atherogenic_potential:'LOW',glycation_potential:'LOW',ammonia_source_level:'LOW',heavy_metal_risk:'LOW',cns_impact:'NEUTRAL',goitrogenic_potential:'LOW',hepatoprotective:true,anabolic_potential:'LOW',detox_support_level:'MEDIUM',histamine_level:'LOW',insulin_sensitivity_impact:'POSITIVE',thyroid_support_level:'LOW' },
      specific_compounds_100g: { polyphenols_mg:100,flavonoids_mg:30,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:20,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0.5,berberine_mg:0 },
      bb_quality_score: 8.5,
    },
    // 8. Овсянка (очистить bb_quality_score пересчёт)
    oats: {
      macro_100g: { proteins_animal:0,proteins_plant:13, fats_saturated:1.2,fats_monounsaturated:2.2,fats_polyunsaturated:2.5, omega_3_mg:100,omega_6_mg:2400, mct_oil_g:0,cholesterol_mg:0, carbs_sugar:1,insulin_index:55 },
      amino_acid_profile_100g: { leucine_mg:980,isoleucine_mg:560,valine_mg:700,lysine_mg:550,methionine_mg:210,arginine_mg:850,glutamine_mg:1800,tryptophan_mg:190,phenylalanine_mg:650,threonine_mg:480,histidine_mg:280,cysteine_mg:340 },
      electrolytes_100g: { sodium_mg:2,potassium_mg:360,magnesium_mg:130,calcium_mg:54,phosphorus_mg:410,pral_index:-3 },
      vitamins_100g: { vitamin_a_mcg:0,vitamin_c_mg:0,vitamin_d_mcg:0,vitamin_e_mg:0.7,vitamin_k_mcg:2,vitamin_b1_mg:0.46,vitamin_b2_mg:0.15,vitamin_b3_mg:1.1,vitamin_b5_mg:1.1,vitamin_b6_mg:0.1,vitamin_b7_mcg:20,vitamin_b9_mcg:32,vitamin_b12_mcg:0 },
      trace_elements_100g: { iron_total_mg:4.7,iron_heme_mg:0,zinc_mg:3.6,selenium_mcg:25,copper_mg:0.4,manganese_mg:3.6,iodine_mcg:3,chromium_mcg:7 },
      bioactive_compounds_100g: { creatine_mg:0,beta_alanine_mg:0,taurine_mg:0,lignan_mg:30,indol_3_carbinol_mg:0 },
      gastro_tags: { fodmap_group:'LOW',enzyme_demand_score:3,gastric_emptying_speed:'SLOW',allergen_flags:[],gut_irritant_potential:'LOW' },
      metabolic_flags: { atherogenic_potential:'LOW',glycation_potential:'LOW',ammonia_source_level:'LOW',heavy_metal_risk:'LOW',cns_impact:'NEUTRAL',goitrogenic_potential:'LOW',hepatoprotective:false,anabolic_potential:'MEDIUM',detox_support_level:'LOW',histamine_level:'LOW',insulin_sensitivity_impact:'POSITIVE',thyroid_support_level:'LOW' },
      specific_compounds_100g: { polyphenols_mg:50,flavonoids_mg:20,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:15,oxalates_mg:10,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0,berberine_mg:0 },
      bb_quality_score: 7.0,
    },
    // 9. Говядина постная (уже с правильным bb)
    beef_lean: {
      macro_100g: { proteins_animal:26,proteins_plant:0, fats_saturated:4,fats_monounsaturated:4,fats_polyunsaturated:0.5, omega_3_mg:15,omega_6_mg:300, mct_oil_g:0,cholesterol_mg:70, carbs_sugar:0,insulin_index:30 },
      amino_acid_profile_100g: { leucine_mg:2200,isoleucine_mg:1300,valine_mg:1350,lysine_mg:2400,methionine_mg:700,arginine_mg:1700,glutamine_mg:3000,tryptophan_mg:300,phenylalanine_mg:1100,threonine_mg:1150,histidine_mg:850,cysteine_mg:300 },
      electrolytes_100g: { sodium_mg:58,potassium_mg:315,magnesium_mg:22,calcium_mg:12,phosphorus_mg:210,pral_index:8 },
      vitamins_100g: { vitamin_a_mcg:2,vitamin_c_mg:0,vitamin_d_mcg:10,vitamin_e_mg:0.5,vitamin_k_mcg:2,vitamin_b1_mg:0.06,vitamin_b2_mg:0.18,vitamin_b3_mg:5.4,vitamin_b5_mg:0.7,vitamin_b6_mg:0.4,vitamin_b7_mcg:3,vitamin_b9_mcg:7,vitamin_b12_mcg:2.5 },
      trace_elements_100g: { iron_total_mg:2.6,iron_heme_mg:1.6,zinc_mg:5.5,selenium_mcg:16,copper_mg:0.1,manganese_mg:0.01,iodine_mcg:3,chromium_mcg:4 },
      bioactive_compounds_100g: { creatine_mg:400,beta_alanine_mg:0,taurine_mg:45,lignan_mg:0,indol_3_carbinol_mg:0 },
      gastro_tags: { fodmap_group:'LOW',enzyme_demand_score:6,gastric_emptying_speed:'SLOW',allergen_flags:[],gut_irritant_potential:'LOW' },
      metabolic_flags: { atherogenic_potential:'LOW',glycation_potential:'LOW',ammonia_source_level:'HIGH',heavy_metal_risk:'LOW',cns_impact:'NEUTRAL',goitrogenic_potential:'LOW',hepatoprotective:false,anabolic_potential:'HIGH',detox_support_level:'LOW',histamine_level:'LOW',insulin_sensitivity_impact:'POSITIVE',thyroid_support_level:'MEDIUM' },
      specific_compounds_100g: { polyphenols_mg:0,flavonoids_mg:0,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:0,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:3,berberine_mg:0 },
      bb_quality_score: 9.0,
    },
    // 10. Лосось
    salmon: {
      macro_100g: { proteins_animal:20,proteins_plant:0, fats_saturated:2.5,fats_monounsaturated:5,fats_polyunsaturated:3.5, omega_3_mg:2000,omega_6_mg:500, mct_oil_g:0,cholesterol_mg:55, carbs_sugar:0,insulin_index:25 },
      amino_acid_profile_100g: { leucine_mg:1700,isoleucine_mg:1000,valine_mg:1050,lysine_mg:1900,methionine_mg:600,arginine_mg:1200,glutamine_mg:2400,tryptophan_mg:220,phenylalanine_mg:850,threonine_mg:900,histidine_mg:650,cysteine_mg:200 },
      electrolytes_100g: { sodium_mg:56,potassium_mg:350,magnesium_mg:30,calcium_mg:12,phosphorus_mg:240,pral_index:6 },
      vitamins_100g: { vitamin_a_mcg:12,vitamin_c_mg:0,vitamin_d_mcg:500,vitamin_e_mg:1.8,vitamin_k_mcg:0.5,vitamin_b1_mg:0.18,vitamin_b2_mg:0.12,vitamin_b3_mg:8.5,vitamin_b5_mg:1.6,vitamin_b6_mg:0.6,vitamin_b7_mcg:5,vitamin_b9_mcg:12,vitamin_b12_mcg:3.2 },
      trace_elements_100g: { iron_total_mg:0.3,iron_heme_mg:0.2,zinc_mg:0.6,selenium_mcg:31,copper_mg:0.05,manganese_mg:0.01,iodine_mcg:25,chromium_mcg:3 },
      bioactive_compounds_100g: { creatine_mg:350,beta_alanine_mg:0,taurine_mg:30,lignan_mg:0,indol_3_carbinol_mg:0 },
      gastro_tags: { fodmap_group:'LOW',enzyme_demand_score:4,gastric_emptying_speed:'MEDIUM',allergen_flags:['fish'],gut_irritant_potential:'LOW' },
      metabolic_flags: { atherogenic_potential:'LOW',glycation_potential:'LOW',ammonia_source_level:'MEDIUM',heavy_metal_risk:'LOW',cns_impact:'NEUTRAL',goitrogenic_potential:'LOW',hepatoprotective:false,anabolic_potential:'HIGH',detox_support_level:'LOW',histamine_level:'MEDIUM',insulin_sensitivity_impact:'POSITIVE',thyroid_support_level:'MEDIUM' },
      specific_compounds_100g: { polyphenols_mg:0,flavonoids_mg:0,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:0,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:5,berberine_mg:0 },
      bb_quality_score: 9.0,
    },
    // 11. Брокколи
    broccoli: {
      macro_100g: { proteins_animal:0,proteins_plant:2.8, fats_saturated:0.1,fats_monounsaturated:0,fats_polyunsaturated:0.1, omega_3_mg:50,omega_6_mg:30, mct_oil_g:0,cholesterol_mg:0, carbs_sugar:1.7,insulin_index:15 },
      amino_acid_profile_100g: { leucine_mg:130,isoleucine_mg:80,valine_mg:130,lysine_mg:140,methionine_mg:38,arginine_mg:190,glutamine_mg:350,tryptophan_mg:33,phenylalanine_mg:115,threonine_mg:90,histidine_mg:60,cysteine_mg:30 },
      electrolytes_100g: { sodium_mg:33,potassium_mg:316,magnesium_mg:21,calcium_mg:47,phosphorus_mg:66,pral_index:-4 },
      vitamins_100g: { vitamin_a_mcg:31,vitamin_c_mg:89,vitamin_d_mcg:0,vitamin_e_mg:0.8,vitamin_k_mcg:102,vitamin_b1_mg:0.07,vitamin_b2_mg:0.12,vitamin_b3_mg:0.64,vitamin_b5_mg:0.6,vitamin_b6_mg:0.18,vitamin_b7_mcg:2,vitamin_b9_mcg:63,vitamin_b12_mcg:0 },
      trace_elements_100g: { iron_total_mg:0.7,iron_heme_mg:0,zinc_mg:0.4,selenium_mcg:3,copper_mg:0.05,manganese_mg:0.2,iodine_mcg:3,chromium_mcg:5 },
      bioactive_compounds_100g: { creatine_mg:0,beta_alanine_mg:0,taurine_mg:0,lignan_mg:0,indol_3_carbinol_mg:25 },
      gastro_tags: { fodmap_group:'HIGH',enzyme_demand_score:3,gastric_emptying_speed:'FAST',allergen_flags:[],gut_irritant_potential:'LOW' },
      metabolic_flags: { atherogenic_potential:'LOW',glycation_potential:'LOW',ammonia_source_level:'LOW',heavy_metal_risk:'LOW',cns_impact:'NEUTRAL',goitrogenic_potential:'HIGH',hepatoprotective:true,anabolic_potential:'LOW',detox_support_level:'HIGH',histamine_level:'LOW',insulin_sensitivity_impact:'POSITIVE',thyroid_support_level:'LOW' },
      specific_compounds_100g: { polyphenols_mg:80,flavonoids_mg:40,curcumin_mg:0,sulforaphane_mg:45,resveratrol_mg:0,lectins_mg:5,oxalates_mg:20,phytoestrogens_mg:2,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0.5,berberine_mg:0 },
      bb_quality_score: 8.5,
    },
    // 12. Белая рыба (треска/минтай) — использую white_fish_cod
    white_fish_cod: {
      macro_100g: { proteins_animal:18,proteins_plant:0, fats_saturated:0.1,fats_monounsaturated:0.1,fats_polyunsaturated:0.2, omega_3_mg:150,omega_6_mg:10, mct_oil_g:0,cholesterol_mg:40, carbs_sugar:0,insulin_index:15 },
      amino_acid_profile_100g: { leucine_mg:1500,isoleucine_mg:900,valine_mg:950,lysine_mg:1700,methionine_mg:550,arginine_mg:1100,glutamine_mg:2100,tryptophan_mg:200,phenylalanine_mg:750,threonine_mg:800,histidine_mg:550,cysteine_mg:180 },
      electrolytes_100g: { sodium_mg:75,potassium_mg:300,magnesium_mg:25,calcium_mg:10,phosphorus_mg:200,pral_index:5 },
      vitamins_100g: { vitamin_a_mcg:3,vitamin_c_mg:0,vitamin_d_mcg:50,vitamin_e_mg:0.4,vitamin_k_mcg:0.1,vitamin_b1_mg:0.06,vitamin_b2_mg:0.05,vitamin_b3_mg:2.5,vitamin_b5_mg:0.4,vitamin_b6_mg:0.2,vitamin_b7_mcg:2,vitamin_b9_mcg:8,vitamin_b12_mcg:0.9 },
      trace_elements_100g: { iron_total_mg:0.3,iron_heme_mg:0.2,zinc_mg:0.5,selenium_mcg:30,copper_mg:0.03,manganese_mg:0.01,iodine_mcg:100,chromium_mcg:2 },
      bioactive_compounds_100g: { creatine_mg:300,beta_alanine_mg:0,taurine_mg:25,lignan_mg:0,indol_3_carbinol_mg:0 },
      gastro_tags: { fodmap_group:'LOW',enzyme_demand_score:2,gastric_emptying_speed:'FAST',allergen_flags:['fish'],gut_irritant_potential:'LOW' },
      metabolic_flags: { atherogenic_potential:'LOW',glycation_potential:'LOW',ammonia_source_level:'LOW',heavy_metal_risk:'LOW',cns_impact:'NEUTRAL',goitrogenic_potential:'LOW',hepatoprotective:false,anabolic_potential:'MEDIUM',detox_support_level:'LOW',histamine_level:'LOW',insulin_sensitivity_impact:'POSITIVE',thyroid_support_level:'HIGH' },
      specific_compounds_100g: { polyphenols_mg:0,flavonoids_mg:0,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:0,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:2,berberine_mg:0 },
      bb_quality_score: 8.5,
    },
    // 14. Протеиновый батончик
    protein_bar: {
      macro_100g: { proteins_animal:10,proteins_plant:5, fats_saturated:3,fats_monounsaturated:2,fats_polyunsaturated:1, omega_3_mg:50,omega_6_mg:300, mct_oil_g:0,cholesterol_mg:2, carbs_sugar:18,insulin_index:65 },
      amino_acid_profile_100g: { leucine_mg:800,isoleucine_mg:450,valine_mg:500,lysine_mg:700,methionine_mg:200,arginine_mg:400,glutamine_mg:1200,tryptophan_mg:80,phenylalanine_mg:400,threonine_mg:350,histidine_mg:200,cysteine_mg:80 },
      electrolytes_100g: { sodium_mg:300,potassium_mg:180,magnesium_mg:40,calcium_mg:120,phosphorus_mg:200,pral_index:3 },
      vitamins_100g: { vitamin_a_mcg:50,vitamin_c_mg:10,vitamin_d_mcg:20,vitamin_e_mg:4,vitamin_k_mcg:10,vitamin_b1_mg:0.3,vitamin_b2_mg:0.4,vitamin_b3_mg:4,vitamin_b5_mg:2,vitamin_b6_mg:0.4,vitamin_b7_mcg:15,vitamin_b9_mcg:50,vitamin_b12_mcg:0.5 },
      trace_elements_100g: { iron_total_mg:3,iron_heme_mg:0,zinc_mg:2,selenium_mcg:10,copper_mg:0.2,manganese_mg:0.5,iodine_mcg:5,chromium_mcg:5 },
      bioactive_compounds_100g: { creatine_mg:0,beta_alanine_mg:0,taurine_mg:10,lignan_mg:0,indol_3_carbinol_mg:0 },
      gastro_tags: { fodmap_group:'HIGH',enzyme_demand_score:4,gastric_emptying_speed:'MEDIUM',allergen_flags:['dairy','gluten'],gut_irritant_potential:'HIGH' },
      metabolic_flags: { atherogenic_potential:'LOW',glycation_potential:'HIGH',ammonia_source_level:'LOW',heavy_metal_risk:'LOW',cns_impact:'NEUTRAL',goitrogenic_potential:'LOW',hepatoprotective:false,anabolic_potential:'MEDIUM',detox_support_level:'LOW',histamine_level:'LOW',insulin_sensitivity_impact:'NEGATIVE',thyroid_support_level:'LOW' },
      specific_compounds_100g: { polyphenols_mg:10,flavonoids_mg:5,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:0,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:1,berberine_mg:0 },
      bb_quality_score: 6.0,
    },
    // 15. Куриная грудка
    chicken_breast: {
      specific_compounds_100g: { polyphenols_mg:0,flavonoids_mg:0,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:0,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0.5,coenzyme_q10_mg:1.5,berberine_mg:0 },
      bb_quality_score: 9.5,
    },
    // 16. Яблоко
    apple: {
      specific_compounds_100g: { polyphenols_mg:120,flavonoids_mg:45,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:5,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0,berberine_mg:0 },
      bb_quality_score: 7.0,
    },
    // 17. Чечевица
    lentils: {
      macro_100g: { proteins_animal:0,proteins_plant:9, fats_saturated:0.1,fats_monounsaturated:0.1,fats_polyunsaturated:0.2, omega_3_mg:10,omega_6_mg:80, mct_oil_g:0,cholesterol_mg:0, carbs_sugar:1.8,insulin_index:25 },
      amino_acid_profile_100g: { leucine_mg:640,isoleucine_mg:390,valine_mg:440,lysine_mg:630,methionine_mg:75,arginine_mg:590,glutamine_mg:1200,tryptophan_mg:80,phenylalanine_mg:440,threonine_mg:340,histidine_mg:240,cysteine_mg:85 },
      specific_compounds_100g: { polyphenols_mg:80,flavonoids_mg:25,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:150,oxalates_mg:20,phytoestrogens_mg:5,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0,berberine_mg:0 },
      bb_quality_score: 8.0,
    },
    // 18. Греческий йогурт
    yogurt_greek: {
      specific_compounds_100g: { polyphenols_mg:0,flavonoids_mg:0,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:3,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0.3,berberine_mg:0 },
      bb_quality_score: 8.0,
    },
    // 20. Молоко 2.5%
    milk: {
      specific_compounds_100g: { polyphenols_mg:0,flavonoids_mg:0,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:3,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0.3,berberine_mg:0 },
      bb_quality_score: 6.5,
    },
    // 21. Сывороточный протеин
    whey_protein: {
      specific_compounds_100g: { polyphenols_mg:0,flavonoids_mg:0,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:0,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0,berberine_mg:0 },
      bb_quality_score: 9.0,
    },
    // ─── Supplement overrides (key sports nutrition products) ───
    casein: {
      amino_acid_profile_100g: { leucine_mg:1900,isoleucine_mg:1100,valine_mg:1200,lysine_mg:1700,methionine_mg:520,arginine_mg:700,glutamine_mg:2600,tryptophan_mg:240,phenylalanine_mg:1050,threonine_mg:950,histidine_mg:580,cysteine_mg:120 },
      specific_compounds_100g: { polyphenols_mg:0,flavonoids_mg:0,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:0,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0,berberine_mg:0 },
      bb_quality_score: 8.5,
    },
    creatine: {
      macro_100g: { proteins_animal:0,proteins_plant:0, fats_saturated:0,fats_monounsaturated:0,fats_polyunsaturated:0, omega_3_mg:0,omega_6_mg:0, mct_oil_g:0,cholesterol_mg:0, carbs_sugar:0,insulin_index:10 },
      amino_acid_profile_100g: { leucine_mg:0,isoleucine_mg:0,valine_mg:0,lysine_mg:0,methionine_mg:0,arginine_mg:0,glutamine_mg:0,tryptophan_mg:0,phenylalanine_mg:0,threonine_mg:0,histidine_mg:0,cysteine_mg:0 },
      bioactive_compounds_100g: { creatine_mg:88000,beta_alanine_mg:0,taurine_mg:0,lignan_mg:0,indol_3_carbinol_mg:0 },
      metabolic_flags: { atherogenic_potential:'LOW',glycation_potential:'LOW',ammonia_source_level:'LOW',heavy_metal_risk:'LOW',cns_impact:'NEUTRAL',goitrogenic_potential:'LOW',hepatoprotective:false,anabolic_potential:'MEDIUM',detox_support_level:'LOW',histamine_level:'LOW',insulin_sensitivity_impact:'POSITIVE',thyroid_support_level:'LOW' },
      bb_quality_score: 8.5,
    },
    fish_oil: {
      macro_100g: { proteins_animal:0,proteins_plant:0, fats_saturated:3,fats_monounsaturated:2.5,fats_polyunsaturated:35, omega_3_mg:30000,omega_6_mg:2000, mct_oil_g:0,cholesterol_mg:0, carbs_sugar:0,insulin_index:5 },
      specific_compounds_100g: { polyphenols_mg:0,flavonoids_mg:0,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:0,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0,berberine_mg:0 },
      metabolic_flags: { atherogenic_potential:'LOW',glycation_potential:'LOW',ammonia_source_level:'LOW',heavy_metal_risk:'MEDIUM',cns_impact:'NEUTRAL',goitrogenic_potential:'LOW',hepatoprotective:true,anabolic_potential:'LOW',detox_support_level:'MEDIUM',histamine_level:'LOW',insulin_sensitivity_impact:'POSITIVE',thyroid_support_level:'LOW' },
      bb_quality_score: 9.0,
    },
    bcaa: {
      amino_acid_profile_100g: { leucine_mg:5000,isoleucine_mg:2500,valine_mg:2500,lysine_mg:0,methionine_mg:0,arginine_mg:0,glutamine_mg:0,tryptophan_mg:0,phenylalanine_mg:0,threonine_mg:0,histidine_mg:0,cysteine_mg:0 },
      specific_compounds_100g: { polyphenols_mg:0,flavonoids_mg:0,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:0,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0,berberine_mg:0 },
      bb_quality_score: 7.5,
    },
    glutamine: {
      amino_acid_profile_100g: { leucine_mg:0,isoleucine_mg:0,valine_mg:0,lysine_mg:0,methionine_mg:0,arginine_mg:0,glutamine_mg:10000,tryptophan_mg:0,phenylalanine_mg:0,threonine_mg:0,histidine_mg:0,cysteine_mg:0 },
      bb_quality_score: 7.0,
    },
    whey_isolate: {
      amino_acid_profile_100g: { leucine_mg:9700,isoleucine_mg:5300,valine_mg:4800,lysine_mg:7900,methionine_mg:1800,arginine_mg:1100,glutamine_mg:4200,tryptophan_mg:400,phenylalanine_mg:1500,threonine_mg:1600,histidine_mg:900,cysteine_mg:500 },
      bb_quality_score: 9.5,
    },
    // ─── Supplement file additions (supp_* prefix) ───
    supp_whey_hydro: {
      amino_acid_profile_100g: { leucine_mg:3500,isoleucine_mg:2000,valine_mg:2100,lysine_mg:3100,methionine_mg:900,arginine_mg:1200,glutamine_mg:4500,tryptophan_mg:420,phenylalanine_mg:1600,threonine_mg:1700,histidine_mg:950,cysteine_mg:550 },
      bb_quality_score: 9.5,
    },
    supp_eaas: {
      amino_acid_profile_100g: { leucine_mg:4500,isoleucine_mg:2200,valine_mg:2200,lysine_mg:3500,methionine_mg:1000,arginine_mg:500,glutamine_mg:1000,tryptophan_mg:500,phenylalanine_mg:1500,threonine_mg:2000,histidine_mg:1000,cysteine_mg:500 },
      bb_quality_score: 8.0,
    },
    supp_collagen: {
      amino_acid_profile_100g: { leucine_mg:800,isoleucine_mg:600,valine_mg:700,lysine_mg:900,methionine_mg:200,arginine_mg:2000,glutamine_mg:2500,tryptophan_mg:0,phenylalanine_mg:600,threonine_mg:600,histidine_mg:350,cysteine_mg:50 },
      macro_100g: { proteins_animal:90,proteins_plant:0, fats_saturated:0,fats_monounsaturated:0,fats_polyunsaturated:0, omega_3_mg:0,omega_6_mg:0, mct_oil_g:0,cholesterol_mg:0, carbs_sugar:0,insulin_index:20 },
      metabolic_flags: { atherogenic_potential:'LOW',glycation_potential:'LOW',ammonia_source_level:'LOW',heavy_metal_risk:'LOW',cns_impact:'NEUTRAL',goitrogenic_potential:'LOW',hepatoprotective:false,anabolic_potential:'LOW',detox_support_level:'LOW',histamine_level:'LOW',insulin_sensitivity_impact:'NEUTRAL',thyroid_support_level:'LOW' },
      bb_quality_score: 6.5,
    },
    supp_beta_alanine: {
      specific_compounds_100g: { polyphenols_mg:0,flavonoids_mg:0,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:0,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0,berberine_mg:0 },
      bb_quality_score: 7.0,
    },
    supp_citrulline: {
      amino_acid_profile_100g: { leucine_mg:0,isoleucine_mg:0,valine_mg:0,lysine_mg:0,methionine_mg:0,arginine_mg:8500,glutamine_mg:0,tryptophan_mg:0,phenylalanine_mg:0,threonine_mg:0,histidine_mg:0,cysteine_mg:0 },
      bb_quality_score: 7.5,
    },
    supp_zma: {
      trace_elements_100g: { iron_total_mg:0,iron_heme_mg:0,zinc_mg:30,selenium_mcg:0,copper_mg:0,manganese_mg:0,iodine_mcg:0,chromium_mcg:0 },
      electrolytes_100g: { sodium_mg:0,potassium_mg:0,magnesium_mg:450,calcium_mg:0,phosphorus_mg:0,pral_index:0 },
      vitamins_100g: { vitamin_a_mcg:0,vitamin_c_mg:0,vitamin_d_mcg:0,vitamin_e_mg:0,vitamin_k_mcg:0,vitamin_b1_mg:0,vitamin_b2_mg:0,vitamin_b3_mg:0,vitamin_b5_mg:0,vitamin_b6_mg:35,vitamin_b7_mcg:0,vitamin_b9_mcg:0,vitamin_b12_mcg:0 },
      bb_quality_score: 8.0,
    },
    supp_mass_gainer: {
      macro_100g: { proteins_animal:15,proteins_plant:5, fats_saturated:1,fats_monounsaturated:1,fats_polyunsaturated:0.5, omega_3_mg:20,omega_6_mg:150, mct_oil_g:0,cholesterol_mg:5, carbs_sugar:20,insulin_index:75 },
      bb_quality_score: 5.5,
    },
    supp_hmb: {
      macro_100g: { proteins_animal:0,proteins_plant:0, fats_saturated:0,fats_monounsaturated:0,fats_polyunsaturated:0, omega_3_mg:0,omega_6_mg:0, mct_oil_g:0,cholesterol_mg:0, carbs_sugar:0,insulin_index:5 },
      bb_quality_score: 7.5,
    },
    supp_cla: {
      macro_100g: { proteins_animal:0,proteins_plant:0, fats_saturated:1,fats_monounsaturated:2,fats_polyunsaturated:80, omega_3_mg:0,omega_6_mg:75000, mct_oil_g:0,cholesterol_mg:0, carbs_sugar:0,insulin_index:5 },
      bb_quality_score: 6.0,
    },
    supp_cordyceps: {
      specific_compounds_100g: { polyphenols_mg:500,flavonoids_mg:200,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:0,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0,berberine_mg:0 },
      bb_quality_score: 7.5,
    },
    supp_ashwagandha: {
      specific_compounds_100g: { polyphenols_mg:800,flavonoids_mg:300,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:0,lectins_mg:0,oxalates_mg:0,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0,berberine_mg:0 },
      bb_quality_score: 7.5,
    },
    // ─── Key produce overrides ───
    veg_kale: {
      specific_compounds_100g: { polyphenols_mg:200,flavonoids_mg:120,curcumin_mg:0,sulforaphane_mg:35,resveratrol_mg:0,lectins_mg:0,oxalates_mg:20,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0.5,berberine_mg:0 },
      bb_quality_score: 9.0,
    },
    veg_cauliflower: {
      specific_compounds_100g: { polyphenols_mg:50,flavonoids_mg:20,curcumin_mg:0,sulforaphane_mg:30,resveratrol_mg:0,lectins_mg:0,oxalates_mg:5,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0.5,berberine_mg:0 },
      bb_quality_score: 8.0,
    },
    fruit_blueberry: {
      specific_compounds_100g: { polyphenols_mg:500,flavonoids_mg:150,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:5,lectins_mg:0,oxalates_mg:5,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0.5,berberine_mg:0 },
      bb_quality_score: 8.5,
    },
    fruit_strawberry: {
      specific_compounds_100g: { polyphenols_mg:300,flavonoids_mg:100,curcumin_mg:0,sulforaphane_mg:0,resveratrol_mg:2,lectins_mg:0,oxalates_mg:5,phytoestrogens_mg:0,alpha_lipoic_acid_mg:0,coenzyme_q10_mg:0.3,berberine_mg:0 },
      bb_quality_score: 8.0,
    },
    seed_chia: {
      macro_100g: { proteins_animal:0,proteins_plant:16, fats_saturated:3.3,fats_monounsaturated:2.3,fats_polyunsaturated:24, omega_3_mg:18000,omega_6_mg:5800, mct_oil_g:0,cholesterol_mg:0, carbs_sugar:0,insulin_index:10 },
      bb_quality_score: 9.0,
    },
    nut_brazil: {
      trace_elements_100g: { iron_total_mg:2.4,iron_heme_mg:0,zinc_mg:4,selenium_mcg:1917,copper_mg:1.7,manganese_mg:1.2,iodine_mcg:2,chromium_mcg:5 },
      bb_quality_score: 8.5,
    },
  };
  for (const [id, override] of Object.entries(overrides)) {
    const idx = FOOD_DB.findIndex(f => f.id === id);
    if (idx >= 0) Object.assign(FOOD_DB[idx], override);
  }
})();

// ─── Auto-generate FOOD_ALLERGEN_DIET entries for new products ───
(function autoGenAllergenDiet() {
  for (let i = 0; i < FOOD_DB.length; i++) {
    const f = FOOD_DB[i];
    if (FOOD_ALLERGEN_DIET[f.id]) continue;
    const cat = f.category;
    const isMeatOrFish = cat === 'protein' && !f.name.includes('тофу') && !f.name.includes('темпе') && !f.name.includes('протеин');
    const isDairy = cat === 'dairy';
    const isVegVegan = cat === 'veg_fruit' || cat === 'grain' || cat === 'carb';
    const isFat = cat === 'fat';
    const isSupp = cat === 'supplement';
    const isOther = cat === 'other' || cat === 'fast_food';
    const hasGluten = ['grain', 'carb'].includes(cat) || f.id.includes('bread') || f.id.includes('pasta') || f.id.includes('noodle') || f.id.includes('flour') || f.id.includes('cereal');
    const hasDairy = isDairy || f.id.includes('milk') || f.id.includes('cheese') || f.id.includes('cream') || f.id.includes('yogurt') || f.id.includes('kefir');
    const hasFish = f.id.includes('fish') || f.id.includes('salmon') || f.id.includes('tuna') || f.id.includes('cod') || f.id.includes('herring') || f.id.includes('mackerel') || f.id.includes('sardine') || f.id.includes('trout');
    const hasShellfish = f.id.includes('shrimp') || f.id.includes('crab') || f.id.includes('lobster') || f.id.includes('mussel') || f.id.includes('clam') || f.id.includes('oyster') || f.id.includes('scallop') || f.id.includes('octopus') || f.id.includes('squid');
    const hasEggs = f.id.includes('egg');
    const hasNuts = f.id.includes('almond') || f.id.includes('walnut') || f.id.includes('cashew') || f.id.includes('pistachio') || f.id.includes('hazelnut') || f.id.includes('pecan') || f.id.includes('macadamia') || f.id.includes('nut') || f.id.includes('peanut');
    const hasSoy = f.id.includes('soy') || f.id.includes('tofu') || f.id.includes('tempeh') || f.id.includes('edamame');
    const allergens: string[] = [];
    if (hasFish) allergens.push('fish');
    if (hasShellfish) allergens.push('shellfish');
    if (hasDairy) allergens.push('dairy');
    if (hasEggs) allergens.push('eggs');
    if (hasNuts) allergens.push('tree_nuts');
    if (hasSoy) allergens.push('soy');
    if (hasGluten) allergens.push('gluten');
    const isVegetarian = !isMeatOrFish && !f.id.includes('beef') && !f.id.includes('pork') && !f.id.includes('lamb') && !f.id.includes('chicken') && !f.id.includes('turkey') && !f.id.includes('duck') && !f.id.includes('goose') && !f.id.includes('rabbit') && !f.id.includes('venison') && !f.id.includes('bison') && !f.id.includes('elk') && !f.id.includes('boar') && !f.id.includes('game');
    const isVegan = isVegetarian && !hasDairy && !hasEggs && !f.id.includes('honey');
    const dietTags: string[] = [];
    if (['protein', 'fat', 'veg_fruit'].includes(cat) || f.carbs < 10) dietTags.push('keto');
    if (!hasGluten && !['grain', 'carb'].includes(cat)) dietTags.push('paleo');
    if (!isMeatOrFish || hasFish) dietTags.push('mediterranean');
    FOOD_ALLERGEN_DIET[f.id] = {
      allergens,
      isVegetarian,
      isVegan,
      isGlutenFree: !hasGluten,
      isDairyFree: !hasDairy,
      dietTags,
    };
  }
})();
