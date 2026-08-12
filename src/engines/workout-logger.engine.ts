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

import { epley1RM } from './e1rm';
import type { WorkoutLog } from '../core/types';

export interface WorkoutSet {
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe: number;
  rir: number;
  velocityMs?: number;
  isPR: boolean;
  notes: string;
  plannedWeight?: number;
  plannedReps?: number;
  plannedRir?: number;
  /** Оценка техники выполнения подхода: 3 (слабо) / 4 (норма) / 5 (отлично). */
  techniqueScore?: number;
}

/** Лимиты валидации подходов (guard от опечаток и повреждённых данных). */
export const SET_LIMITS = { maxWeightKg: 500, maxReps: 100, maxRpe: 10, maxRir: 20 } as const;

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
  weeklyVolume: { week: number; year?: number; volume: number; sessions: number }[];
  exerciseFrequency: Record<string, number>;
}

export interface WorkoutCSV {
  headers: string[];
  rows: string[][];
}

export function getISOWeekNumber(dateStr: string): number {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 0;
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

/** ISO-год недели (отличается от календарного года у 1 января: 2021-01-01 → 2020-W53). */
export function getISOWeekYear(dateStr: string): number {
  const date = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(date.getTime())) return 0;
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  return d.getUTCFullYear();
}

// ═══════════════════════════════════════════════════════════════════════════
// Storage
// ═══════════════════════════════════════════════════════════════════════════

const LOG_KEY = 'he_workout_log_v2';
const PROGRESS_CACHE_KEY = 'he_workout_progress_cache';
const STATS_CACHE_KEY = 'he_workout_stats_cache';
const TRIM_KEY = 'he_workout_log_trimmed';
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

export interface StorageTrimWarning { kept: number; at: number; }

/** Запись о принудительном срезе истории (QuotaExceeded) — для уведомления в UI. */
export function getStorageTrimWarning(): StorageTrimWarning | null {
  try {
    const raw = localStorage.getItem(TRIM_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed.kept === 'number' && parsed.at ? parsed : null;
  } catch { return null; }
}

export function clearStorageTrimWarning(): void {
  try { localStorage.removeItem(TRIM_KEY); } catch {}
}

function markTrimmed(kept: number): void {
  try { localStorage.setItem(TRIM_KEY, JSON.stringify({ kept, at: Date.now() })); } catch {}
}

export function loadSessions(): WorkoutSession[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 2000);
  } catch { return []; }
}

