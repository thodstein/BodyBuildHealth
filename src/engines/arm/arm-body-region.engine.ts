import { canonicalizeArmMuscle, canonicalizeArmTendonMuscle } from './arm-tendon-sets.engine';

export type ArmBodyRegion = 'shoulder' | 'elbow' | 'forearm' | 'wrist' | 'hand';
export type ArmBodyRegionGateStatus = 'allow' | 'caution' | 'block' | 'unknown';

export const ARM_BODY_REGIONS: readonly ArmBodyRegion[] = ['shoulder', 'elbow', 'forearm', 'wrist', 'hand'];

export const ARM_BODY_REGION_MUSCLES: Readonly<Record<string, readonly ArmBodyRegion[]>> = {
  wrist_flexors: ['wrist', 'hand'],
  wrist_extensors: ['wrist', 'forearm'],
  pronators: ['forearm', 'wrist'],
  supinators: ['forearm', 'elbow'],
  risers: ['hand', 'wrist'],
  ulnar_deviators: ['wrist', 'hand'],
  radial_deviators: ['wrist', 'hand'],
  thumb: ['hand', 'wrist'],
  brachialis: ['elbow'],
  biceps_long: ['elbow'],
  biceps_short: ['elbow'],
  brachioradialis: ['elbow', 'forearm'],
  back_pressure: ['elbow', 'shoulder'],
  side_pressure: ['elbow', 'shoulder'],
  grip_support: ['hand', 'wrist'],
  grip_pinch: ['hand', 'wrist'],
  grip_crush: ['hand', 'wrist'],
  shoulder_stab: ['shoulder'],
  core_anchor: [],
};

export const ARM_BODY_REGION_THRESHOLDS: Readonly<Record<ArmBodyRegion, {
  maxReps: number;
  minRir: number;
  maxHoldSeconds: number;
  painCaution: number;
  painBlock: number;
}>> = {
  shoulder: { maxReps: 20, minRir: 2, maxHoldSeconds: 30, painCaution: 3, painBlock: 7 },
  elbow: { maxReps: 15, minRir: 2, maxHoldSeconds: 30, painCaution: 3, painBlock: 7 },
  forearm: { maxReps: 20, minRir: 2, maxHoldSeconds: 45, painCaution: 4, painBlock: 7 },
  wrist: { maxReps: 25, minRir: 2, maxHoldSeconds: 30, painCaution: 4, painBlock: 7 },
  hand: { maxReps: 30, minRir: 2, maxHoldSeconds: 30, painCaution: 4, painBlock: 7 },
};

const REGION_ALIASES: Readonly<Record<string, ArmBodyRegion>> = {
  shoulder: 'shoulder',
  humerus: 'shoulder',
  плечо: 'shoulder',
  плеч: 'shoulder',
  elbow: 'elbow',
  локоть: 'elbow',
  локтевой: 'elbow',
  forearm: 'forearm',
  предплечье: 'forearm',
  предплеч: 'forearm',
  wrist: 'wrist',
  wrist_joint: 'wrist',
  запястье: 'wrist',
  запяст: 'wrist',
  кисть: 'wrist',
  кистевой: 'wrist',
  hand: 'hand',
  finger: 'hand',
  fingers: 'hand',
  thumb: 'hand',
  палец: 'hand',
  пальцы: 'hand',
  большой_палец: 'hand',
};

function normalizeRegionKey(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_а-яё]/gi, '');
}

export function normalizeArmBodyRegion(value: unknown): ArmBodyRegion | null {
  const key = normalizeRegionKey(value);
  if (!key) return null;
  const direct = REGION_ALIASES[key];
  if (direct) return direct;
  const muscle = canonicalizeArmMuscle(key);
  if (!muscle) return null;
  return ARM_BODY_REGION_MUSCLES[muscle]?.[0] ?? null;
}

export function armBodyRegionsForValue(value: unknown): ArmBodyRegion[] {
  const key = normalizeRegionKey(value);
  const direct = REGION_ALIASES[key];
  if (direct) return [direct];
  const muscle = canonicalizeArmMuscle(value) ?? canonicalizeArmTendonMuscle(value);
  return muscle && ARM_BODY_REGION_MUSCLES[muscle] ? [...ARM_BODY_REGION_MUSCLES[muscle]] : [];
}

export function armBodyRegionForValue(value: unknown): ArmBodyRegion | null {
  return armBodyRegionsForValue(value)[0] ?? null;
}

export function armBodyRegionLabel(region: ArmBodyRegion): string {
  return {
    shoulder: 'плечо',
    elbow: 'локоть',
    forearm: 'предплечье',
    wrist: 'кисть',
    hand: 'кисть/пальцы',
  }[region];
}

