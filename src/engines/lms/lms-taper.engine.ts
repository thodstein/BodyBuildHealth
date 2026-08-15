/**
 * lms-taper.engine.ts — КАНОНИЧЕСКАЯ модель тапера/пика ПЛ-авто.
 *
 * Единая кривая тапера для ВСЕХ поверхностей ПЛ:
 *  - applyPLTaper (авто-тапер при сборке плана);
 *  - appendPLTaperWeeks (ручной тапер к действующему циклу);
 *  - макроцикл (peak/competition блоки в buildSrcMacrocycle);
 *  - калькуляторы PeakingPanel / TaperPlannerTab;
 *  - карточка «🏁 Тапер к старту» в MacrocyclePanel.
 *
 * Раньше цифры расходились: applyPLTaper давал объём ×0.65/×0.45 с сохранённой
 * интенсивностью, PeakingPanel — инвертированную кривую (объём 1→0.45,
 * интенсивность 0.65→1.0), pro/taper.engine — свою (0.65/0.45/0.40, инт. 0.92),
 * ПЛ-протокол Библиотеки — 85/75/60% × 90/95/100%. Теперь все читают
 * buildPLTaperCurve() из этого файла.
 *
 * Раскладки тапера (TaperMode):
 *  - 'classic' — разгрузка Bosquet 2005: объём ↓, интенсивность СОХРАНЕНА, RIR ↑;
 *  - 'pl'      — ПЛ-пик-протокол Библиотеки: объём 85/75/60%,
 *                интенсивность 90/95/100% ПМ, RIR 1-2/0-1/0, синглы на интенсивной неделе;
 *  - 'pro'     — усталость-зависимая кривая (taperWeeksForFatigue + pro/taperCurve):
 *                прайминг, динамический усилийный день, RIR 2→1.
 *
 * Весовые цели тапера (TaperWeightGoal):
 *  - 'lose'    — сгонка к категории: объём ×0.9 (дефицит → MRV ниже, Helms 2022);
 *  - 'gain'    — набор к категории: полный объём;
 *  - 'maintain'— вес стабилен;
 *  - 'auto'    — в движке = maintain (решение принимает UI по rec.toCut/toGain).
 *
 * Раскладка пик-недели (PeakWeekLayout):
 *  - 'attempts' — прикиды соревновательного дня (опенер/вторая/третья) + warmup;
 *  - 'light'    — только разминка 50/70/90% без прикидов (контрольные старты).
 */
import { getPeakingProtocol } from '../peaking-protocols.engine';
import { taperCurve, type TaperWeek } from '../pro/mesocycle-progression.engine';
import { taperWeeksForFatigue } from '../pro/taper.engine';

export type TaperMode = 'classic' | 'pl' | 'pro';
export type TaperWeightGoal = 'lose' | 'gain' | 'maintain' | 'auto';
export type PeakWeekLayout = 'attempts' | 'light';

/** Одна неделя канонической кривой тапера. */
export interface TaperCurvePoint {
  /** Номер недели тапера (1-indexed). */
  week: number;
  /** Множитель объёма (0.40-1.0). Применяется к аксессуарам; основные лифты — без реза. */
  volumePct: number;
  /** Интенсивность: при intensityMode='set_pct' — абсолютный % от ПМ для основных лифтов. */
  intensityPct: number;
  /** 'preserve' — интенсивность сохранена (веса не меняются); 'set_pct' — по intensityPct. */
  intensityMode: 'preserve' | 'set_pct';
  /** Сдвиг RIR для аксессуаров (основные лифты — rirTarget, если задан). */
  rirShift: number;
  /** Абсолютный RIR для основных лифтов (протокол); если не задан — ws.rir + rirShift. */
  rirTarget?: number;
  /** Метка недели (для UI). */
  label: string;
  /** Фокус/рационал недели (протокол). */
  focus?: string;
  /** Основные движения — синглы (интенсивная неделя ПЛ-протокола). */
  singles?: boolean;
}

export interface TaperCurveOptions {
  /** Число тапер-недель (1-4). */
  taperWeeks: number;
  /** Раскладка тапера. */
  mode?: TaperMode;
  /** Весовая цель тапера (влияет на объём: дефицит → ×0.9). */
  weightGoal?: TaperWeightGoal;
  /** Усталость 0-100 — для pro-режима (недель) и подсказок. */
  fatigue?: number;
  /** Пиковая интенсивность для pro-режима (% от ПМ). */
  peakIntensityPct?: number;
}

export const TAPER_MODE_LABELS: Record<TaperMode, string> = {
  classic: '📉 Классический (Bosquet, разгрузка)',
  pl: '🏁 ПЛ-пик-протокол (3 нед, интенсификация)',
  pro: '🎯 Про (усталость-зависимый, прайминг)',
};

