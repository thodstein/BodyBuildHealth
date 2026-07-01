/**
 * training-profile.ts — единый «Профиль тренированности».
 * Один источник реальных входных данных (ПМ, workMax, weakPoints, оборудование,
 * recovery/fatigue, дней/нед, вес тела), переиспользуемый ПЛ/ББ/ручным конструктором/калькуляторами.
 * Хранится в localStorage('he_training_profile').
 */
import React, { useState, useEffect, useCallback } from 'react';

const KEY = 'he_training_profile';

export interface TrainingProfile {
  bodyWeight: number;
  goal: string;
  level: string;
  daysPerWeek: number;
  recovery: number;     // 1-10
  fatigue: number;      // 1-10
  sleepHours: number;
  stressLevel: number;  // 1-10
  weakPoints: string[];
  equipment: string[];
  pmSquat: number;
  pmBench: number;
  pmDead: number;
  workMax: Record<string, number>;
  onCourse: boolean;
  courseIntensity: 'mild' | 'moderate' | 'heavy';
  injuries: { muscle: string; from: string; to?: string }[];
}

export const DEFAULT_PROFILE: TrainingProfile = {
  bodyWeight: 80,
  goal: 'bulk',
  level: 'intermediate',
  daysPerWeek: 4,
  recovery: 7,
  fatigue: 3,
  sleepHours: 7,
  stressLevel: 5,
  weakPoints: [],
  equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'],
  pmSquat: 120,
  pmBench: 100,
  pmDead: 140,
  workMax: { chest: 100, back: 110, legs: 140, shoulders: 60, arms: 50, core: 60,
    quads: 140, hamstrings: 90, biceps: 50, triceps: 60, glutes: 160, calves: 120, abs: 60 },
  onCourse: false,
  courseIntensity: 'moderate',
  injuries: [],
};

export function loadTrainingProfile(): TrainingProfile {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (v) return { ...DEFAULT_PROFILE, ...v, workMax: { ...DEFAULT_PROFILE.workMax, ...(v.workMax || {}) } };
  } catch { /* ignore */ }
  return { ...DEFAULT_PROFILE };
}

export function saveTrainingProfile(p: TrainingProfile): void {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
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
  { id: 'shoulders', label: 'Плечи' },
  { id: 'arms', label: 'Руки' },
  { id: 'core', label: 'Кор' },
];