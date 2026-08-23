/**
 * training-profile.ts — единый «Профиль тренированности».
 * Один источник реальных входных данных (ПМ, workMax, weakPoints, оборудование,
 * recovery/fatigue, дней/нед, вес тела), переиспользуемый ПЛ/ББ/ручным конструктором/калькуляторами.
 * Хранится в localStorage('he_training_profile').
 */
import React, { useState, useEffect, useCallback } from 'react';
import { getProfile, updateProfile } from '../../../core/profile-manager';

const KEY = 'he_training_profile';

export interface TrainingProfile {
  bodyWeight: number;
  goal: string;
  level: string;
  trainingYears: number;
  daysPerWeek: number;
  recovery: number;     // 1-10
  fatigue: number;      // 1-10
  sleepHours: number;
  stressLevel: number;  // 1-10
  weakPoints: string[];
  equipment: string[];
  favoriteExercises: string[];
  excludedExercises: string[];
  avoidAxialLoad: boolean;
  pmSquat: number;
  pmBench: number;
  pmDead: number;
  workMax: Record<string, number>;
  loadStrategy: string;
  planMode: 'generic_split' | 'bb_cycle';
  bbCycleId: string;
  onCourse: boolean;
  courseIntensity: 'mild' | 'moderate' | 'heavy';
  trainingFocus?: 'strength' | 'hypertrophy' | 'endurance';
  bbPeds: string[];
  pharmaCoursesCount: number;
  monthsSinceLastCourse: number;
  totalYearsOnPharma: number;
  injuries: { muscle: string; from: string; to?: string; weightPct?: number; volumePct?: number; repsCap?: number; exclude?: boolean }[];
  /** Ограничения мобильности (биомеханика): shoulder/hip/ankle/lower_back/wrist.
   *  Упражнения с ограниченным движением заменяются на безопасные альтернативы. */
  mobilityRestrictions?: string[];
  /** Способность к bodyweight-упражнениям: если не подтверждена — подтягивания
   *  не ставятся как primary (заменяются pulldown/машиной). */
  bodyweightCapability?: {
    pullUpsStrict?: number;
    chinUpsStrict?: number;
    dipsStrict?: number;
    pushUpsStrict?: number;
    weightedPullUpLoad?: number;
    assistedPullUpLoad?: number;
  };
}

export const DEFAULT_PROFILE: TrainingProfile = {
  bodyWeight: 80,
  goal: 'bulk',
  level: 'intermediate',
  trainingYears: 3,
  daysPerWeek: 4,
  recovery: 7,
  fatigue: 3,
  sleepHours: 7,
  stressLevel: 5,
  weakPoints: [],
  equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
  favoriteExercises: [],
  excludedExercises: [],
  avoidAxialLoad: false,
  pmSquat: 120,
  pmBench: 100,
  pmDead: 140,
  workMax: { chest: 100, back: 110, legs: 140, shoulders: 60, arms: 50, core: 60,
    quads: 140, hamstrings: 90, biceps: 50, triceps: 60, glutes: 160, calves: 120, abs: 60 },
  loadStrategy: 'double_progression',
  planMode: 'generic_split' as const,
  bbCycleId: '',
  onCourse: false,
  courseIntensity: 'moderate',
  bbPeds: [],
  pharmaCoursesCount: 0,
  monthsSinceLastCourse: 0,
  totalYearsOnPharma: 0,
  injuries: [],
  mobilityRestrictions: [],
  bodyweightCapability: undefined,
};

export function loadTrainingProfile(): TrainingProfile {
  // Сначала пытаемся прочитать из UnifiedSettings (новый путь)
  try {
    const prof = getProfile();
    const s = (prof.settings || {}) as any;
    if (s.training) {
      // Маппинг из UnifiedSettings → TrainingProfile (для backward-compat legacy consumer'ов)
      return {
        ...DEFAULT_PROFILE,
        bodyWeight: s.personal?.weight ?? DEFAULT_PROFILE.bodyWeight,
        goal: s.training?.primaryGoal ?? DEFAULT_PROFILE.goal,
        level: s.training?.level ?? DEFAULT_PROFILE.level,
        trainingYears: s.training?.experience ?? DEFAULT_PROFILE.trainingYears,
        daysPerWeek: s.training?.daysPerWeek ?? DEFAULT_PROFILE.daysPerWeek,
        recovery: s.training?.recovery ?? DEFAULT_PROFILE.recovery,
        fatigue: s.lifestyle?.fatigueLevel ?? DEFAULT_PROFILE.fatigue,
        sleepHours: s.lifestyle?.sleepHours ?? DEFAULT_PROFILE.sleepHours,
        stressLevel: s.lifestyle?.stressLevel ?? DEFAULT_PROFILE.stressLevel,
        weakPoints: s.training?.weakPoints ?? DEFAULT_PROFILE.weakPoints,
        favoriteExercises: (s.training as any).favoriteExercises ?? DEFAULT_PROFILE.favoriteExercises,
        excludedExercises: (s.training as any).excludedExercises ?? DEFAULT_PROFILE.excludedExercises,
        avoidAxialLoad: (s.training as any).avoidAxialLoad ?? DEFAULT_PROFILE.avoidAxialLoad,
        equipment: s.training?.equipment ?? DEFAULT_PROFILE.equipment,
        loadStrategy: (s.training as any).loadStrategy ?? DEFAULT_PROFILE.loadStrategy,
        bodyweightCapability: (s.training as any).bodyweightCapability ?? DEFAULT_PROFILE.bodyweightCapability,
        mobilityRestrictions: (s.training as any).mobilityRestrictions ?? DEFAULT_PROFILE.mobilityRestrictions,
        pmSquat: s.training?.pmSquat ?? DEFAULT_PROFILE.pmSquat,
        pmBench: s.training?.pmBench ?? DEFAULT_PROFILE.pmBench,
        pmDead: s.training?.pmDeadlift ?? DEFAULT_PROFILE.pmDead,
        workMax: s.training?.workMax ?? DEFAULT_PROFILE.workMax,
        pharmaCoursesCount: s.pharma?.totalCycles ?? DEFAULT_PROFILE.pharmaCoursesCount,
        monthsSinceLastCourse: s.pharma?.monthsSinceLastCourse ?? DEFAULT_PROFILE.monthsSinceLastCourse,
        totalYearsOnPharma: s.pharma?.yearsOnGear ?? DEFAULT_PROFILE.totalYearsOnPharma,
      };
    }
  } catch { /* fallback к legacy */ }
  // Fallback — старый путь через localStorage
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v) return { ...DEFAULT_PROFILE, ...v, workMax: { ...DEFAULT_PROFILE.workMax, ...(v.workMax || {}) } };
  } catch { /* ignore */ }
  return { ...DEFAULT_PROFILE };
}

