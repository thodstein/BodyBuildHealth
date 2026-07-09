/**
 * unified-profile.ts — единый источник данных пользователя.
 * Однократная миграция из 4 старых хранилищ + хелперы чтения/записи.
 * Все новые компоненты пишут/читают ТОЛЬКО через getSettings/updateSettings.
 */
import type { UnifiedSettings, UserProfile, PharmaSubstanceEntry } from '../core/types';
import { getDefaultSettings } from '../core/types';
import { getProfile as getOldProfile, updateProfile as saveProfile } from '../core/profile-manager';

/* ── Старые ключи для миграции ── */
const LEGACY_KEYS = {
  training: 'he_training_profile',
  autocalc: 'he_autocalc_state',
  biostack: 'he_biostack_profile',
};

/* ── Флаг миграции ── */
const MIGRATED_FLAG = 'he_profile_migrated_v2';

/* ================================================================
 *  MIGRATION
 * ================================================================ */

function merge<T extends Record<string, any>>(a: T, b: Partial<T>): T {
  const r = { ...a };
  for (const k of Object.keys(b)) {
    if (b[k] !== undefined && b[k] !== null) {
      (r as any)[k] = b[k];
    }
  }
  return r;
}

function parseLocal<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; }
}

/**
 * Мигрирует старые хранилища (he_profile + he_training_profile + he_autocalc_state + he_biostack_profile)
 * в единую UnifiedSettings. Запускается один раз при getSettings().
 */
