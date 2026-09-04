/**
 * strength-sport-vbt.engine.ts — VBT для ТА/стронга (тонкая обёртка над pro/vbt.engine).
 * Добавляет маппинг ТА/стронг-упражнений → VBTLift и оценку потери скорости для зала.
 * Изолировано — не трогает pro.
 */
import {
  velocityForPct as baseVelocityForPct,
  pctForVelocity as basePctForVelocity,
  estimate1RMFromVelocity as baseEstimate,
  velocityLoss as baseVelocityLoss,
  velocityLossZone as baseZone,
  thresholdForIntent,
  type VBTLift,
  type VBTIntent,
  type VelocityLossResult,
} from '../pro/vbt.engine';
import { loadLVPProfile, velocityForLVP, pctForVelocityLVP, estimate1RMLVP } from './strength-sport-lvp-calibration.engine';

export type SSLiftId = string; // snatch, clean_and_jerk, back_squat, deadlift, log_press, yoke_walk etc

// PRO: отдельный LVP для ТА — скорости сильно выше из-за взрывного характера (Gonzalez-Badillo адаптация ТА)
// PRO Strongman carry: скорость ходьбы, не штанга — отдельные пороги (Hindle stride 1.83м)
export const LOAD_VELOCITY_PROFILE_SS: Record<string, Array<readonly [number, number]>> = {
  // PEAK velocity (Wood 2026 Perch) — absolute >80% >1.30 м/с, не mean (Gonzalez-Badillo). Индивидуальная калибровка атлета рекомендуется.
  snatch: [[1.00, 1.30], [0.95, 1.42], [0.90, 1.55], [0.85, 1.68], [0.80, 1.80], [0.70, 2.00], [0.60, 2.30], [0.50, 2.70]],
  clean: [[1.00, 1.30], [0.95, 1.38], [0.90, 1.48], [0.85, 1.58], [0.80, 1.68], [0.70, 1.85], [0.60, 2.05], [0.50, 2.30]],
  squat: [[1.00, 0.30], [0.95, 0.40], [0.90, 0.47], [0.85, 0.55], [0.80, 0.60], [0.70, 0.75], [0.60, 0.87], [0.50, 1.00]],
  deadlift: [[1.00, 0.20], [0.95, 0.28], [0.90, 0.37], [0.85, 0.44], [0.80, 0.50], [0.70, 0.62], [0.60, 0.77], [0.50, 0.92]],
  bench: [[1.00, 0.16], [0.95, 0.24], [0.90, 0.33], [0.85, 0.40], [0.80, 0.47], [0.70, 0.60], [0.60, 0.75], [0.50, 0.90]],
  row: [[1.00, 0.22], [0.95, 0.30], [0.90, 0.38], [0.85, 0.46], [0.80, 0.54], [0.70, 0.68], [0.60, 0.82], [0.50, 0.96]],
  // Strongman carry: скорость ходьбы м/с at % BW-equivalent
  yoke_walk: [[1.00, 0.90], [0.90, 1.10], [0.80, 1.30], [0.70, 1.50], [0.60, 1.70], [0.50, 1.90]],
  farmers_walk: [[1.00, 1.00], [0.90, 1.20], [0.80, 1.40], [0.70, 1.60], [0.60, 1.80], [0.50, 2.00]],
  stone_load: [[1.00, 0.35], [0.90, 0.45], [0.80, 0.55], [0.70, 0.68], [0.60, 0.80], [0.50, 0.95]],
  log_press: [[1.00, 0.20], [0.90, 0.32], [0.80, 0.44], [0.70, 0.58], [0.60, 0.72], [0.50, 0.88]],
};

// VBT thresholds для стронга (скорость ходьбы / lap)
export const VBT_SS_THRESHOLDS: Record<string, { optimalMin: number; stopMin: number }> = {
  yoke_walk: { optimalMin: 1.30, stopMin: 1.00 },
  farmers_walk_heavy: { optimalMin: 1.40, stopMin: 1.10 },
  atlas_stone_load: { optimalMin: 0.45, stopMin: 0.30 },
  log_press: { optimalMin: 0.32, stopMin: 0.20 },
};

