/**
 * strength-sport-wl-export.engine.ts — печать/экспорт ТА-диагностики + плана
 * HTML-экранирование, секции: слабые фазы, bar path, VBT, OHS, план.
 */

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface WLDiagnosticSnapshot {
  weakPoints: string[];
  score: number;
  level: string;
  verification: number;
  barPath?: string | null;
  vbt?: string | null;
  ohs?: { totalScore: number; failed: number };
  asymmetryPct?: number | null;
  fvr?: { snatchTh: number; Pmax: number } | null;
  findings: string[];
}

export function buildWLDiagnosticsHtml(snap: WLDiagnosticSnapshot): string {
  const rows = snap.weakPoints.map(wp => `<tr><td>${esc(wp)}</td></tr>`).join('');
  const findings = snap.findings.map(f => `<li>${esc(f)}</li>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ТА-диагностика</title><style>body{font-family:system-ui;padding:24px;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px}h1{font-size:18px}</style></head><body>
<h1>ТА-диагностика — отчёт ${esc(new Date().toISOString().slice(0,10))}</h1>
<div>Score ${snap.score} (${esc(snap.level)}) · verification ${snap.verification}</div>
<h2>Слабые фазы</h2><table><tr><th>Фаза</th></tr>${rows || '<tr><td>баланс</td></tr>'}</table>
<h2>Метрики</h2><ul>
<li>Bar path: ${esc(snap.barPath || '—')}</li>
<li>VBT: ${esc(snap.vbt || '—')}</li>
<li>OHS: ${snap.ohs ? `${snap.ohs.totalScore}/6 fail ${snap.ohs.failed}` : '—'}</li>
<li>Асимметрия: ${snap.asymmetryPct != null ? `${snap.asymmetryPct}%` : '—'}</li>
<li>FvR2: ${snap.fvr ? `snatchTh ${snap.fvr.snatchTh}кг Pmax ${snap.fvr.Pmax}Вт` : '—'}</li>
</ul>
<h2>Findings</h2><ul>${findings}</ul>
</body></html>`;
}

export function buildWLPlanHtml(plan: any, snap?: WLDiagnosticSnapshot): string {
  const weeks = (plan?.weeksData || []).map((w: any) => `<tr><td>${w.week}</td><td>${esc(w.phase)}</td><td>${w.totalSets}</td><td>${Math.round((w.totalTonnage||0)/1000)}т</td></tr>`).join('');
  const diag = snap ? buildWLDiagnosticsHtml(snap).replace('<!DOCTYPE html>', '').replace(/<html>.*<\/html>/s, '') : '';
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ТА-план ${esc(plan?.id || '')}</title><style>body{font-family:system-ui;padding:24px}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:6px}</style></head><body>
<h1>ТА-план ${esc(plan?.mode || '')} ${plan?.weeks}нед</h1>
<table><tr><th>Нед</th><th>Фаза</th><th>Сеты</th><th>Тоннаж</th></tr>${weeks}</table>
${diag}
</body></html>`;
}

export function downloadWLHtml(html: string, filename = 'ta-report.html'): void {
  try {
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {}
}
