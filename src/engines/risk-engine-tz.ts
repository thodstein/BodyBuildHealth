// ============================================================
// risk-engine-tz.ts — TZ-Compliant Risk Engine
// 7 систем × 7 механизмов = 49 ячеек
// Вероятностная модель: Risk_{s,m} = 1 − ∏_i(1 − baseRisk × D_i × G × L × N × T)
// D_i = min(2.0, (dose/threshold)^γ), γ=1.2
// L = (value/ULN)^β × (1 + α × trend), missing lab = 1.5×
// SystemRisk = exp((1/7) × Σ ln(Risk_m))
// OverallRisk = exp((1/7) × Σ ln(SystemRisk_s))
// ============================================================

import {
  DRUG_THRESHOLDS_V7,
  LAB_REFERENCES,
  getGeneticMultiplier,
  MECHANISM_NAMES,
  SYSTEM_NAMES_RU,
  CORE_SYSTEMS_V7,
  SUBSYSTEM_PARENT_V7,
  type GeneticProfile,
} from './risk-engine-v7-matrix';
import type { CourseEntry, LabPoint } from '../core/types';
import { PHARMA_DB } from '../core/pharma-database';
import { PD_SYSTEM_MAP } from '../core/risk-shared';
import { SUPPORT_COVERAGE_MAP } from '../data/support-coverage-map';

// ─── Types ───

export interface TZRiskInput {
  course: CourseEntry[];
  labs: LabPoint[];
  genetics: GeneticProfile;
  nutrition: TZNutritionInput;
  training: TZTrainingInput;
  weight: number;
  age: number;
  sex: 'male' | 'female';
  supportSubstances: string[];
  courseWeek?: number; // 0+  — week of course for accumulation calculation
}

export interface TZNutritionInput {
  proteinPerKg: number;
  fiberG: number;
  omega3G: number;
  sodiumG: number;
  potassiumG: number;
  waterL: number;
  calories: number;
}

export interface TZTrainingInput {
  hasHIIT: boolean;
  weeklyMinutes: number;
  volumeTonnes: number;
  lissMinutesPerWeek: number;
}

export interface TZMechanismCell {
  raw: number;
  net: number;
  baseRisk: number;
  drugFactor: number;
  geneticMult: number;
  labFactor: number;
  nutritionFactor: number;
  trainingFactor: number;
  supportFactor: number;
  contributingDrugs: string[];
}

export interface TZSystemRisk {
  raw: number;
  net: number;
  mechanisms: Record<number, TZMechanismCell>;
}

export interface TZRiskResult {
  overallRaw: number;
  overallNet: number;
  systems: Record<string, TZSystemRisk>;
  drugDoseFactors: Record<string, number>;
  geneticProfile: GeneticProfile;
  labMultipliers: Record<string, Record<number, number>>;
}

// ─── Base Risk Values per System per Mechanism ───

// ─── Base Risk Values per System per Mechanism ───
// Calibrated to produce 70-90% raw risk for typical AAS cycles

const BASE_RISK: Record<string, Record<number, number>> = {
  cardio: { 1: 0.35, 2: 0.35, 3: 0.25, 4: 0.30, 5: 0.20, 6: 0.18, 7: 0.28 },
  hepatic: { 1: 0.30, 2: 0.35, 3: 0.25, 4: 0.22, 5: 0.18, 6: 0.25, 7: 0.30 },
  renal: { 1: 0.25, 2: 0.22, 3: 0.22, 4: 0.18, 5: 0.15, 6: 0.12, 7: 0.22 },
  neuro: { 1: 0.28, 2: 0.22, 3: 0.22, 4: 0.20, 5: 0.20, 6: 0.15, 7: 0.22 },
  endocrine: { 1: 0.45, 2: 0.35, 3: 0.22, 4: 0.20, 5: 0.15, 6: 0.20, 7: 0.22 },
  hematologic: { 1: 0.35, 2: 0.22, 3: 0.15, 4: 0.25, 5: 0.15, 6: 0.22, 7: 0.15 },
  reproductive: { 1: 0.40, 2: 0.35, 3: 0.22, 4: 0.20, 5: 0.22, 6: 0.15, 7: 0.22 },
};

// Systems used for OverallRisk aggregation (musculoskeletal excluded — anabolic effect, not risk)
const OVERALL_SYSTEMS = ['cardio', 'hepatic', 'renal', 'neuro', 'endocrine', 'hematologic', 'reproductive'];