export function saveSessions(sessions: WorkoutSession[]) {
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(sessions));
  } catch (e: any) {
    if (e?.name === 'QuotaExceededError' || String(e).includes('quota')) {
      const sorted = sessions.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''));
      const trySave = (arr: WorkoutSession[], label: string) => {
        try {
          localStorage.setItem(LOG_KEY, JSON.stringify(arr));
          return true;
        } catch {
          return false;
        }
      };
      let kept: WorkoutSession[] | null = null;
      if (trySave(sorted, 'full')) { /* ok */ }
      else if (trySave(sorted.slice(-500), '500')) { kept = sorted.slice(-500); }
      else if (trySave(sorted.slice(-100), '100')) { kept = sorted.slice(-100); }
      else if (trySave(sorted.slice(-50), '50')) { kept = sorted.slice(-50); }
      if (kept) markTrimmed(kept.length);
    }
  }
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
): { session: WorkoutSession; success: boolean; reason?: string; discardReason?: string } {
  const exercises = [...session.exercises];
  if (exerciseIndex < 0 || exerciseIndex >= exercises.length) return { session, success: false, reason: 'Упражнение не найдено', discardReason: 'Упражнение не найдено' };
  const ex = { ...exercises[exerciseIndex] };

  const weightKg = Math.max(0, Number(set.weightKg) || 0);
  const reps = Math.max(0, Math.round(Number(set.reps) || 0));
  const rpe = Math.max(0, Math.min(10, Number(set.rpe) || 0));
  const rir = Math.max(0, Math.min(20, Number(set.rir) || 0));

  if (weightKg <= 0 || reps <= 0) return { session, success: false, reason: 'Вес и повторения должны быть больше 0', discardReason: 'Вес и повторения должны быть больше 0' };
  if (weightKg > SET_LIMITS.maxWeightKg) return { session, success: false, reason: `Вес превышает лимит ${SET_LIMITS.maxWeightKg} кг`, discardReason: `Вес превышает лимит ${SET_LIMITS.maxWeightKg} кг` };
  if (reps > SET_LIMITS.maxReps) return { session, success: false, reason: `Повторения превышают лимит ${SET_LIMITS.maxReps}`, discardReason: `Повторения превышают лимит ${SET_LIMITS.maxReps}` };

  const estimated1RM = epley1RM(weightKg, reps);
  // PR по расчётному 1RM (а не только по весу): 80кг×5 (e1RM 93) > 82кг×1 (e1RM 85).
  const sessionBestE1RM = ex.sets.length > 0 ? Math.max(...ex.sets.map(s => epley1RM(s.weightKg, s.reps))) : 0;
  const isPR = estimated1RM > sessionBestE1RM || (previousBestWeight != null && previousBestWeight > 0 && weightKg > previousBestWeight);

  ex.sets = [...ex.sets, { setNumber: set.setNumber, weightKg, reps, rpe, rir, isPR, notes: set.notes || '', techniqueScore: set.techniqueScore }];
  ex.totalVolume = ex.sets.reduce((s, st) => s + st.weightKg * st.reps, 0);
  ex.best1RM = Math.max(ex.best1RM, estimated1RM);
  ex.avgRPE = Math.round(ex.sets.reduce((s, st) => s + st.rpe, 0) / ex.sets.length * 10) / 10;

  exercises[exerciseIndex] = ex;

  const totalVolume = exercises.reduce((s, e) => s + e.totalVolume, 0);
  const totalSets = exercises.reduce((s, e) => s + e.sets.length, 0);
  const totalReps = exercises.reduce((s, e) => s + e.sets.reduce((ss, st) => ss + st.reps, 0), 0);
  const avgIntensity = totalSets > 0 ? exercises.reduce((s, e) => s + e.avgRPE * e.sets.length, 0) / totalSets : 0;
  const prCount = exercises.reduce((s, e) => s + e.sets.filter(st => st.isPR).length, 0);

  return { session: { ...session, exercises, totalVolume, totalSets, totalReps, avgIntensity: Math.round(avgIntensity * 10) / 10, prCount }, success: true };
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

/** Обновить существующую сессию в localStorage. Возвращает null, если сессия не найдена. */
export function updateSession(sessionId: string, patch: Partial<WorkoutSession>): WorkoutSession | null {
  const sessions = loadSessions();
  const idx = sessions.findIndex(s => s.sessionId === sessionId);
  if (idx < 0) return null;
  const updated: WorkoutSession = { ...sessions[idx], ...patch };
  sessions[idx] = updated;
  saveSessions(sessions);
  return updated;
}

/** Удалить сессию из localStorage. */
export function deleteSession(sessionId: string): boolean {
  const sessions = loadSessions();
  const next = sessions.filter(s => s.sessionId !== sessionId);
  if (next.length === sessions.length) return false;
  saveSessions(next);
  return true;
}

/** Убрать legacy-маркеры из имени упражнения («[superset:1]», «[note:...]»), которыми
 *  старые версии формы загрязняли exerciseName. */
export function cleanLegacyExerciseName(name: string): string {
  return (name || '')
    .replace(/\s*\[superset:\d+\]/gi, '')
    .replace(/\s*\[note:[^\]]*\]/gi, '')
    .trim();
}

/** Контентная сигнатура тренировки для детекции дублей:
 *  дата + отсортированные (упражнение, подходы: вес|повт|RIR|RPE). */
export function workoutContentSignature(log: { date: string; exercises: WorkoutLog['exercises'] }): string {
  const exParts = (log.exercises || [])
    .map(ex => `${ex.exerciseName}:${(ex.sets || []).map(s => `${s.weight}|${s.reps}|${s.rir ?? ''}|${s.rpe ?? ''}`).join(';')}`)
    .sort();
  return `${log.date}|${exParts.join('~')}`;
}

