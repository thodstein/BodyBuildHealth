/**
 * biostack-clinical-recommender.ts
 *
 * КЛИНИЧЕСКИ КОРРЕКТНЫЙ движок рекомендаций BioStack.
 *
 * Принцип (без догадок):
 *  - Источник истины для подбора веществ и их доз = движок калькулятора поддержки
 *    (`runSupportUnified` / `calculateSupportTZ` из ./support-plan). Это тот же движок,
 *    который считает «Калькулятор поддержки» — единственный источник клинически
 *    обоснованного выбора веществ по фазе/цели/механизму риска.
 *  - BioStack НЕ модифицирует значение риска и НЕ «угадывает» дозы — он берёт
 *    канонические дозировки (DEFAULT_DOSAGES), механизмы ТЗ (getDrugTzMechanisms) и
 *    пропускает кандидатов через клинический шлюз безопасности `selectStack`
 *    (biostack-clinical-v2.engine): абсолютные противопоказания → ЛС-исключения →
 *    ультра-лимиты → лаб-коррекции → редандантность.
 *
 * Все импорты из support-plan / support-db / support-meta — READ-ONLY (используются,
 * не меняются). Это гарантирует, что стек, собранный здесь, идентичен по составу и
 * дозам тому, что выдал бы «Калькулятор поддержки» для тех же вводных.
 */

import {
  runSupportUnified,
  hydrateState,
  type CalculatorState,
  type PlanResult,
  type PlanSubstance,
} from './support-plan';

import { selectStack, type StackStrategy } from './biostack-clinical-v2.engine';
import type { BioStackProfile } from './biostack-ai.engine';
import type { LabCompositeResult } from './lab-analysis.engine';

import { getDrugTzMechanisms, TZ_MECH_LABELS } from '../data/support-db';
import { SUPPORT_CATALOG_DATA } from '../data/support-database';

/* ------------------------------------------------------------------ *
 *  Дефолтное состояние калькулятора (локальная копия, без импорта из UI).
 *  Точная копия DEFAULT_STATE из src/ui/screens/Calculator/Calc.types.ts.
 * ------------------------------------------------------------------ */
