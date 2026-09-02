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
  const tot = w-1;
  return { id:`ann_cb_${disc}_${tot}_${plans.length}`, totalWeeks:tot, discipline: disc, blocks, competitions:[], createdAt:new Date().toISOString() };
}

// ATR 10нед: 5 Accum /3 Trans /2 Real (+ transition 2-4нед после главного)
// Issurin residual: strength 30-40д, aerobic 25-35д, anaerobic 18-24д, speed 2-7д — для multi-cycle кумуляция
export function buildAnnualATR(discipline: string, totalWeeks = 52, startDate?: string | null, opts?: { cycles?: number; disciplinePerCycle?: string[] }): AnnualCB {
  const tw = Math.max(8, Math.min(52, Math.round(totalWeeks)));
  const cycles = Math.max(1, Math.min(4, Math.round(opts?.cycles ?? 1)));
  if (cycles === 1) {
    // пропорции ATR 50/30/20 — используем largest remainder как в periodization
    const accum = Math.round(tw * 0.5);
    const trans = Math.round(tw * 0.3);
    const real = Math.max(1, tw - accum - trans);
    const blocks: AnnualCBBlock[] = [
      { id:`atr_acc_${discipline}_${tw}`, startWeek:1, weeks:accum, discipline, phase:'accumulation', status:'planned' },
      { id:`atr_trans_${discipline}_${tw}`, startWeek:accum+1, weeks:trans, discipline, phase:'transmutation', status:'planned' },
      { id:`atr_real_${discipline}_${tw}`, startWeek:accum+trans+1, weeks:real, discipline, phase:'realization', status:'planned' },
    ];
    if (tw >= 40) {
      const transWeeks = 2;
      blocks[2].weeks = Math.max(1, blocks[2].weeks - transWeeks);
      blocks.push({ id:`atr_transit_${discipline}_${tw}`, startWeek: tw - transWeeks + 1, weeks: transWeeks, discipline, phase:'transition', status:'planned' });
      let cur=1; for(const b of blocks){ b.startWeek=cur; cur+=b.weeks; }
    } else {
      let cur=1; for(const b of blocks){ b.startWeek=cur; cur+=b.weeks; }
    }
    return { id:`ann_atr_${discipline}_${tw}`, totalWeeks: tw, discipline, blocks, competitions:[], createdAt:new Date().toISOString() };
  }
  // Multi-cycle: делим год на cycles макро-циклов 8-13нед (Issurin 8-13), каждый 5/3/2
  const basePerCycle = Math.floor(tw / cycles);
  const remainder = tw - basePerCycle * cycles;
  const blocks: AnnualCBBlock[] = [];
  let curWeek = 1;
  for (let c = 0; c < cycles; c++) {
    const cWeeks = basePerCycle + (c < remainder ? 1 : 0);
    const cDisc = opts?.disciplinePerCycle?.[c] || discipline;
    // внутри цикла 50/30/20 с transition 2нед между циклами (кроме последнего)
    const isLast = c === cycles - 1;
    const effWeeks = isLast && tw >= 40 ? cWeeks : (cWeeks > 10 ? cWeeks - 1 : cWeeks); // резерв 1нед transition между циклами
    const accum = Math.round(effWeeks * 0.5);
    const trans = Math.round(effWeeks * 0.3);
    const real = Math.max(1, effWeeks - accum - trans);
    blocks.push({ id:`atr_c${c+1}_acc_${cDisc}`, startWeek: curWeek, weeks: accum, discipline: cDisc, phase:'accumulation', status:'planned' });
    curWeek += accum;
    blocks.push({ id:`atr_c${c+1}_trans_${cDisc}`, startWeek: curWeek, weeks: trans, discipline: cDisc, phase:'transmutation', status:'planned' });
    curWeek += trans;
    blocks.push({ id:`atr_c${c+1}_real_${cDisc}`, startWeek: curWeek, weeks: real, discipline: cDisc, phase:'realization', status:'planned' });
    curWeek += real;
    if (!isLast) {
      // transition 1-2нед: residual strength 30-40д покрывает, aerobic 25-35д — активный отдых
      blocks.push({ id:`atr_c${c+1}_transit`, startWeek: curWeek, weeks: 1, discipline: cDisc, phase:'transition', status:'planned' });
      curWeek += 1;
    } else if (tw >= 40) {
      blocks.push({ id:`atr_transit_final`, startWeek: curWeek, weeks: 2, discipline: cDisc, phase:'transition', status:'planned' });
      curWeek += 2;
    }
  }
  // нормализация startWeek после возможного переполнения из-за округлений
  let w = 1; for (const b of blocks) { b.startWeek = w; w += b.weeks; }
  const total = w - 1;
  // если total != tw — коррекция последнего transition
  if (total !== tw) {
    const diff = tw - total;
    const last = blocks[blocks.length - 1];
    if (last.phase === 'transition') last.weeks = Math.max(1, last.weeks + diff);
  }
  w = 1; for (const b of blocks) { b.startWeek = w; w += b.weeks; }
  return { id:`ann_atr_${discipline}_${tw}_${cycles}c`, totalWeeks: tw, discipline, blocks, competitions:[], createdAt:new Date().toISOString() };
}

