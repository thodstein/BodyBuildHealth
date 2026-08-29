/**
 * combat-progression.ts — RIR/фазы для единоборств. @deprecated — используйте combat-periodization.engine
 * Оставлен для совместимости, делегирует в ATR.
 */
import { phaseForCombatWeekATR, rirForCombatPhase, repsForCombatPhase } from './combat-periodization.engine';
import type { CombatPhase } from './combat.types';

/** @deprecated используйте phaseForCombatWeekATR */
export function phaseForCombatWeek(week: number, totalWeeks: number, goal: string): string {
  return phaseForCombatWeekATR(week, totalWeeks, goal, 'linear') as string;
}

/** @deprecated используйте rirForCombatPhase */
export function rirForCombat(goal: string, phase: string, character: string): number {
  return rirForCombatPhase(phase as CombatPhase, character as any, goal);
}

/** @deprecated используйте repsForCombatPhase */
export function repsForCombat(goal: string, character: string): [number, number] {
  // маппим на gpp/power эквивалент
  const ph: CombatPhase = goal === 'weight_cut' ? 'gpp' : goal === 'power' || goal === 'camp' ? 'power' : 'gpp';
  return repsForCombatPhase(ph, character as any, goal);
}
