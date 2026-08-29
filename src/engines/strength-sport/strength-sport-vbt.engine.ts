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

export type SSLiftId = string; // snatch, clean_and_jerk, back_squat, deadlift, log_press, yoke_walk etc

// PRO: отдельный LVP для ТА — скорости сильно выше из-за взрывного характера (Gonzalez-Badillo адаптация ТА)
export const LOAD_VELOCITY_PROFILE_SS: Record<string, Array<readonly [number, number]>> = {
  snatch: [[1.00, 0.85], [0.95, 0.95], [0.90, 1.05], [0.85, 1.15], [0.80, 1.25], [0.70, 1.40], [0.60, 1.55], [0.50, 1.70]],
  clean: [[1.00, 0.60], [0.95, 0.70], [0.90, 0.80], [0.85, 0.90], [0.80, 1.00], [0.70, 1.15], [0.60, 1.30], [0.50, 1.45]],
  squat: [[1.00, 0.30], [0.95, 0.40], [0.90, 0.47], [0.85, 0.55], [0.80, 0.60], [0.70, 0.75], [0.60, 0.87], [0.50, 1.00]],
  deadlift: [[1.00, 0.20], [0.95, 0.28], [0.90, 0.37], [0.85, 0.44], [0.80, 0.50], [0.70, 0.62], [0.60, 0.77], [0.50, 0.92]],
  bench: [[1.00, 0.16], [0.95, 0.24], [0.90, 0.33], [0.85, 0.40], [0.80, 0.47], [0.70, 0.60], [0.60, 0.75], [0.50, 0.90]],
  row: [[1.00, 0.22], [0.95, 0.30], [0.90, 0.38], [0.85, 0.46], [0.80, 0.54], [0.70, 0.68], [0.60, 0.82], [0.50, 0.96]],
};

function velocityForPctSSLocal(lift: string, pct: number): number {
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
  // ТА — отдельный профиль, но мапим к ближайшему VBTLift для base функций где нужно
  if (low.includes('snatch') || low.includes('overhead_squat') || low.includes('snatch_balance')) return 'squat';
  if (low.includes('clean') || low.includes('jerk') || low.includes('push_press')) return 'squat';
  if (low.includes('squat') || low.includes('front_squat') || low.includes('hack')) return 'squat';
  if (low.includes('deadlift') || low.includes('rdl') || low.includes('pull') || low.includes('sumo')) return 'deadlift';
  if (low.includes('press') || low.includes('ohp') || low.includes('bench') || low.includes('log')) return 'bench';
  if (low.includes('row') || low.includes('pullup')) return 'row';
  return 'squat';
}
function mapSSLiftLocal(id: string): string {
  const low = id.toLowerCase();
  if (low.includes('snatch') || low.includes('overhead_squat') || low.includes('snatch_balance')) return 'snatch';
  if (low.includes('clean') || low.includes('jerk')) return 'clean';
  if (low.includes('squat') || low.includes('front_squat') || low.includes('hack')) return 'squat';
  if (low.includes('deadlift') || low.includes('rdl') || low.includes('pull') || low.includes('sumo')) return 'deadlift';
  if (low.includes('press') || low.includes('ohp') || low.includes('bench') || low.includes('log')) return 'bench';
  if (low.includes('row') || low.includes('pullup')) return 'row';
  return 'squat';
}

export function velocityForSS(pct1RM: number, liftId?: string): number {
  const local = mapSSLiftLocal(liftId || 'squat');
  if (local === 'snatch' || local === 'clean') return velocityForPctSSLocal(local, pct1RM);
  const lift = mapSSLift(liftId || 'squat');
  return baseVelocityForPct(lift, pct1RM);
}

export function estimate1RMFromVelocitySS(weight: number, velocity: number, liftId?: string): number {
  const local = mapSSLiftLocal(liftId || 'squat');
  if (local === 'snatch' || local === 'clean') {
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

export function vbtRecommendationSS(lossPct: number): { action: string; rirAdd: number; volumeMult: number } {
  if (lossPct > 30) return { action: 'Стоп сет', rirAdd: 2, volumeMult: 0.6 };
  if (lossPct > 25) return { action: 'RIR+1, объём ×0.85', rirAdd: 1, volumeMult: 0.85 };
  if (lossPct > 20) return { action: 'RIR+1', rirAdd: 1, volumeMult: 0.9 };
  return { action: 'Оптимально', rirAdd: 0, volumeMult: 1 };
}

export { thresholdForIntent };
export type { VBTIntent, VelocityLossResult };
