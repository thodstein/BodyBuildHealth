/**
 * strength-sport-export.ts — экспорт плана Стронг+ТА (порт pl-export, изолированно)
 * CSV/HTML печать + текстовый отчёт. Без xlsx зависимости — CSV совместим с Excel.
 */
import type { StrengthSportPlan } from './strength-sport.types';
import { buildWLMeetPlan } from './strength-sport-attempts.engine';

function escHtml(s: string): string { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escCsv(s: string | number): string { const v = String(s).replace(/"/g,'""'); return /[",\n;]/.test(v) ? `"${v}"` : v; }

export interface StrengthExportRow { week:number; phase:string; day:number; tag:string; character:string; exercise:string; sets:number; reps:string; weight:number; pct:number; rir:number; tempo:string; rest:number; comment:string; distanceM?: number; timeCapS?: number; }

export function strengthExportRows(plan: StrengthSportPlan): StrengthExportRow[] {
  const rows: StrengthExportRow[] = [];
  for(const wk of plan.weeksData){
    for(const sess of wk.sessions){
      for(const ex of sess.exercises){
        const ws0: any = ex.workSets[0];
        rows.push({ week: wk.week, phase: wk.phase, day: sess.day, tag: sess.sessionTag, character: sess.character, exercise: ex.name, sets: ex.sets, reps: ex.reps, weight: ex.weight, pct: ws0?.pct || 0, rir: ex.rir, tempo: ex.tempo || '', rest: ex.restSeconds || 0, comment: ex.comment || '', distanceM: ws0?.distanceM, timeCapS: ws0?.timeCapS });
      }
    }
  }
  return rows;
}

export function buildStrengthCsv(plan: StrengthSportPlan): string {
  const header = ['Неделя','Фаза','День','Тренировка','Характер','Упражнение','Сеты','Повторы','Вес','%ПМ','RIR','Темп','Отдыхс','Дист','ВремяCap','Комментарий'];
  const rows = strengthExportRows(plan);
  const lines = [header.map(escCsv).join(';')];
  for(const r of rows) lines.push([r.week,r.phase,r.day,r.tag,r.character,r.exercise,r.sets,r.reps,r.weight,r.pct,r.rir,r.tempo,r.rest,r.distanceM||'',r.timeCapS||'',r.comment].map(escCsv).join(';'));
  return lines.join('\n');
}

const PHASE_COLOR_SS: Record<string,string> = { accumulation:'#0A84FF', intensification:'#FF9F0A', integration:'#7C3AED', peaking:'#FF3B30', deload:'#8E8E93', transition:'#636366', taper:'#30D158' };
const PHASE_RU_SS: Record<string,string> = { accumulation:'Накопление', intensification:'Интенсиф.', integration:'Интеграция', peaking:'Пик', deload:'Разгр.', transition:'Переход', taper:'Тапер' };

function buildPrintHeader(plan: StrengthSportPlan): string {
  const title = `Стронг+ТА ${escHtml(plan.mode)} ${plan.weeks}нед · ${escHtml(plan.level)}`;
  const hash = (()=>{ try{ const s=JSON.stringify({id:plan.id, mode:plan.mode}); let h=0; for(let i=0;i<s.length;i++) h=(h*31 + s.charCodeAt(i))>>>0; return h.toString(36).slice(0,6);}catch{return ''}})();
  const date = new Date().toLocaleDateString('ru-RU');
  return `<header style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:linear-gradient(135deg, #0A84FF 0%, #30D158 100%);color:#fff;border-radius:12px;margin-bottom:12px">
    <div style="display:flex;align-items:center;gap:10px"><div style="width:38px;height:38px;border-radius:10px;background:rgba(255,255,255,0.18);display:flex;align-items:center;justify-content:center;font-size:20px;border:1px solid rgba(255,255,255,0.22)">🏋️</div><div><div style="font-size:15px;font-weight:800;letter-spacing:-0.02em">${title}</div><div style="font-size:11px;opacity:0.92">BodyBuildHealth · ${date} · ${escHtml(plan.patternId)} · #${hash}</div></div></div>
    <div style="width:64px;height:64px;background:#fff;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:9px;color:#111;text-align:center;line-height:1.2;border:1px solid #e5e7eb">QR<br/>#${hash}<br/>${escHtml(plan.mode)}</div>
  </header>`;
}

function buildPhaseGantt(plan: StrengthSportPlan): string {
  const total = plan.weeks;
  const segs = plan.weeksData.map(w=>{
    const isTaper = (w as any).taper;
    const key = isTaper ? 'taper' : w.phase;
    return { key, phase: key, weeks:1, color: PHASE_COLOR_SS[key] || '#8E8E93' };
  });
  // группируем подряд одинаковые фазы
  const grouped: { key:string; weeks:number; color:string; label:string }[] = [];
  for(const s of segs){
    const last = grouped[grouped.length-1];
    if(last && last.key===s.key) last.weeks++;
    else grouped.push({ key:s.key, weeks:1, color:s.color, label: PHASE_RU_SS[s.key] || s.key });
  }
  const ganttBar = `<div style="display:flex;height:22px;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;background:#f9fafb">${grouped.map(g=> `<div style="flex:${g.weeks};background:${g.color};display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700" title="${escHtml(g.label)} ${g.weeks}нед">${g.weeks>=2?escHtml(g.label):''}</div>`).join('')}</div>`;
  const legend = `<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:6px">${grouped.map(g=> `<span style="font-size:10px;display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;border-radius:3px;background:${g.color};display:inline-block"></span>${escHtml(g.label)} ${g.weeks}нед</span>`).join('')}</div>`;
  const weeksRow = `<div style="display:flex;justify-content:space-between;font-size:9px;color:#6b7280;margin-top:4px"><span>Нед 1</span><span>Нед ${total}</span></div>`;
  return `<section style="margin:10px 0;padding:10px 12px;border:1px solid #e5e7eb;border-radius:10px;background:#fff"><div style="font-size:12px;font-weight:700;margin-bottom:6px">🗓️ Gantt фаз · taper отдельно</div>${ganttBar}${legend}${weeksRow}</section>`;
}

function buildMedleySection(plan: StrengthSportPlan): string {
  const contestImplements: string[] | null = (()=> { const c=(plan.inputSnapshot as any)?.contest; if(c?.events?.length){ const ce=c.events.find((e:any)=> e.implements?.length>=2); if(ce) return ce.implements as string[]; } return null; })();
  const hasMedley = plan.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> (e.comment||'').includes('Medley') || (e.comment||'').includes('Contest Medley')))) || !!contestImplements;
  if (!hasMedley || plan.mode!=='strongman') {
    // если контест задал implements но medley comment ещё не в плане (короткий цикл) — всё равно секция по контесту
    if (!contestImplements) return '';
  }
  const rows = plan.weeksData
    .flatMap(w=> w.sessions.filter(s=> s.sessionTag==='event_day').flatMap(s=> s.exercises.filter(e=> (e.comment||'').includes('Medley')).map(e=> ({ w, e }))))
    .map(({w,e})=> `<tr><td style="border:1px solid #e5e7eb;padding:4px 6px;font-size:10px">Н${w.week} · ${escHtml(w.phase)}${(w as any).taper?' · taper':''}</td><td style="border:1px solid #e5e7eb;padding:4px 6px;font-size:10px">${escHtml(e.name)} ${e.weight}кг ${(e.workSets[0] as any)?.distanceM||20}м cap ${(e.workSets[0] as any)?.timeCapS||60}с · 90с переход ${(e.comment||'').includes('Contest')?' · Contest':''} ${contestImplements?`· implements ${contestImplements.join('→')}`:''} ${(plan.inputSnapshot as any)?.contest?.events?.find((ev:any)=> ev.id===e.id)?.heightCm?`· ${ (plan.inputSnapshot as any).contest.events.find((ev:any)=> ev.id===e.id).heightCm }см`:''}</td><td style="border:1px solid #e5e7eb;padding:4px 6px;font-size:10px">${escHtml(e.comment||'')}</td></tr>`).join('');
  if (!rows) return '';
  return `<section style="margin:10px 0"><h3 style="font-size:13px;font-weight:700;margin:0 0 6px">⛓️ Medley цепь — 2+1 (carry+stone)</h3><table style="width:100%;border-collapse:collapse">${`<tr><th style="border:1px solid #ddd;padding:4px 6px;background:#f3f4f6;font-size:10px">Неделя/фаза</th><th style="border:1px solid #ddd;padding:4px 6px;background:#f3f4f6;font-size:10px">Ивент (дист · cap)</th><th style="border:1px solid #ddd;padding:4px 6px;background:#f3f4f6;font-size:10px">Состав цепи</th></tr>`}${rows}</table></section>`;
}

