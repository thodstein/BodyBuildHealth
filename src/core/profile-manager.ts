import { UserRole, UserProfile, UnifiedSettings, getDefaultSettings } from "./types";
import { useState, useEffect } from "react";

const STORAGE_KEY = "he_profile_v2";
const MIGRATED_FLAG = 'he_profile_migrated_v2';
const REMOVED_BIOSTACK_KEYS = [
  'he_biostack_stacks_v2', 'he_biostack_active_idx', 'he_biostack_active',
  'he_biostack_favorites', 'he_biostack_gate_cache', 'he_biostack_to_plan',
  'he_biostack_compliance', 'he_biostack_start_date', 'he_biostack_tab',
  'he_biostack_profile', 'he_biostack_reminders',
];

function cleanupRemovedBioStackStorage(): void {
  try {
    for (const key of REMOVED_BIOSTACK_KEYS) localStorage.removeItem(key);
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key?.startsWith('he_biostack_name_')) localStorage.removeItem(key);
    }
  } catch {}
}

type ProfileListener = () => void;
const listeners: Set<ProfileListener> = new Set();

export function onProfileChange(fn: ProfileListener): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export function notifyAll() {
  listeners.forEach(fn => { try { fn(); } catch {} });
}

/* ── Backward-compat: old flat paths → nested ── */
const FLAT_TO_NESTED: Record<string, string[]> = {
  age:['personal','age'], weight:['personal','weight'], height:['personal','height'],
  sex:['personal','sex'], bodyFat:['personal','bodyFat'], bloodType:['personal','bloodType'],
  emergencyName:['personal','emergencyName'], emergencyPhone:['personal','emergencyPhone'],
  sportType:['training','sportType'], trainingExperience:['training','experience'],
  trainingLevel:['training','level'], workoutsPerWeek:['training','daysPerWeek'],
  avgWorkoutMinutes:['training','minutesPerSession'],
  primaryGoal:['training','primaryGoal'], goal:['training','primaryGoal'],
  weakPoints:['training','weakPoints'], pmSquat:['training','pmSquat'],
  pmBench:['training','pmBench'], pmDead:['training','pmDeadlift'],
  workMax:['training','workMax'], equipment:['training','equipment'],
  recovery:['training','recovery'], motivation:['training','motivation'],
  doms:['training','doms'],
  phase:['pharma','phase'], courseStartDate:['pharma','courseStartDate'],
  pharmaExperience:['pharma','experience'], totalCycles:['pharma','totalCycles'],
  trainingCycleGoal:['pharma','trainingCycleType'], cycleWeeks:['pharma','trainingCycleWeeks'],
  previousCycles:['pharma','previousCycles'], timeSinceLastCycle:['pharma','timeSinceLastCycle'],
  yearsOnGear:['pharma','yearsOnGear'], monthsSinceLastCourse:['pharma','monthsSinceLastCourse'],
  hcgEnabled:['pharma','hcgEnabled'], aiEnabled:['pharma','aiEnabled'],
  chronicConditions:['health','chronicConditions'], genetics:['health','genetics'],
  injuries:['health','injuries'], excludedSupplements:['health','excludedSupplements'],
  excludedMeds:['health','excludedMeds'], allergyNotes:['health','drugAllergies'],
  drugAllergies:['health','drugAllergies'],
  dietType:['nutrition','dietType'], mealsPerDay:['nutrition','mealsPerDay'],
  cookingSkill:['nutrition','cookingSkill'], foodAllergies:['nutrition','foodAllergies'],
  foodIntolerances:['nutrition','foodIntolerances'], excludedFoods:['nutrition','excludedFoods'],
  preferredFoods:['nutrition','preferredFoods'], proteinPerKg:['nutrition','proteinPerKg'],
  fiberG:['nutrition','fiberG'], omega3G:['nutrition','omega3G'],
  sodiumG:['nutrition','sodiumG'], potassiumG:['nutrition','potassiumG'],
  alcoholPerWeek:['nutrition','alcoholPerWeek'], currentSupplements:['nutrition','currentSupplements'],
  currentMedications:['nutrition','currentMedications'],
  baselineSleepHours:['lifestyle','sleepHours'], sleepHours:['lifestyle','sleepHours'],
  baselineSleepQuality:['lifestyle','sleepQuality'], sleepQuality:['lifestyle','sleepQuality'],
  chronotype:['lifestyle','chronotype'], bedtime:['lifestyle','bedtime'],
  wakeTime:['lifestyle','wakeTime'], baselineHrvRatio:['lifestyle','baselineHrvRatio'],
  hrvRatio:['lifestyle','baselineHrvRatio'], fatigueLevel:['lifestyle','fatigueLevel'],
  baselineStressLevel:['lifestyle','stressLevel'], stressLevel:['lifestyle','stressLevel'],
  dailySteps:['lifestyle','dailySteps'], dailyWaterLiters:['lifestyle','dailyWaterLiters'],
  smoke:['lifestyle','smoke'], activityLevel:['lifestyle','activityLevel'],
  nightAwakenings:['lifestyle','nightAwakenings'],
  mcRuns:['system','mcRuns'], forceNoLabsPenalty:['system','forceNoLabsPenalty'],
  preferredUnits:['system','preferredUnits'], notificationsEnabled:['system','notificationsEnabled'],
  privacyLevel:['system','privacyLevel'], nutritionFactor:['system','nutritionFactor'],
  trainingFactor:['system','trainingFactor'], hasHIIT:['system','hasHIIT'],
  volumeTonnes:['system','volumeTonnes'], lissMinutesPerWeek:['system','lissMinutesPerWeek'],
  targetWeight:['system','targetWeight'],
  targetBodyFat:['system','targetBodyFat'], email:['system','email'],
  goalTimelineWeeks:['system','goalTimelineWeeks'], secondaryGoals:['system','secondaryGoals'],
};

