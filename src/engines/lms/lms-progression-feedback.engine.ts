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
import { macroPhaseToLmsPhase } from '../periodization/phase-bridge';
import type { MacroPhase } from './macrocycle.engine';

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
  // P1-fix: select top set by e1RM (Epley), not by raw weight.
  // 80kg×5 (e1RM=88.3) is a better performance indicator than 82kg×1 (e1RM=82).
  let best = ex.sets[0];
  let bestE1RM = epley1RM(best.weightKg, best.reps);
  for (const s of ex.sets) {
    const candidateE1RM = epley1RM(s.weightKg, s.reps);
    if (candidateE1RM > bestE1RM) {
      best = s;
      bestE1RM = candidateE1RM;
    }
  }
  return { weight: best.weightKg, reps: best.reps, rir: best.rir };
}

/** Индекс последних результатов по нормализованному имени упражнения.
 *  P1-fix: previously kept only the MOST RECENT session's data for each exercise name.
 *  If the same exercise appeared on both a heavy day (80kg) and a pump day (60kg),
 *  only the pump day data survived → plan's heavy-day exercise referenced pump-day e1RM.
 *  Now: for each exercise name, track the entry with the HIGHEST e1RM across recent sessions
 *  (within the last 30 days), so the heavy-day performance is preserved.
 */
function buildLastResultIndex(sessions: WorkoutSession[]): Map<string, PLExerciseLastResult> {
  const sorted = [...sessions].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const idx = new Map<string, PLExerciseLastResult>();
  const ninetyDaysAgo = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 90);
    return d.toISOString().slice(0, 10);
  })();
  for (const s of sorted) {
    // Only consider sessions within the last 90 days for the "best e1RM" selection.
    if ((s.date || '') < ninetyDaysAgo) continue;
    for (const ex of s.exercises || []) {
      const key = normName(ex.exerciseName || '');
      if (!key) continue;
      const top = topSetOf(ex);
      if (!top) continue;
      const e1rm = epley1RM(top.weight, top.reps);
      const existing = idx.get(key);
      // Keep the entry with the highest e1RM (best performance indicator).
      if (!existing || e1rm > existing.e1rm) {
        idx.set(key, {
          exerciseName: ex.exerciseName || '',
          date: s.date,
          topWeight: top.weight,
          topReps: top.reps,
          actualRir: top.rir,
          e1rm,
          totalVolume: ex.totalVolume || 0,
          setsDone: (ex.sets || []).length,
        });
      }
    }
  }
  return idx;
}

function planPhase(week: LMSBuildOutput['weeks'][number], totalWeeks: number) {
  const macroPhase = week.macroPhase;
  if (macroPhase && ['endurance', 'strength', 'peak', 'competition', 'transition'].includes(macroPhase)) {
    return macroPhaseToLmsPhase(macroPhase as MacroPhase);
  }
  return mesocyclePhaseForWeek(week.week, totalWeeks);
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
  if (!Number.isFinite(fallbackPm) || fallbackPm <= 0) {
    throw new Error('computePLPlanFeedback: fallbackPm must be > 0');
  }
  const lastWeek = plan.weeks[plan.weeks.length - 1];
  if (!lastWeek) return [];
  const idx = buildLastResultIndex(sessions);
  const out: PLExerciseFeedback[] = [];
  const weekNum = lastWeek.week;
  const totalWeeks = plan.weeks.length;

  for (const day of lastWeek.days) {
    for (const ex of day.exercises) {
      const key = normName(ex.name);
      // fuzzy match: ищем по точному ключу, иначе по токенам + includes
      let last: PLExerciseLastResult | null = idx.get(key) || null;
      if (!last) {
        // P1-fix: previous logic required BOTH token overlap AND substring includes,
        // causing false negatives ("жим лёжа" vs "жим штанги лёжа": overlap OK but
        // "жим штанги лёжа".includes("жим лёжа") is false) and false positives
        // ("жим" vs "жим гантелей стоя": overlap 1/1 + includes → matched as bench).
        // New logic: require token overlap >= 2 OR (overlap >= 1 AND both names share
        // the same core lifting keyword, excluding generic tokens like "жим"/"тяга").
        const candidates = [...idx.entries()].filter(([k]) => {
          if (k.length <= 2 || key.length <= 2) return false;
          const keyTokens = key.split(' ').filter(t => t.length > 2);
          const candidateTokens = k.split(' ').filter(t => t.length > 2);
          if (keyTokens.length === 0 || candidateTokens.length === 0) return false;
          const candidateSet = new Set(candidateTokens);
          const overlap = keyTokens.filter(token => candidateSet.has(token)).length;
          const minSize = Math.min(keyTokens.length, candidateTokens.length);
          // Strong match: 2+ meaningful tokens overlap (e.g., "жим лёжа" ↔ "жим штанги лёжа")
          if (overlap >= 2 && overlap >= minSize) return true;
          // Weak match: 1 token overlap + substring, but ONLY for names with 2+ tokens
          // (avoids "жим" alone matching "жим гантелей стоя")
          if (overlap >= 1 && keyTokens.length >= 2 && candidateTokens.length >= 2 && (k.includes(key) || key.includes(k))) return true;
          return false;
        });
        if (candidates.length === 1) last = candidates[0][1];
      }

      const plannedWeight = ex.workSets[0]?.weight ?? 0;
      const plannedReps = ex.workSets[0]?.reps ?? 5;
      const plannedRir = ex.workSets[0]?.rir ?? 2;
      const maxWeight = Number.isFinite(ex.pm) && ex.pm > 0 ? ex.pm : fallbackPm;

      let rirDelta: number | null = null;
      let recommendation: PLExerciseFeedback['recommendation'];

      if (last) {
        rirDelta = last.actualRir - plannedRir;
        // prescribeLoad с plannedRir — success-aware коррекция
        const phase = planPhase(lastWeek, totalWeeks);
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
        const phase = planPhase(lastWeek, totalWeeks);
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