export function buildStrengthPrintHtml(plan: StrengthSportPlan): string {
  const title = `Стронг+ТА ${escHtml(plan.mode)} ${plan.weeks}нед ${escHtml(plan.level)}`;
  const rows = strengthExportRows(plan);
  const header = `<tr>${['Нед','Фаза','День','Тренировка','Упражнение','Сеты×Повт','Вес','%','RIR','Темп','Отдых','Дист','Кап','Коммент'].map(h=>`<th style="border:1px solid #ddd;padding:4px 6px;background:#f3f4f6;font-size:10px">${escHtml(h)}</th>`).join('')}</tr>`;
  const body = rows.map(r=> `<tr>${[r.week, escHtml(r.phase)+( (plan.weeksData[r.week-1] as any)?.taper ? ' · taper':'') , r.day, escHtml(r.tag), escHtml(r.exercise), `${r.sets}×${escHtml(r.reps)}`, `${r.weight}кг`, r.pct?`${r.pct}%`:'', r.rir, escHtml(r.tempo), r.rest?`${r.rest}с`:'', r.distanceM?`${r.distanceM}м`:'', r.timeCapS?`${r.timeCapS}с`:'', escHtml(r.comment)].map(v=>`<td style="border:1px solid #e5e7eb;padding:3px 6px;font-size:10px">${v}</td>`).join('')}</tr>`).join('');
  let extra = '';
  try {
    const snap: any = plan.inputSnapshot || {};
    if (snap.cycleId) extra += `<p style="font-size:11px;margin:4px 0"><b>Интернет-цикл:</b> ${escHtml(snap.cycleId)} · ${escHtml(snap.cycleMode || 'faithful')}${snap.cycleMode === 'adapt' ? ' (с гардами ACWR/VBT)' : ' (дословно)'}</p>`;
    if (snap.contest?.events?.length) extra += `<p style="font-size:11px;margin:4px 0"><b>Контест:</b> ${snap.contest.events.map((e:any)=> e.id).join(' + ')}${snap.contest.name?` · ${escHtml(snap.contest.name)}`:''} · ${snap.contestStrategy||'balanced'}</p>`;
    if (snap.weightCutProtocolSS) extra += `<p style="font-size:11px;margin:4px 0"><b>Весогонка ТА:</b> ${snap.weightCutProtocolSS.targetLossKg}кг · вода ${snap.weightCutProtocolSS.waterMode} · Na ${snap.weightCutProtocolSS.sodiumMode}</p>`;
    if (snap.weakPoints && snap.weakPoints.length) extra += `<p style="font-size:11px;margin:4px 0"><b>Слабые лифты:</b> ${snap.weakPoints.join(', ')} · объём ×1.15</p>`;
    if (Array.isArray(snap.peds) && snap.peds.length) extra += `<p style="font-size:11px;margin:4px 0"><b>PED:</b> ${snap.peds.join(', ')} · капы 1.35(весогонка)/1.70</p>`;
    if (snap.competitionDate) extra += `<p style="font-size:11px;margin:4px 0"><b>Taper:</b> Winwood step 8.6д vol -45% — йок/камень 7д, лог/фермер 5д, броски 4д</p>`;
    if (plan.mode==='weightlifting' && (snap.snatch || plan.workMax.snatch) && (snap.cleanJerk || plan.workMax.cleanJerk)) {
      try {
        const meet = buildWLMeetPlan(snap.snatch || plan.workMax.snatch as number, snap.cleanJerk || plan.workMax.cleanJerk as number, 'balanced', { bodyweight: snap.bodyweight, sex: snap.sex });
        if (meet) extra += `<p style="font-size:11px;margin:4px 0"><b>Попытки:</b> рывок ${meet.snatch.opener}/${meet.snatch.second}/${meet.snatch.third} · толчок ${meet.cleanJerk.opener}/${meet.cleanJerk.second}/${meet.cleanJerk.third} · тотал ${meet.total}кг ${meet.sinclair?`· Sinclair ${meet.sinclair}`:''} ${ (meet as any).robi?`· Robi ${(meet as any).robi}`:''}</p>`;
      } catch {}
    }
  } catch {}
  const medleySection = buildMedleySection(plan);
  const gantt = buildPhaseGantt(plan);
  const headerHtml = buildPrintHeader(plan);
  const summary = `<div style="margin:8px 0;padding:10px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;font-size:11px"><b>${title}</b> · ${plan.weeksData.map(w=>`Н${w.week}:${w.phase}${(w as any).taper?' taper':''}${w.deload?' дел':''} ${w.totalSets}сет`).join(' | ')}<br/>Бюджет: ${plan.rationale.join(' | ')}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui,Arial,sans-serif;padding:16px;color:#111} table{border-collapse:collapse;width:100%} @media print{body{padding:0} header{break-inside:avoid} section.gantt{break-inside:avoid} table{break-inside:auto} tr{break-inside:avoid}}</style></head><body>${headerHtml}${gantt}${extra}${medleySection}${summary}<table>${header}${body}</table><script>window.onload=()=> setTimeout(()=> window.print(), 300)</script></body></html>`;
}

