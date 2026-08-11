/**
 * Training Log Analytics + Exercise Progression + Measurement Tracker
 *
 * Log Analytics: deep metrics from workout history — volume, intensity, frequency,
 *   exercise rotation, set/rep distribution, time-under-tension, density
 * Exercise Progression: per-exercise tracking with 1RM estimates, plateaus, deltas
 * Measurement Tracker: body measurements with visual trends, symmetry analysis
 * Weekly Report Generator: auto-generated weekly summary with insights
 *
 * @module log-analytics-progression-engine
 */
import { saveWeightLog } from './profile-store';

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface WorkoutSetLog {
  date: string;
  exerciseName: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  rpe: number;
  rir: number;
  restSec: number;
  tempo: string;
  isPR: boolean;
}

export interface ExerciseProgressionData {
  exercise: string;
  sessions: { date: string; sets: number; reps: number; avgWeight: number; maxWeight: number; volume: number; e1RM: number }[];
  current1RM: number;
  start1RM: number;
  totalProgress: number;
  progressPerWeek: number;
  plateauWeeks: number;
  bestSet: { weight: number; reps: number; date: string };
  trend: 'strongly_up' | 'up' | 'stable' | 'down' | 'strongly_down';
  projected1RM4Weeks: number;
  projected1RM12Weeks: number;
}

export interface LogAnalytics {
  totalSessions: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  avgSessionDuration: number;
  mostTrainedExercise: string;
  mostTrainedPattern: string;
  setDistribution: { low: number; medium: number; high: number };
  repDistribution: { strength: number; hypertrophy: number; endurance: number };
  rpeDistribution: Record<number, number>;
  weeklyVolume: { week: string; volume: number; sessions: number }[];
  monthlyVolume: { month: string; volume: number }[];
  density: number; // kg/minute
  consistency: number; // % weeks with 3+ sessions
  prFrequency: number; // PRs per week
  deloadCompliance: number; // % of scheduled deloads completed
}

export interface BodyMeasurement {
  date: string;
  weightKg: number;
  bodyFatPercent: number;
  neckCm: number;
  chestCm: number;
  shoulderCm: number;
  armLeftCm: number;
  armRightCm: number;
  forearmLeftCm: number;
  forearmRightCm: number;
  waistCm: number;
  hipCm: number;
  thighLeftCm: number;
  thighRightCm: number;
  calfLeftCm: number;
  calfRightCm: number;
  notes: string;
}

export interface MeasurementAnalytics {
  current: BodyMeasurement;
  first: BodyMeasurement;
  changes: Record<string, number>;
  symmetry: { arms: number; forearms: number; thighs: number; calves: number };
  waistToHip: number;
  shoulderToWaist: number;
  ffmi: number;
  bmi: number;
  lbm: number;
  fatMass: number;
  weeklyChanges: { date: string; weight: number; bf: number; waist: number }[];
  projectionToGoal: { weeks: number; targetDate: string };
}

