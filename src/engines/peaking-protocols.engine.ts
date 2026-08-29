/**
 * peaking-protocols.engine.ts — 3 протокола пиковой фазы.
 *
 * PL: 3-нед, RIR 1→0, объём −15%→−30%, интенсивность 90%→100%.
 * BB: DEPRECATED — используйте BB_TAPER_CURVE в bb-contest-prep.engine.ts (RIR 2-4, объём 0.90→0.60, интенсивность 0.95→0.85).
 *     BB_PROTOCOL сохранён для backward-compat тестов, но помечен как legacy с отказным RIR 0 (не PRO).
 * Classic (WF): 4-нед, 2 нед «перегрузка» + 2 нед суперкомпенсация.
 * PRO 2025: BB taper каноничен в bb-contest-prep (Helms/Bosquet), не здесь.
 */
export type PeakingProtocol = 'pl' | 'bb' | 'classic';

export interface PeakingWeek {
  week: number;
  label: string;
  volumePct: number;
  intensityPct: number;
  rirMin: number;
  rirMax: number;
  focus: string;
  deloadBefore: boolean;
}

export interface PeakingProtocolOutput {
  name: string;
  durationWeeks: number;
  weeks: PeakingWeek[];
  description: string;
}

const PL_PROTOCOL: PeakingProtocolOutput = {
  name: 'Пауэрлифтинг (3-нед пик)',
  durationWeeks: 3,
  description: 'Классический 3-недельный пик для пауэрлифтинга. Объём падает, интенсивность растёт. RIR → 0 на соревновательной неделе. Перед началом — обязательная разгрузка.',
  weeks: [
    { week: 1, label: 'Подводящая', volumePct: 0.85, intensityPct: 0.90, rirMin: 1, rirMax: 2, focus: 'Соревновательные движения, обычные сеты', deloadBefore: true },
    { week: 2, label: 'Интенсивная', volumePct: 0.75, intensityPct: 0.95, rirMin: 0, rirMax: 1, focus: 'Одиночные подходы @9-9.5, синглы, двойки', deloadBefore: false },
    { week: 3, label: 'Соревновательная', volumePct: 0.60, intensityPct: 1.0, rirMin: 0, rirMax: 0, focus: 'Разминка → открытие → 2-3 прохода @RPE 9.5-10', deloadBefore: false },
  ],
};

/**
 * @deprecated — legacy BB_PROTOCOL с отказным RIR 0 (не PRO). Каноника: BB_TAPER_CURVE в bb-contest-prep.engine.ts
 * (Helms/Bosquet: RIR 2-4, объём 0.90→0.60). Сохранён только для тестов обратной совместимости.
 */
const BB_PROTOCOL: PeakingProtocolOutput = {
  name: 'Бодибилдинг (4-нед пик) — legacy',
  durationWeeks: 4,
  description: 'LEGACY: пик для бодибилдинга с отказом (RIR 0). PRO-каноника в bb-contest-prep BB_TAPER_CURVE (RIR 2-4).',
  weeks: [
    { week: 1, label: 'Наполнение 1', volumePct: 0.90, intensityPct: 0.80, rirMin: 0, rirMax: 1, focus: 'LEGACY — используйте BB_TAPER_CURVE', deloadBefore: true },
    { week: 2, label: 'Наполнение 2', volumePct: 0.85, intensityPct: 0.85, rirMin: 0, rirMax: 1, focus: 'LEGACY', deloadBefore: false },
    { week: 3, label: 'Прорисовка', volumePct: 0.80, intensityPct: 0.90, rirMin: 0, rirMax: 0, focus: 'LEGACY', deloadBefore: false },
    { week: 4, label: 'Шоу', volumePct: 0.70, intensityPct: 0.85, rirMin: 0, rirMax: 0, focus: 'LEGACY', deloadBefore: false },
  ],
};

const CLASSIC_PROTOCOL: PeakingProtocolOutput = {
  name: 'Классический (WF-пик 4 нед)',
  durationWeeks: 4,
  description: 'Концепция суперкомпенсации: 2 нед «перегрузка» (высокий объём, низкая интенсивность) → 2 нед резкое снижение объёма с пиком интенсивности → суперкомпенсация.',
  weeks: [
    { week: 1, label: 'Перегрузка-1', volumePct: 1.15, intensityPct: 0.70, rirMin: 2, rirMax: 3, focus: 'Высокий объём, низкая интенсивность, накопление усталости', deloadBefore: true },
    { week: 2, label: 'Перегрузка-2', volumePct: 1.20, intensityPct: 0.75, rirMin: 2, rirMax: 3, focus: 'Максимальный объём, начало роста интенсивности', deloadBefore: false },
    { week: 3, label: 'Реализация-1', volumePct: 0.60, intensityPct: 0.90, rirMin: 0, rirMax: 1, focus: 'Резкое падение объёма, высокая интенсивность', deloadBefore: false },
    { week: 4, label: 'Суперкомпенсация', volumePct: 0.40, intensityPct: 1.0, rirMin: 0, rirMax: 0, focus: 'Минимум объёма, пик силы', deloadBefore: false },
  ],
};

export const PEAKING_PROTOCOLS: Record<PeakingProtocol, PeakingProtocolOutput> = {
  pl: PL_PROTOCOL,
  bb: BB_PROTOCOL,
  classic: CLASSIC_PROTOCOL,
};

export function getPeakingProtocol(type: PeakingProtocol): PeakingProtocolOutput {
  return PEAKING_PROTOCOLS[type] || PL_PROTOCOL;
}

export function applyPeakingToMicrocycles(
  microcycles: Array<{ weekNumber: number; mesocycleType: string; volumeMultiplier: number; rirRange: [number, number]; }>,
  protocol: PeakingProtocol,
  startWeek: number
): Array<{ weekNumber: number; volumeMultiplier: number; rirRange: [number, number]; rpeTarget: number; notes: string }> {
  const p = getPeakingProtocol(protocol);
  const result: Array<{ weekNumber: number; volumeMultiplier: number; rirRange: [number, number]; rpeTarget: number; notes: string }> = [];

  for (let i = 0; i < p.weeks.length; i++) {
    const pw = p.weeks[i];
    const existing = microcycles.find(m => m.weekNumber === startWeek + i);
    const baseVol = existing?.volumeMultiplier ?? 1.0;
    result.push({
      weekNumber: startWeek + i,
      volumeMultiplier: baseVol * pw.volumePct,
      rirRange: [pw.rirMin, pw.rirMax],
      rpeTarget: 10 - pw.rirMax,
      notes: `${p.name} — ${pw.label}: ${pw.focus}`,
    });
  }
  return result;
}