// Mechanism weights for geometric mean
const MECH_WEIGHTS: Record<string, Record<number, number>> = {
  cardio: { 1: 1.0, 2: 1.5, 3: 1.2, 4: 1.0, 5: 0.8, 6: 0.6, 7: 0.8 },
  hepatic: { 1: 1.2, 2: 1.5, 3: 1.0, 4: 0.8, 5: 0.8, 6: 1.0, 7: 1.2 },
  renal: { 1: 1.3, 2: 1.0, 3: 1.0, 4: 0.8, 5: 0.6, 6: 0.5, 7: 0.8 },
  neuro: { 1: 1.5, 2: 1.0, 3: 1.0, 4: 0.8, 5: 0.8, 6: 0.5, 7: 1.0 },
  endocrine: { 1: 2.0, 2: 1.5, 3: 1.0, 4: 0.8, 5: 0.6, 6: 0.8, 7: 1.0 },
  hematologic: { 1: 1.5, 2: 0.8, 3: 0.6, 4: 1.2, 5: 0.6, 6: 0.8, 7: 0.6 },
  reproductive: { 1: 1.5, 2: 1.3, 3: 1.0, 4: 0.8, 5: 0.8, 6: 0.6, 7: 1.0 },
};

// ─── Lab Marker to System × Mechanism Map ───

const LAB_MECH_MAP: Record<string, Record<number, string[]>> = {
  cardio: { 1: ['LDL', 'TRIGLYCERIDES'], 2: ['SBP', 'DBP'], 3: ['TOTAL_TESTOSTERONE', 'HGB'], 4: ['HCT', 'FIBRINOGEN'], 5: ['CRP', 'HOMOCYSTEINE'], 6: ['TROPONIN'], 7: ['POTASSIUM', 'MAGNESIUM'] },
  hepatic: { 1: ['GGT', 'ALP'], 2: ['ALT', 'AST'], 3: ['MDA', 'GSH'], 4: ['ALT', 'AST'], 5: ['PLT', 'BILIRUBIN_TOTAL'], 6: ['CORTISOL'], 7: ['ALT', 'AST', 'BILIRUBIN_TOTAL'] },
  renal: { 1: ['CREATININE', 'EGFR'], 2: ['CREATININE'], 3: ['URINE_PROTEIN'], 4: ['POTASSIUM', 'SODIUM'], 5: ['CREATININE', 'URIC_ACID'], 6: ['CALCIUM', 'URIC_ACID'], 7: ['CREATININE', 'BUN'] },
  neuro: { 1: ['PROLACTIN'], 2: ['GLUTAMATE'], 3: ['GABA'], 4: ['CRP', 'TNF_ALPHA'], 5: ['GSH', 'SOD'], 6: ['ALBUMIN'], 7: ['SEROTONIN'] },
  endocrine: { 1: ['LH', 'FSH', 'TOTAL_TESTOSTERONE'], 2: ['ESTRADIOL'], 3: ['PROLACTIN'], 4: ['GLUCOSE', 'HOMA_IR'], 5: ['TSH', 'FT4', 'FT3'], 6: ['CORTISOL'], 7: ['SHBG'] },
  hematologic: { 1: ['HGB', 'HCT', 'RBC'], 2: ['PLT'], 3: ['WBC'], 4: ['FIBRINOGEN', 'D_DIMER'], 5: ['IRON', 'FERRITIN'], 6: ['FIBRINOGEN', 'D_DIMER'], 7: ['HAPTOGLOBIN', 'LDH'] },
  reproductive: { 1: ['LH', 'FSH', 'TOTAL_TESTOSTERONE'], 2: ['SPERM_COUNT'], 3: ['SPERM_MORPH'], 4: ['SPERM_MOTIL'], 5: ['PSA'], 6: ['PSA'], 7: ['TOTAL_TESTOSTERONE', 'ESTRADIOL', 'PROLACTIN'] },
};

// ─── Drug Dose Factor: D_i = min(2.0, (dose/threshold)^γ) × accumulation ───

function computeDrugDoseFactor(substanceId: string, dosePerWeek: number, courseWeek: number): number {
  const GAMMA = 1.2;
  const threshold = DRUG_THRESHOLDS_V7[substanceId];
  if (!threshold || !threshold.dosePerWeek) return 1.0;
  const ratio = dosePerWeek / threshold.dosePerWeek;
  let doseF = Math.min(2.0, Math.pow(ratio, GAMMA));

  // Steady-state accumulation (capped)
  const ph = PHARMA_DB[substanceId] as any;
  const halfLifeDays = ph?.pk?.halfLifeHours ? ph.pk.halfLifeHours / 24 : 7;
  const dosesPerHalfLife = halfLifeDays <= 0 ? 1 : Math.min(4, halfLifeDays / 1.5);
  const accumFactor = Math.min(1.5, 1 + 0.08 * dosesPerHalfLife);

  return doseF * accumFactor;
}

// ─── Compute Drug Contribution per Mechanism ───

