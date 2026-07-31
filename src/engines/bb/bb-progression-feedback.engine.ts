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
import { EXERCISE_CATALOG } from '../../core/exercise-catalog';

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

/** Локальный collapseKey (без импорта из bb-builder для избежания circular). */
function collapseKeyLocal(muscle: string): string {
  if (muscle === 'delt_front' || muscle === 'delt_mid' || muscle === 'delt_rear') return 'shoulders';
  return muscle;
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
        // P1-7: передаём plannedRir для success-aware коррекции
        rec = prescribeLoad(strategy, last.topWeight, last.topReps, last.actualRir, maxW, lastWeek.week, tw, 'intensification', exType, ex.role, plannedRir);
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

// ═══════════════════════════════════════════════════════════════════════════
// P0-6 (audit 2026-07): Полный feedback-driven rebuild + auto-weakPoints +
// авто-replace по плато. Три функции, вызываемые из buildBBPlan.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * P0-6a: Применить факт-рекомендации ко ВСЕМ неделям плана (не только последней).
 *
 * Для каждой недели берём факт из дневника (если есть) и пересчитываем веса/RIR
 * через prescribeLoad с фактом как «current». Если факта для упражнения нет —
 * оставляем плановые веса. Прогрессия накапливается: неделя 2 берёт факт недели 1,
 * неделя 3 — факт недели 2 (если есть), и т.д.
 *
 * Если sRPE-сессий нет — возвращаем план без изменений.
 */
export function applyFeedbackToBuild(
  plan: BBPlan,
  sessions: WorkoutSession[],
  workMax: Record<string, number>,
  strategy: LoadStrategy = 'double_progression',
): BBPlan {
  if (!sessions || sessions.length === 0 || plan.weeks.length === 0) return plan;
  const lastIndex = buildLastResultIndex(sessions);
  if (lastIndex.size === 0) return plan;
  const tw = plan.weeks.length;

  const newWeeks = plan.weeks.map((wk, wIdx) => {
    if (wIdx === 0) return wk; // неделя 1 — без факта (нет предыдущей)
    if ((wk as any).deload || String((wk as any).phase || '').toLowerCase() === 'deload') return wk;
    const newSessions = wk.sessions.map(s => ({
      ...s,
      exercises: s.exercises.map((ex: BBExercise) => {
        const key = normName(ex.name || ex.exerciseName || '');
        const last = lastIndex.get(key);
        if (!last) return ex; // нет факта — плановые веса
        const plannedReps = ex.repsRange?.[0] ?? (ex.workSets?.[0]?.reps ?? 10);
        const plannedRir = ex.rir ?? 2;
        const maxW = workMax[ex.muscle] || last.topWeight || 80;
        const exType = ex.role === 'primary' ? 'compound' : 'isolation';
        // P1-7: prescribeLoad с фактом + plannedRir для success-aware коррекции
        const phase = ((wk as any).phase || 'intensification') as any;
        const rec = prescribeLoad(strategy, last.topWeight, last.topReps, last.actualRir, maxW, wk.week, tw, phase, exType, ex.role, plannedRir);
        const rirDelta = last.actualRir - plannedRir;
        const comment = (ex.comment || '') + ` | ↻ из факта: ${last.topWeight}×${last.topReps} RIR${last.actualRir} → ${rec.nextWeight}×${rec.nextReps} RIR${rec.nextRIR}`;
        return {
          ...ex,
          rir: rec.nextRIR,
          workSets: (ex.workSets || []).map((ws, i) =>
            i === 0
              ? { ...ws, weight: rec.nextWeight, reps: rec.nextReps, rir: rec.nextRIR }
              : { ...ws, rir: rec.nextRIR }
          ),
          comment,
        };
      }),
    }));
    return { ...wk, sessions: newSessions };
  });

  return { ...plan, weeks: newWeeks };
}

/**
 * P0-6b: Авто-обновление weakPoints на основе e1RM-тренда из дневника.
 *
 * Для каждой слабой группы: считаем e1RM 4+ нед назад и текущий e1RM.
 * - Рост ≥10% → группа больше не слабая (достигнуто) → удаляем из weakPoints.
 * - Падение ≥5% → группа стала слабее → добавляем (если ещё не в списке).
 *
 * Возвращает обновлённый weakPoints + список изменений для rationale.
 */
export function autoUpdateWeakPoints(
  weakPoints: string[],
  sessions: WorkoutSession[],
  workMax: Record<string, number>,
): { weakPoints: string[]; changes: string[] } {
  if (!sessions || sessions.length < 4) return { weakPoints, changes: [] };

  // Группируем сессии по неделям (по дате), берём e1RM топ-упражнения каждой мышцы
  const sorted = [...sessions].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const muscleE1rmByWeek: Record<string, number[]> = {}; // muscle → [e1rm week1, week2, ...]

  for (const s of sorted) {
    for (const ex of s.exercises || []) {
      const muscle = ex.muscleGroup || '';
      if (!muscle) continue;
      const top = topSetOf(ex);
      if (!top || top.weight <= 0) continue;
      const e1 = e1rm(top.weight, top.reps);
      if (e1 <= 0) continue;
      if (!muscleE1rmByWeek[muscle]) muscleE1rmByWeek[muscle] = [];
      muscleE1rmByWeek[muscle].push(e1);
    }
  }

  const changes: string[] = [];
  const updated = [...weakPoints];

  // Для каждой weak группы: проверяем тренд
  for (const wp of weakPoints) {
    const series = muscleE1rmByWeek[wp];
    if (!series || series.length < 4) continue; // недостаточно данных
    const first = series[0];
    const last = series[series.length - 1];
    if (first <= 0) continue;
    const growthPct = ((last - first) / first) * 100;
    if (growthPct >= 10) {
      // Достигнуто — убрать из weakPoints
      const idx = updated.indexOf(wp);
      if (idx >= 0) {
        updated.splice(idx, 1);
        changes.push(`✅ ${wp}: e1RM вырос на ${growthPct.toFixed(1)}% за ${series.length} нед — убрана из слабых групп (цель достигнута).`);
      }
    }
  }

  // Для НЕ-слабых групп: проверяем падение
  const allMuscles = Object.keys(muscleE1rmByWeek);
  for (const m of allMuscles) {
    if (updated.includes(m)) continue; // уже слабая
    const series = muscleE1rmByWeek[m];
    if (!series || series.length < 4) continue;
    const first = series[0];
    const last = series[series.length - 1];
    if (first <= 0) continue;
    const declinePct = ((first - last) / first) * 100;
    if (declinePct >= 5) {
      updated.push(m);
      changes.push(`⚠ ${m}: e1RM упал на ${declinePct.toFixed(1)}% за ${series.length} нед — добавлена в слабые группы (регресс).`);
    }
  }

  return { weakPoints: updated, changes };
}

/**
 * P0-6c: Авто-замена упражнений при плато (e1RM не растёт 4+ нед).
 *
 * Для каждого упражнения в плане: ищем e1RM-серию в дневнике.
 * Если e1RM не растёт ≥4 нед (±2% — стабильна) → заменяем на альтернативу
 * через findSubstitutions. Если альтернативы нет — оставляем.
 *
 * Возвращает обновлённый план + список замен для rationale.
 */
export function autoReplaceOnPlateau(
  plan: BBPlan,
  sessions: WorkoutSession[],
): { plan: BBPlan; changes: string[] } {
  if (!sessions || sessions.length < 6 || plan.weeks.length === 0) {
    return { plan, changes: [] };
  }

  // Строим e1RM-серию по нормализованному имени упражнения
  const sorted = [...sessions].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const exerciseE1rmSeries: Map<string, number[]> = new Map();
  for (const s of sorted) {
    for (const ex of s.exercises || []) {
      const key = normName(ex.exerciseName || '');
      if (!key) continue;
      const top = topSetOf(ex);
      if (!top || top.weight <= 0) continue;
      const e1 = e1rm(top.weight, top.reps);
      if (e1 <= 0) continue;
      if (!exerciseE1rmSeries.has(key)) exerciseE1rmSeries.set(key, []);
      exerciseE1rmSeries.get(key)!.push(e1);
    }
  }

  const changes: string[] = [];
  const plateauExercises = new Set<string>();

  // Определяем плато-упражнения
  for (const [name, series] of exerciseE1rmSeries) {
    if (series.length < 4) continue;
    const first = series[0];
    const last = series[series.length - 1];
    if (first <= 0) continue;
    const growthPct = Math.abs(((last - first) / first) * 100);
    if (growthPct < 2) {
      // e1RM стабильна ±2% за 4+ нед → плато
      plateauExercises.add(name);
    }
  }

  if (plateauExercises.size === 0) return { plan, changes: [] };

  // Заменяем упражнения в плане (только primary — accessory не критично)
  const newWeeks = plan.weeks.map(wk => ({
    ...wk,
    sessions: wk.sessions.map(s => ({
      ...s,
      exercises: s.exercises.map((ex: BBExercise) => {
        const key = normName(ex.name || ex.exerciseName || '');
        if (!plateauExercises.has(key)) return ex;
        if (ex.role !== 'primary') return ex; // только primary
        // Ищем альтернативу по той же мышце, compound, ДРУГОЕ имя (не исходное)
        const origName = ex.name || ex.exerciseName || '';
        const origNorm = normName(origName);
        const alternatives = (EXERCISE_CATALOG as any[]).filter((e: any) => {
          if (e.id === origName || normName(e.name || '') === origNorm) return false;
          const mg = e.group || e.muscleGroup || '';
          if (mg !== ex.muscle && mg !== collapseKeyLocal(ex.muscle)) return false;
          if (e.type !== 'compound' && e.exerciseType !== 'compound') return false;
          return true;
        });
        if (alternatives.length === 0) return ex;
        const sub = alternatives[0];
        const subName = sub.name || sub.id;
        changes.push(`🔄 ${origName} → ${subName}: e1RM на плато 4+ нед, замена для нового стимула.`);
        return {
          ...ex,
          name: subName,
          exerciseName: subName,
          comment: (ex.comment || '') + ` | 🔄 Замена по плато: ${origName} → ${subName} (e1RM стабилен 4+ нед).`,
          rationale: 'Авто-замена: e1RM на плато, нужна новая вариация для стимула.',
        };
      }),
    })),
  }));

  return { plan: { ...plan, weeks: newWeeks }, changes: [...new Set(changes)] };
}

/**
 * Per-muscle ACWR — соотношение объёма текущей недели к 4-недельному среднему
 * по КАЖДОЙ мышце отдельно (не общий sRPE-ACWR).
 *
 * Для ББ per-muscle sets ratio релевантнее общего тоннажа: одна мышца может
 * быть перетренирована (chest ACWR 1.8) при нормальном общем ACWR (1.2).
 *
 * @param sessions — WorkoutSession[] из дневника
 * @returns Record<muscle, { ratio, zone }> — per-muscle ACWR + зона (optimal/caution/danger)
 */
export function computePerMuscleACWR(
  sessions: WorkoutSession[],
): Record<string, { ratio: number; zone: 'undertrained' | 'optimal' | 'caution' | 'danger' }> {
  if (!sessions || sessions.length < 4) return {};

  // Группируем сессии по неделям (ISO week start Monday)
  const weekKey = (dateStr: string): string => {
    const d = new Date(dateStr);
    const day = d.getDay() || 7; // 0=Sunday → 7
    d.setDate(d.getDate() - (day - 1)); // понедельник
    return d.toISOString().slice(0, 10);
  };

  // muscle → week → total sets
  const muscleWeekSets: Record<string, Record<string, number>> = {};
  for (const s of sessions) {
    const wk = weekKey(s.date);
    for (const ex of s.exercises || []) {
      const muscle = ex.muscleGroup || '';
      if (!muscle) continue;
      if (!muscleWeekSets[muscle]) muscleWeekSets[muscle] = {};
      muscleWeekSets[muscle][wk] = (muscleWeekSets[muscle][wk] || 0) + (ex.sets?.length || 0);
    }
  }

  // Для каждой мышцы: текущая неделя vs 4-нед среднее
  const result: Record<string, { ratio: number; zone: 'undertrained' | 'optimal' | 'caution' | 'danger' }> = {};
  const allWeeks = [...new Set(sessions.map(s => weekKey(s.date)))].sort();
  const recentWeeks = allWeeks.slice(-5); // последние 5 нед (1 текущая + 4 для chronic)
  if (recentWeeks.length < 2) return {};

  const currentWeek = recentWeeks[recentWeeks.length - 1];
  const chronicWeeks = recentWeeks.slice(0, -1).slice(-4); // 4 нед до текущей

  for (const [muscle, weekSets] of Object.entries(muscleWeekSets)) {
    const currentSets = weekSets[currentWeek] || 0;
    const chronicAvg = chronicWeeks.length > 0
      ? chronicWeeks.reduce((sum, wk) => sum + (weekSets[wk] || 0), 0) / chronicWeeks.length
      : 0;
    if (chronicAvg < 1) continue; // недостаточно данных
    const ratio = currentSets / chronicAvg;
    let zone: 'undertrained' | 'optimal' | 'caution' | 'danger' = 'optimal';
    if (ratio < 0.8) zone = 'undertrained';
    else if (ratio > 1.5) zone = 'danger';
    else if (ratio > 1.3) zone = 'caution';
    result[muscle] = { ratio: Math.round(ratio * 100) / 100, zone };
  }

  return result;
}
