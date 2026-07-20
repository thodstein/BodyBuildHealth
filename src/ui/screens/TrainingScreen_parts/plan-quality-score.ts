/**
 * plan-quality-score.ts — чистая функция оценки качества плана (извлечено из TrainingConstructor/PlanDisplay).
 * Не зависит от React. Используется CalcQualityTab и (потенциально) редактором программ.
 */
import { getVolumeLandmarks } from '../../../engines/volume-landmarks.engine';

export function calcQualityScore(
  days: any[],
  weeklySets: Record<string, number>,
  level: string,
  goal: string,
  opts?: { mrvOverride?: number | null; onCourse?: boolean; courseIntensity?: 'none' | 'mild' | 'moderate' | 'heavy'; labMult?: number; readiness?: number }
): {
  score: number; color: string;
  breakdown: { label: string; ok: boolean; detail: string }[];
  recommendations: string[];
  perMuscle: { muscle: string; sets: number; mev: number; mav: number; mrv: number; status: string; pct: number }[];
} {
  const levelBaseMrv = { beginner: 15, intermediate: 20, advanced: 24, enhanced: 28 }[level] ?? 20;
  const mrvScale = opts?.mrvOverride != null && levelBaseMrv > 0 ? opts.mrvOverride / levelBaseMrv : 1;
  const breakdown: { label: string; ok: boolean; detail: string }[] = [];
  const recommendations: string[] = [];
  const perMuscle: { muscle: string; sets: number; mev: number; mav: number; mrv: number; status: string; pct: number }[] = [];
  let score = 100;

  const readiness = opts?.readiness != null ? Math.max(0, Math.min(100, opts.readiness)) : 100;
  const readinessFactor = readiness >= 80 ? 0.4 : readiness >= 60 ? 0.7 : 1.0;

  for (const [g, sets] of Object.entries(weeklySets)) {
    const lm = getVolumeLandmarks(level, g);
    if (!lm) continue;
    let mrv = Math.round(lm.mrv * mrvScale);
    let mev = Math.round(lm.mev * mrvScale);
    let mav = Math.round(lm.mav * mrvScale);
    if (opts?.onCourse) {
      const courseMult = opts.courseIntensity === 'heavy' ? 1.3 : opts.courseIntensity === 'moderate' ? 1.2 : 1.15;
      mrv = Math.round(mrv * courseMult); mev = Math.round(mev * courseMult); mav = Math.round(mav * courseMult);
    }
    if (opts?.labMult) { mrv = Math.round(mrv * opts.labMult); mev = Math.round(mev * opts.labMult); mav = Math.round(mav * opts.labMult); }
    let status: string = 'оптимум';
    const pct = mrv > 0 ? (sets / mrv) * 100 : 0;
    if (sets < mev) { status = 'недотрен'; score -= Math.round(8 * readinessFactor); }
    else if (sets > mrv) { status = 'перегруз'; score -= 6; }
    perMuscle.push({ muscle: g, sets, mev, mav, mrv, status, pct: Math.round(pct) });
  }

  for (const pm of perMuscle) {
    if (pm.status === 'недотрен') {
      breakdown.push({ label: 'Недотрен ' + pm.muscle, ok: false, detail: pm.muscle + ': ' + pm.sets + ' сетов < MEV=' + pm.mev + '. Добавьте ' + (pm.mev - pm.sets) + ' сетов. ' });
      recommendations.push('➕ ' + pm.muscle + ': +' + (pm.mev - pm.sets) + ' сетов/нед (MEV=' + pm.mev + ')');
    } else if (pm.status === 'перегруз') {
      breakdown.push({ label: 'Перегруз ' + pm.muscle, ok: false, detail: pm.muscle + ': ' + pm.sets + ' сетов > MRV=' + pm.mrv + '. Убавьте ' + (pm.sets - pm.mrv) + ' сетов.' });
      recommendations.push('➖ ' + pm.muscle + ': −' + (pm.sets - pm.mrv) + ' сетов/нед (MRV=' + pm.mrv + ')');
    } else {
      breakdown.push({ label: pm.muscle, ok: true, detail: pm.muscle + ': ' + pm.sets + ' сетов (MEV=' + pm.mev + '–MRV=' + pm.mrv + ') — в зоне' });
    }
  }

  const groupsPresent = perMuscle.length;
  if (groupsPresent < 4) { score -= 10; breakdown.push({ label: 'Охват групп', ok: false, detail: groupsPresent + ' групп (мин. 4)' }); }
  else { breakdown.push({ label: 'Охват групп', ok: true, detail: groupsPresent + ' групп' }); }

  const totalEx = days.reduce((s: number, d: any) => s + d.exercises.length, 0);
  const avgEx = Math.round(totalEx / Math.max(1, days.length));
  if (avgEx < 3) { score -= 15; breakdown.push({ label: 'Плотность', ok: false, detail: avgEx + ' упр/день — слишком мало' }); }
  else if (avgEx > 14) { score -= 5; breakdown.push({ label: 'Плотность', ok: false, detail: avgEx + ' упр/день — слишком много' }); }
  else { breakdown.push({ label: 'Плотность', ok: true, detail: avgEx + ' упр/день — оптимально' }); }

  const hasMain = days.some((d: any) => d.exercises.some((e: any) => e.role === 'main'));
  if (!hasMain) { score -= 20; breakdown.push({ label: 'Базовые', ok: false, detail: 'Нет базовых упражнений' }); }
  else { breakdown.push({ label: 'Базовые', ok: true, detail: 'Есть compound-упражнения' }); }

  if (perMuscle.length >= 2) {
    const pcts = perMuscle.filter(p => p.mrv > 0).map(p => p.pct);
    const maxPct = Math.max(...pcts);
    const minPct = Math.min(...pcts);
    if (maxPct - minPct > 40) {
      score -= 5;
      const minGroup = perMuscle.find(p => p.pct === minPct);
      const maxGroup = perMuscle.find(p => p.pct === maxPct);
      if (minGroup && maxGroup) {
        breakdown.push({ label: 'Дисбаланс', ok: false, detail: minGroup.muscle + ' (' + minGroup.pct + '%) vs ' + maxGroup.muscle + ' (' + maxGroup.pct + '%) — разрыв >40%' });
        recommendations.push('⚖ ' + minGroup.muscle + ' отстаёт от ' + maxGroup.muscle + '. Увеличьте объём для ' + minGroup.muscle + '.');
      }
    } else {
      breakdown.push({ label: 'Баланс', ok: true, detail: 'Разрыв между группами ≤40% — сбалансировано' });
    }
  }

  score = Math.max(0, Math.min(100, score));
  const color = score >= 80 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  return { score, color, breakdown, recommendations, perMuscle };
}