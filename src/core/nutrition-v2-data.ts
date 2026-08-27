import { calcTrendFromHistory as calcTrendCentral } from './metabolic-constants';

const STORAGE_KEY = 'he_nutrition_v2';

export interface NutritionV2Data {
  weightHistory: { date: string; kg: number }[];
  currentTDEE: number;
  baseTDEE: number;
  tdeeAdjustment: number;
  lastTrendKgPerWeek: number;
  proteinGPerKg: number;
  fatMinGPerKg: number;
  bodyFatPercent?: number;
  leanMass?: number;
  dietWeeks: number;
  metabolicAdaptation: number;
  refeedRecommended: boolean;
  dietPauseRecommended: boolean;
  sleepHours: number;
  stressLevel: number;
  cyclePhase: string;
  thyroidIssues: boolean;
  adherence7d: number;
  adherence14d: number;
  avgDeviationKcal: number;
  flexibleDaysEnabled: boolean;
  flexibleDayActive: boolean;
  cravingMode: boolean;
  cravingDays: number;
  lazyDayActive: boolean;
  lazyDayDays: number;
  hungryLevel: number;
  compensationActive: boolean;
  compensationRemaining: number;
  qualityScore: number;
  qualityBreakdown: { microDensity: number; macroBalance: number; fiber: number; fatQuality: number; wholeFoods: number };
  microDeficiencies: { nutrient: string; current: number; target: number }[];
  glycemicLoad: number;
  eveningOvereatDays: number;
  morningUndereatDays: number;
  bingeDays: number;
  triggers: { trigger: string; kcalDelta: number; count: number }[];
  dietStabilityIndex: number;
  currentPhase: 'deficit' | 'maintenance' | 'bulk' | 'mini_cut' | 'pause';
  periodizationEnabled: boolean;
  cycleMacrosEnabled: boolean;
  lastUpdated: string;
}

const DEFAULTS: NutritionV2Data = {
  weightHistory: [],
  currentTDEE: 2500,
  baseTDEE: 2500,
  tdeeAdjustment: 0,
  lastTrendKgPerWeek: 0,
  proteinGPerKg: 2.0,
  fatMinGPerKg: 0.8,
  dietWeeks: 0,
  metabolicAdaptation: 0,
  refeedRecommended: false,
  dietPauseRecommended: false,
  sleepHours: 7,
  stressLevel: 5,
  cyclePhase: '',
  thyroidIssues: false,
  adherence7d: 1,
  adherence14d: 1,
  avgDeviationKcal: 0,
  flexibleDaysEnabled: true,
  flexibleDayActive: false,
  cravingMode: false,
  cravingDays: 1,
  lazyDayActive: false,
  lazyDayDays: 1,
  hungryLevel: 5,
  compensationActive: false,
  compensationRemaining: 0,
  qualityScore: 70,
  qualityBreakdown: { microDensity: 15, macroBalance: 15, fiber: 10, fatQuality: 10, wholeFoods: 15 },
  microDeficiencies: [],
  glycemicLoad: 0,
  eveningOvereatDays: 0,
  morningUndereatDays: 0,
  bingeDays: 0,
  triggers: [],
  dietStabilityIndex: 80,
  currentPhase: 'maintenance',
  periodizationEnabled: false,
  cycleMacrosEnabled: false,
  lastUpdated: '',
};

export function getNutritionV2Data(): NutritionV2Data {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULTS };
}

export function saveNutritionV2Data(data: Partial<NutritionV2Data>) {
  const current = getNutritionV2Data();
  const updated = { ...current, ...data, lastUpdated: new Date().toISOString() };
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
}

export function addWeightEntry(kg: number) {
  const data = getNutritionV2Data();
  const entry = { date: new Date().toISOString().split('T')[0], kg };
  data.weightHistory = [...data.weightHistory, entry].slice(-90);
  data.lastUpdated = new Date().toISOString();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch {}
}

export function calcTrend(data: NutritionV2Data): number {
  return calcTrendCentral(data.weightHistory as any);
}

export function calcAdherence(diaryData: any): number {
  try {
    const entries = Object.values(diaryData || {}) as any[];
    if (entries.length === 0) return 1;
    const last7 = entries.slice(-7);
    const planned = last7.length * 3;
    const logged = last7.reduce((s: number, d: any) => s + Object.keys(d.meals || {}).length, 0);
    return Math.min(1, logged / Math.max(1, planned));
  } catch { return 1; }
}
