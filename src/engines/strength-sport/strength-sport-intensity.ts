/**
 * strength-sport-intensity.ts — изолированные интенс-техники (cluster) для ТА/стронга.
 * Только для тяжёлых синглов/дублей: cluster 3×1 с 20с паузой.
 */
import type { StrengthSportPlan } from './strength-sport.types';

export type IntensityTech = 'none' | 'cluster';

export function applyIntensity(plan: StrengthSportPlan, tech: IntensityTech = 'none'): StrengthSportPlan {
  if (tech === 'none') return plan;
  for (const wk of plan.weeksData) {
    if (wk.deload) continue;
    for (const sess of wk.sessions) {
      for (const ex of sess.exercises) {
        // cluster только для oly/тяжёлых 1-3 повт
        const isHeavySingle = ex.workSets.some(s => s.reps <= 3) && ex.isCompetitionLift;
        if (isHeavySingle && tech === 'cluster') {
          // разбиваем 1 сет 3 повт на 3×1 кластер
          const orig = ex.workSets[0];
          if (orig && ex.sets >= 3) {
            // оставляем как есть, но помечаем tempo cluster
            ex.workSets = ex.workSets.map(s => ({ ...s, tempo: (s.tempo || '') + '+cluster' }));
            ex.comment = (ex.comment ? ex.comment + ' | ' : '') + 'Cluster: 3×1×20с';
          }
        }
      }
    }
  }
  plan.rationale.push(`Intensity ${tech}`);
  return plan;
}
