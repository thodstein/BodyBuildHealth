/**
 * strength-sport-dup.ts — изолированный DUP (Daily Undulating Periodization) для ТА/стронга.
 * Тяж/лёг волны внутри недели: нечётные сессии — тяж (RIR 0-1, 1-3 повт), чётные — лёг (RIR 2-3, 3-6).
 * Только зал, не трогает outside.
 */
import type { StrengthSportPlan } from './strength-sport.types';

export type DUPMode = 'off' | 'heavy_light' | 'wave';

export function applyDUP(plan: StrengthSportPlan, mode: DUPMode = 'heavy_light'): StrengthSportPlan {
  if (mode === 'off') return plan;
  for (const wk of plan.weeksData) {
    if (wk.deload) continue;
    wk.sessions.forEach((sess, idx) => {
      const isHeavy = idx % 2 === 0;
      for (const ex of sess.exercises) {
        if (isHeavy) {
          // тяж: -1 RIR, -1 rep
          ex.rir = Math.max(0, ex.rir - 1);
          ex.workSets = ex.workSets.map(s => ({ ...s, rir: ex.rir, reps: Math.max(1, s.reps - 1) }));
        } else {
          // лёг: +1 RIR, +1 rep
          ex.rir = Math.min(4, ex.rir + 1);
          ex.workSets = ex.workSets.map(s => ({ ...s, rir: ex.rir, reps: s.reps + 1 }));
        }
      }
    });
  }
  plan.rationale.push(`DUP ${mode}: тяж/лёг волны внутри недели`);
  return plan;
}
