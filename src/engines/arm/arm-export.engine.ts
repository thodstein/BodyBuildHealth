/**
 * arm-export.engine.ts — экспорт арм-плана (print / ics), как bb-export / pl-export.
 */
import type { ArmPlan } from './arm-types';
import type { ArmProSummary } from './arm-pro-integration.engine';

function esc(s: string): string {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * R6: структурированная PRO-сводка тренера в печати (потребитель
 * buildArmProSummary — раньше сводка жила только в движке/тестах).
 * Все пользовательские строки через esc (XSS-safe). Без сводки — пусто.
 */
export function buildArmProSummaryHtml(s: ArmProSummary | null | undefined): string {
  if (!s) return '';
  const rows: string[] = [];
  if (s.waf) rows.push(`WAF ${esc(s.waf.ageGroup)} · кат. ${esc(s.waf.weightClass)} кг · зачётов ${s.waf.entries} — ${esc(s.waf.weighInNote)}`);
  if (s.bilateral) rows.push(`L/R: асимметрия ${s.bilateral.asymmetryPct}% (слабая ${esc(s.bilateral.weakArm)} ${s.bilateral.weakSets}/${s.bilateral.strongSets})`);
  if (s.cut) rows.push(`Сгонка: ${esc(s.cut.note)}`);
  if (s.cycle) rows.push(`Цикл: ${esc(s.cycle.name)} (${s.cycle.weeks} нед, fit ${esc(s.cycle.fit)}, тейпер ${esc(s.cycle.taperPreset)})`);
  if (s.medley) rows.push(`Медли: ${esc(s.medley.name)} — лучшие ${s.medley.best.join(' + ')} = ${s.medley.total}`);
  if (s.coc) rows.push(`CoC: work ${esc(s.coc.working)}${s.coc.challenge ? ` → challenge ${esc(s.coc.challenge)}` : ''}`);
  if (s.regimen) rows.push(`Режим: ${s.regimen.lines.map(esc).join(' · ')}`);
  if (s.supermatch) rows.push(`Суперматч: ${s.supermatch.rounds} раундов, TUT ${s.supermatch.tutSec}с`);
  if (s.sparring) rows.push(`Спарринг ${s.sparring.intensityPct}%: ${s.sparring.allowed ? 'допущен' : 'ЗАПРЕЩЁН'}`);
  if (s.attempts) rows.push(`Помост ${esc(s.attempts.implement)}: ${s.attempts.attempts.join(' / ')} (${s.attempts.wrPct}% WR)`);
  if (s.autoreg) rows.push(`Авторегуляция: объём ×${s.autoreg.volumeMult}, RIR+${s.autoreg.rirShift}`);
  if (rows.length === 0) return '';
  return `<div style="margin:10px 0;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#f0fdf4"><h3 style="margin:0 0 6px;color:#15803d">📋 PRO-сводка тренера</h3><div style="font-size:11px;color:#334155">${rows.map((r) => `<div>• ${r}</div>`).join('')}</div></div>`;
}

export function buildArmPrintHtml(plan: ArmPlan, diagnostics?: { findings?: Array<{ level: string; text: string }>; humerusWarnings?: string[]; balanceWarnings?: string[]; asymmetryPct?: number; benchLevel?: string; fatigue?: string; trend?: string; info?: string[] }, proSummary?: ArmProSummary | null): string {
  const phaseColor: Record<string, string> = { accumulation:'#22c55e', intensification:'#f59e0b', deload:'#60a5fa', peaking:'#ef4444' };
  const gantt = `<div style="display:flex;gap:2px;margin:8px 0">${plan.weeks.map(wk=>`<div style="flex:1;height:18px;background:${phaseColor[wk.phase]||'#94a3b8'};border-radius:4px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:9px;font-weight:700">${wk.week}</div>`).join('')}</div><div style="display:flex;gap:8px;font-size:10px;color:#64748b;margin-bottom:8px"><span style="display:inline-block;width:10px;height:10px;background:#22c55e;border-radius:2px"></span> накопление <span style="display:inline-block;width:10px;height:10px;background:#f59e0b;border-radius:2px"></span> интенсификация <span style="display:inline-block;width:10px;height:10px;background:#ef4444;border-radius:2px"></span> пик <span style="display:inline-block;width:10px;height:10px;background:#60a5fa;border-radius:2px"></span> делод</div>`;
  const rows = plan.weeks.map(wk => {
    const sessRows = wk.sessions.map(sess => {
      const exRows = sess.exercises.map(ex => {
        const angle = ex.workingAngle ? `РУ ${ex.workingAngle.elbowDeg}° ${ex.workingAngle.direction}` : '';
        const hold = ex.holdSeconds ? ` hold ${ex.holdSeconds}с` : '';
        const table = ex.isTable ? ' 🖐️' : '';
        const comment = ex.comment ? `<div style="font-size:9px;color:#64748b">${esc(ex.comment)}</div>` : '';
        return `<tr><td>${esc(ex.name)}${table}${comment}</td><td>${esc(ex.muscle)}</td><td>${ex.sets}×${ex.repsRange[0]}-${ex.repsRange[1]} RIR${ex.rir}${hold}</td><td>${esc(angle)}</td><td>${esc(ex.tempoSpec || '')}</td></tr>`;
      }).join('');
      const sessNote = (sess as any).note ? `<div style="font-size:10px;color:#334155;margin:2px 0">📝 ${esc((sess as any).note)}</div>` : '';
      return `<h4>День ${sess.day} — ${esc(sess.sessionTag)} (${esc(sess.character)}) ${sess.tableTime ? '🖐️ стол' : ''}</h4>${sessNote}<table border="1" cellpadding="4"><tr><th>Упражнение</th><th>Мышца</th><th>Сеты×Повт</th><th>РУ</th><th>Темп</th></tr>${exRows}</table>`;
    }).join('<hr/>');
    return `<h3>Неделя ${wk.week} — ${esc(wk.phase)} ${wk.deload ? '(deload)' : wk.taper ? '(taper)' : ''}</h3>${(wk as any).note ? `<div style="font-size:10px;color:#334155;margin:2px 0">📝 ${esc((wk as any).note)}</div>` : ''}${sessRows}`;
  }).join('<hr/>');

  const qrData = encodeURIComponent(`arm-plan:${plan.pattern.id}:${plan.weeks.length}w:${plan.level}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${qrData}`;
  const jointFindings = diagnostics?.findings ? diagnostics.findings.slice(0,6).map(f=>`<div style="color:${f.level==='critical'?'#ef4444':f.level==='warn'?'#b45309':'#16a34a'}">• ${esc(f.text)} (${esc(f.level)})</div>`).join('') : '';
  const humerusBlock = diagnostics?.humerusWarnings?.length ? `<div style="margin-top:6px"><b>Humerus:</b> ${diagnostics.humerusWarnings.map(esc).join(' · ')}</div>` : '';
  const balanceBlock = diagnostics?.balanceWarnings?.length ? `<div><b>Баланс:</b> ${diagnostics.balanceWarnings.map(esc).join(' · ')}</div>` : '';
  const infoBlock = diagnostics?.info?.length ? `<div style="font-size:10px;color:#64748b;margin-top:4px">${diagnostics.info.map(esc).join(' · ')}</div>` : '';
  const diagBlock = diagnostics ? `<div style="margin:10px 0;padding:10px 12px;border:1px solid #e2e8f0;border-radius:8px;background:#f8fafc"><h3 style="margin:0 0 6px;color:#b45309">🔬 Диагностика — сустав/сухожилие (механизм)</h3><div style="font-size:11px;color:#334155">${jointFindings || '<div>Нет данных</div>'}${humerusBlock}${balanceBlock}<div style="margin-top:6px">Асимметрия ${diagnostics.asymmetryPct ?? '—'}% · Bench ${esc(diagnostics.benchLevel||'—')}</div><div>${esc(diagnostics.fatigue||'')} ${esc(diagnostics.trend||'')}</div></div><div style="font-size:10px;color:#64748b;margin-top:4px">WR RT M 130.5 / F 77.2 · WAF весовые · Каталог 72 · tendonCap 1.2× vs Muscle 1.7×</div>${infoBlock}</div>` : '';
  const header = `<div style="display:flex;align-items:center;gap:16px;margin-bottom:12px"><div style="flex:1"><h1 style="margin:0">🤝 Арм-план — ${esc(plan.pattern.name)}</h1><p style="margin:4px 0;font-size:11px;color:#64748b">${plan.weeks.length} нед · ${esc(plan.level||'')} · ${esc(plan.discipline||'')} · ${esc(plan.technique||'')} · ${new Date().toLocaleDateString('ru-RU')}</p><p style="margin:6px 0;font-size:11px">${plan.rationale.map(r=>esc(r)).join('<br/>')}</p></div><div style="text-align:center"><img src="${qrUrl}" width="110" height="110" style="border:1px solid #e2e8f0;border-radius:8px" alt="QR"/><div style="font-size:9px;color:#94a3b8;margin-top:4px">QR: ${esc(plan.pattern.id)}</div></div></div>`;
  const proBlock = buildArmProSummaryHtml(proSummary);
  return `<!doctype html><html><head><meta charset="utf-8"><title>Арм-план ${esc(plan.pattern.name)}</title><style>body{font-family:system-ui;padding:20px} table{border-collapse:collapse;width:100%} h3{color:#0a6} h4{color:#333} @media print{body{padding:10px} img{max-width:110px}}</style></head><body>${header}${proBlock}${diagBlock}${gantt}${rows}<p style="margin-top:16px;font-size:10px;color:#94a3b8">PRO: РУ/РА/РН, tendonCap 1.2× vs Muscle 1.7×, humerus guard ≤10%/нед RIR≥2, table ≥50% — Кузнецов VIII, WR RT 130.5/77.2, каталог 72. Печать: Ctrl+P → Save as PDF.</p><script>window.onload=()=>window.print()</script></body></html>`;
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
      const desc = sess.exercises.map(e => `${e.name} ${e.sets}x${e.repsRange[0]}-${e.repsRange[1]}${e.comment ? ` (${e.comment})` : ''}`).join('\\n');
      ics += `BEGIN:VEVENT\r\nUID:arm-${wk.week}-${sess.day}@bbhealth\r\nDTSTART:${dt}\r\nSUMMARY:${escIcs(summary)}\r\nDESCRIPTION:${escIcs(desc)}\r\nEND:VEVENT\r\n`;
    }
  }
  ics += 'END:VCALENDAR\r\n';
  return ics;
}
