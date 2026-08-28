/**
 * combat-print.engine.ts — печать и экспорт плана единоборств (изолировано).
 * HTML с XSS-экранированием, CSV-строки, ICS для плана.
 */
import type { CombatPlan } from './combat.types';

function escHtml(s: string): string { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escCsv(v: any): string { const s = String(v ?? ''); if (/[",\n;]/.test(s)) return `"${s.replace(/"/g,'""')}"`; return s; }

export function buildCombatPrintHtml(plan: CombatPlan): string {
  const weeks = plan.weeksData.map(w => {
    const sessRows = w.sessions.map(s => {
      const exRows = s.exercises.map(e => `<tr><td>${escHtml(e.name)}</td><td>${e.sets}×${escHtml(e.reps)}</td><td>${e.weight}кг</td><td>RIR${e.rir}</td><td>${escHtml(e.tempo||'')}</td><td>${e.restSeconds||''}с</td><td>${escHtml(e.comment||'')}</td></tr>`).join('');
      return `<h4>День ${s.day} · ${escHtml(s.sessionTag)} · ${escHtml(s.character)} · ${s.durationMin||''} мин</h4><table border="1" cellpadding="4" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:11px"><tr><th>Упражнение</th><th>Сеты×Повт</th><th>Вес</th><th>RIR</th><th>Темп</th><th>Отдых</th><th>Коммент</th></tr>${exRows}</table>`;
    }).join('');
    return `<h3>Неделя ${w.week} · ${escHtml(w.phase)}${w.deload?' · делод':''}${(w as any).taper?' · тапер':''} · ${w.totalSets||0} сетов${(w as any).totalTonnage?` · ${((w as any).totalTonnage/1000).toFixed(1)}т`:''}</h3>${sessRows}`;
  }).join('<hr/>');
  const cond = (plan as any).conditioning ? `<h3>Кондиция</h3><pre>${escHtml(JSON.stringify((plan as any).conditioning,null,2))}</pre>` : '';
  const rationale = plan.rationale.map(r=> `<li>${escHtml(r)}</li>`).join('');
  const warns = (plan.validation?.warnings||[]).map(w=> `<li style="color:#b45309">${escHtml(w)}</li>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>Единоборства ${escHtml(plan.discipline)} ${plan.weeks}нед ${escHtml(plan.patternId)}</title><style>body{font-family:Inter,Arial,sans-serif;padding:16px;color:#111}h2{margin:0}h3{margin:12px 0 6px}table th{background:#f3f4f6}</style></head><body><h2>Единоборства: ${escHtml(plan.discipline)} · ${escHtml(plan.goal)} · ${escHtml(plan.level)} · ${plan.weeks}нед · ${escHtml(plan.patternId)}</h2><p>Модель ${(plan.inputSnapshot as any)?.periodizationModel||'atr_10'} · DUP ${(plan.inputSnapshot as any)?.dupMode||'off'} · ${(plan.inputSnapshot as any)?.fightDate?`бой ${(plan.inputSnapshot as any).fightDate} тапер ${(plan.inputSnapshot as any)?.taperWeeks||1}нед`:''}</p>${weeks}${cond}<h3>Rationale</h3><ul>${rationale}</ul>${warns?`<h3>Предупреждения</h3><ul>${warns}</ul>`:''}</body></html>`;
}

export function buildCombatCsv(plan: CombatPlan): string {
  const header = ['week','phase','day','sessionTag','character','exercise','sets','reps','weight','rir','tempo','rest','comment'].map(escCsv).join(',');
  const rows = plan.weeksData.flatMap(w => w.sessions.flatMap(s => s.exercises.map(e => [w.week, w.phase, s.day, s.sessionTag, s.character, e.name, e.sets, e.reps, e.weight, e.rir, e.tempo||'', e.restSeconds||'', e.comment||''].map(escCsv).join(','))));
  return [header, ...rows].join('\n');
}

export function downloadCombatCsv(plan: CombatPlan): void {
  try {
    const csv = buildCombatCsv(plan);
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
      const e = new Date(d.getTime() + 90*60000);
      lines.push('BEGIN:VEVENT', `UID:cb-${plan.id}-w${w.week}d${s.day}@bodybuild`, `DTSTAMP:${fmt(new Date())}`, `DTSTART:${fmt(d)}`, `DTEND:${fmt(e)}`, `SUMMARY:${escIcs(`${w.phase} ${s.sessionTag} ${s.character} — ${s.exercises.map(x=>x.name).slice(0,3).join(', ')}`)}`, `DESCRIPTION:${escIcs(s.exercises.map(x=> `${x.name} ${x.sets}×${x.reps} ${x.weight}кг RIR${x.rir}`).join('\\n'))}`, 'END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export function buildCombatShareHash(plan: CombatPlan): string {
  try { return `cb-${plan.discipline}-${plan.weeks}w-${plan.patternId}-${plan.weeksData.length}w`; } catch { return `cb-${Date.now()}`; }
}
