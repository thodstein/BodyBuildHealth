/**
 * bb-diagnostics-export.engine.ts — экспорт ББ-диагностики (HTML/CSV, XSS-safe).
 */
import type { BBDiagnosticsReport } from './bb-diagnostics-hub.engine';

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function buildBBDiagnosticsHtml(report: BBDiagnosticsReport, meta?: { date?: string; level?: string }): string {
  const date = meta?.date || new Date().toISOString().slice(0, 10);
  const level = meta?.level || '';
  const rowsWeak = report.weakCandidates.map(c => `<tr><td>${esc(c.muscle)}</td><td>${esc(c.granular || '')}</td><td>${esc(c.source)}</td><td>${c.deltaPct}%</td><td>${esc(c.reason)}</td></tr>`).join('') || '<tr><td colspan="5">— баланс</td></tr>';
  const rowsSym = Object.entries(report.symmetry.ratios).map(([k, v]) => `<tr><td>${esc(k)}</td><td>${v}</td></tr>`).join('') || '<tr><td colspan="2">—</td></tr>';
  const issuesSym = report.symmetry.issues.map(s => `<li>${esc(s)}</li>`).join('') || '<li>—</li>';
  const issuesStim = report.stimulus.issues.map(s => `<li>${esc(s)}</li>`).join('') || '<li>—</li>';
  const findings = report.findings.map(s => `<li>${esc(s)}</li>`).join('');
  const priorities = report.priorities.map(s => `<li>${esc(s)}</li>`).join('');
  const floors = report.score.floors.map(s => `<li>${esc(s)}</li>`).join('');

  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>ББ-диагностика ${esc(date)}</title>
<style>body{font-family:system-ui,Arial,sans-serif;padding:18px;color:#111}h1{font-size:18px}h2{font-size:14px;margin:14px 0 6px}table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #ddd;padding:6px 8px;font-size:12px;text-align:left}th{background:#f5f5f5}.badge{padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#fff}</style>
</head><body>
<h1>ББ-диагностика — отчёт ${esc(date)} ${level ? `· ${esc(level)}` : ''}</h1>
<div>Score <span class="badge" style="background:${report.score.level === 'critical' ? '#ef4444' : report.score.level === 'warn' ? '#f59e0b' : '#22c55e'}">${report.score.score}/100 ${esc(report.score.level)}</span> · verification ${report.score.verification} · weak ${report.weakMusclesCanonical.join(', ') || '—'}</div>
${floors ? `<div style="margin-top:8px;color:#ef4444;font-size:11px"><b>Floors:</b><ul>${floors}</ul></div>` : ''}
<h2>Слабые (топ-2 → в ББ-авто)</h2><table><tr><th>Мышца</th><th>Зона</th><th>Источник</th><th>Δ%</th><th>Причина</th></tr>${rowsWeak}</table>
<h2>Симметрия</h2><table><tr><th>Рацио</th><th>Значение</th></tr>${rowsSym}</table><ul>${issuesSym}</ul>
<h2>Стимул</h2><ul>${issuesStim}</ul><div style="font-size:11px;color:#666">lengthened ${report.stimulus.global.lengthened} · mid ${report.stimulus.global.midRange} · shortened ${report.stimulus.global.shortened} · compound ${report.stimulus.global.compound} / iso ${report.stimulus.global.isolation}</div>
<h2>Находки</h2><ul>${findings || '<li>—</li>'}</ul>
<h2>Приоритеты</h2><ul>${priorities || '<li>—</li>'}</ul>
<div style="margin-top:14px;font-size:10px;color:#888">ББ-диагностика PRO · MEV/MAV/MRV Israetel · Reeves/Sandow · Schoenfeld lengthened · RSS √Σpen²</div>
</body></html>`;
}

export function buildBBDiagnosticsCsv(report: BBDiagnosticsReport): string {
  const escCsv = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines: string[] = [];
  lines.push(['muscle', 'granular', 'source', 'deltaPct', 'reason'].map(escCsv).join(','));
  for (const c of report.weakCandidates) lines.push([c.muscle, c.granular || '', c.source, c.deltaPct, c.reason].map(escCsv).join(','));
  lines.push('');
  lines.push(['metric', 'value'].map(escCsv).join(','));
  lines.push(['score', report.score.score].map(escCsv).join(','));
  lines.push(['level', report.score.level].map(escCsv).join(','));
  lines.push(['verification', report.score.verification].map(escCsv).join(','));
  lines.push(['weakCanonical', report.weakMusclesCanonical.join('|')].map(escCsv).join(','));
  lines.push(['weakGranular', report.weakZonesGranular.join('|')].map(escCsv).join(','));
  for (const [k, v] of Object.entries(report.symmetry.ratios)) lines.push([k, v].map(escCsv).join(','));
  return lines.join('\n');
}

export function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadCsv(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