export const TAPER_MODE_DESCS: Record<TaperMode, string> = {
  classic: 'Интенсивность сохранена, RIR вверх — объём ×0.65/×0.45 за 2 нед',
  pl: 'Объём 85/75/60%, интенсивность 90/95/100% ПМ, RIR 1-2/0-1/0, синглы',
  pro: 'Длительность по усталости (1-3 нед), объём ~0.65/0.45/0.40, инт. ~92%, прайминг',
};

export const TAPER_WEIGHT_GOAL_LABELS: Record<TaperWeightGoal, string> = {
  lose: '⬇ Сброс к категории',
  gain: '⬆ Набор к категории',
  maintain: '⏸ Вес стабилен',
  auto: '🤖 Авто (по текущему весу)',
};

/** Множитель объёма по весовой цели: дефицит → MRV ниже (Helms 2022). */
export function weightGoalVolumeMult(goal: TaperWeightGoal | undefined): number {
  return goal === 'lose' ? 0.9 : 1;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** Длительность тапера по усталости (дедуп: единая точка — pro/taper.engine). */
export function taperWeeksByFatigue(fatigue?: number): number | null {
  if (fatigue == null || !Number.isFinite(fatigue)) return null;
  return taperWeeksForFatigue(Math.max(0, Math.min(100, fatigue)));
}

/**
 * Каноническая кривая тапера. Все потребители ПЛ-авто обязаны строить
 * тапер-недели из этой кривой, чтобы цифры в UI и плане не расходились.
 */
export function buildPLTaperCurve(opts: TaperCurveOptions): TaperCurvePoint[] {
  const { taperWeeks, mode = 'classic', weightGoal = 'maintain', fatigue, peakIntensityPct = 0.92 } = opts;
  const n = Math.max(1, Math.min(4, Math.round(taperWeeks)));
  const wGoalMult = weightGoalVolumeMult(weightGoal);
  const weightNote = weightGoal === 'lose' ? ' · сгонка: объём ×0.9' : weightGoal === 'gain' ? ' · набор: полный объём' : '';

  if (mode === 'pl') {
    const proto = getPeakingProtocol('pl');
    const offset = Math.max(0, proto.weeks.length - n);
    const sel = proto.weeks.slice(offset, offset + n);
    // Протокол ровно 3 недели: последние N недель — подводящая/интенсивная/соревновательная
    // (финал всегда в списке). При n > 3 — крайние недели повторяются (кламп).
    return sel.map((pw, i) => ({
      week: i + 1,
      volumePct: r2(pw.volumePct * wGoalMult),
      intensityPct: pw.intensityPct,
      intensityMode: 'set_pct' as const,
      rirShift: 1,
      rirTarget: pw.rirMin,
      label: pw.label,
      focus: pw.focus,
      singles: n === 3 && i === 1,
    }));
  }

  if (mode === 'pro') {
    const weeks = Math.max(1, Math.min(3, n));
    const tc: TaperWeek[] = taperCurve(weeks, peakIntensityPct);
    return tc.map(t => ({
      week: t.week,
      volumePct: r2(t.volumePctOfPeak * wGoalMult),
      intensityPct: t.intensityPct,
      intensityMode: 'set_pct' as const,
      rirShift: t.rir,
      label: t.week === weeks ? 'Финальная (прайминг)' : `Taper нед ${t.week}`,
      focus: t.rationale + weightNote,
    }));
  }

  // classic: разгрузка Bosquet — объём падает 0.9→0.45, интенсивность сохранена, RIR +1/+2.
  // 2-недельный тапер — фиксированные ×0.65/×0.45 (как в applyPLTaper, taperWeeksForBlock
  // и документации); более длинные — плавная кривая 0.9→0.45.
  const fixed: Record<number, number[]> = { 1: [0.45], 2: [0.65, 0.45] };
  const vols = fixed[n] ?? Array.from({ length: n }, (_, i) => {
    const progress = (i + 1) / n;
    return r2(Math.max(0.4, 0.9 - progress * 0.45));
  });
  return vols.map((volumePct, i) => {
    const rirShift = i === n - 1 ? 2 : 1;
    const label = n === 1 ? 'Соревновательная'
      : i === n - 1 ? 'Финальная'
      : i === n - 2 ? 'Предпоследняя'
      : `Нед ${i + 1}`;
    return {
      week: i + 1,
      volumePct: r2(volumePct * wGoalMult),
      intensityPct: 1,
      intensityMode: 'preserve' as const,
      rirShift,
      label: label + weightNote,
    };
  });
}

/** Сводка кривой для рационала/UI (одна строка). */
export function summarizeTaperCurve(curve: TaperCurvePoint[]): string {
  return curve.map(p => `нед ${p.week}: объём ×${p.volumePct}, RIR +${p.rirShift}`).join(' · ');
}

export type { TaperWeek };