export function downloadStrengthCsv(plan: StrengthSportPlan){
  try{
    const csv = buildStrengthCsv(plan);
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`strength_${plan.mode}_${plan.weeks}w.csv`; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1000);
  }catch{}
}

export function buildStrengthXlsxHtml(plan: StrengthSportPlan): string {
  const rows = strengthExportRows(plan);
  const esc = escHtml;
  const title = `Стронг+ТА ${esc(plan.mode)} ${plan.weeks}нед ${esc(plan.level)} — ${new Date().toLocaleDateString('ru-RU')}`;
  const header = ['Неделя','Фаза','День','Тренировка','Характер','Упражнение','Сеты','Повторы','Вес','%ПМ','RIR','Темп','Отдыхс','Дист','ВремяCap','Комментарий'];
  const th = header.map(h=> `<th style="background:#0A84FF;color:#fff;font-weight:700;padding:6px;border:1px solid #1e40af">${esc(h)}</th>`).join('');
  const tr = rows.map(r=> `<tr>${[r.week, esc(r.phase), r.day, esc(r.tag), esc(r.character), esc(r.exercise), r.sets, esc(r.reps), r.weight, r.pct, r.rir, esc(r.tempo), r.rest, r.distanceM||'', r.timeCapS||'', esc(r.comment)].map((v,i)=> `<td style="padding:4px 6px;border:1px solid #d1d5db;${i===5?'font-weight:600':''}">${v}</td>`).join('')}</tr>`).join('');
  // Excel-compatible HTML with BOM, meta, column widths and header styles (proper Excel header)
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Strength</x:Name><x:WorksheetOptions><x:DisplayGridlines/><x:Print><x:ValidPrinterInfo/><x:PaperSizeIndex>9</x:PaperSizeIndex></x:Print></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--><style>table{border-collapse:collapse} th{background:#0A84FF;color:#fff} td{vertical-align:top}</style></head><body><h2 style="font-family:Arial">${title}</h2><table border="1"><colgroup><col width="50"><col width="80"><col width="50"><col width="90"><col width="60"><col width="180"><col width="40"><col width="60"><col width="60"><col width="50"><col width="40"><col width="80"><col width="60"><col width="50"><col width="60"><col width="220"></colgroup><tr>${th}</tr>${tr}</table><p style="font-size:9px;color:#6b7280">BodyBuildHealth · ${esc(plan.patternId)} · ${plan.weeksData.length} нед · ${rows.length} строк</p></body></html>`;
}
export function downloadStrengthXlsx(plan: StrengthSportPlan): void {
  try {
    const html = buildStrengthXlsxHtml(plan);
    const blob = new Blob(['\uFEFF' + html], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `strength_${plan.mode}_${plan.weeks}w.xls`; document.body.appendChild(a); a.click(); setTimeout(()=> { URL.revokeObjectURL(url); a.remove(); }, 1000);
  } catch {}
}

export function shareStrengthDigest(plan: StrengthSportPlan): string {
  const w1 = plan.weeksData[0];
  const s = w1 ? w1.sessions.map(sess=> `${sess.sessionTag} ${sess.exercises.map(e=> e.name).join(', ')}`).join(' | ') : '';
  return `Стронг+ТА ${plan.mode} ${plan.weeks}нед ${plan.level} · ${s}`.slice(0, 1800);
}

// P2: telegram hash share (порт pl-export hash)
export function buildStrengthShareHash(plan: StrengthSportPlan): string {
  try{
    const payload = { id: plan.id, mode: plan.mode, weeks: plan.weeks, level: plan.level, workMax: plan.workMax, patternId: plan.patternId, digest: shareStrengthDigest(plan).slice(0, 500) };
    const json = JSON.stringify(payload);
    // btoa utf8
    const b64 = typeof btoa !== 'undefined' ? btoa(unescape(encodeURIComponent(json))) : Buffer.from(json, 'utf8').toString('base64');
    return b64.replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  }catch{ return ''; }
}
export function buildStrengthTelegramUrl(plan: StrengthSportPlan): string {
  const h = buildStrengthShareHash(plan);
  const d = shareStrengthDigest(plan);
  return `https://t.me/share/url?url=${encodeURIComponent(`https://app.local/#strength-${h}`)}&text=${encodeURIComponent(d)}`;
}
export function buildStrengthDigestWithHash(plan: StrengthSportPlan): string {
  const h = buildStrengthShareHash(plan);
  return `${shareStrengthDigest(plan)}\n\n#strength-${h}`;
}

export function buildStrengthIcs(plan: StrengthSportPlan, startDate?: string): string {
  const start = startDate ? new Date(startDate) : new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T090000`;
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', `PRODID:-//BodyBuildHealth//Strength ${plan.mode}//RU`];
  for (const wk of plan.weeksData) {
    for (const sess of wk.sessions) {
      const d = new Date(start); d.setDate(start.getDate() + (wk.week - 1) * 7 + (sess.day - 1));
      const dt = fmt(d);
      const summary = `${plan.mode} Н${wk.week} ${sess.sessionTag} (${sess.character})`;
      const desc = sess.exercises.map(e => `${e.name} ${e.sets}x${e.reps} ${e.weight}кг`).join('\\n');
      lines.push('BEGIN:VEVENT', `DTSTART:${dt}`, `DTEND:${dt}`, `SUMMARY:${summary}`, `DESCRIPTION:${desc}`, `UID:ss-${plan.id}-${wk.week}-${sess.day}@bbhealth`, 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadStrengthIcs(plan: StrengthSportPlan, startDate?: string) {
  try {
    const ics = buildStrengthIcs(plan, startDate);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `strength_${plan.mode}_${plan.weeks}w.ics`; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1000);
  } catch {}
}
