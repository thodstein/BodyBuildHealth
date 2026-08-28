/**
 * combat-dup.ts — изолированный DUP для единоборств.
 * 4 режима: power_endurance (тяж RIR-1 / памп +1rep), heavy_light (3волны внутри нед), conjugate (max/dynamic/repetition)
 */
import type { CombatPlan } from './combat.types';

export type CombatDUP = 'off' | 'power_endurance' | 'heavy_light' | 'conjugate';

export function applyCombatDUP(plan: CombatPlan, mode: CombatDUP = 'power_endurance'): CombatPlan {
  if (mode === 'off') return plan;
  for (const wk of plan.weeksData) {
    if (wk.deload || wk.taper) continue;
    for (const sess of wk.sessions) {
      const isPower = sess.sessionTag.includes('power');
      if (mode === 'power_endurance') {
        for (const ex of sess.exercises) {
          if (isPower) ex.rir = Math.max(1, ex.rir - 1);
          else { ex.rir = Math.min(4, ex.rir + 1); ex.workSets = ex.workSets.map(s => ({ ...s, reps: s.reps + 1 })); }
        }
      } else if (mode === 'heavy_light') {
        // волна внутри недели: power сессии тяж, conditioning лёг, neck_grip средние
        const isHeavy = sess.sessionTag === 'upper_power' || sess.sessionTag === 'lower_power';
        const isLight = sess.sessionTag === 'full_conditioning';
        for (const ex of sess.exercises) {
          if (isHeavy) { ex.rir = Math.max(1, ex.rir - 1); ex.workSets = ex.workSets.map(s=> ({...s, weight: Math.round(s.weight*1.02/2.5)*2.5 })); }
          else if (isLight) { ex.rir = Math.min(4, ex.rir + 1); ex.workSets = ex.workSets.map(s=> ({...s, reps: s.reps + 1, weight: Math.round(s.weight*0.92/2.5)*2.5 })); }
          else { ex.rir = Math.min(4, ex.rir + 0.5 as any); }
        }
      } else if (mode === 'conjugate') {
        // max effort: 1-3 повт, RIR1, dynamic: 8×3 60% speed, repetition: 8-12 RIR3
        const weekMod = wk.week % 3;
        for (const ex of sess.exercises) {
          if (weekMod === 1) { // max
            if (ex.role==='primary') { ex.rir = 1; ex.reps = '1-3'; ex.workSets = ex.workSets.map(s=> ({...s, reps: 2, rir:1 })); }
          } else if (weekMod === 2) { // dynamic
            ex.rir = 3; ex.reps = '3-5'; ex.tempo = 'X-0-X-0'; ex.workSets = ex.workSets.map(s=> ({...s, reps: 3, rir:3, tempo:'X-0-X-0' })); ex.restSeconds = 90;
          } else { // repetition
            ex.rir = 3; ex.reps = '8-12'; ex.workSets = ex.workSets.map(s=> ({...s, reps: 10, rir:3 })); ex.restSeconds = 75;
          }
        }
      }
    }
  }
  plan.rationale.push(`Combat DUP ${mode}`);
  return plan;
}
