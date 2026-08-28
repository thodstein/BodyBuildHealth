/**
 * combat-vbt.engine.ts — VBT для единоборств (обёртка над pro/vbt).
 * Маппит боевые движения → VBTLift (bench для жимов, squat для приседов/прыжков).
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

export type CombatLiftId = string;

function mapCombatLift(id: string): VBTLift {
  const low = id.toLowerCase();
  if (low.includes('bench') || low.includes('ohp') || low.includes('push_press') || low.includes('landmine_press')) return 'bench';
  if (low.includes('squat') || low.includes('lunge') || low.includes('step_up') || low.includes('jump')) return 'squat';
  if (low.includes('dead') || low.includes('rdl') || low.includes('trap_bar') || low.includes('pull') || low.includes('row')) return 'deadlift';
  if (low.includes('press')) return 'bench';
  return 'squat';
}

export function velocityForCombat(pct1RM: number, liftId?: string): number {
  const lift = mapCombatLift(liftId || 'squat');
  return baseVelocityForPct(lift, pct1RM);
}

export function estimate1RMFromVelocityCombat(weight: number, velocity: number, liftId?: string): number {
  const lift = mapCombatLift(liftId || 'squat');
  if (velocity <= 0 || weight <= 0) return 0;
  return baseEstimate(lift, velocity, weight).e1RM || 0;
}

export function diagnoseVelocityLossCombat(bestVel: number, lastVel: number, threshold: 20 | 10 | 25 | 40 = 20, weight?: number, liftId?: string): {
  lossPct: number; zone: string; exceeded: boolean; e1RMByVelocity: number | null; recommendation: string;
} {
  const vl = baseVelocityLoss([bestVel, lastVel], threshold as any);
  const lossPct = vl?.lossPct ?? 0;
  const exceeded = !!vl?.exceeded;
  const zone = baseZone(lossPct);
  const e1RMByVelocity = weight && weight > 0 && lastVel > 0 ? estimate1RMFromVelocityCombat(weight, lastVel, liftId) : null;
  let rec = '';
  if (lossPct > 30) rec = 'Стоп сет — ЦНС устала';
  else if (lossPct > 25) rec = 'Снизьте вес 5%, RIR+1';
  else if (lossPct > 20) rec = 'RIR+1 — контроль';
  else rec = 'Оптимально — можно добавить сет';
  return { lossPct, zone, exceeded, e1RMByVelocity, recommendation: rec };
}

export function vbtRecommendationCombat(lossPct: number): { action: string; rirAdd: number; volumeMult: number } {
  if (lossPct > 30) return { action: 'Стоп сет', rirAdd: 2, volumeMult: 0.6 };
  if (lossPct > 25) return { action: 'Снизьте вес 5% + RIR+1', rirAdd: 1, volumeMult: 0.85 };
  if (lossPct > 20) return { action: 'RIR+1', rirAdd: 1, volumeMult: 0.9 };
  return { action: 'Оптимально', rirAdd: 0, volumeMult: 1 };
}

export { thresholdForIntent };
export type { VBTIntent, VelocityLossResult };