export interface WeeklyReport {
  weekStart: string;
  weekEnd: string;
  sessions: number;
  volume: number;
  avgIntensity: number;
  prs: number;
  topExercise: string;
  topSet: string;
  muscleGroups: Record<string, number>;
  insights: string[];
  recommendations: string[];
  nextWeekPreview: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Exercise Progression Tracker
// ═══════════════════════════════════════════════════════════════════════════

export function trackExerciseProgression(logs: WorkoutSetLog[], exerciseName: string): ExerciseProgressionData | null {
  const exLogs = logs.filter(l => l.exerciseName.toLowerCase() === exerciseName.toLowerCase());
  if (exLogs.length < 2) return null;

  // Group by date
  const sessions = new Map<string, { sets: number; reps: number; weights: number[]; maxW: number; volume: number }>();
  for (const log of exLogs) {
    if (!sessions.has(log.date)) sessions.set(log.date, { sets: 0, reps: 0, weights: [], maxW: 0, volume: 0 });
    const s = sessions.get(log.date)!;
    s.sets++; s.reps += log.reps; s.weights.push(log.weightKg);
    s.maxW = Math.max(s.maxW, log.weightKg); s.volume += log.weightKg * log.reps;
  }

  const sessionData = [...sessions.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, s]) => ({
      date, sets: s.sets, reps: s.reps,
      avgWeight: Math.round(s.weights.reduce((a, b) => a + b, 0) / s.weights.length),
      maxWeight: s.maxW, volume: s.volume,
      e1RM: Math.round(s.maxW * (1 + s.reps / s.sets / 30)),
    }));

  const first = sessionData[0], last = sessionData[sessionData.length - 1];
  const daysDiff = (new Date(last.date).getTime() - new Date(first.date).getTime()) / 86400000;
  const weeksDiff = daysDiff / 7;
  const totalProgress = Math.round((last.e1RM - first.e1RM) / first.e1RM * 1000) / 10;
  const progressPerWeek = weeksDiff > 0 ? Math.round((totalProgress / weeksDiff) * 10) / 10 : 0;

  // Plateau detection: same e1RM for 3+ weeks
  let plateauWeeks = 0;
  for (let i = sessionData.length - 1; i > 0; i--) {
    if (Math.abs(sessionData[i].e1RM - sessionData[i - 1].e1RM) <= 2.5) plateauWeeks++;
    else break;
  }

  let trend: ExerciseProgressionData['trend'] = 'stable';
  if (progressPerWeek > 2) trend = 'strongly_up';
  else if (progressPerWeek > 0.5) trend = 'up';
  else if (progressPerWeek < -2) trend = 'strongly_down';
  else if (progressPerWeek < -0.5) trend = 'down';

  const bestSet = exLogs.reduce((best, l) => {
    const e1rm = l.weightKg * (1 + l.reps / 30);
    return e1rm > (best.e1RM || 0) ? { weight: l.weightKg, reps: l.reps, date: l.date, e1RM: Math.round(e1rm) } : best;
  }, { weight: 0, reps: 0, date: '', e1RM: 0 });

  return {
    exercise: exerciseName,
    sessions: sessionData,
    current1RM: last.e1RM, start1RM: first.e1RM,
    totalProgress, progressPerWeek, plateauWeeks,
    bestSet: { weight: bestSet.weight, reps: bestSet.reps, date: bestSet.date },
    trend,
    projected1RM4Weeks: Math.round(last.e1RM * (1 + progressPerWeek / 100 * 4)),
    projected1RM12Weeks: Math.round(last.e1RM * (1 + progressPerWeek / 100 * 12 * 0.7)),
  };
}

