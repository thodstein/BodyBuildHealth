/**
 * strength-sport-annual.ts — изолированный годовой план для ТА/стронга (не трогает annual-training).
 * Хранит свои блоки отдельно: he_strength_annual_v1
 */
import type { StrengthSportPlan } from './strength-sport.types';

export interface AnnualSSBlock { id: string; startWeek: number; weeks: number; mode: string; plan?: StrengthSportPlan; status: 'built'|'planned'|'error'; }
export interface AnnualSS { id: string; totalWeeks: number; blocks: AnnualSSBlock[]; createdAt: string; }

const KEY='he_strength_annual_v1';
export function saveAnnualSS(a: AnnualSS){ try{ localStorage.setItem(KEY, JSON.stringify(a)); }catch{} }
export function loadAnnualSS(): AnnualSS | null { try{ const r=localStorage.getItem(KEY); return r? JSON.parse(r): null;}catch{return null;} }
export function buildAnnualFromSS(plans: StrengthSportPlan[]): AnnualSS {
  let w=1; const blocks: AnnualSSBlock[] = plans.map(p=> ({ id: p.id, startWeek: w, weeks: p.weeks, mode: p.mode, plan:p, status:'built' as const, }));
  // обновить startWeek последовательно
  for (let i=0;i<blocks.length;i++){ blocks[i].startWeek=w; w+=blocks[i].weeks; }
  return { id:`ann_ss_${Date.now()}`, totalWeeks: w-1, blocks, createdAt: new Date().toISOString() };
}
