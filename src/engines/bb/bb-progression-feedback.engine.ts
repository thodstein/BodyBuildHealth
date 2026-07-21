/**
 * bb-progression-feedback.engine.ts — замыкание цикла «дневник → план».
 *
 * Профессиональный тренер строит неделю N+1 не «по плану», а по ФАКТУ недели N:
 * если спортсмен выполнил 100×8 при RIR 0 (тяжелее, чем целевой RIR 2) →
 * вес растём; если RIR 4 (легче цели) → вес держим/снижаем. Это и есть
 * авто-регулируемая прогрессия, в отличие от слепой линейной.
 *
 * Источник факта: WorkoutSession[] (localStorage, SessionPlayer/дневник).
 * Для каждого упражнения плана (последняя неделя) находим последнюю запись
 * в дневнике по имени → считаем e1RM, фактический RIR vs целевого,
 * тоннаж — и выдаём рекомендацию на следующую неделю (вес/повт/RIR + текст).
 *
 * Рекомендация считается через prescribeLoad (та же стратегия прогрессии,
 * что и в плане), но с «текущим» = ФАКТ, а не «плановым».
 */
import type { BBPlan, BBExercise } from './bb-builder.engine';
import type { WorkoutSession, WorkoutExercise, WorkoutSet } from '../workout-logger.engine';
import { prescribeLoad, type LoadStrategy } from './bb-autocoach.engine';

export interface ExerciseLastResult {
  exerciseName: string;
  date?: string;
  topWeight: number;
  topReps: number;
  actualRir: number;
  e1rm: number;
  totalVolume: number;
  setsDone: number;
}

export interface ExerciseFeedback {
  /** Ключ упражнения в плане (имя + мышца). */
  planKey: string;
  muscle: string;
  planExerciseName: string;
  /** Целевой вес/RIR плана на этой неделе. */
  plannedWeight: number;
  plannedReps: number;
  plannedRir: number;
  week: number;
  /** Последний факт из дневника (null — нет данных). */
  last: ExerciseLastResult | null;
  /** Рекомендация на следующую неделю (на основе факта, если есть; иначе — план). */
  recommendation: {
    nextWeight: number;
    nextReps: number;
    nextRir: number;
    label: string;
    /** Источник рекомендации: 'fact' — из дневника, 'plan' — нет данных, по плану. */
    source: 'fact' | 'plan';
  };
  /** Дельта фактического RIR vs целевого (отрицательная = тяжелее цели). */
  rirDelta: number | null;
}

/** Нормализация имени для сопоставления план↔дневник. */
function normName(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/[^a-zа-яё0-9 ]/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** e1RM (Epley) — для оценки прогрессии. */
function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return Math.round(weight / (1 - reps / 36));
}

/** Топ-сет сессии упражнения (максимальный по весу×повторения-прокси). */
function topSetOf(ex: WorkoutExercise): { weight: number; reps: number; rir: number } | null {
  if (!ex.sets || ex.sets.length === 0) return null;
  let best = ex.sets[0];
  for (const s of ex.sets) {
    if (s.weightKg * s.reps > best.weightKg * best.reps) best = s;
  }
  return { weight: best.weightKg, reps: best.reps, rir: best.rir };
}

/** Индекс последних результатов по нормализованному имени упражнения. */
function buildLastResultIndex(sessions: WorkoutSession[]): Map<string, ExerciseLastResult> {
  // sessions отсортированы по дате убыванию (loadSessions не гарантирует — сортируем)
  const sorted = [...sessions].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const idx = new Map<string, ExerciseLastResult>();
  for (const s of sorted) {
    for (const ex of s.exercises || []) {
      const key = normName(ex.exerciseName || '');
      if (!key || idx.has(key)) continue; // первое (=последнее по дате) вхождение
      const top = topSetOf(ex);
      if (!top) continue;
      idx.set(key, {
        exerciseName: ex.exerciseName || '',
        date: s.date,
        topWeight: top.weight,
        topReps: top.reps,
        actualRir: top.rir,
        e1rm: e1rm(top.weight, top.reps),
        totalVolume: ex.totalVolume || 0,
        setsDone: (ex.sets || []).length,
      });
    }
  }
  return idx;
}

