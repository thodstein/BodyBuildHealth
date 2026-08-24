/**
 * combat-loading.ts — зальная нагрузка для единоборств (изолировано).
 */
export type DayCharacter = 'тяж' | 'памп' | 'лёг';
export interface LoadingOut { reps: [number, number]; rir: number; tempo: string; rest: number; }

export function tempoForCB(isPrimary: boolean, character: DayCharacter): string {
  if (isPrimary && character==='тяж') return 'X-0-X-0';
  return '2-0-1-0';
}
export function restForCB(isPrimary: boolean, character: DayCharacter): number {
  return isPrimary && character==='тяж' ? 150 : 75;
}
export function repsForCB(goal: string, character: DayCharacter): [number, number] {
  if (goal==='power' || goal==='camp') return character==='тяж' ? [3,6] : [8,12];
  if (goal==='endurance') return character==='тяж' ? [6,10] : [12,20];
  if (goal==='weight_cut') return character==='тяж' ? [5,8] : [10,15];
  if (goal==='maintenance') return character==='тяж' ? [5,8] : [10,15];
  return [5,8];
}
export function rirForCB(goal: string, phase: string, character: DayCharacter): number {
  if (goal==='weight_cut') return 4;
  if (goal==='maintenance') return 3;
  if (phase==='deload' || phase==='taper') return 4;
  if (phase==='gpp') return character==='тяж' ? 2 : 3;
  if (phase==='power') return character==='тяж' ? 2 : 3;
  return 2;
}
