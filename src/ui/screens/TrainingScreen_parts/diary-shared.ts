/**
 * diary-shared.ts — общие хелперы форм записи дневника тренировок.
 * Единый источник для поиска прошлых данных упражнения и PR
 * (устраняет дублирование между QuickEntry и DiaryRecordingForm).
 */
import { epley1RM } from '../../../engines/e1rm';
import { exerciseMatchScore } from '../../../engines/exercise-aliases';
import type { WorkoutLog } from '../../../core/types';

export interface PrevWorkoutData {
  weight: number;
  reps: number;
  rir: number;
  date?: string;
}

/** Лучшая прошлая сессия упражнения (по e1RM) из истории тренировок. */
export function getPreviousWorkoutData(historyWorkouts: WorkoutLog[], exerciseName: string): PrevWorkoutData | null {
  let best: { weight: number; reps: number; rir: number; date?: string; e1rm: number } | null = null;
  for (const wl of historyWorkouts) {
    // legacy-записи могут не иметь exercises или иметь не-массив (например, {}) — не роняем форму
    const wlExercises = Array.isArray(wl.exercises) ? wl.exercises : [];
    for (const ex of wlExercises) {
      const score = exerciseMatchScore(ex.exerciseName, exerciseName);
      if (score >= 0.5) {
        for (const set of ex.sets || []) {
          const e1rm = epley1RM(set.weight, set.reps);
          if (!best || e1rm > best.e1rm) {
            best = { weight: set.weight, reps: set.reps, rir: set.rir || 2, date: wl.date, e1rm };
          }
        }
      }
    }
  }
  return best ? { weight: best.weight, reps: best.reps, rir: best.rir, date: best.date } : null;
}

export interface PersonalRecord {
  weight: number;
  reps: number;
  e1rm: number;
}

/** Личный рекорд (лучший e1RM) по упражнению из истории. */
export function getPersonalRecord(historyWorkouts: WorkoutLog[], exerciseName: string): PersonalRecord | null {
  let best: { weight: number; reps: number; e1rm: number } | null = null;
  for (const wl of historyWorkouts) {
    for (const ex of Array.isArray(wl.exercises) ? wl.exercises : []) {
      const score = exerciseMatchScore(ex.exerciseName, exerciseName);
      if (score >= 0.5) {
        for (const set of ex.sets || []) {
          const e1rm = epley1RM(set.weight, set.reps);
          if (!best || e1rm > best.e1rm) {
            best = { weight: set.weight, reps: set.reps, e1rm };
          }
        }
      }
    }
  }
  return best;
}
