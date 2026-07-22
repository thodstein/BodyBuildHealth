/**
 * Product Usefulness v2 Engine — Динамический скоринг продуктов питания
 * для бодибилдинга с учётом фазы, фармакологии, анализов и тайминга.
 *
 * ТЗ: D:\ТЗ\Планировщик\ (3 файла)
 */

import { FOOD_DB, calcBBQualityScore, type FoodItem } from '../core/nutrition-database';
import { getMicro } from "../core/nutrition-micros";

// ═══════════════════════════════════════════════════════════════════
// 1. TYPES
// ═══════════════════════════════════════════════════════════════════

export type Phase = 'LEAN_MASS' | 'EXTREME_CUT' | 'PEAK_WEEK' | 'POST_CYCLE' | 'MOST';
export type MealTiming = 'regular' | 'pre_workout' | 'intra_workout' | 'post_workout' | 'before_bed' | 'detox' | 'cheat_meal' | 'balanced' | 'carb_load';

export interface UserDietProfile {
  // Блок А — спортивные метрики
  sex: 'male' | 'female';
  weightKg: number;
  bodyFatPct: number;
  lbm: number;
  discipline: 'bodybuilding' | 'powerlifting';
  phase: Phase;
  histamineSensitive: boolean;

  // Блок Б — анализы (все опциональны)
  labs: {
    hematocrit?: number; hemoglobin?: number; hdl?: number; ldl?: number;
    alt?: number; ast?: number; urea?: number; creatinine?: number;
    estradiol?: number; prolactin?: number; testosterone?: number;
    tsh?: number; crp?: number; ferritin?: number;
    homocysteine?: number; gfr?: number; bilirubin_total?: number;
    uric_acid?: number; glucose_fasting?: number; insulin_fasting?: number;
    homa_ir?: number;
  };

  // Блок В — фармакология
  pharma: {
    AAS_ORAL: boolean; AAS_INJECTABLE: boolean; HGH: boolean;
    DIURETICS: boolean; STIMULATORS: boolean; INSULIN_USE: boolean;
    SARMS_PROHORMONES: boolean; PCT_MEDS: boolean;
    LIVER_SUPPORT: boolean; GUT_SUPPORT: boolean; DETOX_SUPPORT: boolean;
    FIBER_SUPPLEMENT: boolean; DIGESTIVE_ENZYMES: boolean;
    VIT_MIN_SUPPLEMENT: boolean; OMEGA3_SUPPLEMENT: boolean;
  };
}

export interface V2ScoreResult {
  total: number;
  bbScore: number;
  phaseMod: number;
  pharmaMod: number;
  labMod: number;
  timingMod: number;
  label: string;
  color: string;
  factors: FactorDetail[];
}

export interface FactorDetail {
  text: string;
  impact: number;
  icon: string;
}

export interface MealScoreV2 {
  compositeScore: number;
  maxPossible: number;
  productScores: { id: string; name: string; score: number; weightG: number; contribution: number }[];
  weakLinks: string[];
  macros: { kcal: number; protein: number; fat: number; carbs: number; fiber: number };
  modifiers: { name: string; value: number }[];
  label: string;
  color: string;
}

export interface DailyDietReport {
  date: string;
  totalKcal: number;
  mtorTriggered: boolean;
  mtorDeficitMg: number;
  /** Real daily glycemic load: sum(available carbs * GI / 100). */
  giLoad: number;
  giLoadWarning: boolean;
  cortisolRisk: boolean;
  ammoniaRisk: boolean;
  ammoniaScore: number;
  electrolyteRisk: boolean;
  potassiumMg: number;
  magnesiumMg: number;
  insulinRicohet: boolean;
  pralTotal: number;
  pralWarning: string | null;
  omegaRatio: number;
  omegaWarning: string | null;
  microDeficits: string[];
  homaIr: number | null;
  // Phase 2 modules
  diaas: number;
  diaasLimitingAA: string;
  diaasWarning: string | null;
  antinutrientWarning: string | null;
  glutathioneWarning: string | null;
  histamineWarning: string | null;
  histamineSensitive: boolean;
}

export function getDefaultProfile(): UserDietProfile {
  const p: UserDietProfile = {
    sex: 'male', weightKg: 80, bodyFatPct: 15, lbm: 0, discipline: 'bodybuilding', phase: 'LEAN_MASS',
    histamineSensitive: false,
    labs: {},
    pharma: {
      AAS_ORAL: false, AAS_INJECTABLE: false, HGH: false, DIURETICS: false,
      STIMULATORS: false, INSULIN_USE: false, SARMS_PROHORMONES: false, PCT_MEDS: false,
      LIVER_SUPPORT: false, GUT_SUPPORT: false, DETOX_SUPPORT: false,
      FIBER_SUPPLEMENT: false, DIGESTIVE_ENZYMES: false,
      VIT_MIN_SUPPLEMENT: false, OMEGA3_SUPPLEMENT: false,
    },
  };
  p.lbm = p.weightKg * (100 - p.bodyFatPct) / 100;
  return p;
}

// ═══════════════════════════════════════════════════════════════════
// 2. HELPER: SCORE LABEL
// ═══════════════════════════════════════════════════════════════════

function labelScore(s: number): { label: string; color: string; icon: string } {
  if (s >= 8.0) return { label: 'Идеально', color: '#22c55e', icon: '✅' };
  if (s >= 5.0) return { label: 'Допустимо', color: '#f59e0b', icon: '⚠️' };
  return { label: 'Критический риск', color: '#ef4444', icon: '🚨' };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}
function pct(v: number | undefined, scale: number): number {
  return (v ?? 0) * scale;
}

// ═══════════════════════════════════════════════════════════════════
// 3. STEP 1: PHASE MODIFIERS
// ═══════════════════════════════════════════════════════════════════

