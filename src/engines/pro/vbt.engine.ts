/**
 * vbt.engine.ts — P2: Velocity-Based Training (проф. уровень).
 * Load-velocity profile по движениям, velocity-таргеты по intent (сила/мощность/гипертрофия/скорость),
 * velocity-loss-пороги для авторегулируемого окончания сетов. P1 заложил базовый LVP — здесь
 * полноценный VBT-движок (расширенный профиль + интенты + потеря скорости).
 */

export type VBTLift = 'squat' | 'bench' | 'deadlift' | 'ohp' | 'row';
export type VBTIntent = 'absolute_strength' | 'strength' | 'power_heavy' | 'power_light' | 'hypertrophy' | 'speed';

/** Расширенный LVP: средняя концентрическая скорость (м/с) @ %1RM (Gonzalez-Badillo / Jovanovic). */
export const LOAD_VELOCITY_PROFILE: Record<VBTLift, ReadonlyArray<readonly [number, number]>> = {
  // [%1RM, velocity m/s] — от 100% к 30%
  squat:     [[1.00, 0.30], [0.95, 0.40], [0.90, 0.47], [0.85, 0.55], [0.80, 0.60], [0.70, 0.75], [0.60, 0.87], [0.50, 1.00], [0.40, 1.13], [0.30, 1.27]],
  bench:     [[1.00, 0.16], [0.95, 0.24], [0.90, 0.33], [0.85, 0.40], [0.80, 0.47], [0.70, 0.60], [0.60, 0.75], [0.50, 0.90], [0.40, 1.05], [0.30, 1.20]],
  deadlift:  [[1.00, 0.20], [0.95, 0.28], [0.90, 0.37], [0.85, 0.44], [0.80, 0.50], [0.70, 0.62], [0.60, 0.77], [0.50, 0.92], [0.40, 1.07], [0.30, 1.22]],
  ohp:       [[1.00, 0.18], [0.95, 0.26], [0.90, 0.34], [0.85, 0.42], [0.80, 0.50], [0.70, 0.64], [0.60, 0.78], [0.50, 0.92], [0.40, 1.06], [0.30, 1.20]],
  row:       [[1.00, 0.22], [0.95, 0.30], [0.90, 0.38], [0.85, 0.46], [0.80, 0.54], [0.70, 0.68], [0.60, 0.82], [0.50, 0.96], [0.40, 1.10], [0.30, 1.24]],
};

export interface IntentZone { pct: [number, number]; velocity: [number, number]; reps: [number, number]; idealPct: number; idealVelocity: number; }
export const INTENT_ZONES: Record<VBTIntent, IntentZone> = {
  absolute_strength: { pct: [0.90, 1.00], velocity: [0.15, 0.35], reps: [1, 3], idealPct: 0.95, idealVelocity: 0.32 },
  strength:           { pct: [0.85, 0.95], velocity: [0.30, 0.50], reps: [3, 5], idealPct: 0.90, idealVelocity: 0.40 },
  power_heavy:        { pct: [0.70, 0.85], velocity: [0.50, 0.75], reps: [3, 5], idealPct: 0.80, idealVelocity: 0.60 },
  power_light:        { pct: [0.40, 0.60], velocity: [0.90, 1.30], reps: [5, 8], idealPct: 0.50, idealVelocity: 1.05 },
  hypertrophy:        { pct: [0.60, 0.80], velocity: [0.60, 0.90], reps: [6, 12], idealPct: 0.72, idealVelocity: 0.70 },
  speed:              { pct: [0.30, 0.50], velocity: [1.20, 1.60], reps: [5, 8], idealPct: 0.40, idealVelocity: 1.35 },
};

export type VelocityLossThreshold = 10 | 20 | 25 | 40;
export const VL_THRESHOLDS: Record<string, VelocityLossThreshold> = {
  power: 10, strength: 20, hypertrophy: 25, metabolic: 40,
};