function getDrugContribution(substanceId: string, system: string, mechIdx: number): number {
  const threshold = DRUG_THRESHOLDS_V7[substanceId];
  if (!threshold || !threshold.systems) return 0;

  // 1. Explicit mapping exists → use it directly
  if (threshold.systems[system] && threshold.systems[system][mechIdx] !== undefined) {
    return threshold.systems[system][mechIdx];
  }

  // 2. Drug has SOME mapping for this system (other mechanisms) → distribute remaining power
  if (threshold.systems[system]) {
    // Drug targets this system — distribute a residual effect across unmapped mechanisms
    // proportional to their base risk weight
    const baseRisks = BASE_RISK[system] ?? {};
    const totalBaseRisk = Object.values(baseRisks).reduce((a: number, b: number) => a + b, 0) || 1;
    const thisBaseRisk = baseRisks[mechIdx] ?? 0.02;
    // Each unmapped mechanism gets a fraction of 15% total residual, scaled by base risk
    return (thisBaseRisk / totalBaseRisk) * 0.15;
  }

  // 3. PD_SYSTEM_MAP fallback for drugs NOT in DRUG_THRESHOLDS_V7 systems
  const pdMapping = PD_SYSTEM_MAP[system];
  if (pdMapping) {
    const ph = PHARMA_DB[substanceId] as any;
    if (ph?.pd) {
      const pdVal = ph.pd[pdMapping.pdKey as keyof typeof ph.pd] as number;
      if (pdVal !== undefined && pdVal !== 0) {
        const totalPd = Math.abs(pdVal) * pdMapping.weight * 0.3;
        // Distribute across all 7 mechanisms proportional to base risk
        const baseRisks = BASE_RISK[system] ?? {};
        const totalBaseRisk = Object.values(baseRisks).reduce((a: number, b: number) => a + b, 0) || 1;
        const thisBaseRisk = baseRisks[mechIdx] ?? 0.02;
        return totalPd * (thisBaseRisk / totalBaseRisk) * 0.5;
      }
    }
  }

  return 0;
}

// ─── Lab Factor: L = (value/ULN)^β × (1 + α × trend) ───

function computeLabFactor(labs: LabPoint[], system: string, mechIdx: number): { factor: number; markersFound: number; markersTotal: number } {
  const labNames = LAB_MECH_MAP[system]?.[mechIdx];
  if (!labNames || !labNames.length) return { factor: 1.0, markersFound: 0, markersTotal: 0 };

  let factorProduct = 1.0;
  let foundCount = 0;
  const totalCount = labNames.length;

  for (const labName of labNames) {
    const ref = LAB_REFERENCES[labName];
    if (!ref) continue;
    const points = labs.filter(l => l.code === labName || l.name === labName);
    if (!points.length) continue;
    foundCount++;
    const value = points[points.length - 1].value;

    // ULN-based formula: labFactor = (value/ULN)^β × (1 + α × growthRate)
    const ratio = value / Math.max(0.01, ref.uln);
    const beta = ref.sensitive ? 1.5 : 1.0;
    const alpha = ref.alpha;

    let growthRate = 0;
    if (points.length >= 2) {
      const sorted = [...points].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const last = sorted[sorted.length - 1].value;
      const prev = sorted[sorted.length - 2].value;
      const timeDiff = Math.max(1, (new Date(sorted[sorted.length - 1].date).getTime() - new Date(sorted[sorted.length - 2].date).getTime()) / (30.44 * 24 * 3600 * 1000));
      growthRate = (last - prev) / Math.max(0.01, ref.sd) / timeDiff;
    }

    let labFactor = Math.pow(Math.max(0.5, ratio), beta);
    if (growthRate > 0) {
      labFactor *= (1 + alpha * growthRate / 0.1);
    }
    factorProduct *= Math.max(0.7, Math.min(3.0, labFactor));
  }

  // Missing labs → uncertainty penalty 1.5× per missing marker
  const missingCount = totalCount - foundCount;
  if (missingCount > 0) {
    factorProduct *= Math.pow(1.5, missingCount / totalCount);
  }

  return {
    factor: Math.max(0.3, Math.min(5.0, factorProduct)),
    markersFound: foundCount,
    markersTotal: totalCount,
  };
}

// ─── Nutrition Factor: N (0.5-1.5) ───

function computeNutritionFactorTZ(nutrition: TZNutritionInput, system: string, mechIdx: number): number {
  let factor = 1.0;

  // High protein → renal stress
  if (nutrition.proteinPerKg > 2.2) {
    if (system === 'renal') factor *= 1.2;
  }

  // Low fiber → cardio risk
  if (nutrition.fiberG < 20) {
    if (system === 'cardio' && mechIdx === 1) factor *= 1.15;
  }

  // Omega-3 → cardioprotection + neuroprotection
  if (nutrition.omega3G >= 2) {
    if (system === 'cardio') factor *= 0.75;
    if (system === 'neuro' && (mechIdx === 4 || mechIdx === 5)) factor *= 0.8;
  } else if (nutrition.omega3G < 0.5) {
    if (system === 'cardio') factor *= 1.15;
  }

  // High sodium → hypertension + renal
  if (nutrition.sodiumG > 5) {
    if (system === 'cardio' && mechIdx === 2) factor *= 1.1;
    if (system === 'renal') factor *= 1.05;
  }

  // Low potassium → arrhythmia + hypertension
  if (nutrition.potassiumG < 2) {
    if (system === 'cardio' && (mechIdx === 7 || mechIdx === 2)) factor *= 1.15;
  }

  // Low water intake → renal + hemo
  if (nutrition.waterL < 1.5) {
    if (system === 'renal') factor *= 1.1;
    if (system === 'hematologic') factor *= 1.05;
  }

  return Math.max(0.5, Math.min(1.5, factor));
}

