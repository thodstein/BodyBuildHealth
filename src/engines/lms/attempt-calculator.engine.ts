/**
 * attempt-calculator.engine.ts — расчёт попыток с учётом velocity (MVT 0.15-0.25) + RPE
 * Opener 0.35-0.40 м/с (уверенно), Second 0.28-0.33, Third ~MVT
 */
import { mvtForLift, pctForVelocity, velocityForPct } from '../pro/vbt.engine';
import type { VBTLift } from '../pro/vbt.engine';

export type AttemptSet = { weight: number; velocity: number; pct: number; note: string };

export function velocityAttempts(e1RM: number, lift: VBTLift, strategy: 'conservative'|'balanced'|'aggressive' = 'balanced'): { opener: AttemptSet; second: AttemptSet; third: AttemptSet } {
  const mvt = mvtForLift(lift);
  const openerV = 0.37; // 0.35-0.40
  const secondV = strategy === 'conservative' ? 0.33 : strategy === 'aggressive' ? 0.28 : 0.30;
  const thirdV = mvt + 0.02; // чуть выше MVT

  const openerPct = pctForVelocity(lift, openerV);
  const secondPct = pctForVelocity(lift, secondV);
  const thirdPct = pctForVelocity(lift, thirdV);

  const r = (v: number) => Math.round(v * 10) / 10;
  const opener = { weight: r(e1RM * openerPct), velocity: openerV, pct: Math.round(openerPct * 1000)/10, note: 'Opener 0.35-0.40 м/с — уверенно, тройник на любой день' };
  const second = { weight: r(e1RM * secondPct), velocity: secondV, pct: Math.round(secondPct * 1000)/10, note: 'Second 0.28-0.33 м/с — солидный сингл, запас на третью' };
  const third = { weight: r(e1RM * thirdPct), velocity: thirdV, pct: Math.round(thirdPct * 1000)/10, note: `Third ~MVT ${mvt.toFixed(2)}+0.02 — около отказа, по скорости последней трен. нед` };
  return { opener, second, third };
}

export function rpeAttempts(e1RM: number, strategy: 'conservative'|'balanced'|'aggressive' = 'balanced'): { opener: number; second: number; third: number } {
  const opener = Math.round(e1RM * (strategy === 'aggressive' ? 0.92 : 0.90) * 10)/10;
  const second = Math.round(e1RM * (strategy === 'aggressive' ? 0.98 : strategy === 'conservative' ? 0.95 : 0.97) *10)/10;
  const third = Math.round(e1RM * (strategy === 'aggressive' ? 1.03 : strategy === 'conservative' ? 1.00 : 1.02) *10)/10;
  return { opener, second, third };
}