/**
 * Найти дубли тренировок: одинаковые (дата + полный контент упражнений/подходов).
 * Возвращает пары { keep, dupes } — keep = запись с наибольшим id (детерминированно),
 * dupes = копии для удаления. Чистая функция (без хранилища).
 */
export function findDuplicateWorkouts(logs: WorkoutLog[]): { keep: WorkoutLog; dupes: WorkoutLog[] }[] {
  const bySig = new Map<string, WorkoutLog[]>();
  for (const log of logs) {
    const sig = workoutContentSignature(log);
    if (!bySig.has(sig)) bySig.set(sig, []);
    bySig.get(sig)!.push(log);
  }
  const out: { keep: WorkoutLog; dupes: WorkoutLog[] }[] = [];
  for (const group of bySig.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort((a, b) => (b.id || '').localeCompare(a.id || ''));
    out.push({ keep: sorted[0], dupes: sorted.slice(1) });
  }
  return out;
}

/** Обратный маппер WorkoutLog → WorkoutSession (для зеркалирования IDB → localStorage).
 *  Сохраняет id как sessionId, чтобы удаление/обновление работало в обоих слоях. */
export function workoutLogToSession(log: WorkoutLog): WorkoutSession {
  const exercises: WorkoutExercise[] = (log.exercises || []).map(ex => {
    const sets: WorkoutSet[] = (ex.sets || []).map((st, i) => ({
      setNumber: i + 1,
      weightKg: st.weight || 0,
      reps: st.reps || 0,
      rpe: st.rpe || 0,
      rir: st.rir ?? 2,
      velocityMs: undefined,
      isPR: false,
      notes: '',
      techniqueScore: st.techniqueScore,
    }));
    return {
      exerciseId: ex.exerciseId,
      exerciseName: ex.exerciseName,
      pattern: ex.isCompound ? 'compound' : 'isolation',
      muscleGroup: '',
      order: 0,
      sets,
      totalVolume: ex.totalVolume || sets.reduce((s, x) => s + x.weightKg * x.reps, 0),
      best1RM: ex.estimated1RM || Math.max(0, ...sets.map(x => epley1RM(x.weightKg, x.reps))),
      avgRPE: sets.length > 0 ? Math.round((sets.reduce((s, x) => s + x.rpe, 0) / sets.length) * 10) / 10 : 0,
    };
  });
  return {
    sessionId: log.id,
    date: log.date,
    startTime: '00:00',
    endTime: '00:00',
    durationMin: log.duration || 0,
    focus: log.split || 'Тренировка',
    exercises,
    totalVolume: exercises.reduce((s, e) => s + e.totalVolume, 0),
    totalSets: exercises.reduce((s, e) => s + e.sets.length, 0),
    totalReps: exercises.reduce((s, e) => s + e.sets.reduce((ss, st) => ss + st.reps, 0), 0),
    avgIntensity: 0,
    prCount: 0,
    notes: log.notes || '',
    weekNumber: log.weekNumber || 0,
    mesocycleWeek: 0,
  };
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
    if (!Array.isArray(sess.exercises)) continue;
    for (const ex of sess.exercises) {
      if (!ex || !ex.exerciseName) continue;
      exerciseFreq[ex.exerciseName] = (exerciseFreq[ex.exerciseName] || 0) + 1;
      if (!Array.isArray(ex.sets)) continue;
      for (const set of ex.sets) {
        if (!set) continue;
        if (set.isPR) prCount++;
        const key = ex.exerciseName;
        const estRM = epley1RM(set.weightKg, set.reps);
        if (!bestLifts[key] || estRM > epley1RM(bestLifts[key].weight, bestLifts[key].reps)) {
          bestLifts[key] = { weight: set.weightKg, reps: set.reps, date: sess.date };
        }
      }
    }
  }

  // Weekly volume (ISO week + ISO year — недели разных лет не схлопываются)
  const weekMap = new Map<string, { year: number; week: number; volume: number; sessions: number }>();
  for (const sess of sessions) {
    const weekNum = getISOWeekNumber(sess.date);
    const year = getISOWeekYear(sess.date);
    const key = `${year}-W${weekNum}`;
    if (!weekMap.has(key)) weekMap.set(key, { year, week: weekNum, volume: 0, sessions: 0 });
    const w = weekMap.get(key)!;
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
    weeklyVolume: [...weekMap.values()].sort((a, b) => a.year - b.year || a.week - b.week).map(({ year, week, volume, sessions }) => ({ week, year, volume, sessions })),
    exerciseFrequency: exerciseFreq,
  };
}

