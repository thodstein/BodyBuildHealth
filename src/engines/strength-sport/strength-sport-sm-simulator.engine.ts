/**
 * strength-sport-sm-simulator.engine.ts — СИМУЛЯЦИЯ Δ КОРРЕКЦИИ СТРОНГМЕНА (SM PRO)
 *
 * «Что изменится в плане, если вставить коррекцию»: Δ сетов, оценка Δ тоннажа
 * (вес = intensityPct × ПМ движения, округление 2.5 — как в инъекции),
 * для carries — Δ дистанции (сеты × 20м), Δ покрытия фаз.
 * Parity с TA ta-simulator (delta до/после, read-only).
 *
 * Чистый движок, план не мутирует.
 * Источники: Hindle yoke/stone (дистанция/фазы), Winwood log (ROM), Legg carries.
 */

import type { StrengthSportPlan } from './strength-sport.types';
import { auditSMPlan } from './strength-sport-sm-plan-audit.engine';
import { SM_BIOMECH, type SMWeakPoint } from './strength-sport-sm-biomechanics.engine';

export interface SMSimAction {
  weakPoint: SMWeakPoint;
  corrId: string;
  sets?: number; // default 3
  reps?: number; // default 5 (carry игнорируется — дистанция)
}

export interface SMSimDelta {
  weakPoint: SMWeakPoint;
  corrId: string;
  setsPerWeek: number;
  weeks: number;
  setsTotal: number;
  tonnageEst: number;
  weightEst: number;
  distanceEstM: number; // для carries: setsTotal × 20м
  coverageBefore: number;
  coverageAfter: number;
  coveredFlip: boolean;
  summary: string;
}

/** Оценка базы ПМ движения по токену коррекции (как в sm-injection). */
export function estimateSMCorrBasePm(corrId: string, wm: Record<string, number>): number {
  const low = String(corrId).toLowerCase();
  if (low.includes('log') || low.includes('axle') || low.includes('viking') || low.includes('circus') || low.includes('press') || low.includes('jerk') || low.includes('pin')) {
    const w = (wm as Record<string, number>).logPress ?? (wm as Record<string, number>).axlePress ?? (wm as Record<string, number>).overheadPress ?? 60;
    return w as number;
  }
  if (low.includes('yoke') || low.includes('farmers') || low.includes('frame') || low.includes('husafell') || low.includes('conan') || low.includes('shield') || low.includes('carry') || low.includes('walk')) {
    const w = (wm as Record<string, number>).farmersWalk ?? (wm as Record<string, number>).yokeWalk ?? 140;
    return w as number;
  }
  if (low.includes('stone') || low.includes('sandbag') || low.includes('keg') || low.includes('tire') || low.includes('sled')) {
    const w = (wm as Record<string, number>).atlasStone ?? (wm as Record<string, number>).sandbagLoad ?? 100;
    return w as number;
  }
  if (low.includes('squat') || low.includes('front')) return (wm as Record<string, number>).backSquat ?? 100;
  if (low.includes('pull') || low.includes('deadlift') || low.includes('rdl') || low.includes('deficit')) return (wm as Record<string, number>).deadlift ?? 120;
  if (low.includes('pinch') || low.includes('grip') || low.includes('plank') || low.includes('suitcase') || low.includes('hang') || low.includes('hammer')) return 20;
  return (wm as Record<string, number>).backSquat ?? 80;
}

export function isSMCarryCorr(corrId: string): boolean {
  const low = String(corrId).toLowerCase();
  return low.includes('carry') || low.includes('walk') || low.includes('yoke') || low.includes('farmers') || low.includes('sled');
}

export function simulateSMCorrection(plan: StrengthSportPlan | null | undefined, action: SMSimAction): SMSimDelta | null {
  if (!plan || !action || !action.weakPoint || !action.corrId) return null;
  const before = auditSMPlan(plan);
  if (!before.hasPlan) return null;
  const setsPerWeek = action.sets && action.sets > 0 ? Math.round(action.sets) : 3;
  const reps = action.reps && action.reps > 0 ? Math.round(action.reps) : 5;
  const weeks = Math.max(1, before.workWeeks);
  const wm = ((plan as unknown as { workMax?: Record<string, number> }).workMax || {}) as Record<string, number>;
  const pct = (SM_BIOMECH[action.weakPoint] as { intensityPct?: number } | undefined)?.intensityPct ?? 0.7;
  const weightEst = Math.round((estimateSMCorrBasePm(action.corrId, wm) * pct) / 2.5) * 2.5;
  const setsTotal = setsPerWeek * weeks;
  const isCarry = isSMCarryCorr(action.corrId);
  const tonnageEst = isCarry ? 0 : Math.round(setsTotal * reps * weightEst);
  const distanceEstM = isCarry ? setsTotal * 20 : 0;
  const beforeSets = before.byPhase[action.weakPoint]?.sets ?? 0;
  const afterSets = beforeSets + setsTotal;
  void afterSets;
  const coverageBefore = before.coveredCount;
  const coverageAfter = beforeSets > 0 ? coverageBefore : coverageBefore + 1;
  const loadStr = isCarry ? `~${distanceEstM}м carries` : `~${(tonnageEst / 1000).toFixed(1)}т`;
  const summary = `+${setsTotal} сетов (${loadStr}) · покрытие ${coverageBefore}/16 → ${coverageAfter}/16`;
  return {
    weakPoint: action.weakPoint,
    corrId: action.corrId,
    setsPerWeek,
    weeks,
    setsTotal,
    tonnageEst,
    weightEst,
    distanceEstM,
    coverageBefore,
    coverageAfter,
    coveredFlip: beforeSets === 0,
    summary,
  };
}
