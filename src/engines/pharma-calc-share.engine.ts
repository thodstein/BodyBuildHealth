// Pharma calc share — персист + экспорт сводок (HTML-печать + CSV с защитой).
export interface CalcSnapshot {
  id: string;
  tab: string;
  at: string;
  summary: string;
}

const KEY = 'he_pharma_calc_v1';
const CAP = 10;

export function loadCalcHistory(): CalcSnapshot[] {
  try {
    const raw = localStorage.getItem(KEY);
    const arr = JSON.parse(raw || '[]');
    return Array.isArray(arr) ? arr.filter((x) => x && x.summary).slice(0, CAP) : [];
  } catch {
    return [];
  }
}

export function saveCalcSnapshot(tab: string, summary: string): CalcSnapshot[] {
  const next: CalcSnapshot[] = [
    { id: `${Date.now()}`, tab, at: new Date().toISOString(), summary: String(summary).slice(0, 500) },
    ...loadCalcHistory(),
  ].slice(0, CAP);
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* quota — молча */
  }
  return next;
}

export function clearCalcHistory(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* молча */
  }
}

export function downloadCsv(filename: string, rows: (string | number)[][]): void {
  try {
    const blob = new Blob([buildCalcCsv(rows)], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch {
    /* молча */
  }
}

export function escHtml(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Защита от CSV-формул: префикс ' для = + - @
export function csvCell(v: string | number): string {
  const s = String(v ?? '');
  const needs = /^[=+\-@]/.test(s.trim()) || /[",\n]/.test(s);
  const guarded = /^[=+\-@]/.test(s.trim()) ? `'${s}` : s;
  return needs ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function buildCalcCsv(rows: (string | number)[][]): string {
  const bom = '\uFEFF';
  return bom + rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export function buildCalcHtml(title: string, rows: [string, string][]): string {
  const body = rows.map(([k, v]) => `<tr><td>${escHtml(k)}</td><td>${escHtml(v)}</td></tr>`).join('');
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>${escHtml(title)}</title></head><body><h1>${escHtml(title)}</h1><table border="1" cellpadding="6"><tbody>${body}</tbody></table><p>${escHtml('Относительные оценки модели, не назначение. Подтверди анализом крови и врачом.')}</p></body></html>`;
}

export function printHtml(html: string): void {
  try {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  } catch {
    /* popup blocked */
  }
}