function round2(v: number): number { return Math.round(v * 100) / 100; }
function round1(v: number): number { return Math.round(v * 10) / 10; }

/** Скорость для %1RM (интерполяция LVP). */
export function velocityForPct(lift: VBTLift, pct1RM: number): number {
  const tbl = LOAD_VELOCITY_PROFILE[lift] || LOAD_VELOCITY_PROFILE.squat;
  const p = Math.max(0.3, Math.min(1, pct1RM));
  if (p >= tbl[0][0]) return tbl[0][1];
  if (p <= tbl[tbl.length - 1][0]) return tbl[tbl.length - 1][1];
  for (let i = 0; i < tbl.length - 1; i++) {
    const [p1, v1] = tbl[i], [p2, v2] = tbl[i + 1]; // p1>p2, v1<v2
    if (p <= p1 && p >= p2) return v1 + (v2 - v1) * (p - p1) / (p2 - p1);
  }
  return 0.5;
}

/** Обратная функция: %1RM для скорости. */
export function pctForVelocity(lift: VBTLift, velocity: number): number {
  const tbl = LOAD_VELOCITY_PROFILE[lift] || LOAD_VELOCITY_PROFILE.squat;
  if (velocity <= tbl[0][1]) return tbl[0][0];
  if (velocity >= tbl[tbl.length - 1][1]) return tbl[tbl.length - 1][0];
  for (let i = 0; i < tbl.length - 1; i++) {
    const [p1, v1] = tbl[i], [p2, v2] = tbl[i + 1]; // v1<v2, p1>p2
    if (velocity >= v1 && velocity <= v2) return p1 + (p2 - p1) * (velocity - v1) / (v2 - v1);
  }
  return 0.5;
}

/** Целевая скорость для интента. */
export function targetVelocity(intent: VBTIntent): { min: number; max: number; ideal: number } {
  const z = INTENT_ZONES[intent];
  return { min: z.velocity[0], max: z.velocity[1], ideal: z.idealVelocity };
}

/** Целевой %1RM для интента. */
export function targetPct(intent: VBTIntent): number { return INTENT_ZONES[intent].idealPct; }

/** Рабочий вес под целевую скорость/процент (кг). */
export function loadForPct(e1RM: number, pct1RM: number): number {
  return Math.round(e1RM * Math.max(0.3, Math.min(1, pct1RM)) * 10) / 10;
}

/** e1RM по скорости штанги и поднятому весу (через LVP). */
export function estimate1RMFromVelocity(lift: VBTLift, velocity: number, weight: number): { e1RM: number; pct1RM: number } {
  if (velocity <= 0 || weight <= 0) return { e1RM: 0, pct1RM: 0 };
  const pct = pctForVelocity(lift, velocity);
  if (pct <= 0) return { e1RM: 0, pct1RM: 0 };
  return { e1RM: round1(weight / pct), pct1RM: round2(pct) };
}

export interface VelocityLossResult {
  bestVelocity: number;   // макс скорость за сет
  lastVelocity: number;   // скорость последнего повтора
  lossPct: number;         // (best - last) / best × 100
  threshold: VelocityLossThreshold;
  exceeded: boolean;
  remainingReps: number | null; // оценка оставшихся повторов до порога (null если уже превышен/нельзя оценить)
}

/** Потеря скорости по сессии (массив скоростей повторов) + решение об окончании сета. */
export function velocityLoss(velocities: number[], threshold: VelocityLossThreshold = 20): VelocityLossResult | null {
  const vs = velocities.filter(v => v > 0);
  if (vs.length === 0) return null;
  const best = Math.max(...vs);
  const last = vs[vs.length - 1];
  const lossPct = best > 0 ? Math.round(((best - last) / best) * 1000) / 10 : 0;
  const exceeded = lossPct >= threshold;
  let remainingReps: number | null = null;
  if (!exceeded && vs.length >= 2) {
    // линейная оценка: средняя потеря на повтор
    const perRepLoss = lossPct / Math.max(1, vs.length - 1);
    const budget = threshold - lossPct;
    remainingReps = perRepLoss > 0 ? Math.max(0, Math.floor(budget / perRepLoss)) : 99;
  }
  return { bestVelocity: round2(best), lastVelocity: round2(last), lossPct, threshold, exceeded, remainingReps };
}