function applyPhaseModifiers(score: number, f: FoodItem, p: UserDietProfile): { score: number; factors: FactorDetail[] } {
  const ff: FactorDetail[] = [];
  const cals = f.kcal;
  const insulinIdx = f.macro_100g?.insulin_index ?? 75;
  const enzyme = f.gastro_tags?.enzyme_demand_score ?? 3;
  const gi = f.gi;
  const fodmap = f.gastro_tags?.fodmap_group ?? 'LOW';
  const fiber = f.fiber;
  const sugar = f.macro_100g?.carbs_sugar ?? 0;
  const satFat = getMicro(f, 'SatFat');
  const animalP = f.macro_100g?.proteins_animal ?? 0;
  const plantP = f.macro_100g?.proteins_plant ?? 0;
  const sodium = getMicro(f, 'Na');
  const potassium = getMicro(f, 'K');
  const cholesterol = getMicro(f, 'Cholesterol');

  const totalProtein = animalP + plantP;

  switch (p.phase) {
    case 'EXTREME_CUT':
      score -= Math.max(0, (totalProtein > 0 ? cals / totalProtein - 8 : 15) / 3) + insulinIdx / 30;
      if (fodmap === 'HIGH') { score -= 2.5; ff.push({ text: 'HIGH FODMAP на сушке', impact: -2.5, icon: '⚠️' }); }
      if (fiber > 4) { score += 1.5; ff.push({ text: 'Клетчатка >4г на сушке', impact: 1.5, icon: '✅' }); }
      if (sugar > 5) { score -= 3.0; ff.push({ text: 'Сахар >5г на сушке', impact: -3.0, icon: '🚨' }); }
      if (satFat > 5) { score -= 2.0; ff.push({ text: 'Насыщ.жиры >5г на сушке', impact: -2.0, icon: '⚠️' }); }
      if (f.metabolic_flags?.insulin_sensitivity_impact === 'NEGATIVE') { score -= 2.0; ff.push({ text: 'Инсулин-сенс NEG на сушке', impact: -2.0, icon: '⚠️' }); }
      break;
    case 'PEAK_WEEK':
      if (f.category === 'veg_fruit') { score -= 5.0; ff.push({ text: 'Овощи/фрукты ограничены на пике', impact: -5.0, icon: '🚨' }); }
      else if (f.category === 'grain' && fodmap === 'LOW') { score += 2.0; ff.push({ text: 'Крупы LOW FODMAP — идеал загрузки', impact: 2.0, icon: '✅' }); }
      if (sodium > 120 && p.pharma.DIURETICS) { score -= 5.0; ff.push({ text: 'Na >120мг + диуретики', impact: -5.0, icon: '🚨' }); }
      if (potassium < 100) { score -= 2.0; ff.push({ text: 'K <100мг на пике', impact: -2.0, icon: '⚠️' }); }
      if (getMicro(f, 'Iodine') > 50 || f.metabolic_flags?.thyroid_support_level === 'HIGH') { score += 0.5; ff.push({ text: 'Поддержка щитовидки', impact: 0.5, icon: '✅' }); }
      break;
    case 'LEAN_MASS':
      score += cals / 60 - enzyme / 2;
      if (f.gastro_tags?.gastric_emptying_speed === 'SLOW') { score -= 2.0; ff.push({ text: 'Тяжёлая еда — снижает аппетит', impact: -2.0, icon: '⚠️' }); }
      if (f.protein < 10) { score -= 1.5; ff.push({ text: 'Мало белка для набора', impact: -1.5, icon: '⚠️' }); }
      if (plantP > 10) { score += 0.5; ff.push({ text: 'Растительный белок', impact: 0.5, icon: '✅' }); }
      if ((f.specific_compounds_100g?.coenzyme_q10_mg ?? 0) > 5) { score += 0.5; ff.push({ text: 'CoQ10 для энергии', impact: 0.5, icon: '✅' }); }
      break;
    case 'POST_CYCLE':
    case 'MOST':
      score += (animalP > 15 ? 1.0 : -1.0);
      if (cholesterol >= 50 && cholesterol <= 150) { score += 2.0; ff.push({ text: 'Холестерин 50-150 — субстрат тестостерона', impact: 2.0, icon: '✅' }); }
      if (f.metabolic_flags?.detox_support_level === 'HIGH') { score += 1.0; ff.push({ text: 'Детокс-поддержка', impact: 1.0, icon: '✅' }); }
      if (f.metabolic_flags?.cns_impact === 'STIMULANT') { score -= 1.0; ff.push({ text: 'Стимуляция ЦНС на ПКТ', impact: -1.0, icon: '⚠️' }); }
      if (getMicro(f, 'VitD') > 5) { score += 1.0; ff.push({ text: 'Витамин D для гормонов', impact: 1.0, icon: '✅' }); }
      break;
  }
  return { score, factors: ff };
}

// ═══════════════════════════════════════════════════════════════════
// 4. STEP 2: PHARMA MODIFIERS
// ═══════════════════════════════════════════════════════════════════