const DEFAULT_STATE: CalculatorState = {
  profile: {
    weight: 80,
    age: 30,
    sex: 'male',
    workoutsPerWeek: 3,
    avgWorkoutMinutes: 60,
    sleepHours: 7,
    stressLevel: 4,
    smoker: false,
    alcohol: 'rare',
    caffeineMg: 100,
  },
  neuro: {
    dopamineScore: 1,
    serotoninScore: 1,
    gabaBalance: 'balance',
    memoryIssues: false,
    focusIssues: false,
    slowThinking: false,
    coordinationIssues: false,
    aggressionScore: 1,
    headaches: false,
    weatherDependent: false,
    sleepQuality: 'good',
  },
  pharma: {
    phase: 'course',
    aas: [],
    hasGH: false,
    hasIGF: false,
    hasInsulin: false,
    hasHCG: false,
    hasAI: false,
    hasCaber: false,
    hasSERM: false,
    hasSARMs: false,
    hasMGF: false,
    hasGLP1: false,
  },
  goals: {
    healthMaintenance: true,
    competitionPrep: false,
    sleepRecovery: false,
    lipidCorrection: false,
    bloodThinning: false,
    liverDetox: false,
    bpControl: false,
    trainingCycle: 'mass',
    cycleWeeks: 12,
    previousCycles: 0,
    timeSinceLastCycle: 'none',
  },
  hepatobiliary: {
    altAstElevation: 'none',
    ggtElevation: 'none',
    bilirubinElevation: 'none',
    fattyLiver: false,
    cholecystitis: false,
    alcoholHistory: 'none',
  },
  urinary: {
    creatinineElevation: 'none',
    ureaElevation: 'none',
    proteinuria: false,
    nephrotoxicDrugs: false,
    hypertension: false,
    diabetes: false,
    urinationPattern: 'normal',
  },
  cardio: {
    bpStage: 'normal',
    heartRate: 72,
    ldlElevation: 'none',
    hdlLow: false,
    triglycerides: 'normal',
    hctElevation: 'none',
    previousCVD: false,
    familyCVD: false,
  },
  oda: { jointPain: 'none', ligamentIssues: false, backPain: false, injuries: [] },
  labs: { preCourse: null, midCourse: null, postPCT: null, fullPanel: null },
  nutrition: {
    calories: 2500,
    proteinG: 160,
    fatG: 80,
    carbsG: 300,
    waterL: 2,
    saltIntake: 'normal',
    omega3: false,
    fiberG: 25,
    proteinGPerKg: 1.8,
    sodiumMg: 3500,
    potassiumMg: 4500,
  },
  contraindications: {
    allergies: '',
    hasCVD: false,
    hasThrombophilia: false,
    hasGI: false,
    hasProstateIssues: false,
    hasDiabetes: false,
    hasEpilepsy: false,
    hasMentalIllness: false,
    hasLiverDisease: false,
    hasKidneyDisease: false,
  },
  journal: { positive: [], negative: [] },
  epicrisis: {
    pastGyno: false,
    pastLibidoDrop: false,
    pastHctSpike: false,
    pastLiverIssues: false,
    pastKidneyIssues: false,
  },
  toxicLoad: {
    hazardousWork: false,
    regularNSAIDs: false,
    otherHeavyDrugs: false,
    bowelFrequency: 'regular',
  },
  dental: {
    bleedingGums: false,
    looseTeeth: false,
    nightGrinding: false,
    boneFractures: false,
    cramps: false,
  },
  genetics: {
    cyp19a1: 'unknown',
    srd5a2: 'unknown',
    arSensitivity: 'unknown',
    mthfr: 'normal',
  },
  gi: {
    bloating: false,
    heartburn: false,
    diarrhea: false,
    constipation: false,
    diagnosedIBS: false,
    enzymeSupport: false,
    probioticUse: false,
  },
  psych: { fearOfLoss: 1, mirrorObsession: 1, apathyOffCycle: 1 },
  injection: { glutes: '', quads: '', delts: '', localAreas: '' },
  // поля, управляющие режимами подбора:
  jointMode: false,
  neuroMode: false,
  boostEnabled: false,
  powerLevel: 'mid',
  courseWeek: 1,
};

/* ------------------------------------------------------------------ *
 *  Маппинг профиля BioStack → contraindications калькулятора
 * ------------------------------------------------------------------ */
const HEALTH_TO_CONTRA: Record<string, keyof CalculatorState['contraindications']> = {
  heart: 'hasCVD',
  cardiovascular: 'hasCVD',
  cvd: 'hasCVD',
  diabetes: 'hasDiabetes',
  kidney: 'hasKidneyDisease',
  renal: 'hasKidneyDisease',
  liver: 'hasLiverDisease',
  hepatic: 'hasLiverDisease',
  gi: 'hasGI',
  gastro: 'hasGI',
  prostate: 'hasProstateIssues',
  epilepsy: 'hasEpilepsy',
  seizure: 'hasEpilepsy',
  mental: 'hasMentalIllness',
  psychiatric: 'hasMentalIllness',
  thrombophilia: 'hasThrombophilia',
  clotting: 'hasThrombophilia',
};

function mapProfileToContraindications(
  profile: BioStackProfile,
  base: CalculatorState['contraindications'],
): CalculatorState['contraindications'] {
  const out: CalculatorState['contraindications'] = { ...base };
  for (const c of profile.healthConditions || []) {
    const key = HEALTH_TO_CONTRA[c.toLowerCase()];
    if (key) (out as any)[key] = true;
  }
  if (profile.drugAllergies && profile.drugAllergies.length) {
    out.allergies = (out.allergies ? out.allergies + ', ' : '') + profile.drugAllergies.join(', ');
  }
  return out;
}

