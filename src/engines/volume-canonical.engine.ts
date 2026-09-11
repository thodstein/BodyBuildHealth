/**
 * volume-canonical.engine.ts — ЕДИНЫЙ объёмный канон хаба объёма.
 *
 * Устраняет рассинхрон двух канонов (VOLUME_LANDMARKS_DB 15 мышц vs mrvBase 15/20/24/28
 * на 5 грубых группах в VolumeOptimizerTab quality-memo): все потребители хаба
 * считают через этот файл.
 *
 * Состав (реальная логика, без заглушек):
 *  1. MV (maintenance volume, RP 0–6) — поддерживающий объём: плашка, не штраф.
 *  2. Session-MAV гейт (RP: ≤10 прямых сетов мышцы/сессию) — warning «разбить на 2».
 *  3. Effective-объём (direct + indirect через bb-volume indirectMuscleContributions,
 *     паритет с S3 analyzeManualVolume: жимы→трицепс/плечи, тяги→бицепс, присед→ягодицы/хамсы).
 *  4. frequencyForVolume (Schoenfeld 2016 / Grgic 2018: ≤MAV → 1× допустим; >MAV → нужен ≥2×).
 *  5. rirProfileCheck (Refalo 2024 / Martikainen 2025: средний RIR 1–3, доля RIR≤2, RIR 0).
 *  6. hardSetsFilter (RepRaptor: hard = RPE≥7; пустой RPE = hard с пометкой assumed).
 *
 * Источники: Israetel/RP (MEV/MAV/MRV/MV), Schoenfeld 2017 dose-response, Schoenfeld 2016
 * частота 2×>1×, Grgic 2018 2×≈3–4×, Refalo 2024 RIR 1–2≈отказ, Martikainen 2025 волна RIR.
 */

import {
  getVolumeLandmarks,
  normMuscle,
  checkVolumeStatus,
} from './volume-landmarks.engine';
import type { MuscleVolumeLandmarks, VolumeStatus } from './volume-landmarks.engine';
import { indirectMuscleContributions } from './bb/bb-volume.engine';
import { getExerciseById } from '../core/exercise-catalog';

// ═══════════════════════════════════════════════════════════════════════════
// 1. MV (maintenance volume) — уровень-независимый, RP 0–6
// ═══════════════════════════════════════════════════════════════════════════

/** MV по каноническим мышцам/группам. 0 = держится косвенной работой (перед.дельта/пресс/ягодицы). */
export const MV_TABLE: Record<string, number> = {
  chest: 6, back: 6, quads: 4, hamstrings: 2, shoulders: 4,
  delt_front: 0, delt_mid: 4, delt_rear: 0,
  biceps: 2, triceps: 2, calves: 4, glutes: 0, abs: 0, traps: 0, forearms: 0,
  arms: 4, legs: 6, core: 0,
};

export function mvForMuscle(muscle: string): number {
  const m = normMuscle(muscle);
  if (m in MV_TABLE) return MV_TABLE[m];
  return 2;
}

/** Расширенный статус с maintenance-плашкой (идёт ПЕРЕД below_mev). */
export type CanonicalVolumeStatus = VolumeStatus | 'maintenance';

export function canonicalVolumeStatus(
  sets: number,
  lm: MuscleVolumeLandmarks,
  mv?: number,
): CanonicalVolumeStatus {
  const mvVal = mv ?? 0;
  if (sets < mvVal) return 'below_mev';
  if (sets < lm.mev) return 'maintenance';
  return checkVolumeStatus(sets, lm);
}

export const CANONICAL_STATUS_RU: Record<CanonicalVolumeStatus, string> = {
  below_mev: 'Ниже MV',
  maintenance: 'Поддержание',
  optimal: 'Оптимально',
  approaching_mrv: 'Близко к MRV',
  exceeding_mrv: 'Превышен MRV',
};

export const CANONICAL_STATUS_COLOR: Record<CanonicalVolumeStatus, string> = {
  below_mev: '#ef4444',
  maintenance: '#60a5fa',
  optimal: '#22c55e',
  approaching_mrv: '#f59e0b',
  exceeding_mrv: '#ef4444',
};

// ═══════════════════════════════════════════════════════════════════════════
// 2. Session-MAV гейт (RP: ≤10 прямых сетов мышцы за сессию)
// ═══════════════════════════════════════════════════════════════════════════

/** Порог прямых сетов одной мышцы за одну сессию (день). RP session MAV 5–12, гейт — 10. */
export const SESSION_MAV_CAP = 10;

export interface SessionMavViolation {
  muscle: string;
  day: number;
  directSets: number;
  cap: number;
  message: string;
}

