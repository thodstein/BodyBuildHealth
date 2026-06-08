// ============================================================
// Health Engine v7.0 — Risk Matrix (7 systems x 7 mechanisms)
// Genetics, lab trends, nutrition, training, drug contributions, support coverage
// ============================================================

import { zScore, hillEffect, labFactor, nutritionMultipliers, trainingMultipliers, stazhFactors, type ProtocolMode, getModeMultiplier } from './risk-engine-v7-core';
import type { LabPoint, CourseEntry } from '../core/types';
import { PHARMA_DB } from '../core/pharma-database';

// --- 7x7 Risk Systems & Mechanisms ---

export const RISK_SYSTEMS_V7 = [
  'cardio', 'hepatic', 'renal', 'neuro', 'endocrine', 'hematologic', 'reproductive'
] as const;
export type RiskSystemV7 = typeof RISK_SYSTEMS_V7[number];

export const SYSTEM_NAMES_RU: Record<string, string> = {
  cardio: 'Сердечно-сосудистая',
  hepatic: 'Печень',
  renal: 'Почки',
  neuro: 'Нервная система',
  endocrine: 'Эндокринная',
  hematologic: 'Кроветворная',
  reproductive: 'Репродуктивная',
  metabolic: 'Метаболизм',
  ghigf: 'GH/IGF',
  ins_axis: 'Инсулиновая ось',
  neuro_toxicity: 'Нейротоксичность',
};

export const MECHANISM_NAMES: Record<string, Record<number, string>> = {
  cardio: { 1: 'Дислипидемия', 2: 'Артериальная гипертензия', 3: 'Гипертрофия ЛЖ', 4: 'Тромбогенный потенциал', 5: 'Окислительный стресс миокарда', 6: 'Фиброз сердечной ткани', 7: 'Аритмогенность' },
  hepatic: { 1: 'Холестаз', 2: 'Цитолиз', 3: 'Окислительный стресс', 4: 'Митохондриальная дисфункция', 5: 'Активация звёздчатых клеток', 6: 'Нагрузка CYP450', 7: 'Прямая химическая токсичность' },
  renal: { 1: 'Гломерулярная гипертензия', 2: 'Тубулоинтерстициальный фиброз', 3: 'Протеинурия', 4: 'Электролитный дисбаланс', 5: 'Ишемия почечной ткани', 6: 'Нефролитиаз', 7: 'Токсичность метаболитов' },
  neuro: { 1: 'Дофаминовый дисбаланс', 2: 'Глутаматная эксайтотоксичность', 3: 'ГАМК-дисрегуляция', 4: 'Нейровоспаление', 5: 'Окислительный стресс нейронов', 6: 'Нарушение проницаемости ГЭБ', 7: 'Серотониновый дисбаланс' },
  endocrine: { 1: 'Подавление оси ГГЯ', 2: 'Ароматизация', 3: 'Пролактиновый всплеск', 4: 'Инсулинорезистентность', 5: 'Дисфункция щитовидной железы', 6: 'Дисбаланс кортизола', 7: 'Десенситизация рецепторов' },
  hematologic: { 1: 'Эритроцитоз', 2: 'Тромбоцитоз', 3: 'Лейкоцитоз', 4: 'Изменение реологии', 5: 'Дефицит железа', 6: 'Активация свёртывания', 7: 'Гемолиз' },
  reproductive: { 1: 'Атрофия тестикул', 2: 'Олигоспермия', 3: 'Морфология сперматозоидов', 4: 'Подвижность сперматозоидов', 5: 'Гиперплазия простаты', 6: 'Риск онкологии простаты', 7: 'Эректильная дисфункция' },
};

// --- Genetic Multipliers ---

export interface GeneticProfile {
  COMT?: string;    // 'Met/Met', 'Val/Met', 'Val/Val'
  MTHFR?: string;   // 'TT', 'CT', 'CC'
  ESR1?: string;    // 'PvuII+', 'PvuII-'
  AGTR1?: string;   // 'CC', 'AC', 'AA'
  NOS3?: string;    // 'TT', 'GT', 'GG'
  SRD5A2?: string;  // 'LL', 'LV', 'VV'
  CYP3A4?: string;  // '*22', '*1/*22', '*1/*1'
}