const NESTED_SECTIONS = ['personal','training','pharma','health','nutrition','lifestyle','system'] as const;

function makeSettingsProxy(s: UnifiedSettings): UnifiedSettings {
  for (const sec of NESTED_SECTIONS) {
    if ((s as any)[sec] === undefined || (s as any)[sec] === null) {
      (s as any)[sec] = {};
    }
  }
  return new Proxy(s, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && FLAT_TO_NESTED[prop]) {
        const [section, field] = FLAT_TO_NESTED[prop];
        const sec = (target as any)[section];
        return sec !== undefined ? sec[field] : undefined;
      }
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      if (typeof prop === 'string' && FLAT_TO_NESTED[prop]) {
        const [section, field] = FLAT_TO_NESTED[prop];
        const sec = (target as any)[section];
        if (sec !== undefined) { sec[field] = value; return true; }
      }
      return Reflect.set(target, prop, value, receiver);
    },
  }) as UnifiedSettings;
}

/* Читает профиль из localStorage с backward-compat proxy для settings. */
export function getProfile(): UserProfile {
  try {
    cleanupRemovedBioStackStorage();
    const saved = localStorage.getItem(STORAGE_KEY);
    const p: UserProfile = saved ? JSON.parse(saved) : getDefaultProfile();
    p.settings = makeSettingsProxy(p.settings);
    return p;
  } catch { return getDefaultProfile(); }
}

/**
 * Сохраняет профиль.
 * При первом сохранении после миграции (MIGRATED_FLAG есть) удаляет старые дублирующие хранилища.
 */
export function updateProfile(ctx: Partial<UserProfile>): UserProfile {
  const current = getProfile();
  const updated = { ...current, ...ctx };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  // При первом сохранении после миграции — зачистка старых хранилищ
  if (localStorage.getItem(MIGRATED_FLAG) && !localStorage.getItem('he_profile_cleanup_done')) {
    try { localStorage.removeItem('he_training_profile'); } catch {}
    try { localStorage.removeItem('he_autocalc_state'); } catch {}
    try { localStorage.removeItem('he_biostack_profile'); } catch {}
    localStorage.setItem('he_profile_cleanup_done', '1');
  }
  notifyAll();
  return updated;
}

export function setRole(role: UserRole): void {
  const current = getProfile();
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, role }));
  notifyAll();
}

function getDefaultProfile(): UserProfile {
  return {
    name: "",
    id: "",
    role: "user",
    settings: getDefaultSettings(),
  };
}

export function useProfileRefresh(): UserProfile {
  const [profile, setProfile] = useState<UserProfile>(getProfile());
  useEffect(() => {
    return onProfileChange(() => setProfile(getProfile()));
  }, []);
  return profile;
}
