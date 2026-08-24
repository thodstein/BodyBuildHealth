/**
 * strength-sport-mesocycle.ts — кросс-мезоцикл прогрессия (изолировано).
 * +2.5кг к верхним ПМ при успешном предыдущем мезо, только зал.
 */
import type { StrengthSportPlan } from './strength-sport.types';
export function applyMesocycleProgression(prev: StrengthSportPlan, nextInput: any): any {
  if (!prev) return nextInput;
  const bump = 2.5;
  const wm = { ...(nextInput.workMax||{}) };
  for (const k of Object.keys(prev.workMax||{})) {
    const pv = (prev.workMax as any)[k];
    if (typeof pv==='number' && pv>0) wm[k] = Math.max(wm[k]||0, pv + bump);
  }
  return { ...nextInput, workMax: wm, previousPlanId: prev.id };
}
