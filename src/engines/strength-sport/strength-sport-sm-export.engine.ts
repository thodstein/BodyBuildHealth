/**
 * strength-sport-sm-export.engine.ts — печать/экспорт СТРОНГ-диагностики
 * HTML-экранирование, секции: слабые фазы, carry sway, VBT, grip, OHS.
 */

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface SMDiagnosticSnapshot {
  weakPoints: string[];
  score: number;
  level: string;
  verification: number;
  sway?: string | null;
  carrySwayCm?: number | null;
  vbt?: string | null;
  vbtLossPct?: number | null;
  ohs?: { totalScore: number; failed: number };
  gripFails?: number | null;
  asymmetryPct?: number | null;
  platformHeightCm?: number | null;
  tacky?: boolean | null;
  findings: string[];
  // SM PRO: физика + симулятор + попытки + прогресс (опционально, backward-compat)
  conditioning?: string | null;
  carryPhysics?: string | null;
  stoneMoment?: string | null;
  contestSim?: string | null;
  attempts?: string[] | null;
  progress?: string | null;
  causes?: string[] | null;
  specBlock?: string | null;
}

export function buildSMDiagnosticsHtml(snap: SMDiagnosticSnapshot): string {
  const rows = snap.weakPoints.map(wp => `<tr><td>${esc(wp)}</td></tr>`).join('');
  const findings = snap.findings.map(f => `<li>${esc(f)}</li>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Стронг-диагностика</title><style>body{font-family:system-ui;padding:24px;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px}h1{font-size:18px}</style></head><body>
<h1>Стронг-диагностика — отчёт ${esc(new Date().toISOString().slice(0,10))}</h1>
<div>Score ${snap.score} (${esc(snap.level)}) · verification ${snap.verification}</div>
<h2>Слабые фазы</h2><table><tr><th>Фаза</th></tr>${rows || '<tr><td>баланс</td></tr>'}</table>
<h2>Метрики</h2><ul>
<li>Carry sway: ${snap.carrySwayCm != null ? `${snap.carrySwayCm}см` : esc(snap.sway || '—')}</li>
<li>VBT: ${esc(snap.vbt || '—')} ${snap.vbtLossPct != null ? `(${snap.vbtLossPct}%)` : ''}</li>
<li>OHS: ${snap.ohs ? `${snap.ohs.totalScore}/6 fail ${snap.ohs.failed}` : '—'}</li>
<li>Grip fails: ${snap.gripFails != null ? `${snap.gripFails}/3` : '—'}</li>
<li>Асимметрия: ${snap.asymmetryPct != null ? `${snap.asymmetryPct}%` : '—'}</li>
<li>Платформа: ${snap.platformHeightCm != null ? `${snap.platformHeightCm}см` : '—'} · Tacky: ${snap.tacky ? 'да' : snap.tacky === false ? 'нет' : '—'}</li>
</ul>
<h2>Findings</h2><ul>${findings}</ul>
${snap.conditioning ? `<h2>Кондиция</h2><div>${esc(snap.conditioning)}</div>` : ''}
${snap.carryPhysics ? `<h2>Физика переноски</h2><div>${esc(snap.carryPhysics)}</div>` : ''}
${snap.stoneMoment ? `<h2>Момент камня</h2><div>${esc(snap.stoneMoment)}</div>` : ''}
${snap.contestSim ? `<h2>Симулятор контеста</h2><div>${esc(snap.contestSim)}</div>` : ''}
${snap.attempts && snap.attempts.length ? `<h2>Попытки</h2><ul>${snap.attempts.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
${snap.progress ? `<h2>Прогресс</h2><div>${esc(snap.progress)}</div>` : ''}
${snap.causes && snap.causes.length ? `<h2>Причины</h2><ul>${snap.causes.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : ''}
${snap.specBlock ? `<h2>Спец-блок</h2><div>${esc(snap.specBlock)}</div>` : ''}
</body></html>`;
}

export function buildSMCsv(snap: SMDiagnosticSnapshot): string {
  const escCsv = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [
    ['weakPoints', snap.weakPoints.join(';') || 'balance'],
    ['score', String(snap.score)],
    ['level', snap.level],
    ['verification', String(snap.verification)],
    ['sway', snap.carrySwayCm != null ? String(snap.carrySwayCm) : snap.sway || ''],
    ['vbt', snap.vbt || ''],
    ['vbtLoss', snap.vbtLossPct != null ? String(snap.vbtLossPct) : ''],
    ['ohs', snap.ohs ? `${snap.ohs.totalScore}/6` : ''],
    ['gripFails', snap.gripFails != null ? String(snap.gripFails) : ''],
    ['asymmetry', snap.asymmetryPct != null ? String(snap.asymmetryPct) : ''],
    ['conditioning', snap.conditioning || ''],
    ['carryPhysics', snap.carryPhysics || ''],
    ['stoneMoment', snap.stoneMoment || ''],
    ['contestSim', snap.contestSim || ''],
    ['attempts', (snap.attempts || []).join('; ')],
    ['progress', snap.progress || ''],
    ['causes', (snap.causes || []).join('; ')],
    ['specBlock', snap.specBlock || ''],
    ['findings', snap.findings.join('; ')],
  ];
  return rows.map(r => r.map(escCsv).join(',')).join('\n');
}

export function downloadSMHtml(html: string, filename = 'strongman-report.html'): void {
  try {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {}
}
export function downloadSMCsv(snap: SMDiagnosticSnapshot, filename = 'strongman-diagnostics.csv'): void {
  try {
    const csv = buildSMCsv(snap);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {}
}
