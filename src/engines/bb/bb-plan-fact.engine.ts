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
import { epley1RM } from '../e1rm';

/** G9: predicted-vs-actual по СИЛЕ (e1RM) — аддитивный блок плана-против-факта. */
export interface BBStrengthFactRow {
  /** Канонический ключ мышцы. */
  muscle: string;
  /** Плановый e1RM (Epley от топ-сета последней рабочей недели, кг). */
  plannedE1rm: number;
  /** Фактический e1RM из дневника (максимум за окно плана), null — нет факта. */
  actualE1rm: number | null;
  /** Дельта факта к плану, %. null — нет факта. */
  deltaPct: number | null;
  /** Сколько календарных недель плана дали факт по этой мышце. */
  weeksWithFact: number;
  /** Число разных упражнений, сведённых в строку. */
  exercises: number;
}

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
  /**
   * G9: предсказанная vs фактическая СИЛА. План неявно задаёт кривую e1RM (каждый
   * сет = weightForRepMax), но раньше она не материализовывалась и не сверялась с
   * дневником — последнее звено измерения отсутствовало. Здесь только ОТОБРАЖЕНИЕ.
   */
  strength?: {
    byMuscle: Record<string, BBStrengthFactRow>;
    /** Средневзвешенная дельта по всем мышцам с фактом (%), null — факта нет. */
    overallDeltaPct: number | null;
    /** Суммарно плановый/фактический e1RM по охваченным мышцам. */
    plannedE1rmTotal: number;
    actualE1rmTotal: number;
  };
}

type FactLikeExercise = { sets?: Array<{ reps?: number; weight?: number; rir?: number }>; workSets?: Array<{ reps?: number; weight?: number; rir?: number }>; muscle?: string };
type FactLikeSession = { date: string; exercises?: Array<{ muscleGroup?: string; exerciseName?: string; name?: string; sets?: Array<{ reps?: number; weightKg?: number; rir?: number }> }>; totalSets?: number; totalVolume?: number };
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