const GENETIC_TABLE: Record<string, Record<string, number>> = {
  COMT: { 'Met/Met': 2.0, 'Val/Met': 1.5, 'Val/Val': 1.0 },
  MTHFR: { 'TT': 1.7, 'CT': 1.3, 'CC': 1.0 },
  ESR1: { 'PvuII+': 1.4, 'PvuII-': 1.0 },
  AGTR1: { 'CC': 1.4, 'AC': 1.2, 'AA': 1.0 },
  NOS3: { 'TT': 1.3, 'GT': 1.15, 'GG': 1.0 },
  SRD5A2: { 'LL': 1.8, 'LV': 1.4, 'VV': 1.0 },
  CYP3A4: { '*22': 1.35, '*1/*22': 1.15, '*1/*1': 1.0 },
};

// Which systems/mechanisms each gene affects
const GENE_SYSTEM_MAP: Record<string, Record<string, number[]>> = {
  COMT: { neuro: [1, 2] },  // dopamine-related
  MTHFR: { cardio: [4], neuro: [5] },  // homocysteine
  ESR1: { endocrine: [2], reproductive: [7] },
  AGTR1: { cardio: [2, 3], renal: [1] },
  NOS3: { cardio: [5], reproductive: [7] },
  SRD5A2: { reproductive: [5, 6] },
  CYP3A4: { hepatic: [6] },  // CYP450 load
};

export function getGeneticMultiplier(genetics: GeneticProfile, system: string, mechIdx: number): number {
  let mult = 1.0;
  for (const [gene, systemMap] of Object.entries(GENE_SYSTEM_MAP)) {
    const genotype = genetics[gene as keyof GeneticProfile];
    if (!genotype) continue;
    const mechs = systemMap[system];
    if (!mechs) continue;
    if (mechs.includes(mechIdx)) {
      mult *= GENETIC_TABLE[gene]?.[genotype] ?? 1.0;
    }
  }
  return mult;
}

// --- Drug Thresholds & Contributions ---

export interface DrugThreshold {
  dosePerWeek: number;   // reference dose (mg/week)
  androgenicity: number; // relative androgenic potency
  systems: Record<string, Record<number, number>>; // system -> mechIdx -> contribution weight
}

export const DRUG_THRESHOLDS_V7: Record<string, DrugThreshold> = {
  testosterone_enanthate: {
    dosePerWeek: 300, androgenicity: 1.0,
    systems: {
      cardio: { 2: 0.3, 3: 0.4, 4: 0.3 },
      hepatic: { 7: 0.1 },
      endocrine: { 1: 0.8, 2: 0.6 },
      hematologic: { 1: 0.7, 4: 0.3 },
      reproductive: { 1: 0.7, 2: 0.5 },
    }
  },
  trenbolone_acetate: {
    dosePerWeek: 100, androgenicity: 1.8,
    systems: {
      cardio: { 2: 0.5, 7: 0.4 },
      hepatic: { 1: 0.6, 7: 0.5 },
      neuro: { 1: 0.7, 3: 0.5, 2: 0.4 },
      endocrine: { 1: 0.9, 3: 0.6 },
      renal: { 1: 0.3 },
      hematologic: { 1: 0.6 },
      reproductive: { 1: 0.8 },
    }
  },
  nandrolone_decanoate: {
    dosePerWeek: 150, androgenicity: 0.6,
    systems: {
      cardio: { 2: 0.2, 3: 0.3 },
      endocrine: { 1: 0.7, 3: 0.4 },
      hematologic: { 1: 0.5 },
      reproductive: { 1: 0.6, 5: 0.3 },
      renal: { 3: 0.3 },
    }
  },
  oxandrolone: {
    dosePerWeek: 50, androgenicity: 0.3,
    systems: {
      hepatic: { 1: 0.5, 7: 0.7 },
      endocrine: { 1: 0.5 },
      hematologic: { 1: 0.3 },
      renal: { 7: 0.2 },
    }
  },
  stanozolol: {
    dosePerWeek: 30, androgenicity: 0.3,
    systems: {
      hepatic: { 1: 0.8, 6: 0.6, 7: 0.8 },
      cardio: { 1: 0.4, 4: 0.3 },
      hematologic: { 1: 0.4, 4: 0.3 },
      endocrine: { 1: 0.5 },
    }
  },
  methandienone: {
    dosePerWeek: 30, androgenicity: 0.6,
    systems: {
      hepatic: { 1: 0.7, 7: 0.8 },
      cardio: { 1: 0.3, 2: 0.3 },
      endocrine: { 1: 0.7, 2: 0.5 },
      hematologic: { 1: 0.5 },
    }
  },
  oxymetholone: {
    dosePerWeek: 50, androgenicity: 0.4,
    systems: {
      hepatic: { 1: 0.9, 7: 0.9 },
      cardio: { 2: 0.4 },
      hematologic: { 1: 0.8, 4: 0.3 },
      endocrine: { 1: 0.6 },
    }
  },
};

