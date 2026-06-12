/**
 * Enhanced Workout Logger — Structured set/rep/session tracking.
 *
 * Features:
 *  - Session logging with full exercise/set/rep hierarchy
 *  - RPE/RIR/Velocity tracking per set
 *  - Auto 1RM calculation per set
 *  - Volume/intensity auto-calculation
 *  - Session summary with PR detection
 *  - Weekly/monthly rollups
 *  - Export to JSON/CSV
 *
 * Data stored in localStorage under 'he_workout_log_v2'.
 *
 * @module workout-logger-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface WorkoutSet {
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe: number;
  rir: number;
  velocityMs?: number;
  isPR: boolean;
  notes: string;
}

export interface WorkoutExercise {
  exerciseId: string;
  exerciseName: string;
  pattern: string;
  muscleGroup: string;
  order: number;
  sets: WorkoutSet[];
  totalVolume: number;
  best1RM: number;
  avgRPE: number;
}

export interface WorkoutSession {
  sessionId: string;
  date: string;
  startTime: string;
  endTime: string;
  durationMin: number;
  focus: string;
  exercises: WorkoutExercise[];
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  avgIntensity: number;
  prCount: number;
  notes: string;
  weekNumber: number;
  mesocycleWeek: number;
}

export interface WorkoutStats {
  totalSessions: number;
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  bestLifts: Record<string, { weight: number; reps: number; date: string }>;
  prCount: number;
  streak: number;
  weeklyVolume: { week: number; volume: number; sessions: number }[];
  exerciseFrequency: Record<string, number>;
}

export interface WorkoutCSV {
  headers: string[];
  rows: string[][];
}

// ═══════════════════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════════════════

const LOG_KEY = 'he_workout_log_v2';

export function loadSessions(): WorkoutSession[] {
  try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; }
}

function saveSessions(sessions: WorkoutSession[]) {
  sessions.sort((a, b) => b.date.localeCompare(a.date));
  localStorage.setItem(LOG_KEY, JSON.stringify(sessions.slice(-500)));
}

// ═══════════════════════════════════════════════════════════════════════════
// Session management
// ═══════════════════════════════════════════════════════════════════════════

export function startSession(focus: string, weekNumber: number): WorkoutSession {
  return {
    sessionId: 'sess_' + Date.now(),
    date: new Date().toISOString().slice(0, 10),
    startTime: new Date().toTimeString().slice(0, 5),
    endTime: '',
    durationMin: 0,
    focus,
    exercises: [],
    totalVolume: 0, totalSets: 0, totalReps: 0,
    avgIntensity: 0, prCount: 0, notes: '',
    weekNumber, mesocycleWeek: weekNumber % 4 || 4,
  };
}

export function addExerciseToSession(
  session: WorkoutSession,
  exercise: { id: string; name: string; pattern: string; muscleGroup: string },
): WorkoutSession {
  const ex: WorkoutExercise = {
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    pattern: exercise.pattern,
    muscleGroup: exercise.muscleGroup,
    order: session.exercises.length + 1,
    sets: [],
    totalVolume: 0, best1RM: 0, avgRPE: 0,
  };
  return { ...session, exercises: [...session.exercises, ex] };
}

export function logSet(
  session: WorkoutSession,
  exerciseIndex: number,
  set: Omit<WorkoutSet, 'isPR'>,
  previousBestWeight?: number,
): WorkoutSession {
  const exercises = [...session.exercises];
  const ex = { ...exercises[exerciseIndex] };

  // Check if PR
  const isPR = previousBestWeight ? set.weightKg > previousBestWeight : ex.sets.length === 0 || set.weightKg > Math.max(...ex.sets.map(s => s.weightKg), 0);
  const estimated1RM = set.reps > 0 ? Math.round(set.weightKg * (1 + set.reps / 30)) : set.weightKg;

  ex.sets = [...ex.sets, { ...set, isPR }];
  ex.totalVolume = ex.sets.reduce((s, st) => s + st.weightKg * st.reps, 0);
  ex.best1RM = Math.max(ex.best1RM, estimated1RM);
  ex.avgRPE = Math.round(ex.sets.reduce((s, st) => s + st.rpe, 0) / ex.sets.length * 10) / 10;

  exercises[exerciseIndex] = ex;

  const totalVolume = exercises.reduce((s, e) => s + e.totalVolume, 0);
  const totalSets = exercises.reduce((s, e) => s + e.sets.length, 0);
  const totalReps = exercises.reduce((s, e) => s + e.sets.reduce((ss, st) => ss + st.reps, 0), 0);
  const avgIntensity = totalSets > 0 ? exercises.reduce((s, e) => s + e.avgRPE * e.sets.length, 0) / totalSets : 0;
  const prCount = exercises.reduce((s, e) => s + e.sets.filter(st => st.isPR).length, 0);

  return { ...session, exercises, totalVolume, totalSets, totalReps, avgIntensity: Math.round(avgIntensity * 10) / 10, prCount };
}

export function finishSession(session: WorkoutSession, notes: string = ''): WorkoutSession {
  const endTime = new Date().toTimeString().slice(0, 5);
  const startParts = session.startTime.split(':').map(Number);
  const endParts = endTime.split(':').map(Number);
  const startMin = startParts[0] * 60 + startParts[1];
  const endMin = endParts[0] * 60 + endParts[1];
  const durationMin = endMin >= startMin ? endMin - startMin : (1440 - startMin) + endMin;

  const finished = { ...session, endTime, durationMin, notes };
  const sessions = loadSessions();
  sessions.push(finished);
  saveSessions(sessions);
  return finished;
}

// ═══════════════════════════════════════════════════════════════════════════
// Analytics
// ═══════════════════════════════════════════════════════════════════════════

export function getWorkoutStats(): WorkoutStats {
  const sessions = loadSessions();
  const bestLifts: Record<string, { weight: number; reps: number; date: string }> = {};
  let prCount = 0;
  const exerciseFreq: Record<string, number> = {};

  for (const sess of sessions) {
    for (const ex of sess.exercises) {
      exerciseFreq[ex.exerciseName] = (exerciseFreq[ex.exerciseName] || 0) + 1;

      for (const set of ex.sets) {
        if (set.isPR) prCount++;
        const key = ex.exerciseName;
        const estRM = set.reps > 0 ? set.weightKg * (1 + set.reps / 30) : set.weightKg;
        if (!bestLifts[key] || estRM > bestLifts[key].weight * (1 + bestLifts[key].reps / 30)) {
          bestLifts[key] = { weight: set.weightKg, reps: set.reps, date: sess.date };
        }
      }
    }
  }

  // Weekly volume
  const weekMap = new Map<number, { volume: number; sessions: number }>();
  for (const sess of sessions) {
    const d = new Date(sess.date);
    const weekNum = Math.floor(d.getTime() / (7 * 24 * 3600 * 1000));
    if (!weekMap.has(weekNum)) weekMap.set(weekNum, { volume: 0, sessions: 0 });
    const w = weekMap.get(weekNum)!;
    w.volume += sess.totalVolume;
    w.sessions++;
  }

  // Streak
  let streak = 0;
  const dates = [...new Set(sessions.map(s => s.date))].sort().reverse();
  const today = new Date();
  for (let i = 0; i < dates.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    if (dates[i] === expected.toISOString().slice(0, 10)) streak++;
    else break;
  }

  return {
    totalSessions: sessions.length,
    totalVolume: sessions.reduce((s, sess) => s + sess.totalVolume, 0),
    totalSets: sessions.reduce((s, sess) => s + sess.totalSets, 0),
    totalReps: sessions.reduce((s, sess) => s + sess.totalReps, 0),
    bestLifts,
    prCount,
    streak,
    weeklyVolume: [...weekMap.entries()].sort(([a], [b]) => a - b).map(([w, v]) => ({ week: w, ...v })),
    exerciseFrequency: exerciseFreq,
  };
}

export function getRecentPRs(limit: number = 5): { exercise: string; weight: number; reps: number; date: string }[] {
  const sessions = loadSessions();
  const prs: { exercise: string; weight: number; reps: number; date: string }[] = [];

  for (const sess of sessions) {
    for (const ex of sess.exercises) {
      for (const set of ex.sets) {
        if (set.isPR) prs.push({ exercise: ex.exerciseName, weight: set.weightKg, reps: set.reps, date: sess.date });
      }
    }
  }

  return prs.sort((a, b) => b.date.localeCompare(a.date)).slice(0, limit);
}

export function exportToCSV(): WorkoutCSV {
  const sessions = loadSessions();
  const headers = ['Date', 'Exercise', 'Set', 'Weight', 'Reps', 'RPE', 'RIR', '1RM', 'PR', 'Session Focus'];
  const rows: string[][] = [];

  for (const sess of sessions) {
    for (const ex of sess.exercises) {
      for (const set of ex.sets) {
        const estRM = set.reps > 0 ? Math.round(set.weightKg * (1 + set.reps / 30)) : set.weightKg;
        rows.push([
          sess.date, ex.exerciseName, String(set.setNumber),
          String(set.weightKg), String(set.reps), String(set.rpe), String(set.rir),
          String(estRM), set.isPR ? 'Yes' : 'No', sess.focus,
        ]);
      }
    }
  }

  return { headers, rows };
}

export function getLastSession(): WorkoutSession | null {
  const sessions = loadSessions();
  return sessions.length > 0 ? sessions[0] : null;
}

export function getSessionsByWeek(weekNumber: number): WorkoutSession[] {
  return loadSessions().filter(s => s.weekNumber === weekNumber);
}
