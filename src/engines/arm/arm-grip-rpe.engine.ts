/**
 * arm-grip-rpe.engine.ts — TOP T2b: Grip-RPE система (вместо % для эспандеров).
 *
 * Источник: GripStrength Periodized Grip Training (CoC не грузятся линейно:
 * прыжок #1→#1.5 = +27.5lb без промежуточных; RPE закрывает разрыв).
 * Шкала: 5-6 легко (разминка/экстензоры/делоад), 7 объём, 8 рабочие тяжёлые
 * + negatives 5с, 9 синглы/overcrush/max-hold, 10 кредит-попытка ≤1×/нед.
 * Делоад каждая 4-я: −40–50% объёма, RPE≤6, без максимумов/негативов.
 */

export type GripRpePhase = 'volume' | 'intensification' | 'peak' | 'deload';

export interface GripRpeInput {
  week?: number; // неделя мезоцикла (1..)
  phase?: string;
  jointPain?: boolean; // боль в суставе/связке (не мышца) — резать
}

export interface GripRpePlan {
  phase: GripRpePhase;
  targetRpe: number;
  negatives: { sets: number; reps: string; tempoSec: number; freqPerWeek: number } | null;
  overcrush: { sets: number; holdSec: string; rpe: number } | null;
  stickingIso: { sets: number; holdSec: string; rpe: number } | null; // ≤3 сетов, CNS-цена
  extensor: { sets: number; reps: string; rpe: number }; // mandatory
  maxAttemptsPerWeek: number; // 0 в volume/deload, 1 в peak
  note: string;
}

/** Фаза по неделе мезоцикла (4-недельный блок: 1-2 volume, 3 intensification, 4 deload). */
export function gripRpePhaseFor(week: number, phaseHint?: string): GripRpePhase {
  const h = String(phaseHint || '').toLowerCase();
  if (h === 'deload') return 'deload';
  if (h === 'peak' || h === 'peaking') return 'peak';
  if (h === 'volume' || h === 'accumulation') return 'volume';
  if (h === 'intensification') return 'intensification';
  const w = Math.max(1, Math.round(Number(week) || 1));
  const inBlock = ((w - 1) % 4) + 1;
  if (inBlock === 4) return 'deload';
  if (inBlock === 3) return 'intensification';
  return 'volume';
}

/** Целевой RPE фазы. */
export function gripTargetRpe(phase: GripRpePhase): number {
  if (phase === 'deload') return 6;
  if (phase === 'volume') return 7;
  if (phase === 'peak') return 9;
  return 8;
}

/** Полный Grip-RPE план недели. */
export function buildGripRpe(input: GripRpeInput = {}): GripRpePlan {
  const phase = gripRpePhaseFor(input.week ?? 1, input.phase);
  const jointPain = !!input.jointPain;
  const targetRpe = jointPain ? 7 : gripTargetRpe(phase);
  const extensor = { sets: 3, reps: '15-20 открываний', rpe: 5 };
  if (phase === 'deload') {
    return {
      phase,
      targetRpe: 6,
      negatives: null,
      overcrush: null,
      stickingIso: null,
      extensor,
      maxAttemptsPerWeek: 0,
      note: 'Делоад хвата: −40–50% объёма, RPE≤6, без негативов и максимумов.',
    };
  }
  if (phase === 'volume') {
    return {
      phase,
      targetRpe,
      negatives: jointPain ? null : { sets: 3, reps: '3 повтора', tempoSec: 5, freqPerWeek: 2 },
      overcrush: null,
      stickingIso: null,
      extensor,
      maxAttemptsPerWeek: 0,
      note: 'Объём: рабочие закрытия RPE7 + negatives 5с 2×/нед; максимумы запрещены.',
    };
  }
  if (phase === 'peak') {
    return {
      phase,
      targetRpe: jointPain ? 7 : 9,
      negatives: jointPain ? null : { sets: 3, reps: '1–3 повтора', tempoSec: 5, freqPerWeek: 1 },
      overcrush: jointPain ? null : { sets: 4, holdSec: '8-12с', rpe: 9 },
      stickingIso: jointPain ? null : { sets: 3, holdSec: '5-8с', rpe: 9 },
      extensor,
      maxAttemptsPerWeek: jointPain ? 0 : 1,
      note: jointPain
        ? 'Суставная боль: пик отменён — только объём RPE7, к врачу при >недели.'
        : 'Пик: 1 max-попытка/нед как главное событие + overcrush + sticking iso ≤3 сетов.',
    };
  }
  // intensification
  return {
    phase,
    targetRpe,
    negatives: jointPain ? null : { sets: 4, reps: '3 повтора', tempoSec: 5, freqPerWeek: 2 },
    overcrush: jointPain ? null : { sets: 3, holdSec: '8-12с', rpe: 8 },
    stickingIso: jointPain ? null : { sets: 2, holdSec: '5-8с', rpe: 9 },
    extensor,
    maxAttemptsPerWeek: 0,
    note: 'Интенсификация: тот же эспандер на RPE8 — другой стимул тем же железом.',
  };
}

/** Триаж боли: мышца (24–48ч норма) vs сустав/связка (стоп + 3–5 дней deload). */
export function triageGripPain(kind: string): { action: 'train' | 'reduce' | 'stop'; note: string } {
  const k = String(kind || '').toLowerCase();
  if (/сустав|связк|пуль|щелч|joint|tendon|pulley/i.test(k))
    return { action: 'stop', note: 'Сустав/связка/пуль: стоп движение, 3–5 дней отдых, возврат на сниженной. >недели — к врачу.' };
  if (/остр|резк|стреля|sharp/i.test(k))
    return { action: 'stop', note: 'Острая/стреляющая боль: немедленный стоп.' };
  return { action: 'train', note: 'Мышечная крепатура 24–48ч — норма адаптации.' };
}