export function saveTrainingProfile(p: TrainingProfile): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
  // P1-fix (Aug 5): Sync в UnifiedSettings через updateProfile (а не напрямую через localStorage)
  // — чтобы сработали sectionVersions, notifyAll, useDataLink, useProfileSection.
  try {
    const cur = getProfile();
    const next: any = JSON.parse(JSON.stringify(cur.settings || {}));
    if (!next.personal) next.personal = {};
    if (!next.training) next.training = {};
    if (!next.lifestyle) next.lifestyle = {};
    if (!next.pharma) next.pharma = {};
    if (p.bodyWeight) next.personal.weight = p.bodyWeight;
    if (p.goal) next.training.primaryGoal = p.goal as any;
    if (p.trainingFocus) next.training.trainingFocus = p.trainingFocus;
    if (p.level) next.training.level = p.level as any;
    if (p.trainingYears !== undefined) next.training.experience = p.trainingYears;
    if (p.daysPerWeek) next.training.daysPerWeek = p.daysPerWeek;
    if (p.recovery) next.training.recovery = p.recovery;
    if (p.fatigue !== undefined) next.lifestyle.fatigueLevel = p.fatigue;
    if (p.sleepHours) next.lifestyle.sleepHours = p.sleepHours;
    if (p.stressLevel) next.lifestyle.stressLevel = p.stressLevel;
    if (p.weakPoints?.length) next.training.weakPoints = p.weakPoints;
    (next.training as any).favoriteExercises = p.favoriteExercises ?? [];
    (next.training as any).excludedExercises = p.excludedExercises ?? [];
    if (p.avoidAxialLoad !== undefined) (next.training as any).avoidAxialLoad = p.avoidAxialLoad;
    if (p.equipment?.length) next.training.equipment = p.equipment;
    if (p.loadStrategy) (next.training as any).loadStrategy = p.loadStrategy;
    if (p.bodyweightCapability) (next.training as any).bodyweightCapability = p.bodyweightCapability;
    (next.training as any).mobilityRestrictions = p.mobilityRestrictions ?? [];
    if (p.pmSquat) next.training.pmSquat = p.pmSquat;
    if (p.pmBench) next.training.pmBench = p.pmBench;
    if (p.pmDead) next.training.pmDeadlift = p.pmDead;
    if (p.workMax) next.training.workMax = { ...(next.training.workMax || {}), ...p.workMax };
    if (p.pharmaCoursesCount) next.pharma.totalCycles = p.pharmaCoursesCount;
    if (p.monthsSinceLastCourse) next.pharma.monthsSinceLastCourse = p.monthsSinceLastCourse;
    if (p.totalYearsOnPharma) next.pharma.yearsOnGear = p.totalYearsOnPharma;
    updateProfile({ settings: next });
  } catch { /* silent */ }
}

/** Хук: [profile, update]. update(patch) сливает patch и сохраняет. */
export function useTrainingProfile(): [TrainingProfile, (patch: Partial<TrainingProfile>) => void] {
  const [profile, setProfile] = useState<TrainingProfile>(() => loadTrainingProfile());
  useEffect(() => { saveTrainingProfile(profile); }, [profile]);
  const update = useCallback((patch: Partial<TrainingProfile>) => {
    setProfile(prev => ({ ...prev, ...patch, workMax: patch.workMax ? { ...prev.workMax, ...patch.workMax } : prev.workMax }));
  }, []);
  return [profile, update];
}

export const EQUIPMENT_OPTIONS = [
  { id: 'barbell', label: 'Штанга' },
  { id: 'dumbbell', label: 'Гантели' },
  { id: 'machine', label: 'Тренажёр' },
  { id: 'cable', label: 'Блок' },
  { id: 'bodyweight', label: 'Свой вес' },
  { id: 'band', label: 'Резинка' },
  { id: 'kettlebell', label: 'Гиря' },
];

export const WEAK_GROUP_OPTIONS = [
  { id: 'chest', label: 'Грудь' },
  { id: 'back', label: 'Спина' },
  { id: 'legs', label: 'Ноги' },
  { id: 'quads', label: 'Квадрицепсы' },
  { id: 'hamstrings', label: 'Бицепс бедра' },
  { id: 'glutes', label: 'Ягодицы' },
  { id: 'shoulders', label: 'Плечи' },
  { id: 'arms', label: 'Руки' },
  { id: 'biceps', label: 'Бицепс' },
  { id: 'triceps', label: 'Трицепс' },
  { id: 'calves', label: 'Икры' },
  { id: 'traps', label: 'Трапеции' },
  { id: 'forearms', label: 'Предплечья' },
  { id: 'core', label: 'Кор' },
];
