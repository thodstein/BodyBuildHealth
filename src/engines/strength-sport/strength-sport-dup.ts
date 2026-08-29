/**
 * strength-sport-dup.ts — изолированный DUP (Daily Undulating Periodization) для ТА/стронга.
 * Тяж/лёг волны внутри недели: нечётные сессии — тяж (RIR 0-1, 1-3 повт), чётные — лёг (RIR 2-3, 3-6).
 * Только зал, не трогает outside.
 */
import type { StrengthSportPlan } from './strength-sport.types';

export type DUPMode = 'off' | 'heavy_light' | 'wave';

export function applyDUP(plan: StrengthSportPlan, mode: DUPMode = 'heavy_light'): StrengthSportPlan {
  if (mode === 'off') return plan;
  // PRO: beginner не получает DUP (только intermediate+)
  const lvl = (plan as any).level || 'intermediate';
  if (lvl === 'beginner') return plan;
  for (const wk of plan.weeksData) {
    if (wk.deload) continue;
    wk.sessions.forEach((sess, idx) => {
      if (mode === 'wave') {
        // wave: тяж(90%) / средн(80%) / лёгк(70%) — pct относительно исходного 75-88
        const wave = idx % 3;
        for (const ex of sess.exercises) {
          if (wave === 0) {
            ex.rir = Math.max(0, ex.rir - 1);
            ex.workSets = ex.workSets.map(s => {
              const basePct = s.pct || 80;
              const targetPct = Math.min(95, Math.max(60, basePct + 5));
              const w = Math.round(s.weight * (targetPct / basePct) / 2.5) * 2.5;
              return { ...s, rir: ex.rir, reps: Math.max(1, s.reps - 1), pct: targetPct, weight: Number.isFinite(w) ? w : s.weight };
            });
          } else if (wave === 1) {
          } else {
            ex.rir = Math.min(4, ex.rir + 1);
            ex.workSets = ex.workSets.map(s => {
              const basePct = s.pct || 80;
              const targetPct = Math.max(60, basePct - 8);
              const w = Math.round(s.weight * (targetPct / basePct) / 2.5) * 2.5;
              return { ...s, rir: ex.rir, reps: Math.min(12, s.reps + 1), pct: targetPct, weight: Number.isFinite(w) ? w : s.weight };
            });
          }
        }
      } else {
        const isHeavy = idx % 2 === 0;
        for (const ex of sess.exercises) {
          if (isHeavy) {
            ex.rir = Math.max(0, ex.rir - 1);
            ex.workSets = ex.workSets.map(s => {
              // тяж — вес +5% если был 1-3 повт, иначе как есть + корректировка reps
              const w = Math.round(s.weight * 1.03 / 2.5) * 2.5;
              return { ...s, rir: ex.rir, reps: Math.max(1, s.reps - 1), weight: w, pct: Math.min(95, (s.pct || 80) + 3) };
            });
          } else {
            ex.rir = Math.min(4, ex.rir + 1);
            ex.workSets = ex.workSets.map(s => {
              const w = Math.round(s.weight * 0.95 / 2.5) * 2.5;
              return { ...s, rir: ex.rir, reps: Math.min(12, s.reps + 1), weight: w, pct: Math.max(60, (s.pct || 80) - 3) };
            });
          }
        }
      }
    });
  }
  plan.rationale.push(`DUP ${mode}: ${mode==='wave' ? 'волна тяж/средн/лёгк (90/80/70%)' : 'тяж/лёг волны внутри недели'}`);
  return plan;
}