export interface CanonicalRow {
  exerciseId: string;
  day: number;
  sets: number;
  weight?: number;
  reps?: number;
  rpe?: number;
  oneRM?: number;
}

/** Прямые сеты мышцы за день (по группе каталога упражнения). */
export function directSetsByMuscleDay(
  rows: CanonicalRow[],
): Record<string, Record<number, number>> {
  const out: Record<string, Record<number, number>> = {};
  for (const r of rows) {
    const ex = getExerciseById(r.exerciseId) as { group?: string } | undefined;
    const g = ex?.group || 'other';
    if (!out[g]) out[g] = {};
    out[g][r.day] = (out[g][r.day] || 0) + Math.max(0, r.sets || 0);
  }
  return out;
}

export function sessionMavViolations(rows: CanonicalRow[]): SessionMavViolation[] {
  const byMuscleDay = directSetsByMuscleDay(rows);
  const out: SessionMavViolation[] = [];
  for (const [muscle, days] of Object.entries(byMuscleDay)) {
    for (const [dayStr, sets] of Object.entries(days)) {
      if (sets > SESSION_MAV_CAP) {
        const day = Number(dayStr);
        out.push({
          muscle, day, directSets: sets, cap: SESSION_MAV_CAP,
          message: `${muscle}: ${sets} прямых сетов в день ${day} > session-MAV ${SESSION_MAV_CAP} — разбейте на 2 сессии`,
        });
      }
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. Effective-объём (direct + indirect, паритет bb-volume / S3)
// ═══════════════════════════════════════════════════════════════════════════

export interface EffectiveVolume {
  direct: Record<string, number>;
  indirect: Record<string, number>;
  effective: Record<string, number>;
}

/**
 * Считает direct/indirect/effective по строкам.
 * Indirect — через bb-volume indirectMuscleContributions({name, type}) — те же коэффициенты,
 * что в S3 analyzeManualVolume (жимы→трицепс 0.45/плечи 0.20, тяги→бицепс 0.40, присед→ягодицы 0.40/хамсы 0.25).
 * Изоляции indirect не дают (паритет bb-volume: isIsolation → []).
 */
export function effectiveVolumeByMuscle(rows: CanonicalRow[]): EffectiveVolume {
  const direct: Record<string, number> = {};
  const indirect: Record<string, number> = {};
  for (const r of rows) {
    const ex = getExerciseById(r.exerciseId) as { group?: string; name?: string; type?: string } | undefined;
    if (!ex) continue;
    const sets = Math.max(0, r.sets || 0);
    const g = ex.group || 'other';
    direct[g] = (direct[g] || 0) + sets;
    const contribs = indirectMuscleContributions({ name: ex.name || '', type: ex.type || '' } as never);
    for (const c of contribs) {
      indirect[c.muscle] = (indirect[c.muscle] || 0) + sets * c.coefficient;
    }
  }
  const effective: Record<string, number> = {};
  const keys = new Set([...Object.keys(direct), ...Object.keys(indirect)]);
  for (const k of keys) effective[k] = (direct[k] || 0) + (indirect[k] || 0);
  return { direct, indirect, effective };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. Частота v2 (Schoenfeld 2016 / Grgic 2018)
// ═══════════════════════════════════════════════════════════════════════════

export type FrequencyVerdict =
  | { kind: 'ok'; message: string }
  | { kind: 'info'; message: string }
  | { kind: 'warning'; message: string }
  | { kind: 'critical'; message: string };

/**
 * Объём ≤MAV → 1× допустим (info, bro-сплит легитимен);
 * объём >MAV → нужен ≥2× (warning «разбить»);
 * объём >MRV → critical независимо от частоты.
 */
export function frequencyForVolume(
  weeklySets: number,
  sessionsPerWeek: number,
  lm: MuscleVolumeLandmarks,
  muscleLabel?: string,
): FrequencyVerdict {
  const label = muscleLabel || 'мышца';
  if (weeklySets > lm.mrv) {
    return { kind: 'critical', message: `${label}: ${weeklySets} > MRV ${lm.mrv} — резать объём независимо от частоты` };
  }
  if (weeklySets > lm.mav) {
    if (sessionsPerWeek >= 2) {
      return { kind: 'ok', message: `${label}: объём > MAV, частота ${sessionsPerWeek}× — делёж корректный` };
    }
    return { kind: 'warning', message: `${label}: ${weeklySets} > MAV ${lm.mav} в 1 сессию — разбейте на ≥2` };
  }
  if (sessionsPerWeek <= 1) {
    return { kind: 'info', message: `${label}: 1×/нед при объёме в MAV — допустимо (Schoenfeld 2016)` };
  }
  return { kind: 'ok', message: `${label}: частота ${sessionsPerWeek}× при объёме в MAV — оптимально` };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. RIR-профиль (Refalo 2024 / Martikainen 2025)
// ═══════════════════════════════════════════════════════════════════════════

export interface RirProfile {
  count: number;
  avgRir: number | null;
  shareRirLe2: number;
  shareRir0: number;
  verdict: FrequencyVerdict;
}

/** Средний RIR недели 1–3 (масса); доля RIR≤2 ≥30%; RIR 0 только у intermediate+ и ≤15% сетов. */
export function rirProfileCheck(
  rows: Array<{ rpe?: number }>,
  level: string,
): RirProfile {
  const rirs = rows
    .map(r => (typeof r.rpe === 'number' && r.rpe >= 5 && r.rpe <= 10 ? 10 - r.rpe : null))
    .filter((v): v is number => v !== null);
  const count = rirs.length;
  if (count === 0) {
    return { count: 0, avgRir: null, shareRirLe2: 0, shareRir0: 0, verdict: { kind: 'info', message: 'RIR нет — введите RPE для проверки профиля' } };
  }
  const avgRir = rirs.reduce((a, b) => a + b, 0) / count;
  const shareRirLe2 = rirs.filter(v => v <= 2).length / count;
  const shareRir0 = rirs.filter(v => v <= 0).length / count;
  const isBeginner = level === 'beginner';
  if (isBeginner && shareRir0 > 0) {
    return { count, avgRir, shareRirLe2, shareRir0, verdict: { kind: 'critical', message: `Новичку отказ (RIR 0, ${(shareRir0 * 100).toFixed(0)}% сетов) — нельзя` } };
  }
  if (shareRir0 > 0.15) {
    return { count, avgRir, shareRirLe2, shareRir0, verdict: { kind: 'warning', message: `Отказа >15% (${(shareRir0 * 100).toFixed(0)}%) — срезать до ≤15%` } };
  }
  if (avgRir > 4) {
    return { count, avgRir, shareRirLe2, shareRir0, verdict: { kind: 'warning', message: `Средний RIR ${avgRir.toFixed(1)} — мусорный объём, добавьте тяжёлых сетов` } };
  }
  if (shareRirLe2 < 0.3) {
    return { count, avgRir, shareRirLe2, shareRir0, verdict: { kind: 'warning', message: `Тяжёлых сетов (RIR≤2) ${(shareRirLe2 * 100).toFixed(0)}% < 30% — недогруз стимула` } };
  }
  return { count, avgRir, shareRirLe2, shareRir0, verdict: { kind: 'ok', message: `RIR-профиль в норме (средний ${avgRir.toFixed(1)}, тяжёлых ${(shareRirLe2 * 100).toFixed(0)}%)` } };
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. Hard sets (RPE≥7; пустой RPE = hard с пометкой assumed)
// ═══════════════════════════════════════════════════════════════════════════

export interface HardSetsResult {
  hardSets: number;
  totalSets: number;
  assumedSets: number;
}

export function hardSetsCount(rows: Array<{ sets: number; rpe?: number }>): HardSetsResult {
  let hardSets = 0;
  let assumedSets = 0;
  let totalSets = 0;
  for (const r of rows) {
    const sets = Math.max(0, r.sets || 0);
    totalSets += sets;
    if (typeof r.rpe === 'number') {
      if (r.rpe >= 7) hardSets += sets;
    } else {
      hardSets += sets;
      assumedSets += sets;
    }
  }
  return { hardSets, totalSets, assumedSets };
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. Канонический MRV на группу (единственная точка вместо mrvBase в UI)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * MRV группы по уровню. Для legs/arms — композит volume-landmarks (quads+hams / bi+tri),
 * для остальных — прямой landmarks. Возвращает null если группы нет в каноне.
 */
export function canonicalMrvForGroup(level: string, group: string): number | null {
  const lm = getVolumeLandmarks(level, group);
  return lm ? lm.mrv : null;
}

/** Каноническая строка группы: MV/MEV/MAV/MRV + статус (effective судится по effective-объёму). */
export interface CanonicalGroupRow {
  group: string;
  directSets: number;
  effectiveSets: number;
  mv: number;
  mev: number;
  mav: number;
  mrv: number;
  status: CanonicalVolumeStatus;
}

export function canonicalGroupRow(
  level: string,
  group: string,
  directSets: number,
  effectiveSets: number,
): CanonicalGroupRow | null {
  const lm = getVolumeLandmarks(level, group);
  if (!lm) return null;
  const mv = mvForMuscle(group);
  const status = canonicalVolumeStatus(Math.round(effectiveSets), lm, mv);
  return { group, directSets: Math.round(directSets), effectiveSets: Math.round(effectiveSets), mv, mev: lm.mev, mav: lm.mav, mrv: lm.mrv, status };
}