export function migrateToUnified(): UnifiedSettings {
  const s = getDefaultSettings();

  // 1. Старый профиль (he_profile_v2 / he_profile)
  const old = getOldProfile();
  const o: any = old.settings || {};

  // personal
  s.personal.age = o.age ?? s.personal.age;
  s.personal.sex = o.sex ?? s.personal.sex;
  s.personal.height = o.height ?? s.personal.height;
  s.personal.weight = o.weight ?? s.personal.weight;
  s.personal.bodyFat = o.bodyFat ?? s.personal.bodyFat;
  s.personal.bloodType = o.bloodType ?? s.personal.bloodType;
  s.personal.emergencyName = o.emergencyName ?? s.personal.emergencyName;
  s.personal.emergencyPhone = o.emergencyPhone ?? s.personal.emergencyPhone;

  // training (из плоских полей старого профиля)
  s.training.sportType = o.sportType ?? s.training.sportType;
  s.training.experience = o.trainingExperience ?? s.training.experience;
  s.training.level = o.trainingLevel ?? s.training.level;
  s.training.daysPerWeek = o.workoutsPerWeek ?? s.training.daysPerWeek;
  s.training.minutesPerSession = o.avgWorkoutMinutes ?? s.training.minutesPerSession;
  s.training.primaryGoal = o.primaryGoal ?? o.goal ?? s.training.primaryGoal;
  s.training.weakPoints = o.weakPoints ?? s.training.weakPoints;

  // pharma (из плоских)
  s.pharma.phase = o.phase ?? s.pharma.phase;
  s.pharma.courseStartDate = o.courseStartDate ?? s.pharma.courseStartDate;
  s.pharma.experience = o.pharmaExperience ?? s.pharma.experience;
  s.pharma.totalCycles = o.totalCycles ?? s.pharma.totalCycles;
  s.pharma.trainingCycleType = o.trainingCycleGoal ?? s.pharma.trainingCycleType;
  s.pharma.trainingCycleWeeks = o.cycleWeeks ?? s.pharma.trainingCycleWeeks;
  s.pharma.previousCycles = o.previousCycles ?? s.pharma.previousCycles;
  if (o.timeSinceLastCycle) s.pharma.timeSinceLastCycle = mapTimeSinceOld(o.timeSinceLastCycle);

  // health (из плоских)
  s.health.chronicConditions = o.chronicConditions ?? s.health.chronicConditions;
  s.health.genetics = o.genetics ?? s.health.genetics;
  s.health.injuries = o.injuries ?? s.health.injuries;
  // health.contraindications — маппинг из old calcData
  if (o.excludedSupplements) {
    s.health.excludedSupplements = String(o.excludedSupplements).split(',').map((x: string) => x.trim()).filter(Boolean);
  }
  if (o.excludedMeds) {
    s.health.excludedMeds = String(o.excludedMeds).split(',').map((x: string) => x.trim()).filter(Boolean);
  }
  s.health.drugAllergies = o.allergyNotes ?? s.health.drugAllergies;

  // nutrition (из плоских)
  s.nutrition.dietType = o.dietType ?? s.nutrition.dietType;
  s.nutrition.mealsPerDay = o.mealsPerDay ?? s.nutrition.mealsPerDay;
  s.nutrition.cookingSkill = o.cookingSkill ?? s.nutrition.cookingSkill;
  s.nutrition.foodAllergies = o.foodAllergies ?? s.nutrition.foodAllergies;
  s.nutrition.foodIntolerances = o.foodIntolerances ?? s.nutrition.foodIntolerances;
  s.nutrition.excludedFoods = o.excludedFoods ?? s.nutrition.excludedFoods;
  s.nutrition.preferredFoods = o.preferredFoods ?? s.nutrition.preferredFoods;
  s.nutrition.proteinPerKg = o.proteinPerKg ?? s.nutrition.proteinPerKg;
  s.nutrition.fiberG = o.fiberG ?? s.nutrition.fiberG;
  s.nutrition.omega3G = o.omega3G ?? s.nutrition.omega3G;
  s.nutrition.sodiumG = o.sodiumG ?? s.nutrition.sodiumG;
  s.nutrition.potassiumG = o.potassiumG ?? s.nutrition.potassiumG;
  s.nutrition.alcoholPerWeek = o.alcoholPerWeek ?? s.nutrition.alcoholPerWeek;
  s.nutrition.currentSupplements = o.currentSupplements ?? s.nutrition.currentSupplements;
  s.nutrition.currentMedications = o.currentMedications ?? s.nutrition.currentMedications;

  // lifestyle (из плоских)
  s.lifestyle.sleepHours = o.sleepHours ?? o.baselineSleepHours ?? s.lifestyle.sleepHours;
  s.lifestyle.sleepQuality = 'fair';
  s.lifestyle.chronotype = o.chronotype ?? s.lifestyle.chronotype;
  s.lifestyle.stressLevel = o.stressLevel ?? o.baselineStressLevel ?? s.lifestyle.stressLevel;
  s.lifestyle.fatigueLevel = o.fatigueLevel ?? s.lifestyle.fatigueLevel;
  s.lifestyle.baselineHrvRatio = o.baselineHrvRatio ?? s.lifestyle.baselineHrvRatio;
  s.lifestyle.dailySteps = o.dailySteps ?? s.lifestyle.dailySteps;
  s.lifestyle.dailyWaterLiters = o.dailyWaterLiters ?? s.lifestyle.dailyWaterLiters;
  s.lifestyle.smoke = o.smoke ?? s.lifestyle.smoke;
  s.lifestyle.activityLevel = o.activityLevel ?? s.lifestyle.activityLevel;
  s.lifestyle.bedtime = o.bedtime ?? s.lifestyle.bedtime;
  s.lifestyle.wakeTime = o.wakeTime ?? s.lifestyle.wakeTime;
  s.lifestyle.nightAwakenings = o.nightAwakenings ?? s.lifestyle.nightAwakenings;

  // system (из плоских)
  s.system.mcRuns = o.mcRuns ?? s.system.mcRuns;
  s.system.forceNoLabsPenalty = o.forceNoLabsPenalty ?? s.system.forceNoLabsPenalty;
  s.system.preferredUnits = o.preferredUnits ?? s.system.preferredUnits;
  s.system.notificationsEnabled = o.notificationsEnabled ?? s.system.notificationsEnabled;
  s.system.privacyLevel = o.privacyLevel ?? s.system.privacyLevel;
  s.system.nutritionFactor = o.nutritionFactor ?? s.system.nutritionFactor;
  s.system.trainingFactor = o.trainingFactor ?? s.system.trainingFactor;
  s.system.hasHIIT = o.hasHIIT ?? s.system.hasHIIT;
  s.system.volumeTonnes = o.volumeTonnes ?? s.system.volumeTonnes;
  s.system.lissMinutesPerWeek = o.lissMinutesPerWeek ?? s.system.lissMinutesPerWeek;
  s.system.targetWeight = o.targetWeight ?? s.system.targetWeight;
  s.system.targetBodyFat = o.targetBodyFat ?? s.system.targetBodyFat;
  s.system.email = o.email ?? s.system.email;

  // 2. Training profile (he_training_profile)
  const tp = parseLocal(LEGACY_KEYS.training, {} as any);
  if (tp.bodyWeight) s.personal.weight = tp.bodyWeight;
  if (tp.goal) s.training.primaryGoal = tp.goal;
  if (tp.level) s.training.level = tp.level;
  if (tp.daysPerWeek) s.training.daysPerWeek = tp.daysPerWeek;
  if (tp.recovery) s.training.recovery = tp.recovery;
  if (tp.fatigue !== undefined) s.lifestyle.fatigueLevel = tp.fatigue;
  if (tp.sleepHours) s.lifestyle.sleepHours = tp.sleepHours;
  if (tp.stressLevel) s.lifestyle.stressLevel = tp.stressLevel;
  if (tp.weakPoints?.length) s.training.weakPoints = tp.weakPoints;
  if (tp.equipment?.length) s.training.equipment = tp.equipment;
  if (tp.pmSquat) s.training.pmSquat = tp.pmSquat;
  if (tp.pmBench) s.training.pmBench = tp.pmBench;
  if (tp.pmDead) s.training.pmDeadlift = tp.pmDead;
  if (tp.workMax) s.training.workMax = merge(s.training.workMax, tp.workMax);
  if (tp.onCourse !== undefined) s.pharma.phase = tp.onCourse ? 'course' : 'baseline';
  if (tp.courseIntensity) {
    if (tp.courseIntensity === 'heavy') s.pharma.yearsOnGear = Math.max(s.pharma.yearsOnGear, 5);
    else if (tp.courseIntensity === 'moderate') s.pharma.yearsOnGear = Math.max(s.pharma.yearsOnGear, 2);
  }
  if (tp.pharmaCoursesCount) s.pharma.totalCycles = tp.pharmaCoursesCount;
  if (tp.monthsSinceLastCourse) s.pharma.monthsSinceLastCourse = tp.monthsSinceLastCourse;
  if (tp.totalYearsOnPharma) s.pharma.yearsOnGear = tp.totalYearsOnPharma;
  if (tp.trainingYears) s.training.experience = tp.trainingYears;
  if (tp.motivation) s.training.motivation = tp.motivation;
  if (tp.doms) s.training.doms = tp.doms;

  // 3. AutoCalc state (he_autocalc_state)
  const ac = parseLocal(LEGACY_KEYS.autocalc, {} as any);
  if (ac.neuro) {
    s.health.dopamineScore = ac.neuro.dopamineScore ?? s.health.dopamineScore;
    s.health.serotoninScore = ac.neuro.serotoninScore ?? s.health.serotoninScore;
    s.health.aggressionScore = ac.neuro.aggressionScore ?? s.health.aggressionScore;
    s.health.memoryIssues = ac.neuro.memoryIssues ?? s.health.memoryIssues;
    s.health.focusIssues = ac.neuro.focusIssues ?? s.health.focusIssues;
    s.health.slowThinking = ac.neuro.slowThinking ?? s.health.slowThinking;
    s.health.headaches = ac.neuro.headaches ?? s.health.headaches;
    s.health.weatherDependent = ac.neuro.weatherDependent ?? s.health.weatherDependent;
    if (ac.neuro.sleepQuality) {
      s.lifestyle.sleepQuality = (ac.neuro.sleepQuality === 'good' || ac.neuro.sleepQuality === 'fair' || ac.neuro.sleepQuality === 'poor')
        ? ac.neuro.sleepQuality : 'fair';
    }
  }
  if (ac.oda) {
    s.health.jointPain = ac.oda.jointPain === 'mild' || ac.oda.jointPain === true;
    s.health.ligamentIssues = !!ac.oda.ligamentIssues;
    s.health.backPain = !!ac.oda.backPain;
  }
  if (ac.psych) {
    s.health.fearOfLoss = ac.psych.fearOfLoss ?? s.health.fearOfLoss;
    s.health.mirrorObsession = ac.psych.mirrorObsession ?? s.health.mirrorObsession;
    s.health.apathyOffCycle = ac.psych.apathyOffCycle ?? s.health.apathyOffCycle;
  }
  if (ac.cardio) {
    s.health.bpStage = ac.cardio.bpStage ?? s.health.bpStage;
    s.health.hctElevation = ac.cardio.hctElevation ?? s.health.hctElevation;
    s.health.heartRate = ac.cardio.heartRate ?? s.health.heartRate;
    s.health.ldlElevation = ac.cardio.ldlElevation ?? s.health.ldlElevation;
    s.health.hdlLow = ac.cardio.hdlLow ?? s.health.hdlLow;
    s.health.previousCVD = ac.cardio.previousCVD ?? s.health.previousCVD;
    s.health.familyCVD = ac.cardio.familyCVD ?? s.health.familyCVD;
    s.health.triglycerides = ac.cardio.triglycerides ?? s.health.triglycerides;
  }
  if (ac.gi) {
    s.health.bloating = !!ac.gi.bloating;
    s.health.heartburn = !!ac.gi.heartburn;
    s.health.constipation = !!ac.gi.constipation;
    s.health.diarrhea = !!ac.gi.diarrhea;
    s.health.diagnosedIBS = !!ac.gi.diagnosedIBS;
    s.health.enzymeSupport = !!ac.gi.enzymeSupport;
    s.health.probioticUse = !!ac.gi.probioticUse;
  }
  if (ac.epicrisis) {
    s.health.pastGyno = !!ac.epicrisis.pastGyno;
    s.health.pastLibidoDrop = !!ac.epicrisis.pastLibidoDrop;
    s.health.pastHctSpike = !!ac.epicrisis.pastHctSpike;
    s.health.pastLiverIssues = !!ac.epicrisis.pastLiverIssues;
    s.health.pastKidneyIssues = !!ac.epicrisis.pastKidneyIssues;
  }
  if (ac.toxicLoad) {
    s.health.hazardousWork = !!ac.toxicLoad.hazardousWork;
    s.health.regularNSAIDs = !!ac.toxicLoad.regularNSAIDs;
  }
  if (ac.dental) {
    s.health.bleedingGums = !!ac.dental.bleedingGums;
    s.health.looseTeeth = !!ac.dental.looseTeeth;
    s.health.cramps = !!ac.dental.cramps;
  }
  if (ac.contraindications) {
    const c = s.health.contraindications;
    c.diabetes = !!ac.contraindications.hasDiabetes || c.diabetes;
    c.cvd = !!ac.contraindications.hasCVD || c.cvd;
    c.thrombophilia = !!ac.contraindications.hasThrombophilia || c.thrombophilia;
    c.liverDisease = !!ac.contraindications.hasLiverDisease || c.liverDisease;
    c.kidneyDisease = !!ac.contraindications.hasKidneyDisease || c.kidneyDisease;
    c.giDisease = !!ac.contraindications.hasGI || c.giDisease;
    c.prostateIssues = !!ac.contraindications.hasProstateIssues || c.prostateIssues;
    c.epilepsy = !!ac.contraindications.hasEpilepsy || c.epilepsy;
    c.mentalIllness = !!ac.contraindications.hasMentalIllness || c.mentalIllness;
    if (ac.contraindications.allergies) s.health.drugAllergies = ac.contraindications.allergies;
  }
  if (ac.goals) {
    s.pharma.trainingCycleWeeks = ac.goals.cycleWeeks ?? s.pharma.trainingCycleWeeks;
    s.pharma.previousCycles = ac.goals.previousCycles ?? s.pharma.previousCycles;
  }

  // 4. BioStack (he_biostack_profile)
  const bs = parseLocal(LEGACY_KEYS.biostack, {} as any);
  if (bs.age) s.personal.age = bs.age;
  if (bs.weight) s.personal.weight = bs.weight;
  if (bs.height) s.personal.height = bs.height;
  if (bs.sex) s.personal.sex = bs.sex;
  if (bs.aasStatus) s.pharma.phase = bs.aasStatus === 'on' ? 'course' : bs.aasStatus === 'pct' ? 'pct' : 'baseline';
  if (bs.experience) s.training.level = bs.experience;
  if (bs.healthConditions?.length) {
    for (const hc of bs.healthConditions) {
      if (hc === 'liver') s.health.chronicConditions = [...new Set([...s.health.chronicConditions, 'liver'])];
      if (hc === 'kidney') s.health.chronicConditions = [...new Set([...s.health.chronicConditions, 'kidney'])];
      if (hc === 'heart' || hc === 'cardio') s.health.chronicConditions = [...new Set([...s.health.chronicConditions, 'heart'])];
      if (hc === 'thyroid') s.health.chronicConditions = [...new Set([...s.health.chronicConditions, 'thyroid'])];
      if (hc === 'diabetes') { s.health.contraindications.diabetes = true; }
      if (hc === 'autoimmune') s.health.chronicConditions = [...new Set([...s.health.chronicConditions, 'autoimmune'])];
    }
  }

  return s;
}

