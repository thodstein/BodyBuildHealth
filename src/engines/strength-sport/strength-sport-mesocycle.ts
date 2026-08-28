/**
 * strength-sport-mesocycle.ts — кросс-мезоцикл прогрессия (изолировано).
 * +2.5кг к верхним ПМ при успешном предыдущем мезо, только зал.
 */
import type { StrengthSportPlan } from './strength-sport.types';
export function applyMesocycleProgression(prev: StrengthSportPlan, nextInput: any): any {
  if (!prev) return nextInput;
  // P1: проверяем успешность предыдущего мезо — если много warnings или ACWR dangerous — не бампаем
  const warnings = prev.validation?.warnings?.length || 0;
  const hasDangerous = (prev as any).inputSnapshot?.acwr?.zone === 'dangerous';
  const hasTaperFail = prev.rationale?.some((r:string)=> r.includes('перебор') || r.includes('> MRV'));
  if (warnings > 4 || hasDangerous || hasTaperFail) {
    return { ...nextInput, workMax: { ...(nextInput.workMax||{}) }, previousPlanId: prev.id, mesocycleNote: 'Без прогрессии: предыдущий мезо перегружен' };
  }
  const bump = 2.5;
  const wm = { ...(nextInput.workMax||{}) };
  for (const k of Object.keys(prev.workMax||{})) {
    const pv = (prev.workMax as any)[k];
    if (typeof pv==='number' && pv>0) wm[k] = Math.max(wm[k]||0, pv + bump);
  }
  return { ...nextInput, workMax: wm, previousPlanId: prev.id, mesocycleNote: '+2.5кг к ПМ (успешный мезо)' };
}
