/**
 * Autoregulation Engine — Adaptive training decisions based on PRI, fatigue, risk.
 *
 * Integrates:
 *  - Autoregulated Intensity (adjust %1RM based on readiness)
 *  - Autoregulated Volume (adjust sets/reps based on fatigue)
 *  - Autoregulated Frequency (adjust days/week based on recovery)
 *  - Autoregulated Exercise Selection (swap exercises based on risk/technique)
 *
 * This is the DECISION LAYER over all training subsystems.
 *
 * @module autoregulation-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type AdjustmentDirection = 'increase' | 'keep' | 'decrease';
export type ExerciseSelectionAdjustment = 'keep' | 'safer' | 'easier' | 'more_specific';

export interface AutoregInput {
  priScore: number;         // 0-1 readiness
  fatigueScore: number;     // 0-1 accumulated fatigue
  recoveryScore: number;    // 0-1 recovery quality
  jointFatigue: Record<string, number>; // per-joint fatigue
  cumulativeLoad: { overload: boolean; monotony: number; strain: number };
  riskLevel: 'low' | 'medium' | 'high';
  techniqueScore: number;   // 0-1
  velocityTrend: number;    // % change
  goal: 'strength' | 'hypertrophy' | 'conditioning' | 'technique' | 'rehab' | string;
  plannedIntensity: number; // % 1RM
  plannedSets: number;
  plannedReps: number;
  plannedFrequency: number; // days/week
  exerciseJointStress: Record<string, number>; // joint stress from planned exercises
}

export interface IntensityDecision {
  adjustment: AdjustmentDirection;
  targetIntensity: number;
  targetRPE: number;
  targetRIR: number;
  reasons: string[];
}

export interface VolumeDecision {
  adjustment: AdjustmentDirection;
  targetSets: number;
  targetReps: number;
  reasons: string[];
}

export interface FrequencyDecision {
  adjustment: AdjustmentDirection;
  targetFrequency: number;
  reasons: string[];
}

export interface ExerciseDecision {
  adjustment: ExerciseSelectionAdjustment;
  replaceExercises: string[];
  reasons: string[];
}

export interface AutoregOutput {
  intensity: IntensityDecision;
  volume: VolumeDecision;
  frequency: FrequencyDecision;
  exercise: ExerciseDecision;
  sessionCancelled: boolean;
  sessionDowngraded: boolean;
  summary: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// RPE ↔ %1RM ↔ RIR table
// ═══════════════════════════════════════════════════════════════════════════

const RPE_RIR_MAP: Record<number, Record<number, { percent: number; rir: number }>> = {
  // reps: { rpe8: {%, rir}, rpe9: {%, rir}, rpe10: {%, rir} }
  1: { 7: { percent: 0.89, rir: 3 }, 8: { percent: 0.92, rir: 2 }, 9: { percent: 0.96, rir: 1 }, 10: { percent: 1.00, rir: 0 } },
  3: { 7: { percent: 0.83, rir: 4 }, 8: { percent: 0.86, rir: 3 }, 9: { percent: 0.89, rir: 2 }, 10: { percent: 0.92, rir: 1 } },
  5: { 7: { percent: 0.79, rir: 3 }, 8: { percent: 0.82, rir: 2 }, 9: { percent: 0.85, rir: 1 }, 10: { percent: 0.88, rir: 0 } },
  8: { 7: { percent: 0.72, rir: 4 }, 8: { percent: 0.75, rir: 3 }, 9: { percent: 0.78, rir: 2 }, 10: { percent: 0.82, rir: 1 } },
  10: { 7: { percent: 0.68, rir: 5 }, 8: { percent: 0.71, rir: 4 }, 9: { percent: 0.75, rir: 3 }, 10: { percent: 0.78, rir: 2 } },
};

function getRPEFromPercent(percent: number, reps: number): { rpe: number; rir: number } {
  const repEntry = RPE_RIR_MAP[reps] || RPE_RIR_MAP[8];
  let bestRPE = 7;
  let bestRIR = 5;
  for (const [rpe, data] of Object.entries(repEntry)) {
    if (Math.abs(data.percent - percent) < Math.abs(repEntry[bestRPE].percent - percent)) {
      bestRPE = Number(rpe);
      bestRIR = data.rir;
    }
  }
  return { rpe: bestRPE, rir: bestRIR };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Autoregulated Intensity
// ═══════════════════════════════════════════════════════════════════════════

function regulateIntensity(input: AutoregInput): IntensityDecision {
  const reasons: string[] = [];
  let adjustment: AdjustmentDirection = 'keep';
  let targetIntensity = input.plannedIntensity;
  const { rpe, rir } = getRPEFromPercent(targetIntensity, input.plannedReps);

  // Base range by goal
  const baseRange: Record<string, [number, number]> = {
    strength: [0.75, 0.90],
    hypertrophy: [0.60, 0.80],
    conditioning: [0.40, 0.70],
    technique: [0.40, 0.60],
    rehab: [0.30, 0.50],
  };
  const [goalMin, goalMax] = baseRange[input.goal] || [0.5, 0.85];

  // Safety overrides first
  if (input.riskLevel === 'high') {
    targetIntensity = Math.min(targetIntensity, 0.75);
    adjustment = 'decrease';
    reasons.push('🔴 Высокий риск — интенсивность ограничена ≤75%');
  }

  if (input.jointFatigue['spine'] > 0.6 || input.jointFatigue['knee'] > 0.6) {
    targetIntensity = Math.min(targetIntensity, 0.7);
    adjustment = 'decrease';
    reasons.push('🟡 Усталость суставов — интенсивность ограничена ≤70%');
  }

  // PRI-based
  if (input.priScore > 0.75 && adjustment === 'keep') {
    targetIntensity = Math.min(goalMax, targetIntensity + 0.05);
    adjustment = 'increase';
    reasons.push(`🟢 Высокая готовность (PRI=${input.priScore.toFixed(1)}) — интенсивность +5%`);
  }
  if (input.priScore < 0.4) {
    targetIntensity = Math.max(goalMin, targetIntensity - 0.10);
    adjustment = 'decrease';
    reasons.push(`🟡 Низкая готовность (PRI=${input.priScore.toFixed(1)}) — интенсивность -10%`);
  }

  // Fatigue/recovery
  if (input.fatigueScore > 0.7 && input.recoveryScore < 0.3) {
    targetIntensity = Math.max(goalMin, targetIntensity - 0.10);
    adjustment = 'decrease';
    reasons.push('🟡 Высокая усталость + низкое восстановление — интенсивность -10%');
  }

  // Velocity trend
  if (input.velocityTrend < -10) {
    targetIntensity = Math.max(goalMin, targetIntensity - 0.05);
    adjustment = 'decrease';
    reasons.push('🟡 Падение скорости (VL trend) — снижение интенсивности');
  }

  // Technique
  if (input.techniqueScore < 0.5) {
    targetIntensity = Math.max(goalMin, targetIntensity - 0.15);
    adjustment = 'decrease';
    reasons.push('🔴 Низкий техника-скор — интенсивность -15%, focus на качестве');
  }

  // Clamp to goal range
  targetIntensity = Math.max(goalMin, Math.min(goalMax, targetIntensity));

  const { rpe: finalRPE, rir: finalRIR } = getRPEFromPercent(targetIntensity, input.plannedReps);

  return {
    adjustment,
    targetIntensity: Math.round(targetIntensity * 100) / 100,
    targetRPE: finalRPE,
    targetRIR: finalRIR,
    reasons,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Autoregulated Volume
// ═══════════════════════════════════════════════════════════════════════════

function regulateVolume(input: AutoregInput): VolumeDecision {
  const reasons: string[] = [];
  let adjustment: AdjustmentDirection = 'keep';
  let targetSets = input.plannedSets;
  let targetReps = input.plannedReps;

  // Overload protection
  if (input.cumulativeLoad.overload) {
    targetSets = Math.max(1, Math.round(targetSets * 0.6));
    adjustment = 'decrease';
    reasons.push('🔴 Overload обнаружен — объём -40%');
  }

  // PRI-based
  if (input.priScore > 0.75 && adjustment === 'keep' && input.goal === 'hypertrophy') {
    targetSets = Math.min(10, targetSets + 1);
    adjustment = 'increase';
    reasons.push(`🟢 Высокая готовность — +1 подход`);
  }
  if (input.priScore < 0.4) {
    targetSets = Math.max(1, targetSets - 2);
    adjustment = 'decrease';
    reasons.push(`🟡 Низкая готовность — −2 подхода`);
  }

  // Fatigue/recovery
  if (input.fatigueScore > 0.75) {
    targetSets = Math.max(1, Math.round(targetSets * 0.7));
    targetReps = Math.max(1, targetReps - 2);
    adjustment = 'decrease';
    reasons.push('🟡 Высокая усталость — объём -30%');
  }

  // Joint fatigue
  if (input.jointFatigue['spine'] > 0.7 || (input.jointFatigue['knee'] || 0) > 0.7) {
    targetSets = Math.max(1, targetSets - 1);
    adjustment = 'decrease';
    reasons.push('🟡 Усталость суставов — объём снижен');
  }

  // Goal-based caps
  const caps: Record<string, { maxSets: number; maxReps: number }> = {
    strength: { maxSets: 6, maxReps: 6 },
    hypertrophy: { maxSets: 10, maxReps: 15 },
    conditioning: { maxSets: 8, maxReps: 30 },
    technique: { maxSets: 5, maxReps: 10 },
    rehab: { maxSets: 4, maxReps: 20 },
  };
  const cap = caps[input.goal] || caps.hypertrophy;
  targetSets = Math.max(1, Math.min(cap.maxSets, targetSets));
  targetReps = Math.max(1, Math.min(cap.maxReps, targetReps));

  return { adjustment, targetSets, targetReps, reasons };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Autoregulated Frequency
// ═══════════════════════════════════════════════════════════════════════════

function regulateFrequency(input: AutoregInput): FrequencyDecision {
  const reasons: string[] = [];
  let adjustment: AdjustmentDirection = 'keep';
  let freq = input.plannedFrequency;

  // High recovery + low fatigue → increase
  if (input.recoveryScore > 0.7 && input.fatigueScore < 0.3 && input.priScore > 0.7) {
    freq = Math.min(6, freq + 1);
    adjustment = 'increase';
    reasons.push('🟢 Отличное восстановление — частота +1 день');
  }

  // Low recovery → decrease
  if (input.recoveryScore < 0.3 || input.fatigueScore > 0.8) {
    freq = Math.max(2, freq - 1);
    adjustment = 'decrease';
    reasons.push('🟡 Низкое восстановление / высокая усталость — частота -1 день');
  }

  // Overload → decrease
  if (input.cumulativeLoad.overload) {
    freq = Math.max(2, freq - 1);
    adjustment = 'decrease';
    reasons.push('🔴 Overload — снижение частоты');
  }

  // Risk → decrease
  if (input.riskLevel === 'high') {
    freq = Math.max(2, freq - 1);
    adjustment = 'decrease';
    reasons.push('🔴 Высокий риск — снижение частоты');
  }

  return { adjustment, targetFrequency: freq, reasons };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Autoregulated Exercise Selection
// ═══════════════════════════════════════════════════════════════════════════

function regulateExerciseSelection(input: AutoregInput): ExerciseDecision {
  const reasons: string[] = [];
  let adjustment: ExerciseSelectionAdjustment = 'keep';
  const replaceList: string[] = [];

  // High joint stress on fatigued/risky joints
  for (const [joint, stress] of Object.entries(input.exerciseJointStress)) {
    const fatigue = input.jointFatigue[joint] || 0;
    if (stress > 5 && fatigue > 0.6) {
      adjustment = 'safer';
      replaceList.push(joint);
      reasons.push(`🟡 Усталость сустава ${joint} — замените упражнения с высокой нагрузкой`);
    }
  }

  // Technique issues → easier exercises
  if (input.techniqueScore < 0.4) {
    adjustment = 'easier';
    reasons.push('🔴 Низкий техника-скор — замена на более простые варианты');
  }

  // High risk → safer alternatives
  if (input.riskLevel === 'high') {
    adjustment = 'safer';
    reasons.push('🔴 Высокий риск — только безопасные вариации');
  }

  // High PRI + low fatigue → more specific
  if (input.priScore > 0.8 && input.fatigueScore < 0.2 && adjustment === 'keep') {
    adjustment = 'more_specific';
    reasons.push('🟢 Отличная готовность — можно использовать специфичные вариации');
  }

  return { adjustment, replaceExercises: replaceList, reasons };
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Autoregulation Engine
// ═══════════════════════════════════════════════════════════════════════════

export function autoregulate(input: AutoregInput): AutoregOutput {
  // Hard protection rules
  let sessionCancelled = false;
  let sessionDowngraded = false;

  if (input.riskLevel === 'high' && input.priScore < 0.2) {
    sessionCancelled = true;
  }
  if (input.jointFatigue['spine'] > 0.85 || (input.jointFatigue['knee'] || 0) > 0.85) {
    sessionDowngraded = true;
  }
  if (input.cumulativeLoad.overload && input.fatigueScore > 0.8) {
    sessionDowngraded = true;
  }

  const intensity = regulateIntensity(input);
  const volume = regulateVolume(input);
  const frequency = regulateFrequency(input);
  const exercise = regulateExerciseSelection(input);

  // Summary
  const parts: string[] = [];
  if (sessionCancelled) {
    parts.push('🔴 Тренировка ОТМЕНЕНА — критически низкая готовность + высокий риск');
  } else if (sessionDowngraded) {
    parts.push('🟡 Тренировка ПОНИЖЕНА — высокая усталость суставов');
  } else {
    if (intensity.adjustment !== 'keep') parts.push(`Интенсивность: ${intensity.adjustment}`);
    if (volume.adjustment !== 'keep') parts.push(`Объём: ${volume.adjustment}`);
    if (frequency.adjustment !== 'keep') parts.push(`Частота: ${frequency.adjustment}`);
  }

  return {
    intensity,
    volume,
    frequency,
    exercise,
    sessionCancelled,
    sessionDowngraded,
    summary: parts.length > 0 ? parts.join(' | ') : '✅ Все параметры в норме, стандартный режим',
  };
}
