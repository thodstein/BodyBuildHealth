/**
 * combat-annual.ts — изолированный годовой план для единоборств (ATR 5/3/2 + competitions).
 * Не трогает annual-training.
 */
import type { CombatPlan } from './combat.types';
export type AnnualCBPhase = 'accumulation' | 'transmutation' | 'realization' | 'transition' | 'gpp' | 'power' | 'taper';
export interface AnnualCBBlock { id: string; startWeek:number; weeks:number; discipline:string; phase: AnnualCBPhase; status:'built'|'planned'|'error'; plan?: CombatPlan; fightDate?: string | null; }
export interface AnnualCBCompetition { id:string; name:string; date:string; weightClass?:string; }
export interface AnnualCB { id:string; totalWeeks:number; discipline:string; blocks: AnnualCBBlock[]; competitions: AnnualCBCompetition[]; createdAt:string; updatedAt?:string; }
const KEY='he_combat_annual_v1';
export function saveAnnualCB(a: AnnualCB){ try{ localStorage.setItem(KEY, JSON.stringify(a)); }catch{} }
export function loadAnnualCB(): AnnualCB | null { try{ const r=localStorage.getItem(KEY); return r? JSON.parse(r): null;}catch{return null;} }
export function removeAnnualCB(): void { try{ localStorage.removeItem(KEY); }catch{} }

// legacy: склейка из планов (совместимость) — фазы auto ATR
export function buildAnnualFromCB(plans: CombatPlan[]): AnnualCB {
  let w=1; const blocks: AnnualCBBlock[] = plans.map((p, idx)=>{
    // фаза по позиции: 0→accum, 1→trans, 2→real, иначе gpp
    const phase: AnnualCBPhase = idx===0 ? 'accumulation' : idx===1 ? 'transmutation' : idx===2 ? 'realization' : 'gpp';
    return { id:p.id, startWeek:w, weeks:p.weeks, discipline:p.discipline, phase, plan:p, status:'built' as const };
  });
  for(let i=0;i<blocks.length;i++){ blocks[i].startWeek=w; w+=blocks[i].weeks; }
  const disc = plans[0]?.discipline || 'mma';
  return { id:`ann_cb_${Date.now()}`, totalWeeks:w-1, discipline: disc, blocks, competitions:[], createdAt:new Date().toISOString() };
}

// ATR 10нед: 5 Accum /3 Trans /2 Real (+ transition 2-4нед после главного)
export function buildAnnualATR(discipline: string, totalWeeks = 52, startDate?: string | null): AnnualCB {
  const tw = Math.max(8, Math.min(52, Math.round(totalWeeks)));
  // пропорции ATR 50/30/20
  const accum = Math.round(tw * 0.5);
  const trans = Math.round(tw * 0.3);
  const real = tw - accum - trans;
  const blocks: AnnualCBBlock[] = [
    { id:`atr_acc_${Date.now()}`, startWeek:1, weeks:accum, discipline, phase:'accumulation', status:'planned' },
    { id:`atr_trans_${Date.now()+1}`, startWeek:accum+1, weeks:trans, discipline, phase:'transmutation', status:'planned' },
    { id:`atr_real_${Date.now()+2}`, startWeek:accum+trans+1, weeks:real, discipline, phase:'realization', status:'planned' },
  ];
  // если 52 нед — добавляем transition 2 нед в конце для восстановления (как в Performance MMA)
  if (tw >= 40) {
    const transWeeks = 2;
    // урезаем realization на 2 для transition
    blocks[2].weeks = Math.max(1, blocks[2].weeks - transWeeks);
    blocks.push({ id:`atr_transit_${Date.now()+3}`, startWeek: tw - transWeeks + 1, weeks: transWeeks, discipline, phase:'transition', status:'planned' });
    // пересчёт startWeek
    let cur=1; for(const b of blocks){ b.startWeek=cur; cur+=b.weeks; }
  } else {
    let cur=1; for(const b of blocks){ b.startWeek=cur; cur+=b.weeks; }
  }
  return { id:`ann_atr_${Date.now()}`, totalWeeks: tw, discipline, blocks, competitions:[], createdAt:new Date().toISOString() };
}

