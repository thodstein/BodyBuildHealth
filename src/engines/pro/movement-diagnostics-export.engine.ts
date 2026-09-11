/**
 * movement-diagnostics-export.engine.ts — выдача диагностики движений (P8 АПК).
 *
 * Чистые функции рендера, без доступа к сторам/мостам:
 * - buildMovementDiagnosticsHtml — HTML-отчёт (печать/PDF через printHtmlApk);
 * - buildMovementDiagnosticsCsv — CSV-таблица (сохранение через saveCsvApk);
 * - movementDiagnosticsFilename — имя файла.
 * Все пользовательские строки XSS-экранируются.
 */
import type { Lift, WeakPoint } from '../lms/weakpoint-pl';
import type { BarPathIssue } from './lift-diagnostics.engine';

export interface MovementDiagnosticsExportInput {
  lift: Lift;
  liftRu: string;
  phase: WeakPoint | '' | string;
  phaseRu: string;
  issues: BarPathIssue[];
  issuesRu: string[];
  vbtBest: number | null;
  vbtLast: number | null;
  vbtWeightKg: number | null;
  vbtLossPct: number | null;
  vbtZone: string;
  videoNote: string;
  kinoveaXLoop: number | null;
  createdAt?: string;
}

function esc(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmt(n: number | null, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return String(Math.round(n * 10 ** digits) / 10 ** digits);
}

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v);
  // защита от формульной инъекции Excel: префикс ' для = + - @
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
}

export function movementDiagnosticsFilename(lift: Lift, ext: 'html' | 'csv'): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
  return `movement-${lift}-${stamp}.${ext}`;
}

export function buildMovementDiagnosticsCsv(inp: MovementDiagnosticsExportInput): string {
  const rows: string[][] = [
    ['Поле', 'Значение'],
    ['Движение', inp.liftRu],
    ['Фаза срыва', inp.phaseRu || '—'],
    ['Отклонения', inp.issuesRu.length ? inp.issuesRu.join('; ') : '—'],
    ['VBT лучший, м/с', inp.vbtBest != null ? String(inp.vbtBest) : '—'],
    ['VBT последний, м/с', inp.vbtLast != null ? String(inp.vbtLast) : '—'],
    ['VBT вес, кг', inp.vbtWeightKg != null ? String(inp.vbtWeightKg) : '—'],
    ['Потеря скорости, %', inp.vbtLossPct != null ? String(inp.vbtLossPct) : '—'],
    ['VBT зона', inp.vbtZone || '—'],
    ['Kinovea xLoop, см', inp.kinoveaXLoop != null ? String(inp.kinoveaXLoop) : '—'],
    ['Видео', inp.videoNote || '—'],
    ['Дата', inp.createdAt || new Date().toISOString().slice(0, 10)],
  ];
  return rows.map((r) => r.map(csvCell).join(',')).join('\n');
}

export function buildMovementDiagnosticsHtml(inp: MovementDiagnosticsExportInput): string {
  const li = (k: string, v: string) =>
    `<tr><td style="padding:6px 8px;border:1px solid #ddd;color:#555;">${esc(k)}</td><td style="padding:6px 8px;border:1px solid #ddd;">${esc(v)}</td></tr>`;
  const vbtLine =
    inp.vbtBest != null && inp.vbtLast != null
      ? `${fmt(inp.vbtBest)} → ${fmt(inp.vbtLast)} м/с · потеря ${fmt(inp.vbtLossPct, 1)}% · ${inp.vbtZone || '—'}`
      : 'не измерена';
  return `<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Диагностика движений — ${esc(inp.liftRu)}</title></head><body style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:16px;color:#111;">`
    + `<h1 style="font-size:18px;">Диагностика движений — ${esc(inp.liftRu)}</h1>`
    + `<p style="font-size:12px;color:#555;">Фаза: ${esc(inp.phaseRu || '—')} · Дата: ${esc(inp.createdAt || new Date().toISOString().slice(0, 10))}</p>`
    + `<table style="border-collapse:collapse;width:100%;font-size:13px;">`
    + li('Отклонения траектории', inp.issuesRu.length ? inp.issuesRu.join('; ') : '—')
    + li('VBT', vbtLine)
    + (inp.vbtWeightKg != null ? li('VBT вес', `${fmt(inp.vbtWeightKg, 1)} кг`) : '')
    + (inp.kinoveaXLoop != null
      ? li('Kinovea xLoop', `${fmt(inp.kinoveaXLoop, 1)} см ${inp.kinoveaXLoop >= 6 ? '(крит. >6)' : inp.kinoveaXLoop >= 4 ? '(внимание ≥4)' : '(норма)'}`)
      : '')
    + li('Видео', inp.videoNote || '—')
    + `</table><p style="font-size:11px;color:#666;">Скорость из видео — оценка (не LPT). Снимайте строго сбоку 90°, штатив, 2–3 м.</p></body></html>`;
}
