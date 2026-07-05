import { useMemo } from 'react';
import { getExerciseById } from '../../core/exercise-catalog';
import type { Exercise } from '../../core/types';
import { getVolumeByMuscle } from '../../engines/training-methodology.engine';
import {
  analyzeFullVolume, getSFRProfile, planVolumeProgression,
  findBetterExerciseSwaps, findCoverageGaps,
} from '../../engines/volume-optimizer-pro.engine';
import type {
  ProExerciseRow, FullVolumeAnalysis, MuscleVolumeProAnaly, CNSFatigueReport,
  RecoveryCapacityReport, SplitQualityScore, VolumeProgressionPlan,
  ExerciseSwapRec, CoverageGap, SFRProfile,
} from '../../engines/volume-optimizer-pro.engine';
import type { TrainingLevel } from '../../engines/volume-landmarks.engine';

export type { ProExerciseRow, FullVolumeAnalysis, MuscleVolumeProAnaly, CNSFatigueReport, RecoveryCapacityReport, SplitQualityScore, VolumeProgressionPlan, ExerciseSwapRec, CoverageGap, SFRProfile };

export interface VolRow { exerciseId: string; weight: number; reps: number; sets: number; oneRM?: number; day: number; }
export type VolumeLevel = 'beginner' | 'intermediate' | 'advanced';
export interface MuscleStat { sets: number; mev: number; mav: number; mrv: number; }

export function computeMuscleStats(rows: VolRow[], volumeLevel: VolumeLevel): Record<string, MuscleStat> {
  const map: Record<string, MuscleStat> = {};
  rows.forEach(r => {
    const ex = getExerciseById(r.exerciseId) as Exercise | undefined;
    if (!ex) return;
    const muscle = ex.group;
    if (!map[muscle]) {
      const v = getVolumeByMuscle(muscle);
      const ld = v ? v[volumeLevel] : undefined;
      map[muscle] = { sets: 0, mev: ld?.mev ?? 0, mav: ld?.mav ?? 0, mrv: ld?.mrv ?? 0 };
    }
    map[muscle].sets += r.sets;
  });
  return map;
}

export function computeIntensityByDay(rows: VolRow[], getOneRM: (id: string) => number): Record<number, { heavy: number; medium: number; light: number }> {
  const days: Record<number, { heavy: number; medium: number; light: number }> = {};
  for (let d = 1; d <= 7; d++) days[d] = { heavy: 0, medium: 0, light: 0 };
  rows.forEach(r => {
    const oneRM = getOneRM(r.exerciseId);
    const pct = oneRM > 0 ? r.weight / oneRM : 0;
    const tonnage = r.weight * r.reps * r.sets;
    const d = r.day || 1;
    if (pct >= 0.8) days[d].heavy += tonnage;
    else if (pct >= 0.6) days[d].medium += tonnage;
    else days[d].light += tonnage;
  });
  return days;
}

export function computeFreqByMuscle(rows: VolRow[]): Record<string, number> {
  const daySets: Record<string, Set<number>> = {};
  rows.forEach(r => { const ex = getExerciseById(r.exerciseId); if (!ex) return; if (!daySets[ex.group]) daySets[ex.group] = new Set(); daySets[ex.group].add(r.day || 1); });
  const m: Record<string, number> = {};
  Object.keys(daySets).forEach(g => { m[g] = daySets[g].size; });
  return m;
}

export function useVolumeOptimization(rows: VolRow[], volumeLevel: VolumeLevel, getOneRM: (id: string) => number) {
  const muscleStats = useMemo(() => computeMuscleStats(rows, volumeLevel), [rows, volumeLevel]);
  const intensityByDay = useMemo(() => computeIntensityByDay(rows, getOneRM), [rows, getOneRM]);
  const freqByMuscle = useMemo(() => computeFreqByMuscle(rows), [rows]);
  return { muscleStats, intensityByDay, freqByMuscle };
}

/** ПРО-анализ: полный разбор программы (SFR, CNS, SRA, качество, прогрессия). */
export function useVolumeProAnalysis(
  rows: ProExerciseRow[],
  level: TrainingLevel,
  weakPoints: string[] = [],
): FullVolumeAnalysis | null {
  return useMemo(() => {
    if (!rows || rows.length === 0) return null;
    return analyzeFullVolume(rows, level, weakPoints);
  }, [rows, level, ...weakPoints]);
}

/** Планировщик прогрессии объёма по неделям. */
export function useVolumeProgression(
  rows: ProExerciseRow[],
  level: TrainingLevel,
  totalWeeks: number,
): VolumeProgressionPlan | null {
  return useMemo(() => {
    if (!rows || rows.length === 0 || totalWeeks < 2) return null;
    return planVolumeProgression(rows, level, totalWeeks);
  }, [rows, level, totalWeeks]);
}

/** Рекомендации по замене упражнений на основе SFR. */
export function useExerciseSwaps(rows: ProExerciseRow[], level: TrainingLevel): ExerciseSwapRec[] {
  return useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return findBetterExerciseSwaps(rows, level);
  }, [rows, level]);
}

/** Анализ пробелов в покрытии групп мышц. */
export function useCoverageGaps(rows: ProExerciseRow[], level: TrainingLevel): CoverageGap[] {
  return useMemo(() => {
    if (!rows || rows.length === 0) return [];
    return findCoverageGaps(rows, level);
  }, [rows, level]);
}
