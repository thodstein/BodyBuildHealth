import { useCallback } from 'react';
import { buildPlanDays, type BuildPlanInput, type PlanDay } from '../../engines/manual-plan-builder';

export interface PlanGenDeps {
  goal: string;
  level: string;
  mesoLength: number;
  weakPoints: string[];
  equipment: string[];
  workMax: Record<string, number>;
  manualWorkMax: Record<string, number>;
  injuries: BuildPlanInput['injuries'];
  pctForRir: Record<number, number>;
}

export interface PlanGenResult {
  days: PlanDay[];
  weeklySets: Record<string, number>;
  groupCorrections: string[];
  patternBalance: Record<string, number>;
}

export interface PlanGenOpts {
  currentReadiness?: number;
  targetTonnage?: Record<string, number>;
  sequenceStrategy?: 'classic' | 'preexhaust' | 'antagonist';
}

/**
 * usePlanGeneration — возвращает стабильную (по deps) функцию buildPlan(cycle, mrv, opts?),
 * генерирующую дни плана ручного конструктора. Чистое ядро — в engine buildPlanDays (тестируется).
 */
export function usePlanGeneration(deps: PlanGenDeps) {
  const { goal, level, mesoLength, weakPoints, equipment, workMax, manualWorkMax, injuries, pctForRir } = deps;
  return useCallback(
    (cycle: string[][], mrv: number, opts?: PlanGenOpts): PlanGenResult =>
      buildPlanDays({
        cycle, mrv, goal, level, mesoLength, weakPoints, equipment,
        workMax, manualWorkMax, injuries, pctForRir,
        currentReadiness: opts?.currentReadiness ?? 100,
        targetTonnage: opts?.targetTonnage,
        sequenceStrategy: opts?.sequenceStrategy ?? 'classic',
      }),
    [goal, level, mesoLength, weakPoints, equipment, workMax, manualWorkMax, injuries, pctForRir]
  );
}