function applyPharmaModifiers(score: number, f: FoodItem, p: UserDietProfile): { score: number; factors: FactorDetail[] } {
  const ff: FactorDetail[] = [];
  const atherogenic = f.metabolic_flags?.atherogenic_potential ?? 'LOW';
  const insulinIdx = f.macro_100g?.insulin_index ?? 75;
  const cns = f.metabolic_flags?.cns_impact ?? 'NEUTRAL';
  const detox = f.metabolic_flags?.detox_support_level ?? 'LOW';
  const gutIrr = f.gastro_tags?.gut_irritant_potential ?? 'LOW';
  const enzyme = f.gastro_tags?.enzyme_demand_score ?? 3;
  const sodium = getMicro(f, 'Na');
  const o3 = getMicro(f, 'Omega3');
  const o6 = f.macro_100g?.omega_6_mg ?? 0;
  const fiber = f.fiber;
  const protein = f.protein;
  const category = f.category;

  if (p.pharma.AAS_ORAL && atherogenic === 'HIGH') { score -= 4.5; ff.push({ text: 'Оральные ААС + атерогенность', impact: -4.5, icon: '🚨' }); }
  if (p.pharma.HGH && (insulinIdx > 70 || f.gi > 65)) { score -= 4.0; ff.push({ text: 'HGH + высокий ГИ/ИИ', impact: -4.0, icon: '🚨' }); }
  if (p.pharma.DIURETICS && sodium > 120) { score -= 5.0; ff.push({ text: 'Диуретики + натрий', impact: -5.0, icon: '🚨' }); }
  if (p.pharma.STIMULATORS && cns === 'STIMULANT') { score -= 4.0; ff.push({ text: 'Стимуляторы + ЦНС-стимуляция', impact: -4.0, icon: '🚨' }); }
  if (p.pharma.STIMULATORS && cns === 'SEDATIVE') { score += 3.0; ff.push({ text: 'Седативный продукт + стимуляторы', impact: 3.0, icon: '✅' }); }
  if (!p.pharma.LIVER_SUPPORT && category === 'protein' && protein > 20) { score -= 1.5; ff.push({ text: 'Нагрузка на печень без поддержки', impact: -1.5, icon: '⚠️' }); }
  if (p.pharma.LIVER_SUPPORT && detox === 'HIGH') { score += 2.0; ff.push({ text: 'Детокс + поддержка печени', impact: 2.0, icon: '✅' }); }
  if (!p.pharma.GUT_SUPPORT && gutIrr === 'HIGH') { score -= 2.0; ff.push({ text: 'Раздражение ЖКТ без поддержки', impact: -2.0, icon: '⚠️' }); }
  if (p.pharma.DETOX_SUPPORT && (f.metabolic_flags?.heavy_metal_risk ?? 'LOW') === 'HIGH') { score += 1.0; }
  if (p.pharma.DETOX_SUPPORT && (f.metabolic_flags?.ammonia_source_level ?? 'LOW') === 'HIGH') { score += 1.5; }
  if (!p.pharma.FIBER_SUPPLEMENT && fiber < 2) { score -= 1.0; ff.push({ text: 'Мало клетчатки без добавки', impact: -1.0, icon: '⚠️' }); }
  if (!p.pharma.DIGESTIVE_ENZYMES && enzyme > 7) { score -= 2.0; ff.push({ text: 'Высокая ферментная нагрузка', impact: -2.0, icon: '⚠️' }); }
  if (!p.pharma.VIT_MIN_SUPPLEMENT && (getMicro(f, 'VitD') < 5 || getMicro(f, 'Mg') < 100)) { score -= 0.5; }
  if (!p.pharma.OMEGA3_SUPPLEMENT && o6 > 0 && o3 / Math.max(o6, 1) < 0.2) { score -= 1.0; }

  return { score, factors: ff };
}

// ═══════════════════════════════════════════════════════════════════
// 5. STEP 3: LAB MODIFIERS
// ═══════════════════════════════════════════════════════════════════

