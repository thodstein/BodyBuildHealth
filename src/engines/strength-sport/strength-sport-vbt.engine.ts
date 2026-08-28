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

function mapSSLift(id: string): VBTLift {
  const low = id.toLowerCase();
  if (low.includes('snatch') || low.includes('overhead_squat') || low.includes('snatch_balance')) return 'squat';
  if (low.includes('clean') || low.includes('jerk') || low.includes('push_press')) return 'squat';
  if (low.includes('squat') || low.includes('front_squat') || low.includes('hack')) return 'squat';
  if (low.includes('deadlift') || low.includes('rdl') || low.includes('pull') || low.includes('sumo')) return 'deadlift';
  if (low.includes('press') || low.includes('ohp') || low.includes('bench') || low.includes('log')) return 'bench';
  if (low.includes('row') || low.includes('pullup')) return 'row';
  return 'squat';
}

export function velocityForSS(pct1RM: number, liftId?: string): number {
  const lift = mapSSLift(liftId || 'squat');
  return baseVelocityForPct(lift, pct1RM);
}

export function estimate1RMFromVelocitySS(weight: number, velocity: number, liftId?: string): number {
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