/** Нормализация имени упражнения для матчинга план↔дневник. */
function normExerciseName(name: unknown): string {
  return String(name ?? '')
    .toLowerCase()
    .replace(/ё/g, 'е')
    .replace(/[()\[\].,/\\-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Топ-сет упражнения: сет с максимальным e1RM (Epley), а не просто весом. */
function topSetE1rm(sets: Array<{ reps?: number; weight?: number; weightKg?: number; rir?: number }> | undefined): number | null {
  if (!Array.isArray(sets) || sets.length === 0) return null;
  let best: number | null = null;
  for (const s of sets) {
    const w = Number((s as any).weight ?? (s as any).weightKg ?? 0);
    const r = Number(s.reps ?? 0);
    if (!Number.isFinite(w) || !Number.isFinite(r) || w <= 0 || r <= 0) continue;
    const e = epley1RM(w, r);
    if (Number.isFinite(e) && e > 0 && (best == null || e > best)) best = e;
  }
  return best;
}

/**
 * G9: predicted-vs-actual e1RM по мышцам.
 *
 * План: e1RM от топ-сета каждого упражнения последней РАБОЧЕЙ недели (baseline —
 * ближайшая к концу неделя, где спортсмен реально работает; делод/тапер не цель).
 * Факт: максимум e1RM среди записей дневника за окно плана, сматченных по имени
 * упражнения (разные дни недели — один ключ).
 *
 * Возвращает null, если в плане нет вычислимых весов (bodyweight-only, workMax
 * не заполнен) — тогда «предсказания нет» честнее выдуманного нуля.
 */
function buildStrengthFact(
  plan: FactLikePlan,
  sessions: FactLikeSession[],
  start: string,
): BBPlanFact['strength'] | undefined {
  const weeks = plan.weeks || [];
  if (!weeks.length) return undefined;
  // Последняя рабочая неделя = ближайшая к концу не-deload/taper.
  const isRest = (w: any): boolean =>
    w?.deload === true || String(w?.phase || '').toLowerCase() === 'deload' || (w as any).taper === true || (w as any).taperApplied === true;
  const workingWeeks = weeks.map((w, i) => ({ w, i })).filter(({ w }) => !isRest(w));
  const source = workingWeeks.length ? workingWeeks[workingWeeks.length - 1] : { w: weeks[weeks.length - 1], i: weeks.length - 1 };

  // План → muscle → {e1rm, names}
  const plannedByMuscle: Record<string, { e1rm: number; names: Set<string> }> = {};
  for (const s of (source as any).w.sessions || []) for (const ex of s.exercises || []) {
    if ((ex as any).warmupActivator) continue;
    const m = normMuscle(ex.muscle || '');
    if (!m) continue;
    const e = topSetE1rm((ex.workSets ?? ex.sets) as any);
    if (e == null) continue;
    const nm = normExerciseName((ex as any).exerciseName || (ex as any).name);
    if (!nm) continue;
    if (!plannedByMuscle[m]) plannedByMuscle[m] = { e1rm: 0, names: new Set() };
    plannedByMuscle[m].e1rm = Math.max(plannedByMuscle[m].e1rm, e);
    plannedByMuscle[m].names.add(nm);
  }
  if (!Object.keys(plannedByMuscle).length) return undefined;

  // Факт → имя упражнения → max e1RM (за всё окно плана).
  const factByName: Record<string, number> = {};
  for (const sess of (sessions || []).filter(Boolean)) {
    const d = String(sess?.date || '');
    if (!d) continue;
    for (const ex of sess.exercises || []) {
      const nm = normExerciseName(ex.exerciseName ?? (ex as any).name);
      if (!nm) continue;
      const e = topSetE1rm(ex.sets as any);
      if (e == null) continue;
      factByName[nm] = Math.max(factByName[nm] ?? 0, e);
    }
  }

  const byMuscle: Record<string, BBStrengthFactRow> = {};
  let plannedTotal = 0, actualTotal = 0, wSum = 0;
  for (const [muscle, p] of Object.entries(plannedByMuscle)) {
    // Факт по мышце: лучший совпавший по имени; имя без факта не даёт null-лжи.
    let actual: number | null = null;
    let names = 0, weeksHit = new Set<string>();
    for (const nm of p.names) {
      const v = factByName[nm];
      if (v == null || v <= 0) continue;
      names++;
      actual = actual == null ? v : Math.max(actual, v);
    }
    // weeksWithFact: сколько календарных недель плана содержали факт по этим именам.
    if (names > 0) {
      weeks.forEach((wk, i) => {
        const ws = addDaysIso(start, i * 7), we = addDaysIso(ws, 6);
        const hit = (sessions || []).filter(Boolean).some((sess: any) => {
          const d = String(sess?.date || '');
          if (d < ws || d > we) return false;
          return (sess?.exercises || []).some((ex: any) => {
            const nm = normExerciseName(ex.exerciseName ?? (ex as any).name);
            return !!nm && p.names.has(nm) && (factByName[nm] ?? 0) > 0;
          });
        });
        if (hit) weeksHit.add(String(i));
      });
    }
    const deltaPct = actual != null && p.e1rm > 0 ? Math.round(((actual - p.e1rm) / p.e1rm) * 1000) / 10 : null;
    byMuscle[muscle] = {
      muscle, plannedE1rm: Math.round(p.e1rm * 10) / 10,
      actualE1rm: actual != null ? Math.round(actual * 10) / 10 : null,
      deltaPct, weeksWithFact: weeksHit.size, exercises: names,
    };
    plannedTotal += p.e1rm;
    if (actual != null) { actualTotal += actual; wSum += p.e1rm; }
  }
  const overallDeltaPct = wSum > 0 && actualTotal > 0
    ? Math.round(((actualTotal - wSum) / wSum) * 1000) / 10
    : null;
  return {
    byMuscle,
    overallDeltaPct,
    plannedE1rmTotal: Math.round(plannedTotal * 10) / 10,
    actualE1rmTotal: Math.round(actualTotal * 10) / 10,
  };
}

/**
 * Построить «план vs факт» для BB-плана.
 * @param plan  — собранный BBPlan (weeks[].sessions[].exercises[]).
 * @param sessions — дневник WorkoutLog.
 * @param planStartWeek — ISO-дата недели 1 (по умолчанию сегодня).
 */
export function buildBBPlanFact(plan: FactLikePlan, sessions: FactLikeSession[], planStartWeek?: string): BBPlanFact {
  const start = planStartWeek || todayIso();
  // G9: единая нормализация дневника - null/undefined записи не роняют расчёт.
  sessions = (Array.isArray(sessions) ? sessions : []).filter(Boolean) as FactLikeSession[];
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
  for (const sess of (sessions || []).filter(Boolean)) {
    const d = String(sess?.date || '');
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
      if (Number.isFinite(sess.totalSets) && (sess.totalSets as number) > 0) sSets = sess.totalSets as number;
      if (Number.isFinite(sess.totalVolume) && (sess.totalVolume as number) > 0) sTonn = sess.totalVolume as number;
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
  for (const sess of (sessions || []).filter(Boolean)) {
    const d = String(sess?.date || '');
    if (d < start || d > planEnd) unmatchedSessions.push({ date: d, sets: Number(sess.totalSets) || (sess.exercises?.reduce((a, e) => a + (e.sets?.length || 0), 0) || 0) });
  }

  const plannedTotalSets = weeks.reduce((a, w) => a + w.planned.sets, 0);
  const actualTotalSets = weeks.reduce((a, w) => a + w.actual.sets, 0);
  const overallAdherence = plannedTotalSets > 0 ? Math.min(1.5, actualTotalSets / plannedTotalSets) : 0;

  // G9: предсказанная vs фактическая сила (только отображение, план не мутирует).
  let strength: BBPlanFact['strength'];
  try { strength = buildStrengthFact(plan, sessions || [], start); } catch { strength = undefined; }

  return { weeks, overallAdherence, byMuscle, unmatchedSessions, plannedTotalSets, actualTotalSets, strength };
}

/** Бейдж силы факт↔план для UI (G9). */
export function bbStrengthBadge(deltaPct: number | null): { label: string; color: string } {
  if (deltaPct == null) return { label: '· нет факта', color: 'rgba(255,255,255,0.4)' };
  if (deltaPct >= 2) return { label: `✅ +${deltaPct.toFixed(1)}%`, color: '#00e68a' };
  if (deltaPct <= -3) return { label: `🔻 ${deltaPct.toFixed(1)}%`, color: '#f87171' };
  return { label: `• ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%`, color: '#fbbf24' };

}

export function bbPlanFactSummary(fact: BBPlanFact): string {
  if (!fact.weeks.length) return 'Нет данных плана';
  const done = fact.weeks.filter(w => w.actual.sessions > 0).length;
  const pct = Math.round(fact.overallAdherence * 100);
  // G9: сила — вторая половина сводки (объём + сила, а не только сеты).
  const s = fact.strength;
  if (s && s.overallDeltaPct != null) {
    const sign = s.overallDeltaPct >= 0 ? '+' : '';
    return `Факт: ${fact.actualTotalSets}/${fact.plannedTotalSets} сетов (${pct}%), ${done}/${fact.weeks.length} нед с данными · сила ${sign}${s.overallDeltaPct.toFixed(1)}% к плану`;
  }
  return `Факт: ${fact.actualTotalSets}/${fact.plannedTotalSets} сетов (${pct}%), ${done}/${fact.weeks.length} нед с данными`;
}

/** Бейдж adherence недели для UI. */
export function bbAdherenceBadge(adherence: number): { label: string; color: string } {
  if (adherence >= 0.9) return { label: '✅ в плане', color: '#00e68a' };
  if (adherence >= 0.6) return { label: '⚠ частично', color: '#fbbf24' };
  if (adherence > 0) return { label: '🔻 низко', color: '#f87171' };
  return { label: '· нет данных', color: 'rgba(255,255,255,0.4)' };
}