function applyLabModifiers(score: number, f: FoodItem, p: UserDietProfile): { score: number; factors: FactorDetail[] } {
  const ff: FactorDetail[] = [];
  const L = p.labs;
  if (!L) return { score, factors: ff };

  const gi = f.gi;
  const o3 = getMicro(f, 'Omega3');
  const o6 = f.macro_100g?.omega_6_mg ?? 0;
  const atherogenic = f.metabolic_flags?.atherogenic_potential ?? 'LOW';
  const category = f.category;
  const pral = f.electrolytes_100g?.pral_index ?? 0;
  const protein = f.protein;
  const animalP = f.macro_100g?.proteins_animal ?? 0;
  const potassium = getMicro(f, 'K');
  const sodium = getMicro(f, 'Na');
  const fiber = f.fiber;
  const sugar = f.macro_100g?.carbs_sugar ?? 0;
  const zinc = getMicro(f, 'Zn');
  const ironHeme = f.trace_elements_100g?.iron_heme_mg ?? 0;
  const detox = f.metabolic_flags?.detox_support_level ?? 'LOW';
  const chole = getMicro(f, 'Cholesterol');
  const iodine = getMicro(f, 'Iodine');
  const selenium = getMicro(f, 'Se');
  const chromium = f.trace_elements_100g?.chromium_mcg ?? 0;
  const ala = f.specific_compounds_100g?.alpha_lipoic_acid_mg ?? 0;
  const berberine = f.specific_compounds_100g?.berberine_mg ?? 0;
  const insSens = f.metabolic_flags?.insulin_sensitivity_impact ?? 'NEUTRAL';
  const heavy = f.metabolic_flags?.heavy_metal_risk ?? 'LOW';
  const glycation = f.metabolic_flags?.glycation_potential ?? 'LOW';
  const thyroid = f.metabolic_flags?.thyroid_support_level ?? 'LOW';

  // HCT/HGB
  if ((L.hematocrit ?? 0) > 51 || (L.hemoglobin ?? 0) > 170) {
    if (gi > 65) score -= 3.0;
    if (o3 > 300) { score += 2.0; ff.push({ text: 'Омега-3 при высоком HCT', impact: 2.0, icon: '✅' }); }
  }
  // Lipids
  if ((L.ldl ?? 0) > 4.2 || (L.hdl ?? 0) < 0.8) {
    if (atherogenic === 'HIGH') { score -= 5.0; ff.push({ text: 'Атерогенный продукт при плохих липидах', impact: -5.0, icon: '🚨' }); }
    if (o3 > 200) { score += 2.5; ff.push({ text: 'Омега-3 для липидов', impact: 2.5, icon: '✅' }); }
  }
  // Urea/Creatinine
  if ((L.urea ?? 0) > 8.5 || (L.creatinine ?? 0) > 115) {
    if (category === 'protein') { score -= 3.5; ff.push({ text: 'Белковый продукт при высоком urea/Cr', impact: -3.5, icon: '🚨' }); }
    if (pral < -3) { score += 2.5; ff.push({ text: 'Защелачивание при urea/Cr', impact: 2.5, icon: '✅' }); }
  }
  // E2/PRL
  if ((L.estradiol ?? 0) > 180 || (L.prolactin ?? 0) > 450) {
    const kna = sodium > 0 ? potassium / sodium : 99;
    if (kna < 2) score -= 3.5;
    if (kna > 5) score += 2.0;
    if ((f.specific_compounds_100g?.sulforaphane_mg ?? 0) > 5) { score += 1.5; ff.push({ text: 'Сульфорафан при E2/PRL', impact: 1.5, icon: '✅' }); }
  }
  // CRP
  if ((L.crp ?? 0) > 3) {
    if (glycation === 'HIGH') { score -= 4.0; ff.push({ text: 'AGEs при CRP >3', impact: -4.0, icon: '🚨' }); }
    if (o6 > 1000) score -= 2.0;
    if ((f.specific_compounds_100g?.polyphenols_mg ?? 0) > 100 || (f.specific_compounds_100g?.flavonoids_mg ?? 0) > 50) { score += 2.0; ff.push({ text: 'Полифенолы/флавоноиды против воспаления', impact: 2.0, icon: '✅' }); }
  }
  // Ferritin
  if ((L.ferritin ?? 999) < 30) {
    if ((category === 'protein' || f.id.includes('liver') || f.id.includes('beef')) && ironHeme > 5) { score += 3.5; ff.push({ text: 'Гемовое железо при анемии', impact: 3.5, icon: '✅' }); }
  }
  // Low T on PCT
  if ((L.testosterone ?? 999) < 12 && (p.phase === 'POST_CYCLE' || p.phase === 'MOST')) {
    if (chole >= 50 && chole <= 150) { score += 2.0; }
    if (zinc > 5) { score += 0.5; }
  }
  // Homocysteine
  if ((L.homocysteine ?? 0) > 15) {
    const b6 = getMicro(f, 'VitB6');
    const b9 = getMicro(f, 'VitB9');
    const b12 = getMicro(f, 'VitB12');
    if (b9 < 50 || b6 < 0.5 || b12 < 1) score -= 3.0;
    if (b9 > 100) { score += 2.0; ff.push({ text: 'Фолат при гомоцистеине', impact: 2.0, icon: '✅' }); }
  }
  // Liver
  if ((L.alt ?? 0) > 45 || (L.ast ?? 0) > 35 || (L.bilirubin_total ?? 0) > 20) {
    if (detox === 'HIGH') score += 2.0;
    if ((f.gastro_tags?.enzyme_demand_score ?? 3) > 7) score -= 3.0;
    if (getMicro(f, 'SatFat') > 10) score -= 2.5;
  }
  // Uric acid
  if ((L.uric_acid ?? 0) > 450) {
    if (animalP > 20) score -= 3.0;
    if (category === 'veg_fruit' && f.fiber > 2) score += 1.0;
  }
  // GFR
  if ((L.gfr ?? 999) < 60) {
    if (protein > 20 && animalP > 15) score -= 4.0;
    if (pral > 5) score -= 2.5;
  }
  // HOMA-IR
  const hir = L.homa_ir ?? ((L.glucose_fasting ?? 0) > 0 && (L.insulin_fasting ?? 0) > 0 ? (L.glucose_fasting! * L.insulin_fasting!) / 22.5 : 0);
  if (hir > 2.5 || (L.glucose_fasting ?? 0) > 6 || (L.insulin_fasting ?? 0) > 15) {
    if (insSens === 'NEGATIVE') { score -= 4.0; ff.push({ text: 'Инсулин-сенс NEG при IR', impact: -4.0, icon: '🚨' }); }
    if (sugar > 10) score -= 3.0;
    if (fiber > 5) score += 1.5;
    if (chromium > 50 || ala > 5 || berberine > 5) { score += 2.0; ff.push({ text: 'Инсулин-сенситайзеры при IR', impact: 2.0, icon: '✅' }); }
  }
  // Thyroid
  if ((L.tsh ?? 0) > 4) {
    if (iodine < 50 || selenium < 20) score -= 2.0;
    if (thyroid === 'HIGH') score += 1.5;
  }

  return { score, factors: ff };
}

// ═══════════════════════════════════════════════════════════════════
// 6. STEP 4: TIMING MODIFIERS
// ═══════════════════════════════════════════════════════════════════

function applyTimingModifiers(score: number, f: FoodItem, p: UserDietProfile, timing?: MealTiming): { score: number; factors: FactorDetail[] } {
  const ff: FactorDetail[] = [];
  const cns = f.metabolic_flags?.cns_impact ?? 'NEUTRAL';
  const insulinIdx = f.macro_100g?.insulin_index ?? 75;
  const leucine = f.amino_acid_profile_100g?.leucine_mg ?? 0;
  const tryptophan = f.amino_acid_profile_100g?.tryptophan_mg ?? 0;
  const detox = f.metabolic_flags?.detox_support_level ?? 'LOW';
  const enzyme = f.gastro_tags?.enzyme_demand_score ?? 3;
  const lignans = f.bioactive_compounds_100g?.lignan_mg ?? 0;
  const i3c = f.bioactive_compounds_100g?.indol_3_carbinol_mg ?? 0;
  const carbs = f.carbs;
  const gi = f.gi;
  const anabolic = f.metabolic_flags?.anabolic_potential ?? 'LOW';

  if (!timing || timing === 'regular') {
    if (cns === 'STIMULANT' && p.pharma.STIMULATORS) { score -= 2.0; ff.push({ text: 'Стимуляция ЦНС без необходимости', impact: -2.0, icon: '⚠️' }); }
    return { score, factors: ff };
  }

  switch (timing) {
    case 'before_bed':
      if (leucine > 1500 && insulinIdx < 50) { score += 3.0; ff.push({ text: 'Лейцин + низкий ИИ перед сном', impact: 3.0, icon: '✅' }); }
      if (insulinIdx > 80) { score -= 4.0; ff.push({ text: 'Высокий ИИ перед сном', impact: -4.0, icon: '🚨' }); }
      if (tryptophan > 200) { score += 2.0; ff.push({ text: 'Триптофан перед сном', impact: 2.0, icon: '✅' }); }
      break;
    case 'post_workout':
      if (anabolic === 'HIGH') { score += 1.0; ff.push({ text: 'Анаболический стимул после тренировки', impact: 1.0, icon: '✅' }); }
      break;
    case 'detox':
      if (detox === 'HIGH') { score += 2.0; ff.push({ text: 'Детокс-усиление', impact: 2.0, icon: '✅' }); }
      if (enzyme > 5) { score -= 1.5; ff.push({ text: 'Высокая ферментная нагрузка на детоксе', impact: -1.5, icon: '⚠️' }); }
      break;
    case 'carb_load':
      if (p.phase === 'PEAK_WEEK' && carbs < 50 && gi < 70) { score -= 3.0; ff.push({ text: 'Мало углеводов для загрузки', impact: -3.0, icon: '🚨' }); }
      if (f.id === 'amylopectin' || f.id === 'dextrose') { score += 2.0; ff.push({ text: 'Амилопектин/декстроза для загрузки', impact: 2.0, icon: '✅' }); }
      break;
  }

  // Post-cycle + lignans
  if ((p.phase === 'POST_CYCLE' || p.phase === 'MOST') && lignans > 100) { score -= 3.0; ff.push({ text: 'Лигнаны повышают ГСПГ', impact: -3.0, icon: '🚨' }); }
  if ((p.phase === 'POST_CYCLE' || p.phase === 'MOST') && i3c > 50) { score += 3.0; ff.push({ text: 'Индол-3-карбинол снижает ГСПГ', impact: 3.0, icon: '✅' }); }

  return { score, factors: ff };
}

