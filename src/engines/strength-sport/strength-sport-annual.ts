/**
 * strength-sport-annual.ts — изолированный годовой план для ТА/стронга (не трогает annual-training).
 * Хранит свои блоки отдельно: he_strength_annual_v1
 * P0-8: sync/taper/валидация как в annual-training/block-builders но изолированно.
 */
import type { StrengthSportPlan } from './strength-sport.types';

export interface AnnualSSBlock { id: string; startWeek: number; weeks: number; mode: string; plan?: StrengthSportPlan; status: 'built'|'planned'|'error'; competitionDate?: string; taperWeeks?: number; }
export interface AnnualSS { id: string; totalWeeks: number; blocks: AnnualSSBlock[]; createdAt: string; updatedAt?: string; }

const KEY='he_strength_annual_v1';
export function saveAnnualSS(a: AnnualSS){
  try{
    const withUpdated = { ...a, updatedAt: new Date().toISOString() };
    localStorage.setItem(KEY, JSON.stringify(withUpdated));
    try{ window.dispatchEvent(new CustomEvent('he-strength-annual-updated', { detail: withUpdated })); }catch{}
  }catch{}
}
export function loadAnnualSS(): AnnualSS | null { try{ const r=localStorage.getItem(KEY); return r? JSON.parse(r): null;}catch{return null;} }
export function removeAnnualSS(){ try{ localStorage.removeItem(KEY);}catch{} }

export function buildAnnualFromSS(plans: StrengthSportPlan[]): AnnualSS {
  let w=1; const blocks: AnnualSSBlock[] = plans.map(p=> ({ id: p.id, startWeek: w, weeks: p.weeks, mode: p.mode, plan:p, status:'built' as const, }));
  // обновить startWeek последовательно
  for (let i=0;i<blocks.length;i++){ blocks[i].startWeek=w; w+=blocks[i].weeks; }
  return { id:`ann_ss_${Date.now()}`, totalWeeks: w-1, blocks, createdAt: new Date().toISOString() };
}

// P0 fix: без мутации исходного plan — клонируем недели
export function buildAnnualWithTaper(plans: StrengthSportPlan[], opts?: { competitionDate?: string; taperWeeks?: number }): AnnualSS {
  const base = buildAnnualFromSS(plans);
  if (!opts?.competitionDate) return base;
  const taperW = Math.max(1, Math.min(2, opts.taperWeeks ?? 1));
  const last = base.blocks[base.blocks.length - 1];
  if (last && last.plan) {
    last.taperWeeks = taperW;
    last.competitionDate = opts.competitionDate;
    // клонируем weeksData чтобы не мутировать исходный plan из he_strength_sport_plans_v1
    const cloned = JSON.parse(JSON.stringify(last.plan.weeksData));
    if (cloned.length >= taperW) {
      for (let i = cloned.length - taperW; i < cloned.length; i++) {
        cloned[i].taper = true;
        // taper как отдельная фаза для Gantt/validate (как taperWeeksForBlock в annual-training)
        if (!cloned[i].phase || cloned[i].phase !== 'taper') {
          cloned[i].phase = 'peaking';
        }
        cloned[i].deload = false;
      }
    }
    last.plan = { ...last.plan, weeksData: cloned };
    // также обновляем общий totalWeeks/blocks чтобы taper виден как часть плана
    last.weeks = cloned.length;
  }
  return base;
}

export function validateAnnualSS(annual: AnnualSS): { ok: boolean; warnings: string[]; errors: string[] } {
  const warnings: string[] = []; const errors: string[] = [];
  let expected = 1;
  for (const b of annual.blocks) {
    if (b.startWeek !== expected) warnings.push(`Блок ${b.id}: startWeek ${b.startWeek} ≠ ожидаемо ${expected} — сдвиг.`);
    expected = b.startWeek + b.weeks;
  }
  if (annual.totalWeeks !== expected - 1) errors.push(`totalWeeks ${annual.totalWeeks} ≠ сумме блоков ${expected - 1}`);
  if (annual.blocks.some(b=> b.weeks < 2 || b.weeks > 16)) warnings.push('Блок вне 2-16 нед — проверьте.');
  return { ok: errors.length===0, warnings, errors };
}

export function activeBlockForWeek(annual: AnnualSS, week: number): AnnualSSBlock | null {
  return annual.blocks.find(b=> week >= b.startWeek && week < b.startWeek + b.weeks) || null;
}

export function validateAnnualSSPhases(annual: AnnualSS): string[] {
  const warns: string[] = [];
  // 3× peaking подряд — методическая ошибка
  let peakingStreak = 0;
  for (const b of annual.blocks) {
    const isPeaking = b.plan?.weeksData?.some(w => w.phase === 'peaking');
    if (isPeaking) peakingStreak++; else peakingStreak = 0;
    if (peakingStreak >= 3) warns.push(`Блоки ${b.id}: 3+ peaking подряд — риск перетренированности`);
  }
  // taper 1-2нед перед competitionDate (как taperWeeksForBlock в annual-training)
  for (const b of annual.blocks) {
    if (b.competitionDate) {
      const expected = Math.max(1, Math.min(2, b.taperWeeks ?? 1));
      const taperWeeks = (b.plan?.weeksData || []).filter(w=> (w as any).taper).length;
      if (taperWeeks === 0) warns.push(`Блок ${b.id}: нет taper перед стартом ${b.competitionDate} — добавьте ${expected}нед taper (объём ×0.45/0.65)`);
      else if (taperWeeks !== expected) warns.push(`Блок ${b.id}: taper ${taperWeeks}нед ≠ ожидаемо ${expected}нед перед ${b.competitionDate}`);
    }
  }
  return warns;
}

export function weeksUntilCompetition(annual: AnnualSS, competitionDate: string, startDate?: string): number | null {
  try{
    const fallback = (annual.blocks[0] as any)?.plan?.inputSnapshot?.startDate as string | undefined;
    const s = startDate || fallback || annual.createdAt;
    const start = new Date(s);
    const comp = new Date(competitionDate);
    const diff = Math.round((comp.getTime() - start.getTime()) / (1000*60*60*24*7));
    return diff;
  }catch{ return null; }
}