export function getAllExerciseProgressions(logs: WorkoutSetLog[]): ExerciseProgressionData[] {
  const exercises = [...new Set(logs.map(l => l.exerciseName))];
  return exercises.map(e => trackExerciseProgression(logs, e)).filter(Boolean) as ExerciseProgressionData[];
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Log Analytics
// ═══════════════════════════════════════════════════════════════════════════

export function analyzeTrainingLog(logs: WorkoutSetLog[], sessionDurations: { date: string; durationMin: number }[]): LogAnalytics {
  const dates = [...new Set(logs.map(l => l.date))].sort();
  const totalSessions = dates.length;
  const totalSets = logs.length;
  const totalReps = logs.reduce((s, l) => s + l.reps, 0);
  const totalVolume = logs.reduce((s, l) => s + l.weightKg * l.reps, 0);

  // Duration
  const avgDuration = sessionDurations.length > 0 ? Math.round(sessionDurations.reduce((s, d) => s + d.durationMin, 0) / sessionDurations.length) : 60;
  const density = avgDuration > 0 ? Math.round(totalVolume / avgDuration) : 0;

  // Most trained
  const exCount = new Map<string, number>(), patternCount = new Map<string, number>();
  for (const l of logs) { exCount.set(l.exerciseName, (exCount.get(l.exerciseName) || 0) + 1); }
  const mostTrained = [...exCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  // Set distribution
  const lowSets = logs.filter(l => l.setNumber <= 3).length;
  const medSets = logs.filter(l => l.setNumber > 3 && l.setNumber <= 5).length;
  const highSets = logs.filter(l => l.setNumber > 5).length;

  // Rep distribution
  const strengthReps = logs.filter(l => l.reps <= 6).length;
  const hyperReps = logs.filter(l => l.reps >= 7 && l.reps <= 15).length;
  const endurReps = logs.filter(l => l.reps > 15).length;

  // RPE distribution
  const rpeDist: Record<number, number> = { 5: 0, 6: 0, 7: 0, 8: 0, 9: 0, 10: 0 };
  for (const l of logs) { const rpe = Math.round(l.rpe); if (rpe >= 5 && rpe <= 10) rpeDist[rpe]++; }

  // Weekly volume
  const weeklyVolume = new Map<string, { volume: number; sessions: number }>();
  for (const l of logs) {
    const d = new Date(l.date); const weekStart = new Date(d); weekStart.setDate(d.getDate() - d.getDay() + 1);
    const key = weekStart.toISOString().slice(0, 10);
    if (!weeklyVolume.has(key)) weeklyVolume.set(key, { volume: 0, sessions: 0 });
    const w = weeklyVolume.get(key)!; w.volume += l.weightKg * l.reps;
  }
  for (const d of dates) {
    const dObj = new Date(d); dObj.setDate(dObj.getDate() - dObj.getDay() + 1);
    const key = dObj.toISOString().slice(0, 10);
    if (weeklyVolume.has(key)) weeklyVolume.get(key)!.sessions++;
  }

  // Consistency: % weeks with 3+ sessions
  const weeksWith3Plus = [...weeklyVolume.values()].filter(w => w.sessions >= 3).length;
  const consistency = weeklyVolume.size > 0 ? Math.round((weeksWith3Plus / weeklyVolume.size) * 100) : 0;

  // PR frequency
  const prs = logs.filter(l => l.isPR);
  const prFrequency = totalSessions > 0 ? Math.round((prs.length / totalSessions) * 100) / 100 : 0;

  // Monthly volume
  const monthlyVolume = new Map<string, number>();
  for (const l of logs) {
    const key = l.date.slice(0, 7);
    monthlyVolume.set(key, (monthlyVolume.get(key) || 0) + l.weightKg * l.reps);
  }

  return {
    totalSessions, totalSets, totalReps, totalVolume, avgSessionDuration: avgDuration,
    mostTrainedExercise: mostTrained, mostTrainedPattern: '',
    setDistribution: { low: lowSets, medium: medSets, high: highSets },
    repDistribution: { strength: strengthReps, hypertrophy: hyperReps, endurance: endurReps },
    rpeDistribution: rpeDist,
    weeklyVolume: [...weeklyVolume.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([w, v]) => ({ week: w, ...v })),
    monthlyVolume: [...monthlyVolume.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([m, v]) => ({ month: m, volume: v })),
    density, consistency, prFrequency, deloadCompliance: 100,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Body Measurement Tracker
// ═══════════════════════════════════════════════════════════════════════════

const MEASUREMENT_KEY = 'he_measurements';
const WEIGHT_LOG_KEY = 'he_weight_log';

/**
 * Convert WeightEntry (canonical store) → BodyMeasurement.
 * Fields without a direct mapping default to 0.
 */
function weightEntryToBodyMeasurement(e: any): BodyMeasurement {
  return {
    date: e.date,
    weightKg: Number(e.weight) || 0,
    bodyFatPercent: Number(e.bodyFat) || 0,
    neckCm: Number(e.neckCm) || 0,
    chestCm: Number(e.chestCm) || 0,
    shoulderCm: Number(e.shoulderCm) || 0,
    armLeftCm: Number(e.bicepLeftCm) || Number(e.bicepCm) || 0,
    armRightCm: Number(e.bicepRightCm) || Number(e.bicepCm) || 0,
    forearmLeftCm: Number(e.forearmLeftCm) || Number(e.forearmCm) || 0,
    forearmRightCm: Number(e.forearmRightCm) || Number(e.forearmCm) || 0,
    waistCm: Number(e.waistCm) || 0,
    hipCm: Number(e.hipCm) || 0,
    thighLeftCm: Number(e.thighLeftCm) || Number(e.thighCm) || 0,
    thighRightCm: Number(e.thighRightCm) || Number(e.thighCm) || 0,
    calfLeftCm: Number(e.calfLeftCm) || Number(e.calfCm) || 0,
    calfRightCm: Number(e.calfRightCm) || Number(e.calfCm) || 0,
    notes: e.notes || '',
  };
}

/**
 * Load body measurements from the CANONICAL weight log (he_weight_log).
 * Falls back to legacy he_measurements and migrates if weight log is empty.
 */
export function loadMeasurements(): BodyMeasurement[] {
  try {
    const rawWeight = JSON.parse(localStorage.getItem(WEIGHT_LOG_KEY) || '[]');
    if (Array.isArray(rawWeight) && rawWeight.length > 0) {
      return rawWeight
        .filter((e: any) => e && e.date)
        .map(weightEntryToBodyMeasurement)
        .sort((a: BodyMeasurement, b: BodyMeasurement) => a.date.localeCompare(b.date));
    }
    // Legacy fallback
    const legacy = JSON.parse(localStorage.getItem(MEASUREMENT_KEY) || '[]');
    if (Array.isArray(legacy) && legacy.length > 0) {
      // Migrate legacy data into weight log
      const migrated = legacy.map((m: any) => ({
        date: m.date,
        weight: Number(m.weightKg) || 0,
        bodyFat: Number(m.bodyFatPercent) || undefined,
        neckCm: Number(m.neckCm) || undefined,
        chestCm: Number(m.chestCm) || undefined,
        shoulderCm: Number(m.shoulderCm) || undefined,
        hipCm: Number(m.hipCm) || undefined,
        bicepLeftCm: Number(m.armLeftCm) || undefined,
        bicepRightCm: Number(m.armRightCm) || undefined,
        forearmLeftCm: Number(m.forearmLeftCm) || undefined,
        forearmRightCm: Number(m.forearmRightCm) || undefined,
        waistCm: Number(m.waistCm) || undefined,
        thighLeftCm: Number(m.thighLeftCm) || undefined,
        thighRightCm: Number(m.thighRightCm) || undefined,
        calfLeftCm: Number(m.calfLeftCm) || undefined,
        calfRightCm: Number(m.calfRightCm) || undefined,
        notes: m.notes || undefined,
      }));
      try { localStorage.setItem(WEIGHT_LOG_KEY, JSON.stringify(migrated)); } catch { /* quota */ }
      try { localStorage.removeItem(MEASUREMENT_KEY); } catch { /* ignore */ }
      return legacy.sort((a: BodyMeasurement, b: BodyMeasurement) => a.date.localeCompare(b.date));
    }
    return [];
  } catch { return []; }
}

/**
 * Save a body measurement — writes to the CANONICAL weight log (he_weight_log),
 * merging with any existing entry for the same date.
 */
export function saveMeasurement(m: BodyMeasurement): BodyMeasurement[] {
  try {
    const raw = JSON.parse(localStorage.getItem(WEIGHT_LOG_KEY) || '[]');
    const log: any[] = Array.isArray(raw) ? raw : [];
    const idx = log.findIndex((e: any) => e.date === m.date);
    const weight = Number(m.weightKg) > 0 ? Number(m.weightKg) : undefined;
    const patch = {
      weight,
      bodyFat: Number(m.bodyFatPercent) || undefined,
      neckCm: Number(m.neckCm) || undefined,
      chestCm: Number(m.chestCm) || undefined,
      shoulderCm: Number(m.shoulderCm) || undefined,
      hipCm: Number(m.hipCm) || undefined,
      bicepLeftCm: Number(m.armLeftCm) || undefined,
      bicepRightCm: Number(m.armRightCm) || undefined,
      forearmLeftCm: Number(m.forearmLeftCm) || undefined,
      forearmRightCm: Number(m.forearmRightCm) || undefined,
      waistCm: Number(m.waistCm) || undefined,
      thighLeftCm: Number(m.thighLeftCm) || undefined,
      thighRightCm: Number(m.thighRightCm) || undefined,
      calfLeftCm: Number(m.calfLeftCm) || undefined,
      calfRightCm: Number(m.calfRightCm) || undefined,
      notes: m.notes || undefined,
    };
    if (idx >= 0) {
      log[idx] = { ...log[idx], ...patch };
      saveWeightLog(log);
    } else if (weight || Object.keys(patch).some((k: string) => k !== 'weight' && k !== 'notes' && patch[k as keyof typeof patch])) {
      log.push({ date: m.date, ...patch });
      saveWeightLog(log);
    }
  } catch { /* quota — silent */ }
  return loadMeasurements();
}

export function analyzeMeasurements(heightCm: number): MeasurementAnalytics | null {
  const measurements = loadMeasurements();
  if (measurements.length < 2) return null;
  const first = measurements[0], last = measurements[measurements.length - 1];

  const changes: Record<string, number> = {};
  const measureKeys: (keyof BodyMeasurement)[] = ['weightKg', 'bodyFatPercent', 'neckCm', 'chestCm', 'shoulderCm', 'armLeftCm', 'armRightCm', 'forearmLeftCm', 'forearmRightCm', 'waistCm', 'hipCm', 'thighLeftCm', 'thighRightCm', 'calfLeftCm', 'calfRightCm'];
  for (const k of measureKeys) changes[k] = Math.round(((last[k] as number) - (first[k] as number)) * 10) / 10;

  const symmetry = {
    arms: last.armRightCm > 0 ? Math.round((1 - Math.abs(last.armLeftCm - last.armRightCm) / Math.max(last.armLeftCm, last.armRightCm)) * 100) : 100,
    forearms: last.forearmRightCm > 0 ? Math.round((1 - Math.abs(last.forearmLeftCm - last.forearmRightCm) / Math.max(last.forearmLeftCm, last.forearmRightCm)) * 100) : 100,
    thighs: last.thighRightCm > 0 ? Math.round((1 - Math.abs(last.thighLeftCm - last.thighRightCm) / Math.max(last.thighLeftCm, last.thighRightCm)) * 100) : 100,
    calves: last.calfRightCm > 0 ? Math.round((1 - Math.abs(last.calfLeftCm - last.calfRightCm) / Math.max(last.calfLeftCm, last.calfRightCm)) * 100) : 100,
  };

  const lbm = last.weightKg * (1 - last.bodyFatPercent / 100);
  const ffmi = heightCm > 0 ? Math.round((lbm / (heightCm / 100) ** 2) * 10) / 10 : 0;
  const bmi = heightCm > 0 ? Math.round((last.weightKg / (heightCm / 100) ** 2) * 10) / 10 : 0;

  const weeklyChanges = measurements.slice(-12).map(m => ({ date: m.date, weight: m.weightKg, bf: m.bodyFatPercent, waist: m.waistCm }));

  // Projection
  const trend = changes.weightKg / Math.max(1, measurements.length);
  const goalWeight = (() => {
    try {
      const g = JSON.parse(localStorage.getItem('he_diary_goals') || '{}');
      return Number(g.weightKg) > 0 ? Number(g.weightKg) : 80;
    } catch { return 80; }
  })();
  const weeksToGoal = trend !== 0 ? Math.round(Math.abs((goalWeight - last.weightKg) / (trend / measurements.length))) : 0;

  return {
    current: last, first,
    changes, symmetry,
    waistToHip: last.hipCm > 0 ? Math.round((last.waistCm / last.hipCm) * 100) / 100 : 0,
    shoulderToWaist: last.waistCm > 0 ? Math.round((last.shoulderCm / last.waistCm) * 100) / 100 : 0,
    ffmi, bmi, lbm: Math.round(lbm * 10) / 10, fatMass: Math.round(last.weightKg * last.bodyFatPercent / 100 * 10) / 10,
    weeklyChanges,
    projectionToGoal: { weeks: weeksToGoal, targetDate: new Date(Date.now() + weeksToGoal * 7 * 86400000).toISOString().slice(0, 10) },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Weekly Report Generator
// ═══════════════════════════════════════════════════════════════════════════

export function generateWeeklyReport(logs: WorkoutSetLog[], sessionData: { date: string; durationMin: number }[]): WeeklyReport {
  const now = new Date();
  const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const startStr = weekStart.toISOString().slice(0, 10);
  const endStr = weekEnd.toISOString().slice(0, 10);

  const weekLogs = logs.filter(l => l.date >= startStr && l.date <= endStr);
  const weekSessions = sessionData.filter(s => s.date >= startStr && s.date <= endStr);

  const volume = weekLogs.reduce((s, l) => s + l.weightKg * l.reps, 0);
  const avgIntensity = weekLogs.length > 0 ? Math.round(weekLogs.reduce((s, l) => s + l.rpe, 0) / weekLogs.length * 10) / 10 : 0;
  const prs = weekLogs.filter(l => l.isPR).length;

  // Top exercise
  const exVol = new Map<string, number>();
  for (const l of weekLogs) exVol.set(l.exerciseName, (exVol.get(l.exerciseName) || 0) + l.weightKg * l.reps);
  const topExercise = [...exVol.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '';

  // Muscle groups
  const muscleGroups: Record<string, number> = {};

  const insights: string[] = [];
  const recommendations: string[] = [];

  if (weekLogs.length === 0) {
    insights.push('Нет тренировок на этой неделе.');
    recommendations.push('Не пропускайте тренировки. Даже 1 лучше чем 0.');
  } else {
    insights.push(`${weekSessions.length} тренировок, ${Math.round(volume).toLocaleString()} кг тоннажа.`);
    if (prs > 0) insights.push(`🎯 ${prs} персональных рекордов!`);
    if (avgIntensity > 8) { insights.push(`Высокая средняя интенсивность (RPE ${avgIntensity}).`); recommendations.push('Следите за восстановлением. Рассмотрите deload если 2+ недели RPE>8.'); }
  }

  return {
    weekStart: startStr, weekEnd: endStr,
    sessions: weekSessions.length, volume, avgIntensity, prs,
    topExercise, topSet: '', muscleGroups,
    insights, recommendations,
    nextWeekPreview: 'Продолжайте программу. Следующая неделя — стандартная.',
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Exercise Rotation Analyzer
// ═══════════════════════════════════════════════════════════════════════════

export function analyzeExerciseRotation(logs: WorkoutSetLog[]): { exercise: string; sessions: number; lastDate: string; daysSinceLast: number; rotationStatus: 'fresh' | 'normal' | 'stale' | 'neglected' }[] {
  const now = new Date();
  const exMap = new Map<string, { sessions: Set<string>; lastDate: string }>();

  for (const l of logs) {
    if (!exMap.has(l.exerciseName)) exMap.set(l.exerciseName, { sessions: new Set(), lastDate: l.date });
    const e = exMap.get(l.exerciseName)!;
    e.sessions.add(l.date);
    if (l.date > e.lastDate) e.lastDate = l.date;
  }

  return [...exMap.entries()].map(([exercise, data]) => {
    const daysSince = Math.round((now.getTime() - new Date(data.lastDate).getTime()) / 86400000);
    let status: 'fresh' | 'normal' | 'stale' | 'neglected' = 'normal';
    if (daysSince <= 7) status = 'fresh';
    else if (daysSince <= 14) status = 'normal';
    else if (daysSince <= 30) status = 'stale';
    else status = 'neglected';

    return { exercise, sessions: data.sessions.size, lastDate: data.lastDate, daysSinceLast: daysSince, rotationStatus: status };
  }).sort((a, b) => b.daysSinceLast - a.daysSinceLast);
}

// ═══════════════════════════════════════════════════════════════════════════
// All functions exported inline above
// ═══════════════════════════════════════════════════════════════════════════
