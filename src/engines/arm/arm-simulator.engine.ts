/**
 * arm-simulator.engine.ts — симуляция Δ инъекции коррекции (E4 P0).
 * Parity: bb `simulateCorrection` — сеты/покрытие точек до/после, без мутаций плана.
 */
import type { ArmPlan } from './arm-types';
import type { ArmWeakPoint } from './arm-biomechanics.engine';
import { auditArmPlan } from './arm-plan-audit.engine';
import { ARM_CORRECTIONS } from './arm-weakpoint-corrections';

export interface ArmSimDelta {
  addSets: number;
  coverageBefore: number;
  coverageAfter: number;
  summary: string;
}

export function simulateArmInjection(
  plan: ArmPlan | null | undefined,
  point: ArmWeakPoint,
  exerciseId?: string | null,
): ArmSimDelta | null {
  const audit = auditArmPlan(plan);
  const corr = ARM_CORRECTIONS[point];
  if (!corr) return null;
  const addSets = corr.sets || 3;
  const before = audit ? audit.covered.length : 0;
  const alreadyCovered = audit ? audit.byPoint[point]?.sets > 0 : false;
  const after = audit ? before + (alreadyCovered ? 0 : 1) : 1;
  const ex = exerciseId || corr.exercises[0];
  const summary = `+${addSets} сетов (${ex}) · покрытие ${before}/12 → ${after}/12`;
  return { addSets, coverageBefore: before, coverageAfter: after, summary };
}
