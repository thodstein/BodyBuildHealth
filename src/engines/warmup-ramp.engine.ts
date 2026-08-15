/**
 * Warmup Ramp Engine — единый канон разминочной пирамиды.
 *
 * Источник правды для ВСЕХ разминочных рамок проекта (раньше 5+ расходящихся
 * копий: bb-builder.buildWarmup, bb-loading-layer.buildGradedWarmup,
 * WarmupRampCard, ExecutionZone, ProgramEditorComponents).
 *
 * Канон (проф-тренерская пирамида):
 *   гриф 20кг×15 (если рабочий вес > 40кг) → 50%×10 → 70%×5 → 80%×3 (если > 60кг)
 *   → 90%×1 (если > 100кг). Изоляции и вес ≤ 0 — без разминки.
 *
 * @module warmup-ramp-engine
 */

export const BAR_WEIGHT = 20;

/** Шаги канона: pct от рабочего веса (0 = пустой гриф), reps, порог minWeight. */
export interface WarmupRampStep {
  /** 0 = пустой гриф, иначе доля рабочего веса. */
  pct: number;
  reps: number;
  /** Рабочий вес должен превышать порог (кг), иначе шаг пропускается. */
  minWeight?: number;
  /** Пустой гриф (20 кг). */
  bar?: boolean;
}

export const WARMUP_RAMP_STEPS: WarmupRampStep[] = [
  { bar: true, pct: 0, reps: 15, minWeight: BAR_WEIGHT * 2 },
  { pct: 0.5, reps: 10 },
  { pct: 0.7, reps: 5 },
  { pct: 0.8, reps: 3, minWeight: 60 },
  { pct: 0.9, reps: 1, minWeight: 100 },
];

export interface WarmupRampRow {
  /** Доля рабочего веса (0 = гриф). */
  pct: number;
  /** Вес шага, кг (гриф = BAR_WEIGHT). */
  load: number;
  reps: number;
  bar: boolean;
}

/**
 * Канон: разминочные шаги под рабочий вес compound-упражнения.
 * Совпадает с прежним bb-builder.buildWarmup (FIX-B5) по шагам и порогам.
 */
export function warmupRampFor(workWeight: number, isCompound = true): { load: number; reps: number }[] {
  if (!isCompound || !Number.isFinite(workWeight) || workWeight <= 0) return [];
  return activeRampRows(workWeight).map(r => ({ load: r.load, reps: r.reps }));
}

/** Строки активных шагов канона для веса (с процентом — для UI/печати). */
export function activeRampRows(workWeight: number): WarmupRampRow[] {
  if (!Number.isFinite(workWeight) || workWeight <= 0) return [];
  const rows: WarmupRampRow[] = [];
  for (const s of WARMUP_RAMP_STEPS) {
    if (s.minWeight !== undefined && workWeight <= s.minWeight) continue;
    rows.push({
      pct: s.pct,
      load: s.bar ? BAR_WEIGHT : Math.round(workWeight * s.pct),
      reps: s.reps,
      bar: !!s.bar,
    });
  }
  return rows;
}

/**
 * Человекочитаемая сводка рамки: «Гриф 20×15 → 50% (60кг)×10 → …».
 * Для пустого/невалидного веса возвращает ''.
 */
export function warmupRampSummary(workWeight: number): string {
  if (!Number.isFinite(workWeight) || workWeight <= 0) return '';
  const rows = activeRampRows(workWeight);
  if (rows.length === 0) return '';
  return rows
    .map(r => (r.bar ? `гриф ${r.load}кг×${r.reps}` : `${Math.round(r.pct * 100)}% (${r.load}кг)×${r.reps}`))
    .join(' → ');
}
