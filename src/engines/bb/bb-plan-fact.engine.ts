/**
 * bb-plan-fact.engine.ts — «План живёт в сессии» (Epic B', план BB-AUTO-PROFESSIONAL-AUDIT).
 *
 * Сопоставляет ПЛАНОВЫЕ сеты/тоннаж/RIR каждого мезоцикла ББ-плана с ФАКТИЧЕСКИМИ
 * данными дневника (WorkoutLog) по календарным датам недели (неделя 1 = planStartWeek).
 *
 * Назначение: наглядный дашборд «план vs факт» — adherence по неделям, per-muscle
 * покрытие, где план расходится с реальностью. Это UX-слой поверх УЖЕ замкнутого
 * контура (buildBBPlan автоматически применяет applyFeedbackToBuild/applyDiaryVolumeCorrection);
 * здесь только ОТОБРАЖЕНИЕ, движок не мутирует.
 *
 * Капы не меняются — сравнение, не коррекция.
 */

import { normMuscle } from '../volume-landmarks.engine';

export interface BBWeekFactRow {
  weekNumber: number;
  startDate: string;
  endDate: string;
  phase?: string;
  planned: { sets: number; tonnage: number; avgRir: number };
  actual: { sets: number; tonnage: number; avgRir: number; sessions: number; adherence: number };
}

export interface BBPlanFact {
  weeks: BBWeekFactRow[];
  /** Общая adherence по сетам (факт/план, срез 0..1.5). */
  overallAdherence: number;
  /** Per-muscle покрытие (канонические EN-ключи). */
  byMuscle: Record<string, { plannedSets: number; actualSets: number; adherence: number }>;
  /** Сессии дневника, не попавшие ни в одну неделю плана. */
  unmatchedSessions: { date: string; sets: number }[];
  plannedTotalSets: number;
  actualTotalSets: number;
}

type FactLikeExercise = { sets?: Array<{ reps?: number; weight?: number; rir?: number }>; workSets?: Array<{ reps?: number; weight?: number; rir?: number }>; muscle?: string };
type FactLikeSession = { date: string; exercises?: Array<{ muscleGroup?: string; sets?: Array<{ reps?: number; weightKg?: number; rir?: number }> }>; totalSets?: number; totalVolume?: number };
type FactLikePlan = { weeks: Array<{ week: number; phase?: string; sessions: Array<{ exercises: FactLikeExercise[] }> }> };

function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function addDaysIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  d.setDate(d.getDate() + days);
  return toLocalIso(d);
}

function todayIso(): string {
  return toLocalIso(new Date());
}

function setCount(ex: FactLikeExercise): number {
  return Math.max(0, ex.workSets?.length ?? ex.sets?.length ?? 0);
}

function exTonnage(ex: FactLikeExercise): number {
  let t = 0;
  const sets = ex.workSets ?? ex.sets ?? [];
  for (const s of sets) {
    const w = Number(s.weight ?? 0);
    const r = Number(s.reps ?? 0);
    if (w > 0 && r > 0) t += w * r;
  }
  return t;
}