function mapTimeSinceOld(v: string): UnifiedSettings['pharma']['timeSinceLastCycle'] {
  if (v === '<3mo' || v === '1-3mo') return '1-3mo';
  if (v === '3-6mo') return '3-6mo';
  if (v === '6-12mo' || v === '>6mo') return '6-12mo';
  if (v === '1y+' || v === '>1y+' || v === 'trt') return '1y+';
  return 'none';
}

/* ================================================================
 *  API
 * ================================================================ */

/** Получить единые настройки (с авто-миграцией при первом заходе). */
export function getSettings(): UnifiedSettings {
  if (!localStorage.getItem(MIGRATED_FLAG)) {
    const unified = migrateToUnified();
    // Сохраняем мигрированные данные
    const old = getOldProfile();
    updateSettings(unified, old.name, old.role, old.id);
    localStorage.setItem(MIGRATED_FLAG, '1');
    // Удаляем старые хранилища
    try { localStorage.removeItem(LEGACY_KEYS.training); } catch {}
    try { localStorage.removeItem(LEGACY_KEYS.autocalc); } catch {}
    try { localStorage.removeItem(LEGACY_KEYS.biostack); } catch {}
    return unified;
  }
  const old = getOldProfile();
  return (old.settings as UnifiedSettings) || getDefaultSettings();
}