// ── PRO V2: Peak-velocity зоны для ТА (PLOS ONE 2026; peak velocity, не mean) ──
// Все absolute strength (>80%) >1.3 м/с (generic startingStrength порог невалиден)
// Источники: Wood et al. 2026 load-velocity profiles 7 derivatives, Perch peak velocity
export interface TAVelocityZone { pct: [number, number]; velocity: [number, number]; label: string; }
export const TA_PEAK_VELOCITY_ZONES: Record<string, TAVelocityZone[]> = {
  snatch: [
    { pct: [0, 0.25], velocity: [2.70, 3.20], label: 'starting_strength' },
    { pct: [0.25, 0.45], velocity: [2.30, 2.70], label: 'speed_strength' },
    { pct: [0.45, 0.65], velocity: [1.90, 2.30], label: 'strength_speed' },
    { pct: [0.65, 0.80], velocity: [1.55, 1.90], label: 'accelerative_strength' },
    { pct: [0.80, 1.00], velocity: [1.30, 1.75], label: 'absolute_strength' },
  ],
  clean: [
    { pct: [0, 0.25], velocity: [2.40, 2.90], label: 'starting_strength' },
    { pct: [0.25, 0.45], velocity: [2.00, 2.40], label: 'speed_strength' },
    { pct: [0.45, 0.65], velocity: [1.70, 2.00], label: 'strength_speed' },
    { pct: [0.65, 0.80], velocity: [1.45, 1.70], label: 'accelerative_strength' },
    { pct: [0.80, 1.00], velocity: [1.30, 1.55], label: 'absolute_strength' },
  ],
  // ТА-тяги: ниже рывка, но выше приседа
  snatch_pull: [
    { pct: [0, 0.25], velocity: [2.20, 2.60], label: 'starting_strength' },
    { pct: [0.25, 0.45], velocity: [1.90, 2.20], label: 'speed_strength' },
    { pct: [0.45, 0.65], velocity: [1.60, 1.90], label: 'strength_speed' },
    { pct: [0.65, 0.80], velocity: [1.35, 1.60], label: 'accelerative_strength' },
    { pct: [0.80, 1.00], velocity: [1.10, 1.35], label: 'absolute_strength' },
  ],
};

// VTHRES нормы (Sandau): snatch 1.70-2.00, clean 1.40-1.70
export const TA_VTHRES_NORMS: Record<string, { min: number; max: number; optimal: number }> = {
  snatch: { min: 1.70, max: 2.00, optimal: 1.85 },
  clean: { min: 1.40, max: 1.70, optimal: 1.55 },
  jerk: { min: 1.20, max: 1.50, optimal: 1.35 },
};

// E10: женские нормы пика (PoinT GO 2026: рывок 1.5–1.8, взятие 1.3–1.6; толчок — оценка по пропорции)
export const TA_VTHRES_NORMS_F: Record<string, { min: number; max: number; optimal: number }> = {
  snatch: { min: 1.50, max: 1.80, optimal: 1.65 },
  clean: { min: 1.30, max: 1.60, optimal: 1.45 },
  jerk: { min: 1.10, max: 1.40, optimal: 1.25 },
};

/** Нормы vThres по полу (дефолт M). */
export function taVthresNorms(sex?: string | null): Record<string, { min: number; max: number; optimal: number }> {
  return sex === 'female' ? TA_VTHRES_NORMS_F : TA_VTHRES_NORMS;
}

export function taZoneForVelocity(velocity: number, exercise: string): string {
  const zones = TA_PEAK_VELOCITY_ZONES[exercise] || TA_PEAK_VELOCITY_ZONES.snatch;
  for (const z of zones) if (velocity >= z.velocity[0] && velocity <= z.velocity[1]) return z.label;
  if (velocity > zones[0].velocity[1]) return zones[0].label;
  if (velocity < zones[zones.length - 1].velocity[0]) return zones[zones.length - 1].label;
  return 'unknown';
}

export function taTargetVelocity(exercise: string, intensity: 'starting_strength' | 'speed_strength' | 'strength_speed' | 'accelerative_strength' | 'absolute_strength'): [number, number] | null {
  const zones = TA_PEAK_VELOCITY_ZONES[exercise];
  if (!zones) return null;
  const z = zones.find(v => v.label === intensity);
  return z ? z.velocity : null;
}

// ── FvR2 модель Sandau: snatch pull 80%/110% + vThres → snatchTh ±1.5кг ──
export interface FvR2Input { load80: number; vmax80: number; load110: number; vmax110: number; hAcc: number; vThres: number; }
export interface FvR2Result { v0: number; F0: number; Pmax: number; slope: number; Fthres: number; snatchTh: number; sFv: number; }

