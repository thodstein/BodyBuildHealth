/**
 * arm-export.engine.ts — экспорт арм-плана (print / ics), как bb-export / pl-export.
 */
import type { ArmPlan } from './arm-types';

function esc(s: string): string {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function buildArmPrintHtml(plan: ArmPlan): string {
  const rows = plan.weeks.map(wk => {
    const sessRows = wk.sessions.map(sess => {
      const exRows = sess.exercises.map(ex => {
        const angle = ex.workingAngle ? `РУ ${ex.workingAngle.elbowDeg}° ${ex.workingAngle.direction}` : '';
        const hold = ex.holdSeconds ? ` hold ${ex.holdSeconds}с` : '';
        const table = ex.isTable ? ' 🖐️' : '';
        return `<tr><td>${esc(ex.name)}${table}</td><td>${esc(ex.muscle)}</td><td>${ex.sets}×${ex.repsRange[0]}-${ex.repsRange[1]} RIR${ex.rir}${hold}</td><td>${esc(angle)}</td><td>${esc(ex.tempoSpec || '')}</td></tr>`;
      }).join('');
      return `<h4>День ${sess.day} — ${esc(sess.sessionTag)} (${esc(sess.character)}) ${sess.tableTime ? '🖐️ стол' : ''}</h4><table border="1" cellpadding="4"><tr><th>Упражнение</th><th>Мышца</th><th>Сеты×Повт</th><th>РУ</th><th>Темп</th></tr>${exRows}</table>`;
    }).join('<hr/>');
    return `<h3>Неделя ${wk.week} — ${esc(wk.phase)} ${wk.deload ? '(deload)' : wk.taper ? '(taper)' : ''}</h3>${sessRows}`;
  }).join('<hr/>');

  return `<!doctype html><html><head><meta charset="utf-8"><title>Арм-план ${esc(plan.pattern.name)}</title><style>body{font-family:system-ui;padding:20px} table{border-collapse:collapse;width:100%} h3{color:#0a6} h4{color:#333}</style></head><body><h1>🤝 Арм-план — ${esc(plan.pattern.name)}</h1><p>${plan.rationale.map(r=>esc(r)).join('<br/>')}</p>${rows}<script>window.onload=()=>window.print()</script></body></html>`;
}

export function buildArmIcs(plan: ArmPlan, startDateIso?: string): string {
  const start = startDateIso ? new Date(startDateIso) : new Date();
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g,'').split('.')[0] + 'Z';
  const escIcs = (s: string) => s.replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/\n/g,'\\n');
  let ics = 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//BodyBuildHealth//ARM//RU\r\n';
  for (const wk of plan.weeks) {
    for (const sess of wk.sessions) {
      const d = new Date(start);
      d.setDate(d.getDate() + (wk.week - 1) * 7 + (sess.day - 1));
      const dt = fmt(d);
      const summary = `Арм Н${wk.week} ${sess.sessionTag} ${sess.character}`;
      const desc = sess.exercises.map(e => `${e.name} ${e.sets}x${e.repsRange[0]}-${e.repsRange[1]}`).join('\\n');
      ics += `BEGIN:VEVENT\r\nUID:arm-${wk.week}-${sess.day}@bbhealth\r\nDTSTART:${dt}\r\nSUMMARY:${escIcs(summary)}\r\nDESCRIPTION:${escIcs(desc)}\r\nEND:VEVENT\r\n`;
    }
  }
  ics += 'END:VCALENDAR\r\n';
  return ics;
}