/** Приоритет цели BioStack → режимы подбора калькулятора */
function mapGoalsToModes(profile: BioStackProfile): {
  jointMode: boolean;
  neuroMode: boolean;
} {
  const goals = profile.goals || [];
  const joint = goals.some((g) =>
    ['joints', 'joint', 'connective', 'tendon', 'mobility'].includes(g.toLowerCase()),
  );
  const neuro = goals.some((g) =>
    ['focus', 'sleep', 'stress', 'mood', 'neuro', 'cognitive', 'anxiety'].includes(g.toLowerCase()),
  );
  return { jointMode: joint, neuroMode: neuro };
}

/** Сложность стека BioStack → powerLevel калькулятора */
function complexityToPower(p: BioStackProfile['stackComplexity']): CalculatorState['powerLevel'] {
  switch (p) {
    case 'minimal':
      return 'basic';
    case 'maximum':
      return 'max';
    case 'balanced':
    default:
      return 'mid';
  }
}

/* ------------------------------------------------------------------ *
 *  Результат
 * ------------------------------------------------------------------ */
export interface ClinicalSubstance {
  id: string;
  name: string;
  doseMg: number;
  doseDisplay: string;
  timing: string;
  tier: string;
  categories: string[];
  targetSystems: string[];
  mechanismReason: string;
  comment: string;
  tzMechanisms: { mechId: string; label: string }[];
  brandName?: string;
}

export interface ClinicalStackResult {
  /** итоговые вещества после клинического шлюза безопасности */
  substances: ClinicalSubstance[];
  /** вещества, отсеянные шлюзом (для прозрачности) */
  excluded: {
    id: string;
    name: string;
    reason: string;
    severity: 'hard' | 'drug' | 'titration' | 'ul' | 'redundant';
  }[];
  riskBefore: number;
  riskAfter: number;
  coveragePercent: number;
  monitoring: string[];
  specialInstructions: string[];
  conflicts: string[];
  /** сырые данные шлюза безопасности */
  safety: {
    hardStops: any[];
    drugExclusions: any[];
    drugTitrations: any[];
    ulWarnings: any[];
    labAdjustments: any[];
    redundancy: any[];
  };
  /** флаг: использовался ли источник истины (всегда true — это и есть гарантия) */
  sourceOfTruth: 'support-plan/runSupportUnified';
  /** неделя курса, на которой считался план */
  courseWeek: number;
}

/* ------------------------------------------------------------------ *
 *  Основная функция
 * ------------------------------------------------------------------ */
export interface BuildClinicalStackOpts {
  strategy?: StackStrategy;
  lab?: LabCompositeResult | null;
  courseWeek?: number;
  /** принудительный powerLevel (иначе из профиля) */
  powerLevel?: CalculatorState['powerLevel'];
}

