import { SUPPORT_CATALOG_DATA, SYSTEM_LABELS_CATALOG, ORGAN_LABELS } from '../data/support-database';
import { getProfile } from '../core/profile-manager';
import type { UserProfile } from '../core/types';

export type CognitiveTask = 'memory' | 'focus' | 'creativity' | 'reaction_speed' | 'learning';
export type StimSensitivity = 'low' | 'medium' | 'high';
export type GutSensitivity = 'normal' | 'sensitive' | 'problematic';
export type DietType = 'mixed' | 'vegan' | 'keto' | 'paleo' | 'vegetarian' | 'mediterranean';
export type Chronotype = 'lark' | 'owl' | 'mixed';
export type AlcoholLevel = 'none' | 'rare' | 'moderate' | 'daily';
export type CaffeineLevel = 'none' | 'low' | 'moderate' | 'high';
export type ADClass = 'none' | 'ssri' | 'snri' | 'maoi' | 'tca' | 'other';
export type StackComplexity = 'minimal' | 'balanced' | 'maximum';
export type GoalType =
  | 'sleep' | 'energy' | 'concentration' | 'muscle_gain' | 'fat_loss'
  | 'endurance' | 'recovery' | 'immunity' | 'liver_health' | 'cardio_health'
  | 'joints' | 'skin' | 'hair' | 'hormones' | 'stress' | 'longevity'
  | 'detox' | 'libido' | 'mood' | 'brain' | 'digestion' | 'kidney';
export type HealthCondition = 'liver' | 'kidney' | 'heart' | 'thyroid' | 'stomach' | 'pressure_high' | 'pressure_low' | 'diabetes' | 'autoimmune';
export type AASStatus = 'none' | 'trt' | 'course' | 'pct' | 'bridge' | 'fertility';
export type BudgetLevel = 'economy' | 'medium' | 'premium';
export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface BioStackProfile {
  age: number; weight: number; height: number; sex: 'male' | 'female';
  experience: ExperienceLevel; goals: GoalType[]; aasStatus: AASStatus;
  healthConditions: HealthCondition[]; budget: BudgetLevel; avoidIds: string[]; avoidMeds: string[];
  maxStackSize: number;
  adClass: ADClass; stackComplexity: StackComplexity;
  targetOrgans: string[]; targetSystems: string[];
  currentMeds: string[]; drugAllergies: string[];
  autoFilledFields: string[];
}

/* ── Completeness ── */
export interface ProfileCompleteness {
  totalGroups: number;
  filledGroups: number;
  totalFields: number;
  filledFields: number;
  autoFilledCount: number;
  manualFilledCount: number;
  percent: number;
  groupStatus: Record<string, { filled: boolean; source: 'auto' | 'manual' | 'empty' }>;
}

const FIELD_GROUPS: Record<string, string[]> = {
  personal: ['age','weight','height','sex','experience'],
  health: ['aasStatus','healthConditions','budget','stackComplexity'],
  goals: ['goals'],
  organs: ['targetOrgans'],
  systems: ['targetSystems'],
  lifestyle: ['avoidIds', 'avoidMeds'],
  clinical: ['currentMeds','drugAllergies','adClass'],
};

const AUTO_FILLABLE_KEYS = new Set([
  'age','weight','height','sex','experience','goals','healthConditions','currentMeds','drugAllergies',
]);

export function getProfileCompleteness(p: BioStackProfile): ProfileCompleteness {
  const autoSet = new Set(p.autoFilledFields || []);
  let filledFields = 0; let autoCount = 0; let manualCount = 0;
  for (const key of Object.keys(p)) {
    if (key === 'autoFilledFields') continue;
    const v = (p as any)[key];
    const isFilled = Array.isArray(v) ? v.length > 0 : (v !== undefined && v !== null && v !== '' && v !== 0);
    if (isFilled) {
      filledFields++;
      if (autoSet.has(key)) autoCount++;
      else manualCount++;
    }
  }
  const groupStatus: Record<string, { filled: boolean; source: 'auto' | 'manual' | 'empty' }> = {};
  let filledGroups = 0;
  for (const [gname, keys] of Object.entries(FIELD_GROUPS)) {
    const allFilled = keys.every(k => {
      const v = (p as any)[k];
      return Array.isArray(v) ? v.length > 0 : (v !== undefined && v !== null && v !== '' && v !== 0);
    });
    if (allFilled) {
      filledGroups++;
      const allAuto = keys.every(k => autoSet.has(k));
      groupStatus[gname] = { filled: true, source: allAuto ? 'auto' : 'manual' };
    } else {
      const someFilled = keys.some(k => {
        const v = (p as any)[k];
        return Array.isArray(v) ? v.length > 0 : (v !== undefined && v !== null && v !== '' && v !== 0);
      });
      groupStatus[gname] = { filled: false, source: someFilled ? 'manual' : 'empty' };
    }
  }
  const totalFields = Object.keys(p).filter(k => k !== 'autoFilledFields').length;
  return {
    totalGroups: Object.keys(FIELD_GROUPS).length,
    filledGroups,
    totalFields,
    filledFields,
    autoFilledCount: autoCount,
    manualFilledCount: manualCount,
    percent: Math.round((filledFields / totalFields) * 100),
    groupStatus,
  };
}