// ─── Training Factor: T (1.0-1.5) ───

function computeTrainingFactorTZ(training: TZTrainingInput, system: string, mechIdx: number): number {
  let factor = 1.0;

  // HIIT → LVH + oxidative stress
  if (training.hasHIIT) {
    if (system === 'cardio' && mechIdx === 3) factor *= 1.3;
    if (system === 'cardio' && mechIdx === 5) factor *= 1.2;
  }

  // High volume → general load
  if (training.volumeTonnes > 15000) {
    factor *= 1.1;
    if (system === 'musculoskeletal') factor *= 1.15;
  }

  // LISS → cardio protection
  if (training.lissMinutesPerWeek > 150) {
    if (system === 'cardio') factor *= 0.9;
  } else if (training.lissMinutesPerWeek < 30 && training.weeklyMinutes > 300) {
    // All high-intensity, no LISS → cardio stress
    if (system === 'cardio') factor *= 1.1;
  }

  // Very high training time → cortisol/endocrine stress
  if (training.weeklyMinutes > 500) {
    if (system === 'endocrine' && mechIdx === 6) factor *= 1.3;
  }

  return Math.max(0.8, Math.min(1.5, factor));
}

// ─── Support Factor (net risk reduction) ───

// Augment the live SUPPORT_COVERAGE_MAP (the single source of support
// reductions consumed by computeSupportFactor) with the V7-derived extended set.
let _supportReductionsLoaded = false;
function ensureSupportReductions(): void {
  if (_supportReductionsLoaded) return;
  try {
    // Dynamic import for SUPPORT_REDUCTIONS — not exported from V7 module
    // We define our own extended set here
    Object.assign(SUPPORT_COVERAGE_MAP, {
      NAC: { hepatic: { 2: 0.25, 3: 0.3, 7: 0.25 }, renal: { 5: 0.15 }, neuro: { 5: 0.2 } },
      TUDCA: { hepatic: { 1: 0.3, 2: 0.2, 7: 0.25 } },
      milk_thistle: { hepatic: { 2: 0.2, 3: 0.25, 5: 0.15, 7: 0.2 } },
      omega3: { cardio: { 1: 0.25, 4: 0.15, 5: 0.2 }, neuro: { 4: 0.15, 5: 0.2 } },
      magnesium: { cardio: { 2: 0.1, 7: 0.2 }, neuro: { 3: 0.15, 4: 0.1 } },
      coq10: { cardio: { 5: 0.15, 6: 0.1 }, neuro: { 5: 0.1 } },
      zinc: { endocrine: { 1: 0.1, 2: 0.15 }, reproductive: { 1: 0.1, 2: 0.15 } },
      vitamin_d3: { endocrine: { 1: 0.1 }, musculoskeletal: { 7: 0.15 }, cardio: { 2: 0.05 } },
      vitamin_k2: { cardio: { 1: 0.1 }, hepatic: { 5: 0.05 } },
      telmisartan: { cardio: { 2: 0.3, 3: 0.2, 7: 0.1 }, renal: { 1: 0.15 } },
      nebivolol: { cardio: { 2: 0.25, 7: 0.15 }, neuro: { 3: 0.05 } },
      berberine: { endocrine: { 4: 0.2 }, cardio: { 1: 0.15 } },
      alpha_lipoic: { hepatic: { 3: 0.2, 7: 0.15 }, neuro: { 5: 0.25 } },
      nac: { hepatic: { 2: 0.25, 3: 0.3, 7: 0.25 }, renal: { 5: 0.15 }, neuro: { 5: 0.2 } },
      tudca: { hepatic: { 1: 0.3, 2: 0.2, 7: 0.25 } },
      selenium: { hepatic: { 3: 0.1, 7: 0.1 }, endocrine: { 5: 0.1 } },
      curcumin: { hepatic: { 3: 0.15, 7: 0.1 }, neuro: { 4: 0.1, 5: 0.1 }, cardio: { 5: 0.05 } },
      ashwagandha: { neuro: { 3: 0.2, 7: 0.15 }, endocrine: { 6: 0.15 } },
      astragalus: { renal: { 1: 0.2, 2: 0.15, 5: 0.1 } },
      cordyceps: { renal: { 1: 0.15, 3: 0.1 } },
      taurine: { cardio: { 2: 0.1, 7: 0.15 }, renal: { 4: 0.1 } },
      theanine: { neuro: { 3: 0.15, 7: 0.1 } },
      glycine: { neuro: { 3: 0.15, 2: 0.1 } },
      vitamin_c: { hepatic: { 3: 0.15, 7: 0.1 }, cardio: { 5: 0.1 } },
      hcg: { reproductive: { 1: 0.3, 2: 0.2 }, endocrine: { 3: 0.1 } },
      anastrozole: { endocrine: { 2: 0.4 }, reproductive: { 7: 0.1 } },
      clomiphene: { endocrine: { 1: 0.3, 3: 0.2 }, reproductive: { 7: 0.15 } },
      tamoxifen: { endocrine: { 2: 0.3, 1: 0.2 }, reproductive: { 7: 0.2 } },
      // ─── EXTENDED COVERAGE (40+ additional substances) ───
      vitamin_b6: { neuro: { 1: 0.12, 3: 0.1 }, hematologic: { 5: 0.1 } },
      vitamin_b12: { hematologic: { 5: 0.2 }, neuro: { 5: 0.1, 7: 0.15 } },
      folate: { hematologic: { 5: 0.25 }, neuro: { 7: 0.1 }, hepatic: { 3: 0.1 } },
      iron: { hematologic: { 5: 0.3 } },
      potassium: { cardio: { 2: 0.2, 7: 0.25 }, renal: { 4: 0.1 } },
      sodium: { cardio: { 2: 0.05 } },
      calcium: { musculoskeletal: { 1: 0.15, 7: 0.1 } },
      phosphorus: { musculoskeletal: { 7: 0.1 } },
      vitamin_a: { hepatic: { 3: 0.1 }, neuro: { 5: 0.1 } },
      vitamin_e: { hepatic: { 3: 0.15, 7: 0.1 }, cardio: { 5: 0.1 } },
      vitamin_b1: { neuro: { 2: 0.12, 5: 0.12 }, cardio: { 6: 0.1 } },
      vitamin_b2: { hepatic: { 3: 0.1 }, neuro: { 5: 0.1 } },
      vitamin_b3: { cardio: { 1: 0.15 }, hepatic: { 7: 0.05 } },
      vitamin_b5: { endocrine: { 6: 0.1 } },
      vitamin_b7: { endocrine: { 5: 0.08 } },
      inositol: { neuro: { 3: 0.1, 7: 0.1 }, endocrine: { 4: 0.1 } },
      choline: { hepatic: { 7: 0.1 }, neuro: { 1: 0.1, 2: 0.08 } },
      chromium: { endocrine: { 4: 0.15 } },
      vanadium: { endocrine: { 4: 0.1 } },
      iodine: { endocrine: { 5: 0.2 } },
      boron: { endocrine: { 1: 0.12 }, reproductive: { 7: 0.1 } },
      manganese: { neuro: { 5: 0.1 }, musculoskeletal: { 7: 0.08 } },
      molybdenum: { hepatic: { 3: 0.08 } },
      silicon: { musculoskeletal: { 7: 0.1 } },
      l_carnitine: { cardio: { 5: 0.15, 6: 0.1 }, hepatic: { 3: 0.12 } },
      l_arginine: { cardio: { 2: 0.15, 7: 0.1 } },
      l_citrulline: { cardio: { 2: 0.12 } },
      l_glutamine: { gi: { 7: 0.15 }, neuro: { 2: 0.08 } },
      l_lysine: { cardio: { 1: 0.1 } },
      l_proline: { musculoskeletal: { 7: 0.1 } },
      tmg: { hepatic: { 7: 0.12, 3: 0.1 }, neuro: { 7: 0.1 } },
      same: { hepatic: { 7: 0.15, 3: 0.1 }, neuro: { 7: 0.1 } },
      probiotics: { gi: { 7: 0.2 }, immunity: { 1: 0.15 } },
      psyllium: { cardio: { 1: 0.15 }, hepatic: { 7: 0.05 } },
      spirulina: { hepatic: { 3: 0.1 }, immunity: { 1: 0.1 } },
      resveratrol: { cardio: { 5: 0.1, 2: 0.05 }, neuro: { 5: 0.1 } },
      quercetin: { cardio: { 5: 0.1 }, hepatic: { 3: 0.1 }, neuro: { 4: 0.1 } },
      egcg: { hepatic: { 3: 0.15, 7: 0.1 }, cardio: { 1: 0.1 } },
      pycnogenol: { cardio: { 2: 0.12, 5: 0.1 } },
      hesperidin: { cardio: { 2: 0.1, 5: 0.08 } },
      diosmin: { cardio: { 2: 0.12, 4: 0.1 } },
      nattokinase: { cardio: { 4: 0.25 }, hematologic: { 4: 0.2, 6: 0.2 } },
      serrapeptase: { cardio: { 4: 0.15, 5: 0.1 } },
      bromelain: { neuro: { 4: 0.1 }, hepatic: { 3: 0.1 } },
      papain: { hepatic: { 3: 0.08 } },
      collagen: { musculoskeletal: { 7: 0.2 } },
      glucosamine: { musculoskeletal: { 7: 0.15 } },
      chondroitin: { musculoskeletal: { 7: 0.15 } },
      msm: { musculoskeletal: { 7: 0.1 }, neuro: { 4: 0.05 } },
      hyaluronic_acid: { musculoskeletal: { 7: 0.1 } },
      bcp157: { musculoskeletal: { 7: 0.15 }, gi: { 7: 0.1 } },
      tb500: { musculoskeletal: { 7: 0.12 } },
      melatonin: { neuro: { 7: 0.2, 3: 0.15 } },
      l_tryptophan: { neuro: { 7: 0.15 }, neuro_toxicity: { 7: 0.08 } },
      l_theanine: { neuro: { 3: 0.15, 7: 0.1 } },
      gaba: { neuro: { 3: 0.2 } },
      phenibut: { neuro: { 3: 0.15 } },
      uridine: { neuro: { 1: 0.1, 7: 0.08 } },
      pqq: { neuro: { 5: 0.12 }, cardio: { 5: 0.1 } },
      alcar: { neuro: { 5: 0.15, 2: 0.05 }, hepatic: { 3: 0.08 } },
      r_ala: { hepatic: { 3: 0.15 }, neuro: { 5: 0.2 } },
      milk_thistle_extract: { hepatic: { 2: 0.2, 3: 0.25, 7: 0.2 } },
      artichoke: { hepatic: { 1: 0.15, 7: 0.1 } },
      dandelion: { hepatic: { 1: 0.1 }, renal: { 1: 0.08 } },
      schisandra: { hepatic: { 7: 0.15, 3: 0.12 }, neuro: { 3: 0.08 } },
      andrographis: { hepatic: { 3: 0.12 }, immunity: { 1: 0.1 } },
      reishi: { immunity: { 1: 0.15, 2: 0.1 } },
      shiitake: { immunity: { 1: 0.1 }, cardio: { 1: 0.08 } },
      maitake: { immunity: { 1: 0.1 }, endocrine: { 4: 0.08 } },
      lions_mane: { neuro: { 1: 0.12, 5: 0.1, 2: 0.08 } },
      phosphatidylserine: { neuro: { 3: 0.12, 6: 0.1, 7: 0.1 } },
      phosphatidylcholine: { hepatic: { 7: 0.1, 1: 0.08 }, neuro: { 2: 0.08 } },
      glycerophosphocholine: { neuro: { 1: 0.1, 7: 0.08 } },
      huperzine_a: { neuro: { 2: 0.15 } },
      noopept: { neuro: { 2: 0.1, 7: 0.08 } },
      piracetam: { neuro: { 2: 0.1, 1: 0.08 } },
      oxiracetam: { neuro: { 2: 0.12 } },
      phenylpiracetam: { neuro: { 1: 0.1, 2: 0.08 } },
      agmatine: { neuro: { 3: 0.1, 2: 0.05 }, cardio: { 2: 0.08 } },
      nigella_sativa: { immunity: { 1: 0.1 }, hepatic: { 3: 0.1 } },
      colostrum: { immunity: { 1: 0.12, 2: 0.08 }, gi: { 7: 0.1 } },
      echinacea: { immunity: { 1: 0.1 } },
      garlic: { cardio: { 1: 0.15, 2: 0.1 }, immunity: { 1: 0.08 } },
      ginger: { neuro: { 4: 0.08 }, hepatic: { 3: 0.08 } },
      cayenne: { cardio: { 4: 0.08, 2: 0.05 } },
      cinnamon: { endocrine: { 4: 0.12 } },
      fenugreek: { endocrine: { 1: 0.1, 4: 0.08 } },
      tribulus: { endocrine: { 1: 0.08 } },
      maca: { endocrine: { 1: 0.08 }, reproductive: { 7: 0.08 } },
      rhodiola: { neuro: { 3: 0.1, 7: 0.08 }, endocrine: { 6: 0.12 } },
      holy_basil: { neuro: { 3: 0.1 }, endocrine: { 6: 0.1 } },
      eleuthero: { neuro: { 3: 0.08 }, endocrine: { 6: 0.08 } },
      ginseng: { neuro: { 1: 0.08, 5: 0.08 }, endocrine: { 4: 0.08 } },
      gotu_kola: { neuro: { 2: 0.08, 5: 0.08 }, cardio: { 5: 0.05 } },
      bacopa: { neuro: { 1: 0.1, 2: 0.08, 5: 0.1 } },
    });
    _supportReductionsLoaded = true;
  } catch {}
}

