import { db } from '../core/db';
import type { StrengthLogEntry, WorkoutLog } from '../core/types';
import { loadSessions, type WorkoutSession } from './workout-logger.engine';
import { epley1RM } from './e1rm';

export interface StrengthStats {
  exerciseId: string;
  exerciseName: string;
  maxWeight: number;
  maxReps: number;
  max1RM: number;
  totalVolume: number;
  workoutCount: number;
  lastWorkoutDate: string;
  bestSet: { weight: number; reps: number; rir: number };
}

export interface WeeklyProgress {
  week: number;
  totalVolume: number;
  workoutCount: number;
  compoundWorkouts: number;
  isolationWorkouts: number;
  total1RM: number;
}

export interface ProgressionAlert {
  type: 'plateau' | 'deload' | 'max_reached' | 'volume_peak';
  message: string;
  exerciseId?: string;
  currentWeight?: number;
  weeksAtWeight?: number;
}

/**
 * Strength Diary Engine v6
 * Manages strength logs and workout tracking in IndexedDB
 */
// Преобразование сессии SessionPlayer (localStorage) в WorkoutLog для единого дневника.
const COMPOUND_PATTERNS = new Set(['squat', 'hinge', 'horizontal_push', 'horizontal_pull', 'vertical_push', 'vertical_pull']);
export function sessionToWorkoutLog(s: WorkoutSession): WorkoutLog {
  return {
    id: s.sessionId || `plsession_${s.date}_${s.startTime}`,
    date: s.date,
    duration: s.durationMin,
    exercises: s.exercises.map(ex => ({
      id: `${s.sessionId}_${ex.exerciseId}_${ex.order}`,
      date: s.date,
      exerciseId: ex.exerciseId || ex.exerciseName,
      exerciseName: ex.exerciseName,
      sets: ex.sets.map(st => ({ weight: st.weightKg, reps: st.reps, rir: st.rir, rpe: st.rpe })),
      totalVolume: ex.totalVolume,
      estimated1RM: ex.best1RM,
      isCompound: COMPOUND_PATTERNS.has(ex.pattern),
      weekNumber: s.weekNumber,
      notes: ex.sets.map(st => st.notes).filter(Boolean).join(' '),
    })),
    overallRPE: s.avgIntensity,
    recoveryBefore: 0,
    split: s.focus,
    weekNumber: s.weekNumber,
    mesocycleId: undefined,
    notes: s.notes,
  };
}
export class StrengthDiary {
  #workoutLogsCache: { data: WorkoutLog[]; ts: number } | null = null;
  #CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (e: StorageEvent) => {
        if (e.key === 'he_workout_log_v2') {
          this.#workoutLogsCache = null;
        }
      });
    }
  }

  /**
    * Get all workout logs (cached for 5 minutes)
    */
    async getWorkoutLogs(): Promise<WorkoutLog[]> {
      const now = Date.now();
      if (this.#workoutLogsCache && now - this.#workoutLogsCache.ts < this.#CACHE_TTL) {
        return this.#workoutLogsCache.data;
      }
      const logs = await db.getAll<WorkoutLog>('workout_log');
      const lsLogs = loadSessions().map(sessionToWorkoutLog);
      const merged = [...logs, ...lsLogs];
      const seen = new Set<string>();
      const dedup = merged.filter(l => { if (seen.has(l.id)) return false; seen.add(l.id); return true; });
      const result = dedup.sort((a, b) => b.date.localeCompare(a.date));
      this.#workoutLogsCache = { data: result, ts: now };
      return result;
    }

  /**
   * Save strength log entry
   */
  async saveStrengthLog(entry: StrengthLogEntry): Promise<void> {
    const id = entry.id || `${entry.exerciseId}_${entry.date}_${Date.now()}`;
    await db.put('training_log', { ...entry, id });
  }

  /**
   * Save workout log (collection of strength logs)
   */
  async saveWorkoutLog(workout: WorkoutLog): Promise<void> {
    const id = workout.id || `workout_${workout.date}_${Date.now()}`;
    await db.put('workout_log', { ...workout, id });
  }

  /**
   * Get all strength logs for exercise
   */
  async getStrengthLogs(exerciseId: string): Promise<StrengthLogEntry[]> {
    const logs = await db.getAll<StrengthLogEntry>('training_log');
    return logs.filter(l => l.exerciseId === exerciseId).sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Get all strength logs by date range
   */
  async getStrengthLogsByDate(start: string, end: string): Promise<StrengthLogEntry[]> {
    const logs = await db.getAll<StrengthLogEntry>('training_log');
    return logs.filter(l => l.date >= start && l.date <= end).sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Archive localStorage sessions to IndexedDB for durability.
   */
  async archiveSessionsToIDB(): Promise<number> {
    const lsSessions = loadSessions();
    if (lsSessions.length === 0) return 0;
    const idbLogs = await db.getAll<WorkoutLog>('workout_log');
    const idbIds = new Set(idbLogs.map(l => l.id));
    let archived = 0;
    for (const session of lsSessions) {
      const log = sessionToWorkoutLog(session);
      if (!idbIds.has(log.id)) {
        await db.put('workout_log', log);
        archived++;
      }
    }
    return archived;
  }

  async getWorkoutLogsByDate(start: string, end: string): Promise<WorkoutLog[]> {
    const logs = await db.getAll<WorkoutLog>('workout_log');
    return logs.filter(w => w.date >= start && w.date <= end).sort((a, b) => b.date.localeCompare(a.date));
  }

  /**
   * Get strength stats for exercise
   */
  async getExerciseStats(exerciseId: string): Promise<StrengthStats | null> {
    const logs = await this.getStrengthLogs(exerciseId);
    if (logs.length === 0) return null;

    const maxWeight = Math.max(...logs.flatMap(l => l.sets.map(s => s.weight)));
    const maxReps = Math.max(...logs.flatMap(l => l.sets.map(s => s.reps)));
    const max1RM = Math.max(...logs.flatMap(l => l.sets.map(s => epley1RM(s.weight, s.reps))));
    const totalVolume = logs.reduce((sum, l) => sum + l.totalVolume, 0);
    const workoutCount = logs.length;
    const lastWorkoutDate = logs[0]?.date || '';

    // Best set (highest 1RM)
    let bestSet = { weight: 0, reps: 0, rir: 0 };
    let best1RM = 0;
    logs.forEach(l => {
      l.sets.forEach(s => {
        const set1RM = epley1RM(s.weight, s.reps);
        if (set1RM > best1RM) {
          best1RM = set1RM;
          bestSet = { weight: s.weight, reps: s.reps, rir: s.rir };
        }
      });
    });

    return {
      exerciseId,
      exerciseName: logs[0]?.exerciseName || '',
      maxWeight,
      maxReps,
      max1RM,
      totalVolume,
      workoutCount,
      lastWorkoutDate,
      bestSet
    };
  }

  /**
   * Get weekly progress
   */
  async getWeeklyProgress(): Promise<WeeklyProgress[]> {
    const logs = await db.getAll<StrengthLogEntry>('training_log');
    const workouts = await db.getAll<WorkoutLog>('workout_log');
    const lsSessions = loadSessions();
    const lsLogs = lsSessions.map(sessionToWorkoutLog);
    const allWorkouts = [...workouts, ...lsLogs];

    // Group by ISO week start (Monday) for accurate week grouping
    const toISOWeek = (dateStr: string): number => {
      const d = new Date(dateStr);
      const day = d.getDay() || 7;
      d.setDate(d.getDate() - day + 1);
      d.setHours(0, 0, 0, 0);
      return Math.floor(d.getTime() / (7 * 24 * 3600 * 1000));
    };

    const weekMap = new Map<number, { volume: number; compound: number; isolation: number; oneRm: number; sessions: Set<string> }>();

    const addLog = (log: StrengthLogEntry) => {
      const week = toISOWeek(log.date);
      const current = weekMap.get(week) || { volume: 0, compound: 0, isolation: 0, oneRm: 0, sessions: new Set() };
      current.volume += log.totalVolume;
      if (log.isCompound) current.compound++;
      else current.isolation++;
      const week1RM = Math.max(...(log?.sets || []).map(s => epley1RM(s.weight, s.reps)), 0);
      current.oneRm = Math.max(current.oneRm, week1RM);
      weekMap.set(week, current);
    };

    logs.forEach(addLog);
    allWorkouts.forEach(w => (w.exercises || []).forEach(addLog));

    return Array.from(weekMap.entries()).map(([week, data]) => ({
      week,
      totalVolume: data.volume,
      workoutCount: data.sessions.size,
      compoundWorkouts: data.compound,
      isolationWorkouts: data.isolation,
      total1RM: data.oneRm
    })).sort((a, b) => a.week - b.week);
  }

  /**
   * Check for progression alerts
   */
  async checkProgressionAlerts(): Promise<ProgressionAlert[]> {
    const alerts: ProgressionAlert[] = [];

    // Check for plateau (same weight for 3+ weeks)
    const logs = await db.getAll<StrengthLogEntry>('training_log');
    const compoundLogs = logs.filter(l => l.isCompound && l.sets.length > 0);

    // Group by exercise, then by week, track best e1RM per week
    const exerciseWeekBest = new Map<string, Map<number, { weight: number; e1RM: number }>>();

    compoundLogs.forEach(log => {
      const bestSet = log.sets.reduce((best, s) => epley1RM(s.weight, s.reps) > epley1RM(best.weight, best.reps) ? s : best, log.sets[0]);
      const week = this.getWeekNumber(log.date);
      const e1RM = epley1RM(bestSet.weight, bestSet.reps);
      const exMap = exerciseWeekBest.get(log.exerciseId) || new Map<number, { weight: number; e1RM: number }>();
      if (!exMap.has(week) || e1RM > exMap.get(week)!.e1RM) {
        exMap.set(week, { weight: bestSet.weight, e1RM });
      }
      exerciseWeekBest.set(log.exerciseId, exMap);
    });

    exerciseWeekBest.forEach((weekMap, exerciseId) => {
      const sortedWeeks = Array.from(weekMap.entries()).sort((a, b) => a[0] - b[0]);
      if (sortedWeeks.length < 3) return;
      const last3 = sortedWeeks.slice(-3);
      const weights = last3.map(w => w[1].weight);
      const uniqueWeights = new Set(weights);
      if (uniqueWeights.size === 1) {
        alerts.push({
          type: 'plateau',
          message: `Плато: ${weights[0]} кг на 3+ неделях`,
          exerciseId,
          currentWeight: weights[0],
          weeksAtWeight: 3
        });
      }
    });

    // Check for volume peak (recommend deload)
    const weeklyProgress = await this.getWeeklyProgress();
    const recentWeeks = weeklyProgress.slice(-4);
    
    if (recentWeeks.length >= 3) {
      const avgVolume = recentWeeks.reduce((sum, w) => sum + w.totalVolume, 0) / recentWeeks.length;
      const lastWeek = recentWeeks[recentWeeks.length - 1];
      
      if (lastWeek.totalVolume > avgVolume * 1.2) {
        alerts.push({
          type: 'volume_peak',
          message: `Высокий объём (>${Math.round(avgVolume * 1.2)}): рекомендуется делоад на следующей неделе`,
          currentWeight: lastWeek.totalVolume,
          weeksAtWeight: 1
        });
      }
    }

    return alerts;
  }

  /**
   * Get ISO 8601 week number from date
   */
  getWeekNumber(dateStr: string): number {
    const date = new Date(dateStr);
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  }

  /**
   * Get recent strength activity (last 7 days)
   */
  async getRecentActivity(days: number = 7): Promise<{ date: string; volume: number; oneRm: number }[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    const logs = await db.getAll<StrengthLogEntry>('training_log');
    
    const activity = logs
      .filter((l: StrengthLogEntry) => l.date >= cutoffStr)
      .map((l: StrengthLogEntry) => ({
        date: l.date,
        volume: l.totalVolume,
        oneRm: Math.max(...(l?.sets || []).map((s: { weight: number; reps: number }) => epley1RM(s.weight, s.reps)), 0)
      }))
      .sort((a, b) => b.date.localeCompare(a.date));

    // Aggregate by date
    const dailyActivity = new Map<string, { volume: number; oneRm: number }>();
    activity.forEach((a: { date: string; volume: number; oneRm: number }) => {
      const current = dailyActivity.get(a.date) || { volume: 0, oneRm: 0 };
      dailyActivity.set(a.date, {
        volume: current.volume + a.volume,
        oneRm: Math.max(current.oneRm, a.oneRm)
      });
    });

    return Array.from(dailyActivity.entries()).map(([date, data]) => ({ date, ...data }));
  }
}

export const strengthDiary = new StrengthDiary();
