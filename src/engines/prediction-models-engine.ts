/**
 * Prediction + PRI + Load Tolerance + Recovery Models
 *
 * Prediction Engine     : 1RM / fatigue / readiness forecasts
 * PRI Engine            : Performance Readiness Index
 * Load Tolerance Model  : How much volume/intensity can the athlete handle
 * Recovery Curve Model  : Time-to-recover estimation
 * Fatigue Accumulation  : Multi-component fatigue tracking
 *
 * Pure functions. Browser-compatible (Telegram Mini App).
 *
 * @module prediction-models-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export interface PredictionInput {
  current1RM: Record<string, number>; // exercise → 1RM
  weeklyVolume: number[];
  weeklyIntensity: number[];
  fatigueHistory: number[];
  recoveryHistory: number[];
  weeks: number;
  trendWeeks: number;
}

export interface StrengthPrediction {
  exercise: string;
  current: number;
  nextWeek: number;
  nextMonth: number;
  plateauRisk: number; // 0-1
  trend: number;       // % per week
}

export interface FatiguePrediction {
  nextWeekFatigue: number;
  nextMonthFatigue: number;
  overtrainingRisk: number; // 0-1
  deloadRecommended: boolean;
}

export interface PRIInput {
  recoveryScore: number;
  fatigueScore: number;
  sleepQuality: number;     // 0-1
  stressLevel: number;      // 0-1 (higher = worse)
  hydrationLevel: number;   // 0-1
  nutritionScore: number;   // 0-1
  techniqueStability: number; // 0-1
  velocityTrend: number;     // %
  riskScore: number;         // 0-1
}

export interface PRIOutput {
  score: number;           // 0-100
  level: 'low' | 'medium' | 'high';
  components: {
    neural: number;
    muscular: number;
    technical: number;
    systemic: number;
    riskAdjustment: number;
  };
  recommendation: string;
}

export interface LoadToleranceInput {
  trainingHistory: { volume: number; intensity: number; difficulty: number }[];
  fatigueHistory: number[];
  jointStressHistory: Record<string, number[]>;
  recoveryScore: number;
}

export interface LoadToleranceOutput {
  volumeCapacity: number;     // % of baseline
  intensityCapacity: number;  // % of baseline
  densityCapacity: number;    // % of baseline
  frequencyCapacity: number;  // sessions/week
  jointTolerance: Record<string, number>;
  neuralTolerance: number;
  toleranceLevel: 'low' | 'medium' | 'high';
}

export interface RecoveryCurveInput {
  fatigueScore: number;
  sleepQuality: number;
  nutritionScore: number;
  stressLevel: number;
  hydrationLevel: number;
  sessionDifficulty: number;
}

export interface RecoveryCurveOutput {
  recoveryScore: number;       // 0-1
  hoursTo80Percent: number;
  hoursToFullRecovery: number;
  components: {
    muscular: number;
    neural: number;
    joint: number;
    systemic: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Prediction Engine
// ═══════════════════════════════════════════════════════════════════════════

export function predictStrength(input: PredictionInput): StrengthPrediction[] {
  const predictions: StrengthPrediction[] = [];
  const trendWeeks = input.trendWeeks || 4;

  for (const [exercise, current1RM] of Object.entries(input.current1RM)) {
    // Linear trend from volume + intensity history
    const recentAvgVolume = input.weeklyVolume.slice(-trendWeeks).reduce((s, v) => s + v, 0) / trendWeeks;
    const recentAvgIntensity = input.weeklyIntensity.slice(-trendWeeks).reduce((s, v) => s + v, 0) / trendWeeks;

    // Simple model: weekly gain ≈ (volume × intensity) / 5000
    const weeklyGainRate = (recentAvgVolume * recentAvgIntensity) / 5000;
    const fatigueAvg = input.fatigueHistory.slice(-trendWeeks).reduce((s, v) => s + v, 0) / trendWeeks;
    const fatiguePenalty = Math.max(0.3, 1 - fatigueAvg * 0.8);

    const adjustedGain = weeklyGainRate * fatiguePenalty;
    const plateauRisk = adjustedGain < 0.001 ? 0.9 : adjustedGain < 0.005 ? 0.5 : 0.1;

    predictions.push({
      exercise,
      current: Math.round(current1RM),
      nextWeek: Math.round(current1RM + adjustedGain * current1RM),
      nextMonth: Math.round(current1RM + adjustedGain * current1RM * 4),
      plateauRisk: Math.round(plateauRisk * 100) / 100,
      trend: Math.round(adjustedGain * 10000) / 100,
    });
  }

  return predictions;
}

export function predictFatigue(input: PredictionInput): FatiguePrediction {
  const recentFatigue = input.fatigueHistory.slice(-input.trendWeeks);
  if (recentFatigue.length === 0) return { nextWeekFatigue: 0, nextMonthFatigue: 0, overtrainingRisk: 0, deloadRecommended: false };
  const avgFatigue = recentFatigue.reduce((s, v) => s + v, 0) / recentFatigue.length;
  const fatigueTrend = recentFatigue.length >= 2
    ? (recentFatigue[recentFatigue.length - 1] - recentFatigue[0]) / recentFatigue.length
    : 0;

  const nextWeekFatigue = Math.min(1, Math.max(0, avgFatigue + fatigueTrend));
  const nextMonthFatigue = Math.min(1, Math.max(0, avgFatigue + fatigueTrend * 4));
  const overtrainingRisk = nextMonthFatigue > 0.8 ? 0.9 : nextMonthFatigue > 0.6 ? 0.5 : 0.1;
  const deloadRecommended = nextMonthFatigue > 0.7 || overtrainingRisk > 0.6;

  return {
    nextWeekFatigue: Math.round(nextWeekFatigue * 100) / 100,
    nextMonthFatigue: Math.round(nextMonthFatigue * 100) / 100,
    overtrainingRisk: Math.round(overtrainingRisk * 100) / 100,
    deloadRecommended,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. PRI — Performance Readiness Index
// ═══════════════════════════════════════════════════════════════════════════

export function computePRI(input: PRIInput): PRIOutput {
  // Neural readiness (recovery × velocity trend)
  const neural = input.recoveryScore * 0.5 + (input.velocityTrend > 0 ? 0.3 : 0.1) + 0.2;

  // Muscular readiness (recovery - fatigue)
  const muscular = Math.max(0, input.recoveryScore - input.fatigueScore * 0.6);

  // Technical readiness (technique stability)
  const technical = input.techniqueStability;

  // Systemic readiness (sleep + nutrition + hydration - stress)
  const systemic = Math.max(0,
    input.sleepQuality * 0.3 +
    input.nutritionScore * 0.25 +
    input.hydrationLevel * 0.15 -
    input.stressLevel * 0.3 + 0.3
  );

  // Risk adjustment (penalty)
  const riskAdjustment = -input.riskScore * 0.4;

  // Weighted total (0-1 scale)
  const total = Math.max(0, Math.min(1,
    neural * 0.3 + muscular * 0.25 + technical * 0.2 + systemic * 0.25 + riskAdjustment
  ));

  const score = Math.round(total * 100);
  const level = score > 70 ? 'high' : score > 40 ? 'medium' : 'low';

  let recommendation = '';
  if (level === 'high') {
    recommendation = 'Отличная готовность — можно увеличить нагрузку на 5-10%';
  } else if (level === 'medium') {
    recommendation = 'Умеренная готовность — стандартный режим тренировки';
  } else {
    recommendation = 'Низкая готовность — снизьте объём на 20-30%, focus на восстановлении';
    if (input.riskScore > 0.5) recommendation += ' Рассмотрите перенос тренировки.';
  }

  return {
    score,
    level,
    components: {
      neural: Math.round(neural * 100) / 100,
      muscular: Math.round(muscular * 100) / 100,
      technical: Math.round(technical * 100) / 100,
      systemic: Math.round(systemic * 100) / 100,
      riskAdjustment: Math.round(riskAdjustment * 100) / 100,
    },
    recommendation,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Load Tolerance Model
// ═══════════════════════════════════════════════════════════════════════════

export function computeLoadTolerance(input: LoadToleranceInput): LoadToleranceOutput {
  const recentWeeks = 4;
  const history = input.trainingHistory.slice(-recentWeeks);

  // Volume capacity: average volume / max observed * recovery
  const volumes = history.map(h => h.volume);
  const avgVolume = volumes.reduce((s, v) => s + v, 0) / volumes.length;
  const maxVolume = Math.max(...volumes, 1);
  const volumeCapacity = Math.min(1.5, (avgVolume / maxVolume) * input.recoveryScore * 1.2);

  // Intensity capacity: average intensity * technique stability proxy
  const intensities = history.map(h => h.intensity);
  const avgIntensity = intensities.reduce((s, v) => s + v, 0) / intensities.length;
  const intensityCapacity = Math.min(1.5, (avgIntensity / 85) * input.recoveryScore * 1.1);

  // Density capacity
  const difficulties = history.map(h => h.difficulty);
  const avgDifficulty = difficulties.reduce((s, v) => s + v, 0) / difficulties.length;
  const densityCapacity = Math.min(1.5, (1 - avgDifficulty / 100) * input.recoveryScore * 1.3);

  // Frequency capacity (inverse of fatigue)
  const fatigueAvg = input.fatigueHistory.slice(-recentWeeks).reduce((s, v) => s + v, 0) / recentWeeks;
  const frequencyCapacity = Math.round(6 * (1 - fatigueAvg) * input.recoveryScore);

  // Joint tolerance
  const jointTolerance: Record<string, number> = {};
  for (const [joint, stresses] of Object.entries(input.jointStressHistory)) {
    const recent = stresses.slice(-recentWeeks);
    const avg = recent.reduce((s, v) => s + v, 0) / recent.length;
    const max = Math.max(...recent, 1);
    jointTolerance[joint] = Math.round((1 - avg / Math.max(max * 2, 1)) * 100);
  }

  // Neural tolerance
  const neuralTolerance = Math.round((1 - fatigueAvg * 0.9) * 100);

  const tolLevel = volumeCapacity > 1.0 ? 'high' : volumeCapacity > 0.6 ? 'medium' : 'low';

  return {
    volumeCapacity: Math.round(volumeCapacity * 100) / 100,
    intensityCapacity: Math.round(intensityCapacity * 100) / 100,
    densityCapacity: Math.round(densityCapacity * 100) / 100,
    frequencyCapacity: Math.max(2, Math.min(7, frequencyCapacity)),
    jointTolerance,
    neuralTolerance,
    toleranceLevel: tolLevel,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Recovery Curve Model
// ═══════════════════════════════════════════════════════════════════════════

export function computeRecoveryCurve(input: RecoveryCurveInput): RecoveryCurveOutput {
  const kMuscular = 0.12; // faster recovery: muscles recover ~12% of fatigue per hour
  const kNeural = 0.06;   // slower: CNS recovers ~6% per hour
  const kJoint = 0.04;    // slowest: joints ~4% per hour
  const kSystemic = 0.10;

  const fatigue = input.fatigueScore;
  const lifestyleModifier =
    input.sleepQuality * 0.35 +
    input.nutritionScore * 0.30 +
    input.hydrationLevel * 0.15 +
    (1 - input.stressLevel) * 0.20;

  // Muscular recovery: fatigue × session difficulty / lifestyle
  const muscularFatigue = fatigue * 0.5 * (input.sessionDifficulty / 100);
  const muscularHoursTo80 = (muscularFatigue / (kMuscular * lifestyleModifier)) * 0.8;
  const muscularHoursToFull = (muscularFatigue / (kMuscular * lifestyleModifier));

  const neuralFatigue = fatigue * (input.sessionDifficulty > 60 ? 0.7 : 0.3);
  const neuralHoursToFull = (neuralFatigue / (kNeural * lifestyleModifier));

  const jointFatigue = fatigue * 0.3;
  const jointHoursToFull = (jointFatigue / (kJoint * lifestyleModifier));

  const systemicScore = input.sleepQuality * 0.4 + input.nutritionScore * 0.3 +
    input.hydrationLevel * 0.15 + (1 - input.stressLevel) * 0.15;
  const systemicHoursToFull = (fatigue * 0.2 / (kSystemic * lifestyleModifier));

  // Take the maximum of all components (slowest system determines full recovery)
  const hoursToFull = Math.max(muscularHoursToFull, neuralHoursToFull, jointHoursToFull, systemicHoursToFull);
  const hoursTo80 = hoursToFull * 0.6;

  // Current recovery score
  const recoveryScore = Math.max(0, 1 - fatigue * (1 - lifestyleModifier) * 1.2);

  return {
    recoveryScore: Math.round(recoveryScore * 100) / 100,
    hoursTo80Percent: Math.round(Math.max(0, hoursTo80)),
    hoursToFullRecovery: Math.round(Math.max(0, hoursToFull)),
    components: {
      muscular: Math.round(Math.max(0, 1 - muscularFatigue / (kMuscular * 12)) * 100) / 100,
      neural: Math.round(Math.max(0, 1 - neuralFatigue / (kNeural * 24)) * 100) / 100,
      joint: Math.round(Math.max(0, 1 - jointFatigue / (kJoint * 36)) * 100) / 100,
      systemic: Math.round(systemicScore * 100) / 100,
    },
  };
}