/** Сохранить изменения в единых настройках (частичный patch). */
export function updateSettings(patch: Partial<UnifiedSettings>, name?: string, role?: string, id?: string): UnifiedSettings {
  const current = getSettings();
  const merged = { ...current };
  for (const section of Object.keys(patch) as (keyof UnifiedSettings)[]) {
    const val = patch[section];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      (merged as any)[section] = { ...(current as any)[section], ...val };
    } else if (val !== undefined) {
      (merged as any)[section] = val;
    }
  }
  const prof: Partial<UserProfile> = { settings: merged };
  if (name !== undefined) prof.name = name;
  if (role !== undefined) prof.role = role as any;
  if (id !== undefined) prof.id = id;
  saveProfile(prof as UserProfile);
  return merged;
}

/** Прочитать конкретную секцию. */
export function getSection<K extends keyof UnifiedSettings>(key: K): UnifiedSettings[K] {
  return getSettings()[key];
}

/** Обновить конкретную секцию. */
export function updateSection<K extends keyof UnifiedSettings>(key: K, patch: Partial<UnifiedSettings[K]>): void {
  const s = getSettings();
  (s as any)[key] = { ...(s as any)[key], ...patch };
  updateSettings(s);
}

/** Реактивный хук (перерендер при изменении профиля). */
export { useProfileRefresh } from '../core/profile-manager';