export function buildAnnualATRCycles(discipline: string, cycles: number, totalWeeks = 52, startDate?: string | null, disciplinePerCycle?: string[]): AnnualCB {
  return buildAnnualATR(discipline, totalWeeks, startDate, { cycles, disciplinePerCycle });
}

export function annualResidualNote(cycle: number): string {
  // Issurin residual table
  const notes = ['Сила 30-40д · аэроб 25-35д · анаэроб 18-24д · скорость 2-7д — следующий цикл опирается на базу предыдущего'];
  return notes[0];
}

export function annualCBPhaseForWeek(annual: AnnualCB | null, week: number): AnnualCBPhase | null {
  if (!annual) return null;
  for (const b of annual.blocks) if (week >= b.startWeek && week < b.startWeek + b.weeks) return b.phase;
  return null;
}

function isValidIsoDateAnnual(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s);
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0,10)===s;
}
export function addCompetitionToAnnual(annual: AnnualCB, comp: AnnualCBCompetition, startDate?: string | null): AnnualCB {
  const next: AnnualCB = { ...annual, competitions: [...annual.competitions, comp], updatedAt: new Date().toISOString(), blocks: annual.blocks.map(b=> ({...b})) } as AnnualCB;
  try {
    if (!isValidIsoDateAnnual(comp.date)) return next;
    const d = new Date(comp.date).getTime();
    // детерм: если передан startDate — считаем от него, иначе от сегодня (fallback)
    const startRef = (startDate && isValidIsoDateAnnual(startDate)) ? new Date(startDate).getTime() : Date.now();
    if (d < startRef) return next; // бой до старта — не вставляем тапер
    const w = Math.floor((d - startRef)/ (7*86400000)) +1;
    if (w>=1 && w<=annual.totalWeeks) {
      // P1-5: вставляем taper-блок 2нед перед боем (w-1..w) если влезает, с проверкой перекрытия таперов
      if (w >= 2 && w <= annual.totalWeeks) {
        const taperStart = w - 1;
        const taperEnd = w;
        const hasOverlap = next.blocks.some(b=> b.phase==='taper' && !(taperEnd < b.startWeek || taperStart > b.startWeek + b.weeks -1));
        if (hasOverlap) {
          // перекрытие таперов — не вставляем второй, просто помечаем ближайший блок
          for(const b of next.blocks) if (w>=b.startWeek && w< b.startWeek+b.weeks) b.fightDate = comp.date;
          return next;
        }
        // найдём блок, содержащий taperStart
        const idx = next.blocks.findIndex(b => taperStart >= b.startWeek && taperStart < b.startWeek + b.weeks);
        if (idx >= 0) {
          const b = next.blocks[idx];
          // проверим что taper помещается внутри одного блока (обычный случай — большой ATR блок)
          const bEnd = b.startWeek + b.weeks - 1;
          if (taperEnd <= bEnd) {
            const prefixWeeks = taperStart - b.startWeek;
            const suffixWeeks = bEnd - taperEnd;
            const newBlocks: AnnualCBBlock[] = [];
            for (let i=0;i<next.blocks.length;i++) {
              if (i !== idx) { newBlocks.push(next.blocks[i]); continue; }
              if (prefixWeeks > 0) newBlocks.push({ ...b, id: `${b.id}_pre`, weeks: prefixWeeks, fightDate: null } as any);
              newBlocks.push({ id: `taper_${comp.id}`, startWeek: taperStart, weeks: 2, discipline: b.discipline, phase: 'taper' as AnnualCBPhase, status: 'planned' as const, fightDate: comp.date });
              if (suffixWeeks > 0) newBlocks.push({ ...b, id: `${b.id}_post`, weeks: suffixWeeks, fightDate: null } as any);
            }
            // пересчёт startWeek
            let cur=1; for(const nb of newBlocks){ nb.startWeek=cur; cur+=nb.weeks; }
            next.blocks = newBlocks;
            next.totalWeeks = cur-1;
            return next;
          }
        }
      }
      // fallback: просто помечаем блок
      for(const b of next.blocks) if (w>=b.startWeek && w< b.startWeek+b.weeks) b.fightDate = comp.date;
    }
  } catch {}
  return next;
}

