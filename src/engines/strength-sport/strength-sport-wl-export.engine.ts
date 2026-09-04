/**
 * strength-sport-wl-export.engine.ts — печать/экспорт ТА-диагностики + плана
 * HTML-экранирование, секции: слабые фазы, bar path, VBT, OHS, план.
 */

function esc(s: string): string {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export interface WLBiomechRow {
  weakPoint: string;
  label?: string;
  joint?: string;
  angleRange?: string;
  weakMuscles?: string;
  reason?: string;
}

export interface WLCorrectionRow {
  weakPoint: string;
  corrId: string;
  name?: string;
  protocol?: string;
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
  // E14 v2 (опционально, backward compatible)
  sex?: string | null;
  causes?: Record<string, string>;
  biomech?: WLBiomechRow[];
  corrections?: WLCorrectionRow[];
  injectionNotes?: string[];
  attempts?: { snatch?: [number, number, number]; cj?: [number, number, number] };
}

export function buildWLDiagnosticsHtml(snap: WLDiagnosticSnapshot): string {
  const rows = snap.weakPoints.map(wp => {
    const cause = snap.causes?.[wp];
    return `<tr><td>${esc(wp)}</td><td>${esc(cause || '—')}</td></tr>`;
  }).join('');
  const findings = snap.findings.map(f => `<li>${esc(f)}</li>`).join('');
  const bioRows = (snap.biomech || []).map(b =>
    `<tr><td>${esc(b.weakPoint)}</td><td>${esc(b.label || '')}</td><td>${esc(b.joint || '')} ${esc(b.angleRange || '')}</td><td>${esc(b.weakMuscles || '')}</td><td>${esc(b.reason || '')}</td></tr>`).join('');
  const corrRows = (snap.corrections || []).map(c =>
    `<tr><td>${esc(c.weakPoint)}</td><td>${esc(c.name || c.corrId)}</td><td>${esc(c.protocol || '')}</td></tr>`).join('');
  const injRows = (snap.injectionNotes || []).map(n => `<li>${esc(n)}</li>`).join('');
  const att = snap.attempts;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>ТА-диагностика</title><style>body{font-family:system-ui;padding:24px;color:#111}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ddd;padding:8px}h1{font-size:18px}h2{font-size:15px;margin-top:18px}</style></head><body>
<h1>ТА-диагностика — отчёт ${esc(new Date().toISOString().slice(0,10))}</h1>
<div>Score ${snap.score} (${esc(snap.level)}) · verification ${snap.verification}${snap.sex ? ` · ${esc(snap.sex)}` : ''}</div>
<h2>Слабые фазы + причины</h2><table><tr><th>Фаза</th><th>Причина</th></tr>${rows || '<tr><td>баланс</td><td>—</td></tr>'}</table>
${bioRows ? `<h2>Биомеханика фаз</h2><table><tr><th>Фаза</th><th>Метка</th><th>Сустав/угол</th><th>Мышцы</th><th>Причина</th></tr>${bioRows}</table>` : ''}
${corrRows ? `<h2>Коррекции топ-3</h2><table><tr><th>Фаза</th><th>Упражнение</th><th>Протокол</th></tr>${corrRows}</table>` : ''}
${att && (att.snatch || att.cj) ? `<h2>Попытки</h2><ul>${att.snatch ? `<li>Рывок: ${att.snatch.join(' / ')}</li>` : ''}${att.cj ? `<li>Толчок: ${att.cj.join(' / ')}</li>` : ''}</ul>` : ''}
${injRows ? `<h2>Инъекция в план</h2><ul>${injRows}</ul>` : ''}
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

export function buildWLCsv(snap: WLDiagnosticSnapshot): string {
  const escCsv = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [
    ['weakPoints', snap.weakPoints.join(';') || 'balance'],
    ['score', String(snap.score)],
    ['level', snap.level],
    ['verification', String(snap.verification)],
    ['barPath', snap.barPath || ''],
    ['vbt', snap.vbt || ''],
    ['ohs', snap.ohs ? `${snap.ohs.totalScore}/6` : ''],
    ['asymmetry', snap.asymmetryPct != null ? String(snap.asymmetryPct) : ''],
    ['causes', snap.causes ? Object.entries(snap.causes).map(([k, v]) => `${k}=${v}`).join(';') : ''],
    ['corrections', (snap.corrections || []).map(c => `${c.weakPoint}:${c.corrId}@${c.protocol || ''}`).join(';')],
    ['attempts', snap.attempts ? [snap.attempts.snatch ? `snatch=${snap.attempts.snatch.join('/')}` : '', snap.attempts.cj ? `cj=${snap.attempts.cj.join('/')}` : ''].filter(Boolean).join(';') : ''],
    ['findings', snap.findings.join('; ')],
  ];
  return rows.map(r => r.map(escCsv).join(',')).join('\n');
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
export function downloadWLCsv(snap: WLDiagnosticSnapshot, filename = 'ta-diagnostics.csv'): void {
  try {
    const csv = buildWLCsv(snap);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch {}
}
