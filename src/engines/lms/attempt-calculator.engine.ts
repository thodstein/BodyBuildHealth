/**
 * attempt-calculator.engine.ts — расчёт попыток с учётом velocity (MVT 0.15-0.25) + RPE
 * Opener 0.35-0.40 м/с (уверенно), Second 0.28-0.33, Third ~MVT
 */
import { mvtForLift, pctForVelocity, velocityForPct } from '../pro/vbt.engine';
import type { VBTLift } from '../pro/vbt.engine';
import { MEET_STRATEGY_PCT } from './competition-attempts';

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

/**
 * Попытки по стратегии — КАНОН `MEET_STRATEGY_PCT` (competition-attempts):
 * conservative 90/95.5/100, balanced 92/96/102, aggressive 93/97/105.
 * Раньше здесь жил третий набор 90/95/100 · 90/97/102 · 92/98/103 — расхождение
 * с планом/прикидами устранено (аудит P2).
 */
export function rpeAttempts(e1RM: number, strategy: 'conservative'|'balanced'|'aggressive' = 'balanced'): { opener: number; second: number; third: number } {
  const pct = MEET_STRATEGY_PCT[strategy];
  const r = (x: number) => Math.round(e1RM * x * 10) / 10;
  return { opener: r(pct.opener), second: r(pct.second), third: r(pct.third) };
}
