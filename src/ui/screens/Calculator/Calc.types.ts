import type React from 'react';
import type { CalculatorState, LabSlice } from '../../../engines/support-plan';

export const GLASS: React.CSSProperties = {
  background: 'rgba(24,24,27,0.15)',
  border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: 16,
  padding: 12,
};

export const PILL: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 22,
  border: 'none',
  fontSize: 11,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap' as const,
};

export const INPUT: React.CSSProperties = {
  width: '100%',
  background: 'rgba(0,0,0,0.3)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 8,
  padding: '6px 10px',
  color: '#fff',
  fontSize: 11,
  boxSizing: 'border-box',
};

export const LABEL: React.CSSProperties = {
  fontSize: 9,
  color: 'var(--text-dim)',
  marginBottom: 2,
  display: 'block',
};

export const BADGE = (bg: string): React.CSSProperties => ({
  display: 'inline-block',
  padding: '2px 6px',
  borderRadius: 6,
  fontSize: 8,
  fontWeight: 700,
  background: bg,
  color: '#000',
});

export const SEV_OPTS: { id: string; label: string }[] = [
  { id: 'none', label: 'Нет' },
  { id: 'mild', label: 'Лёгкая' },
  { id: 'moderate', label: 'Средняя' },
  { id: 'severe', label: 'Тяжёлая' },
];

export const DEFAULT_STATE: CalculatorState = {
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
  powerLevel: 'mid',
};

const LAB_PANEL_KEYS: Array<keyof LabSlice> = [
  'panelSex', 'panelBiochem', 'panelHematology', 'panelThyroid',
  'panelLipid', 'panelIron', 'panelVitamin', 'panelCardiac',
  'panelCoagulation', 'panelInflammatory', 'panelAdrenal', 'panelMineral',
  'panelTumor', 'panelUrinalysis',
];

const isRecord = (value: unknown): value is Record<string, any> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

export function normalizeLabSlice(value: unknown): LabSlice | null {
  if (!isRecord(value)) return null;
  const slice = { date: typeof value.date === 'string' ? value.date : '' } as LabSlice;
  for (const key of LAB_PANEL_KEYS) {
    const panel = value[key];
    (slice as any)[key] = isRecord(panel) ? panel as Record<string, string> : {};
  }
  return slice;
}

export function normalizeCalculatorState(value: unknown): CalculatorState {
  const saved = isRecord(value) ? value : {};
  const pharma = isRecord(saved.pharma) ? saved.pharma : {};
  const labs = isRecord(saved.labs) ? saved.labs : {};
  const aas = Array.isArray(pharma.aas)
    ? pharma.aas.filter((a: any) => isRecord(a) && typeof a.id === 'string').map((a: any) => ({
      ...a,
      doseMgWeek: Number.isFinite(Number(a.doseMgWeek)) ? Number(a.doseMgWeek) : 0,
      weeks: Number.isFinite(Number(a.weeks)) ? Number(a.weeks) : 12,
    }))
    : [];
  const normalizedLabs = {
    ...DEFAULT_STATE.labs,
    preCourse: normalizeLabSlice(labs.preCourse),
    midCourse: normalizeLabSlice(labs.midCourse),
    postPCT: normalizeLabSlice(labs.postPCT),
    fullPanel: normalizeLabSlice(labs.fullPanel),
  };

  return {
    ...DEFAULT_STATE,
    ...saved,
    profile: { ...DEFAULT_STATE.profile, ...(isRecord(saved.profile) ? saved.profile : {}) },
    pharma: { ...DEFAULT_STATE.pharma, ...pharma, aas },
    goals: { ...DEFAULT_STATE.goals, ...(isRecord(saved.goals) ? saved.goals : {}) },
    neuro: { ...DEFAULT_STATE.neuro, ...(isRecord(saved.neuro) ? saved.neuro : {}) },
    hepatobiliary: { ...DEFAULT_STATE.hepatobiliary, ...(isRecord(saved.hepatobiliary) ? saved.hepatobiliary : {}) },
    urinary: { ...DEFAULT_STATE.urinary, ...(isRecord(saved.urinary) ? saved.urinary : {}) },
    cardio: { ...DEFAULT_STATE.cardio, ...(isRecord(saved.cardio) ? saved.cardio : {}) },
    oda: {
      ...DEFAULT_STATE.oda,
      ...(isRecord(saved.oda) ? saved.oda : {}),
      injuries: isRecord(saved.oda) && Array.isArray(saved.oda.injuries) ? saved.oda.injuries : [],
    },
    labs: normalizedLabs,
    nutrition: { ...DEFAULT_STATE.nutrition, ...(isRecord(saved.nutrition) ? saved.nutrition : {}) },
    contraindications: { ...DEFAULT_STATE.contraindications, ...(isRecord(saved.contraindications) ? saved.contraindications : {}) },
    journal: {
      ...DEFAULT_STATE.journal,
      ...(isRecord(saved.journal) ? saved.journal : {}),
      positive: isRecord(saved.journal) && Array.isArray(saved.journal.positive) ? saved.journal.positive : [],
      negative: isRecord(saved.journal) && Array.isArray(saved.journal.negative) ? saved.journal.negative : [],
    },
    epicrisis: { ...DEFAULT_STATE.epicrisis, ...(isRecord(saved.epicrisis) ? saved.epicrisis : {}) },
    toxicLoad: { ...DEFAULT_STATE.toxicLoad, ...(isRecord(saved.toxicLoad) ? saved.toxicLoad : {}) },
    dental: { ...DEFAULT_STATE.dental, ...(isRecord(saved.dental) ? saved.dental : {}) },
    genetics: { ...DEFAULT_STATE.genetics, ...(isRecord(saved.genetics) ? saved.genetics : {}) },
    gi: { ...DEFAULT_STATE.gi, ...(isRecord(saved.gi) ? saved.gi : {}) },
    psych: { ...DEFAULT_STATE.psych, ...(isRecord(saved.psych) ? saved.psych : {}) },
    injection: { ...DEFAULT_STATE.injection, ...(isRecord(saved.injection) ? saved.injection : {}) },
  } as CalculatorState;
}

export type AutoCalculatorCourseEntry = {
  substanceId: string;
  doseValue: number;
  frequency: number;
  startWeek: number;
  endWeek: number;
};

export interface AutoCalculatorProps {
  onApply: (result: {
    level: string;
    subs: string[];
    result?: import('../../../engines/support-plan').CalculatorResult;
    tzRec?: import('../../../engines/tz-mapper-engine').SupportRecommendation;
  }) => void;
  embedded?: boolean;
  courseWeek?: number;
  courseLinked?: AutoCalculatorCourseEntry[];
  labsLinked?: LabSlice | null;
  onOpenManualPicker?: () => void;
  onOpenLabs?: () => void;
  planResult?: import('../../../engines/support-plan').PlanResult;
}
