/**
 * combat-diagnostics-export.engine.ts — P7 экспорт хаба (HTML/XSS + CSV/BOM/формулы).
 * Паттерн wl/sm-export: esc всех пользовательских строк, BOM для Excel,
 * формул-защита (= + - @ → префикс '). Без DOM-зависимостей (тестируемо).
 */

export interface CombatExportRow {
  block: string;
  point: string;
  value: string;
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(s: string): string {
  const v = String(s ?? '');
  const safe = /^[=+\-@]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function buildCombatDiagnosticsHtml(rows: CombatExportRow[], scoreText: string): string {
  const body = rows.map(r => `<tr><td>${esc(r.block)}</td><td>${esc(r.point)}</td><td>${esc(r.value)}</td></tr>`).join('');
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Диагностика единоборств</title></head><body><h1>Диагностика единоборств</h1><p>${esc(scoreText)}</p><table border="1"><tr><th>Блок</th><th>Точка</th><th>Значение</th></tr>${body}</table></body></html>`;
}

export function buildCombatDiagnosticsCsv(rows: CombatExportRow[]): string {
  const head = '\uFEFFБлок,Точка,Значение';
  const lines = rows.map(r => [csvCell(r.block), csvCell(r.point), csvCell(r.value)].join(','));
  return [head, ...lines].join('\n');
}

export function downloadCombatFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
