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

/**
 * usePlanGeneration — возвращает стабильную (по deps) функцию buildPlan(cycle, mrv),
 * генерирующую дни плана ручного конструктора. Чистое ядро — в engine buildPlanDays (тестируется).
 */
export function usePlanGeneration(deps: PlanGenDeps) {
  const { goal, level, mesoLength, weakPoints, equipment, workMax, manualWorkMax, injuries, pctForRir } = deps;
  return useCallback(
    (cycle: string[][], mrv: number): { days: PlanDay[]; weeklySets: Record<string, number>; groupCorrections: string[] } =>
      buildPlanDays({ cycle, mrv, goal, level, mesoLength, weakPoints, equipment, workMax, manualWorkMax, injuries, pctForRir }),
    [goal, level, mesoLength, weakPoints, equipment, workMax, manualWorkMax, injuries, pctForRir]
  );
}