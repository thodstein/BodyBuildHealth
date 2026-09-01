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

export function buildStrengthPrintHtml(plan: StrengthSportPlan): string {
  const title = `Стронг+ТА ${escHtml(plan.mode)} ${plan.weeks}нед ${escHtml(plan.level)}`;
  const rows = strengthExportRows(plan);
  const header = `<tr>${['Нед','Фаза','День','Тренировка','Упражнение','Сеты×Повт','Вес','%','RIR','Темп','Отдых','Дист','Кап','Коммент'].map(h=>`<th style="border:1px solid #ddd;padding:4px 6px;background:#f3f4f6;font-size:10px">${escHtml(h)}</th>`).join('')}</tr>`;
  const body = rows.map(r=> `<tr>${[r.week, escHtml(r.phase), r.day, escHtml(r.tag), escHtml(r.exercise), `${r.sets}×${escHtml(r.reps)}`, `${r.weight}кг`, r.pct?`${r.pct}%`:'', r.rir, escHtml(r.tempo), r.rest?`${r.rest}с`:'', r.distanceM?`${r.distanceM}м`:'', r.timeCapS?`${r.timeCapS}с`:'', escHtml(r.comment)].map(v=>`<td style="border:1px solid #e5e7eb;padding:3px 6px;font-size:10px">${v}</td>`).join('')}</tr>`).join('');
  let extra = '';
  try {
    const snap: any = plan.inputSnapshot || {};
    if (snap.weightCutProtocolSS) extra += `<p><b>Весогонка ТА:</b> ${snap.weightCutProtocolSS.targetLossKg}кг · вода ${snap.weightCutProtocolSS.waterMode} · Na ${snap.weightCutProtocolSS.sodiumMode}</p>`;
    if (snap.weakPoints && snap.weakPoints.length) extra += `<p><b>Слабые лифты:</b> ${snap.weakPoints.join(', ')} · объём ×1.15</p>`;
    if (Array.isArray(snap.peds) && snap.peds.length) extra += `<p><b>PED:</b> ${snap.peds.join(', ')} · капы 1.35(весогонка)/1.70</p>`;
    // попытки ТА
    if (plan.mode==='weightlifting' && (snap.snatch || plan.workMax.snatch) && (snap.cleanJerk || plan.workMax.cleanJerk)) {
      try {
        const meet = buildWLMeetPlan(snap.snatch || plan.workMax.snatch as number, snap.cleanJerk || plan.workMax.cleanJerk as number, 'balanced', { bodyweight: snap.bodyweight, sex: snap.sex });
        if (meet) extra += `<p><b>Попытки:</b> рывок ${meet.snatch.opener}/${meet.snatch.second}/${meet.snatch.third} · толчок ${meet.cleanJerk.opener}/${meet.cleanJerk.second}/${meet.cleanJerk.third} · тотал ${meet.total}кг ${meet.sinclair?`· Sinclair ${meet.sinclair}`:''} ${ (meet as any).robi?`· Robi ${(meet as any).robi}`:''}</p>`;
      } catch {}
    }
    // medley table для стронга
    const hasMedley = plan.weeksData.some(w=> w.sessions.some(s=> s.exercises.some(e=> (e.comment||'').includes('Medley'))));
    if (hasMedley && plan.mode==='strongman') {
      const medleyRows = plan.weeksData.flatMap(w=> w.sessions.filter(s=> s.sessionTag==='event_day').flatMap(s=> s.exercises.filter(e=> (e.comment||'').includes('Medley'))).map(e=> `<tr><td style="border:1px solid #e5e7eb;padding:3px 6px;font-size:10px">Н${w.week}</td><td style="border:1px solid #e5e7eb;padding:3px 6px;font-size:10px">${escHtml(e.name)} ${e.weight}кг ${(e.workSets[0] as any)?.distanceM||20}м cap ${(e.workSets[0] as any)?.timeCapS||60}с</td><td style="border:1px solid #e5e7eb;padding:3px 6px;font-size:10px">${escHtml(e.comment||'')}</td></tr>`).join(''));
      if (medleyRows) extra += `<h3 style="margin:10px 0 4px">Medley цепь</h3><table><tr><th style="border:1px solid #ddd;padding:4px 6px;background:#f3f4f6;font-size:10px">Неделя</th><th style="border:1px solid #ddd;padding:4px 6px;background:#f3f4f6;font-size:10px">Ивент</th><th style="border:1px solid #ddd;padding:4px 6px;background:#f3f4f6;font-size:10px">Примечание</th></tr>${medleyRows}</table>`;
    }
    // Sinclair уже в report
  } catch {}
  const summary = `<div style="margin:8px 0;padding:8px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:11px"><b>${title}</b> · ${plan.weeksData.map(w=>`Н${w.week}:${w.phase}${w.deload?' дел':''} ${w.totalSets}сет`).join(' | ')}<br/>Бюджет: ${plan.rationale.join(' | ')}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui,Arial,sans-serif;padding:16px;color:#111} table{border-collapse:collapse;width:100%} @media print{body{padding:0}}</style></head><body><h2 style="margin:0 0 8px">${title}</h2>${extra}${summary}<table>${header}${body}</table><script>window.onload=()=> setTimeout(()=> window.print(), 300)</script></body></html>`;
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
  const header = ['Неделя','Фаза','День','Тренировка','Характер','Упражнение','Сеты','Повторы','Вес','%ПМ','RIR','Темп','Отдыхс','Дист','ВремяCap','Комментарий'];
  const th = header.map(h=> `<th>${esc(h)}</th>`).join('');
  const tr = rows.map(r=> `<tr>${[r.week, esc(r.phase), r.day, esc(r.tag), esc(r.character), esc(r.exercise), r.sets, esc(r.reps), r.weight, r.pct, r.rir, esc(r.tempo), r.rest, r.distanceM||'', r.timeCapS||'', esc(r.comment)].map(v=> `<td>${v}</td>`).join('')}</tr>`).join('');
  // Excel-compatible HTML with BOM and meta
  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>Strength</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head><body><table border="1"><tr>${th}</tr>${tr}</table></body></html>`;
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
