/**
 * pl-peak-cycle-taper.engine.ts — интеграция пиковых циклов ПЛ в ТАПЕР-пик ПЛ-авто.
 *
 * Задача: пиковые циклы (SRC period=peak) — это НЕ отдельный мир, а источники
 * канонической кривой тапера. Тапер-пик в «интеллектуальных тренировках»
 * (TaperPlannerTab + PeakingPanel) и в ПЛ-авто (lms-taper / lms-builder /
 * lms-macro-taper) должен соответствовать одному и тому же канону.
 *
 * Раньше:
 *  - пиковые циклы выбирались как обычный шаблон (buildLMSPlan faithful) — их
 *    последние недели имели собственный объём/intensity, но никак не влияли на
 *    кривую тапера (buildPLTaperCurve классика/pl/pro/wf).
 *  - про-тапер (pro/taper.engine) в TaperPlannerTab строил свою кривую
 *    taperCurve (P7) независимо от lms-taper — числа расходились.
 *
 * Теперь:
 *  - единый список пиковых циклов (getPeakCycles) — источник правды;
 *  - buildPeakCycleTaperCurve(cycleId, taperWeeks, weightGoal) — каноническая
 *    кривая выводится ИЗ недель цикла (объём/intensity по фактическим сетам),
 *    нормализуется к первому тижню цикла как 100%, и через weightGoal
 *    учитывает сгонку (×0.9);
 *  - lms-taper.engine делегирует сюда, когда задан peakCycleId;
 *  - isPeakCycle / peakCycleSummary / peakCycleToTaperMode — для UI.
 *
 * Аддитивно: не меняет сигнатуры существующих вызовов без peakCycleId.
 */
import { LMS_CYCLES, getCycleById, normalizeCycleDirection } from '../../data/lms-cycles/lms-cycle-index';
import type { SRCycleTemplate } from '../../data/lms-cycles/lms-types';
import type { TaperCurvePoint, TaperMode, TaperWeightGoal } from './lms-taper.engine';
import { buildPLTaperCurve, buildPeakCycleTaperCurve } from './lms-taper.engine';

// Единый источник кривой — lms-taper.engine (раньше здесь жила дословная копия
// buildPeakCycleTaperCurve; ре-экспорт сохраняет старый API для потребителей).
export { buildPeakCycleTaperCurve };

export type PeakTaperMode = TaperMode;

/** Все ПЛ-пиковые циклы (period=peak, direction не BB). Единый реестр для UI и движка. */
export function getPeakCycles(): SRCycleTemplate[] {
  return LMS_CYCLES.filter(
    c => c.meta.period === 'peak' && normalizeCycleDirection(c.meta.direction) !== 'bodybuilding',
  );
}

/** Является ли цикл пиковым ПЛ? */
export function isPeakCycle(cycleId: string): boolean {
  const c = getCycleById(cycleId);
  return !!c && c.meta.period === 'peak' && normalizeCycleDirection(c.meta.direction) !== 'bodybuilding';
}

/** Короткая сводка для UI: заголовок + длина + уровень. */
export function peakCycleSummary(cycleId: string): string | null {
  const c = getCycleById(cycleId);
  if (!c || !isPeakCycle(cycleId)) return null;
  return `${c.meta.title} · ${c.meta.weeks} нед · ${c.meta.level}`;
}

/**
 * Режим тапера, наиболее близкий к пиковому циклу:
 *  - verkhoshansky / butenko_peak → pl (интенсификация к 100%, синглы);
 *  - шэйко-подобные peak → classic (разгрузка Bosquet);
 *  - короткие 3-нед пики → pl;
 *  - длинные 12-нед accumulation-пики (cycle-07) → classic длинный.
 * Эвристика для авто-подбора peakMode при выборе цикла.
 */
export function peakCycleToTaperMode(cycleId: string): TaperMode {
  const c = getCycleById(cycleId);
  if (!c) return 'classic';
  const id = c.meta.id;
  const title = (c.meta.title || '').toLowerCase();
  if (/verkhoshansky|верхошан|butenko|бутенко/.test(id + title)) return 'pl';
  if (c.meta.weeks <= 6) return 'pl';
  if (c.meta.weeks >= 12) return 'classic';
  return 'classic';
}

/** Рекомендуемое число тапер-недель для пикового цикла (последние N недель цикла с явным снижением объёма). */
export function peakCycleTaperWeeks(cycleId: string): number {
  const c = getCycleById(cycleId);
  if (!c) return 2;
  const w = c.meta.weeks;
  if (w <= 4) return Math.min(2, w - 1);
  if (w <= 6) return 3;
  return 4;
}

/**
 * Сводка соответствия: пиковый цикл → канонический тапер.
 * Для UI «Тапер пик в интеллектуальных тренировках должен соответствовать
 * Тапер-пику в ПЛ-авто» — показываем обе кривые рядом.
 */
export function peakCycleTaperCorrespondence(
  cycleId: string,
  opts?: { taperWeeks?: number; weightGoal?: TaperWeightGoal },
): { cycleCurve: TaperCurvePoint[]; canonicalCurve: TaperCurvePoint[]; mode: TaperMode } | null {
  const cycle = getCycleById(cycleId);
  if (!cycle || !isPeakCycle(cycleId)) return null;
  const taperWeeks = opts?.taperWeeks ?? peakCycleTaperWeeks(cycleId);
  const weightGoal = opts?.weightGoal ?? 'maintain';
  const mode = peakCycleToTaperMode(cycleId);
  const cycleCurve = buildPeakCycleTaperCurve(cycleId, taperWeeks, weightGoal);
  const canonicalCurve = buildPLTaperCurve({ taperWeeks, mode, weightGoal });
  return { cycleCurve, canonicalCurve, mode };
}
