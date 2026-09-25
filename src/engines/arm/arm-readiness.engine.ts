import type { ArmDiaryDay } from './arm-diary-autoreg.engine';
import { armBodyRegionGate, type ArmBodyRegionGateInput } from './arm-body-region.engine';

export type ArmReadinessStatus = 'red' | 'yellow' | 'green' | 'unknown';
export type ArmReadinessAction = 'hold' | 'modify' | 'proceed';

export interface ArmReadinessProfile {
  sleepHours?: number;
  hrvMs?: number;
  stressLevel?: number;
}

export interface ArmReadinessInput {
  diary?: Array<ArmDiaryDay & { shoulderPain?: number; handPain?: number }> | null;
  profile?: ArmReadinessProfile | null;
  sleepHours?: number;
  hrvMs?: number;
  stressLevel?: number;
  acwrRatio?: number;
  regions?: Array<ArmBodyRegionGateInput> | null;
  readiness?: ArmReadinessResult | null;
}

export const ARM_READINESS_THRESHOLDS = {
  srpeCaution: 8,
  srpeBlock: 9,
  painCaution: 4,
  painBlock: 7,
  velocityLossCautionPct: 20,
  velocityLossBlockPct: 30,
  sleepCautionHours: 6,
  sleepBlockHours: 5,
  hrvCautionMs: 40,
  hrvBlockMs: 30,
  stressCaution: 6,
  stressBlock: 8,
  acwrCaution: 1.3,
  acwrBlock: 1.5,
} as const;

export interface ArmReadinessSignal {
  source: 'diary' | 'profile' | 'acwr' | 'region';
  name: string;
  level: Exclude<ArmReadinessStatus, 'unknown'>;
  value: number | string;
  reason: string;
}

