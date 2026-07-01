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

/**
 * importSessionsFromCSV — импорт тренировок из CSV (формат exportToCSV:
 * Date,Exercise,Set,Weight,Reps,RPE[,RIR][,...]). Группирует по дате → сессии,
 * по упражнению → упражнения, пересчитывает тоталы/1RM/avgRPE, добавляет в he_workout_log_v2.
 * Строки с ошибками пропускаются и возвращаются в errors.
 */
export function importSessionsFromCSV(text: string): { importedSessions: number; importedSets: number; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { importedSessions: 0, importedSets: 0, errors: ['Пустой ввод.'] };

  // пропустить заголовок
  let start = 0;
  if (/^date/i.test(lines[0]) || /^"date"/i.test(lines[0])) start = 1;

  const byDate: Record<string, { exName: string; setNumber: number; weight: number; reps: number; rpe: number; rir: number }[]> = {};
  let lineNo = 0;
  for (let i = start; i < lines.length; i++) {
    lineNo = i + 1;
    const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 5) { errors.push(`Строка ${lineNo}: мало колонок (нужно ≥5: date,exercise,set,weight,reps).`); continue; }
    const [date, exercise, setStr, weightStr, repsStr, rpeStr, rirStr] = cols;
    if (!/^\d{4}-\d{2}-\d{2}/.test(date)) { errors.push(`Строка ${lineNo}: дата не YYYY-MM-DD («${date}»).`); continue; }
    const set = parseInt(setStr) || 1;
    const weight = parseFloat(weightStr);
    const reps = parseInt(repsStr);
    if (isNaN(weight) || isNaN(reps)) { errors.push(`Строка ${lineNo}: вес/повт не число.`); continue; }
    const rpe = rpeStr ? parseFloat(rpeStr) || 0 : 0;
    const rir = rirStr ? parseFloat(rirStr) : 2;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push({ exName: exercise || 'Упражнение', setNumber: set, weight, reps, rpe, rir: isNaN(rir as number) ? 2 : rir });
  }

  const newSessions: WorkoutSession[] = [];
  let importedSets = 0;
  Object.keys(byDate).sort().forEach(date => {
    const rows = byDate[date];
    const byEx: Record<string, typeof rows> = {};
    rows.forEach(r => { if (!byEx[r.exName]) byEx[r.exName] = []; byEx[r.exName].push(r); });
    const exercises: WorkoutExercise[] = Object.keys(byEx).map((exName, oi) => {
      const exRows = byEx[exName].sort((a, b) => a.setNumber - b.setNumber);
      const sets: WorkoutSet[] = exRows.map((r, si) => ({
        setNumber: si + 1, weightKg: r.weight, reps: r.reps, rpe: r.rpe, rir: r.rir,
        isPR: false, notes: '',
      }));
      const totalVolume = sets.reduce((s, x) => s + x.weightKg * x.reps, 0);
      const best1RM = Math.max(0, ...sets.map(s => s.reps > 0 ? Math.round(s.weightKg * (1 + s.reps / 30)) : s.weightKg));
      const rpes = sets.map(s => s.rpe).filter(r => r > 0);
      const avgRPE = rpes.length > 0 ? rpes.reduce((a: number, b: number) => a + b, 0) / rpes.length : 0;
      return { exerciseId: exName, exerciseName: exName, pattern: '', muscleGroup: '', order: oi, sets, totalVolume, best1RM, avgRPE };
    });
    const totalVolume = exercises.reduce((s, e) => s + e.totalVolume, 0);
    const totalSets = exercises.reduce((s, e) => s + e.sets.length, 0);
    const totalReps = exercises.reduce((s, e) => s + e.sets.reduce((ss: number, x: WorkoutSet) => ss + x.reps, 0), 0);
    importedSets += totalSets;
    newSessions.push({
      sessionId: 'imp_' + date + '_' + Math.random().toString(36).slice(2, 8),
      date, startTime: '00:00', endTime: '00:00', durationMin: 0,
      focus: 'Импорт CSV', exercises, totalVolume, totalSets, totalReps,
      avgIntensity: 0, prCount: 0, notes: 'Импортировано из CSV', weekNumber: 0, mesocycleWeek: 0,
    });
  });

  if (newSessions.length > 0) {
    const existing = loadSessions();
    // дедуп по date+focus (не дублируем уже импортированные)
    const haveKeys = new Set(existing.filter(s => s.focus === 'Импорт CSV').map(s => s.date));
    const toAdd = newSessions.filter(s => !haveKeys.has(s.date));
    saveSessions([...toAdd, ...existing]);
    return { importedSessions: toAdd.length, importedSets, errors };
  }
  return { importedSessions: 0, importedSets: 0, errors: errors.length ? errors : ['Нет валидных строк.'] };
}
export function getLastSession(): WorkoutSession | null {
  const sessions = loadSessions();
  return sessions.length > 0 ? sessions[0] : null;
}

export function getSessionsByWeek(weekNumber: number): WorkoutSession[] {
  return loadSessions().filter(s => s.weekNumber === weekNumber);
}
