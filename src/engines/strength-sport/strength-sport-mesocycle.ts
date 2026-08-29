/**
 * strength-sport-mesocycle.ts — кросс-мезоцикл прогрессия (изолировано).
 * PRO: % прогрессия, не фикс +2.5кг — snatch 2%, squat 2.5%, dead 2%, press 2% (разные стимулы)
 */
import type { StrengthSportPlan } from './strength-sport.types';
const MESO_PCT: Record<string, number> = {
  snatch: 0.02, clean: 0.02, cleanJerk: 0.02, jerk: 0.02,
  backSquat: 0.025, frontSquat: 0.022, squat: 0.025, hack_squat: 0.022,
  deadlift: 0.02, sumo_dl: 0.02, axleDeadlift: 0.02, rdl: 0.015,
  overheadPress: 0.02, logPress: 0.02, bench: 0.02, circusDbPress: 0.02,
  yokeWalk: 0.015, farmersWalk: 0.015, atlasStone: 0.015,
};
export function applyMesocycleProgression(prev: StrengthSportPlan, nextInput: any): any {
  if (!prev) return nextInput;
  const warnings = prev.validation?.warnings?.length || 0;
  const hasDangerous = (prev as any).inputSnapshot?.acwr?.zone === 'dangerous';
  const hasTaperFail = prev.rationale?.some((r:string)=> r.includes('перебор') || r.includes('> MRV'));
  if (warnings > 4 || hasDangerous || hasTaperFail) {
    return { ...nextInput, workMax: { ...(nextInput.workMax||{}) }, previousPlanId: prev.id, mesocycleNote: 'Без прогрессии: предыдущий мезо перегружен' };
  }
  const wm = { ...(nextInput.workMax||{}) };
  for (const k of Object.keys(prev.workMax||{})) {
    const pv = (prev.workMax as any)[k];
    if (typeof pv==='number' && pv>0) {
      const pct = MESO_PCT[k] ?? 0.02;
      const bump = Math.max(1, Math.round(pv * pct / 1) * 1);
      wm[k] = Math.max(wm[k]||0, pv + bump);
    }
  }
  const pctNote = Object.keys(prev.workMax||{}).map(k=> `${k} +${Math.round((MESO_PCT[k]??0.02)*100)}%`).join(', ');
  return { ...nextInput, workMax: wm, previousPlanId: prev.id, mesocycleNote: `Прогрессия ${pctNote} (успешный мезо)` };
}
export function wasInPreviousMeso(prev: StrengthSportPlan, exId: string): boolean {
  return prev.weeksData?.some(w=> w.sessions.some(s=> s.exercises.some(e=> e.id===exId))) || false;
}
