/**
 * lab-exercise-correction.engine.ts — коррекция упражнения для Лаборатории (Epic E).
 *
 * Тонкий слой БЕЗ дублей: ранжир — `prescribeCorrections`, Δ-превью — `simulateCorrection`
 * (оба `bb-*`). Добавленная ценность лабы — жёсткие фильтры применимости:
 *  - оборудование: цель с недоступным инвентарём отсекается (bodyweight — всегда можно);
 *  - мобильность: цель, бьющаяся о `mobilityRestrictions`, отсекается;
 *  - травмы: цель на травмированную мышцу отсекается;
 *  - `canReplace`: замена/добавка, нарушающая канон каталога, отсекается;
 *  - новичок: `modifyROM` получает честную пометку «сначала полная амплитуда»
 *    (S3: lengthened-частичные — intermediate+).
 * Невозможное не предлагается — вместо него остаются modifyExecution/modifyTempo/modifyLoad.
 */
import {
  prescribeCorrections,
  type CorrectionAction,
} from './bb/bb-exercise-correction.engine';
import { simulateCorrection, type SimulatorDelta } from './bb/bb-exercise-simulator.engine';
import type { ExerciseDiagnosis } from './bb/bb-exercise-diagnosis.engine';
import { EXERCISE_CATALOG, getSubstitutes } from '../core/exercise-catalog';
import { isMobilityRestricted } from './bb/bb-mobility.engine';
import { labInjuryMatches } from './lab-exercise-diagnosis.engine';

export interface LabCorrectionCtx {
  goal?: string;
  level?: string;
  muscle?: string | null;
  equipment?: string[];
  mobilityRestrictions?: string[];
  injuries?: Array<string | { muscle?: string }>;
  weakHead?: string | null;
  asymPct?: number | null;
  missingAngles?: string[];
  missingStrict?: string[];
  inPlanIds?: string[];
  sex?: string;
}

export type LabCorrectionAction = CorrectionAction & {
  /** Честная пометка для новичков на modifyROM (полная амплитуда первична). */
  beginnerNote?: string;
};

const TARGET_TYPES = new Set(['substitute', 'add', 'mobilitySwap', 'unilateral']);

/**
 * Канон запрета каталога: cannotReplace (обе стороны) + SUBSTITUTION_MAP.forbidden.
 * `canReplace`=false — НЕ запрет (узкий список разрешённого), резать по нему нельзя:
 * иначе гибнут все легитимные замены (bench→incline). Запрет действует только на
 * substitute/mobilitySwap (замену); add/unilateral — дополнения, их forbidden не касается.
 */
export function isForbiddenReplacement(curId: string, targetId: string): boolean {
  if (!curId || !targetId) return false;
  try {
    const a = EXERCISE_CATALOG.find((c) => c.id === curId);
    const b = EXERCISE_CATALOG.find((c) => c.id === targetId);
    if (a?.cannotReplace?.includes(targetId)) return true;
    if (b?.cannotReplace?.includes(curId)) return true;
    const sub = getSubstitutes(curId);
    if (sub?.forbidden?.some((f) => f.id === targetId)) return true;
  } catch {
    return true;
  }
  return false;
}

function targetBlocked(
  targetId: string | undefined,
  ctx: LabCorrectionCtx,
): string | null {
  if (!targetId) return null;
  const target = EXERCISE_CATALOG.find((c) => c.id === targetId);
  if (!target) return null;
  const eq = Array.isArray(ctx.equipment) ? ctx.equipment : [];
  if (eq.length > 0 && target.equipment !== 'bodyweight' && !eq.includes(target.equipment)) {
    return `нет инвентаря ${target.equipment}`;
  }
  const restrictions = Array.isArray(ctx.mobilityRestrictions) ? ctx.mobilityRestrictions : [];
  if (restrictions.length > 0 && isMobilityRestricted({ name: target.name }, restrictions)) {
    return 'бьётся о ограничение мобильности';
  }
  const hit = labInjuryMatches(ctx.injuries, target.group, target.name);
  if (hit) return `травма ${hit}`;
  return null;
}

/** Коррекции с жёстким фильтром применимости (порядок confidence сохранён). */
export function prescribeLabCorrections(
  diagnosis: ExerciseDiagnosis,
  ex: { id?: string | null; name: string; muscle?: string | null; tempo?: string; pauseSeconds?: number },
  ctx: LabCorrectionCtx = {},
): LabCorrectionAction[] {
  const raw = prescribeCorrections(diagnosis, ex, { ...ctx, muscle: ctx.muscle ?? ex.muscle ?? null });
  const out: LabCorrectionAction[] = [];
  const curId = String(ex.id || diagnosis.effect?.id || '');
  for (const a of raw) {
    if (TARGET_TYPES.has(a.type) && a.targetId) {
      // Канон каталога нерушим: запрещённая замена отсекается (только substitute/mobilitySwap).
      if ((a.type === 'substitute' || a.type === 'mobilitySwap') && isForbiddenReplacement(curId, a.targetId)) {
        continue;
      }
      const blockReason = targetBlocked(a.targetId, ctx);
      if (blockReason) continue;
    }
    const lab: LabCorrectionAction = { ...a };
    if (
      a.type === 'modifyROM'
      && String(ctx.level || '').toLowerCase() === 'beginner'
    ) {
      lab.beginnerNote = 'Новичок: сначала полная амплитуда, частичные в растянутой — с intermediate';
    }
    out.push(lab);
  }
  return out;
}

