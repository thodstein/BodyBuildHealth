/**
 * manual-quality.engine.ts — оценка качества ББ/PL-программы (score 0-100).
 * F4.2: вынесено из manual-constructor.engine.ts.
 * Фаза 1 PRO: effective объём (direct + indirect 0.45/0.35/0.4), per-head дельты, session caps, недельный бюджет.
 */
import type { UserProgram } from '../user-program/user-program.types';
import { getVolumeLandmarks } from '../volume-landmarks.engine';
import { analyzeManualVolume } from './manual-volume.engine';

export interface PlanQualityResult {
  score: number;
  grade: string;
  perMuscle: Array<{ muscle: string; peakSets: number; avgSets: number; status: 'over' | 'high' | 'ok' | 'low'; mrv: number; mav: number; mev: number; effectivePeak?: number; directPeak?: number }>;
  issues: string[];
  /** Дополнительные PRO-метрики (weeklyBudget / session caps) */
  proMeta?: { weeklyBudget: number; sessionLimits: { weeklyWorkingSets: number; maxWorkingSets: number; maxExercises: number }; weeklyIssues: string[] };
}

export function computePlanQualityFor(
  program: UserProgram,
  level: string,
  opts?: { onCourse?: boolean; courseIntensity?: string; labMult?: number; division?: 'bb'|'pl'; trainingYears?: number },
): PlanQualityResult {
  const BASE_MUSCLES = ['chest', 'back', 'legs', 'shoulders', 'arms', 'core'] as const;
  // Попытка PRO-анализа effective (bb/hybrid). Fallback — direct старый путь.
  let peakEffective: Record<string, number> = {};
  let avgEffective: Record<string, number> = {};
  let peakDirect: Record<string, number> = {};
  let proIssues: string[] = [];
  let weeklyBudget = 0;
  let sessionLimits = { weeklyWorkingSets: 0, maxWorkingSets: 0, maxExercises: 0 };
  let hasPro = false;
  try {
    if (program.bb || program.hybrid?.bbWeeks) {
      const ana = analyzeManualVolume(program, level, {
        onCourse: opts?.onCourse,
        courseIntensity: opts?.courseIntensity,
        labMrvMultiplier: opts?.labMult,
        trainingYears: opts?.trainingYears,
      });
      peakEffective = ana.peakEffective;
      avgEffective = ana.avgEffective;
      peakDirect = ana.peakDirect;
      // issues с кодами → строки
      proIssues = ana.issues.map(i => `⚠ ${i.message}`);
      weeklyBudget = ana.weeklyBudget;
      sessionLimits = ana.sessionLimits;
      hasPro = true;
    }
  } catch { /* fallback */ }

  const weeklySetsByMuscle: Record<string, number[]> = {};
  for (const m of BASE_MUSCLES) weeklySetsByMuscle[m] = [];

  // BB: peak week — fallback direct если PRO не посчитался
  if (!hasPro && program.bb) {
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
  if (!hasPro) {
    for (const [mu, weeks] of Object.entries(weeklySetsByMuscle)) {
      peakSetsByMuscle[mu] = Math.max(...weeks, 0);
      avgSetsByMuscle[mu] = weeks.length ? Math.round(weeks.reduce((a, b) => a + b, 0) / weeks.length) : 0;
    }
  } else {
    // PRO: per-head + effective
    for (const k of new Set([...Object.keys(peakEffective), ...Object.keys(peakDirect)])) {
      // aggregate 'shoulders' пропускаем если есть per-head дельты
      if (k === 'shoulders' && (peakEffective['delt_front'] || peakEffective['delt_mid'] || peakEffective['delt_rear'])) continue;
      if (k === 'arms' && (peakEffective['biceps'] || peakEffective['triceps'])) continue;
      if (k === 'legs' && (peakEffective['quads'] || peakEffective['hamstrings'])) continue;
      peakSetsByMuscle[k] = Math.round(peakEffective[k] || peakDirect[k] || 0);
      avgSetsByMuscle[k] = Math.round(avgEffective[k] || 0);
    }
  }
  const setsByMuscle: Record<string, number> = peakSetsByMuscle;
  if (!hasPro && Object.values(setsByMuscle).every(v => v === 0) && program.pl?.customWeeks) {
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
  const division = opts?.division || (program.meta.direction === 'pl' ? 'pl' : program.meta.direction === 'bb' ? 'bb' : undefined);
  const isPL = division === 'pl' || (!division && !!program.pl?.customWeeks && !program.bb);

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
    const effPeak = hasPro ? (peakEffective[muscle] ?? peak) : peak;
    // Для статуса используем effective пик если есть (учитывает indirect), иначе direct
    const statusPeak = hasPro ? Math.round(effPeak) : peak;
    let status: 'over' | 'high' | 'ok' | 'low';
    if (statusPeak > mrv) {
      status = 'over'; totalScore -= 8; issues.push(`⚠ ${muscle}: пик ${statusPeak} > MRV (${mrv}) — перетрен${hasPro ? ' (effective)' : ''}`);
    } else if (!isPL && avg < mev) {
      // ББ: недогруз по среднему — Schoenfeld 2016 (нужна частота).
      status = 'low'; totalScore -= 3; issues.push(`⬇ ${muscle}: средний ${avg} < MEV (${mev}) — недогруз`);
    } else if (isPL && avg < Math.round(mev * 0.5)) {
      status = 'low'; totalScore -= 1; issues.push(`⬇ ${muscle}: средний ${avg} < 50% MEV (${mev}) — критический недогруз`);
    } else if (statusPeak >= mav) {
      status = 'high'; totalScore -= isPL ? 1 : 2;
    } else {
      status = 'ok';
    }
    perMuscle.push({ muscle, peakSets: statusPeak, avgSets: avg, status, mrv, mav, mev, effectivePeak: hasPro ? Math.round(effPeak) : undefined, directPeak: hasPro ? Math.round(peakDirect[muscle] || peak) : undefined });
  }
  // PRO-доп. issues (weeklyBudget / session caps) — добавляем как info/warning но не дублируемMRV
  if (hasPro && proIssues.length) {
    for (const msg of proIssues) {
      if (!issues.includes(msg)) issues.push(msg);
    }
  }
  if (perMuscle.length === 0) {
    issues.push('⚠ Программа пуста — добавьте упражнения');
    totalScore = 0;
  }
  totalScore = Math.max(0, Math.min(100, totalScore));
  const grade = totalScore >= 90 ? '🟢 A' : totalScore >= 75 ? '🟡 B' : totalScore >= 50 ? '🟠 C' : '🔴 D';
  const proMeta = hasPro ? { weeklyBudget, sessionLimits, weeklyIssues: proIssues } : undefined;
  return { score: totalScore, grade, perMuscle, issues, proMeta };
}
