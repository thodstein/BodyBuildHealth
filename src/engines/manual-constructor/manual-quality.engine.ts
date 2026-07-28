/**
 * manual-quality.engine.ts — оценка качества ББ/PL-программы (score 0-100).
 * F4.2: вынесено из manual-constructor.engine.ts.
 */
import type { UserProgram } from '../user-program/user-program.types';
import { getVolumeLandmarks } from '../volume-landmarks.engine';

export interface PlanQualityResult {
  score: number;
  grade: string;
  perMuscle: Array<{ muscle: string; peakSets: number; avgSets: number; status: 'over' | 'high' | 'ok' | 'low'; mrv: number; mav: number; mev: number }>;
  issues: string[];
}

export function computePlanQualityFor(
  program: UserProgram,
  level: string,
  opts?: { onCourse?: boolean; courseIntensity?: string; labMult?: number },
): PlanQualityResult {
  const BASE_MUSCLES = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
  const weeklySetsByMuscle: Record<string, number[]> = {};
  for (const m of BASE_MUSCLES) weeklySetsByMuscle[m] = [];

  // BB: peak week
  if (program.bb) {
    for (const w of program.bb.weeks ?? []) {
      const weekSets: Record<string, number> = {};
      for (const s of w.sessions ?? []) {
        for (const b of s.blocks ?? []) {
          const mu = (b.muscle || '').toLowerCase();
          if (!mu) continue;
          weekSets[mu] = (weekSets[mu] || 0) + (b.sets?.length || 0);
        }
      }
      for (const [mu, sets] of Object.entries(weekSets)) {
        if (!weeklySetsByMuscle[mu]) weeklySetsByMuscle[mu] = [];
        weeklySetsByMuscle[mu].push(sets);
      }
    }
  }

  // PL custom: если BB-тела нет
  const peakSetsByMuscle: Record<string, number> = {};
  const avgSetsByMuscle: Record<string, number> = {};
  for (const [mu, weeks] of Object.entries(weeklySetsByMuscle)) {
    peakSetsByMuscle[mu] = Math.max(...weeks, 0);
    avgSetsByMuscle[mu] = weeks.length ? Math.round(weeks.reduce((a, b) => a + b, 0) / weeks.length) : 0;
  }
  const setsByMuscle: Record<string, number> = peakSetsByMuscle;
  if (Object.values(setsByMuscle).every(v => v === 0) && program.pl?.customWeeks) {
    for (const m of BASE_MUSCLES) weeklySetsByMuscle[m] = [];
    for (const w of program.pl.customWeeks) {
      const weekSets: Record<string, number> = {};
      for (const d of w.days ?? []) {
        for (const ex of d.exercises ?? []) {
          const mu = (ex.muscle || ex.lift || '').toLowerCase();
          if (!mu) continue;
          weekSets[mu] = (weekSets[mu] || 0) + (ex.sets?.reduce((s, st) => s + (st.sets || 1), 0) || 0);
        }
      }
      for (const [mu, sets] of Object.entries(weekSets)) {
        if (!weeklySetsByMuscle[mu]) weeklySetsByMuscle[mu] = [];
        weeklySetsByMuscle[mu].push(sets);
      }
    }
    for (const [mu, weeks] of Object.entries(weeklySetsByMuscle)) {
      setsByMuscle[mu] = Math.max(...weeks, 0);
    }
  }

  const perMuscle: PlanQualityResult['perMuscle'] = [];
  const issues: string[] = [];
  let totalScore = 100;
  const onCourse = opts?.onCourse ?? false;
  const courseIntensity = opts?.courseIntensity ?? 'moderate';
  const labMult = opts?.labMult ?? 1;

  for (const [muscle, peak] of Object.entries(setsByMuscle)) {
    const lm = getVolumeLandmarks(level, muscle);
    if (!lm) continue;
    let mrv = lm.mrv;
    let mav = lm.mav;
    let mev = lm.mev;
    if (onCourse) {
      const courseMult = courseIntensity === 'heavy' ? 1.3 : courseIntensity === 'mild' ? 1.15 : 1.2;
      mrv = Math.round(mrv * courseMult);
      mav = Math.round(mav * courseMult);
      mev = Math.round(mev * courseMult);
    }
    if (labMult < 1) {
      mrv = Math.round(mrv * labMult);
      mav = Math.round(mav * labMult);
      mev = Math.round(mev * labMult);
    }
    const avg = avgSetsByMuscle[muscle] ?? peak;
    let status: 'over' | 'high' | 'ok' | 'low';
    if (peak > mrv) {
      status = 'over'; totalScore -= 8; issues.push(`⚠ ${muscle}: пик ${peak} > MRV (${mrv}) — перетрен`);
    } else if (avg < mev) {
      // Пик может быть высоким, но средний ниже MEV — недогруз по мезоциклу
      status = 'low'; totalScore -= 3; issues.push(`⬇ ${muscle}: средний ${avg} < MEV (${mev}) — недогруз`);
    } else if (peak >= mav) {
      status = 'high'; totalScore -= 2;
    } else {
      status = 'ok';
    }
    perMuscle.push({ muscle, peakSets: peak, avgSets: avg, status, mrv, mav, mev });
  }
  if (perMuscle.length === 0) {
    issues.push('⚠ Программа пуста — добавьте упражнения');
    totalScore = 0;
  }
  totalScore = Math.max(0, Math.min(100, totalScore));
  const grade = totalScore >= 90 ? '🟢 A' : totalScore >= 75 ? '🟡 B' : totalScore >= 50 ? '🟠 C' : '🔴 D';
  return { score: totalScore, grade, perMuscle, issues };
}
