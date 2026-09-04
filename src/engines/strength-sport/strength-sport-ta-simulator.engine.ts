/**
 * strength-sport-ta-simulator.engine.ts — СИМУЛЯЦИЯ Δ КОРРЕКЦИИ ТА (E4 PRO-v2)
 *
 * «Что изменится в плане, если вставить коррекцию»: Δ сетов, оценка Δ тоннажа
 * (вес = intensityPct × ПМ движения, округление 2.5 — как в инъекции), Δ покрытия фаз.
 * Parity с bb bb-exercise-simulator.engine.ts (delta до/после, read-only).
 *
 * Чистый движок, план не мутирует.
 */

import type { StrengthSportPlan } from './strength-sport.types';
import { auditTAPlan } from './strength-sport-ta-plan-audit.engine';
import { TA_BIOMECH } from './strength-sport-biomechanics.engine';
import type { WLWeakPoint } from './strength-sport-weakpoint';

export interface TASimAction {
  weakPoint: WLWeakPoint;
  corrId: string;
  sets?: number; // default 3
  reps?: number; // default 5
}

export interface TASimDelta {
  weakPoint: WLWeakPoint;
  corrId: string;
  setsPerWeek: number;
  weeks: number;
  setsTotal: number;
  tonnageEst: number; // кг, оценка
  weightEst: number; // кг, оценка рабочего веса
  coverageBefore: number;
  coverageAfter: number;
  coveredFlip: boolean; // 0 → покрыта
  summary: string;
}

/** Оценка базы ПМ движения по токену коррекции (как в инъекции). */
export function estimateCorrBasePm(corrId: string, wm: Record<string, number>): number {
  const low = String(corrId).toLowerCase();
  if (low.includes('snatch')) return wm.snatch || 60;
  if (low.includes('clean') || low.includes('jerk') || low.includes('press')) return wm.cleanJerk || wm.clean || 80;
  if (low.includes('squat') || low.includes('overhead')) return wm.backSquat || 100;
  if (low.includes('pull') || low.includes('deficit') || low.includes('deadlift')) return wm.deadlift || 120;
  return wm.backSquat || 80;
}

export function simulateTACorrection(plan: StrengthSportPlan | null | undefined, action: TASimAction): TASimDelta | null {
  if (!plan || !action || !action.weakPoint || !action.corrId) return null;
  const before = auditTAPlan(plan);
  if (!before.hasPlan) return null;
  const setsPerWeek = action.sets && action.sets > 0 ? Math.round(action.sets) : 3;
  const reps = action.reps && action.reps > 0 ? Math.round(action.reps) : 5;
  const weeks = Math.max(1, before.workWeeks);
  const wm = ((plan as any).workMax || {}) as Record<string, number>;
  const pct = TA_BIOMECH[action.weakPoint]?.intensityPct ?? 0.7;
  const weightEst = Math.round((estimateCorrBasePm(action.corrId, wm) * pct) / 2.5) * 2.5;
  const setsTotal = setsPerWeek * weeks;
  const tonnageEst = Math.round(setsTotal * reps * weightEst);
  const beforeSets = before.byPhase[action.weakPoint]?.sets ?? 0;
  const afterSets = beforeSets + setsTotal;
  const coverageBefore = before.coveredCount;
  const coverageAfter = beforeSets > 0 ? coverageBefore : coverageBefore + 1;
  const summary = `+${setsTotal} сетов (~${(tonnageEst / 1000).toFixed(1)}т) · покрытие ${coverageBefore}/11 → ${coverageAfter}/11`;
  return {
    weakPoint: action.weakPoint, corrId: action.corrId,
    setsPerWeek, weeks, setsTotal, tonnageEst, weightEst,
    coverageBefore, coverageAfter, coveredFlip: beforeSets === 0, summary,
  };
}
