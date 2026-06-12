/**
 * Progression Rules Engine — All 9 progression types with full formulas.
 *
 * 1. Linear Progression   : weight += fixed increment each session
 * 2. Double Progression    : reps increase → weight reset → repeat
 * 3. RPE Progression       : auto-adjust weight by RPE target
 * 4. Top-Set + Backoff     : one heavy set, volume backoffs
 * 5. Wave Loading          : oscillating intensity waves
 * 6. VBT Progression       : velocity-based auto-regulation
 * 7. Auto-Regulated Volume : dynamic set count by fatigue
 * 8. Auto-Regulated Intensity : dynamic %1RM by readiness
 * 9. Undulating Progression: daily variation (strength/hyper/power)
 *
 * @module progression-rules-engine
 */

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

export type ProgressionType = 'linear' | 'double' | 'rpe' | 'top_backoff' | 'wave' | 'vbt' | 'autoreg_volume' | 'autoreg_intensity' | 'undulating';

export interface ProgressionState {
  currentWeight: number;
  currentReps: number;
  currentSets: number;
  weekInCycle: number;
  sessionCount: number;
  lastRPE: number;
  lastVelocity?: number;
  targetReps: number;
  targetSets: number;
  targetRPE: number;
  estimated1RM: number;
}

export interface ProgressionInput extends ProgressionState {
  type: ProgressionType;
  increment: number;       // kg for linear
  repsMin: number;
  repsMax: number;
  rpeThreshold: number;    // e.g., 8.5
  velocityTarget?: number; // m/s
  fatigueLevel: number;    // 0-1
  priScore: number;        // 0-1
}

