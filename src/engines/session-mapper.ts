/**
 * session-mapper.ts — unified adapters between session type hierarchies.
 *
 * The codebase has multiple "session" types:
 *  - WorkoutSession  — primary localStorage session (workout-logger.engine)
 *  - WorkoutLog      — IndexedDB log (strength-diary.engine)
 *  - SessionLogEntry — analytics format (analytics-engine)
 *  - planning sessions from training-integration.engine are kept separate
 *
 * This module provides canonical conversion functions so UI/engines
 * never need inline mapping code again.
 */

import type { WorkoutSession, WorkoutExercise, WorkoutSet } from './workout-logger.engine';
import type { WorkoutLog, StrengthLogEntry } from '../core/types';
import { sessionToWorkoutLog } from './strength-diary.engine';
import { COMPOUND_PATTERNS } from './strength-diary.engine';
import { epley1RM } from './e1rm';

function workoutSetKey(date: string, exerciseName: string, setNumber: number): string {
  return `${date}|${exerciseName}|${setNumber}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// WorkoutSession → WorkoutLog (re-export canonical source)
// ═══════════════════════════════════════════════════════════════════════════

export { sessionToWorkoutLog };

// ═══════════════════════════════════════════════════════════════════════════
// WorkoutSession[] → WorkoutLog[]
// ═══════════════════════════════════════════════════════════════════════════

export function sessionsToWorkoutLogs(sessions: WorkoutSession[]): WorkoutLog[] {
  return sessions.map(s => sessionToWorkoutLog(s));
}

// ═══════════════════════════════════════════════════════════════════════════
// WorkoutLog → SessionLogEntry (for analytics-engine)
// ═══════════════════════════════════════════════════════════════════════════

export interface SessionLogEntryLite {
  sessionId: string;
  date: string;
  focus: string;
  durationMin: number;
  sets: Array<{
    exerciseId: string;
    exerciseName: string;
    reps: number;
    weight: number;
    rpe: number;
    rir: number;
    date: string;
    setIndex: number;
  }>;
}

export function workoutLogToSessionLogEntry(log: WorkoutLog): SessionLogEntryLite {
  return {
    sessionId: log.id,
    date: log.date,
    focus: log.split || 'fullbody',
    durationMin: log.duration || 0,
    sets: (log.exercises || []).flatMap((ex, ei) =>
      (ex.sets || []).map((s, si) => ({
        exerciseId: ex.exerciseId,
        exerciseName: ex.exerciseName,
        reps: s.reps || 0,
        weight: s.weight || 0,
        rpe: s.rpe || 5,
        rir: s.rir || 3,
        date: log.date,
        setIndex: si,
      }))
    ),
  };
}

export function workoutLogsToSessionLogEntries(logs: WorkoutLog[]): SessionLogEntryLite[] {
  return logs.map(workoutLogToSessionLogEntry);
}

// ═══════════════════════════════════════════════════════════════════════════
// WorkoutLog → StrengthLogEntry[] (for strength-diary save)
// ═══════════════════════════════════════════════════════════════════════════

export function workoutLogToStrengthLogEntries(log: WorkoutLog): StrengthLogEntry[] {
  return (log.exercises || []).map(ex => ({
    id: ex.id,
    date: log.date,
    exerciseId: ex.exerciseId,
    exerciseName: ex.exerciseName,
    sets: ex.sets.map(s => ({ weight: s.weight, reps: s.reps, rir: s.rir, rpe: s.rpe, techniqueScore: s.techniqueScore })),
    totalVolume: ex.totalVolume,
    estimated1RM: ex.estimated1RM,
    isCompound: ex.isCompound,
    notes: ex.notes || '',
    supersetGroup: ex.supersetGroup,
    note: ex.note,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════
// WorkoutSession → StrengthLogEntry[] (for direct save from session)
// ═══════════════════════════════════════════════════════════════════════════

export function sessionToStrengthLogEntries(session: WorkoutSession): StrengthLogEntry[] {
  const log = sessionToWorkoutLog(session);
  return workoutLogToStrengthLogEntries(log);
}

// ═══════════════════════════════════════════════════════════════════════════
// Unified diary entry (merges IDB + localStorage by date+exercise+weight+reps)
// ═══════════════════════════════════════════════════════════════════════════

export interface UnifiedDiaryEntry {
  id: string;
  date: string;
  exerciseId: string;
  exerciseName: string;
  weight: number;
  reps: number;
  rir: number;
  rpe: number;
  totalVolume: number;
  estimated1RM: number;
  isCompound: boolean;
  source: 'idb' | 'localStorage';
}

export function mergeDiaryEntries(idbLogs: WorkoutLog[], lsSessions: WorkoutSession[]): UnifiedDiaryEntry[] {
  const seen = new Map<string, UnifiedDiaryEntry>();

  const put = (log: WorkoutLog, source: 'idb' | 'localStorage') => {
    for (const ex of log.exercises || []) {
      for (const [index, set] of (ex.sets || []).entries()) {
        const key = workoutSetKey(log.date, ex.exerciseName, index + 1) + `|${set.weight}|${set.reps}`;
        if (seen.has(key)) continue;
        seen.set(key, {
          id: ex.id || key,
          date: log.date,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          weight: set.weight,
          reps: set.reps,
          rir: set.rir,
          rpe: set.rpe || 5,
          totalVolume: set.weight * set.reps,
          estimated1RM: epley1RM(set.weight, set.reps),
          isCompound: ex.isCompound,
          source,
        });
      }
    }
  };

  for (const log of idbLogs) put(log, 'idb');
  for (const session of lsSessions) put(sessionToWorkoutLog(session), 'localStorage');

  return Array.from(seen.values()).sort((a, b) => b.date.localeCompare(a.date));
}