export interface ArmReadinessResult {
  status: ArmReadinessStatus;
  action: ArmReadinessAction;
  score: number | null;
  signalCount: number;
  signals: ArmReadinessSignal[];
  reasons: string[];
  recommendation: string;
  adjustment: {
    volumeMult: 1;
    rirShift: 0;
    restDays: 0;
  };
  adjustmentApplied: false;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function severityRank(status: ArmReadinessStatus): number {
  return { green: 0, unknown: -1, yellow: 1, red: 2 }[status];
}

function worst(a: ArmReadinessStatus, b: Exclude<ArmReadinessStatus, 'unknown'>): ArmReadinessStatus {
  return severityRank(b) > severityRank(a) ? b : a;
}

function classify(value: number, caution: number, block: number): Exclude<ArmReadinessStatus, 'unknown'> {
  if (value >= block) return 'red';
  if (value >= caution) return 'yellow';
  return 'green';
}

function addSignal(
  signals: ArmReadinessSignal[],
  state: { status: ArmReadinessStatus },
  signal: ArmReadinessSignal,
): void {
  signals.push(signal);
  state.status = worst(state.status, signal.level);
}

export function assessArmReadiness(input: ArmReadinessInput = {}): ArmReadinessResult {
  const preclassified = Array.isArray(input.readiness?.signals)
    ? input.readiness.signals.filter((signal) => signal && typeof signal.name === 'string')
    : [];
  const signals: ArmReadinessSignal[] = [...preclassified];
  const state: { status: ArmReadinessStatus } = { status: 'unknown' };
  for (const signal of preclassified) {
    if (signal.level === 'red' || signal.level === 'yellow') state.status = worst(state.status, signal.level);
  }
  const diary = Array.isArray(input.diary) ? input.diary.slice(-7) : [];
  for (const day of diary) {
    const srpe = Number(day?.srpe);
    if (finite(srpe)) {
      const level = classify(srpe, ARM_READINESS_THRESHOLDS.srpeCaution, ARM_READINESS_THRESHOLDS.srpeBlock);
      if (level) addSignal(signals, state, { source: 'diary', name: 'sRPE', level, value: srpe, reason: `sRPE ${srpe}` });
    }
    const painValues = [day?.elbowPain, day?.wristPain, day?.shoulderPain, day?.handPain].filter((value): value is number => finite(value));
    if (painValues.length > 0) {
      const pain = Math.max(...painValues);
      const level = classify(pain, ARM_READINESS_THRESHOLDS.painCaution, ARM_READINESS_THRESHOLDS.painBlock);
      addSignal(signals, state, { source: 'diary', name: 'joint pain', level, value: pain, reason: `Боль ${pain}/10` });
    }
    const velocityLoss = Number(day?.velocityLossPct);
    if (finite(velocityLoss) && velocityLoss > 0) {
      const level = classify(velocityLoss, ARM_READINESS_THRESHOLDS.velocityLossCautionPct, ARM_READINESS_THRESHOLDS.velocityLossBlockPct);
      if (level) addSignal(signals, state, { source: 'diary', name: 'velocity loss', level, value: velocityLoss, reason: `Потеря скорости ${velocityLoss}%` });
    }
  }
  const profile = input.profile || {};
  const sleepHours = input.sleepHours ?? profile.sleepHours;
  if (finite(sleepHours)) {
    const level: Exclude<ArmReadinessStatus, 'unknown'> = sleepHours < ARM_READINESS_THRESHOLDS.sleepBlockHours
      ? 'red'
      : sleepHours < ARM_READINESS_THRESHOLDS.sleepCautionHours
        ? 'yellow'
        : 'green';
    addSignal(signals, state, { source: 'profile', name: 'sleep', level, value: sleepHours, reason: `Сон ${sleepHours} ч` });
  }
  const hrvMs = input.hrvMs ?? profile.hrvMs;
  if (finite(hrvMs) && hrvMs > 0) {
    const level: Exclude<ArmReadinessStatus, 'unknown'> = hrvMs < ARM_READINESS_THRESHOLDS.hrvBlockMs
      ? 'red'
      : hrvMs < ARM_READINESS_THRESHOLDS.hrvCautionMs
        ? 'yellow'
        : 'green';
    addSignal(signals, state, { source: 'profile', name: 'HRV', level, value: hrvMs, reason: `HRV ${hrvMs} мс` });
  }
  const stressLevel = input.stressLevel ?? profile.stressLevel;
  if (finite(stressLevel)) {
    const level = classify(stressLevel, ARM_READINESS_THRESHOLDS.stressCaution, ARM_READINESS_THRESHOLDS.stressBlock);
    if (level) addSignal(signals, state, { source: 'profile', name: 'stress', level, value: stressLevel, reason: `Стресс ${stressLevel}` });
  }
  const acwrRatio = input.acwrRatio;
  if (finite(acwrRatio) && acwrRatio > 0) {
    const level = classify(acwrRatio, ARM_READINESS_THRESHOLDS.acwrCaution, ARM_READINESS_THRESHOLDS.acwrBlock);
    if (level) addSignal(signals, state, { source: 'acwr', name: 'ACWR', level, value: acwrRatio, reason: `ACWR ${acwrRatio}` });
  }
  for (const region of input.regions || []) {
    const gate = armBodyRegionGate(region);
    if (gate.status === 'block') {
      addSignal(signals, state, { source: 'region', name: gate.region || 'region', level: 'red', value: gate.status, reason: gate.reasons.join('; ') });
    } else if (gate.status === 'caution') {
      addSignal(signals, state, { source: 'region', name: gate.region || 'region', level: 'yellow', value: gate.status, reason: gate.reasons.join('; ') });
    } else if (gate.status === 'allow') {
      addSignal(signals, state, { source: 'region', name: gate.region || 'region', level: 'green', value: gate.status, reason: gate.recommendation });
    }
  }
  if (signals.length === 0) {
    return {
      status: 'unknown',
      action: 'hold',
      score: null,
      signalCount: 0,
      signals,
      reasons: ['Нет валидных сигналов'],
      recommendation: 'Собрать сон, пульс/HRV, sRPE и боль перед нагрузкой.',
      adjustment: { volumeMult: 1, rirShift: 0, restDays: 0 },
      adjustmentApplied: false,
    };
  }
  const status: ArmReadinessStatus = state.status;
  const score = status === 'red' ? 40 : status === 'yellow' ? 70 : 100;
  const action: ArmReadinessAction = status === 'red' ? 'hold' : status === 'yellow' ? 'modify' : 'proceed';
  const reasons = signals.map((signal) => signal.reason);
  const recommendation = action === 'hold'
    ? 'Остановить нагрузку и проверить симптомы.'
    : action === 'modify'
      ? 'Сохранить осторожный объём без дополнительного множителя.'
      : 'Сигналы в допуске.';
  return {
    status,
    action,
    score,
    signalCount: signals.length,
    signals,
    reasons,
    recommendation,
    adjustment: { volumeMult: 1, rirShift: 0, restDays: 0 },
    adjustmentApplied: false,
  };
}

export const evaluateArmReadiness = assessArmReadiness;
export const resolveArmReadiness = assessArmReadiness;
