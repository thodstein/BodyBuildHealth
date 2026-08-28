/**
 * strength-sport-export.ts — экспорт плана Стронг+ТА (порт pl-export, изолированно)
 * CSV/HTML печать + текстовый отчёт. Без xlsx зависимости — CSV совместим с Excel.
 */
import type { StrengthSportPlan } from './strength-sport.types';

function escHtml(s: string): string { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escCsv(s: string): string { const v = String(s).replace(/"/g,'""'); return /[",\n;]/.test(v) ? `"${v}"` : v; }

export interface StrengthExportRow { week:number; phase:string; day:number; tag:string; character:string; exercise:string; sets:number; reps:string; weight:number; pct:number; rir:number; tempo:string; rest:number; comment:string; }

export function strengthExportRows(plan: StrengthSportPlan): StrengthExportRow[] {
  const rows: StrengthExportRow[] = [];
  for(const wk of plan.weeksData){
    for(const sess of wk.sessions){
      for(const ex of sess.exercises){
        rows.push({ week: wk.week, phase: wk.phase, day: sess.day, tag: sess.sessionTag, character: sess.character, exercise: ex.name, sets: ex.sets, reps: ex.reps, weight: ex.weight, pct: ex.workSets[0]?.pct || 0, rir: ex.rir, tempo: ex.tempo || '', rest: ex.restSeconds || 0, comment: ex.comment || '' });
      }
    }
  }
  return rows;
}

export function buildStrengthCsv(plan: StrengthSportPlan): string {
  const header = ['Неделя','Фаза','День','Тренировка','Характер','Упражнение','Сеты','Повторы','Вес','%ПМ','RIR','Темп','Отдыхс','Комментарий'];
  const rows = strengthExportRows(plan);
  const lines = [header.map(escCsv).join(';')];
  for(const r of rows) lines.push([r.week,r.phase,r.day,r.tag,r.character,r.exercise,r.sets,r.reps,r.weight,r.pct,r.rir,r.tempo,r.rest,r.comment].map(escCsv).join(';'));
  return lines.join('\n');
}

export function buildStrengthPrintHtml(plan: StrengthSportPlan): string {
  const title = `Стронг+ТА ${escHtml(plan.mode)} ${plan.weeks}нед ${escHtml(plan.level)}`;
  const rows = strengthExportRows(plan);
  const header = `<tr>${['Нед','Фаза','День','Тренировка','Упражнение','Сеты×Повт','Вес','%','RIR','Темп','Отдых','Коммент'].map(h=>`<th style="border:1px solid #ddd;padding:4px 6px;background:#f3f4f6;font-size:10px">${escHtml(h)}</th>`).join('')}</tr>`;
  const body = rows.map(r=> `<tr>${[r.week, escHtml(r.phase), r.day, escHtml(r.tag), escHtml(r.exercise), `${r.sets}×${escHtml(r.reps)}`, `${r.weight}кг`, r.pct?`${r.pct}%`:'', r.rir, escHtml(r.tempo), r.rest?`${r.rest}с`:'', escHtml(r.comment)].map(v=>`<td style="border:1px solid #e5e7eb;padding:3px 6px;font-size:10px">${v}</td>`).join('')}</tr>`).join('');
  const summary = `<div style="margin:8px 0;padding:8px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:6px;font-size:11px"><b>${title}</b> · ${plan.weeksData.map(w=>`Н${w.week}:${w.phase}${w.deload?' дел':''} ${w.totalSets}сет`).join(' | ')}<br/>Бюджет: ${plan.rationale.join(' | ')}</div>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:system-ui,Arial,sans-serif;padding:16px;color:#111} table{border-collapse:collapse;width:100%} @media print{body{padding:0}}</style></head><body><h2 style="margin:0 0 8px">${title}</h2>${summary}<table>${header}${body}</table><script>window.onload=()=> setTimeout(()=> window.print(), 300)</script></body></html>`;
}

export function downloadStrengthCsv(plan: StrengthSportPlan){
  try{
    const csv = buildStrengthCsv(plan);
    const blob = new Blob(['\uFEFF'+csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download=`strength_${plan.mode}_${plan.weeks}w.csv`; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 1000);
  }catch{}
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