export function buildAnnualPrintHtml(annual: AnnualCB): string {
  const esc = (s:string)=> String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  const phaseColor: Record<string,string> = { accumulation:'#3b82f6', transmutation:'#a855f7', realization:'#ef4444', transition:'#f59e0b', gpp:'#10b981', power:'#f97316', taper:'#06b6d4', deload:'#eab308', conjugate:'#6366f1' };
  const rows = annual.blocks.map(b=>{
    const col = phaseColor[b.phase] || '#6b7280';
    return `<tr style="background:${col}14; border-left:4px solid ${col}"><td>${b.startWeek}-${b.startWeek+b.weeks-1}</td><td><span style="background:${col};color:#fff;padding:2px 6px;border-radius:4px;font-size:10px">${esc(b.phase)}</span></td><td>${esc(b.discipline)}</td><td>${b.weeks}нед</td><td>${b.status}</td><td>${b.fightDate? esc(b.fightDate):''}</td></tr>`;
  }).join('');
  const comps = annual.competitions.map(c=> `<li>${esc(c.name)} — ${esc(c.date)} ${c.weightClass? '('+esc(c.weightClass)+')':''}</li>`).join('');
  // Gantt — горизонтальная полоса ATR (как annual-training-print)
  const ganttSegs = annual.blocks.map(b=> {
    const col = phaseColor[b.phase] || '#6b7280';
    const w = (b.weeks / annual.totalWeeks * 100).toFixed(2);
    const label = `${esc(b.phase)} ${b.weeks}н`;
    return `<div title="${label} нед ${b.startWeek}-${b.startWeek+b.weeks-1}${b.fightDate? ' бой '+esc(b.fightDate):''}" style="width:${w}%;background:${col};display:flex;align-items:center;justify-content:center;color:#fff;font-size:7px;font-weight:700;overflow:hidden;white-space:nowrap;border-right:0.5px solid #fff">${b.weeks>=3? label : ''}</div>`;
  }).join('');
  const gantt = `<div style="display:flex;height:14px;border-radius:6px;overflow:hidden;border:0.5px solid #e5e7eb;margin:8px 0 4px">${ganttSegs}</div><div style="display:flex;justify-content:space-between;font-size:8px;color:#6b7280"><span>Нед 1</span><span>Нед ${annual.totalWeeks}</span></div>`;
  const hash = `cb-${annual.discipline}-${annual.totalWeeks}w-${annual.blocks.map(b=> b.phase[0]).join('')}`;
  const qrData = encodeURIComponent(hash);
  return `<html><head><meta charset="utf-8"><title>Годовой план ${esc(annual.discipline)} ${annual.totalWeeks}нед</title><style>body{font-family:Inter,Arial,sans-serif;padding:16px;color:#111}table th{background:#f3f4f6} h1{margin:0 0 8px} @media print{body{padding:8px}}</style></head><body><h1>${esc(annual.discipline.toUpperCase())} · ${annual.totalWeeks}нед · ATR</h1>${gantt}<table border="1" cellpadding="6" style="border-collapse:collapse;width:100%;margin-top:8px"><tr><th>Недели</th><th>Фаза</th><th>Дисциплина</th><th>Длит.</th><th>Статус</th><th>Бой</th></tr>${rows}</table><h3>Соревнования (${annual.competitions.length})</h3><ul>${comps||'<li>нет</li>'}</ul><div style="margin-top:12px;padding:8px 10px;background:#f3f4f6;border-radius:6px;font-size:10px;color:#6b7280;display:flex;align-items:center;gap:10">hash: ${esc(hash)} · #combat-annual · печать: Ctrl+P → PDF <img src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${qrData}" alt="QR ${esc(hash)}" style="border-radius:4px;border:0.5px solid #e5e7eb" width="70" height="70"/></div></body></html>`;
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