function computeSupportFactor(supportIds: string[], system: string, mechIdx: number): number {
  let factor = 1.0;
  const SUBSYS_PARENT: Record<string, string> = {
    vessels: 'cardio', metabolic: 'endocrine', ghigf: 'endocrine', ins_axis: 'endocrine',
    neuro_toxicity: 'neuro', blood: 'hematologic',
  };

  for (const id of supportIds) {
    let found = false;
    const keys = [id, id.toLowerCase(), id.replace(/_/g, '').toLowerCase()];

    // 1. Exact match in comprehensive coverage map
    for (const key of keys) {
      const cov = SUPPORT_COVERAGE_MAP[key];
      if (!cov) continue;
      const sysCov = cov[system];
      if (!sysCov) continue;
      const reduction = sysCov[mechIdx];
      if (reduction !== undefined) { factor *= (1 - Math.abs(reduction)); found = true; break; }
    }
    if (found) continue;

    // 2. Subsystem parent fallback
    const parent = SUBSYS_PARENT[system];
    if (parent) {
      for (const key of keys) {
        const cov = SUPPORT_COVERAGE_MAP[key];
        if (!cov) continue;
        const pCov = cov[parent];
        if (!pCov) continue;
        const reduction = pCov[mechIdx];
        if (reduction !== undefined) { factor *= (1 - Math.abs(reduction) * 0.6); found = true; break; }
      }
    }
    if (found) continue;

    // 3. Tiny default
    factor *= 0.97;
  }
  return Math.max(0.1, factor);
}

