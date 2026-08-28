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
      if (mode === 'wave') {
        // wave: 3 волны тяж(90%) / средн(80%) / лёгк(70%) по кругу
        const wave = idx % 3;
        for (const ex of sess.exercises) {
          if (wave === 0) {
            // тяж: -1 RIR, -1 rep, pct+5%
            ex.rir = Math.max(0, ex.rir - 1);
            ex.workSets = ex.workSets.map(s => ({ ...s, rir: ex.rir, reps: Math.max(1, s.reps - 1), pct: Math.min(95, (s.pct||80)+5), weight: Math.round(s.weight*1.05/2.5)*2.5 }));
          } else if (wave === 1) {
            // средн — как есть
          } else {
            // лёг: +1 RIR, +1 rep, pct-8%
            ex.rir = Math.min(4, ex.rir + 1);
            ex.workSets = ex.workSets.map(s => ({ ...s, rir: ex.rir, reps: s.reps + 1, pct: Math.max(60, (s.pct||80)-8), weight: Math.round(s.weight*0.92/2.5)*2.5 }));
          }
        }
      } else {
        const isHeavy = idx % 2 === 0;
        for (const ex of sess.exercises) {
          if (isHeavy) {
            ex.rir = Math.max(0, ex.rir - 1);
            ex.workSets = ex.workSets.map(s => ({ ...s, rir: ex.rir, reps: Math.max(1, s.reps - 1) }));
          } else {
            ex.rir = Math.min(4, ex.rir + 1);
            ex.workSets = ex.workSets.map(s => ({ ...s, rir: ex.rir, reps: s.reps + 1 }));
          }
        }
      }
    });
  }
  plan.rationale.push(`DUP ${mode}: ${mode==='wave' ? 'волна тяж/средн/лёгк (90/80/70%)' : 'тяж/лёг волны внутри недели'}`);
  return plan;
}