export function getDefaultBioStackProfile(): BioStackProfile {
  return {
    age: 30, weight: 80, height: 175, sex: 'male',
    experience: 'intermediate', goals: ['muscle_gain'],
    aasStatus: 'none', healthConditions: [], budget: 'medium',
    avoidIds: [], avoidMeds: [], maxStackSize: 8,
    adClass: 'none', stackComplexity: 'balanced',
    targetOrgans: [], targetSystems: [],
    currentMeds: [], drugAllergies: [],
    autoFilledFields: [],
  };
}

export function autoFillFromMainProfile(): { patch: Partial<BioStackProfile>; autoKeys: string[] } {
  try {
    const p = getProfile(); if (!p) return { patch: {}, autoKeys: [] };
    const s = p.settings; if (!s) return { patch: {}, autoKeys: [] };
    const filled: Partial<BioStackProfile> = {};
    const keys: string[] = [];
    if (s.age) { filled.age = s.age; keys.push('age'); }
    if (s.weight) { filled.weight = s.weight; keys.push('weight'); }
    if (s.height) { filled.height = s.height; keys.push('height'); }
    if (s.sex) { filled.sex = s.sex; keys.push('sex'); }
    if (s.trainingLevel) {
      filled.experience = s.trainingLevel === 'beginner' ? 'beginner' : s.trainingLevel === 'intermediate' ? 'intermediate' : 'advanced';
      keys.push('experience');
    }
    if (s.primaryGoal) {
      const g: Record<string, GoalType> = { bulk: 'muscle_gain', cut: 'fat_loss', maintenance: 'recovery', strength: 'muscle_gain', endurance: 'endurance', health: 'immunity' };
      if (g[s.primaryGoal]) { filled.goals = [g[s.primaryGoal]]; keys.push('goals'); }
    }
    if (s.medicalConditions) {
      const hc: HealthCondition[] = [];
      for (const c of s.medicalConditions) {
        const cl = c.toLowerCase();
        if (cl.includes('liver') || cl.includes('печень')) hc.push('liver');
        if (cl.includes('kidney') || cl.includes('почк')) hc.push('kidney');
        if (cl.includes('heart') || cl.includes('сердц')) hc.push('heart');
        if (cl.includes('thyroid') || cl.includes('щитов')) hc.push('thyroid');
        if (cl.includes('stomach') || cl.includes('желуд')) hc.push('stomach');
        if (cl.includes('diabet') || cl.includes('диабет')) hc.push('diabetes');
        if (cl.includes('autoim') || cl.includes('аутоим')) hc.push('autoimmune');
        if (cl.includes('pressure') || cl.includes('давлен')) { hc.push('pressure_high'); }
      }
      if (hc.length > 0) { filled.healthConditions = hc; keys.push('healthConditions'); }
    }
    if ((s as any).currentMedications?.length) {
      filled.currentMeds = (s as any).currentMedications.map((m: any) => m.name || String(m));
      keys.push('currentMeds');
    }
    if ((s as any).allergies?.length) {
      filled.drugAllergies = (s as any).allergies;
      keys.push('drugAllergies');
    }
    return { patch: filled, autoKeys: keys };
  } catch { return { patch: {}, autoKeys: [] }; }
}

export function saveBioStackProfile(p: BioStackProfile): void {
  try { localStorage.setItem('he_biostack_profile', JSON.stringify(p)); } catch {}
}

export function loadBioStackProfile(): BioStackProfile {
  try {
    const raw = localStorage.getItem('he_biostack_profile');
    if (raw) return { ...getDefaultBioStackProfile(), ...JSON.parse(raw) };
  } catch {}
  return getDefaultBioStackProfile();
}
