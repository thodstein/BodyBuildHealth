/**
 * arm-correction-dose.engine.ts — P3: причина → доза (чистая функция).
 * База — ARM_CORRECTIONS (sets/repsRange/rir/intensityPct/hold/tempo);
 * причина только корректирует дозу, текст fix остаётся в weak-cause.
 * - fatigue: −1 сет (мин 2), RIR+1 (кап 4), −5п.п. интенсивности
 * - mobility: верхняя граница повторов, RIR≥2, −5п.п.
 * - strength: 5×5, +5п.п. (кап 85%), RIR 2
 * - volume/technique: база без изменений
 */
import { ARM_CORRECTIONS, type ArmCorrectionInfo } from './arm-weakpoint-corrections';
import type { ArmWeakCause } from './arm-weak-cause.engine';
import type { ArmWeakPoint } from './arm-biomechanics.engine';

export interface ArmDose {
  sets: number;
  reps: [number, number];
  rir: number;
  intensityPct: number;
  holdSeconds?: number;
  tempo?: string;
  adjusted: boolean;
  note: string;
}

export function doseForCause(wp: ArmWeakPoint, cause: ArmWeakCause | null | undefined): ArmDose | null {
  const base: ArmCorrectionInfo | null = (ARM_CORRECTIONS as any)[wp] ?? null;
  if (!base) return null;
  const dose: ArmDose = {
    sets: base.sets,
    reps: [base.repsRange[0], base.repsRange[1]],
    rir: base.rir,
    intensityPct: base.intensityPct,
    ...(base.holdSeconds != null ? { holdSeconds: base.holdSeconds } : {}),
    ...(base.tempo ? { tempo: base.tempo } : {}),
    adjusted: false,
    note: 'база точки',
  };
  if (!cause || cause === 'volume' || cause === 'technique') return dose;
  if (cause === 'fatigue') {
    dose.sets = Math.max(2, base.sets - 1);
    dose.rir = Math.min(4, base.rir + 1);
    dose.intensityPct = Math.max(0.5, Math.round((base.intensityPct - 0.05) * 100) / 100);
    dose.adjusted = true;
    dose.note = 'fatigue: −1 сет, RIR+1, −5п.п.';
    return dose;
  }
  if (cause === 'mobility') {
    dose.reps = [base.repsRange[0], Math.max(base.repsRange[1], 12)];
    dose.rir = Math.max(base.rir, 2);
    dose.intensityPct = Math.max(0.5, Math.round((base.intensityPct - 0.05) * 100) / 100);
    dose.adjusted = true;
    dose.note = 'mobility: high-rep, RIR≥2, −5п.п.';
    return dose;
  }
  // strength
  dose.sets = 5;
  dose.reps = [5, 5];
  dose.rir = 2;
  dose.intensityPct = Math.min(0.85, Math.round((base.intensityPct + 0.05) * 100) / 100);
  dose.adjusted = true;
  dose.note = 'strength: 5×5, +5п.п. (кап 85%)';
  return dose;
}

export function doseLabel(d: ArmDose): string {
  const parts = [`${d.sets}×${d.reps[0]}–${d.reps[1]} @${Math.round(d.intensityPct * 100)}%`, `RIR ${d.rir}`];
  if (d.holdSeconds) parts.push(`холд ${d.holdSeconds}с`);
  if (d.tempo) parts.push(d.tempo);
  if (d.adjusted) parts.push(`(${d.note})`);
  return parts.join(' · ');
}