export function annualCBPhaseForWeek(annual: AnnualCB | null, week: number): AnnualCBPhase | null {
  if (!annual) return null;
  for (const b of annual.blocks) if (week >= b.startWeek && week < b.startWeek + b.weeks) return b.phase;
  return null;
}

export function addCompetitionToAnnual(annual: AnnualCB, comp: AnnualCBCompetition): AnnualCB {
  const next = { ...annual, competitions: [...annual.competitions, comp], updatedAt: new Date().toISOString() } as AnnualCB;
  // если дата боя попадает в блок, помечаем block.fightDate
  try {
    const d = new Date(comp.date).getTime();
    // грубо: неделя боя = (дата - сегодня)/7 +1, если в пределах totalWeeks — помечаем
    const start = Date.now();
    const w = Math.floor((d - start)/ (7*86400000)) +1;
    if (w>=1 && w<=annual.totalWeeks) {
      for(const b of next.blocks) if (w>=b.startWeek && w< b.startWeek+b.weeks) b.fightDate = comp.date;
    }
  } catch {}
  return next;
}

export function buildAnnualPrintHtml(annual: AnnualCB): string {
  const esc = (s:string)=> s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  const rows = annual.blocks.map(b=> `<tr><td>${b.startWeek}-${b.startWeek+b.weeks-1}</td><td>${esc(b.phase)}</td><td>${esc(b.discipline)}</td><td>${b.weeks}нед</td><td>${b.status}</td><td>${b.fightDate? esc(b.fightDate):''}</td></tr>`).join('');
  const comps = annual.competitions.map(c=> `<li>${esc(c.name)} — ${esc(c.date)} ${c.weightClass? '('+esc(c.weightClass)+')':''}</li>`).join('');
  return `<html><head><meta charset="utf-8"><title>Годовой план ${esc(annual.discipline)} ${annual.totalWeeks}нед</title></head><body><h1>${esc(annual.discipline.toUpperCase())} · ${annual.totalWeeks}нед · ATR</h1><table border="1" cellpadding="6" style="border-collapse:collapse;width:100%"><tr><th>Недели</th><th>Фаза</th><th>Дисциплина</th><th>Длит.</th><th>Статус</th><th>Бой</th></tr>${rows}</table><h3>Соревнования (${annual.competitions.length})</h3><ul>${comps||'<li>нет</li>'}</ul></body></html>`;
}

export function buildAnnualIcs(annual: AnnualCB, startDate?: string | null): string {
  const start = startDate ? new Date(startDate) : new Date();
  const fmt = (d: Date)=> d.toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  const escIcs = (s:string)=> s.replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\n/g,'\\n');
  const lines: string[] = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//BodyBuildHealth//Combat Annual//RU','CALSCALE:GREGORIAN'];
  for (const b of annual.blocks) {
    const s = new Date(start.getTime() + (b.startWeek-1)*7*86400000);
    const e = new Date(s.getTime() + b.weeks*7*86400000);
    lines.push('BEGIN:VEVENT', `UID:cb-${b.id}@bodybuild`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(s)}`, `DTEND:${fmt(e)}`, `SUMMARY:${escIcs(`${b.phase} ${b.discipline} ${b.weeks}нед`)}`, `DESCRIPTION:${escIcs(`Фаза ${b.phase}, статус ${b.status}${b.fightDate?' бой '+b.fightDate:''}`)}`, 'END:VEVENT');
  }
  for (const c of annual.competitions) {
    const d = new Date(c.date);
    const e = new Date(d.getTime()+86400000);
    lines.push('BEGIN:VEVENT', `UID:comp-${c.id}@bodybuild`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(d)}`, `DTEND:${fmt(e)}`, `SUMMARY:${escIcs(`Бой: ${c.name}`)}`, `DESCRIPTION:${escIcs(c.weightClass||'')}`, 'END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
