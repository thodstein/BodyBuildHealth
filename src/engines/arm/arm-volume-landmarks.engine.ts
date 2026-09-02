/**
 * arm-volume-landmarks.engine.ts — ЕДИНЫЙ источник MEV/MAV/MRV для арм-групп.
 * Зеркало volume-landmarks.engine.ts, но для 19 арм-мышц.
 * Основа: Helms 2022, Schoenfeld 2016, Kemp 2024 (tendon), Israetel hypertrophy guide.
 * Сухожильные группы (wrist, pronators) имеют более низкий MRV и tendonCap 1.2×.
 */
import type { MuscleVolumeLandmarks, TrainingLevel } from '../volume-landmarks.engine';
import { normLevel } from '../volume-landmarks.engine';

export type { MuscleVolumeLandmarks, TrainingLevel };

/** 19 арм-мышц × 4 уровня. */
export const ARM_VOLUME_LANDMARKS_DB: Record<TrainingLevel, Record<string, MuscleVolumeLandmarks>> = {
  beginner: {
    wrist_flexors:    { mev: 6, mav: 10, mrv: 14 },
    wrist_extensors:  { mev: 4, mav: 8,  mrv: 12 },
    pronators:        { mev: 6, mav: 10, mrv: 14 },
    supinators:       { mev: 5, mav: 9,  mrv: 13 },
    risers:           { mev: 4, mav: 8,  mrv: 12 },
    ulnar_deviators:  { mev: 3, mav: 6,  mrv: 10 },
    radial_deviators: { mev: 3, mav: 6,  mrv: 10 },
    brachialis:       { mev: 6, mav: 10, mrv: 14 },
    biceps_long:      { mev: 4, mav: 8,  mrv: 12 },
    biceps_short:     { mev: 4, mav: 8,  mrv: 12 },
    brachioradialis:  { mev: 5, mav: 9,  mrv: 13 },
    back_pressure:    { mev: 6, mav: 10, mrv: 16 },
    side_pressure:    { mev: 2, mav: 5,  mrv: 8  },
    grip_support:     { mev: 4, mav: 8,  mrv: 12 },
    grip_pinch:       { mev: 3, mav: 6,  mrv: 10 },
    grip_crush:       { mev: 3, mav: 6,  mrv: 10 },
    thumb:            { mev: 2, mav: 4,  mrv: 8  },
    shoulder_stab:    { mev: 4, mav: 8,  mrv: 12 },
    core_anchor:      { mev: 4, mav: 8,  mrv: 12 },
  },
  intermediate: {
    wrist_flexors:    { mev: 8, mav: 12, mrv: 16 },
    wrist_extensors:  { mev: 6, mav: 10, mrv: 14 },
    pronators:        { mev: 7, mav: 11, mrv: 15 },
    supinators:       { mev: 6, mav: 10, mrv: 14 },
    risers:           { mev: 6, mav: 10, mrv: 14 },
    ulnar_deviators:  { mev: 4, mav: 8,  mrv: 12 },
    radial_deviators: { mev: 4, mav: 8,  mrv: 12 },
    brachialis:       { mev: 8, mav: 12, mrv: 16 },
    biceps_long:      { mev: 6, mav: 10, mrv: 14 },
    biceps_short:     { mev: 6, mav: 10, mrv: 14 },
    brachioradialis:  { mev: 6, mav: 10, mrv: 14 },
    back_pressure:    { mev: 8, mav: 14, mrv: 20 },
    side_pressure:    { mev: 3, mav: 6,  mrv: 9  },
    grip_support:     { mev: 6, mav: 10, mrv: 14 },
    grip_pinch:       { mev: 4, mav: 8,  mrv: 12 },
    grip_crush:       { mev: 4, mav: 8,  mrv: 12 },
    thumb:            { mev: 3, mav: 6,  mrv: 10 },
    shoulder_stab:    { mev: 6, mav: 10, mrv: 14 },
    core_anchor:      { mev: 6, mav: 10, mrv: 14 },
  },
  advanced: {
    wrist_flexors:    { mev: 10, mav: 14, mrv: 18 },
    wrist_extensors:  { mev: 8, mav: 12, mrv: 16 },
    pronators:        { mev: 8, mav: 12, mrv: 16 },
    supinators:       { mev: 7, mav: 11, mrv: 15 },
    risers:           { mev: 6, mav: 10, mrv: 14 },
    ulnar_deviators:  { mev: 4, mav: 8,  mrv: 12 },
    radial_deviators: { mev: 4, mav: 8,  mrv: 12 },
    brachialis:       { mev: 10, mav: 14, mrv: 18 },
    biceps_long:      { mev: 8, mav: 12, mrv: 16 },
    biceps_short:     { mev: 8, mav: 12, mrv: 16 },
    brachioradialis:  { mev: 8, mav: 12, mrv: 16 },
    back_pressure:    { mev: 10, mav: 16, mrv: 24 },
    side_pressure:    { mev: 4, mav: 8,  mrv: 11 },
    grip_support:     { mev: 8, mav: 12, mrv: 16 },
    grip_pinch:       { mev: 6, mav: 10, mrv: 14 },
    grip_crush:       { mev: 6, mav: 10, mrv: 14 },
    thumb:            { mev: 4, mav: 8,  mrv: 12 },
    shoulder_stab:    { mev: 6, mav: 10, mrv: 14 },
    core_anchor:      { mev: 6, mav: 10, mrv: 14 },
  },
  enhanced: {
    wrist_flexors:    { mev: 12, mav: 16, mrv: 20 },
    wrist_extensors:  { mev: 10, mav: 14, mrv: 18 },
    pronators:        { mev: 10, mav: 14, mrv: 18 },
    supinators:       { mev: 8, mav: 12, mrv: 16 },
    risers:           { mev: 8, mav: 12, mrv: 16 },
    ulnar_deviators:  { mev: 6, mav: 10, mrv: 14 },
    radial_deviators: { mev: 6, mav: 10, mrv: 14 },
    brachialis:       { mev: 12, mav: 16, mrv: 22 },
    biceps_long:      { mev: 10, mav: 14, mrv: 18 },
    biceps_short:     { mev: 10, mav: 14, mrv: 18 },
    brachioradialis:  { mev: 10, mav: 14, mrv: 18 },
    back_pressure:    { mev: 12, mav: 18, mrv: 28 },
    side_pressure:    { mev: 5, mav: 10, mrv: 14 },
    grip_support:     { mev: 10, mav: 14, mrv: 18 },
    grip_pinch:       { mev: 8, mav: 12, mrv: 16 },
    grip_crush:       { mev: 8, mav: 12, mrv: 16 },
    thumb:            { mev: 6, mav: 10, mrv: 14 },
    shoulder_stab:    { mev: 8, mav: 12, mrv: 16 },
    core_anchor:      { mev: 8, mav: 12, mrv: 16 },
  },
};

