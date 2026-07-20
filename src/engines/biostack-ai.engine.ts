import { SUPPORT_CATALOG_DATA, SYSTEM_LABELS_CATALOG, ORGAN_LABELS } from '../data/support-database';
import { getProfile, updateProfile } from '../core/profile-manager';
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
  avoidIds: string[]; avoidMeds: string[];
  currentMeds: string[]; drugAllergies: string[];
  jointSymptoms: string[];
  neuroSymptoms: string[];
  cnsSymptoms: string[];
  currentSupplements: string[];
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
  personal: ['age','weight','height','sex'],
  lifestyle: ['avoidIds', 'avoidMeds'],
  clinical: ['currentMeds','drugAllergies'],
  symptoms: ['jointSymptoms','neuroSymptoms','cnsSymptoms'],
  supplements: ['currentSupplements'],
};

const AUTO_FILLABLE_KEYS = new Set([
  'age','weight','height','sex','currentMeds','drugAllergies',
  'neuroSymptoms','cnsSymptoms','jointSymptoms','currentSupplements',
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
    avoidIds: [], avoidMeds: [],
    currentMeds: [], drugAllergies: [],
    jointSymptoms: [], neuroSymptoms: [], cnsSymptoms: [],
    currentSupplements: [],
    autoFilledFields: [],
  };
}

export function autoFillFromMainProfile(): { patch: Partial<BioStackProfile>; autoKeys: string[] } {
  try {
    const p = getProfile(); if (!p) return { patch: {}, autoKeys: [] };
    const s = p.settings; if (!s) return { patch: {}, autoKeys: [] };
    const filled: Partial<BioStackProfile> = {};
    const keys: string[] = [];
    const ss = s as any;
    if (ss.personal?.age) { filled.age = ss.personal.age; keys.push('age'); }
    if (ss.personal?.weight) { filled.weight = ss.personal.weight; keys.push('weight'); }
    if (ss.personal?.height) { filled.height = ss.personal.height; keys.push('height'); }
    if (ss.personal?.sex) { filled.sex = ss.personal.sex; keys.push('sex'); }
    if (ss.nutrition?.currentMedications?.length) {
      filled.currentMeds = ss.nutrition.currentMedications.map((m: any) => m.name || String(m));
      keys.push('currentMeds');
    }
    if (ss.health?.drugAllergies?.length) {
      filled.drugAllergies = ss.health.drugAllergies;
      keys.push('drugAllergies');
    }
    if (ss.nutrition?.currentSupplements?.length) {
      const sups = (ss.nutrition.currentSupplements as any[]).map(su => su.id || String(su)).filter(Boolean);
      if (sups.length > 0) { filled.currentSupplements = sups; keys.push('currentSupplements'); }
    }
    return { patch: filled, autoKeys: keys };
  } catch { return { patch: {}, autoKeys: [] }; }
}

/** Дублировать заполненные данные BioStack-профиля в основной профиль (подвкладки Профиль) */
export function syncBioStackToMain(p: BioStackProfile): void {
  try {
    const prof = getProfile(); if (!prof) return;
    const s = prof.settings as any; if (!s) return;
    if (p.age) s.personal = { ...(s.personal || {}), age: p.age };
    if (p.weight) s.personal = { ...s.personal, weight: p.weight };
    if (p.height) s.personal = { ...s.personal, height: p.height };
    if (p.sex) s.personal = { ...s.personal, sex: p.sex };
    if (p.drugAllergies?.length) s.health = { ...s.health, drugAllergies: p.drugAllergies };
    if (p.currentMeds?.length) {
      s.nutrition = { ...(s.nutrition || {}), currentMedications: p.currentMeds.map(m => ({ id: m, name: m, doseMg: 0, doseUnit: 'mg' as const, frequency: 'daily' as const })) };
    }
    if (p.currentSupplements?.length) {
      const supDb = SUPPORT_CATALOG_DATA as any;
      s.nutrition = { ...s.nutrition, currentSupplements: p.currentSupplements.map(id => ({ id, name: supDb[id]?.name || id, doseMg: 0, doseUnit: 'mg' as const })) };
    }
    prof.settings = s;
    updateProfile({ settings: s });
  } catch {}
}

export function saveBioStackProfile(p: BioStackProfile): void {
  try {
    localStorage.setItem('he_biostack_profile', JSON.stringify(p));
    syncBioStackToMain(p);
  } catch {}
}

export function loadBioStackProfile(): BioStackProfile {
  try {
    const raw = localStorage.getItem('he_biostack_profile');
    if (raw) return { ...getDefaultBioStackProfile(), ...JSON.parse(raw) };
  } catch {}
  return getDefaultBioStackProfile();
}