/** Δ-превью коррекции без мутации плана (passthrough симулятора). */
export function simulateLabCorrection(
  plan: unknown,
  action: CorrectionAction,
  targetExId?: string | null,
): SimulatorDelta | null {
  return simulateCorrection(plan, action, targetExId);
}

function fmtDelta(v: number | null, digits = 1): string | null {
  if (v == null || !Number.isFinite(v) || v === 0) return null;
  return `${v > 0 ? '+' : ''}${v.toFixed(digits)}`;
}

/** Человеческая строка Δ для UI (только ненулевые компоненты). */
export function formatSimulatorDelta(d: SimulatorDelta | null): string | null {
  if (!d) return null;
  const parts: string[] = [];
  const sfr = fmtDelta(d.sfrDelta);
  if (sfr) parts.push(`SFR ${sfr}`);
  const fat = fmtDelta(d.fatigueDelta, 2);
  if (fat) parts.push(`усталость ${fat}`);
  const len = d.lengthenedDelta != null && Number.isFinite(d.lengthenedDelta) && d.lengthenedDelta !== 0
    ? `${d.lengthenedDelta > 0 ? '+' : ''}${Math.round(d.lengthenedDelta * 100)} п.п. lengthened`
    : null;
  if (len) parts.push(len);
  const ang = fmtDelta(d.angleDelta, 2);
  if (ang) parts.push(`углы ${ang}`);
  for (const issue of d.issuesResolved.slice(0, 3)) parts.push(`✓ ${issue}`);
  return parts.length ? parts.join(' · ') : null;
}

export interface RankedSubstitute {
  id: string;
  name: string;
  reason: string;
  sfrDelta: number | null;
  fatigueDelta: number | null;
  deltaSummary: string | null;
}

/**
 * Ранжир кандидатов замены по Δ на плане (п.3 добивки): сначала рост SFR,
 * затем снижение усталости. Без плана — исходный порядок, Δ null.
 */
export function rankSubstitutesByDelta(
  plan: unknown,
  exId: string,
  candidates: Array<{ id: string; name: string; reason: string }>,
): RankedSubstitute[] {
  const ranked: RankedSubstitute[] = (candidates || []).map((c) => {
    let sfrDelta: number | null = null;
    let fatigueDelta: number | null = null;
    let deltaSummary: string | null = null;
    if (plan) {
      try {
        const d = simulateCorrection(
          plan,
          { type: 'substitute', targetId: c.id, targetName: c.name, reason: c.reason, confidence: 0.8 },
          exId,
        );
        if (d) {
          sfrDelta = d.sfrDelta;
          fatigueDelta = d.fatigueDelta;
          deltaSummary = formatSimulatorDelta(d);
        }
      } catch {
        /* кандидат без Δ — остаётся с null */
      }
    }
    return { id: c.id, name: c.name, reason: c.reason, sfrDelta, fatigueDelta, deltaSummary };
  });
  if (plan) {
    ranked.sort((a, b) => {
      const sa = a.sfrDelta ?? Number.NEGATIVE_INFINITY;
      const sb = b.sfrDelta ?? Number.NEGATIVE_INFINITY;
      if (sb !== sa) return sb - sa;
      const fa = a.fatigueDelta ?? Number.POSITIVE_INFINITY;
      const fb = b.fatigueDelta ?? Number.POSITIVE_INFINITY;
      return fa - fb;
    });
  }
  return ranked;
}

/** Данные моста `kind:'weakpoints'` — форма совместима с WeakpointsPayload. */
export function buildLabBridgeData(opts: {
  action: CorrectionAction;
  exId: string;
  exName: string;
  diagnosis: ExerciseDiagnosis;
  delta?: SimulatorDelta | null;
}): {
  preferredExerciseIds: string[];
  exerciseSwap: { oldId: string; newId: string } | null;
  labDiagnosis: { flags: string[]; issues: string[]; score: number };
  labCorrection: { type: string; targetId?: string | null; targetName?: string };
  labDelta: SimulatorDelta | null;
} {
  const { action, exId, exName, diagnosis, delta } = opts;
  const hasTarget = !!action.targetId;
  return {
    preferredExerciseIds: hasTarget && action.targetId ? [action.targetId] : [],
    exerciseSwap:
      (action.type === 'substitute' || action.type === 'mobilitySwap') && action.targetId
        ? { oldId: exId, newId: action.targetId }
        : null,
    labDiagnosis: {
      flags: [...diagnosis.flags],
      issues: [...diagnosis.issues],
      score: diagnosis.score,
    },
    labCorrection: {
      type: action.type,
      targetId: action.targetId ?? null,
      targetName: (action as { targetName?: string }).targetName ?? (hasTarget ? action.targetId : exName),
    },
    labDelta: delta ?? null,
  };
}
