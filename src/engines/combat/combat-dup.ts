/**
 * combat-dup.ts — изолированный DUP для единоборств.
 * Power дни — тяж (3-6 повт, RIR 1-2), conditioning — лёг (8-12, RIR 3).
 */
import type { CombatPlan } from './combat.types';

export type CombatDUP = 'off' | 'power_endurance';

export function applyCombatDUP(plan: CombatPlan, mode: CombatDUP = 'power_endurance'): CombatPlan {
  if (mode === 'off') return plan;
  for (const wk of plan.weeksData) {
    if (wk.deload) continue;
    for (const sess of wk.sessions) {
      const isPower = sess.sessionTag.includes('power');
      for (const ex of sess.exercises) {
        if (isPower) {
          ex.rir = Math.max(1, ex.rir - 1);
        } else {
          ex.rir = Math.min(4, ex.rir + 1);
          ex.workSets = ex.workSets.map(s => ({ ...s, reps: s.reps + 1 }));
        }
      }
    }
  }
  plan.rationale.push(`Combat DUP ${mode}`);
  return plan;
}
