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
