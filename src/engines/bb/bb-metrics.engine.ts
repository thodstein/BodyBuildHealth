/**
 * bb-metrics.engine.ts — гипертрофо-метрики BB-плана (Этап BB8).
 * Дополняет lms-metrics (Тоннаж/КПШ/интенсивность) специфичными для гипертрофии:
 * объём на мышцу/ротация, баланс тяж/памп, средний RIR, proximity-to-failure,
 * проверка против MEV/MAV/MRV (volume-landmarks).
 */
import type { BBPlan, BBSession } from './bb-builder.engine';
import { getVolumeLandmarks, normLevel } from '../volume-landmarks.engine';

export interface BBMuscleVolume {
  muscle: string;
  totalSets: number;
  тяжSets: number;
  пампSets: number;
  лёгSets: number;
  avgRir: number;
  frequencyPerRotation: number;
  mev: number; mav: number; mrv: number;
  status: 'below_mev' | 'optimal' | 'approaching_mrv' | 'exceeding_mrv';
}

export interface BBPlanMetrics {
  perMuscle: BBMuscleVolume[];
  totalSets: number;
  тяжPct: number;     // доля тяж-сетов
  пампPct: number;
  avgRir: number;
  sessionsPerRotation: number;
}

export function calcBBPlanMetrics(plan: BBPlan): BBPlanMetrics {
  const level = normLevel((plan as any).level || 'intermediate');
  const agg: Record<string, { total: number; тяж: number; памп: number; лёг: number; rirSum: number; rirN: number; freq: number }> = {};
  const sessions = plan.weeks[0]?.sessions || [];
  for (const s of sessions) {
    for (const ex of s.exercises) {
      const m = ex.muscle;
      const a = agg[m] || (agg[m] = { total: 0, тяж: 0, памп: 0, лёг: 0, rirSum: 0, rirN: 0, freq: 0 });
      a.total += ex.sets;
      if (ex.character === 'тяж') a.тяж += ex.sets;
      else if (ex.character === 'памп') a.памп += ex.sets;
      else a.лёг += ex.sets;
      a.rirSum += ex.rir * ex.sets; a.rirN += ex.sets;
    }
  }
  // частота — сколько сессий в ротации тренируют мышцу
  const freqMap: Record<string, number> = {};
  for (const s of sessions) for (const ex of s.exercises) freqMap[ex.muscle] = (freqMap[ex.muscle] || 0) + 1;

  const perMuscle: BBMuscleVolume[] = Object.entries(agg).map(([muscle, a]) => {
    const lm = getVolumeLandmarks(level, muscle) || { mev: 0, mav: 0, mrv: 0 };
    let status: BBMuscleVolume['status'] = 'below_mev';
    if (a.total >= lm.mrv) status = 'exceeding_mrv';
    else if (a.total > lm.mav) status = 'approaching_mrv';
    else if (a.total >= lm.mev) status = 'optimal';
    return {
      muscle, totalSets: a.total, тяжSets: a.тяж, пампSets: a.памп, лёгSets: a.лёг,
      avgRir: a.rirN > 0 ? a.rirSum / a.rirN : 0,
      frequencyPerRotation: freqMap[muscle] || 0,
      mev: lm.mev, mav: lm.mav, mrv: lm.mrv, status,
    };
  });
  const totalSets = perMuscle.reduce((s, m) => s + m.totalSets, 0);
  const тяжSets = perMuscle.reduce((s, m) => s + m.тяжSets, 0);
  const пампSets = perMuscle.reduce((s, m) => s + m.пампSets, 0);
  const rirSum = perMuscle.reduce((s, m) => s + m.avgRir * m.totalSets, 0);
  return {
    perMuscle, totalSets,
    тяжPct: totalSets > 0 ? тяжSets / totalSets : 0,
    пампPct: totalSets > 0 ? пампSets / totalSets : 0,
    avgRir: totalSets > 0 ? rirSum / totalSets : 0,
    sessionsPerRotation: sessions.length,
  };
}

/** Человекочитаемая сводка. */
export function explainBBMetrics(m: BBPlanMetrics): string {
  const lines = [
    `Всего сетов/ротация: ${m.totalSets} | тяж ${(m.тяжPct * 100).toFixed(0)}% | памп ${(m.пампPct * 100).toFixed(0)}% | ср.RIR ${m.avgRir.toFixed(1)}`,
    'Объём на мышцу (vs MEV/MAV/MRV):',
  ];
  for (const mm of m.perMuscle) {
    lines.push(`  ${mm.muscle}: ${mm.totalSets} сетов (тяж ${mm.тяжSets}/памп ${mm.пампSets}/лёг ${mm.лёгSets}), RIR ${mm.avgRir.toFixed(1)}, частота ${mm.frequencyPerRotation}× — ${mm.status} (MEV${mm.mev}/MAV${mm.mav}/MRV${mm.mrv})`);
  }
  return lines.join('\n');
}