// ─── Geometric Mean (with minimum floor per value) ───

function geometricMean(values: number[], minFloorPct: number = 2.0): number {
  if (!values.length) return 0;
  const clamped = values.map(v => Math.max(v, minFloorPct));
  const sumLog = clamped.reduce((a, v) => a + Math.log(v / 100), 0);
  return Math.exp(sumLog / clamped.length) * 100;
}

// ─── Trimmed Arithmetic Mean (drop lowest N, then average) ───

function trimmedMean(values: number[], dropLowest: number = 2): number {
  if (!values.length) return 0;
  if (values.length <= dropLowest) return values.reduce((a, v) => a + v, 0) / values.length;
  const sorted = [...values].sort((a, b) => a - b);
  const trimmed = sorted.slice(dropLowest);
  return trimmed.reduce((a, v) => a + v, 0) / trimmed.length;
}

// ─── Main TZ Risk Calculation ───

export function calculateTZRisk(input: TZRiskInput): TZRiskResult {
  const { course, labs, genetics, nutrition, training, weight, age, sex, supportSubstances, courseWeek } = input;
  const effectiveWeek = courseWeek ?? Math.max(...course.map(c => (c.endWeek || 12) - (c.startWeek || 0)), 6);

  // 1. Compute per-drug dose factors
  const doseFactors: Record<string, number> = {};
  const weeklyDoses: Record<string, number> = {};
  for (const entry of course) {
    const id = entry.substanceId;
    const freq = typeof entry.frequency === 'number' ? entry.frequency : parseFloat(String(entry.frequency)) || 1;
    const weekly = (entry.doseValue || 0) * freq;
    weeklyDoses[id] = (weeklyDoses[id] || 0) + weekly;
  }
  for (const [id, dose] of Object.entries(weeklyDoses)) {
    doseFactors[id] = computeDrugDoseFactor(id, dose, effectiveWeek);
  }

  // 2. Ensure support reductions loaded
  ensureSupportReductions();

  // 3. Compute risk for each system × mechanism
  const systems: Record<string, TZSystemRisk> = {};
  const labMultipliers: Record<string, Record<number, number>> = {};

  for (const sys of CORE_SYSTEMS_V7) {
    const sysRisk: TZSystemRisk = { raw: 0, net: 0, mechanisms: {} };
    const baseRisks = BASE_RISK[sys] ?? {};

    for (let mechIdx = 1; mechIdx <= 7; mechIdx++) {
      const baseRisk = baseRisks[mechIdx] ?? 0.02;

      // Genetic multiplier
      const G = getGeneticMultiplier(genetics, sys, mechIdx);

      // Lab factor
      const labResult = computeLabFactor(labs, sys, mechIdx);
      const L = labResult.factor;
      if (!labMultipliers[sys]) labMultipliers[sys] = {};
      labMultipliers[sys][mechIdx] = L;

      // Nutrition factor
      const N = computeNutritionFactorTZ(nutrition, sys, mechIdx);

      // Training factor
      const T = computeTrainingFactorTZ(training, sys, mechIdx);

      // ─── PROBABILISTIC FORMULA ───
      // Risk_{s,m} = 1 − ∏_i (1 − baseRisk × D_i × G × L × N × T)
      // where i iterates over all drugs with genuine contribution to this mechanism
      const contributingDrugs: string[] = [];
      let product = 1.0;
      for (const [substanceId, dosePerWeek] of Object.entries(weeklyDoses)) {
        if (dosePerWeek <= 0) continue;
        const drugContribution = getDrugContribution(substanceId, sys, mechIdx);
        if (drugContribution <= 0) continue; // Only contribute to mechanisms the drug actually affects
        const Di = doseFactors[substanceId] || 1.0;
        // Cell risk contribution from drug i
        const cellRisk = baseRisk * drugContribution * Di * G * L * N * T;
        if (cellRisk > 0.001) {
          product *= (1 - Math.min(0.99, cellRisk));
          contributingDrugs.push(substanceId);
        }
      }

      // If no drugs contribute, use base risk with multipliers (lower default without drug driver)
      const rawRisk = contributingDrugs.length > 0
        ? 1 - product
        : baseRisk * G * L * N * T * 0.3;

      // Net risk after support
      const supportF = computeSupportFactor(supportSubstances, sys, mechIdx);
      // Apply support as direct reduction: net = raw × supportFactor (more intuitive)
      const netRisk = rawRisk * supportF;

      sysRisk.mechanisms[mechIdx] = {
        raw: Math.round(rawRisk * 1000) / 10,
        net: Math.round(netRisk * 1000) / 10,
        baseRisk: Math.round(baseRisk * 100) / 100,
        drugFactor: contributingDrugs.length > 0 ? Math.round((1 - product) / baseRisk * 100) / 100 : 0,
        geneticMult: Math.round(G * 100) / 100,
        labFactor: Math.round(L * 100) / 100,
        nutritionFactor: Math.round(N * 100) / 100,
        trainingFactor: Math.round(T * 100) / 100,
        supportFactor: Math.round(supportF * 100) / 100,
        contributingDrugs,
      };
    }

    // System risk = geometric mean of mechanism risks (floor 1%)
    const rawVals: number[] = [];
    const netVals: number[] = [];
    for (let mechIdx = 1; mechIdx <= 7; mechIdx++) {
      const mech = sysRisk.mechanisms[mechIdx];
      if (mech) {
        rawVals.push(mech.raw);
        netVals.push(mech.net);
      }
    }
    sysRisk.raw = Math.round(geometricMean(rawVals, 1.0) * 10) / 10;
    sysRisk.net = Math.round(geometricMean(netVals, 1.0) * 10) / 10;
    systems[sys] = sysRisk;
  }

  // 4. Overall risk = trimmed arithmetic mean of system risks (drop 2 lowest)
  const allRaw = OVERALL_SYSTEMS.map(s => systems[s]?.raw ?? 0).filter(v => v > 0);
  const allNet = OVERALL_SYSTEMS.map(s => systems[s]?.net ?? 0).filter(v => v > 0);
  const overallRaw = Math.round(trimmedMean(allRaw, 2) * 10) / 10;
  const overallNet = Math.round(trimmedMean(allNet, 2) * 10) / 10;

  return {
    overallRaw,
    overallNet,
    systems,
    drugDoseFactors: doseFactors,
    geneticProfile: genetics,
    labMultipliers,
  };
}

