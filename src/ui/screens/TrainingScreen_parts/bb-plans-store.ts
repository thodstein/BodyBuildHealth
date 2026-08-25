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
    trainingFocus?: 'strength' | 'hypertrophy' | 'endurance';
    methodology?: 'compound_first' | 'pre_exhaust' | 'post_exhaust';
    equipment?: string[];
    specialization?: boolean;
    /** Расписание блоков специализации (сохранение/восстановление плана блоков). */
    specBlocks?: {
      id?: string;
      weekStart: number;
      weekEnd: number;
      targets: string[];
      tradeoff?: {
        mode: 'none' | 'reduce_direct_to_floor' | 'remove_direct_when_indirect_covers_floor';
        donorMuscles: string[];
        preserveIndirect: true;
      };
    }[];
    daysPerWeek?: number;
    source?: 'cycle' | 'program';
    programPath?: 'library' | 'cycle';
    programId?: string;
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
    return Array.isArray(arr)
      ? arr.filter(isSavedPlanShape).map(migrateSavedPlan)
      : [];
  } catch { return []; }
}

function isSavedPlanShape(value: any): boolean {
  return Boolean(
    value && typeof value === 'object' &&
    value.plan && typeof value.plan === 'object' &&
    Array.isArray(value.plan.weeks) && value.plan.weeks.length > 0 &&
    value.plan.weeks.every((week: any) => week && typeof week === 'object' && (!('sessions' in week) || Array.isArray(week.sessions))),
  );
}

function migrateSavedPlan(value: any): SavedBBPlan {
  const rawParams = value.params && typeof value.params === 'object' ? value.params : {};
  const validFocus = ['strength', 'hypertrophy', 'endurance'].includes(rawParams.trainingFocus) ? rawParams.trainingFocus : undefined;
  const validMethodology = ['compound_first', 'pre_exhaust', 'post_exhaust'].includes(rawParams.methodology) ? rawParams.methodology : undefined;
  const validSource = rawParams.source === 'cycle' || rawParams.source === 'program' ? rawParams.source : undefined;
  const validProgramPath = rawParams.programPath === 'library' || rawParams.programPath === 'cycle' ? rawParams.programPath : undefined;
  const weeks = Number.isInteger(rawParams.weeks) && rawParams.weeks > 0 ? rawParams.weeks : value.plan.weeks.length;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : `bbplan_legacy_${Date.now()}`,
    name: typeof value.name === 'string' && value.name ? value.name : 'BB-план',
    date: typeof value.date === 'string' ? value.date : '',
    plan: value.plan,
    params: {
      patternId: typeof rawParams.patternId === 'string' ? rawParams.patternId : '',
      patternName: rawParams.patternName || value.plan.pattern?.name || '',
      level: rawParams.level || value.plan.level || 'intermediate', goal: rawParams.goal || 'mass',
      weeks, volumeGoal: rawParams.volumeGoal || 'mav',
      peds: Array.isArray(rawParams.peds) ? rawParams.peds.filter((item: any) => typeof item === 'string') : [],
      pedDoses: rawParams.pedDoses && typeof rawParams.pedDoses === 'object' ? rawParams.pedDoses : undefined,
      courseIntensity: rawParams.courseIntensity,
      weakPoints: Array.isArray(rawParams.weakPoints) ? rawParams.weakPoints.filter((item: any) => typeof item === 'string') : [],
      focusGroup: typeof rawParams.focusGroup === 'string' ? rawParams.focusGroup : '',
      intensityTechnique: typeof rawParams.intensityTechnique === 'string' ? rawParams.intensityTechnique : 'none',
      loadStrategy: typeof rawParams.loadStrategy === 'string' ? rawParams.loadStrategy : 'double_progression',
      autoDeload: Boolean(rawParams.autoDeload), deloadType: typeof rawParams.deloadType === 'string' ? rawParams.deloadType : 'pump',
      trainingFocus: validFocus, methodology: validMethodology,
      equipment: Array.isArray(rawParams.equipment) ? rawParams.equipment.filter((item: any) => typeof item === 'string') : undefined,
      specialization: rawParams.specialization == null ? undefined : Boolean(rawParams.specialization),
      daysPerWeek: Number.isInteger(rawParams.daysPerWeek) && rawParams.daysPerWeek > 0 ? rawParams.daysPerWeek : undefined,
      source: validSource, programPath: validProgramPath,
      programId: typeof rawParams.programId === 'string' ? rawParams.programId : undefined,
      planMode: rawParams.planMode === 'programs' || rawParams.planMode === 'bb_cycle' ? 'programs' : 'generic_split',
      cycleId: typeof rawParams.cycleId === 'string' ? rawParams.cycleId : undefined,
    },
    metrics: {
      totalSets: Number(value.metrics?.totalSets) || 0, avgRir: Number(value.metrics?.avgRir) || 0,
      sessionsPerWeek: Number(value.metrics?.sessionsPerWeek) || value.plan.pattern?.sessionsPerRotation || 0,
      phases: Array.isArray(value.metrics?.phases) ? value.metrics.phases.filter((item: any) => typeof item === 'string') : [], qualityScore: Number(value.metrics?.qualityScore) || 0,
      muscleCount: Number(value.metrics?.muscleCount) || 0, mrvMult: Number(value.metrics?.mrvMult) || 1,
    },
  };
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
