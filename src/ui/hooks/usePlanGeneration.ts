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
  courseIntensity?: 'none' | 'mild' | 'moderate' | 'heavy';
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
  workMaxOverride?: Record<string, number>;
  mrvOverride?: number | null;
  sequenceStrategy?: 'classic' | 'preexhaust' | 'antagonist';
  addDeloadWeek?: boolean;
}

/**
 * usePlanGeneration — возвращает стабильную (по deps) функцию buildPlan(cycle, mrv, opts?),
 * генерирующую дни плана ручного конструктора. Чистое ядро — в engine buildPlanDays (тестируется).
 */
export function usePlanGeneration(deps: PlanGenDeps) {
  const { goal, level, mesoLength, weakPoints, equipment, workMax, manualWorkMax, injuries, pctForRir, courseIntensity } = deps;
  return useCallback(
    (cycle: string[][], mrv: number, opts?: PlanGenOpts): PlanGenResult =>
      buildPlanDays({
        cycle, mrv, goal, level, mesoLength, weakPoints, equipment,
        workMax, manualWorkMax, injuries, pctForRir,
        currentReadiness: opts?.currentReadiness ?? 100,
        targetTonnage: opts?.targetTonnage,
        workMaxOverride: opts?.workMaxOverride,
        mrvOverride: opts?.mrvOverride,
        sequenceStrategy: opts?.sequenceStrategy ?? 'classic',
        courseIntensity,
        addDeloadWeek: opts?.addDeloadWeek,
      }),
    [goal, level, mesoLength, weakPoints, equipment, workMax, manualWorkMax, injuries, pctForRir, courseIntensity]
  );
}