export function computeFvR2(input: FvR2Input): FvR2Result | null {
  const { load80, vmax80, load110, vmax110, hAcc, vThres } = input;
  if (!load80 || !load110 || !vmax80 || !vmax110 || !hAcc || hAcc <= 0 || !vThres) return null;
  if (vmax80 <= vmax110) return null; // при большем весе скорость должна падать
  // Средние силы по Samozino-подобной оценке: F = m*g + m*v²/(2*h)
  const g = 9.81;
  const F80 = load80 * g + (load80 * vmax80 * vmax80) / (2 * hAcc);
  const F110 = load110 * g + (load110 * vmax110 * vmax110) / (2 * hAcc);
  const slope = (F110 - F80) / (vmax110 - vmax80); // отрицательный
  if (!Number.isFinite(slope) || slope >= 0) return null;
  const F0 = F80 - slope * vmax80;
  const v0 = -F0 / slope;
  const Pmax = (F0 * v0) / 4;
  const Fthres = F0 + slope * vThres;
  // snatchTh: решить Fthres = m*g + m*vThres²/(2*hAcc) => m = Fthres / (g + vThres²/(2*hAcc))
  const denom = g + (vThres * vThres) / (2 * hAcc);
  const snatchTh = denom > 0 ? Math.round((Fthres / denom) * 10) / 10 : 0;
  const sFv = slope; // наклон FvR (оптимум ищется отдельно)
  return { v0: Math.round(v0 * 100) / 100, F0: Math.round(F0), Pmax: Math.round(Pmax), slope: Math.round(slope * 100) / 100, Fthres: Math.round(Fthres), snatchTh, sFv: Math.round(sFv * 100) / 100 };
}

export function optimalFvSlopeForPmax(Pmax: number): number {
  // Чем выше Pmax, тем более force-доминантный оптимум (Sandau Fig2)
  // Эмпирическая: slope_opt ≈ -0.8 - Pmax/8000
  if (Pmax < 2000) return -1.0;
  if (Pmax < 3000) return -1.2;
  return -1.5;
}

function velocityForPctSSLocal(lift: string, pct: number): number {
  // индивидуальный LVP приоритетнее population
  try {
    const indiv = loadLVPProfile(lift);
    if (indiv && indiv.valid) {
      const v = velocityForLVP(indiv, pct);
      if (v != null) return v;
    }
  } catch {}
  const tbl = LOAD_VELOCITY_PROFILE_SS[lift] || LOAD_VELOCITY_PROFILE_SS.squat;
  const p = Math.max(0.5, Math.min(1, pct));
  if (p >= tbl[0][0]) return tbl[0][1];
  if (p <= tbl[tbl.length - 1][0]) return tbl[tbl.length - 1][1];
  for (let i = 0; i < tbl.length - 1; i++) {
    const [p1, v1] = tbl[i], [p2, v2] = tbl[i + 1];
    if (p <= p1 && p >= p2) return v1 + (v2 - v1) * (p - p1) / (p2 - p1);
  }
  return 0.5;
}
function pctForVelocitySSLocal(lift: string, vel: number): number {
  try {
    const indiv = loadLVPProfile(lift);
    if (indiv && indiv.valid) {
      const pct = pctForVelocityLVP(indiv, vel);
      if (pct != null) return pct;
    }
  } catch {}
  const tbl = LOAD_VELOCITY_PROFILE_SS[lift] || LOAD_VELOCITY_PROFILE_SS.squat;
  if (vel <= tbl[0][1]) return tbl[0][0];
  if (vel >= tbl[tbl.length - 1][1]) return tbl[tbl.length - 1][0];
  for (let i = 0; i < tbl.length - 1; i++) {
    const [p1, v1] = tbl[i], [p2, v2] = tbl[i + 1];
    if (vel >= v1 && vel <= v2) return p1 + (p2 - p1) * (vel - v1) / (v2 - v1);
  }
  return 0.5;
}

