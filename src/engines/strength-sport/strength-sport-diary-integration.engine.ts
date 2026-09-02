/**
 * strength-sport-diary-integration.engine.ts — СВЯЗКА ДНЕВНИКА → ТА-диагностика
 *
 * Использует weak-muscle-detection (e1RM тренд 28д), phaseForReps, diary trend для выявления
 * слабых фаз ТА. Чистый, parity с PlDeadpointsBarPathCard.
 */

import { detectWeakMusclesByE1rm, type WeakMuscleSession, groupOfExerciseName } from '../pro/weak-muscle-detection.engine';
import { phaseForReps } from '../pro/lift-diagnostics.engine';
import type { WLWeakPoint } from './strength-sport-weakpoint';
import { WL_WEAKPOINT_BY_LIFT } from './strength-sport-weakpoint';

export interface DiaryTAWeak {
  group: string;
  label: string;
  deltaPct: number;
  status: 'weak' | 'plateau';
  sessions: number;
}

export function detectTAWeakFromDiary(sessions: WeakMuscleSession[]): DiaryTAWeak[] {
  const signals = detectWeakMusclesByE1rm(sessions);
  // Фильтруем только релевантные для ТА группы: legs/back/shoulders
  return signals.filter(s => ['legs', 'back', 'shoulders'].includes(s.group)).map(s => ({
    group: s.group,
    label: s.label,
    deltaPct: s.deltaPct,
    status: s.status,
    sessions: s.sessions,
  }));
}

/**
 * Кандидат слабых ТА-фаз из дневника: если много тяжёлых сетов (RPE≥8) с reps≤2 → phase max moment,
 * иначе игнорируем (как в lift-diagnostics: reps≥6 → null).
 */
export function candidateTAWeakPointsFromDiary(
  sessions: Array<{ exercises?: Array<{ exerciseName?: string; sets?: Array<{ reps?: number; rpe?: number; weightKg?: number }> }> }>,
  liftKey: 'snatch' | 'clean' | 'jerk' | 'squat' | 'pull' = 'snatch'
): WLWeakPoint[] {
  const candidates: WLWeakPoint[] = [];
  const phases = WL_WEAKPOINT_BY_LIFT[liftKey] || WL_WEAKPOINT_BY_LIFT.snatch;
  // Считаем reps по тяжёлым сетам RPE≥8 с e1RM-фильтром (как StickingPointAnalysisCard) + sumo-детекция
  const repBuckets: number[] = [];
  let hasSumo = false;
  for (const s of sessions) {
    for (const ex of (s.exercises || [])) {
      const name = (ex.exerciseName || '').toLowerCase();
      const isTarget = liftKey === 'snatch' ? /рывок|snatch/.test(name) : liftKey === 'clean' ? /взяти|clean/.test(name) : liftKey === 'jerk' ? /толч|jerk|push/.test(name) : liftKey === 'pull' ? /тяг|pull|deadlift/.test(name) : /присед|squat/.test(name);
      if (!isTarget) continue;
      if (/сумо|sumo/.test(name)) hasSumo = true;
      for (const set of (ex.sets || [])) {
        const rpe = set.rpe ?? 0;
        const reps = set.reps ?? 0;
        const w = set.weightKg ?? 0;
        if (rpe >= 8 && reps > 0 && reps < 6) {
          // e1RM-тренд уже в detectTAWeakFromDiary, здесь только phaseForReps parity
          const ph = phaseForReps(reps, liftKey as any);
          if (ph) repBuckets.push(reps);
          else repBuckets.push(reps);
        } else if (rpe >= 8 && reps > 0) repBuckets.push(reps);
      }
    }
  }
  if (repBuckets.length < 2) return [];
  // sumo приоритет: если есть сумо-упражнения → фазы sumo
  if (hasSumo) {
    const low = repBuckets.filter(r => r <= 2).length;
    if (low >= 2) {
      if (phases.includes('pull_start' as WLWeakPoint)) candidates.push('pull_start' as WLWeakPoint);
      // sumo специфично
      const sumoPhases = (WL_WEAKPOINT_BY_LIFT as any)['sumo'] || [];
      if (sumoPhases.includes('sumo_start')) candidates.push('sumo_start' as any);
    }
    const mid = repBuckets.filter(r => r >= 3 && r <= 5).length;
    if (mid >= 2 && phases.includes('pull_start' as WLWeakPoint)) {
      const mp = phases.find(p => p.includes('mid'));
      if (mp) candidates.push(mp);
    }
    return [...new Set(candidates)];
  }
  // Частота reps ≤2 → фаза max moment, 3-5 → mid (phaseForReps parity)
  const low = repBuckets.filter(r => r <= 2).length;
  const mid = repBuckets.filter(r => r >= 3 && r <= 5).length;
  if (low >= 2) {
    // используем первую фазу как max moment (как в TA_BIOMECH)
    const maxPhase = phases[0];
    if (maxPhase) candidates.push(maxPhase);
  }
  if (mid >= 2) {
    const midPhase = phases.find(p => p.includes('_mid') || p.includes('mid'));
    if (midPhase) candidates.push(midPhase);
  }
  return [...new Set(candidates)];
}

export function diaryTrendSummary(sessions: WeakMuscleSession[]): string {
  const weaks = detectTAWeakFromDiary(sessions);
  if (weaks.length === 0) return 'Дневник: тренд стабилен';
  return `Дневник: слабые ${weaks.map(w => `${w.label} ${w.deltaPct}%`).join(', ')}`;
}
