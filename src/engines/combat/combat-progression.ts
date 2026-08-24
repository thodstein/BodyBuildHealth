/**
 * combat-progression.ts — RIR/фазы для единоборств.
 * Не гонимся за ПМ — важнее сохранение скорости/выносливости.
 */

export function phaseForCombatWeek(week: number, totalWeeks: number, goal: string): string {
  if (goal === 'camp' && totalWeeks >= 6) {
    if (week <= Math.round(totalWeeks * 0.5)) return 'gpp';
    if (week <= totalWeeks - 2) return 'power';
    if (week === totalWeeks - 1) return 'taper';
    return 'deload';
  }
  if (totalWeeks <= 3) return 'gpp';
  if (week === totalWeeks) return 'deload';
  if (week <= Math.round(totalWeeks * 0.4)) return 'gpp';
  if (week <= Math.round(totalWeeks * 0.8)) return 'power';
  return 'taper';
}

export function rirForCombat(goal: string, phase: string, character: string): number {
  if (goal === 'weight_cut') return 4;
  if (goal === 'maintenance') return 3;
  if (phase === 'deload' || phase === 'taper') return 4;
  if (phase === 'gpp') return character === 'тяж' ? 2 : 3;
  if (phase === 'power') return character === 'тяж' ? 2 : 3;
  return 2;
}

export function repsForCombat(goal: string, character: string): [number, number] {
  if (goal === 'power' || goal === 'camp') return character === 'тяж' ? [3, 6] : [8, 12];
  if (goal === 'endurance') return character === 'тяж' ? [6, 10] : [12, 20];
  if (goal === 'weight_cut') return character === 'тяж' ? [5, 8] : [10, 15];
  if (goal === 'maintenance') return character === 'тяж' ? [5, 8] : [10, 15];
  return [5, 8];
}
