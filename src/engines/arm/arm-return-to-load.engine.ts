import { armBodyRegionGate, type ArmBodyRegionGateInput } from './arm-body-region.engine';
import type { ArmReadinessStatus } from './arm-readiness.engine';

export type ArmReturnToLoadPhase = 'hold' | 'isometric' | 'low_load' | 'build' | 'return' | 'load';

export const ARM_RETURN_TO_LOAD_THRESHOLDS = {
  minimumPainFreeDays: 7,
  isometricDays: 10,
  lowLoadDays: 14,
  buildDays: 21,
  returnDays: 28,
  painCaution: 4,
  painBlock: 7,
  acwrCaution: 1.3,
  acwrBlock: 1.5,
} as const;

export interface ArmReturnToLoadInput {
  painFreeDays?: number;
  daysSinceStop?: number;
  pain?: number;
  readiness?: ArmReadinessStatus;
  acwrRatio?: number;
  regionGate?: ArmBodyRegionGateInput;
  acuteSymptoms?: boolean;
  clinicianCleared?: boolean;
}

export interface ArmReturnToLoadResult {
  phase: ArmReturnToLoadPhase;
  allowed: boolean;
  maxLoadPct: number;
  minRir: number;
  maxHoldSeconds: number;
  nextReviewDays: number;
  reasons: string[];
  recommendation: string;
  adjustmentApplied: false;
}

function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

const PHASE_PROFILE: Record<ArmReturnToLoadPhase, Pick<ArmReturnToLoadResult, 'maxLoadPct' | 'minRir' | 'maxHoldSeconds' | 'nextReviewDays'>> = {
  hold: { maxLoadPct: 0, minRir: 4, maxHoldSeconds: 0, nextReviewDays: 1 },
  isometric: { maxLoadPct: 25, minRir: 3, maxHoldSeconds: 20, nextReviewDays: 3 },
  low_load: { maxLoadPct: 40, minRir: 3, maxHoldSeconds: 30, nextReviewDays: 4 },
  build: { maxLoadPct: 60, minRir: 2, maxHoldSeconds: 30, nextReviewDays: 7 },
  return: { maxLoadPct: 80, minRir: 2, maxHoldSeconds: 30, nextReviewDays: 7 },
  load: { maxLoadPct: 100, minRir: 1, maxHoldSeconds: 30, nextReviewDays: 14 },
};

const PHASE_RECOMMENDATION: Record<ArmReturnToLoadPhase, string> = {
  hold: 'Только диагностика и безопасная изометрия без боли.',
  isometric: 'Изометрия и безболевая активность, без нагрузки на сустав.',
  low_load: 'Низкая нагрузка с контролем боли и достаточного отдыха.',
  build: 'Субмаксимальная нагрузка, RIR≥2, без соревновательных попыток.',
  return: 'Контролируемый возврат к основной нагрузке.',
  load: 'Возврат к плановой нагрузке при зелёной готовности.',
};

export function resolveArmReturnToLoad(input: ArmReturnToLoadInput = {}): ArmReturnToLoadResult {
  const reasons: string[] = [];
  const painFreeDays = input.painFreeDays ?? input.daysSinceStop;
  const pain = input.pain;
  const acwr = input.acwrRatio;
  const readiness = input.readiness;
  const gate = input.regionGate ? armBodyRegionGate(input.regionGate) : null;
  let phase: ArmReturnToLoadPhase;
  if (input.acuteSymptoms || gate?.status === 'block') {
    phase = 'hold';
    reasons.push(input.acuteSymptoms ? 'Острые симптомы' : 'Региональный стоп-гейт');
  } else if (finite(pain) && pain >= ARM_RETURN_TO_LOAD_THRESHOLDS.painBlock) {
    phase = 'hold';
    reasons.push(`Боль ${pain} ≥ ${ARM_RETURN_TO_LOAD_THRESHOLDS.painBlock}`);
  } else if (readiness === 'red' || (finite(acwr) && acwr >= ARM_RETURN_TO_LOAD_THRESHOLDS.acwrBlock)) {
    phase = 'hold';
    reasons.push(readiness === 'red' ? 'Readiness red' : `ACWR ${acwr}`);
  } else if (!finite(painFreeDays) || painFreeDays < ARM_RETURN_TO_LOAD_THRESHOLDS.minimumPainFreeDays) {
    phase = 'hold';
    reasons.push('Недостаточно безболевых дней или нет данных');
  } else if ((finite(pain) && pain >= ARM_RETURN_TO_LOAD_THRESHOLDS.painCaution) || readiness === 'yellow' || (finite(acwr) && acwr >= ARM_RETURN_TO_LOAD_THRESHOLDS.acwrCaution)) {
    phase = painFreeDays < ARM_RETURN_TO_LOAD_THRESHOLDS.lowLoadDays ? 'isometric' : 'low_load';
    reasons.push('Жёлтый сигнал: нагрузка ограничена');
  } else if (readiness !== 'green') {
    phase = painFreeDays < ARM_RETURN_TO_LOAD_THRESHOLDS.lowLoadDays ? 'isometric' : 'low_load';
    reasons.push('Readiness не подтверждён как green: возврат ограничен');
  } else if (painFreeDays < ARM_RETURN_TO_LOAD_THRESHOLDS.isometricDays) {
    phase = 'isometric';
    reasons.push('Переход к изометрии');
  } else if (painFreeDays < ARM_RETURN_TO_LOAD_THRESHOLDS.lowLoadDays) {
    phase = 'low_load';
    reasons.push('Переход к низкой нагрузке');
  } else if (painFreeDays < ARM_RETURN_TO_LOAD_THRESHOLDS.buildDays) {
    phase = 'build';
    reasons.push('Переход к субмаксимальной нагрузке');
  } else if (painFreeDays < ARM_RETURN_TO_LOAD_THRESHOLDS.returnDays || input.clinicianCleared === false) {
    phase = 'return';
    reasons.push(input.clinicianCleared === false ? 'Без подтверждения врача только контролируемый возврат' : 'Контролируемый возврат');
  } else {
    phase = 'load';
    reasons.push('Зелёные сигналы и достаточный безболевой период');
  }
  return {
    phase,
    allowed: phase !== 'hold',
    ...PHASE_PROFILE[phase],
    reasons,
    recommendation: PHASE_RECOMMENDATION[phase],
    adjustmentApplied: false,
  };
}

export const resolveReturnToLoad = resolveArmReturnToLoad;
export const getArmReturnPhase = resolveArmReturnToLoad;