// --- Lab reference ranges (for labFactor computation) ---

export const LAB_REFERENCES: Record<string, { mean: number; sd: number; uln: number; sensitive: boolean }> = {
  ALT: { mean: 25, sd: 10, uln: 40, sensitive: true },
  AST: { mean: 22, sd: 8, uln: 35, sensitive: true },
  GGT: { mean: 30, sd: 15, uln: 50, sensitive: false },
  SBP: { mean: 120, sd: 12, uln: 140, sensitive: false },
  DBP: { mean: 80, sd: 8, uln: 90, sensitive: false },
  Hct: { mean: 0.45, sd: 0.04, uln: 0.52, sensitive: true },
  Hb: { mean: 150, sd: 12, uln: 170, sensitive: false },
  LDL: { mean: 2.8, sd: 0.8, uln: 3.4, sensitive: false },
  HDL: { mean: 1.4, sd: 0.3, uln: 2.0, sensitive: false },
  TG: { mean: 1.2, sd: 0.5, uln: 1.7, sensitive: false },
  Glucose: { mean: 5.0, sd: 0.5, uln: 5.8, sensitive: true },
  eGFR: { mean: 100, sd: 15, uln: 120, sensitive: false },
  Creatinine: { mean: 80, sd: 15, uln: 106, sensitive: false },
  Fibrinogen: { mean: 3.0, sd: 0.6, uln: 4.0, sensitive: false },
  CRP: { mean: 1.0, sd: 1.0, uln: 5.0, sensitive: false },
  Homocysteine: { mean: 10, sd: 3, uln: 15, sensitive: false },
  Prolactin: { mean: 10, sd: 4, uln: 20, sensitive: false },
  PSA: { mean: 1.0, sd: 0.5, uln: 4.0, sensitive: false },
  Na: { mean: 140, sd: 3, uln: 145, sensitive: false },
  K: { mean: 4.2, sd: 0.4, uln: 5.0, sensitive: false },
  WBC: { mean: 7.0, sd: 2.0, uln: 11.0, sensitive: false },
  PLT: { mean: 250, sd: 50, uln: 400, sensitive: false },
  Testosterone: { mean: 15, sd: 5, uln: 30, sensitive: false },
  Estradiol: { mean: 30, sd: 15, uln: 80, sensitive: false },
  LH: { mean: 5, sd: 2, uln: 10, sensitive: false },
  FSH: { mean: 5, sd: 2, uln: 10, sensitive: false },
  TSH: { mean: 2.0, sd: 1.0, uln: 4.0, sensitive: false },
  Cortisol: { mean: 300, sd: 100, uln: 600, sensitive: false },
  D_dimer: { mean: 0.3, sd: 0.2, uln: 0.5, sensitive: false },
};

// --- Matrix Computation ---

export interface MatrixInput {
  labs: LabPoint[];
  course: CourseEntry[];
  genetics: GeneticProfile;
  nutrition: {
    proteinPerKg: number;  // g/kg/day
    fiberG: number;         // g/day
    omega3G: number;        // g/day
    sodiumG: number;        // g/day
    potassiumG: number;     // g/day
  };
  training: {
    workoutsPerWeek: number;
    avgWorkoutMinutes: number;
    hasHIIT: boolean;
    volumeTonnes: number;   // weekly tonnage
    lissMinutesPerWeek: number;
  };
  mode: ProtocolMode;
  stazhWeeks: number;       // lifetime exposure
  continuousWeeks: number;  // current cycle
}

export interface MechanismRisk {
  P_raw: number;
  P_net: number;
  geneticMult: number;
  labFactor: number;
  nutritionFactor: number;
  trainingFactor: number;
  modeFactor: number;
  supportFactor: number;
}

export interface SystemRisk {
  raw: number;
  net: number;
  mechanisms: Record<number, MechanismRisk>;
}

export interface MatrixResult {
  systems: Record<string, SystemRisk>;
  overallRaw: number;
  overallNet: number;
  drugContributions: Record<string, Record<string, Record<number, number>>>;
}

