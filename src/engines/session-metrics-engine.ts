/**
 * Session Difficulty Estimator + Cumulative Load Engine
 *
 * Session Difficulty: estimates how hard a workout will be BEFORE execution.
 * Cumulative Load: tracks accumulated stress across weeks.
 *
 * Difficulty factors:
 *  - Technical complexity of exercises
 *  - CNS demand (intensity × main lifts)
 *  - Joint stress (sum of all exercise joint loads)
 *  - Total volume (sets × reps × %1RM)
 *  - Density (volume / session time)
 *  - Fatigue from previous sessions
 *
 * Cumulative Load:
 *  - Weekly: sum of all session difficulties
 *  - Monthly: 4-week rolling average
 *  - Pattern load: per movement pattern
 *  - Joint load: per joint
 *  - Muscle load: per muscle group
 *
 * @module session-metrics-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface SessionMetricsInput {
  exercises: {
    name: string;
    sets: number;
    reps: number;
    intensity: number; // % 1RM
    technicalComplexity: number; // 1-5
    cnsDemand: number; // 1-5
    jointStress: {
      knee: number;
      hip: number;
      spine: number;
      shoulder: number;
      elbow: number;
      ankle: number;
    };
    pattern: string;
    primaryMuscles: string[];
    secondaryMuscles: string[];
  }[];
  estimatedDurationMin: number;
  previousFatigue: number; // 0-1
  priScore: number; // 0-1
  riskLevel: 'low' | 'medium' | 'high';
}

export interface SessionDifficulty {
  totalScore: number;
  level: 'low' | 'medium' | 'high';
  breakdown: {
    technical: number;
    neural: number;
    joint: number;
    volume: number;
    density: number;
    fatigue: number;
  };
  recommendation: string;
}

export interface CumulativeLoad {
  weeklyVolumeScore: number;
  weeklyIntensityAvg: number;
  weeklyDifficultySum: number;
  patternLoad: Record<string, number>;
  jointLoad: Record<string, number>;
  muscleLoad: Record<string, number>;
  monotony: number;
  strain: number;
  overload: boolean;
}

export interface CumulativeLoadInput {
  pastSessions: SessionMetricsInput[];
  currentSession: SessionMetricsInput;
}

// ═══════════════════════════════════════════════════════════════════════════
// Session Difficulty Estimator
// ═══════════════════════════════════════════════════════════════════════════

export function estimateSessionDifficulty(input: SessionMetricsInput): SessionDifficulty {
  let technicalScore = 0;
  let neuralScore = 0;
  let jointScore = 0;
  let volumeScore = 0;
  let totalReps = 0;

  for (const ex of input.exercises) {
    const sets = ex.sets;
    const reps = ex.reps;
    totalReps += sets * reps;

    // Technical: complexity × sets (more sets of complex = harder)
    technicalScore += ex.technicalComplexity * sets * 0.5;

    // Neural: CNS demand × intensity (heavy main lifts = high neural)
    neuralScore += ex.cnsDemand * ex.intensity * sets * 0.8;

    // Joint: sum of all joint stress
    jointScore += (ex.jointStress.knee + ex.jointStress.hip + ex.jointStress.spine +
      ex.jointStress.shoulder + ex.jointStress.elbow + ex.jointStress.ankle) * sets * 0.1;

    // Volume: sets × reps × intensity
    volumeScore += sets * reps * ex.intensity;
  }

  // Normalize
  const n = Math.max(1, input.exercises.length);
  technicalScore = technicalScore / n;
  neuralScore = neuralScore / n;
  jointScore = jointScore / n;
  volumeScore = Math.min(100, volumeScore / 25); // normalize to 0-100 range

  // Density: volume / time
  const densityScore = input.estimatedDurationMin > 0
    ? Math.min(100, (totalReps / input.estimatedDurationMin) * 10)
    : 50;

  // Fatigue from previous
  const fatigueScore = input.previousFatigue * 50;

  // Total weighted score
  const totalScore =
    technicalScore * 0.15 +
    neuralScore * 0.25 +
    jointScore * 0.15 +
    volumeScore * 0.20 +
    densityScore * 0.10 +
    fatigueScore * 0.15;

  // Adjust for PRI
  const adjustedScore = totalScore * (2 - input.priScore);

  // Level
  let level: 'low' | 'medium' | 'high';
  if (adjustedScore > 70) level = 'high';
  else if (adjustedScore > 40) level = 'medium';
  else level = 'low';

  // Recommendation
  let recommendation = '';
  if (level === 'high' && input.priScore < 0.4) {
    recommendation = 'Высокая сложность + низкая готовность. Рекомендуется снизить объём на 20-30% или перенести тренировку.';
  } else if (level === 'high') {
    recommendation = 'Высокая сложность. Убедитесь в достаточном отдыхе между подходами и гидратации.';
  } else if (level === 'medium') {
    recommendation = 'Умеренная сложность. Стандартный режим.';
  } else {
    recommendation = 'Низкая сложность. Можно увеличить объём или интенсивность при хорошем самочувствии.';
  }

  // Risk override
  if (input.riskLevel === 'high') {
    level = 'low';
    recommendation = 'Высокий риск — принудительное снижение сложности до низкой.';
  }

  return {
    totalScore: Math.round(adjustedScore),
    level,
    breakdown: {
      technical: Math.round(technicalScore),
      neural: Math.round(neuralScore),
      joint: Math.round(jointScore),
      volume: Math.round(volumeScore),
      density: Math.round(densityScore),
      fatigue: Math.round(fatigueScore),
    },
    recommendation,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Cumulative Load Engine
// ═══════════════════════════════════════════════════════════════════════════

export function calcCumulativeLoad(input: CumulativeLoadInput): CumulativeLoad {
  const allSessions = [...input.pastSessions, input.currentSession];
  const weeklyVolumeScores: number[] = [];
  const patternLoad: Record<string, number> = {};
  const jointLoad: Record<string, number> = {};
  const muscleLoad: Record<string, number> = {};

  for (const session of allSessions) {
    let volSum = 0;
    for (const ex of session.exercises) {
      volSum += ex.sets * ex.reps * ex.intensity;

      // Pattern load
      patternLoad[ex.pattern] = (patternLoad[ex.pattern] || 0) + ex.sets * ex.reps * ex.intensity;

      // Joint load
      jointLoad['knee'] = (jointLoad['knee'] || 0) + ex.jointStress.knee * ex.sets;
      jointLoad['hip'] = (jointLoad['hip'] || 0) + ex.jointStress.hip * ex.sets;
      jointLoad['spine'] = (jointLoad['spine'] || 0) + ex.jointStress.spine * ex.sets;
      jointLoad['shoulder'] = (jointLoad['shoulder'] || 0) + ex.jointStress.shoulder * ex.sets;
      jointLoad['elbow'] = (jointLoad['elbow'] || 0) + ex.jointStress.elbow * ex.sets;
      jointLoad['ankle'] = (jointLoad['ankle'] || 0) + ex.jointStress.ankle * ex.sets;

      // Muscle load
      for (const m of ex.primaryMuscles) {
        muscleLoad[m] = (muscleLoad[m] || 0) + ex.sets * ex.reps * ex.intensity * 0.7;
      }
      for (const m of ex.secondaryMuscles) {
        muscleLoad[m] = (muscleLoad[m] || 0) + ex.sets * ex.reps * ex.intensity * 0.3;
      }
    }
    weeklyVolumeScores.push(volSum);
  }

  // Weekly metrics
  const weeklyVolume = weeklyVolumeScores.reduce((s, v) => s + v, 0);
  const weeklyIntensityAvg = allSessions.length > 0
    ? allSessions.reduce((s, sess) =>
      s + sess.exercises.reduce((es, ex) => es + ex.intensity, 0) / Math.max(1, sess.exercises.length), 0
    ) / allSessions.length
    : 0;

  // Difficulty sum
  const weeklyDifficulty = allSessions.reduce((s, sess) => s + estimateSessionDifficulty(sess).totalScore, 0);

  // Monotony = mean / stddev
  const mean = weeklyVolumeScores.length > 0 ? weeklyVolumeScores.reduce((s, v) => s + v, 0) / weeklyVolumeScores.length : 0;
  const variance = weeklyVolumeScores.length > 1
    ? weeklyVolumeScores.reduce((s, v) => s + (v - mean) ** 2, 0) / (weeklyVolumeScores.length - 1)
    : 0;
  const stddev = Math.sqrt(variance);
  const monotony = stddev > 0 ? mean / stddev : 1;

  // Strain = weekly load × monotony
  const strain = weeklyVolume * monotony * 0.01;

  // Overload detection
  const overload = monotony > 2.0 || strain > 300;

  return {
    weeklyVolumeScore: Math.round(weeklyVolume),
    weeklyIntensityAvg: Math.round(weeklyIntensityAvg * 100) / 100,
    weeklyDifficultySum: Math.round(weeklyDifficulty),
    patternLoad,
    jointLoad,
    muscleLoad,
    monotony: Math.round(monotony * 100) / 100,
    strain: Math.round(strain),
    overload,
  };
}
