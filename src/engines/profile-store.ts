import { getProfile, updateProfile } from '../core/profile-manager';
import type { UserProfile, InjuryRecord, SupplementEntry, MedicationEntry } from '../core/types';

/* ── localStorage keys ── */
const KEYS = {
  biostack: 'he_biostack_profile',
  training: 'he_training_profile',
  finder: 'he_finder_profile',
  nutrition: 'he_nutrition_profile',
  weight: 'he_weight_log',
  measurements: 'he_measurements_log',
  bp: 'he_bp_diary',
  autocalc: 'he_autocalc_state',
} as const;

/* ── Weight / Measurement helpers ── */
export interface WeightEntry { date: string; weight: number; }
export function getWeightLog(): WeightEntry[] {
  try { return JSON.parse(localStorage.getItem(KEYS.weight) || '[]'); } catch { return []; }
}
export function saveWeightLog(log: WeightEntry[]) {
  localStorage.setItem(KEYS.weight, JSON.stringify(log.slice(-90)));
}

export interface MeasurementEntry {
  date: string; waistCm: number; chestCm: number; hipCm: number;
  bicepCm: number; thighCm: number; neckCm: number; forearmCm: number; bodyFat: number;
}
export function getMeasurementsLog(): MeasurementEntry[] {
  try { return JSON.parse(localStorage.getItem(KEYS.measurements) || '[]'); } catch { return []; }
}
export function saveMeasurementsLog(log: MeasurementEntry[]) {
  localStorage.setItem(KEYS.measurements, JSON.stringify(log.slice(-30)));
}

/* ── BioStack profile sync ── */
export function syncBioStackProfile(settings: UserProfile['settings']): void {
  try {
    const p: Record<string, any> = {};
    if (settings.age) p.age = settings.age;
    if (settings.weight) p.weight = settings.weight;
    if (settings.height) p.height = settings.height;
    if (settings.sex) p.sex = settings.sex;
    if (settings.trainingLevel) {
      p.experience = settings.trainingLevel === 'beginner' ? 'beginner'
        : settings.trainingLevel === 'intermediate' ? 'intermediate' : 'advanced';
    }
    if (settings.primaryGoal) {
      const g: Record<string, string> = {
        bulk: 'muscle_gain', cut: 'fat_loss', maintenance: 'recovery',
        strength: 'muscle_gain', endurance: 'endurance', health: 'immunity'
      };
      if (g[settings.primaryGoal]) p.goals = [g[settings.primaryGoal]];
    }
    if (settings.medicalConditions?.length) {
      const hc: string[] = [];
      for (const c of settings.medicalConditions) {
        const cl = c.toLowerCase();
        if (cl.includes('liver') || cl.includes('печень')) hc.push('liver');
        if (cl.includes('kidney') || cl.includes('почк')) hc.push('kidney');
        if (cl.includes('heart') || cl.includes('сердц')) hc.push('heart');
        if (cl.includes('thyroid') || cl.includes('щитов')) hc.push('thyroid');
        if (cl.includes('diabet') || cl.includes('диабет')) hc.push('diabetes');
        if (cl.includes('autoim') || cl.includes('аутоим')) hc.push('autoimmune');
      }
      if (hc.length) p.healthConditions = hc;
    }
    const existing = loadLocal(KEYS.biostack, {});
    saveLocal(KEYS.biostack, { ...existing, ...p });
  } catch { /* silent */ }
}

/* ── Training profile sync ── */
export function syncTrainingProfile(settings: UserProfile['settings']): void {
  try {
    const p: Record<string, any> = {};
    if (settings.weight) p.bodyWeight = settings.weight;
    if (settings.primaryGoal) p.goal = settings.primaryGoal;
    if (settings.trainingLevel) p.level = settings.trainingLevel;
    if (settings.workoutsPerWeek) p.daysPerWeek = settings.workoutsPerWeek;
    if (settings.baselineSleepHours) p.sleepHours = settings.baselineSleepHours;
    if (settings.baselineStressLevel) p.stressLevel = settings.baselineStressLevel;
    if (settings.fatigueLevel) p.fatigue = settings.fatigueLevel;
    if (settings.weakPoints?.length) p.weakPoints = settings.weakPoints;
    if (settings.injuries?.length) p.injuries = settings.injuries.map(i => ({ muscle: i.location, from: i.date }));
    const existing = loadLocal(KEYS.training, {});
    saveLocal(KEYS.training, { ...existing, ...p });
  } catch { /* silent */ }
}

/* ── Nutrition profile sync ── */
export function syncNutritionProfile(settings: UserProfile['settings']): void {
  try {
    const p: Record<string, any> = {};
    if (settings.primaryGoal) p.primaryGoal = settings.primaryGoal;
    if (settings.dietType) p.dietType = settings.dietType;
    if (settings.mealsPerDay) p.mealsCount = settings.mealsPerDay;
    if (settings.foodAllergies?.length) p.allergens = settings.foodAllergies;
    if (settings.medicalConditions?.length) p.healthIssues = settings.medicalConditions;
    const existing = loadLocal(KEYS.nutrition, {});
    saveLocal(KEYS.nutrition, { ...existing, ...p });
  } catch { /* silent */ }
}

/* ── Universal profile sync (call after any settings save) ── */
export function syncAllProfiles(settings: UserProfile['settings']): void {
  syncBioStackProfile(settings);
  syncTrainingProfile(settings);
  syncNutritionProfile(settings);
}

/* ── localStorage helpers ── */
function loadLocal<T>(key: string, fallback: T): T {
  try { return { ...fallback, ...JSON.parse(localStorage.getItem(key) || 'null') }; } catch { return fallback; }
}
function saveLocal(key: string, data: any): void {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch { /* quota */ }
}

/* ─── READYNESS CALC ─── */
export function calcReadinessFromSettings(settings: UserProfile['settings']) {
  const { calcReadiness } = require('../engines/readiness.engine');
  return calcReadiness({
    sleepHours: settings.baselineSleepHours ?? 7,
    sleepQuality: settings.baselineSleepQuality ?? 5,
    nightAwakenings: settings.nightAwakenings ?? 1,
    hrvRatio: settings.baselineHrvRatio ?? 1.0,
    doms: 2, stress: settings.baselineStressLevel ?? 3,
    calRatio: settings.nutritionFactor ?? 0.8, proteinRatio: 0.8,
    waterRatio: 0.7, fiberRatio: 0.6, omega3Flag: false,
    trainingLoadRatio: settings.trainingFactor ?? 0.6,
    subjFatigue: settings.fatigueLevel ?? 3, hrIncrease: 0.1,
    chronotype: settings.chronotype, bedtime: settings.bedtime, wakeTime: settings.wakeTime,
  });
}
