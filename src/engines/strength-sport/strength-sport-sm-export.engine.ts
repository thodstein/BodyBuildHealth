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
