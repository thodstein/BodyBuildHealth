/**
 * strength-sport-loading.ts — зальная нагрузка для ТА/стронга (изолировано).
 * Tempo/rest/phase mapping как bb-tempo-rest но доменный.
 */

export type DayCharacter = 'тяж' | 'памп' | 'лёг';
export interface LoadingOut { reps: [number, number]; rir: number; pct: number; tempo: string; rest: number; }

const PCT_BY_PHASE: Record<string, number> = {
  accumulation: 0.75, intensification: 0.85, peaking: 0.92, deload: 0.60, transition: 0.65,
};

export function tempoForSS(id: string, character: DayCharacter, phase: string): string {
  if (id.includes('snatch') || id.includes('clean') || id.includes('jerk')) return 'X-0-X-0';
  if (phase==='deload') return '3-1-1-0';
  if (character==='тяж') return '2-0-1-0';
  if (character==='памп') return '2-0-1-1';
  return '2-0-1-0';
}
export function restForSS(character: DayCharacter, isPrimary: boolean): number {
  if (isPrimary && character==='тяж') return 180;
  if (character==='тяж') return 120;
  if (character==='памп') return 75;
  return 90;
}
export function pctForSS(phase: string, goal: string): number {
  if (goal==='technique') return 0.65;
  return PCT_BY_PHASE[phase] || 0.78;
}
export function repsForSS(tag: string, phase: string, goal: string, isPrimary: boolean): [number, number] {
  if (goal==='technique') return [1,3];
  if (tag==='snatch_day' || tag==='clean_day' || tag==='oly_day') return isPrimary ? [1,3] : [3,5];
  if (tag==='technique_day') return [1,2];
  if (tag==='event_day') return isPrimary ? [1,5] : [6,10];
  if (phase==='peaking') return isPrimary ? [1,3] : [3,6];
  if (phase==='accumulation') return isPrimary ? [3,6] : [8,12];
  if (phase==='intensification') return isPrimary ? [2,5] : [6,10];
  if (phase==='deload') return isPrimary ? [3,5] : [8,12];
  return [3,6];
}

export function computeSSLoading(tag: string, phase: string, goal: string, isPrimary: boolean, character: DayCharacter): LoadingOut {
  const reps = repsForSS(tag, phase, goal, isPrimary);
  const pct = pctForSS(phase, goal);
  const tempo = tempoForSS('', character, phase);
  const rest = restForSS(character, isPrimary);
  // RIR will be set via rirForWeek outside (needs week)
  return { reps, rir: 2, pct, tempo, rest };
}
