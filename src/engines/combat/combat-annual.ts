/**
 * combat-annual.ts — изолированный годовой план для единоборств (не трогает annual-training).
 */
import type { CombatPlan } from './combat.types';
export interface AnnualCBBlock { id: string; startWeek:number; weeks:number; discipline:string; plan?: CombatPlan; status:'built'|'planned'|'error'; }
export interface AnnualCB { id:string; totalWeeks:number; blocks: AnnualCBBlock[]; createdAt:string; }
const KEY='he_combat_annual_v1';
export function saveAnnualCB(a: AnnualCB){ try{ localStorage.setItem(KEY, JSON.stringify(a)); }catch{} }
export function loadAnnualCB(): AnnualCB | null { try{ const r=localStorage.getItem(KEY); return r? JSON.parse(r): null;}catch{return null;} }
export function buildAnnualFromCB(plans: CombatPlan[]): AnnualCB {
  let w=1; const blocks: AnnualCBBlock[] = plans.map(p=>({ id:p.id, startWeek:w, weeks:p.weeks, discipline:p.discipline, plan:p, status:'built' as const }));
  for(let i=0;i<blocks.length;i++){ blocks[i].startWeek=w; w+=blocks[i].weeks; }
  return { id:`ann_cb_${Date.now()}`, totalWeeks:w-1, blocks, createdAt:new Date().toISOString() };
}