// Base risk per (system, mechanism)
const BASE_RISK: Record<string, Record<number, number>> = {
  cardio: { 1: 0.08, 2: 0.10, 3: 0.06, 4: 0.07, 5: 0.05, 6: 0.04, 7: 0.05 },
  hepatic: { 1: 0.07, 2: 0.08, 3: 0.06, 4: 0.05, 5: 0.04, 6: 0.06, 7: 0.08 },
  renal: { 1: 0.06, 2: 0.04, 3: 0.05, 4: 0.04, 5: 0.03, 6: 0.02, 7: 0.04 },
  neuro: { 1: 0.08, 2: 0.07, 3: 0.06, 4: 0.06, 5: 0.05, 6: 0.04, 7: 0.06 },
  endocrine: { 1: 0.10, 2: 0.08, 3: 0.07, 4: 0.06, 5: 0.04, 6: 0.05, 7: 0.05 },
  hematologic: { 1: 0.08, 2: 0.06, 3: 0.04, 4: 0.05, 5: 0.03, 6: 0.07, 7: 0.04 },
  reproductive: { 1: 0.10, 2: 0.08, 3: 0.05, 4: 0.04, 5: 0.06, 6: 0.04, 7: 0.07 },
};

// Mechanism weights per system (sum to 1)
const MECH_WEIGHTS: Record<string, Record<number, number>> = {
  cardio: { 1: 0.15, 2: 0.18, 3: 0.14, 4: 0.14, 5: 0.13, 6: 0.12, 7: 0.14 },
  hepatic: { 1: 0.18, 2: 0.17, 3: 0.14, 4: 0.12, 5: 0.13, 6: 0.12, 7: 0.14 },
  renal: { 1: 0.20, 2: 0.17, 3: 0.16, 4: 0.14, 5: 0.13, 6: 0.08, 7: 0.12 },
  neuro: { 1: 0.18, 2: 0.15, 3: 0.13, 4: 0.17, 5: 0.14, 6: 0.10, 7: 0.13 },
  endocrine: { 1: 0.22, 2: 0.16, 3: 0.14, 4: 0.13, 5: 0.10, 6: 0.11, 7: 0.14 },
  hematologic: { 1: 0.20, 2: 0.14, 3: 0.10, 4: 0.14, 5: 0.08, 6: 0.18, 7: 0.16 },
  reproductive: { 1: 0.20, 2: 0.16, 3: 0.10, 4: 0.08, 5: 0.18, 6: 0.12, 7: 0.16 },
};

// Lab-to-mechanism mapping: which labs influence which mechanisms
const LAB_MECH_MAP: Record<string, Record<number, string[]>> = {
  cardio: { 1: ['LDL','HDL','TG'], 2: ['SBP','DBP'], 3: ['Hct'], 4: ['Fibrinogen','D_dimer'], 5: ['Homocysteine'], 6: ['CRP'], 7: ['K','Na'] },
  hepatic: { 1: ['GGT','ALT'], 2: ['ALT','AST'], 3: ['GGT'], 4: ['ALT','AST'], 5: ['GGT'], 6: ['ALT','AST'], 7: ['ALT','AST'] },
  renal: { 1: ['SBP','DBP'], 2: ['Creatinine','eGFR'], 3: ['Creatinine','eGFR'], 4: ['K','Na'], 5: ['Creatinine'], 6: ['Na'], 7: ['Creatinine'] },
  neuro: { 1: ['Prolactin'], 2: ['Homocysteine'], 3: ['Cortisol'], 4: ['CRP'], 5: ['Homocysteine'], 6: ['CRP'], 7: ['Cortisol'] },
  endocrine: { 1: ['LH','FSH','Testosterone'], 2: ['Estradiol','Testosterone'], 3: ['Prolactin'], 4: ['Glucose','HbA1c'], 5: ['TSH'], 6: ['Cortisol'], 7: ['Testosterone','Estradiol'] },
  hematologic: { 1: ['Hct','Hb'], 2: ['PLT'], 3: ['WBC'], 4: ['Hct','Fibrinogen'], 5: ['Hct','Hb'], 6: ['Fibrinogen','D_dimer'], 7: ['Hct'] },
  reproductive: { 1: ['LH','FSH','Testosterone'], 2: ['LH','FSH'], 3: ['Testosterone'], 4: ['Testosterone'], 5: ['PSA','Testosterone'], 6: ['PSA'], 7: ['Testosterone','Estradiol'] },
};

