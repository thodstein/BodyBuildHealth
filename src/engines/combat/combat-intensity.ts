/**
 * combat-intensity.ts — изолированные техники для единоборств.
 * 4 техники: rest_pause, myo_reps, cluster, contrast (тяж+плио)
 */
import type { CombatPlan } from './combat.types';

export type CombatIntensity = 'none' | 'rest_pause' | 'myo_reps' | 'cluster' | 'contrast';

export function applyCombatIntensity(plan: CombatPlan, tech: CombatIntensity = 'none'): CombatPlan {
  if (tech === 'none') return plan;
  for (const wk of plan.weeksData) {
    if (wk.deload || wk.taper) continue;
    for (const sess of wk.sessions) {
      for (const ex of sess.exercises) {
        const isGrip = ex.id.includes('grip')||ex.id.includes('pinch')||ex.id.includes('wrist')||ex.id.includes('farmer');
        if (tech === 'rest_pause' && ex.role === 'accessory') {
          ex.comment = (ex.comment ? ex.comment + ' | ' : '') + 'Rest-pause: последний сет до RIR0 +15с';
          ex.workSets = ex.workSets.map((s, idx, arr) => idx === arr.length - 1 ? { ...s, rir: 0 } : s);
        } else if (tech === 'myo_reps' && isGrip) {
          ex.comment = (ex.comment ? ex.comment + ' | ' : '') + 'Myo-reps: активация 12-15 + 3-5×3-5×20с отдых';
          // помечаем последний сет как myo
          const last = ex.workSets[ex.workSets.length-1];
          if (last) last.rir = 0;
        } else if (tech === 'cluster' && ex.role === 'primary' && ['squat','bench_bar','row_bar','trap_bar_dead','push_press'].includes(ex.id)) {
          ex.comment = (ex.comment ? ex.comment + ' | ' : '') + 'Cluster: 3×3 /20с внутри сета, RIR2';
          ex.workSets = ex.workSets.map(s=> ({...s, reps: 3, rir: 2, restSeconds: 20 } as any));
        } else if (tech === 'contrast' && sess.sessionTag.includes('power')) {
          // только для power сессий: добавляем пометку контраста (тяж 3×3 + плио 3×5)
          if (ex.role === 'primary' && !ex.comment?.includes('Contrast')) {
            ex.comment = (ex.comment ? ex.comment + ' | ' : '') + 'Contrast: после тяж сета → плио 5 прыжков/бросков (30с)';
          }
        }
      }
    }
  }
  plan.rationale.push(`Combat intensity ${tech}`);
  return plan;
}
