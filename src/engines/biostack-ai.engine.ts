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
  healthConditions: HealthCondition[]; budget: BudgetLevel; avoidIds: string[];
  maxStackSize: number;
  cognitiveTask: CognitiveTask; stimSensitivity: StimSensitivity;
  anxietyLevel: number; sleepQuality: number; caffeineLevel: CaffeineLevel;
  adClass: ADClass; bpSystolic: number; bpDiastolic: number;
  gutSensitivity: GutSensitivity; smoke: boolean; alcoholLevel: AlcoholLevel;
  dietType: DietType; chronotype: Chronotype; stressLevel: number;
  currentSupplements: string[]; stackComplexity: StackComplexity;
}

export function getDefaultBioStackProfile(): BioStackProfile {
  return {
    age: 30, weight: 80, height: 175, sex: 'male',
    experience: 'intermediate', goals: ['muscle_gain'],
    aasStatus: 'none', healthConditions: [], budget: 'medium',
    avoidIds: [], maxStackSize: 8,
    cognitiveTask: 'focus', stimSensitivity: 'medium',
    anxietyLevel: 5, sleepQuality: 7, caffeineLevel: 'moderate',
    adClass: 'none', bpSystolic: 120, bpDiastolic: 80,
    gutSensitivity: 'normal', smoke: false, alcoholLevel: 'rare',
    dietType: 'mixed', chronotype: 'mixed', stressLevel: 5,
    currentSupplements: [], stackComplexity: 'balanced',
  };
}

export function autoFillFromMainProfile(): Partial<BioStackProfile> {
  try {
    const p = getProfile(); if (!p) return {};
    const s = p.settings; if (!s) return {};
    const filled: Partial<BioStackProfile> = {};
    if (s.age) filled.age = s.age;
    if (s.weight) filled.weight = s.weight;
    if (s.height) filled.height = s.height;
    if (s.sex) filled.sex = s.sex;
    if (s.trainingLevel) {
      filled.experience = s.trainingLevel === 'beginner' ? 'beginner' : s.trainingLevel === 'intermediate' ? 'intermediate' : 'advanced';
    }
    if (s.primaryGoal) {
      const g: Record<string, GoalType> = { bulk: 'muscle_gain', cut: 'fat_loss', maintenance: 'recovery', strength: 'muscle_gain', endurance: 'endurance', health: 'immunity' };
      if (g[s.primaryGoal]) filled.goals = [g[s.primaryGoal]];
    }
    if (s.chronotype) filled.chronotype = s.chronotype as Chronotype;
    if (s.baselineSleepQuality) filled.sleepQuality = s.baselineSleepQuality;
    if (s.baselineStressLevel !== undefined) filled.stressLevel = s.baselineStressLevel;
    if (s.dietType) {
      const d: Record<string, DietType> = { omnivore: 'mixed', vegetarian: 'vegetarian', vegan: 'vegan', keto: 'keto', paleo: 'paleo', mediterranean: 'mediterranean' };
      if (d[s.dietType]) filled.dietType = d[s.dietType];
    }
    if (s.smoke !== undefined) filled.smoke = s.smoke;
    if (s.currentSupplements) filled.currentSupplements = s.currentSupplements.map((x: any) => x.id || x.name || String(x));
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
      if (hc.length > 0) filled.healthConditions = hc;
    }
    return filled;
  } catch { return {}; }
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
