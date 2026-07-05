/**
 * peaking-protocols.engine.ts — 3 протокола пиковой фазы.
 *
 * PL: 3-нед, RIR 1→0, объём −15%→−30%, интенсивность 90%→100%.
 * BB: 4-нед, RIR 0→0, объём −10%→−20%, пампинг/изоляция.
 * Classic (WF): 4-нед, 2 нед «перегрузка» + 2 нед суперкомпенсация.
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

const BB_PROTOCOL: PeakingProtocolOutput = {
  name: 'Бодибилдинг (4-нед пик)',
  durationWeeks: 4,
  description: 'Пик для бодибилдинга: гликогеновая загрузка, пампинг, снижение объёма для восстановления. RIR 0 — отказ в последнем подходе.',
  weeks: [
    { week: 1, label: 'Наполнение 1', volumePct: 0.90, intensityPct: 0.80, rirMin: 0, rirMax: 1, focus: 'База + изоляция, пампинг', deloadBefore: true },
    { week: 2, label: 'Наполнение 2', volumePct: 0.85, intensityPct: 0.85, rirMin: 0, rirMax: 1, focus: 'Увеличение углеводов, снижение КБ', deloadBefore: false },
    { week: 3, label: 'Прорисовка', volumePct: 0.80, intensityPct: 0.90, rirMin: 0, rirMax: 0, focus: 'Дроп-сеты, пампинг-сеты, отказ', deloadBefore: false },
    { week: 4, label: 'Шоу', volumePct: 0.70, intensityPct: 0.85, rirMin: 0, rirMax: 0, focus: 'Минимум объёма, пампинг перед выходом', deloadBefore: false },
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
