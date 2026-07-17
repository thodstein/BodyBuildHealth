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
  };
}

const KEY = 'he_bb_plans';
const MAX_PLANS = 8;

export function loadSavedBBPlans(): SavedBBPlan[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
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
