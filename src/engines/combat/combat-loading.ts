/**
 * combat-loading.ts — зальная нагрузка для единоборств (изолировано).
 */
export type DayCharacter = 'тяж' | 'памп' | 'лёг';
export interface LoadingOut { reps: [number, number]; rir: number; tempo: string; rest: number; }

const TEMPO_OVERRIDES_CB: Record<string,string> = {
  neck_harness_ext:'2-1-1-0', neck_lateral_flex:'2-1-1-0', neck_bridge_wrestler:'2-1-1-0',
  landmine_rotation:'1-0-1-0', landmine_180:'1-0-1-0', pallof_rotation_press:'2-1-1-1', suitcase_carry:'1-0-1-0', med_ball_throw:'X-0-X-0',
  bench_bar:'2-0-1-0', squat:'2-0-1-0', front_squat:'2-0-1-0', rdl:'3-1-1-0', bulgarian_split_heavy:'3-0-1-0', cossack_squat:'3-0-1-0',
  pullup:'2-0-1-0', gi_grip_pullup:'2-0-1-0', row_bar:'2-0-1-0', ohp:'2-0-1-0',
};
export function tempoForCB(id: string, isPrimary: boolean, character: DayCharacter): string {
  if (id && TEMPO_OVERRIDES_CB[id]) return TEMPO_OVERRIDES_CB[id];
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