/** Подобрать порог потери скорости под intent. */
export function thresholdForIntent(intent: VBTIntent): VelocityLossThreshold {
  if (intent === 'absolute_strength' || intent === 'strength') return 20;
  if (intent === 'power_heavy' || intent === 'power_light' || intent === 'speed') return 10;
  if (intent === 'hypertrophy') return 25;
  return 20;
}

/** Зона потери скорости (label). */
export function velocityLossZone(lossPct: number): string {
  if (lossPct < 10) return 'скорость стабильна — можно добавить повторов';
  if (lossPct < 20) return 'зона силы — ЦНС готова';
  if (lossPct < 25) return 'зона гипертрофии — метаболический стресс';
  if (lossPct < 40) return 'зона метаболического стресса';
  return 'превышение — стоп, отказ близко';
}

import type { Lift, WeakPoint } from '../lms/weakpoint-pl';

/** Фаза максимального момента (бар замедляется сильнее всего) — кандидат при высокой потере скорости. */
const VELOCITY_STICKING_PHASE: Record<Lift, WeakPoint> = {
  bench: 'off_chest', squat: 'bottom', deadlift: 'start',
  ohp: 'ohp_start', row: 'row_start', pulldown: 'pd_top', incline_press: 'inc_off',
  sumo: 'sumo_start', biceps: 'biceps_start',
};

export interface VelocityDiagnosis {
  lossPct: number;
  zone: string;
  exceeded: boolean;
  /** Вероятная фаза срыва при превышении порога (фаза максимального момента), иначе null. */
  suggestedPhase: WeakPoint | null;
  /** e1RM по скорости (если заданы вес и скорость), иначе null. */
  e1RMByVelocity: number | null;
}

/**
 * Диагностика по ручному вводу скорости штанги (VBT): скорость лучшего и
 * последнего повтора (м/с) → потеря скорости → зона/отказ → вероятная фаза
 * срыва (максимальный момент) + e1RM по скорости (опционально вес).
 * Чистая функция — не трогает план/цикл.
 */
export function diagnoseVelocity(
  lift: Lift,
  bestVelocity: number,
  lastVelocity: number,
  weightKg?: number,
  threshold: VelocityLossThreshold = 20,
): VelocityDiagnosis {
  const vl = velocityLoss([bestVelocity, lastVelocity], threshold);
  const lossPct = vl?.lossPct ?? 0;
  const exceeded = !!vl?.exceeded;
  // LVP есть для squat/bench/deadlift/ohp/row; pulldown→row (вертикальная тяга),
  // incline_press→bench (жимовый паттерн), sumo→deadlift (тяговый паттерн),
  // biceps→row (сгибательный паттерн) — ближайшие профили.
  const vbtLift: VBTLift = lift === 'pulldown' ? 'row' : lift === 'incline_press' ? 'bench'
    : lift === 'sumo' ? 'deadlift' : lift === 'biceps' ? 'row' : lift;
  let e1RMByVelocity: number | null = null;
  if (weightKg && weightKg > 0 && lastVelocity > 0) {
    e1RMByVelocity = estimate1RMFromVelocity(vbtLift, lastVelocity, weightKg).e1RM || null;
  }
  return {
    lossPct,
    zone: velocityLossZone(lossPct),
    exceeded,
    suggestedPhase: exceeded ? (VELOCITY_STICKING_PHASE[lift] ?? null) : null,
    e1RMByVelocity,
  };
}