// Support substance risk reduction per (system, mechanism)
const SUPPORT_REDUCTIONS: Record<string, Record<string, Record<number, number>>> = {
  NAC: { hepatic: { 3: 0.3, 7: 0.2 }, renal: { 7: 0.1 } },
  omega3: { cardio: { 1: 0.25, 5: 0.2 }, neuro: { 4: 0.15, 5: 0.2 } },
  telmisartan: { cardio: { 2: 0.3, 3: 0.2 }, renal: { 1: 0.25 } },
  aspirin: { cardio: { 4: 0.2 }, hematologic: { 6: 0.15 } },
  vitaminD: { endocrine: { 5: 0.15 }, reproductive: { 5: 0.1 } },
  zinc: { reproductive: { 1: 0.1, 2: 0.1 }, endocrine: { 1: 0.1 } },
  magnesium: { cardio: { 7: 0.15, 2: 0.1 }, neuro: { 3: 0.1 } },
  taurine: { cardio: { 2: 0.1, 5: 0.15 }, hepatic: { 7: 0.1 } },
  milk_thistle: { hepatic: { 1: 0.2, 2: 0.2, 7: 0.15 } },
  berberine: { endocrine: { 4: 0.2 }, cardio: { 1: 0.15 } },
};

function computeLabFactorForMech(labs: LabPoint[], system: string, mechIdx: number): number {
  const labNames = LAB_MECH_MAP[system]?.[mechIdx];
  if (!labNames || !labNames.length) return 1.0;
  
  let factor = 1.0;
  for (const labName of labNames) {
    const ref = LAB_REFERENCES[labName];
    if (!ref) continue;
    const points = labs.filter(l => l.code === labName || l.name === labName);
    if (!points.length) continue;
    const value = points[points.length - 1].value;
    const ratio = value / ref.uln;
    const beta = ref.sensitive ? 1.5 : 1.0;
    factor *= Math.max(0.7, Math.pow(ratio, beta));
  }
  return Math.max(0.5, Math.min(3.0, factor));
}

function computeDrugContributions(course: CourseEntry[]): Record<string, Record<string, Record<number, number>>> {
  const result: Record<string, Record<string, Record<number, number>>> = {};
  for (const entry of course) {
    const drug = DRUG_THRESHOLDS_V7[entry.substanceId];
    if (!drug) continue;
    const doseRatio = (entry.doseValue ?? 0) / drug.dosePerWeek;
    const substanceContrib: Record<string, Record<number, number>> = {};
    for (const [sys, mechs] of Object.entries(drug.systems)) {
      const mechContrib: Record<number, number> = {};
      for (const [mechStr, weight] of Object.entries(mechs)) {
        mechContrib[Number(mechStr)] = doseRatio * weight * drug.androgenicity;
      }
      substanceContrib[sys] = mechContrib;
    }
    result[entry.substanceId] = substanceContrib;
  }
  return result;
}

function computeSupportFactor(supportIds: string[], system: string, mechIdx: number): number {
  let factor = 1.0;
  for (const id of supportIds) {
    const reductions = SUPPORT_REDUCTIONS[id];
    if (!reductions) continue;
    const sysReductions = reductions[system];
    if (!sysReductions) continue;
    const reduction = sysReductions[mechIdx];
    if (reduction) {
      factor *= (1 - reduction);
    }
  }
  return Math.max(0.1, factor);
}

function computeNutritionFactor(nutrition: MatrixInput['nutrition'], system: string, mechIdx: number): number {
  let factor = 1.0;
  // High protein -> kidney risk
  if (nutrition.proteinPerKg > 2.2) {
    if (system === 'renal') factor *= 1.2;
  }
  // Low fiber -> dyslipidemia
  if (nutrition.fiberG < 20) {
    if (system === 'cardio' && mechIdx === 1) factor *= 1.15;
  }
  // Omega-3 -> cardio & neuro protection
  if (nutrition.omega3G >= 2) {
    if (system === 'cardio') factor *= 0.75;
    if (system === 'neuro' && (mechIdx === 4 || mechIdx === 5)) factor *= 0.8;
  }
  // High sodium -> hypertension
  if (nutrition.sodiumG > 5) {
    if (system === 'cardio' && mechIdx === 2) factor *= 1.1;
    if (system === 'renal') factor *= 1.05;
  }
  // Low potassium -> arrhythmia
  if (nutrition.potassiumG < 2) {
    if (system === 'cardio' && (mechIdx === 7 || mechIdx === 2)) factor *= 1.15;
  }
  return Math.max(0.5, Math.min(1.5, factor));
}

