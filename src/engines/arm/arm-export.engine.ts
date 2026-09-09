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
  return `<div class="pro"><h3>📋 PRO-сводка тренера</h3><div class="pro-rows">${rows.map((r) => `<div>• ${r}</div>`).join('')}</div></div>`;
}

export function buildArmPrintHtml(plan: ArmPlan, diagnostics?: { findings?: Array<{ level: string; text: string }>; humerusWarnings?: string[]; balanceWarnings?: string[]; asymmetryPct?: number; benchLevel?: string; fatigue?: string; trend?: string; info?: string[] }, proSummary?: ArmProSummary | null): string {
  const phaseColor: Record<string, string> = { accumulation:'#22c55e', intensification:'#f59e0b', deload:'#60a5fa', peaking:'#ef4444' };
  const phaseRu: Record<string, string> = { accumulation:'накопление', intensification:'интенсификация', deload:'делод', peaking:'пик' };
  const gantt = `<div class="gantt"><div style="display:flex;gap:3px">${plan.weeks.map(wk=>`<div style="flex:1;height:22px;background:${phaseColor[wk.phase]||'#94a3b8'};border-radius:6px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;font-weight:800">${wk.week}</div>`).join('')}</div><div class="legend"><span><i style="background:#22c55e"></i>накопление</span><span><i style="background:#f59e0b"></i>интенсификация</span><span><i style="background:#ef4444"></i>пик</span><span><i style="background:#60a5fa"></i>делод</span></div></div>`;
  const weekSets = (wk: any) => (wk.sessions || []).reduce((a: number, s: any) => a + (s.exercises || []).reduce((x: number, e: any) => x + (e.sets || 0), 0), 0);
  const sessSets = (sess: any) => (sess.exercises || []).reduce((a: number, e: any) => a + (e.sets || 0), 0);
  const exWeight = (ex: any) => {
    try { const w = ex.workSets?.[0]?.weight; return Number(w) > 0 ? ` ≈${w} кг` : ''; } catch { return ''; }
  };
  const rows = plan.weeks.map(wk => {
    const sessRows = wk.sessions.map(sess => {
      const exRows = sess.exercises.map(ex => {
        const angle = ex.workingAngle ? `РУ ${ex.workingAngle.elbowDeg}° ${ex.workingAngle.direction}` : '';
        const hold = ex.holdSeconds ? ` hold ${ex.holdSeconds}с` : '';
        const table = ex.isTable ? ' 🖐️' : '';
        const comment = ex.comment ? `<div class="ex-c">💡 ${esc(ex.comment)}</div>` : '';
        return `<tr><td><b>${esc(ex.name)}</b>${table}${comment}</td><td>${esc(ex.muscle)}</td><td class="num">${ex.sets}×${ex.repsRange[0]}-${ex.repsRange[1]} RIR${ex.rir}${hold}${esc(exWeight(ex))}</td><td>${esc(angle)}</td><td class="num">${esc(ex.tempoSpec || '')}</td></tr>`;
      }).join('');
      const sessNote = (sess as any).note ? `<div class="note">📝 ${esc((sess as any).note)}</div>` : '';
      return `<section class="sess"><h4>День ${sess.day} — ${esc(sess.sessionTag)} <span class="chip">${esc(sess.character)}</span> ${sess.tableTime ? '<span class="chip table">🖐️ стол</span>' : ''} <span class="wtot">${sessSets(sess)} сетов</span></h4>${sessNote}<table class="t"><thead><tr><th>Упражнение</th><th>Мышца</th><th>Сеты×Повт</th><th>РУ</th><th>Темп</th></tr></thead><tbody>${exRows}</tbody></table></section>`;
    }).join('');
    return `<section class="week"><h3><span class="ph" style="background:${phaseColor[wk.phase]||'#94a3b8'}">${esc(phaseRu[wk.phase]||wk.phase)}</span> Неделя ${wk.week} — ${esc(wk.phase)} ${wk.deload ? '(deload)' : wk.taper ? '(taper)' : ''} <span class="wtot">${weekSets(wk)} сетов · ${wk.sessions.length} сесс.</span></h3>${(wk as any).note ? `<div class="note">📝 ${esc((wk as any).note)}</div>` : ''}${sessRows}</section>`;
  }).join('');

  const qrData = encodeURIComponent(`arm-plan:${plan.pattern.id}:${plan.weeks.length}w:${plan.level}`);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=110x110&data=${qrData}`;
  const jointFindings = diagnostics?.findings ? diagnostics.findings.slice(0,6).map(f=>`<div class="f-${f.level}">• ${esc(f.text)} (${esc(f.level)})</div>`).join('') : '';
  const humerusBlock = diagnostics?.humerusWarnings?.length ? `<div><b>Humerus:</b> ${diagnostics.humerusWarnings.map(esc).join(' · ')}</div>` : '';
  const balanceBlock = diagnostics?.balanceWarnings?.length ? `<div><b>Баланс:</b> ${diagnostics.balanceWarnings.map(esc).join(' · ')}</div>` : '';
  const infoBlock = diagnostics?.info?.length ? `<div class="meta">${diagnostics.info.map(esc).join(' · ')}</div>` : '';
  const diagBlock = diagnostics ? `<div class="card"><h3>🔬 Диагностика — сустав/сухожилие (механизм)</h3><div class="rows">${jointFindings || '<div>Нет данных</div>'}${humerusBlock}${balanceBlock}<div>Асимметрия ${diagnostics.asymmetryPct ?? '—'}% · Bench ${esc(diagnostics.benchLevel||'—')}</div><div>${esc(diagnostics.fatigue||'')} ${esc(diagnostics.trend||'')}</div></div><div class="meta">WR RT M 130.5 / F 77.2 · WAF весовые · Каталог 72 · tendonCap 1.2× vs Muscle 1.7×</div>${infoBlock}</div>` : '';
  const header = `<header class="head"><div style="display:flex;align-items:flex-start;gap:16px"><div style="flex:1"><h1>🤝 Арм-план — ${esc(plan.pattern.name)}</h1><div class="chips"><span>${plan.weeks.length} нед</span><span>${esc(plan.level||'')}</span><span>${esc(plan.discipline||'')}</span><span>${esc(plan.technique||'')}</span><span>${new Date().toLocaleDateString('ru-RU')}</span></div><div class="rat">${plan.rationale.map(r=>esc(r)).join('<br/>')}</div></div><div class="qr"><img src="${qrUrl}" width="110" height="110" alt="QR"/><div>QR: ${esc(plan.pattern.id)}</div></div></div></header>`;
  const proBlock = buildArmProSummaryHtml(proSummary);
  const css = '@page{margin:12mm}body{font-family:system-ui,-apple-system,sans-serif;padding:24px;max-width:960px;margin:0 auto;color:#0f172a;background:#fff}.head h1{margin:0;font-size:24px;letter-spacing:-.5px}.chips{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.chips span{font-size:11px;font-weight:700;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:3px 10px;color:#334155}.rat{font-size:11px;color:#334155;line-height:1.6}.wtot{font-size:10px;font-weight:700;color:#64748b}.qr{text-align:center;font-size:9px;color:#94a3b8}.qr img{border:1px solid #e2e8f0;border-radius:8px}.card{margin:12px 0;padding:12px 14px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}.card h3{margin:0 0 8px;font-size:14px}.pro{margin:12px 0;padding:12px 14px;border:1px solid #bbf7d0;border-radius:12px;background:#f0fdf4}.pro h3{margin:0 0 8px;font-size:14px;color:#15803d}.pro-rows{font-size:11px;color:#334155;line-height:1.7}.rows{font-size:11px;color:#334155;line-height:1.7}.meta{font-size:10px;color:#64748b;margin-top:6px}.gantt{margin:12px 0}.legend{display:flex;gap:10px;font-size:10px;color:#64748b;margin-top:6px}.legend i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:4px}.week{margin:16px 0;page-break-inside:avoid}.week h3{font-size:15px;margin:0 0 8px;display:flex;align-items:center;gap:8px}.ph{font-size:10px;font-weight:800;color:#fff;border-radius:6px;padding:2px 8px;text-transform:uppercase;letter-spacing:.5px}.note{font-size:10px;color:#334155;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:6px 10px;margin:6px 0}.sess{margin:10px 0;page-break-inside:avoid}.sess h4{font-size:13px;margin:0 0 6px}.chip{font-size:10px;font-weight:700;background:#eef2ff;border:1px solid #c7d2fe;color:#3730a3;border-radius:999px;padding:2px 8px}.chip.table{background:#ecfdf5;border-color:#6ee7b7;color:#065f46}table.t{border-collapse:collapse;width:100%;font-size:11px}table.t thead{display:table-header-group}table.t th{background:#0f172a;color:#fff;text-align:left;padding:7px 9px}table.t th:first-child{border-radius:8px 0 0 0}table.t th:last-child{border-radius:0 8px 0 0}table.t td{border:1px solid #e2e8f0;padding:6px 9px;vertical-align:top}table.t tbody tr:nth-child(even){background:#f8fafc}table.t .num{white-space:nowrap;font-variant-numeric:tabular-nums}.ex-c{font-size:9px;color:#64748b;margin-top:2px}.f-critical{color:#dc2626}.f-warn{color:#b45309}.f-ok{color:#16a34a}.foot{margin-top:16px;font-size:10px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:8px}.head{border-bottom:3px solid #0f172a;padding-bottom:12px;margin-bottom:4px}.head h1{background:linear-gradient(135deg,#0f172a,#1e3a5f);-webkit-background-clip:text;background-clip:text}.card{box-shadow:0 1px 3px rgba(15,23,42,.08)}.pro{border-left:4px solid #22c55e}.pro h3{letter-spacing:-.2px}.note{border-left:3px solid #f59e0b}.gantt{padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc}table.t tbody tr:nth-child(even){background:#f8fafc}table.t tbody tr:hover{background:#eef2ff}@page{margin:12mm}.foot{display:flex;justify-content:space-between;gap:12px}::selection{background:#fde68a}@media print{body{padding:10px}img{max-width:110px}.week,.sess,.card,.pro{break-inside:avoid}.gantt{break-inside:avoid}}';
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Арм-план ${esc(plan.pattern.name)}</title><style>${css}</style></head><body>${header}${proBlock}${diagBlock}${gantt}${rows}<p class="foot">PRO: РУ/РА/РН, tendonCap 1.2× vs Muscle 1.7×, humerus guard ≤10%/нед RIR≥2, table ≥50% — Кузнецов VIII, WR RT 130.5/77.2, каталог 72. Печать: Ctrl+P → Save as PDF.</p><script>window.onload=()=>window.print()</script></body></html>`;
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