/** Сухожильные группы — tendonCap 1.2× vs muscle 1.7× (Helms 2022, Kemp 2024, Schoenfeld 2016). */
export const TENDON_MUSCLES: ReadonlySet<string> = new Set([
  'wrist_flexors','wrist_extensors','pronators','supinators','risers',
  'ulnar_deviators','radial_deviators','thumb',
]);

export const TENDON_CAP = 1.2;
export const MUSCLE_CAP = 1.7;

export function isTendonMuscle(muscle: string): boolean {
  return TENDON_MUSCLES.has(muscle);
}

/** MRV с учётом tendonCap для сухожильных групп (PRO: отдельный бюджет). */
export function tendonAdjustedMrv(baseMrv: number, muscle: string, pedMult: number): number {
  const cap = isTendonMuscle(muscle) ? TENDON_CAP : MUSCLE_CAP;
  const clampedPed = Math.min(pedMult, cap);
  return Math.round(baseMrv * clampedPed);
}

/** Лимит tendonSets на неделю по уровню (PRO-гейт: beginner 12, intermediate 16, advanced 18, enhanced 22). */
export function tendonWeeklyLimit(level: string): number {
  const lvl = normLevel(level) as TrainingLevel;
  if (lvl === 'beginner') return 12;
  if (lvl === 'intermediate') return 16;
  if (lvl === 'advanced') return 18;
  return 22;
}

export function getArmLandmarks(level: string, muscle: string): MuscleVolumeLandmarks {
  const lvl = normLevel(level) as TrainingLevel;
  const db = ARM_VOLUME_LANDMARKS_DB[lvl] || ARM_VOLUME_LANDMARKS_DB.intermediate;
  return db[muscle] || { mev: 4, mav: 8, mrv: 12 };
}

export function getArmLandmarksForRotation(muscle: string, level: string, daysPerWeek: number): MuscleVolumeLandmarks {
  const base = getArmLandmarks(level, muscle);
  // Масштаб по дням: как в bb (но для арм частота 2–5, поэтому мягче).
  const factor = Math.max(0.6, Math.min(1.4, daysPerWeek / 3));
  return {
    mev: Math.max(1, Math.round(base.mev * factor)),
    mav: Math.max(1, Math.round(base.mav * factor)),
    mrv: Math.max(1, Math.round(base.mrv * factor)),
  };
}

export function armLandmarkStatus(sets: number, lm: MuscleVolumeLandmarks): 'below_mev' | 'optimal' | 'approaching_mrv' | 'exceeding_mrv' {
  if (sets < lm.mev) return 'below_mev';
  if (sets <= lm.mav) return 'optimal';
  if (sets <= lm.mrv) return 'approaching_mrv';
  return 'exceeding_mrv';
}
