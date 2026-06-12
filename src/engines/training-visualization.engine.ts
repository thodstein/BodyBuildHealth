/**
 * Training Load Visualization — Volume, intensity, fatigue curves.
 *
 * Generates data structures for charts:
 *  - Weekly tonnage trends
 *  - Intensity distribution (strength/hypertrophy/endurance)
 *  - Fatigue accumulation curve
 *  - ACWR (Acute:Chronic Workload Ratio) over time
 *  - Exercise-specific progression charts
 *  - Muscle group volume pie data
 *
 * @module training-visualization-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface ChartPoint {
  label: string;
  value: number;
  color?: string;
}

export interface WeekChartData {
  week: number;
  volume: number;
  intensity: number;
  fatigue: number;
  sets: number;
  sessions: number;
  monotony: number;
  strain: number;
  acwr: number;
}

export interface MuscleVolumeData {
  muscle: string;
  volume: number;
  percent: number;
  color: string;
}

export interface ExerciseProgression {
  exercise: string;
  weeks: { week: number; weight: number; reps: number; estimated1RM: number }[];
  trend: number; // % per week
  plateau: boolean;
}

export interface FatigueCurve {
  weeks: { week: number; fatigue: number; recovery: number; readiness: number }[];
  overtrainingRisk: number;
  deloadWeeks: number[];
}

export interface VisualDashboard {
  weeklyChart: WeekChartData[];
  muscleVolume: MuscleVolumeData[];
  progression: ExerciseProgression[];
  fatigue: FatigueCurve;
  intensityZones: { zone: string; percent: number; color: string }[];
  summary: {
    totalVolume: number;
    avgIntensity: number;
    bestWeek: number;
    totalSessions: number;
    streak: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Color palette
// ═════════════@@@@══════════════════════════════════════════════════════════

const MUSCLE_COLORS: Record<string, string> = {
  chest: '#ef4444', back: '#3b82f6', quads: '#22c55e',
  hamstrings: '#eab308', glutes: '#f97316', shoulders: '#8b5cf6',
  arms: '#ec4899', calves: '#14b8a6', core: '#6b7280',
  traps: '#a855f7', other: '#94a3b8',
};

const ZONE_COLORS = { strength: '#ef4444', hypertrophy: '#f59e0b', endurance: '#22c55e' };

// ═══════════════════════════════════════════════════════════════════════════
// Session data input (simplified)
// ═══════════════════════════════════════════════════════════════════════════

export interface VizSessionData {
  week: number;
  exercises: {
    name: string;
    pattern: string;
    muscleGroup: string;
    sets: number;
    reps: number;
    weight: number;
    rpe: number;
  }[];
}

// ═══════════════════════════════════════════════════════════════════════════
// Core Engines
// ═══════════════════════════════════════════════════════════════════════════

export function computeWeeklyChart(sessions: VizSessionData[]): WeekChartData[] {
  const weekMap = new Map<number, { volume: number; intensity: number; sets: number; sessions: Set<number> }>();

  for (const s of sessions) {
    if (!weekMap.has(s.week)) weekMap.set(s.week, { volume: 0, intensity: 0, sets: 0, sessions: new Set() });

    const w = weekMap.get(s.week)!;
    for (const ex of s.exercises) {
      w.volume += ex.sets * ex.reps * ex.weight;
      w.intensity += ex.rpe;
      w.sets += ex.sets;
    }
    w.sessions.add(s.week);
  }

  const data: WeekChartData[] = [];
  const sorted = [...weekMap.entries()].sort(([a], [b]) => a - b);
  const weeklyLoads: number[] = [];

  for (const [week, w] of sorted) {
    const avgIntensity = w.sets > 0 ? w.intensity / w.sets : 0;
    const vol = w.volume;
    weeklyLoads.push(vol);
    const sessionsCount = w.sessions.size;

    // Monotony
    const mean = weeklyLoads.length > 0 ? weeklyLoads.reduce((s, v) => s + v, 0) / weeklyLoads.length : vol;
    const variance = weeklyLoads.length > 1
      ? weeklyLoads.reduce((s, v) => s + (v - mean) ** 2, 0) / (weeklyLoads.length - 1)
      : 0;
    const monotony = Math.sqrt(variance) > 0 ? mean / Math.sqrt(variance) : 1;
    const strain = vol * monotony * 0.01;

    // ACWR: last week / preceding 3-week avg
    const chronic = weeklyLoads.length >= 4
      ? weeklyLoads.slice(-4, -1).reduce((s, v) => s + v, 0) / 3
      : vol;
    const acwr = chronic > 0 ? vol / chronic : 1;

    data.push({
      week,
      volume: Math.round(vol),
      intensity: Math.round(avgIntensity * 10) / 10,
      fatigue: Math.min(1, vol / 5000 * 100),
      sets: w.sets,
      sessions: sessionsCount,
      monotony: Math.round(monotony * 100) / 100,
      strain: Math.round(strain),
      acwr: Math.round(acwr * 100) / 100,
    });
  }

  return data;
}

export function computeMuscleVolume(sessions: VizSessionData[]): MuscleVolumeData[] {
  const volMap = new Map<string, number>();

  for (const s of sessions) {
    for (const ex of s.exercises) {
      const vol = ex.sets * ex.reps * ex.weight;
      volMap.set(ex.muscleGroup, (volMap.get(ex.muscleGroup) || 0) + vol);
    }
  }

  const total = [...volMap.values()].reduce((s, v) => s + v, 0) || 1;
  return [...volMap.entries()]
    .map(([muscle, volume]) => ({
      muscle,
      volume: Math.round(volume),
      percent: Math.round((volume / total) * 100),
      color: MUSCLE_COLORS[muscle] || '#94a3b8',
    }))
    .sort((a, b) => b.volume - a.volume);
}

export function computeProgression(sessions: VizSessionData[]): ExerciseProgression[] {
  const exMap = new Map<string, { week: number; weight: number; reps: number; estimated1RM: number }[]>();

  for (const s of sessions) {
    for (const ex of s.exercises) {
      if (!exMap.has(ex.name)) exMap.set(ex.name, []);
      const epley = ex.reps > 0 ? ex.weight * (1 + ex.reps / 30) : ex.weight;
      exMap.get(ex.name)!.push({
        week: s.week,
        weight: ex.weight,
        reps: ex.reps,
        estimated1RM: Math.round(epley),
      });
    }
  }

  const results: ExerciseProgression[] = [];
  for (const [name, data] of exMap) {
    if (data.length < 2) continue;
    data.sort((a, b) => a.week - b.week);

    const first1RM = data[0].estimated1RM;
    const last1RM = data[data.length - 1].estimated1RM;
    const weeks = data[data.length - 1].week - data[0].week || 1;
    const trend = Math.round(((last1RM - first1RM) / first1RM) / weeks * 100 * 10) / 10;
    const plateau = Math.abs(trend) < 0.5;

    results.push({ exercise: name, weeks: data, trend, plateau });
  }

  return results.sort((a, b) => b.trend - a.trend);
}

export function computeFatigueCurve(weekly: WeekChartData[]): FatigueCurve {
  const weeks: FatigueCurve['weeks'] = [];
  const deloadWeeks: number[] = [];

  for (const w of weekly) {
    const recovery = Math.max(0, 100 - w.fatigue);
    const readiness = Math.round((recovery * 0.6 + (100 - w.strain * 0.1) * 0.4));
    weeks.push({ week: w.week, fatigue: Math.round(w.fatigue), recovery, readiness });
    if (w.fatigue > 80) deloadWeeks.push(w.week);
  }

  const overtrainingRisk = weekly.length >= 3
    ? Math.round(weekly.slice(-3).reduce((s, w) => s + (w.acwr > 1.5 ? 1 : 0), 0) / 3 * 100)
    : 0;

  return { weeks, overtrainingRisk, deloadWeeks };
}

export function computeIntensityZones(sessions: VizSessionData[]): VisualDashboard['intensityZones'] {
  let strength = 0, hyper = 0, endur = 0;

  for (const s of sessions) {
    for (const ex of s.exercises) {
      if (ex.reps <= 6 && ex.rpe >= 7) strength += ex.sets;
      else if (ex.reps <= 15) hyper += ex.sets;
      else endur += ex.sets;
    }
  }

  const total = strength + hyper + endur || 1;
  return [
    { zone: 'Сила (1-6 повт, RPE≥7)', percent: Math.round(strength / total * 100), color: ZONE_COLORS.strength },
    { zone: 'Гипертрофия (7-15)', percent: Math.round(hyper / total * 100), color: ZONE_COLORS.hypertrophy },
    { zone: 'Выносливость (15+)', percent: Math.round(endur / total * 100), color: ZONE_COLORS.endurance },
  ];
}

export function buildVisualDashboard(sessions: VizSessionData[]): VisualDashboard {
  const weekly = computeWeeklyChart(sessions);
  const muscle = computeMuscleVolume(sessions);
  const progression = computeProgression(sessions);
  const fatigue = computeFatigueCurve(weekly);
  const intensityZones = computeIntensityZones(sessions);

  const totalVolume = weekly.reduce((s, w) => s + w.volume, 0);
  const avgIntensity = weekly.length > 0 ? weekly.reduce((s, w) => s + w.intensity, 0) / weekly.length : 0;
  const bestWeek = weekly.length > 0 ? weekly.reduce((best, w) => w.volume > best.volume ? w : best, weekly[0]).week : 0;

  return {
    weeklyChart: weekly,
    muscleVolume: muscle,
    progression,
    fatigue,
    intensityZones,
    summary: {
      totalVolume,
      avgIntensity: Math.round(avgIntensity * 10) / 10,
      bestWeek,
      totalSessions: weekly.reduce((s, w) => s + w.sessions, 0),
      streak: 0,
    },
  };
}
