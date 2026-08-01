/**
 * lms-progression-feedback.engine.ts — замыкание цикла «дневник → план» для ПЛ-авто.
 *
 * Аналог bb-progression-feedback.engine.ts, адаптированный под LMSBuildOutput:
 * для каждого упражнения последней недели плана находим последнюю запись в дневнике,
 * считаем e1RM, фактический RIR vs целевого → рекомендация на следующую неделю
 * (вес/повт/RIR + текст) через prescribeLoad.
 *
 * Источник факта: WorkoutSession[] (localStorage, SessionPlayer/дневник).
 */
import type { LMSBuildOutput, LMSPlanExercise } from './lms-builder.engine';
import type { WorkoutSession, WorkoutExercise } from '../workout-logger.engine';
import { prescribeLoad, type LoadStrategy } from '../bb/bb-autocoach.engine';
import { epley1RM } from '../e1rm';
import { mesocyclePhaseForWeek } from '../rir-matrix.engine';

export interface PLExerciseLastResult {
  exerciseName: string;
  date?: string;
  topWeight: number;
  topReps: number;
  actualRir: number;
  e1rm: number;
  totalVolume: number;
  setsDone: number;
}

export interface PLExerciseFeedback {
  planKey: string;
  planExerciseName: string;
  group: string;
  plannedWeight: number;
  plannedReps: number;
  plannedRir: number;
  week: number;
  last: PLExerciseLastResult | null;
  recommendation: {
    nextWeight: number;
    nextReps: number;
    nextRir: number;
    label: string;
    source: 'fact' | 'plan';
  };
  rirDelta: number | null;
}

function normName(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[^a-zа-я0-9 ]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function topSetOf(ex: WorkoutExercise): { weight: number; reps: number; rir: number } | null {
  if (!ex.sets || ex.sets.length === 0) return null;
  let best = ex.sets[0];
  for (const s of ex.sets) {
    if (s.weightKg > best.weightKg) best = s;
  }
  return { weight: best.weightKg, reps: best.reps, rir: best.rir };
}

/** Индекс последних результатов по нормализованному имени упражнения. */
function buildLastResultIndex(sessions: WorkoutSession[]): Map<string, PLExerciseLastResult> {
  const sorted = [...sessions].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const idx = new Map<string, PLExerciseLastResult>();
  for (const s of sorted) {
    for (const ex of s.exercises || []) {
      const key = normName(ex.exerciseName || '');
      if (!key || idx.has(key)) continue;
      const top = topSetOf(ex);
      if (!top) continue;
      idx.set(key, {
        exerciseName: ex.exerciseName || '',
        date: s.date,
        topWeight: top.weight,
        topReps: top.reps,
        actualRir: top.rir,
        e1rm: epley1RM(top.weight, top.reps),
        totalVolume: ex.totalVolume || 0,
        setsDone: (ex.sets || []).length,
      });
    }
  }
  return idx;
}

/**
 * Рассчитать обратную связь ПЛ-плана с дневником.
 * @param plan — собранный LMS-план (берём последнюю неделю).
 * @param sessions — выполненные сессии (localStorage/дневник).
 * @param fallbackPm — fallback PM для оценки (если нет в дневнике).
 * @param strategy — стратегия прогрессии (по умолчанию double_progression).
 */
export function computePLPlanFeedback(
  plan: LMSBuildOutput,
  sessions: WorkoutSession[],
  fallbackPm: number = 80,
  strategy: LoadStrategy = 'double_progression',
): PLExerciseFeedback[] {
  const lastWeek = plan.weeks[plan.weeks.length - 1];
  if (!lastWeek) return [];
  const idx = buildLastResultIndex(sessions);
  const out: PLExerciseFeedback[] = [];
  const weekNum = lastWeek.week;
  const totalWeeks = plan.weeks.length;

  for (const day of lastWeek.days) {
    for (const ex of day.exercises) {
      const key = normName(ex.name);
      // fuzzy match: ищем по точному ключу, иначе по includes
      let last: PLExerciseLastResult | null = idx.get(key) || null;
      if (!last) {
        const candidates = [...idx.entries()].filter(([k]) => {
          if (k.length <= 2 || key.length <= 2) return false;
          const keyTokens = new Set(key.split(' '));
          const candidateTokens = new Set(k.split(' '));
          const tokenOverlap = [...keyTokens].filter(token => candidateTokens.has(token)).length;
          return tokenOverlap >= Math.min(keyTokens.size, candidateTokens.size) && (k.includes(key) || key.includes(k));
        });
        if (candidates.length === 1) last = candidates[0][1];
      }

      const plannedWeight = ex.workSets[0]?.weight ?? 0;
      const plannedReps = ex.workSets[0]?.reps ?? 5;
      const plannedRir = ex.workSets[0]?.rir ?? 2;
      const maxWeight = ex.pm || fallbackPm;

      let rirDelta: number | null = null;
      let recommendation: PLExerciseFeedback['recommendation'];

      if (last) {
        rirDelta = last.actualRir - plannedRir;
        // prescribeLoad с plannedRir — success-aware коррекция
        const phase = mesocyclePhaseForWeek(weekNum, totalWeeks);
        const presc = prescribeLoad(
          strategy,
          last.topWeight,
          last.topReps,
          last.actualRir,
          maxWeight,
          weekNum,
          totalWeeks,
          phase,
          ex.load === 'Тяжелая' ? 'compound' : 'accessory',
          ex.load === 'Тяжелая' ? 'primary' : 'accessory',
          plannedRir,
        );
        recommendation = { nextWeight: presc.nextWeight, nextReps: presc.nextReps, nextRir: presc.nextRIR, label: presc.label, source: 'fact' };
      } else {
        // нет данных — рекомендация по плану
        const phase = mesocyclePhaseForWeek(weekNum, totalWeeks);
        const presc = prescribeLoad(strategy, plannedWeight, plannedReps, plannedRir, maxWeight, weekNum, totalWeeks, phase, 'compound', 'primary');
        recommendation = { nextWeight: presc.nextWeight, nextReps: presc.nextReps, nextRir: presc.nextRIR, label: presc.label, source: 'plan' };
      }

      out.push({
        planKey: `${ex.name}|${ex.group}`,
        planExerciseName: ex.name,
        group: ex.group,
        plannedWeight,
        plannedReps,
        plannedRir,
        week: weekNum,
        last,
        recommendation,
        rirDelta,
      });
    }
  }
  return out;
}

/** Сводка: сколько упражнений с фактом vs без данных. */
export function summarizePLFeedback(feedback: PLExerciseFeedback[]): { withFact: number; noData: number; plateau: number; avgRirDelta: number | null } {
  const withFact = feedback.filter(f => f.last != null).length;
  const noData = feedback.length - withFact;
  // RIR delta describes session difficulty, not a longitudinal plateau. A
  // plateau requires repeated e1RM observations and is not inferable here.
  const plateau = 0;
  const deltas = feedback.filter(f => f.rirDelta != null).map(f => f.rirDelta!);
  const avgRirDelta = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;
  return { withFact, noData, plateau, avgRirDelta };
}