export function getRecentPRs(limit: number = 5): { exercise: string; weight: number; reps: number; date: string }[] {
  const sessions = loadSessions();
  const prs: { exercise: string; weight: number; reps: number; date: string }[] = [];

  for (const sess of sessions) {
    if (!Array.isArray(sess.exercises)) continue;
    for (const ex of sess.exercises) {
      if (!ex || !Array.isArray(ex.sets)) continue;
      for (const set of ex.sets) {
        if (set && set.isPR) prs.push({ exercise: ex.exerciseName, weight: set.weightKg, reps: set.reps, date: sess.date });
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
    if (!Array.isArray(sess.exercises)) continue;
    for (const ex of sess.exercises) {
      if (!ex || !Array.isArray(ex.sets)) continue;
      for (const set of ex.sets) {
        if (!set) continue;
        const estRM = epley1RM(set.weightKg, set.reps);
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

/** Разбить CSV-строку с учётом кавычек; поддерживает запятую и точку с запятой. */
export function splitCSVRow(line: string): string[] {
  const commas = (line.match(/,/g) || []).length;
  const semis = (line.match(/;/g) || []).length;
  const sep = semis > commas ? ';' : ',';
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQ) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = false;
      } else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === sep) { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

/**
 * importSessionsFromCSV — импорт тренировок из CSV (форматы exportToCSV и экспорта хаба:
 * date,exercise,set,weight,reps[,rpe[,rir[,notes]]] и Date,Exercise,Set,Weight,Reps,RPE,RIR,1RM,PR,Focus).
 * Группирует по дате → сессии, по упражнению → упражнения, пересчитывает тоталы/1RM/avgRPE,
 * weekNumber = ISO-неделя даты, isPR — по росту e1RM внутри упражнения.
 * Добавляет в he_workout_log_v2 (зеркалируется в IndexedDB при следующем чтении). */
export function importSessionsFromCSV(text: string): { importedSessions: number; importedSets: number; errors: string[] } {
  const errors: string[] = [];
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return { importedSessions: 0, importedSets: 0, errors: ['Пустой ввод.'] };

  // пропустить заголовок
  let start = 0;
  if (/^date/i.test(lines[0]) || /^"date/i.test(lines[0])) start = 1;

  const byDate: Record<string, { exName: string; setNumber: number; weight: number; reps: number; rpe: number; rir: number; notes: string }[]> = {};
  let lineNo = 0;
  for (let i = start; i < lines.length; i++) {
    lineNo = i + 1;
    const cols = splitCSVRow(lines[i]);
    if (cols.length < 5) { errors.push(`Строка ${lineNo}: мало колонок (нужно ≥5: date,exercise,set,weight,reps).`); continue; }
    const [date, exercise, setStr, weightStr, repsStr, rpeStr, rirStr, notesCol] = cols;
    if (!/^\d{4}-\d{2}-\d{2}/.test(date)) { errors.push(`Строка ${lineNo}: дата не YYYY-MM-DD («${date}»).`); continue; }
    const set = parseInt(setStr) || 1;
    const weight = parseFloat(weightStr);
    const reps = parseInt(repsStr);
    if (isNaN(weight) || isNaN(reps)) { errors.push(`Строка ${lineNo}: вес/повт не число.`); continue; }
    if (weight > SET_LIMITS.maxWeightKg || weight <= 0) { errors.push(`Строка ${lineNo}: вес вне лимита (0..${SET_LIMITS.maxWeightKg}).`); continue; }
    if (reps > SET_LIMITS.maxReps || reps <= 0) { errors.push(`Строка ${lineNo}: повторения вне лимита (1..${SET_LIMITS.maxReps}).`); continue; }
    const rpe = rpeStr ? parseFloat(rpeStr) || 0 : 0;
    const rirRaw = rirStr !== undefined && rirStr !== '' ? parseFloat(rirStr) : 2;
    const rir = isNaN(rirRaw) ? 2 : rirRaw;
    // 8-я колонка: заметка (в экспорте хаба), либо 1RM/PR/фокус (в экспорте движка) — берём только текст.
    const notes = notesCol !== undefined && !/^-?\d+(\.\d+)?$/.test(notesCol) ? notesCol : '';
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push({ exName: exercise || 'Упражнение', setNumber: set, weight, reps, rpe, rir, notes });
  }

  const newSessions: WorkoutSession[] = [];
  let importedSets = 0;
  Object.keys(byDate).sort().forEach(date => {
    const rows = byDate[date];
    const byEx: Record<string, typeof rows> = {};
    rows.forEach(r => { if (!byEx[r.exName]) byEx[r.exName] = []; byEx[r.exName].push(r); });
    const exercises: WorkoutExercise[] = Object.keys(byEx).map((exName, oi) => {
      const exRows = byEx[exName].sort((a, b) => a.setNumber - b.setNumber);
      // PR пересчитывается по росту e1RM внутри упражнения
      let maxE1RM = 0;
      const sets: WorkoutSet[] = exRows.map((r, si) => {
        const e1 = epley1RM(r.weight, r.reps);
        const isPR = e1 > maxE1RM;
        maxE1RM = Math.max(maxE1RM, e1);
        return {
          setNumber: si + 1, weightKg: r.weight, reps: r.reps, rpe: r.rpe, rir: r.rir,
          isPR, notes: r.notes || '',
        };
      });
      const totalVolume = sets.reduce((s, x) => s + x.weightKg * x.reps, 0);
      const best1RM = Math.max(0, ...sets.map(s => epley1RM(s.weightKg, s.reps)));
      const rpes = sets.map(s => s.rpe).filter(r => r > 0);
      const avgRPE = rpes.length > 0 ? rpes.reduce((a: number, b: number) => a + b, 0) / rpes.length : 0;
      return { exerciseId: exName, exerciseName: exName, pattern: '', muscleGroup: '', order: oi, sets, totalVolume, best1RM, avgRPE };
    });
    const totalVolume = exercises.reduce((s, e) => s + e.totalVolume, 0);
    const totalSets = exercises.reduce((s, e) => s + e.sets.length, 0);
    const totalReps = exercises.reduce((s, e) => s + e.sets.reduce((ss: number, x: WorkoutSet) => ss + x.reps, 0), 0);
    importedSets += totalSets;
    const weekNumber = getISOWeekNumber(date);
    const prCount = exercises.reduce((s, e) => s + e.sets.filter(x => x.isPR).length, 0);
    newSessions.push({
      sessionId: 'imp_' + date + '_' + Math.random().toString(36).slice(2, 8),
      date, startTime: '00:00', endTime: '00:00', durationMin: 0,
      focus: 'Импорт CSV', exercises, totalVolume, totalSets, totalReps,
      avgIntensity: 0, prCount, notes: 'Импортировано из CSV', weekNumber, mesocycleWeek: weekNumber % 4 || 4,
    });
  });

  if (newSessions.length > 0) {
    const existing = loadSessions();
    // дедуп: проверяем date + exercise name + weight + reps
    const existingKeys = new Set(
      existing.flatMap(s => (s.exercises || []).flatMap(ex => 
        (ex.sets || []).map(st => `${s.date}|${ex.exerciseName}|${st.weightKg}|${st.reps}`)
      ))
    );
    const toAdd = newSessions.filter(s => 
      !s.exercises.some(ex => (ex.sets || []).some(st => existingKeys.has(`${s.date}|${ex.exerciseName}|${st.weightKg}|${st.reps}`)))
    );
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

export interface CachedProgress {
  exerciseName: string;
  bestWeight: number;
  bestReps: number;
  bestE1RM: number;
  totalVolume: number;
  totalSets: number;
  sessions: number;
  lastDate: string;
  trend: 'up' | 'down' | 'stable';
  weightDelta: number;
  e1RMDelta: number;
  cachedAt: number;
}

interface CachedStats {
  totalSessions: number;
  totalVolume: number;
  totalSets: number;
  totalReps: number;
  prCount: number;
  streak: number;
  cachedAt: number;
}

function readCache<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed?.cachedAt && Date.now() - parsed.cachedAt > CACHE_TTL) {
      localStorage.removeItem(key);
      return fallback;
    }
    return parsed?.data ?? fallback;
  } catch {
    return fallback;
  }
}

function writeCache<T>(key: string, data: T) {
  try {
    localStorage.setItem(key, JSON.stringify({ data, cachedAt: Date.now() }));
  } catch {}
}

export function cacheExerciseProgress(progress: CachedProgress[]) {
  writeCache(PROGRESS_CACHE_KEY, progress);
}

export function loadCachedExerciseProgress(): CachedProgress[] {
  return readCache<CachedProgress[]>(PROGRESS_CACHE_KEY, []);
}

export function cacheSessionStats(stats: Omit<CachedStats, 'cachedAt'>) {
  writeCache(STATS_CACHE_KEY, { ...stats, cachedAt: Date.now() });
}

export function loadCachedSessionStats(): Omit<CachedStats, 'cachedAt'> | null {
  const cached = readCache<CachedStats | undefined>(STATS_CACHE_KEY, undefined);
  if (!cached || !cached.cachedAt) return null;
  if (Date.now() - cached.cachedAt > CACHE_TTL) {
    localStorage.removeItem(STATS_CACHE_KEY);
    return null;
  }
  const { cachedAt, ...rest } = cached;
  return rest;
}

export function getCachedProgressForExercise(name: string): CachedProgress | null {
  const all = loadCachedExerciseProgress();
  const exact = all.find(p => p.exerciseName.toLowerCase() === name.toLowerCase());
  if (exact) return exact;
  const partial = all.find(p => name.toLowerCase().includes(p.exerciseName.toLowerCase()) || p.exerciseName.toLowerCase().includes(name.toLowerCase()));
  return partial ?? null;
}

export interface ExerciseProgress {
  exerciseName: string;
  firstDate: string;
  lastDate: string;
  sessions: number;
  totalSets: number;
  totalVolume: number;
  bestWeight: number;
  bestReps: number;
  bestE1RM: number;
  avgRPE: number;
  trend: 'up' | 'down' | 'stable';
  weightDelta: number;
  e1RMDelta: number;
}

export function getExerciseProgress(name: string, limit: number = 20): ExerciseProgress | null {
  const sessions = loadSessions().slice(0, limit);
  const sets: { weightKg: number; reps: number; rpe: number; date: string }[] = [];
  let firstDate = '';
  let lastDate = '';
  for (const sess of sessions) {
    if (!Array.isArray(sess.exercises)) continue;
    for (const ex of sess.exercises) {
      if (!ex || !ex.sets?.length) continue;
      const matches = ex.exerciseName.toLowerCase().includes(name.toLowerCase()) ||
        ex.exerciseId.toLowerCase().includes(name.toLowerCase());
      if (!matches) continue;
      firstDate = firstDate ? (sess.date < firstDate ? sess.date : firstDate) : sess.date;
      lastDate = lastDate ? (sess.date > lastDate ? sess.date : lastDate) : sess.date;
      for (const st of ex.sets) {
        sets.push({ weightKg: st.weightKg, reps: st.reps, rpe: st.rpe, date: sess.date });
      }
    }
  }
  if (!sets.length) return null;
  const bestWeight = Math.max(...sets.map(s => s.weightKg));
  const bestReps = Math.max(...sets.map(s => s.reps));
  const bestE1RM = Math.max(...sets.map(s => epley1RM(s.weightKg, s.reps)));
  const rpeSets = sets.filter(s => s.rpe > 0);
  const avgRPE = rpeSets.length > 0 ? rpeSets.reduce((a, s) => a + s.rpe, 0) / rpeSets.length : 0;
  const half = Math.floor(sets.length / 2);
  const firstHalf = sets.slice(0, half);
  const secondHalf = sets.slice(-half || sets.length);
  const firstAvgE1RM = firstHalf.reduce((a, s) => a + epley1RM(s.weightKg, s.reps), 0) / firstHalf.length;
  const secondAvgE1RM = secondHalf.reduce((a, s) => a + epley1RM(s.weightKg, s.reps), 0) / secondHalf.length;
  const e1RMDelta = Number((secondAvgE1RM - firstAvgE1RM).toFixed(1));
  const firstAvgWeight = firstHalf.reduce((a, s) => a + s.weightKg, 0) / firstHalf.length;
  const secondAvgWeight = secondHalf.reduce((a, s) => a + s.weightKg, 0) / secondHalf.length;
  const weightDelta = Number((secondAvgWeight - firstAvgWeight).toFixed(1));
  const trend = e1RMDelta > 1 ? 'up' : e1RMDelta < -1 ? 'down' : 'stable';
  return {
    exerciseName: name,
    firstDate, lastDate, sessions: new Set(sets.map(s => s.date)).size,
    totalSets: sets.length, totalVolume: sets.reduce((a, s) => a + s.weightKg * s.reps, 0),
    bestWeight, bestReps, bestE1RM, avgRPE: Number(avgRPE.toFixed(1)), trend, weightDelta, e1RMDelta,
  };
}

export interface VolumeTrendDay {
  date: string;
  volume: number;
  sets: number;
  sessions: number;
}

export function getVolumeTrend(days: number = 14): VolumeTrendDay[] {
  // Окно по датам, а не по числу сессий: последние `days` календарных дней.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const sessions = loadSessions().filter(s => s.date >= cutoffStr);
  const map = new Map<string, { volume: number; sets: number; sessions: number }>();
  for (const sess of sessions) {
    const cur = map.get(sess.date) || { volume: 0, sets: 0, sessions: 0 };
    map.set(sess.date, {
      volume: cur.volume + sess.totalVolume,
      sets: cur.sets + sess.totalSets,
      sessions: cur.sessions + 1,
    });
  }
  return Array.from(map.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export interface SessionComparison {
  older: WorkoutSession | null;
  newer: WorkoutSession | null;
  volumeDelta: number;
  setsDelta: number;
  repsDelta: number;
  intensityDelta: number;
}

export function compareWithPrevious(session: WorkoutSession): SessionComparison {
  const sessions = loadSessions();
  const idx = sessions.findIndex(s => s.sessionId === session.sessionId);
  const newer = session;
  const older = idx >= 0 && idx + 1 < sessions.length ? sessions[idx + 1] : null;
  if (!older) {
    return { older: null, newer, volumeDelta: 0, setsDelta: 0, repsDelta: 0, intensityDelta: 0 };
  }
  return {
    older,
    newer,
    volumeDelta: Number((newer.totalVolume - older.totalVolume).toFixed(0)),
    setsDelta: newer.totalSets - older.totalSets,
    repsDelta: newer.totalReps - older.totalReps,
    intensityDelta: Number((newer.avgIntensity - older.avgIntensity).toFixed(1)),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Bodyweight Exercise Progression
// ═══════════════════════════════════════════════════════════════════════════

const BODYWEIGHT_EXERCISE_PATTERNS = [
  /подтягиван/i, /отжиман/i, /планк/i, /скручиван/i, /подъём ног/i,
  /dip/i, /push.?up/i, /pull.?up/i, /plank/i, /crunch/i, /leg.?raise/i,
  /брусь/i, /колен/i, /ab/i,
];

export function isBodyweightExercise(exerciseName: string): boolean {
  return BODYWEIGHT_EXERCISE_PATTERNS.some(p => p.test(exerciseName));
}

export interface BodyweightProgress {
  exerciseName: string;
  sessions: number;
  totalReps: number;
  bestRepsPerSet: number;
  totalVolume: number;
  avgRepsPerSession: number;
  trend: 'up' | 'down' | 'stable';
  lastDate: string;
}

export function getBodyweightProgress(name: string, limit: number = 30): BodyweightProgress | null {
  const sessions = loadSessions().slice(0, limit);
  const repsData: { reps: number; date: string }[] = [];
  let lastDate = '';
  let totalReps = 0;
  let bestRepsPerSet = 0;

  for (const sess of sessions) {
    if (!Array.isArray(sess.exercises)) continue;
    for (const ex of sess.exercises) {
      if (!ex || !ex.sets?.length) continue;
      const matches = ex.exerciseName.toLowerCase().includes(name.toLowerCase()) ||
        ex.exerciseId.toLowerCase().includes(name.toLowerCase());
      if (!matches) continue;

      const isBW = ex.sets.some(s => s.weightKg === 0 || isBodyweightExercise(ex.exerciseName));
      if (!isBW) continue;

      lastDate = lastDate ? (sess.date > lastDate ? sess.date : lastDate) : sess.date;
      for (const st of ex.sets) {
        totalReps += st.reps;
        bestRepsPerSet = Math.max(bestRepsPerSet, st.reps);
        repsData.push({ reps: st.reps, date: sess.date });
      }
    }
  }

  if (!repsData.length) return null;

  const sessions2 = new Set(repsData.map(d => d.date)).size;
  const avgRepsPerSession = Math.round(totalReps / Math.max(1, sessions2));

  // Trend: compare first half vs second half avg reps
  const half = Math.floor(repsData.length / 2);
  const firstHalf = repsData.slice(0, half);
  const secondHalf = repsData.slice(-half || repsData.length);
  const firstAvg = firstHalf.reduce((a, d) => a + d.reps, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, d) => a + d.reps, 0) / secondHalf.length;
  const trend = secondAvg > firstAvg * 1.05 ? 'up' : secondAvg < firstAvg * 0.95 ? 'down' : 'stable';

  return {
    exerciseName: name,
    sessions: sessions2,
    totalReps,
    bestRepsPerSet,
    totalVolume: totalReps,
    avgRepsPerSession,
    trend,
    lastDate,
  };
}

export function getRecentBodyweightPRs(limit: number = 5): { exercise: string; bestReps: number; date: string }[] {
  const sessions = loadSessions();
  const prs: { exercise: string; bestReps: number; date: string }[] = [];

  for (const sess of sessions) {
    if (!Array.isArray(sess.exercises)) continue;
    for (const ex of sess.exercises) {
      if (!ex || !Array.isArray(ex.sets)) continue;
      const isBW = ex.sets.some(s => s.weightKg === 0 || isBodyweightExercise(ex.exerciseName));
      if (!isBW) continue;
      const bestReps = Math.max(...ex.sets.map(s => s.reps), 0);
      if (bestReps > 0) {
        prs.push({ exercise: ex.exerciseName, bestReps, date: sess.date });
      }
    }
  }

  // Group by exercise, take best per exercise
  const byExercise = new Map<string, { bestReps: number; date: string }>();
  for (const pr of prs) {
    const existing = byExercise.get(pr.exercise);
    if (!existing || pr.bestReps > existing.bestReps || (pr.bestReps === existing.bestReps && pr.date > existing.date)) {
      byExercise.set(pr.exercise, { bestReps: pr.bestReps, date: pr.date });
    }
  }

  return Array.from(byExercise.entries())
    .map(([exercise, v]) => ({ exercise, ...v }))
    .sort((a, b) => b.bestReps - a.bestReps)
    .slice(0, limit);
}