// ═══════════════════════════════════════════════════════════════════
// 7. MAIN: CALCULATE OVERALL SCORE
// ═══════════════════════════════════════════════════════════════════

export function calculateOverallScore(
  product: FoodItem,
  profile: UserDietProfile,
  timing?: MealTiming,
): V2ScoreResult {
  const bbScore = product.bb_quality_score ?? calcBBQualityScore(product);
  let score = bbScore;

  const r1 = applyPhaseModifiers(score, product, profile);
  score = r1.score;
  const r2 = applyPharmaModifiers(score, product, profile);
  score = r2.score;
  const r3 = applyLabModifiers(score, product, profile);
  score = r3.score;
  const r4 = applyTimingModifiers(score, product, profile, timing);
  score = r4.score;

  score = clamp(score, 1.0, 10.0);
  score = Math.round(score * 10) / 10;

  const allFactors = [...r1.factors, ...r2.factors, ...r3.factors, ...r4.factors];
  const label = labelScore(score);

  return {
    total: score,
    bbScore,
    phaseMod: r1.score - bbScore,
    pharmaMod: r2.score - r1.score,
    labMod: r3.score - r2.score,
    timingMod: r4.score - r3.score,
    label: label.label,
    color: label.color,
    factors: allFactors,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 8. SCORE ALL PRODUCTS + COMPARE
// ═══════════════════════════════════════════════════════════════════

export function scoreAllProductsV2(
  profile: UserDietProfile,
  category?: FoodItem['category'],
  timing?: MealTiming,
): { food: FoodItem; score: V2ScoreResult }[] {
  let foods = FOOD_DB;
  if (category) foods = foods.filter(f => f.category === category);
  return foods
    .map(food => {
      try {
        return { food, score: calculateOverallScore(food, profile, timing) };
      } catch {
        return { food, score: { total: 0, bbScore: 0, phaseMod: 0, pharmaMod: 0, labMod: 0, timingMod: 0, label: 'Ошибка', color: '#666', factors: [] } };
      }
    })
    .sort((a, b) => b.score.total - a.score.total);
}

export function compareProductsV2(ids: string[], profile: UserDietProfile): { food: FoodItem; score: V2ScoreResult }[] {
  return ids
    .map(id => FOOD_DB.find(f => f.id === id))
    .filter((f): f is FoodItem => !!f)
    .map(food => ({ food, score: calculateOverallScore(food, profile) }))
    .sort((a, b) => b.score.total - a.score.total);
}

// ═══════════════════════════════════════════════════════════════════
// 9. MEAL SCORE V2
// ═══════════════════════════════════════════════════════════════════

export function calcMealScoreV2(
  products: { foodId: string; weightGrams: number }[],
  profile: UserDietProfile,
  timing?: MealTiming,
): MealScoreV2 {
  const entries = products
    .map(p => {
      const food = FOOD_DB.find(f => f.id === p.foodId);
      if (!food) return null;
      const score = calculateOverallScore(food, profile, timing);
      return { food, score, weightG: p.weightGrams };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

  if (entries.length === 0) {
    return { compositeScore: 0, maxPossible: 10, productScores: [], weakLinks: [], macros: { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 }, modifiers: [], label: 'Нет данных', color: '#666' };
  }

  const totalW = entries.reduce((s, e) => s + e.weightG, 0);
  const composite = entries.reduce((s, e) => s + e.score.total * e.weightG, 0) / totalW;

  // Macros
  const macros = entries.reduce((acc, e) => {
    const r = e.weightG / 100;
    acc.kcal += e.food.kcal * r;
    acc.protein += e.food.protein * r;
    acc.fat += e.food.fat * r;
    acc.carbs += e.food.carbs * r;
    acc.fiber += e.food.fiber * r;
    return acc;
  }, { kcal: 0, protein: 0, fat: 0, carbs: 0, fiber: 0 });

  // Modifiers for the meal
  const modifiers: { name: string; value: number }[] = [];
  const leucineTotal = entries.reduce((s, e) => s + (e.food.amino_acid_profile_100g?.leucine_mg ?? 0) * e.weightG / 100, 0);
  if (leucineTotal >= 3000) modifiers.push({ name: 'Лейциновый триггер (mTOR)', value: 1.5 });
  const avgEnzyme = entries.reduce((s, e) => s + (e.food.gastro_tags?.enzyme_demand_score ?? 3) * e.weightG, 0) / totalW;
  if (avgEnzyme > 7) modifiers.push({ name: 'Высокая ферментная нагрузка', value: -2.0 });
  const kna = entries.reduce((s, e) => { const _k = getMicro(e.food, 'K') || 200; const _na = getMicro(e.food, 'Na') || 100; return s + (_k / Math.max(_na, 1)) * e.weightG; }, 0) / totalW;
  if ((profile.labs.estradiol ?? 0) > 180 && kna < 2) modifiers.push({ name: 'Эстрадиоловый отёк', value: -2.5 });
  const hasHighAthero = entries.some(e => e.food.metabolic_flags?.atherogenic_potential === 'HIGH');
  if ((profile.pharma.AAS_ORAL || (profile.labs.ldl ?? 0) > 4.2) && hasHighAthero) modifiers.push({ name: 'Липидный/ААС конфликт', value: -3.5 });
  const avgSugar = entries.reduce((s, e) => s + (e.food.macro_100g?.carbs_sugar ?? 0) * e.weightG, 0) / totalW;
  if (avgSugar > 15) modifiers.push({ name: 'Высокий сахар', value: -2.0 });
  const avgFiber = entries.reduce((s, e) => s + e.food.fiber * e.weightG, 0) / totalW;
  if (avgFiber < 2) modifiers.push({ name: 'Дефицит клетчатки', value: -1.0 });
  const hasNegInsSens = entries.some(e => e.food.metabolic_flags?.insulin_sensitivity_impact === 'NEGATIVE');
  if (hasNegInsSens) modifiers.push({ name: 'Инсулиновый стресс', value: -2.0 });

  const modSum = modifiers.reduce((s, m) => s + m.value, 0);
  const compositeScore = clamp(composite + modSum, 1.0, 10.0);
  const R = parseFloat(compositeScore.toFixed(1));
  const label = labelScore(R);

  const productScores = entries.map(e => ({
    id: e.food.id,
    name: e.food.name,
    score: e.score.total,
    weightG: e.weightG,
    contribution: totalW > 0 ? e.score.total * e.weightG / totalW : 0,
  }));

  const avgScore = productScores.reduce((s, p) => s + p.score, 0) / productScores.length;
  const weakLinks = productScores
    .filter(p => p.score <= Math.max(3, avgScore - 1.2))
    .map(p => p.name);

  return {
    compositeScore: R,
    maxPossible: 10,
    productScores,
    weakLinks,
    macros: {
      kcal: Math.round(macros.kcal),
      protein: Math.round(macros.protein),
      fat: Math.round(macros.fat),
      carbs: Math.round(macros.carbs),
      fiber: Math.round(macros.fiber),
    },
    modifiers,
    label: label.label,
    color: label.color,
  };
}

// ═══════════════════════════════════════════════════════════════════
// 11. DIAAS: AMINO ACID SCORE
// ═══════════════════════════════════════════════════════════════════

/** FAO/WHO reference amino acid pattern (mg/g protein) for adults */
const FAO_WHO_REF: Record<string, number> = {
  histidine: 15, isoleucine: 30, leucine: 59, lysine: 45,
  methionine_cystine: 22, // SAA
  phenylalanine_tyrosine: 38, // AAA
  threonine: 23, tryptophan: 6, valine: 39,
};

/** Digestibility coefficients by food category */
const DIGEST: Record<string, number> = {
  protein: 0.95, dairy: 0.97, egg: 0.97, fish: 0.94,
  grain: 0.85, legume: 0.82, nut: 0.88, vegetable: 0.82,
  fruit: 0.85, other: 0.85,
};

export function calcDIAAS(f: FoodItem): { diaas: number; limitingAA: string; score: number } {
  const a = f.amino_acid_profile_100g;
  if (!a || f.protein === 0) return { diaas: 0, limitingAA: '—', score: 0 };

  const protG = f.protein;
  const ratios: Record<string, number> = {
    histidine: ((a.histidine_mg ?? 0) / protG) / FAO_WHO_REF.histidine,
    isoleucine: ((a.isoleucine_mg ?? 0) / protG) / FAO_WHO_REF.isoleucine,
    leucine: ((a.leucine_mg ?? 0) / protG) / FAO_WHO_REF.leucine,
    lysine: ((a.lysine_mg ?? 0) / protG) / FAO_WHO_REF.lysine,
    methionine_cystine: (((a.methionine_mg ?? 0) + (a.cysteine_mg ?? 0)) / protG) / FAO_WHO_REF.methionine_cystine,
    phenylalanine_tyrosine: (((a.phenylalanine_mg ?? 0) + (a.phenylalanine_mg ?? 0) * 0.5) / protG) / FAO_WHO_REF.phenylalanine_tyrosine,
    threonine: ((a.threonine_mg ?? 0) / protG) / FAO_WHO_REF.threonine,
    tryptophan: ((a.tryptophan_mg ?? 0) / protG) / FAO_WHO_REF.tryptophan,
    valine: ((a.valine_mg ?? 0) / protG) / FAO_WHO_REF.valine,
  };

  const limiting = Object.entries(ratios).reduce((min, curr) => curr[1] < min[1] ? curr : min);
  const coefficient = DIGEST[f.category] ?? 0.85;
  const diaas = Math.min(limiting[1] * coefficient, 1.5);

  return {
    diaas: Math.round(diaas * 100) / 100,
    limitingAA: limiting[0],
    score: diaas >= 1.0 ? 1.5 : diaas < 0.75 ? -2.0 : 0,
  };
}

export function calcMealDIAAS(products: { foodId: string; weightGrams: number }[]): { diaas: number; limitingAA: string } {
  const entries = products.map(p => ({ f: FOOD_DB.find(x => x.id === p.foodId), w: p.weightGrams })).filter(e => e.f);
  const totalW = entries.reduce((s, e) => s + e.w, 0);
  if (totalW === 0) return { diaas: 0, limitingAA: '—' };

  // Sum amino acids weighted by weight
  const sum = { histidine: 0, isoleucine: 0, leucine: 0, lysine: 0, methionine: 0, cysteine: 0,
    phenylalanine: 0, tyrosine: 0, threonine: 0, tryptophan: 0, valine: 0, protein: 0 };
  for (const e of entries) {
    const a = e.f!.amino_acid_profile_100g;
    const w = e.w / 100;
    if (a) {
      sum.histidine += (a.histidine_mg ?? 0) * w; sum.isoleucine += (a.isoleucine_mg ?? 0) * w;
      sum.leucine += (a.leucine_mg ?? 0) * w; sum.lysine += (a.lysine_mg ?? 0) * w;
      sum.methionine += (a.methionine_mg ?? 0) * w; sum.cysteine += (a.cysteine_mg ?? 0) * w;
      sum.phenylalanine += (a.phenylalanine_mg ?? 0) * w; sum.tyrosine += (a.phenylalanine_mg ?? 0) * 0.5 * w;
      sum.threonine += (a.threonine_mg ?? 0) * w; sum.tryptophan += (a.tryptophan_mg ?? 0) * w;
      sum.valine += (a.valine_mg ?? 0) * w;
    }
    sum.protein += e.f!.protein * w;
  }

  if (sum.protein === 0) return { diaas: 0, limitingAA: '—' };

  const ref = FAO_WHO_REF;
  const ratios: Record<string, number> = {
    histidine: (sum.histidine / sum.protein) / ref.histidine,
    isoleucine: (sum.isoleucine / sum.protein) / ref.isoleucine,
    leucine: (sum.leucine / sum.protein) / ref.leucine,
    lysine: (sum.lysine / sum.protein) / ref.lysine,
    methionine_cystine: ((sum.methionine + sum.cysteine) / sum.protein) / ref.methionine_cystine,
    threonine: (sum.threonine / sum.protein) / ref.threonine,
    tryptophan: (sum.tryptophan / sum.protein) / ref.tryptophan,
    valine: (sum.valine / sum.protein) / ref.valine,
  };

  const limiting = Object.entries(ratios).reduce((min, curr) => curr[1] < min[1] ? curr : min);
  const avgCoef = entries.reduce((s, e) => s + (DIGEST[e.f!.category] ?? 0.85) * e.w, 0) / totalW;
  const diaas = Math.min(limiting[1] * avgCoef, 1.5);
  return { diaas: Math.round(diaas * 100) / 100, limitingAA: limiting[0] };
}
// ═══════════════════════════════════════════════════════════════════

export function analyzeDailyDiet(
  meals: { timing?: MealTiming; products: { foodId: string; weightGrams: number }[] }[],
  profile: UserDietProfile,
): DailyDietReport {
  const allProducts = meals.flatMap(m => m.products.map(p => ({ ...p, timing: m.timing })));
  const totalW = allProducts.reduce((s, p) => s + p.weightGrams, 0);

  // Helper: total of a field
  const sumF = (fn: (f: FoodItem) => number) => allProducts.reduce((s, p) => {
    const f = FOOD_DB.find(x => x.id === p.foodId);
    return s + (f ? fn(f) * p.weightGrams / 100 : 0);
  }, 0);

  // Macros
  const kcal = sumF(f => f.kcal);
  const protein = sumF(f => f.protein);

  // mTOR
  const totalLeucine = sumF(f => f.amino_acid_profile_100g?.leucine_mg ?? f.protein * 42);
  const mtorTriggered = totalLeucine >= 3000;
  const mtorDeficitMg = Math.max(0, 3000 - totalLeucine);

  // Glycemic load: available carbs multiplied by GI. Products without GI do not add GL.
  const giLoad = sumF(f => {
    const gi = f.gi || 0;
    if (gi <= 0) return 0;
    const availableCarbs = Math.max(0, (f.carbs || 0) - (f.fiber || 0));
    return availableCarbs * gi / 100;
  });
  const giLoadThreshold = (profile.pharma.HGH || profile.pharma.INSULIN_USE || (profile.labs.homa_ir ?? 0) > 2.5) ? 80 : 120;
  const giLoadWarning = giLoad > giLoadThreshold;

  // Cortisol
  const postMeal = meals.find(m => m.timing === 'post_workout');
  const cortisolRisk = postMeal ? sumF(f => f.carbs * (f.gi > 60 ? 1 : 0)) < profile.weightKg * 0.5 : false;

  // Ammonia
  const fiber = sumF(f => f.fiber);
  const lbm = profile.lbm;
  const ammoniaThreshold = 2.5;
  const ammoniaScore = lbm > 0 ? protein / lbm : 0;
  const fiberThreshold = profile.pharma.FIBER_SUPPLEMENT ? 16 : 20;
  const ammoniaRisk = ammoniaScore > ammoniaThreshold && fiber < fiberThreshold;

  // Electrolytes
  const potassiumMg = sumF(f => getMicro(f, 'K'));
  const magnesiumMg = sumF(f => getMicro(f, 'Mg'));
  const electrolyteRisk = profile.pharma.DIURETICS && (potassiumMg < 3500 || magnesiumMg < 400);

  // Insulin ricochet
  const intraMeal = meals.find(m => m.timing === 'intra_workout');
  const insulinRicohet = intraMeal && (profile.pharma.HGH || profile.pharma.INSULIN_USE)
    ? (sumF(f => f.carbs) > profile.weightKg && !intraMeal.products.some(p => p.foodId === 'amylopectin'))
    : false;

  // PRAL
  const pralTotal = sumF(f => f.electrolytes_100g?.pral_index ?? 0);
  const pralWarning = pralTotal > 10 ? 'Закисление' : pralTotal < -10 ? 'Защелачивание' : null;

  // Omega
  const o3 = sumF(f => getMicro(f, 'Omega3'));
  const o6 = sumF(f => f.macro_100g?.omega_6_mg ?? 0);
  const omegaRatio = o3 > 0 ? o6 / o3 : 30;
  const omegaThreshold = profile.pharma.OMEGA3_SUPPLEMENT ? 8 : 5;
  const omegaWarning = omegaRatio > omegaThreshold ? `Омега-6/Омега-3: ${omegaRatio.toFixed(1)}:1 (норма <${omegaThreshold}:1)` : null;

  // Micro deficits (simplified)
  const microDeficits: string[] = [];
  const zincTotal = sumF(f => getMicro(f, 'Zn'));
  if (zincTotal < 8 && !profile.pharma.VIT_MIN_SUPPLEMENT) microDeficits.push('Цинк');
  const magTotal = sumF(f => getMicro(f, 'Mg'));
  if (magTotal < 300 && !profile.pharma.VIT_MIN_SUPPLEMENT) microDeficits.push('Магний');

  // HOMA-IR
  const l = profile.labs;
  const homaIr = (l.glucose_fasting ?? 0) > 0 && (l.insulin_fasting ?? 0) > 0
    ? l.glucose_fasting! * l.insulin_fasting! / 22.5
    : null;

  // ── Phase 2: DIAAS ──
  const allFoods = allProducts.map(p => { const f = FOOD_DB.find(x => x.id === p.foodId); return f ? { f, w: p.weightGrams } : null; }).filter(Boolean) as { f: FoodItem; w: number }[];
  const totalProtein = allFoods.reduce((s, e) => s + e.f.protein * e.w / 100, 0);
  let diaas = 0;
  let diaasLimitingAA = '—';
  let diaasWarning: string | null = null;
  if (totalProtein > 0 && allFoods.length > 0) {
    const mealDiaas = calcMealDIAAS(allProducts.map(p => ({ foodId: p.foodId, weightGrams: p.weightGrams })));
    diaas = mealDiaas.diaas;
    diaasLimitingAA = mealDiaas.limitingAA;
    if (diaas < 0.75) diaasWarning = `Низкий DIAAS (${diaas.toFixed(2)}) — неполноценный белок. Лимитирующая АК: ${diaasLimitingAA}`;
    else if (diaas >= 1.0) diaasWarning = `✅ Полноценный белок (DIAAS ${diaas.toFixed(2)})`;
    else diaasWarning = `DIAAS ${diaas.toFixed(2)} — допустимо, лимитирует ${diaasLimitingAA}`;
  }

  // ── Phase 2: Antinutrients ──
  const totalLectins = sumF(f => f.specific_compounds_100g?.lectins_mg ?? 0);
  const totalOxalates = sumF(f => f.specific_compounds_100g?.oxalates_mg ?? 0);
  const antinutrientThreshold = 500;
  let antinutrientWarning: string | null = null;
  if (totalLectins > antinutrientThreshold || totalOxalates > antinutrientThreshold) {
    const parts: string[] = [];
    if (totalLectins > antinutrientThreshold) parts.push(`лектины ${Math.round(totalLectins)}мг`);
    if (totalOxalates > antinutrientThreshold) parts.push(`оксалаты ${Math.round(totalOxalates)}мг`);
    antinutrientWarning = `⚠️ Повышены антинутриенты: ${parts.join(', ')}. Замачивание/термическая обработка бобовых`;
  }

  // ── Phase 2: Glutathione status ──
  const totalCysteine = sumF(f => f.amino_acid_profile_100g?.cysteine_mg ?? 0);
  const totalSelenium = sumF(f => getMicro(f, 'Se'));
  const totalVitC = sumF(f => getMicro(f, 'VitC'));
  const totalB2 = sumF(f => getMicro(f, 'VitB2'));
  const totalB3 = sumF(f => getMicro(f, 'VitB3'));
  let glutathioneWarning: string | null = null;
  if (!profile.pharma.DETOX_SUPPORT && (totalCysteine < 500 || totalSelenium < 50 || totalVitC < 50 || totalB2 < 1 || totalB3 < 10)) {
    const deficits: string[] = [];
    if (totalCysteine < 500) deficits.push('цистеин');
    if (totalSelenium < 50) deficits.push('селен');
    if (totalVitC < 50) deficits.push('вит. C');
    if (totalB2 < 1) deficits.push('B2');
    if (totalB3 < 10) deficits.push('B3');
    glutathioneWarning = `⚠️ Низкая поддержка глутатиона: ${deficits.join(', ')}. Добавьте яйца, бразильские орехи, крестоцветные`;
  }

  // ── Phase 2: Histamine control ──
  let histamineWarning: string | null = null;
  if (profile.histamineSensitive) {
    const histamineLevels = allFoods.map(e => e.f.metabolic_flags?.histamine_level ?? 'LOW');
    const hasHighHistamine = histamineLevels.some(h => h === 'HIGH');
    const highHistamineCount = histamineLevels.filter(h => h === 'HIGH' || h === 'MEDIUM').length;
    if (hasHighHistamine) histamineWarning = `🚨 Высокий гистамин! ${highHistamineCount} продуктов с высоким/средним содержанием. Исключите ферментированные/выдержанные продукты`;
    else if (highHistamineCount >= 3) histamineWarning = `⚠️ ${highHistamineCount} продукта со средним гистамином — возможно накопление`;
  }

  return {
    date: new Date().toISOString().slice(0, 10),
    totalKcal: Math.round(kcal),
    mtorTriggered,
    mtorDeficitMg: Math.round(mtorDeficitMg),
    giLoad: Math.round(giLoad),
    giLoadWarning,
    cortisolRisk,
    ammoniaRisk,
    ammoniaScore: Math.round(ammoniaScore * 10) / 10,
    electrolyteRisk,
    potassiumMg: Math.round(potassiumMg),
    magnesiumMg: Math.round(magnesiumMg),
    insulinRicohet,
    pralTotal: Math.round(pralTotal),
    pralWarning,
    omegaRatio: Math.round(omegaRatio * 10) / 10,
    omegaWarning,
    microDeficits,
    homaIr: homaIr ? Math.round(homaIr * 10) / 10 : null,
    diaas: Math.round(diaas * 100) / 100,
    diaasLimitingAA,
    diaasWarning,
    antinutrientWarning,
    glutathioneWarning,
    histamineWarning,
    histamineSensitive: profile.histamineSensitive,
  };
}