function mapSSLift(id: string): VBTLift {
  const low = id.toLowerCase();
  // Strongman carries: используем deadlift как ближайший по нагрузке для base, но локально есть свои tbl
  if (low.includes('yoke') || low.includes('farmers') || low.includes('carry') || low.includes('conan') || low.includes('shield') || low.includes('truck') || low.includes('sled')) return 'deadlift';
  if (low.includes('stone') || low.includes('sandbag') || low.includes('keg')) return 'deadlift';
  if (low.includes('snatch') || low.includes('overhead_squat') || low.includes('snatch_balance')) return 'squat';
  if (low.includes('clean') || low.includes('jerk') || low.includes('push_press')) return 'squat';
  if (low.includes('squat') || low.includes('front_squat') || low.includes('hack')) return 'squat';
  if (low.includes('deadlift') || low.includes('rdl') || low.includes('pull') || low.includes('sumo')) return 'deadlift';
  if (low.includes('press') || low.includes('ohp') || low.includes('bench') || low.includes('log') || low.includes('viking') || low.includes('circus')) return 'bench';
  if (low.includes('row') || low.includes('pullup')) return 'row';
  return 'squat';
}
function mapSSLiftLocal(id: string): string {
  const low = id.toLowerCase();
  if (low.includes('yoke_walk')) return 'yoke_walk';
  if (low.includes('farmers')) return 'farmers_walk';
  if (low.includes('stone') || low.includes('sandbag') || low.includes('keg') || low.includes('conan') || low.includes('shield')) return 'stone_load';
  if (low.includes('snatch') || low.includes('overhead_squat') || low.includes('snatch_balance')) return 'snatch';
  if (low.includes('clean') || low.includes('jerk')) return 'clean';
  if (low.includes('squat') || low.includes('front_squat') || low.includes('hack')) return 'squat';
  if (low.includes('deadlift') || low.includes('rdl') || low.includes('pull') || low.includes('sumo') || low.includes('truck') || low.includes('sled')) return 'deadlift';
  if (low.includes('press') || low.includes('ohp') || low.includes('bench') || low.includes('log') || low.includes('viking') || low.includes('circus')) return 'log_press';
  if (low.includes('row') || low.includes('pullup')) return 'row';
  return 'squat';
}

export function velocityForSS(pct1RM: number, liftId?: string): number {
  const local = mapSSLiftLocal(liftId || 'squat');
  if (local === 'snatch' || local === 'clean' || local === 'yoke_walk' || local === 'farmers_walk' || local === 'stone_load' || local === 'log_press') return velocityForPctSSLocal(local, pct1RM);
  const lift = mapSSLift(liftId || 'squat');
  return baseVelocityForPct(lift, pct1RM);
}

export function estimate1RMFromVelocitySS(weight: number, velocity: number, liftId?: string): number {
  // индивидуальный LVP приоритетнее
  try {
    const local = mapSSLiftLocal(liftId || 'squat');
    const indiv = loadLVPProfile(local);
    if (indiv && indiv.valid) {
      const e1 = estimate1RMLVP(indiv, weight, velocity);
      if (e1 != null && e1 > 0) return e1;
    }
    if (liftId) {
      const indiv2 = loadLVPProfile(String(liftId).toLowerCase());
      if (indiv2 && indiv2.valid && indiv2.lift !== local) {
        const e1c = estimate1RMLVP(indiv2, weight, velocity);
        if (e1c != null && e1c > 0) return e1c;
      }
    }
  } catch {}
  const local = mapSSLiftLocal(liftId || 'squat');
  if (local === 'snatch' || local === 'clean' || local === 'yoke_walk' || local === 'farmers_walk' || local === 'stone_load' || local === 'log_press') {
    if (velocity <= 0 || weight <= 0) return 0;
    const pct = pctForVelocitySSLocal(local, velocity);
    return pct > 0 ? Math.round((weight / pct) * 10) / 10 : 0;
  }
  const lift = mapSSLift(liftId || 'squat');
  if (velocity <= 0 || weight <= 0) return 0;
  return baseEstimate(lift, velocity, weight).e1RM || 0;
}

export function diagnoseVelocityLossSS(bestVel: number, lastVel: number, threshold: 20 | 10 | 25 | 40 = 20, weight?: number, liftId?: string): {
  lossPct: number; zone: string; exceeded: boolean; e1RMByVelocity: number | null; recommendation: string;
} {
  const vl = baseVelocityLoss([bestVel, lastVel], threshold as any);
  const lossPct = vl?.lossPct ?? 0;
  const exceeded = !!vl?.exceeded;
  const zone = baseZone(lossPct);
  const e1RMByVelocity = weight && weight > 0 && lastVel > 0 ? estimate1RMFromVelocitySS(weight, lastVel, liftId) : null;
  let rec = '';
  if (lossPct > 30) rec = 'Стоп сет — потеря >30%';
  else if (lossPct > 25) rec = 'RIR+1, объём ×0.85';
  else if (lossPct > 20) rec = 'RIR+1';
  else rec = 'В пределах — можно +1 сет';
  return { lossPct, zone, exceeded, e1RMByVelocity, recommendation: rec };
}