export interface ProgressionOutput {
  nextWeight: number;
  nextReps: number;
  nextSets: number;
  nextRPE: number;
  shouldDeload: boolean;
  deloadReason: string;
  explanation: string;
  weightChange: number;    // kg diff from current
  repChange: number;
  setChange: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. Linear Progression
// ═══════════════════════════════════════════════════════════════════════════

function linearProgression(input: ProgressionInput): ProgressionOutput {
  const { currentWeight, currentReps, currentSets, targetReps, targetRPE, rpeThreshold, increment } = input;
  let nextWeight = currentWeight;
  let nextReps = targetReps;
  let nextSets = currentSets;
  let explanation = '';

  // If hit all targets → increase weight
  if (currentReps >= targetReps && input.lastRPE <= rpeThreshold) {
    nextWeight = currentWeight + increment;
    nextReps = targetReps;
    explanation = `Все повторения выполнены (RPE ${input.lastRPE} ≤ ${rpeThreshold}) → вес +${increment} кг`;
  } else if (input.lastRPE > rpeThreshold + 1) {
    // Failed hard — weight reset
    nextWeight = Math.max(20, currentWeight - increment * 3);
    explanation = `RPE ${input.lastRPE} > ${rpeThreshold + 1} — перегрузка → сброс ${increment * 3} кг`;
  } else {
    nextWeight = currentWeight;
    nextReps = targetReps;
    explanation = `Повторите вес. Цель: ${targetReps} повт @ RPE ≤ ${rpeThreshold}`;
  }

  return {
    nextWeight, nextReps, nextSets,
    nextRPE: targetRPE,
    shouldDeload: false, deloadReason: '', explanation,
    weightChange: Math.round((nextWeight - currentWeight) * 10) / 10,
    repChange: nextReps - currentReps,
    setChange: nextSets - currentSets,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. Double Progression
// ═══════════════════════════════════════════════════════════════════════════

function doubleProgression(input: ProgressionInput): ProgressionOutput {
  const { currentWeight, currentReps, repsMin, repsMax, rpeThreshold, increment } = input;
  let nextWeight = currentWeight;
  let nextReps = currentReps;
  let explanation = '';

  if (currentReps >= repsMax && input.lastRPE <= rpeThreshold) {
    nextWeight = currentWeight + increment;
    nextReps = repsMin;
    explanation = `Максимум повторений (${repsMax}) достигнут → вес +${increment} кг, повторения сброшены до ${repsMin}`;
  } else if (currentReps >= repsMin && input.lastRPE <= rpeThreshold) {
    nextReps = Math.min(repsMax, currentReps + 1);
    explanation = `+1 повторение (${currentReps} → ${nextReps}). Цель: ${repsMax} @ RPE ≤ ${rpeThreshold}`;
  } else if (input.lastRPE > rpeThreshold + 1) {
    nextReps = Math.max(repsMin, currentReps - 2);
    explanation = `RPE слишком высок → повторения снижены на 2`;
  } else {
    nextReps = currentReps;
    explanation = 'Повторите. Добавьте повторение при RPE ≤ порога.';
  }

  return {
    nextWeight, nextReps, nextSets: input.currentSets,
    nextRPE: input.targetRPE,
    shouldDeload: false, deloadReason: '', explanation,
    weightChange: Math.round((nextWeight - currentWeight) * 10) / 10,
    repChange: nextReps - currentReps,
    setChange: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. RPE Progression
// ═══════════════════════════════════════════════════════════════════════════

const RPE_PERCENT_TABLE: Record<number, Record<number, number>> = {
  1: { 6: 0.86, 7: 0.89, 8: 0.92, 9: 0.96, 10: 1.00 },
  2: { 6: 0.84, 7: 0.86, 8: 0.89, 9: 0.92, 10: 0.95 },
  3: { 6: 0.81, 7: 0.83, 8: 0.86, 9: 0.89, 10: 0.92 },
  4: { 6: 0.79, 7: 0.81, 8: 0.84, 9: 0.87, 10: 0.90 },
  5: { 6: 0.76, 7: 0.79, 8: 0.82, 9: 0.85, 10: 0.88 },
  6: { 6: 0.74, 7: 0.76, 8: 0.79, 9: 0.82, 10: 0.85 },
  8: { 6: 0.70, 7: 0.72, 8: 0.75, 9: 0.78, 10: 0.82 },
  10: { 6: 0.65, 7: 0.68, 8: 0.71, 9: 0.75, 10: 0.78 },
  12: { 6: 0.61, 7: 0.64, 8: 0.67, 9: 0.71, 10: 0.74 },
  15: { 6: 0.57, 7: 0.60, 8: 0.63, 9: 0.67, 10: 0.70 },
};

function rpeProgression(input: ProgressionInput): ProgressionOutput {
  const { estimated1RM, targetReps, targetRPE, rpeThreshold } = input;
  const repEntry = RPE_PERCENT_TABLE[targetReps] || RPE_PERCENT_TABLE[8];
  const rpeEntry = repEntry[Math.round(targetRPE)] || repEntry[7];

  // Target weight from RPE
  let nextWeight = Math.round(estimated1RM * rpeEntry * 0.5) * 2;
  let explanation = '';

  const actualRPE = input.lastRPE;
  const rpeDeviation = actualRPE - targetRPE;

  if (rpeDeviation < -1) {
    nextWeight = Math.round(nextWeight * 1.05 * 0.5) * 2;
    explanation = `RPE ${actualRPE} ниже цели ${targetRPE} → вес +5%`;
  } else if (rpeDeviation > 1) {
    nextWeight = Math.round(nextWeight * 0.92 * 0.5) * 2;
    explanation = `RPE ${actualRPE} выше цели ${targetRPE} → вес -8%`;
  } else {
    explanation = `RPE ${actualRPE} ≈ цель ${targetRPE} → вес ${nextWeight} кг`;
  }

  const shouldDeload = input.weekInCycle >= 4 && Math.abs(rpeDeviation) > 2;

  return {
    nextWeight, nextReps: targetReps, nextSets: input.currentSets,
    nextRPE: targetRPE,
    shouldDeload,
    deloadReason: shouldDeload ? `Отклонение RPE >2 в течение 4+ недель — deload` : '',
    explanation,
    weightChange: Math.round((nextWeight - input.currentWeight) * 10) / 10,
    repChange: targetReps - input.currentReps,
    setChange: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Top-Set + Backoff
// ═══════════════════════════════════════════════════════════════════════════

function topBackoffProgression(input: ProgressionInput): ProgressionOutput {
  const { estimated1RM, targetRPE } = input;
  const topPercent = RPE_PERCENT_TABLE[1]?.[Math.round(targetRPE)] || 0.92;
  const topWeight = Math.round(estimated1RM * topPercent * 0.5) * 2;
  const backoffWeight1 = Math.round(topWeight * 0.88 * 0.5) * 2;
  const backoffWeight2 = Math.round(topWeight * 0.78 * 0.5) * 2;

  let nextTopWeight = topWeight;
  if (input.lastRPE <= targetRPE - 0.5) {
    nextTopWeight = Math.round(topWeight * 1.025 * 0.5) * 2;
  }

  return {
    nextWeight: nextTopWeight,
    nextReps: 1,
    nextSets: 3,
    nextRPE: targetRPE,
    shouldDeload: false, deloadReason: '',
    explanation: `Топ-сет: ${nextTopWeight}кг ×1 @RPE ${targetRPE}. Бэкофф: ${backoffWeight1}кг ×3, ${backoffWeight2}кг ×4`,
    weightChange: Math.round((nextTopWeight - input.currentWeight) * 10) / 10,
    repChange: 0, setChange: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. Wave Loading
// ═══════════════════════════════════════════════════════════════════════════

function waveProgression(input: ProgressionInput): ProgressionOutput {
  const { estimated1RM, targetRPE } = input;
  const waveWeek = input.weekInCycle % 3;
  const wave = [
    { reps: 5, pct: 0.78, name: 'Волна 1: объём' },
    { reps: 3, pct: 0.85, name: 'Волна 2: сила' },
    { reps: 1, pct: 0.92, name: 'Волна 3: пик' },
  ][waveWeek];

  let nextWeight = Math.round(estimated1RM * wave.pct * 0.5) * 2;
  if (input.lastRPE <= targetRPE - 1) {
    nextWeight = Math.round(nextWeight * 1.03 * 0.5) * 2;
  }

  return {
    nextWeight, nextReps: wave.reps, nextSets: 3,
    nextRPE: targetRPE,
    shouldDeload: false, deloadReason: '',
    explanation: `${wave.name}: ${nextWeight}кг ×${wave.reps} @RPE ${targetRPE}`,
    weightChange: Math.round((nextWeight - input.currentWeight) * 10) / 10,
    repChange: wave.reps - input.currentReps,
    setChange: 3 - input.currentSets,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. VBT Progression
// ═══════════════════════════════════════════════════════════════════════════

const VBT_COEFFS: Record<string, { a: number; b: number }> = {
  squat: { a: -0.0529, b: 1.3447 },
  bench: { a: -0.0465, b: 1.2589 },
  deadlift: { a: -0.0478, b: 1.3123 },
};

function vbtProgression(input: ProgressionInput): ProgressionOutput {
  const velocity = input.lastVelocity || input.velocityTarget || 0.5;
  const coeffs = VBT_COEFFS.squat;
  const pct = Math.min(1, Math.max(0.4, coeffs.a * velocity + coeffs.b));
  const nextWeight = Math.round(input.estimated1RM * pct * 0.5) * 2;
  const velocityLoss = input.lastVelocity
    ? Math.round(((input.velocityTarget || 0.6) - input.lastVelocity) / (input.velocityTarget || 0.6) * 100)
    : 0;

  return {
    nextWeight, nextReps: Math.max(1, Math.round((1 - pct) * 20)),
    nextSets: velocityLoss > 40 ? Math.max(1, input.currentSets - 1) : input.currentSets,
    nextRPE: Math.round((8 - velocity * 4) * 10) / 10,
    shouldDeload: velocityLoss > 50,
    deloadReason: velocityLoss > 50 ? `Потеря скорости >50% — снижение нагрузки или deload` : '',
    explanation: `Скорость: ${velocity.toFixed(2)} м/с → ${Math.round(pct * 100)}% 1RM. Потеря: ${velocityLoss}%`,
    weightChange: Math.round((nextWeight - input.currentWeight) * 10) / 10,
    repChange: 0, setChange: input.currentSets > 0 ? (velocityLoss > 40 ? -1 : 0) : 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. Auto-Regulated Volume
// ═══════════════════════════════════════════════════════════════════════════

function autoregVolume(input: ProgressionInput): ProgressionOutput {
  let nextSets = input.currentSets;
  let explanation = '';

  const fatigueScore = (input.lastRPE / 10) * 0.6 + input.fatigueLevel * 0.4;

  if (fatigueScore < 0.3 && input.priScore > 0.7) {
    nextSets = Math.min(8, input.currentSets + 1);
    explanation = `Низкая усталость (${(fatigueScore * 100).toFixed(0)}%) + высокая готовность → +1 подход`;
  } else if (fatigueScore > 0.7) {
    nextSets = Math.max(1, input.currentSets - 2);
    explanation = `Высокая усталость (${(fatigueScore * 100).toFixed(0)}%) → −2 подхода`;
  } else if (input.lastRPE > 9) {
    nextSets = Math.max(1, input.currentSets - 1);
    explanation = 'RPE >9 — снижение объёма';
  } else {
    explanation = `Усталость ${(fatigueScore * 100).toFixed(0)}% — объём без изменений`;
  }

  return {
    nextWeight: input.currentWeight, nextReps: input.currentReps, nextSets,
    nextRPE: input.targetRPE,
    shouldDeload: fatigueScore > 0.85 && input.weekInCycle >= 3,
    deloadReason: fatigueScore > 0.85 ? 'Критическая усталость — deload' : '',
    explanation,
    weightChange: 0, repChange: 0,
    setChange: nextSets - input.currentSets,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 8. Auto-Regulated Intensity
// ═══════════════════════════════════════════════════════════════════════════

function autoregIntensity(input: ProgressionInput): ProgressionOutput {
  let intensityMod = 0;
  let explanation = '';

  if (input.priScore > 0.75 && input.fatigueLevel < 0.3) {
    intensityMod = 0.05;
    explanation = 'Высокая готовность + низкая усталость → +5% интенсивности';
  } else if (input.priScore < 0.35 || input.fatigueLevel > 0.7) {
    intensityMod = -0.10;
    explanation = 'Низкая готовность или высокая усталость → −10% интенсивности';
  } else if (input.lastRPE > input.targetRPE + 1.5) {
    intensityMod = -0.07;
    explanation = `RPE ${input.lastRPE} сильно выше цели ${input.targetRPE} → −7%`;
  } else {
    explanation = 'Интенсивность без изменений';
  }

  const nextWeight = Math.round(input.currentWeight * (1 + intensityMod) * 0.5) * 2;

  return {
    nextWeight, nextReps: input.currentReps, nextSets: input.currentSets,
    nextRPE: input.targetRPE,
    shouldDeload: input.priScore < 0.2 && input.weekInCycle >= 3,
    deloadReason: input.priScore < 0.2 ? 'Критически низкая готовность — deload' : '',
    explanation,
    weightChange: Math.round((nextWeight - input.currentWeight) * 10) / 10,
    repChange: 0, setChange: 0,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 9. Undulating Progression
// ═══════════════════════════════════════════════════════════════════════════

function undulatingProgression(input: ProgressionInput): ProgressionOutput {
  const dayType = input.sessionCount % 3;
  const templates = [
    { name: 'Силовой день', reps: 3, pct: 0.88, rpe: 8.5 },
    { name: 'Гипертрофия', reps: 10, pct: 0.70, rpe: 7.5 },
    { name: 'Мощность', reps: 2, pct: 0.80, rpe: 7.0 },
  ];
  const t = templates[dayType];
  const nextWeight = Math.round(input.estimated1RM * t.pct * 0.5) * 2;

  return {
    nextWeight, nextReps: t.reps, nextSets: 3 + dayType * 1,
    nextRPE: t.rpe,
    shouldDeload: false, deloadReason: '',
    explanation: `${t.name}: ${nextWeight}кг ×${t.reps} @RPE ${t.rpe}`,
    weightChange: Math.round((nextWeight - input.currentWeight) * 10) / 10,
    repChange: t.reps - input.currentReps,
    setChange: 3 + dayType * 1 - input.currentSets,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Router
// ═══════════════════════════════════════════════════════════════════════════

export function applyProgression(input: ProgressionInput): ProgressionOutput {
  switch (input.type) {
    case 'linear': return linearProgression(input);
    case 'double': return doubleProgression(input);
    case 'rpe': return rpeProgression(input);
    case 'top_backoff': return topBackoffProgression(input);
    case 'wave': return waveProgression(input);
    case 'vbt': return vbtProgression(input);
    case 'autoreg_volume': return autoregVolume(input);
    case 'autoreg_intensity': return autoregIntensity(input);
    case 'undulating': return undulatingProgression(input);
    default: return linearProgression(input);
  }
}

/** Get recommended progression type for goal + level */
export function recommendProgression(goal: string, level: string): ProgressionType {
  if (level === 'beginner' || level === 'novice') return 'linear';
  if (goal === 'strength' && level === 'intermediate') return 'rpe';
  if (goal === 'strength' && level === 'advanced') return 'top_backoff';
  if (goal === 'hypertrophy' || goal === 'bulk') return 'double';
  if (level === 'advanced' || level === 'enhanced') return 'undulating';
  return 'linear';
}