/**
 * Рассчитать обратную связь плана с дневником.
 * @param plan — собранный BB-план (берём последнюю неделю).
 * @param sessions — выполненные сессии (localStorage/дневник).
 * @param workMax — рабочие максимумы для оценки.
 * @param strategy — стратегия прогрессии (та же, что в плане).
 * @param totalWeeks — длительность мезо (для prescribeLoad).
 */
export function computePlanFeedback(
  plan: BBPlan,
  sessions: WorkoutSession[],
  workMax: Record<string, number>,
  strategy: LoadStrategy = 'double_progression',
  totalWeeks?: number,
): ExerciseFeedback[] {
  const lastWeek = plan.weeks[plan.weeks.length - 1];
  if (!lastWeek) return [];
  const lastIndex = buildLastResultIndex(sessions);
  const tw = totalWeeks ?? plan.weeks.length;
  const out: ExerciseFeedback[] = [];

  for (const sess of lastWeek.sessions) {
    for (const ex of sess.exercises) {
      const key = normName(ex.name || ex.exerciseName || '');
      const last = lastIndex.get(key) || null;
      const plannedReps = ex.repsRange?.[0] ?? (ex.workSets?.[0]?.reps ?? 10);
      const plannedWeight = ex.workSets?.[0]?.weight ?? 0;
      const plannedRir = ex.rir ?? 2;
      const maxW = workMax[ex.muscle] || plannedWeight || 80;
      const exType = ex.role === 'primary' ? 'compound' : 'isolation';

      let rec;
      let rirDelta: number | null = null;
      let source: 'fact' | 'plan' = 'plan';
      if (last) {
        // Факт есть: кормим prescribeLoad фактом. RIR-дельта = факт − цель (минус = тяжелее).
        rirDelta = last.actualRir - plannedRir;
        rec = prescribeLoad(strategy, last.topWeight, last.topReps, last.actualRir, maxW, lastWeek.week, tw, 'intensification', exType, ex.role);
        source = 'fact';
      } else {
        // Нет факта: по плану (целевой вес/повт/RIR плана).
        rec = prescribeLoad(strategy, plannedWeight, plannedReps, plannedRir, maxW, lastWeek.week, tw, 'intensification', exType, ex.role);
        source = 'plan';
      }
      out.push({
        planKey: ex.muscle + '|' + (ex.name || ex.exerciseName || ''),
        muscle: ex.muscle,
        planExerciseName: ex.name || ex.exerciseName || '',
        plannedWeight, plannedReps, plannedRir,
        week: lastWeek.week,
        last,
        recommendation: { nextWeight: rec.nextWeight, nextReps: rec.nextReps, nextRir: rec.nextRIR, label: rec.label, source },
        rirDelta,
      });
    }
  }
  return out;
}

/** Применить рекомендацию к следующей неделе плана (клонирует неделю, правит веса/RIR). */
export function applyFeedbackToNextWeek(plan: BBPlan, feedback: ExerciseFeedback[]): BBPlan {
  if (plan.weeks.length === 0) return plan;
  // Клонируем последнюю неделю как основу для «следующей».
  const last = plan.weeks[plan.weeks.length - 1];
  const nextWeekNum = last.week + 1;
  const fbMap = new Map<string, ExerciseFeedback>();
  for (const f of feedback) if (f.last) fbMap.set(f.planKey, f);

  const newSessions: typeof last.sessions = last.sessions.map(s => ({
    ...s,
    exercises: s.exercises.map((ex: BBExercise) => {
      const key = ex.muscle + '|' + (ex.name || ex.exerciseName || '');
      const fb = fbMap.get(key);
      if (!fb) return ex;
      const nw = fb.recommendation.nextWeight;
      const nr = fb.recommendation.nextReps;
      const nrir = fb.recommendation.nextRir;
      return {
        ...ex,
        rir: nrir,
        workSets: (ex.workSets || []).map((ws, i) => i === 0 ? { ...ws, weight: nw, reps: nr, rir: nrir } : { ...ws, rir: nrir }),
        comment: (ex.comment || '') + ` | ↻ из факта: ${fb.last!.topWeight}×${fb.last!.topReps} RIR${fb.last!.actualRir} → ${nw}×${nr} RIR${nrir}`,
      };
    }),
  }));
  return { ...plan, weeks: [...plan.weeks, { week: nextWeekNum, sessions: newSessions }] };
}