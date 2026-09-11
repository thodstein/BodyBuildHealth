/**
 * volume-sra.engine.ts — SRA-модель хаба объёма (Stimulus-Recovery-Adaptation, Israetel/RP).
 *
 * Заменяет выдуманную формулу `recoveryHours = sets*4 + heavy*8 + compound*3`
 * (без источника) на окна восстановления RP + проверку согласованности частоты:
 * если межсессионный интервал короче SRA-минимума — мышца не успевает восстановиться.
 *
 * Окна SRA (RP coaching data): грудь 24–48ч, спина 48–72ч, квадрицепсы 48–96ч,
 * бицепс бедра 48–72ч, плечи/руки 24–48ч, икры/пресс 12–24ч.
 * Внутри окна позиция зависит от относительного объёма (доля MRV) и доли тяжёлых сетов.
 */

import { getVolumeLandmarks, normMuscle } from './volume-landmarks.engine';

/** Базовые SRA-окна (часы): min — лёгкая сессия, max — объём у MRV. */
export const SRA_BASE_HOURS: Record<string, { min: number; max: number }> = {
  chest: { min: 24, max: 48 },
  back: { min: 48, max: 72 },
  quads: { min: 48, max: 96 },
  hamstrings: { min: 48, max: 72 },
  shoulders: { min: 24, max: 48 },
  delt_front: { min: 24, max: 48 },
  delt_mid: { min: 24, max: 48 },
  delt_rear: { min: 24, max: 48 },
  biceps: { min: 24, max: 48 },
  triceps: { min: 24, max: 48 },
  calves: { min: 12, max: 24 },
  glutes: { min: 48, max: 72 },
  abs: { min: 12, max: 24 },
  traps: { min: 24, max: 48 },
  forearms: { min: 12, max: 24 },
  arms: { min: 24, max: 48 },
  legs: { min: 48, max: 96 },
  core: { min: 12, max: 24 },
};

function sraBaseFor(muscle: string): { min: number; max: number } {
  const m = normMuscle(muscle);
  return SRA_BASE_HOURS[m] || { min: 24, max: 72 };
}

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

export interface SraEstimate {
  muscle: string;
  /** Часы до полного восстановления после такой недели. */
  recoveryHours: number;
  baseMin: number;
  baseMax: number;
  volumeRatio: number; // sets / MRV
  heavyShare: number;  // heavy sets / all sets
}

/**
 * Оценка восстановления: позиция в окне = доля MRV + половина веса тяжёлым сетам (CNS-цена).
 * Тяжёлые сеты (≥85% 1RM) удлиняют восстановление максимум на 50% окна.
 */
export function sraForMuscle(
  muscle: string,
  level: string,
  weeklySets: number,
  heavySets: number,
): SraEstimate {
  const base = sraBaseFor(muscle);
  const lm = getVolumeLandmarks(level, muscle);
  const mrv = lm?.mrv || 20;
  const volumeRatio = mrv > 0 ? Math.max(0, weeklySets) / mrv : 0;
  const heavyShare = weeklySets > 0 ? clamp01(heavySets / weeklySets) : 0;
  const pos = clamp01(volumeRatio * 0.7 + heavyShare * 0.3);
  const recoveryHours = Math.round(base.min + (base.max - base.min) * pos + heavyShare * (base.max - base.min) * 0.5);
  return { muscle, recoveryHours, baseMin: base.min, baseMax: base.max, volumeRatio, heavyShare };
}

export type SraFrequencyVerdict =
  | { kind: 'ok'; message: string }
  | { kind: 'warning'; message: string }
  | { kind: 'critical'; message: string };

/**
 * Согласованность частоты с SRA: межсессионный интервал = 168ч / sessionsPerWeek.
 * Короче минимума — critical (пересечение окон), короче максимума — warning (на грани),
 * иначе ok. Частота 0 (мышца не тренируется) — ok с пометкой.
 */
export function sraFrequencyCheck(
  muscle: string,
  sessionsPerWeek: number,
  sraHours: number,
  muscleLabel?: string,
): SraFrequencyVerdict {
  const label = muscleLabel || muscle;
  if (sessionsPerWeek <= 0) {
    return { kind: 'ok', message: `${label}: сессий нет — восстановление не требуется` };
  }
  const interval = 168 / sessionsPerWeek;
  const base = sraBaseFor(muscle);
  if (interval < base.min) {
    return { kind: 'critical', message: `${label}: интервал ${Math.round(interval)}ч < SRA-минимума ${base.min}ч — мышца не восстанавливается` };
  }
  if (interval < sraHours) {
    return { kind: 'warning', message: `${label}: интервал ${Math.round(interval)}ч < нужно ~${sraHours}ч — на грани восстановления` };
  }
  return { kind: 'ok', message: `${label}: интервал ${Math.round(interval)}ч покрывает SRA ~${sraHours}ч` };
}