export function vbtRecommendationSS(lossPct: number, liftId?: string): { action: string; rirAdd: number; volumeMult: number } {
  // Для ТА взрывные: пороги строже 10%/20% (power vs strength), для силы — 20%/30%
  const isTA = liftId ? /snatch|jerk|clean|power/.test(liftId.toLowerCase()) : false;
  const warn = isTA ? 10 : 20;
  const crit = isTA ? 20 : 30;
  if (lossPct > crit) return { action: 'Стоп сет', rirAdd: 2, volumeMult: 0.6 };
  if (lossPct > warn + 5) return { action: 'RIR+1, объём ×0.85', rirAdd: 1, volumeMult: 0.85 };
  if (lossPct > warn) return { action: 'RIR+1', rirAdd: 1, volumeMult: 0.9 };
  return { action: 'Оптимально', rirAdd: 0, volumeMult: 1 };
}

/**
 * Порог потери для ТА: 10% для power (рывок/толчок), 15% для тяг
 */
export function thresholdForTALift(liftId: string): 10 | 15 | 20 {
  const low = liftId.toLowerCase();
  if (low.includes('pull') || low.includes('squat')) return 15;
  if (low.includes('snatch') || low.includes('jerk') || low.includes('clean')) return 10;
  return 20;
}

// ── P0-2: EWMA per-lift VBT closed-loop + MPV/Peak badge ──
export const LVP_VELOCITY_TYPE: Record<string, 'peak' | 'mpv'> = {
  snatch: 'peak',
  clean: 'peak',
  yoke_walk: 'peak',
  farmers_walk: 'peak',
  stone_load: 'mpv',
  log_press: 'mpv',
  squat: 'mpv',
  deadlift: 'mpv',
  bench: 'mpv',
  row: 'mpv',
};

export function velocityTypeForLift(lift: string): 'peak' | 'mpv' {
  return (LVP_VELOCITY_TYPE[lift] ?? 'mpv') as any;
}

export function vbtEwma(values: number[], alpha = 0.25): number | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  const clean = values.filter(v=> Number.isFinite(v) && v>0);
  if (clean.length === 0) return null;
  let ema = clean[0];
  for (let i=1;i<clean.length;i++) ema = alpha*clean[i] + (1-alpha)*ema;
  return Math.round(ema*100)/100;
}

export function vbtHistoryForLift(history: Record<string, number[]> | undefined, liftId: string): number[] | null {
  if (!history || !liftId) return null;
  const low = String(liftId).toLowerCase();
  // точный → локальный маппинг → all
  if (history[low] && Array.isArray(history[low])) return history[low];
  const local = mapSSLiftLocal(low);
  if (history[local] && Array.isArray(history[local])) return history[local];
  if ((history as any)['all'] && Array.isArray((history as any)['all'])) return (history as any)['all'];
  // fallback: поиск по includes
  for (const k of Object.keys(history)) {
    if (low.includes(k) || k.includes(low)) return history[k] as number[];
  }
  return null;
}

export function diagnoseVelocityLossEwma(history: number[], threshold: number = 20): { lossPct: number; ewma: number | null; exceeded: boolean; zone: string } | null {
  if (!Array.isArray(history) || history.length < 2) return null;
  const clean = history.filter(v=> Number.isFinite(v) && v>0);
  if (clean.length < 2) return null;
  const best = Math.max(...clean);
  const last = clean[clean.length-1];
  const ewmaVal = vbtEwma(clean);
  if (best <=0) return null;
  const lossPct = Math.round(((best - last)/best*100)*10)/10;
  const ewmaLoss = ewmaVal != null && best>0 ? Math.round(((best - ewmaVal)/best*100)*10)/10 : 0;
  // используем max(lossPct, ewmaLoss) для устойчивости
  const effective = Math.max(lossPct, ewmaLoss);
  const exceeded = effective > threshold;
  const zone = baseZone(effective);
  return { lossPct: effective, ewma: ewmaVal, exceeded, zone };
}

export function velocityWeightAdjustFactor(lossPct: number | null, liftId?: string): number {
  if (lossPct == null || !Number.isFinite(lossPct)) return 1;
  const isTA = liftId ? /snatch|jerk|clean/.test(liftId.toLowerCase()) : false;
  const isCarry = liftId ? /yoke|farmers|carry|conan|shield/.test(liftId.toLowerCase()) : false;
  // TA строже: >20 уже критично, carry 15/25
  const crit = isTA ? 20 : isCarry ? 25 : 30;
  const warn = isTA ? 10 : isCarry ? 15 : 20;
  if (lossPct > crit) return 0.90; // -10% вес next week (k×0.6 эквивалент ~ -4% pm, вес -10% даёт deload)
  if (lossPct > warn + 5) return 0.94;
  if (lossPct > warn) return 0.97;
  return 1;
}

export { thresholdForIntent };
export type { VBTIntent, VelocityLossResult };
