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
  hardSets: number;      // P1-3: сеты с RIR<1 (до отказа)
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
  hardSets: number;    // P1-3: всего hard-сетов (RIR<1) за пик-неделю
  hardSetWarning: string | null;  // P1-3: предупреждение если превышен кап
  sessionsPerRotation: number;
  mrvMultiplier: number; // применённый PED-множитель (1.0 = натурал)
}

export function calcBBPlanMetrics(plan: BBPlan, mrvMultiplier?: number): BBPlanMetrics {
  const mult = mrvMultiplier ?? 1.0;
  const level = normLevel((plan as any).level || 'intermediate');
  const agg: Record<string, { total: number; тяж: number; памп: number; лёг: number; hard: number; rirSum: number; rirN: number; freq: number }> = {};
  // fix H: метрики считаем по ПИКОВОЙ неделе (макс объёма), а не по первой (где RIR ещё высокий)
  const weekIdx = plan.weeks.reduce((best, w, i) => {
    const exs = w.sessions.flatMap(s => s.exercises);
    const ts = exs.reduce((s, e) => s + e.sets, 0);
    return ts > best.ts ? { ts, i } : best;
  }, { ts: -1, i: 0 }).i;
  const sessions = (weekIdx >= 0 ? plan.weeks[weekIdx] : plan.weeks[0])?.sessions || [];
  for (const s of sessions) {
    for (const ex of s.exercises) {
      const m = ex.muscle;
      const a = agg[m] || (agg[m] = { total: 0, тяж: 0, памп: 0, лёг: 0, hard: 0, rirSum: 0, rirN: 0, freq: 0 });
      a.total += ex.sets;
      if (ex.character === 'тяж') a.тяж += ex.sets;
      else if (ex.character === 'памп') a.памп += ex.sets;
      else a.лёг += ex.sets;
      // P1-3: hard-сеты (RIR<1 = до отказа)
      if (ex.rir < 1) a.hard += ex.sets;
      a.rirSum += ex.rir * ex.sets; a.rirN += ex.sets;
    }
  }
  // частота — сколько сессий в ротации тренируют мышцу
  const freqMap: Record<string, number> = {};
  for (const s of sessions) for (const ex of s.exercises) freqMap[ex.muscle] = (freqMap[ex.muscle] || 0) + 1;

  const perMuscle: BBMuscleVolume[] = Object.entries(agg).map(([muscle, a]) => {
    const lm = getVolumeLandmarks(level, muscle) || { mev: 0, mav: 0, mrv: 0 };
    const mev = Math.round(lm.mev * mult);
    const mav = Math.round(lm.mav * mult);
    const mrv = Math.round(lm.mrv * mult);
    let status: BBMuscleVolume['status'] = 'below_mev';
    if (a.total >= mrv) status = 'exceeding_mrv';
    else if (a.total > mav) status = 'approaching_mrv';
    else if (a.total >= mev) status = 'optimal';
    return {
      muscle, totalSets: a.total, тяжSets: a.тяж, пампSets: a.памп, лёгSets: a.лёг,
      hardSets: a.hard,
      avgRir: a.rirN > 0 ? a.rirSum / a.rirN : 0,
      frequencyPerRotation: freqMap[muscle] || 0,
      mev, mav, mrv, status,
    };
  });
  const totalSets = perMuscle.reduce((s, m) => s + m.totalSets, 0);
  const тяжSets = perMuscle.reduce((s, m) => s + m.тяжSets, 0);
  const пампSets = perMuscle.reduce((s, m) => s + m.пампSets, 0);
  const hardSets = perMuscle.reduce((s, m) => s + m.hardSets, 0);
  const rirSum = perMuscle.reduce((s, m) => s + m.avgRir * m.totalSets, 0);
  // P1-3: hard-set cap (Helms 2018, Grgic 2021). advanced=10, intermediate=6, beginner=3.
  const hardCap = level === 'advanced' || level === 'enhanced' ? 10 : level === 'intermediate' ? 6 : 3;
  const hardSetWarning = hardSets > hardCap
    ? `⚠ Hard-сетов (RIR<1): ${hardSets} > кап ${hardCap} для уровня ${level}. Риск перетренированности (Helms 2018).`
    : null;
  return {
    perMuscle, totalSets,
    тяжPct: totalSets > 0 ? тяжSets / totalSets : 0,
    пампPct: totalSets > 0 ? пампSets / totalSets : 0,
    avgRir: totalSets > 0 ? rirSum / totalSets : 0,
    hardSets,
    hardSetWarning,
    sessionsPerRotation: sessions.length,
    mrvMultiplier: mult,
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