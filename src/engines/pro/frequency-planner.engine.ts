/**
 * frequency-planner.engine.ts — планировщик частоты по MEV/MRV (PLToolkit: Primary/Secondary/Half days)
 * Для ПЛ: распределяет недельный объём (сеты/нед) по частоте с учётом MEV/MRV и дней.
 * Использует volume-landmarks (Helms) как источник MEV/MRV.
 */
import { getVolumeLandmarks } from '../volume-landmarks.engine';

export type FrequencyPlan = {
  muscle: string;
  totalSets: number;
  daysPerWeek: number;
  perSession: number[]; // сетов на каждую сессию (Primary → Secondary → Half)
  frequency: number; // рекомендуемая частота (сессий/нед с этим muscle)
  status: 'under' | 'optimal' | 'high' | 'over';
  note: string;
};

function statusFor(sets: number, mev: number, mav: number, mrv: number): FrequencyPlan['status'] {
  if (sets < mev) return 'under';
  if (sets <= mav) return 'optimal';
  if (sets <= mrv) return 'high';
  return 'over';
}

/**
 * Рекомендуемая частота: минимальная частота, чтобы perSession ≤ MRV/сессию (≈ MRV/2 для 2×, MRV/3 для 3×)
 * и perSession ≥ MEV/2 (чтобы не мельчить). Эвристика: 1-3×/нед.
 */
export function planFrequency(muscle: string, totalSets: number, daysPerWeek: number, level: string = 'intermediate'): FrequencyPlan {
  const vr = getVolumeLandmarks(level as never, muscle as never);
  const mev = vr?.mev ?? 6;
  const mav = vr?.mav ?? 12;
  const mrv = vr?.mrv ?? 20;
  const status = statusFor(totalSets, mev, mav, mrv);

  // Подбираем частоту 1-3 так, чтобы средняя на сессию в [mev/2, mrv/2] и частота ≤ daysPerWeek
  let freq = 1;
  if (totalSets > mrv * 0.6 && daysPerWeek >= 2) freq = 2;
  if (totalSets > mrv && daysPerWeek >= 3) freq = 3;
  if (totalSets >= 12 && daysPerWeek >= 2 && freq === 1) freq = 2;
  freq = Math.min(freq, daysPerWeek, 3);
  if (freq < 1) freq = 1;

  // Распределение: Primary 50%, Secondary 30%, Half 20% (если 3×), иначе 60/40 или 100%
  const perSession: number[] = [];
  if (freq === 1) perSession.push(totalSets);
  else if (freq === 2) {
    const p = Math.round(totalSets * 0.6);
    perSession.push(p, totalSets - p);
  } else {
    const p = Math.round(totalSets * 0.5);
    const s = Math.round(totalSets * 0.3);
    const h = totalSets - p - s;
    perSession.push(p, s, h);
  }

  const note = status === 'over' ? `Объём ${totalSets} > MRV ${mrv} — риск недовосстановления`
    : status === 'high' ? `Объём ${totalSets} в зоне MVR (${mav}-${mrv}) — ок, но следи за RPE/ACWR`
    : status === 'under' ? `Объём ${totalSets} < MEV ${mev} — стимула мало` : `Оптимально ${mev}-${mav}`;

  return { muscle, totalSets, daysPerWeek, perSession, frequency: freq, status, note };
}

export function planAllFrequencies(muscles: string[], totalSetsByMuscle: Record<string, number>, daysPerWeek: number, level?: string): FrequencyPlan[] {
  return muscles.map(m => planFrequency(m, totalSetsByMuscle[m] ?? 0, daysPerWeek, level));
}
