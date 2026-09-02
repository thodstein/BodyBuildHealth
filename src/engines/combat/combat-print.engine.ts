/**
 * combat-print.engine.ts — печать и экспорт плана единоборств (изолировано).
 * HTML с XSS-экранированием, CSV-строки, ICS для плана.
 */
import type { CombatPlan } from './combat.types';

function escHtml(s: string): string { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/`/g,'&#96;'); }
function escCsv(v: any): string { const s = String(v ?? ''); if (/[",\n;]/.test(s)) return `"${s.replace(/"/g,'""')}"`; return s; }

export function buildCombatPrintHtml(plan: CombatPlan): string {
  const phaseColor: Record<string,string> = { accumulation:'#3b82f6', transmutation:'#a855f7', realization:'#ef4444', transition:'#f59e0b', gpp:'#10b981', power:'#f97316', taper:'#06b6d4', deload:'#eab308', conjugate:'#6366f1' };
  const weeks = plan.weeksData.map(w => {
    const col = phaseColor[w.phase] || '#a855f7';
    const sessRows = w.sessions.map(s => {
      const exRows = s.exercises.map(e => `<tr><td>${escHtml(e.name)}</td><td>${e.sets}×${escHtml(e.reps)}</td><td>${e.weight}кг</td><td>RIR${e.rir}</td><td>${escHtml(e.tempo||'')}</td><td>${e.restSeconds||''}с</td><td>${escHtml(e.comment||'')}</td></tr>`).join('');
      return `<h4>День ${s.day} · ${escHtml(s.sessionTag)} · ${escHtml(s.character)} · ${s.durationMin||''} мин</h4><table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:11px"><tr><th>Упражнение</th><th>Сеты×Повт</th><th>Вес</th><th>RIR</th><th>Темп</th><th>Отдых</th><th>Коммент</th></tr>${exRows}</table>`;
    }).join('');
    const bg = col + '14';
    return `<div style="background:${bg};border-left:4px solid ${col};padding:8px;margin:8px 0;border-radius:6px"><h3 style="margin:0 0 6px;color:${col}">Неделя ${w.week} · ${escHtml(w.phase)}${w.deload?' · делод':''}${(w as any).taper?' · тапер':''} · ${w.totalSets||0} сетов${(w as any).totalTonnage?` · ${((w as any).totalTonnage/1000).toFixed(1)}т`:''}</h3>${sessRows}</div>`;
  }).join('<hr/>');
  const cond = (plan as any).conditioning ? (()=>{ const c=(plan as any).conditioning as {weeks:number; sessions:any[][]}; const rows=c.sessions.map((week:any[],wi:number)=> `<tr><td>Нед ${wi+1}</td><td>${week.length? week.map((s:any)=> `${escHtml(s.modality)} ${s.durationMin}′ ${escHtml(s.intervals||'')}${s.hrZone?` · ${escHtml(s.hrZone)}`:''}`).join('<br/>') : '— внезал покрывает'}</td></tr>`).join(''); return `<h3>Кондиция (3 системы)</h3><table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:11px"><tr><th>Неделя</th><th>Сессии</th></tr>${rows}</table>`; })() : '';
  const sparr = (plan.inputSnapshot as any)?.sparringLoad ? `<p><b>Спарринг:</b> hard ${(plan.inputSnapshot as any).sparringLoad.hardSparSessions}× RPE 8.5 / tech ${(plan.inputSnapshot as any).sparringLoad.techSparSessions}× RPE 5.5 / борьба ${(plan.inputSnapshot as any).sparringLoad.wrestlingSessions}× RPE 7.5 — Collins шея +0.45кг=−5% сотряс</p>` : '';
  const wcSnap = (plan.inputSnapshot as any)?.weightCutProtocol;
  const wcut = wcSnap ? `<p><b>Весогонка ISSN 2025:</b> ${wcSnap.targetLossKg}кг · ${wcSnap.weighInType==='same_day_2h'?'same-day 1-2ч':'24-36ч'} · вода ${wcSnap.waterMode} · Na ${wcSnap.sodiumMode} · угли ${wcSnap.carbMode} · ORS ${wcSnap.orsSodiumMmolPerDl||65} mmol/дл · волокно ${wcSnap.fiberGPerDay||10}г${wcSnap.confirmedManipulation?' · ✓подтверждено':''}<br/><i style="font-size:10px;color:#6b7280">Post: ORS 1-1.5л/ч 50-90 mmol → ≤60г/ч углей → 8-12г/кг (сильная) / 4-7г/кг (умеренная) за 24ч · 125-150% жидкости · жиры исключить 6ч</i></p>` : '';
  const fstyle = (plan.inputSnapshot as any)?.fightStyle ? `<p><b>Стиль:</b> ${escHtml((plan.inputSnapshot as any).fightStyle)} · ${ (plan.inputSnapshot as any).fightStyle==='striker' ? 'striker: ротация+плио contrast X-0-X-0 (удар)' : (plan.inputSnapshot as any).fightStyle==='grappler' ? 'grappler: шея/хват+унилатераль (клинч/партер)' : 'hybrid: баланс'}</p>` : '';
  const axial = (plan.inputSnapshot as any)?.avoidAxialLoad ? `<p style="color:#b45309">⚠ Избегать осевой нагрузки (грыжа/перегруз) — осевые заменены</p>` : '';
  const rationale = plan.rationale.map(r=> `<li>${escHtml(r)}</li>`).join('');
  const warns = (plan.validation?.warnings||[]).map(w=> `<li style="color:#b45309">${escHtml(w)}</li>`).join('');
  // Gantt + heatmap по неделям
  const ganttSegs = plan.weeksData.map(w=>{
    const col = phaseColor[w.phase] || '#a855f7';
    const tip = `Нед ${w.week} ${escHtml(w.phase)} ${w.deload?'делод': (w as any).taper?'тапер':''} ${w.totalSets||0} сетов`;
    return `<div title="${tip}" style="flex:1;background:${col};display:flex;align-items:center;justify-content:center;color:#fff;font-size:7px;font-weight:700;border-right:0.5px solid #fff;min-width:8px">${w.week}</div>`;
  }).join('');
  const gantt = `<div style="display:flex;height:14px;border-radius:6px;overflow:hidden;border:0.5px solid #e5e7eb;margin:8px 0 4px">${ganttSegs}</div><div style="display:flex;justify-content:space-between;font-size:8px;color:#6b7280"><span>Нед 1</span><span>Нед ${plan.weeks}</span></div>`;
  const hash = `cb-${plan.discipline}-${plan.weeks}w-${plan.patternId}-${plan.weeksData.map(w=> w.phase[0]).join('')}`;
  const qrData = encodeURIComponent(hash);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Единоборства ${escHtml(plan.discipline)} ${plan.weeks}нед ${escHtml(plan.patternId)}</title><style>body{font-family:Inter,Arial,sans-serif;padding:16px;color:#111}h2{margin:0}h3{margin:12px 0 6px}table th{background:#f3f4f6} @media print{body{padding:8px}}</style></head><body><h2>Единоборства: ${escHtml(plan.discipline)} · ${escHtml(plan.goal)} · ${escHtml(plan.level)} · ${plan.weeks}нед · ${escHtml(plan.patternId)}</h2>${gantt}<p>Модель ${(plan.inputSnapshot as any)?.periodizationModel||'atr_10'} · DUP ${(plan.inputSnapshot as any)?.dupMode||'off'} · ${(plan.inputSnapshot as any)?.fightDate?`бой ${(plan.inputSnapshot as any).fightDate} тапер ${(plan.inputSnapshot as any)?.taperWeeks||1}нед`:''}</p>${sparr}${wcut}${fstyle}${axial}${weeks}${cond}<h3>Rationale</h3><ul>${rationale}</ul>${warns?`<h3>Предупреждения</h3><ul>${warns}</ul>`:''}<div style="margin-top:12px;padding:8px 10px;background:#f3f4f6;border-radius:6px;font-size:10px;color:#6b7280;display:flex;align-items:center;gap:10">hash: ${escHtml(hash)} · #combat-plan · Ctrl+P → PDF <img src="https://api.qrserver.com/v1/create-qr-code/?size=70x70&data=${qrData}" alt="QR ${escHtml(hash)}" style="border-radius:4px;border:0.5px solid #e5e7eb" width="70" height="70"/></div></body></html>`;
}

export function buildCombatCsv(plan: CombatPlan): string {
  const header = ['week','phase','day','sessionTag','character','exercise','sets','reps','weight','rir','tempo','rest','comment'].map(escCsv).join(',');
  const rows = plan.weeksData.flatMap(w => w.sessions.flatMap(s => s.exercises.map(e => [w.week, w.phase, s.day, s.sessionTag, s.character, e.name, e.sets, e.reps, e.weight, e.rir, e.tempo||'', e.restSeconds||'', e.comment||''].map(escCsv).join(','))));
  return [header, ...rows].join('\n');
}

export function downloadCombatCsv(plan: CombatPlan): void {
  try {
    const csv = '\uFEFF' + buildCombatCsv(plan);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `combat-${plan.discipline}-${plan.weeks}w.csv`; a.click(); setTimeout(()=> URL.revokeObjectURL(url), 1000);
  } catch {}
}

export function buildCombatPlanIcs(plan: CombatPlan, startDate?: string | null): string {
  const start = startDate ? new Date(startDate) : new Date();
  const fmt = (d: Date)=> d.toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  const escIcs = (s:string)=> s.replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\n/g,'\\n');
  const lines: string[] = ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//BodyBuildHealth//Combat Plan//RU','CALSCALE:GREGORIAN'];
  for (const w of plan.weeksData) {
    for (const s of w.sessions) {
      const dayOffset = (w.week-1)*7 + (s.day-1);
      const d = new Date(start.getTime() + dayOffset*86400000);
      const dur = (s as any).durationMin || (s.sessionTag==='full_conditioning' ? 60 : 90);
      const e = new Date(d.getTime() + dur*60000);
      lines.push('BEGIN:VEVENT', `UID:cb-${plan.id}-w${w.week}d${s.day}@bodybuild`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(d)}`, `DTEND:${fmt(e)}`, `SUMMARY:${escIcs(`${w.phase} ${s.sessionTag} ${s.character} — ${s.exercises.map(x=>x.name).slice(0,3).join(', ')}`)}`, `DESCRIPTION:${escIcs(s.exercises.map(x=> `${x.name} ${x.sets}×${x.reps} ${x.weight}кг RIR${x.rir}`).join('\\n'))}`, 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function buildCombatShareHash(plan: CombatPlan): string {
  try { return `cb-${plan.discipline}-${plan.weeks}w-${plan.patternId}-${plan.weeksData.length}w`; } catch { return `cb-${Date.now()}`; }
}