// ─── Compatible wrapper for the existing RiskResult format ───

export interface TZRiskResultCompat {
  overallRaw: number;
  overallNet: number;
  systemBreakdown: Record<string, { raw: number; net: number }>;
  mechanismBreakdown: Record<string, Record<number, { raw: number; net: number }>>;
  mechanismDetail: Record<string, Record<number, {
    raw: number; net: number;
    baseRisk: number; drugFactor: number;
    geneticMult: number; labFactor: number;
    nutritionFactor: number; trainingFactor: number;
    supportFactor: number; contributingDrugs: string[];
  }>>;
  doseFactors: Record<string, number>;
}

export function toCompatibleResult(tzResult: TZRiskResult): TZRiskResultCompat {
  const systemBreakdown: Record<string, { raw: number; net: number }> = {};
  const mechanismBreakdown: Record<string, Record<number, { raw: number; net: number }>> = {};
  const mechanismDetail: TZRiskResultCompat['mechanismDetail'] = {};

  for (const [sys, sysRisk] of Object.entries(tzResult.systems)) {
    systemBreakdown[sys] = { raw: sysRisk.raw, net: sysRisk.net };
    mechanismBreakdown[sys] = {};
    mechanismDetail[sys] = {};

    for (let mechIdx = 1; mechIdx <= 7; mechIdx++) {
      const cell = sysRisk.mechanisms[mechIdx];
      if (cell) {
        mechanismBreakdown[sys][mechIdx] = { raw: cell.raw, net: cell.net };
        mechanismDetail[sys][mechIdx] = {
          raw: cell.raw, net: cell.net,
          baseRisk: cell.baseRisk, drugFactor: cell.drugFactor,
          geneticMult: cell.geneticMult, labFactor: cell.labFactor,
          nutritionFactor: cell.nutritionFactor, trainingFactor: cell.trainingFactor,
          supportFactor: cell.supportFactor, contributingDrugs: cell.contributingDrugs,
        };
      }
    }
  }

  return {
    overallRaw: tzResult.overallRaw,
    overallNet: tzResult.overallNet,
    systemBreakdown,
    mechanismBreakdown,
    mechanismDetail,
    doseFactors: tzResult.drugDoseFactors,
  };
}
