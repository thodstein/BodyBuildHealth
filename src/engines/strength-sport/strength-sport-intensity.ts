/**
 * strength-sport-intensity.ts — изолированные интенс-техники (cluster) для ТА/стронга.
 * Только для тяжёлых синглов/дублей: cluster 3×1 с 20с паузой.
 */
import type { StrengthSportPlan } from './strength-sport.types';

export type IntensityTech = 'none' | 'cluster';

export function applyIntensity(plan: StrengthSportPlan, tech: IntensityTech = 'none'): StrengthSportPlan {
  if (tech === 'none') return plan;
  const lvl = (plan as any).level || 'intermediate';
  if (lvl === 'beginner') return plan;
  for (const wk of plan.weeksData) {
    if (wk.deload) continue;
    for (const sess of wk.sessions) {
      for (const ex of sess.exercises) {
        const hasHeavy = ex.workSets.some(s => s.reps >= 1 && s.reps <= 3);
        const isHeavySingle = hasHeavy && ex.isCompetitionLift && ex.sets >= 3;
        if (isHeavySingle && tech === 'cluster') {
          // PRO: только для 1-3 повт, RIR 1-2, tempo не ломаем — добавляем cluster метку
          ex.workSets = ex.workSets.map(s => {
            const isTriple = s.reps >= 2 && s.reps <= 3;
            return isTriple ? { ...s, tempo: (s.tempo || 'X-0-X-0') + ' cluster 20с', rir: Math.min(2, s.rir) } : s;
          });
          ex.comment = (ex.comment ? ex.comment + ' | ' : '') + 'Cluster: 3×1×20с (пауза 20с между повт)';
        }
      }
    }
  }
  plan.rationale.push(`Intensity ${tech}: кластер для тяжёлых 1-3 повт (intermediate+)`);
  return plan;
}