export function buildClinicalStack(
  profile: BioStackProfile,
  opts: BuildClinicalStackOpts = {},
): ClinicalStackResult {
  // 1) Полное состояние = дефолт ⊕ реальные данные из localStorage (pharma/labs/neuro/CI)
  const h = hydrateState();
  const modes = mapGoalsToModes(profile);
  const courseWeek = opts.courseWeek ?? 1;

  const state: CalculatorState = {
    ...DEFAULT_STATE,
    ...(h as Partial<CalculatorState>),
    contraindications: mapProfileToContraindications(profile, DEFAULT_STATE.contraindications),
    jointMode: modes.jointMode,
    neuroMode: modes.neuroMode,
    boostEnabled: profile.stackComplexity === 'maximum',
    powerLevel: opts.powerLevel ?? complexityToPower(profile.stackComplexity),
    courseWeek,
  } as CalculatorState;

  // 2) Источник истины: движок калькулятора поддержки (канонические дозы + механизмы)
  const plan: PlanResult = runSupportUnified(state);

  // 3) Клинический шлюз безопасности (абсолютные противопоказания, ЛС, UL, лаб, редандантность)
  const strategy = opts.strategy ?? 'comprehensive';
  const gate = selectStack(
    plan.substances.map((s) => s.id),
    profile,
    strategy,
    opts.lab ?? null,
  );

  const gateIdSet = new Set(gate.ids);
  const byId = new Map<string, PlanSubstance>(plan.substances.map((s) => [s.id, s]));

  const substances: ClinicalSubstance[] = [];
  for (const id of gate.ids) {
    const s = byId.get(id);
    if (!s) continue;
    const catalog = SUPPORT_CATALOG_DATA[id];
    const tz = (getDrugTzMechanisms(id) || []).map((m) => ({
      mechId: m.mechId,
      label: (TZ_MECH_LABELS as any)[m.mechId] || m.mechId,
    }));
    substances.push({
      id: s.id,
      name: s.name,
      doseMg: s.doseMg,
      doseDisplay: s.doseDisplay,
      timing: s.timing,
      tier: s.tier,
      categories: s.category || (catalog ? catalog.category || [] : []),
      targetSystems: s.targetSystems || [],
      mechanismReason: s.mechanismReason || '',
      comment: s.comment || '',
      tzMechanisms: tz,
      brandName: s.brandName,
    });
  }

  // 4) Отсеянные вещества (прозрачность)
  const excluded: ClinicalStackResult['excluded'] = [];
  const pushExcluded = (
    list: any[],
    severity: 'hard' | 'drug' | 'titration' | 'ul' | 'redundant',
    reasonFn: (x: any) => string,
  ) => {
    for (const x of list || []) {
      if (!gateIdSet.has(x.substanceId)) {
        excluded.push({
          id: x.substanceId,
          name: x.substanceName,
          reason: reasonFn(x),
          severity,
        });
      }
    }
  };
  pushExcluded(gate.hardStops, 'hard', (x) => x.reason || 'Абсолютное противопоказание');
  pushExcluded(gate.drugExclusions, 'drug', (x) => `${x.drug}: ${x.effect || x.mechanism || 'ЛС-конфликт'}`);
  pushExcluded(gate.drugTitrations, 'titration', (x) => `${x.drug}: титровать ${x.action || ''}`);
  pushExcluded(gate.ulWarnings, 'ul', (x) => x.message || 'Превышен верхний допустимый предел');
  pushExcluded(gate.redundancy, 'redundant', (x) => x.reason || 'Редандантность');

  const coveragePercent =
    typeof plan.coveragePercent === 'number' ? plan.coveragePercent : 0;

  const conflictsAsText = (plan.conflicts || []).map(
    (c) => `${c.aName} + ${c.bName}: ${c.effect}`,
  );

  return {
    substances,
    excluded,
    riskBefore: plan.overallRiskBefore,
    riskAfter: plan.overallRiskAfter,
    coveragePercent,
    monitoring: plan.monitoring || [],
    specialInstructions: plan.specialInstructions || [],
    conflicts: conflictsAsText,
    safety: {
      hardStops: gate.hardStops,
      drugExclusions: gate.drugExclusions,
      drugTitrations: gate.drugTitrations,
      ulWarnings: gate.ulWarnings,
      labAdjustments: (gate.labAdjustments as any) || [],
      redundancy: gate.redundancy,
    },
    sourceOfTruth: 'support-plan/runSupportUnified',
    courseWeek,
  };
}

/* ------------------------------------------------------------------ *
 *  Быстрая сводка для UI (без тяжёлых подробностей)
 * ------------------------------------------------------------------ */
export function summarizeClinicalStack(r: ClinicalStackResult): string {
  const lines: string[] = [];
  lines.push(`Клинический подбор (источник: движок калькулятора поддержки)`);
  lines.push(`Веществ в плане: ${r.substances.length}`);
  lines.push(`Риск до/после поддержки: ${r.riskBefore} → ${r.riskAfter}`);
  if (r.excluded.length) lines.push(`Отсеяно шлюзом безопасности: ${r.excluded.length}`);
  r.substances.forEach((s) => {
    lines.push(`• ${s.name} — ${s.doseDisplay || s.doseMg + ' мг'}, ${s.timing}`);
  });
  return lines.join('\n');
}