function exAvgRir(ex: FactLikeExercise): number {
  const sets = ex.workSets ?? ex.sets ?? [];
  const vals = sets.map(s => Number(s.rir)).filter(v => Number.isFinite(v) && v > 0);
  if (!vals.length) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/**
 * Построить «план vs факт» для BB-плана.
 * @param plan  — собранный BBPlan (weeks[].sessions[].exercises[]).
 * @param sessions — дневник WorkoutLog.
 * @param planStartWeek — ISO-дата недели 1 (по умолчанию сегодня).
 */
export function buildBBPlanFact(plan: FactLikePlan, sessions: FactLikeSession[], planStartWeek?: string): BBPlanFact {
  const start = planStartWeek || todayIso();
  const weeks: BBWeekFactRow[] = (plan.weeks || []).map((wk, i) => {
    const ws = addDaysIso(start, i * 7);
    const we = addDaysIso(ws, 6);
    let pSets = 0, pTonn = 0, pRirSum = 0, pRirN = 0;
    for (const s of wk.sessions || []) for (const ex of s.exercises || []) {
      const sc = setCount(ex);
      pSets += sc;
      pTonn += exTonnage(ex);
      const ar = exAvgRir(ex);
      if (ar > 0) { pRirSum += ar * sc; pRirN += sc; }
    }
    let aSets = 0, aTonn = 0, aRirSum = 0, aRirN = 0, aSessions = 0;
    for (const sess of sessions || []) {
      const d = String(sess.date || '');
      if (d < ws || d > we) continue;
      aSessions += 1;
      let sSets = 0, sTonn = 0, sRirSum = 0, sRirN = 0;
      for (const ex of sess.exercises || []) {
        const sets = ex.sets || [];
        sSets += sets.length;
        for (const st of sets) {
          const w = Number(st.weightKg ?? 0), r = Number(st.reps ?? 0);
          if (w > 0 && r > 0) sTonn += w * r;
          const rir = Number(st.rir);
          if (Number.isFinite(rir) && rir > 0) { sRirSum += rir; sRirN += 1; }
        }
      }
      if (Number.isFinite(sess.totalSets) && sess.totalSets > 0) sSets = sess.totalSets;
      if (Number.isFinite(sess.totalVolume) && sess.totalVolume > 0) sTonn = sess.totalVolume;
      aSets += sSets; aTonn += sTonn; aRirSum += sRirSum; aRirN += sRirN;
    }
    const adherence = pSets > 0 ? Math.min(1.5, aSets / pSets) : (aSets > 0 ? 1 : 0);
    return {
      weekNumber: wk.week ?? i + 1,
      startDate: ws,
      endDate: we,
      phase: wk.phase,
      planned: { sets: pSets, tonnage: pTonn, avgRir: pRirN ? pRirSum / pRirN : 0 },
      actual: {
        sets: aSets, tonnage: aTonn,
        avgRir: aRirN ? aRirSum / aRirN : 0,
        sessions: aSessions,
        adherence,
      },
    };
  });

  // Per-muscle покрытие: план (по мышце упражнения) vs факт (muscleGroup).
  const plannedByMuscle: Record<string, number> = {};
  for (const wk of plan.weeks || []) for (const s of wk.sessions || []) for (const ex of s.exercises || []) {
    const m = normMuscle(ex.muscle || '');
    if (m) plannedByMuscle[m] = (plannedByMuscle[m] || 0) + setCount(ex);
  }
  const actualByMuscle: Record<string, number> = {};
  for (const sess of sessions || []) for (const ex of sess.exercises || []) {
    const m = normMuscle(ex.muscleGroup || '');
    if (m) actualByMuscle[m] = (actualByMuscle[m] || 0) + (ex.sets?.length ?? 0);
  }
  const byMuscle: Record<string, { plannedSets: number; actualSets: number; adherence: number }> = {};
  const allMuscles = new Set([...Object.keys(plannedByMuscle), ...Object.keys(actualByMuscle)]);
  for (const m of allMuscles) {
    const p = plannedByMuscle[m] || 0, a = actualByMuscle[m] || 0;
    byMuscle[m] = { plannedSets: p, actualSets: a, adherence: p > 0 ? Math.min(1.5, a / p) : (a > 0 ? 1 : 0) };
  }

  // Непокрытые сессии дневника (вне диапазона недель плана).
  const planEnd = plan.weeks.length ? addDaysIso(start, (plan.weeks.length - 1) * 7 + 6) : start;
  const unmatchedSessions: { date: string; sets: number }[] = [];
  for (const sess of sessions || []) {
    const d = String(sess.date || '');
    if (d < start || d > planEnd) unmatchedSessions.push({ date: d, sets: Number(sess.totalSets) || (sess.exercises?.reduce((a, e) => a + (e.sets?.length || 0), 0) || 0) });
  }

  const plannedTotalSets = weeks.reduce((a, w) => a + w.planned.sets, 0);
  const actualTotalSets = weeks.reduce((a, w) => a + w.actual.sets, 0);
  const overallAdherence = plannedTotalSets > 0 ? Math.min(1.5, actualTotalSets / plannedTotalSets) : 0;

  return { weeks, overallAdherence, byMuscle, unmatchedSessions, plannedTotalSets, actualTotalSets };
}

/** Сводная строка «план vs факт» для UI (RU). */
export function bbPlanFactSummary(fact: BBPlanFact): string {
  if (!fact.weeks.length) return 'Нет данных плана';
  const done = fact.weeks.filter(w => w.actual.sessions > 0).length;
  const pct = Math.round(fact.overallAdherence * 100);
  return `Факт: ${fact.actualTotalSets}/${fact.plannedTotalSets} сетов (${pct}%), ${done}/${fact.weeks.length} нед с данными`;
}

/** Бейдж adherence недели для UI. */
export function bbAdherenceBadge(adherence: number): { label: string; color: string } {
  if (adherence >= 0.9) return { label: '✅ в плане', color: '#00e68a' };
  if (adherence >= 0.6) return { label: '⚠ частично', color: '#fbbf24' };
  if (adherence > 0) return { label: '🔻 низко', color: '#f87171' };
  return { label: '· нет данных', color: 'rgba(255,255,255,0.4)' };
}
