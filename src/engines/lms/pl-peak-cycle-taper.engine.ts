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
import { buildPLTaperCurve } from './lms-taper.engine';

function weightGoalVolumeMult(goal: TaperWeightGoal | undefined): number {
  return goal === 'lose' ? 0.9 : 1;
}

export type PeakTaperMode = TaperMode;

const r2 = (v: number) => Math.round(v * 100) / 100;

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

function weekVolume(week: import('../../data/lms-cycles/lms-types').SRDaySpec[]): number {
  let v = 0;
  for (const d of week) for (const e of d.exercises) for (const s of e.sets) v += s.sets;
  return v;
}

function weekAvgIntensity(week: import('../../data/lms-cycles/lms-types').SRDaySpec[]): number {
  let sum = 0, n = 0;
  for (const d of week) for (const e of d.exercises) for (const s of e.sets) {
    sum += s.pct * s.sets;
    n += s.sets;
  }
  return n > 0 ? sum / n : 0.7;
}

/**
 * Построить каноническую кривую тапера ИЗ пикового цикла.
 *
 * Логика:
 *  - берём последние taperWeeks недель цикла (или первые, если цикл короткий);
 *  - считаем объём (сумма sets) и среднюю интенсивность (%PM) по каждому тижню;
 *  - объём нормализуем к макс. объёму цикла (пик = 1.0), интенсивность — как есть;
 *  - учитываем weightGoal (lose → ×0.9 к объёму, как в buildPLTaperCurve);
 *  - RIR выводим: интенсивность 90%+ → RIR 0-1, 80-90% → 1-2, ниже → 2.
 *  - Если цикл без weeks (только week1) — используем week1 объём как базу и
 *    генерируем классическую кривую 0.65/0.45 (fallback, чтобы не падать).
 *
 * Возвращает TaperCurvePoint[] совместимый с lms-taper.engine.
 */
export function buildPeakCycleTaperCurve(
  cycleId: string,
  taperWeeks = 2,
  weightGoal: TaperWeightGoal = 'maintain',
): TaperCurvePoint[] {
  const cycle = getCycleById(cycleId);
  if (!cycle) return [];
  const n = Math.max(1, Math.min(4, Math.round(taperWeeks)));
  const wGoalMult = weightGoalVolumeMult(weightGoal);
  const weightNote = weightGoal === 'lose' ? ' · сгонка: объём ×0.9' : weightGoal === 'gain' ? ' · набор: полный объём' : '';

  const weeks = cycle.weeks && cycle.weeks.length > 0 ? cycle.weeks : [cycle.week1];
  const vols = weeks.map(w => weekVolume(w));
  const intensities = weeks.map(w => weekAvgIntensity(w));
  const maxVol = Math.max(1, ...vols);
  // если объём цикла монотонный/плоский — используем классическую кривую как fallback
  const isFlat = vols.length >= 2 && Math.max(...vols) - Math.min(...vols) < 1;
  if (isFlat || vols.length === 1) {
    const fixed: Record<number, number[]> = { 1: [0.45], 2: [0.65, 0.45], 3: [0.85, 0.65, 0.45], 4: [0.85, 0.75, 0.60, 0.45] };
    const cur = fixed[n] ?? [0.65, 0.45];
    return cur.map((v, i) => {
      const rirShift = i === cur.length - 1 ? 2 : 1;
      return {
        week: i + 1,
        volumePct: r2(v * wGoalMult),
        intensityPct: 1,
        intensityMode: 'preserve' as const,
        rirShift,
        label: (i === cur.length - 1 ? 'Финальная' : i === cur.length - 2 ? 'Предпоследняя' : `Нед ${i + 1}`) + ` · из цикла «${cycle.meta.title}»` + weightNote,
        focus: `Пиковый цикл «${cycle.meta.title}» (плоский объём — классическая кривая).`,
      };
    });
  }

  // берём последние n недель цикла как тапер (если n > weeks.length — берём все)
  const start = Math.max(0, weeks.length - n);
  const sliceVol = vols.slice(start);
  const sliceInt = intensities.slice(start);
  // нормализуем объём к maxVol цикла (пик цикла = 100%)
  return sliceVol.map((v, i) => {
    const volumePct = r2(Math.max(0.3, Math.min(1, v / maxVol)) * wGoalMult);
    const avgPct = sliceInt[i];
    // RIR по интенсивности: выше 0.88 → 0-1, выше 0.75 → 1-2, ниже → 2
    const rirTarget = avgPct >= 0.88 ? (i === sliceVol.length - 1 ? 0 : 1) : avgPct >= 0.75 ? 2 : 2;
    const intensityPct = avgPct > 0 ? r2(avgPct) : 1;
    const label = i === sliceVol.length - 1 ? 'Соревновательная' : i === sliceVol.length - 2 ? 'Предсоревновательная' : `Нед ${i + 1}`;
    return {
      week: i + 1,
      volumePct,
      intensityPct,
      intensityMode: 'set_pct' as const,
      rirShift: 1,
      rirTarget,
      label: `${label} · из цикла «${cycle.meta.title}»` + weightNote,
      focus: `Объём ${Math.round((v / maxVol) * 100)}% от пика цикла, инт. ${Math.round(avgPct * 100)}%`,
      warmupOnly: i === sliceVol.length - 1 && avgPct >= 0.95,
      singles: avgPct >= 0.90 && i === sliceVol.length - 2,
    };
  });
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
