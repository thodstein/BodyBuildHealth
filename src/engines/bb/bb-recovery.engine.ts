/**
 * bb-recovery.engine.ts — R1-R3 (план BB-AUTO-PROFESSIONAL-AUDIT).
 *
 * R1 — Rehab после травмы: фазовый возврат мышцы (−объём/−вес, −RIR, затем ramp к MEV).
 * R2 — Тоннаж-прогрессия между мезо: объём следующего мезо из фактического тоннажа
 *      предыдущих (Fitbod-парадигма: прогрессия по реальному объёму, не статичная таблица).
 * R3 — Overreaching-проверка deload: сравнить готовность до/после разгрузки — реально ли
 *      ушла усталость; если нет → «ещё deload / активное восстановление».
 *
 * Всё аддитивно и НЕ меняет капы: rehab/прогрессия/проверка — расчётные рекомендации,
 * применяются внутри существующих sessionLimitsFor. Объёмная модель не трогается.
 */

import { normMuscle } from '../volume-landmarks.engine';

// ── R1: Rehab после травмы ────────────────────────────────────────────────

export interface RehabPhase {
  /** Неделя плана, к которой относится фаза (1-based). */
  week: number;
  /** Множитель рабочего объёма целевой мышцы. */
  volumePct: number;
  /** Множитель веса. */
  weightPct: number;
  /** Сдвиг RIR вверх (больше запаса). */
  rirShift: number;
  label: string;
}

/** Протокол возврата мышцы (R1): 1-2 нед −50%, 3-4 нед −70%, 5+ нед −85%, затем полный объём. */
export function rehabProtocol(weekStart = 1): RehabPhase[] {
  return [
    { week: weekStart,       volumePct: 0.5, weightPct: 0.7, rirShift: 2, label: 'Фаза 1 — сниженный объём, лёгкий вес' },
    { week: weekStart + 1,   volumePct: 0.5, weightPct: 0.7, rirShift: 2, label: 'Фаза 1 — сниженный объём, лёгкий вес' },
    { week: weekStart + 2,   volumePct: 0.7, weightPct: 0.85, rirShift: 1, label: 'Фаза 2 — умеренный объём' },
    { week: weekStart + 3,   volumePct: 0.7, weightPct: 0.85, rirShift: 1, label: 'Фаза 2 — умеренный объём' },
    { week: weekStart + 4,   volumePct: 0.85, weightPct: 0.95, rirShift: 0.5, label: 'Фаза 3 — почти полный объём' },
    { week: weekStart + 5,   volumePct: 0.85, weightPct: 0.95, rirShift: 0.5, label: 'Фаза 3 — почти полный объём' },
  ];
}

/** Фаза возврата для конкретной недели (null — полный объём). */
export function rehabWeekForWeek(week: number, weekStart = 1): RehabPhase | null {
  const phase = rehabProtocol(weekStart).find(p => p.week === week);
  return phase || null;
}

/** Корректировка упражнения целевой мышцы в неделю rehab. */
export function rehabExerciseAdjustment(
  ex: { muscle?: string },
  week: number,
  injuredMuscles: string[],
  weekStart = 1,
): { volumeMult: number; weightMult: number; rirShift: number } | null {
  const m = normMuscle(ex.muscle || '');
  if (!injuredMuscles.some(im => normMuscle(im) === m)) return null;
  const phase = rehabWeekForWeek(week, weekStart);
  if (!phase) return null;
  return { volumeMult: phase.volumePct, weightMult: phase.weightPct, rirShift: phase.rirShift };
}

/** RU-строка протокола rehab для мышцы. */
export function rehabNotes(muscle: string, weekStart = 1): string {
  const phases = rehabProtocol(weekStart);
  return `🩹 Возврат «${muscle}»: ${phases.map(p => `нед ${p.week} ×${Math.round(p.volumePct * 100)}% об. / ×${Math.round(p.weightPct * 100)}% вес / RIR+${p.rirShift}`).join(' → ')}`;
}

// ── R2: Тоннаж-прогрессия между мезо ─────────────────────────────────────

