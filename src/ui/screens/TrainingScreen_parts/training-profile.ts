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
  pmSquat: number;
  pmBench: number;
  pmDead: number;
  workMax: Record<string, number>;
  loadStrategy: string;
  planMode: 'generic_split' | 'bb_cycle';
  bbCycleId: string;
  onCourse: boolean;
  courseIntensity: 'mild' | 'moderate' | 'heavy';
  bbPeds: string[];
  pharmaCoursesCount: number;
  monthsSinceLastCourse: number;
  totalYearsOnPharma: number;
  injuries: { muscle: string; from: string; to?: string; weightPct?: number; volumePct?: number; repsCap?: number; exclude?: boolean }[];
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
  // Also sync to UnifiedSettings for cross-module consistency
  try {
    const raw = localStorage.getItem('he_profile_v2');
    if (raw) {
      const prof = JSON.parse(raw);
      const us = prof.settings || {};
      const tr = us.training || {};
      const pr = us.personal || {};
      const ls = us.lifestyle || {};
      if (p.bodyWeight) pr.weight = p.bodyWeight;
      if (p.goal) tr.primaryGoal = p.goal;
      if (p.level) tr.level = p.level;
      if (p.daysPerWeek) tr.daysPerWeek = p.daysPerWeek;
      if (p.recovery) tr.recovery = p.recovery;
      if (p.fatigue !== undefined) ls.fatigueLevel = p.fatigue;
      if (p.sleepHours) ls.sleepHours = p.sleepHours;
      if (p.stressLevel) ls.stressLevel = p.stressLevel;
      if (p.weakPoints?.length) tr.weakPoints = p.weakPoints;
      if (p.favoriteExercises?.length) tr.favoriteExercises = p.favoriteExercises;
      if (p.excludedExercises?.length) tr.excludedExercises = p.excludedExercises;
      if (p.equipment?.length) tr.equipment = p.equipment;
      if (p.loadStrategy) tr.loadStrategy = p.loadStrategy;
      if (p.pmSquat) tr.pmSquat = p.pmSquat;
      if (p.pmBench) tr.pmBench = p.pmBench;
      if (p.pmDead) tr.pmDeadlift = p.pmDead;
      if (p.workMax) tr.workMax = { ...tr.workMax, ...p.workMax };
      if (p.pharmaCoursesCount) us.pharma = us.pharma || {}; us.pharma.totalCycles = p.pharmaCoursesCount;
      if (p.monthsSinceLastCourse) us.pharma = us.pharma || {}; us.pharma.monthsSinceLastCourse = p.monthsSinceLastCourse;
      if (p.totalYearsOnPharma) us.pharma = us.pharma || {}; us.pharma.yearsOnGear = p.totalYearsOnPharma;
      us.training = tr;
      us.personal = pr;
      us.lifestyle = ls;
      prof.settings = us;
      localStorage.setItem('he_profile_v2', JSON.stringify(prof));
    }
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
  { id: 'shoulders', label: 'Плечи' },
  { id: 'arms', label: 'Руки' },
  { id: 'core', label: 'Кор' },
];