function computeTrainingFactor(training: MatrixInput['training'], system: string, mechIdx: number): number {
  let factor = 1.0;
  // HIIT -> LVH, oxidative stress, microtrauma
  if (training.hasHIIT) {
    if (system === 'cardio' && mechIdx === 3) factor *= 1.3;
    if (system === 'cardio' && mechIdx === 5) factor *= 1.2;
  }
  // High volume -> overtraining (cortisol, recovery)
  if (training.volumeTonnes > 15000) {
    factor *= 1.1; // affects all systems through cortisol
  }
  // LISS -> cardio protection
  if (training.lissMinutesPerWeek > 150) {
    if (system === 'cardio') factor *= 0.9;
  }
  return Math.max(0.8, Math.min(1.4, factor));
}

// --- Main Matrix Computation ---

export function computeV7Matrix(input: MatrixInput, supportIds: string[] = []): MatrixResult {
  const systems: Record<string, SystemRisk> = {};
  const drugContribs = computeDrugContributions(input.course);
  
  // Stazh factors
  const stazhLife = input.stazhWeeks / 52; // years of lifetime use
  const stazhCont = input.continuousWeeks / 12; // months of current cycle
  const stazhLifeFactor = 1 + 0.02 * stazhLife;  // 2% per year
  const stazhContFactor = 1 + 0.03 * stazhCont;  // 3% per month
  
  for (const sys of RISK_SYSTEMS_V7) {
    const systemRisk: SystemRisk = { raw: 0, net: 0, mechanisms: {} };
    const baseRisks = BASE_RISK[sys] ?? {};
    const weights = MECH_WEIGHTS[sys] ?? {};
    
    for (let mechIdx = 1; mechIdx <= 7; mechIdx++) {
      const base = baseRisks[mechIdx] ?? 0.02;
      
      // Genetic multiplier
      const geneticMult = getGeneticMultiplier(input.genetics, sys, mechIdx);
      
      // Lab factor
      const labF = computeLabFactorForMech(input.labs, sys, mechIdx);
      
      // Drug contributions
      let drugContrib = 0;
      for (const [substanceId, contribs] of Object.entries(drugContribs)) {
        const sysContribs = contribs[sys];
        if (sysContribs && sysContribs[mechIdx]) {
          drugContrib += sysContribs[mechIdx];
        }
      }
      
      // Mode factor
      const modeF = getModeMultiplier(input.mode, sys, mechIdx);
      
      // Nutrition factor
      const nutF = computeNutritionFactor(input.nutrition, sys, mechIdx);
      
      // Training factor
      const trainF = computeTrainingFactor(input.training, sys, mechIdx);
      
      // Stazh factors
      const stazhF = stazhLifeFactor * stazhContFactor;
      
      // P_raw = base * genetic * lab * mode * nutrition * training * stazh * (1 + drug)
      const P_raw = Math.min(1, base * geneticMult * labF * modeF * nutF * trainF * stazhF * (1 + drugContrib));
      
      // Support factor (for net)
      const supportF = computeSupportFactor(supportIds, sys, mechIdx);
      
      // P_net = P_raw * support
      const P_net = Math.min(1, P_raw * supportF);
      
      systemRisk.mechanisms[mechIdx] = {
        P_raw,
        P_net,
        geneticMult,
        labFactor: labF,
        nutritionFactor: nutF,
        trainingFactor: trainF,
        modeFactor: modeF,
        supportFactor: supportF,
      };
    }
    
    // System risk = weighted sum of mechanism risks
    let raw = 0, net = 0;
    for (const [mechStr, mechData] of Object.entries(systemRisk.mechanisms)) {
      const w = weights[Number(mechStr)] ?? 1/7;
      raw += w * mechData.P_raw;
      net += w * mechData.P_net;
    }
    systemRisk.raw = Math.min(100, raw * 100);
    systemRisk.net = Math.min(100, net * 100);
    systems[sys] = systemRisk;
  }
  
  // Overall = geometric mean of system risks
  const allRaw = Object.values(systems).map(s => s.raw);
  const allNet = Object.values(systems).map(s => s.net);
  const geomMean = (arr: number[]): number => {
    if (!arr.length) return 0;
    return Math.min(100, Math.exp(arr.reduce((a, v) => a + Math.log(Math.max(0.01, v)), 0) / arr.length));
  };
  const overallRaw = geomMean(allRaw);
  const overallNet = geomMean(allNet);
  // overallNet already computed above
  
  return { systems, overallRaw, overallNet, drugContributions: drugContribs };
}


