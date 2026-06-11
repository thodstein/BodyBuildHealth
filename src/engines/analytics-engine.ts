/**
 * Analytics Domain — Core Analytics Engine
 *
 * Computes training metrics from logged session data:
 *  - Volume (weekly, per muscle group, per pattern)
 *  - Intensity (average %1RM, zone distribution)
 *  - Velocity trends
 *  - ROM analysis
 *  - Technique stability
 *  - Fatigue & Recovery
 *  - Strength trends (1RM progression)
 *  - Risk trends
 *
 * Pure functions — no state, no external dependencies.
 * Works in browser (Telegram Mini App).
 *
 * @module analytics-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═════════════════════════════════════════════════@@@@═════════════════════

export interface SetLogEntry {
  exerciseId: string;
  exerciseName: string;
  reps: number;
  weight: number;
  rpe: number;
  rir: number;
  velocity?: number;
  rom?: number;
  techniqueScore?: number;
  date: string;
  setIndex: number;
}

export interface SessionLogEntry {
  sessionId: string;
  date: string;
  focus: string;
  durationMin: number;
  sets: SetLogEntry[];
}

export interface AnalyticsInput {
  sessions: SessionLogEntry[];
  weeks: number;
}

export interface VolumeMetrics {
  weeklyVolumeKg: number;
  weeklySets: number;
  weeklyReps: number;
  avgVolumePerSession: number;
  volumeByPattern: Record<string, number>;
  volumeByGroup: Record<string, number>;
  volumeTrend: number; // % change vs previous period
}

export interface IntensityMetrics {
  avgIntensity: number;
  intensityDistribution: {
    strength: number;    // 1-6 reps, >80% 1RM
    hypertrophy: number; // 7-12 reps, 60-80% 1RM
    endurance: number;   // 13+ reps, <60% 1RM
  };
  avgRPE: number;
  rpeDistribution: Record<string, number>; // RPE 5..10 counts
}

export interface StrengthMetrics {
  estimated1RM: Record<string, number>;
  strengthTrend: Record<string, number>; // % change vs last period
  peakWeights: Record<string, number>;
  volumeByExercise: Record<string, { sets: number; reps: number; tonnage: number }>;
}

export interface FatigueMetrics {
  sessionFatigue: number;
  weeklyFatigue: number;
  monotony: number;
  strain: number;
  cnsFatigue: number; // based on avg RPE × sets
}

export interface RecoveryMetrics {
  recoveryScore: number;
  readinessEstimate: number;
}

export interface TechniqueMetrics {
  avgTechniqueScore: number;
  techniqueTrend: number;
  commonErrors: string[];
  romStability: number;
}

export interface VelocityMetrics {
  avgVelocity: number;
  peakVelocity: number;
  velocityLoss: number;
  velocityTrend: number;
}

export interface AnalyticsSnapshot {
  volume: VolumeMetrics;
  intensity: IntensityMetrics;
  strength: StrengthMetrics;
  fatigue: FatigueMetrics;
  recovery: RecoveryMetrics;
  technique: TechniqueMetrics;
  velocity: VelocityMetrics;
  weeklyBreakdown: WeeklyBreakdown[];
}

export interface WeeklyBreakdown {
  week: number;
  sessions: number;
  totalSets: number;
  totalReps: number;
  totalVolume: number;
  avgIntensity: number;
  avgRPE: number;
  avgFatigue: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// Muscle group mapping (exercise → primary group)
// ═══════════════════════════════════════════════════════════════════════════

const MUSCLE_GROUP_MAP: Record<string, string> = {
  back_squat: 'quads', front_squat: 'quads', leg_press: 'quads', leg_extension: 'quads',
  bench_press: 'chest', incline_bench: 'chest', dumbbell_bench: 'chest',
  deadlift: 'back', barbell_row: 'back', pull_up: 'back', lat_pulldown: 'back', seated_row: 'back',
  overhead_press: 'shoulders', lateral_raise: 'shoulders', face_pull: 'shoulders',
  bicep_curl: 'arms', tricep_extension: 'arms',
  romanian_deadlift: 'hamstrings', leg_curl: 'hamstrings', glute_bridge: 'glutes',
  calf_raise: 'calves',
  plank: 'core', hanging_leg_raise: 'core',
};

const PATTERN_MAP: Record<string, string> = {
  back_squat: 'squat', front_squat: 'squat', leg_press: 'squat',
  bench_press: 'horizontal_push', incline_bench: 'horizontal_push', dumbbell_bench: 'horizontal_push',
  deadlift: 'hinge', romanian_deadlift: 'hinge',
  barbell_row: 'horizontal_pull', seated_row: 'horizontal_pull',
  pull_up: 'vertical_pull', lat_pulldown: 'vertical_pull',
  overhead_press: 'vertical_push', lateral_raise: 'accessory',
  bicep_curl: 'accessory', tricep_extension: 'accessory',
  leg_extension: 'accessory', leg_curl: 'accessory',
  calf_raise: 'accessory', plank: 'accessory',
};

// ═══════════════════════════════════════════════════════════════════════════
// 1RM estimation
// ═══════════════════════════════════════════════════════════════════════════

function epley1RM(weight: number, reps: number): number {
  if (reps <= 0) return weight;
  return weight * (1 + reps / 30);
}

// ═══════════════════════════════════════════════════════════════════════════
// Volume Analytics
// ═══════════════════════════════════════════════════════════════════════════

export function computeVolume(sessions: SessionLogEntry[], prevSessions: SessionLogEntry[] = []): VolumeMetrics {
  let totalVolume = 0;
  let totalSets = 0;
  let totalReps = 0;
  const patternVol: Record<string, number> = {};
  const groupVol: Record<string, number> = {};

  for (const sess of sessions) {
    for (const set of sess.sets) {
      const vol = set.reps * set.weight;
      totalVolume += vol;
      totalSets++;
      totalReps += set.reps;

      const pattern = PATTERN_MAP[set.exerciseId] || 'accessory';
      patternVol[pattern] = (patternVol[pattern] || 0) + vol;

      const group = MUSCLE_GROUP_MAP[set.exerciseId] || 'other';
      groupVol[group] = (groupVol[group] || 0) + vol;
    }
  }

  // Trend: % change vs previous period
  let prevVolume = 0;
  for (const sess of prevSessions) {
    for (const set of sess.sets) {
      prevVolume += set.reps * set.weight;
    }
  }
  const volumeTrend = prevVolume > 0 ? ((totalVolume - prevVolume) / prevVolume) * 100 : 0;

  return {
    weeklyVolumeKg: Math.round(totalVolume),
    weeklySets: totalSets,
    weeklyReps: totalReps,
    avgVolumePerSession: sessions.length > 0 ? Math.round(totalVolume / sessions.length) : 0,
    volumeByPattern: patternVol,
    volumeByGroup: groupVol,
    volumeTrend: Math.round(volumeTrend),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Intensity Analytics
// ═══════════════════════════════════════════════════════════════════════════

export function computeIntensity(sessions: SessionLogEntry[]): IntensityMetrics {
  let totalRPESets = 0;
  let sumRPE = 0;
  let strengthCount = 0;
  let hypertrophyCount = 0;
  let enduranceCount = 0;
  const rpeDist: Record<string, number> = {};
  let sumIntensity = 0;

  for (const sess of sessions) {
    for (const set of sess.sets) {
      if (set.rpe > 0) {
        sumRPE += set.rpe;
        totalRPESets++;
        const rpeKey = String(Math.round(set.rpe));
        rpeDist[rpeKey] = (rpeDist[rpeKey] || 0) + 1;
      }

      // Zone classification
      if (set.reps <= 6 && set.rpe >= 7) {
        strengthCount++;
        sumIntensity += 85;
      } else if (set.reps <= 12) {
        hypertrophyCount++;
        sumIntensity += 70;
      } else {
        enduranceCount++;
        sumIntensity += 55;
      }
    }
  }

  const total = strengthCount + hypertrophyCount + enduranceCount || 1;

  return {
    avgIntensity: Math.round(sumIntensity / total),
    intensityDistribution: {
      strength: Math.round((strengthCount / total) * 100),
      hypertrophy: Math.round((hypertrophyCount / total) * 100),
      endurance: Math.round((enduranceCount / total) * 100),
    },
    avgRPE: totalRPESets > 0 ? Math.round((sumRPE / totalRPESets) * 10) / 10 : 0,
    rpeDistribution: rpeDist,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Strength Analytics
// ═══════════════════════════════════════════════════════════════════════════

export function computeStrength(sessions: SessionLogEntry[], prevSessions: SessionLogEntry[] = []): StrengthMetrics {
  const best1RMs: Record<string, { rm: number; date: string }> = {};
  const peakWeights: Record<string, number> = {};
  const volumeByEx: Record<string, { sets: number; reps: number; tonnage: number }> = {};

  for (const sess of sessions) {
    for (const set of sess.sets) {
      const exId = set.exerciseId;
      const estRM = epley1RM(set.weight, set.reps);

      if (!best1RMs[exId] || estRM > best1RMs[exId].rm) {
        best1RMs[exId] = { rm: estRM, date: set.date };
      }
      if (!peakWeights[exId] || set.weight > peakWeights[exId]) {
        peakWeights[exId] = set.weight;
      }

      if (!volumeByEx[exId]) {
        volumeByEx[exId] = { sets: 0, reps: 0, tonnage: 0 };
      }
      volumeByEx[exId].sets++;
      volumeByEx[exId].reps += set.reps;
      volumeByEx[exId].tonnage += set.reps * set.weight;
    }
  }

  // Previous 1RMs for trend
  const prevRMs: Record<string, number> = {};
  for (const sess of prevSessions) {
    for (const set of sess.sets) {
      const estRM = epley1RM(set.weight, set.reps);
      prevRMs[set.exerciseId] = Math.max(prevRMs[set.exerciseId] || 0, estRM);
    }
  }

  const strengthTrend: Record<string, number> = {};
  const estimated1RM: Record<string, number> = {};
  for (const [exId, data] of Object.entries(best1RMs)) {
    estimated1RM[exId] = Math.round(data.rm);
    const prevRM = prevRMs[exId] || data.rm;
    strengthTrend[exId] = Math.round(((data.rm - prevRM) / prevRM) * 100);
  }

  return { estimated1RM, strengthTrend, peakWeights, volumeByExercise: volumeByEx };
}

// ═══════════════════════════════════════════════════════════════════════════
// Fatigue Analytics
// ═══════════════════════════════════════════════════════════════════════════

export function computeFatigue(sessions: SessionLogEntry[]): FatigueMetrics {
  let totalRPESets = 0;
  let sumRPE = 0;
  let cnsLoad = 0;
  const dailyLoads: number[] = [];

  for (const sess of sessions) {
    let sessionLoad = 0;
    for (const set of sess.sets) {
      sessionLoad += set.reps * set.weight * (set.rpe / 10);
      if (set.rpe > 0) {
        sumRPE += set.rpe;
        totalRPESets++;
      }
      if (set.rpe >= 8 && set.reps <= 5) {
        cnsLoad += set.weight * set.rpe * 0.1;
      }
    }
    dailyLoads.push(sessionLoad);
  }

  const meanLoad = dailyLoads.length > 0 ? dailyLoads.reduce((s, v) => s + v, 0) / dailyLoads.length : 0;
  const variance = dailyLoads.length > 1
    ? dailyLoads.reduce((s, v) => s + (v - meanLoad) ** 2, 0) / (dailyLoads.length - 1)
    : 0;
  const stdDev = Math.sqrt(variance);
  const monotony = stdDev > 0 ? meanLoad / stdDev : 1;
  const weeklyLoad = dailyLoads.reduce((s, v) => s + v, 0);
  const strain = weeklyLoad * monotony * 0.01;

  const sessionFatigue = totalRPESets > 0 ? Math.min(1, (sumRPE / totalRPESets) / 10 + (dailyLoads.length / 7) * 0.3) : 0.3;
  const weeklyFatigue = Math.min(1, sessionFatigue * 1.2);

  return {
    sessionFatigue: Math.round(sessionFatigue * 100) / 100,
    weeklyFatigue: Math.round(weeklyFatigue * 100) / 100,
    monotony: Math.round(monotony * 100) / 100,
    strain: Math.round(strain),
    cnsFatigue: Math.round(Math.min(1, cnsLoad / 5000) * 100) / 100,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Recovery + Technique + Velocity
// ═══════════════════════════════════════════════════════════════════════════

export function computeRecovery(fatigue: FatigueMetrics): RecoveryMetrics {
  const recoveryScore = Math.max(0, 1 - fatigue.weeklyFatigue * 0.8 - fatigue.monotony * 0.1 - fatigue.cnsFatigue * 0.3);
  return {
    recoveryScore: Math.round(recoveryScore * 100) / 100,
    readinessEstimate: Math.round(Math.max(0.2, recoveryScore * 0.9) * 100),
  };
}

export function computeTechnique(sessions: SessionLogEntry[]): TechniqueMetrics {
  let totalScore = 0;
  let count = 0;
  const errors: Record<string, number> = {};

  for (const sess of sessions) {
    for (const set of sess.sets) {
      if (set.techniqueScore !== undefined) {
        totalScore += set.techniqueScore;
        count++;
      }
      if (set.rom !== undefined && set.rom < 0.7) {
        errors['rom_deficit'] = (errors['rom_deficit'] || 0) + 1;
      }
    }
  }

  const avgScore = count > 0 ? totalScore / count : 0.7;
  const commonErrors = Object.entries(errors)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k]) => k);

  return {
    avgTechniqueScore: Math.round(avgScore * 100) / 100,
    techniqueTrend: 0,
    commonErrors,
    romStability: Math.round(Math.min(1, 1 - (errors['rom_deficit'] || 0) / (count || 1)) * 100) / 100,
  };
}

export function computeVelocity(sessions: SessionLogEntry[]): VelocityMetrics {
  const velocities: number[] = [];
  let peak = 0;

  for (const sess of sessions) {
    for (const set of sess.sets) {
      if (set.velocity !== undefined) {
        velocities.push(set.velocity);
        if (set.velocity > peak) peak = set.velocity;
      }
    }
  }

  const avg = velocities.length > 0 ? velocities.reduce((s, v) => s + v, 0) / velocities.length : 0;
  const first = velocities.length > 0 ? velocities[0] : 0;
  const last = velocities.length > 0 ? velocities[velocities.length - 1] : 0;
  const vLoss = first > 0 ? ((first - last) / first) * 100 : 0;

  return {
    avgVelocity: Math.round(avg * 100) / 100,
    peakVelocity: Math.round(peak * 100) / 100,
    velocityLoss: Math.round(vLoss),
    velocityTrend: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Weekly breakdown
// ═══════════════════════════════════════════════════════════════════════════

export function computeWeeklyBreakdown(sessions: SessionLogEntry[]): WeeklyBreakdown[] {
  const weeks: Record<number, SessionLogEntry[]> = {};

  for (const sess of sessions) {
    const date = new Date(sess.date);
    // Approximate week number from epoch
    const weekNum = Math.floor(date.getTime() / (7 * 24 * 3600 * 1000));
    if (!weeks[weekNum]) weeks[weekNum] = [];
    weeks[weekNum].push(sess);
  }

  return Object.entries(weeks)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([week, sessList]) => {
      let totalSets = 0, totalReps = 0, totalVol = 0, rpeSum = 0, rpeCount = 0;
      for (const sess of sessList) {
        for (const set of sess.sets) {
          totalSets++;
          totalReps += set.reps;
          totalVol += set.reps * set.weight;
          if (set.rpe > 0) { rpeSum += set.rpe; rpeCount++; }
        }
      }
      return {
        week: Number(week),
        sessions: sessList.length,
        totalSets,
        totalReps,
        totalVolume: Math.round(totalVol),
        avgIntensity: rpeCount > 0 ? Math.round((rpeSum / rpeCount) * 10) : 0,
        avgRPE: rpeCount > 0 ? Math.round((rpeSum / rpeCount) * 10) / 10 : 0,
        avgFatigue: Math.round(Math.min(1, (totalSets / 80) + (rpeCount > 0 ? (rpeSum / rpeCount) / 20 : 0)) * 100) / 100,
      };
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// Main pipeline
// ═══════════════════════════════════════════════════════════════════════════

export function computeAnalytics(input: AnalyticsInput): AnalyticsSnapshot {
  const current = input.sessions.slice(-input.weeks * 7);
  const prev = input.sessions.slice(-input.weeks * 14, -input.weeks * 7);

  const volume = computeVolume(current, prev);
  const intensity = computeIntensity(current);
  const strength = computeStrength(current, prev);
  const fatigue = computeFatigue(current);
  const recovery = computeRecovery(fatigue);
  const technique = computeTechnique(current);
  const velocity = computeVelocity(current);
  const weeklyBreakdown = computeWeeklyBreakdown(current);

  return {
    volume, intensity, strength, fatigue, recovery, technique, velocity, weeklyBreakdown,
  };
}
