/**
 * bb-plans-store.ts — хранилище вариантов ББ-планов (мульти-планы + сравнение).
 * localStorage 'he_bb_plans' — массив {id, name, date, plan, params, metrics}.
 */

export interface SavedBBPlan {
  id: string;
  name: string;
  date: string;
  plan: any;
  params: {
    patternId: string;
    patternName: string;
    level: string;
    goal: string;
    weeks: number;
    volumeGoal: string;
    peds: string[];
    pedDoses?: Record<string, number>;
    courseIntensity?: string;
    weakPoints: string[];
    focusGroup: string;
    intensityTechnique: string;
    loadStrategy: string;
    autoDeload: boolean;
    deloadType: string;
    planMode: string;
    cycleId?: string;
  };
  metrics: {
    totalSets: number;
    avgRir: number;
    sessionsPerWeek: number;
    phases: string[];
    qualityScore: number;
    muscleCount: number;
    mrvMult: number;
    peakWeek?: number;
    peakDirectSets?: number;
    peakEffectiveSets?: number;
    maxSessionMinutes?: number;
    maxAxialCost?: number;
  };
}

const KEY = 'he_bb_plans';
const MAX_PLANS = 8;

export function loadSavedBBPlans(): SavedBBPlan[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter(item => item && typeof item === 'object').map(migrateSavedPlan) : [];
  } catch { return []; }
}

function migrateSavedPlan(value: any): SavedBBPlan {
  return {
    ...value,
    params: {
      patternId: '', patternName: value.params?.patternName || value.plan?.pattern?.name || '',
      level: value.params?.level || value.plan?.level || 'intermediate', goal: value.params?.goal || 'mass',
      weeks: value.params?.weeks || value.plan?.weeks?.length || 1, volumeGoal: value.params?.volumeGoal || 'mav',
      peds: Array.isArray(value.params?.peds) ? value.params.peds : [], weakPoints: Array.isArray(value.params?.weakPoints) ? value.params.weakPoints : [],
      focusGroup: value.params?.focusGroup || '', intensityTechnique: value.params?.intensityTechnique || 'none',
      loadStrategy: value.params?.loadStrategy || 'double_progression', autoDeload: Boolean(value.params?.autoDeload),
      deloadType: value.params?.deloadType || 'pump', planMode: value.params?.planMode || 'generic_split', ...value.params,
    },
    metrics: {
      totalSets: value.metrics?.totalSets || 0, avgRir: value.metrics?.avgRir || 0,
      sessionsPerWeek: value.metrics?.sessionsPerWeek || value.plan?.pattern?.sessionsPerRotation || 0,
      phases: Array.isArray(value.metrics?.phases) ? value.metrics.phases : [], qualityScore: value.metrics?.qualityScore || 0,
      muscleCount: value.metrics?.muscleCount || 0, mrvMult: value.metrics?.mrvMult || 1, ...value.metrics,
    },
  } as SavedBBPlan;
}

export function saveBBPlanVariant(name: string, plan: any, params: SavedBBPlan['params'], metrics: SavedBBPlan['metrics']): SavedBBPlan[] {
  const existing = loadSavedBBPlans();
  const entry: SavedBBPlan = {
    id: 'bbplan_' + Date.now(),
    name,
    date: new Date().toISOString(),
    plan,
    params,
    metrics,
  };
  const updated = [entry, ...existing].slice(0, MAX_PLANS);
  try { localStorage.setItem(KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  return updated;
}

export function deleteBBPlanVariant(id: string): SavedBBPlan[] {
  const existing = loadSavedBBPlans();
  const updated = existing.filter(p => p.id !== id);
  try { localStorage.setItem(KEY, JSON.stringify(updated)); } catch { /* ignore */ }
  return updated;
}

export function clearAllBBPlans(): void {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