export interface ArmBodyRegionExerciseLike {
  muscle?: string;
  substitutionGroup?: string;
  movementPattern?: string;
  name?: string;
}

export function armBodyRegionsForExercise(exercise: ArmBodyRegionExerciseLike | null | undefined): ArmBodyRegion[] {
  const out = new Set<ArmBodyRegion>();
  for (const value of [exercise?.muscle, exercise?.substitutionGroup, exercise?.movementPattern, exercise?.name]) {
    for (const region of armBodyRegionsForValue(value)) out.add(region);
  }
  return [...out];
}

export function armBodyRegionForExercise(exercise: ArmBodyRegionExerciseLike | null | undefined): ArmBodyRegion | null {
  return armBodyRegionsForExercise(exercise)[0] ?? null;
}

export interface ArmBodyRegionGateInput {
  region?: ArmBodyRegion | string;
  muscle?: string;
  repsMax?: number;
  reps?: number;
  rir?: number;
  holdSeconds?: number;
  pain?: number;
  acutePain?: boolean;
  swelling?: boolean;
  numbness?: boolean;
  painWithLoad?: boolean;
  mode?: 'load' | 'isometric' | 'table' | 'sparring' | 'technique';
}

export interface ArmBodyRegionGateResult {
  region: ArmBodyRegion | null;
  regions: ArmBodyRegion[];
  status: ArmBodyRegionGateStatus;
  allowed: boolean;
  reasons: string[];
  thresholds: Readonly<Record<string, number>> | null;
  recommendation: string;
}

function validNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function armBodyRegionGate(input: ArmBodyRegionGateInput = {}): ArmBodyRegionGateResult {
  const regions = input.region
    ? (normalizeArmBodyRegion(input.region) ? [normalizeArmBodyRegion(input.region) as ArmBodyRegion] : [])
    : input.muscle
      ? armBodyRegionsForValue(input.muscle)
      : [];
  const region = regions[0] ?? null;
  if (!region) {
    return { region: null, regions: [], status: 'unknown', allowed: false, reasons: ['Регион не определён'], thresholds: null, recommendation: 'Сначала уточнить регион нагрузки.' };
  }
  const thresholds = ARM_BODY_REGION_THRESHOLDS[region];
  const reasons: string[] = [];
  let statusRank = 0;
  const rank: Record<ArmBodyRegionGateStatus, number> = { allow: 0, unknown: 0, caution: 1, block: 2 };
  const worsen = (next: ArmBodyRegionGateStatus) => {
    statusRank = Math.max(statusRank, rank[next]);
  };
  if (input.acutePain || input.swelling || input.numbness) {
    worsen('block');
    reasons.push('Острый симптом: нагрузка остановлена до осмотра');
  }
  const pain = input.pain;
  if (validNumber(pain) && pain >= thresholds.painBlock) {
    worsen('block');
    reasons.push(`Боль ${pain} ≥ ${thresholds.painBlock}`);
  } else if (validNumber(pain) && pain >= thresholds.painCaution) {
    worsen('caution');
    reasons.push(`Боль ${pain} ≥ ${thresholds.painCaution}`);
  }
  if (input.painWithLoad && validNumber(pain) && pain >= thresholds.painCaution) {
    worsen('caution');
    reasons.push('Боль усиливается под нагрузкой');
  }
  const reps = validNumber(input.repsMax) ? input.repsMax : input.reps;
  if (validNumber(reps) && reps > thresholds.maxReps) {
    worsen('caution');
    reasons.push(`Повторы ${reps} > ${thresholds.maxReps}`);
  }
  if (validNumber(input.rir) && input.rir <= 0) {
    worsen('block');
    reasons.push('RIR ≤ 0: работа в отказ запрещена');
  } else if (validNumber(input.rir) && input.rir < thresholds.minRir) {
    worsen('caution');
    reasons.push(`RIR ${input.rir} < ${thresholds.minRir}`);
  }
  if (validNumber(input.holdSeconds) && input.holdSeconds > thresholds.maxHoldSeconds) {
    worsen('caution');
    reasons.push(`Удержание ${input.holdSeconds} > ${thresholds.maxHoldSeconds} с`);
  }
  const status: ArmBodyRegionGateStatus = statusRank === 2 ? 'block' : statusRank === 1 ? 'caution' : 'allow';
  const recommendation = status === 'block'
    ? 'Стоп нагрузки; только диагностика/осмотр.'
    : status === 'caution'
      ? 'Снизить объём, оставить RIR≥2 и проверить реакцию.'
      : 'Региональные ограничения не превышены.';
  return { region, regions, status, allowed: status !== 'block', reasons, thresholds, recommendation };
}

export const ARM_BODY_REGION_LIMITS = ARM_BODY_REGION_THRESHOLDS;
export const armRegionGate = armBodyRegionGate;
