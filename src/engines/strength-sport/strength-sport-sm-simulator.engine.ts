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
import { basePmForSM } from './strength-sport-sm-injection.engine';

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

/**
 * База ПМ для оценки веса коррекции. ДЕЛЕГИРУЕТ канону инъекции
 * (`basePmForSM`), а не держит свою копию токенов: аудит-2026-10 показал, что
 * локальная копия расходилась с инъекцией на КАЖДОЙ группе —
 *   - `plate_pinch`: `low.includes('pin')` ⊂ 'pinch' уводил в ветку лога →
 *     60 кг в превью против 20 кг в плане;
 *   - `sm_core_brace_*` (plank): падала в `backSquat ?? 80` → 48 кг на планке;
 *   - `sm_log_dip_*`: выставлено 0.60 интенсивности вместо 65% от записи.
 * Превью теперь = то, что вставится.
 */
export function estimateSMCorrBasePm(corrId: string, wm: Record<string, number>): number {
  return basePmForSM(corrId, wm);
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
