/**
 * combat-intensity.ts — изолированные техники для единоборств.
 * rest-pause для аксессуаров: последний сет до отказа с паузой 15с.
 */
import type { CombatPlan } from './combat.types';

export type CombatIntensity = 'none' | 'rest_pause';

export function applyCombatIntensity(plan: CombatPlan, tech: CombatIntensity = 'none'): CombatPlan {
  if (tech === 'none') return plan;
  for (const wk of plan.weeksData) {
    if (wk.deload) continue;
    for (const sess of wk.sessions) {
      for (const ex of sess.exercises) {
        if (ex.role === 'accessory' && tech === 'rest_pause') {
          ex.comment = (ex.comment ? ex.comment + ' | ' : '') + 'Rest-pause: последний сет до RIR0 +15с';
          ex.workSets = ex.workSets.map((s, idx, arr) => idx === arr.length - 1 ? { ...s, rir: 0 } : s);
        }
      }
    }
  }
  plan.rationale.push(`Combat intensity ${tech}`);
  return plan;
}