type TonnagePlanLike = { weeks?: Array<{ sessions: Array<{ exercises: Array<{ workSets?: Array<{ weight?: number; reps?: number }>; sets?: number; muscle?: string }> }> }> };

/** Извлечь тоннаж (sets×reps×weight) по мышцам и суммарный. */
export function extractPlanTonnage(plan: TonnagePlanLike): { byMuscle: Record<string, number>; total: number } {
  const byMuscle: Record<string, number> = {};
  let total = 0;
  for (const wk of plan.weeks || []) for (const s of wk.sessions || []) for (const ex of s.exercises || []) {
    const m = normMuscle(ex.muscle || '');
    const sets = ex.workSets ?? [];
    const count = sets.length || Number(ex.sets) || 0;
    let ton = 0;
    for (const st of sets) {
      const w = Number(st.weight ?? 0), r = Number(st.reps ?? 0);
      if (w > 0 && r > 0) ton += w * r;
    }
    if (m) byMuscle[m] = (byMuscle[m] || 0) + (ton || count * 0);
    total += ton;
  }
  return { byMuscle, total };
}

/**
 * Тоннаж-прогрессия между мезо: рост суммарного тоннажа за серию предыдущих мезо.
 * Возвращает множитель для следующего мезо (1.0 = сохранить, >1 = прогрессировать,
 * <1 = де-загрузка). Ограничен 0.9..1.15 (консервативно, в рамках капов).
 */
export function tonnageProgression(prevPlans: TonnagePlanLike[]): number {
  if (!prevPlans || prevPlans.length < 2) return 1.0;
  const totals = prevPlans.map(extractPlanTonnage).map(t => t.total).filter(t => t > 0);
  if (totals.length < 2) return 1.0;
  const first = totals[0];
  const last = totals[totals.length - 1];
  if (first <= 0) return 1.0;
  const growth = last / first; // за весь период
  const perMeso = Math.pow(growth, 1 / (totals.length - 1)); // средний рост на мезо
  return Math.max(0.9, Math.min(1.15, perMeso));
}

/** Целевой объём следующего мезо из тоннаж-прогрессии (внутри капов). */
export function nextMesoVolumeTarget(prevPlans: TonnagePlanLike[], baseTarget: number): number {
  const mult = tonnageProgression(prevPlans);
  return Math.round(baseTarget * mult);
}

// ── R3: Overreaching-проверка deload ─────────────────────────────────────

export interface OverreachingCheckResult {
  cleared: boolean;
  readinessDelta: number;
  recommendation: string;
}

/**
 * Проверить, действительно ли deload снял усталость (readiness до vs после).
 * Считать «очищено», если готовность выросла ≥5 пунктов ИЛИ осталась высокой (>70).
 * Иначе — рекомендация «ещё разгрузка / активное восстановление».
 */
export function overreachingCheck(readinessBefore: number, readinessAfter: number, opts: { muscleSoreness?: number } = {}): OverreachingCheckResult {
  const before = Number.isFinite(readinessBefore) ? Math.max(0, Math.min(100, readinessBefore)) : 50;
  const after = Number.isFinite(readinessAfter) ? Math.max(0, Math.min(100, readinessAfter)) : before;
  const delta = after - before;
  const sorenessElevated = (opts.muscleSoreness ?? 0) >= 3;
  const cleared = (delta >= 5 || after > 70) && !sorenessElevated;
  let recommendation: string;
  if (cleared) {
    recommendation = `✅ Deload эффективен: готовность ${before}→${after} (${delta >= 0 ? '+' : ''}${delta}). Возвращайтесь к полному объёму.`;
  } else if (sorenessElevated) {
    recommendation = `⚠ Крепатура ещё высокая (${opts.muscleSoreness}/5) — добавьте активное восстановление (лёгкая аэробная, массаж) перед возвратом.`;
  } else {
    recommendation = `⚠ Готовность не выросла (${before}→${after}) — вероятен overreaching. Рекомендуется ещё одна разгрузочная неделя или снижение объёма на 20%.`;
  }
  return { cleared, readinessDelta: Math.round(delta), recommendation };
}
