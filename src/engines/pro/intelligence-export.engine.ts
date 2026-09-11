/**
 * intelligence-export.engine.ts — P5: экспорт единого пульта (паритет с ББ/ТА-хабами).
 * HTML-сводка (XSS-esc) + CSV журнала sRPE (BOM + формул-защита) + ICS недели deload.
 */
import type { SRPESession } from './srpe-store';
import { sessionLoad } from './training-load.engine';

export interface IntelExportSummary {
  acwr: string; acwrZone: string; recovery: string; pri: string;
  volumeMult: number; rirShift: number; deload: boolean;
  forecast: string; generatedAt: string;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** CSV-защита от формульных инъекций Excel (= + - @ → префикс '). */
export function csvCell(v: string | number): string {
  const s = String(v);
  const needsQuote = /[",\n]/.test(s);
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return needsQuote ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export function buildIntelCsv(sessions: SRPESession[]): string {
  const rows = ['\uFEFFdate,sRPE,durationMin,loadAU'];
  for (const s of sessions) rows.push([csvCell(s.date), s.sRPE, s.durationMin, sessionLoad(s.sRPE, s.durationMin)].join(','));
  return rows.join('\n');
}

export function buildIntelHtml(sessions: SRPESession[], summary: IntelExportSummary): string {
  const rows = sessions.slice().reverse().slice(0, 60).map(s =>
    `<tr><td>${esc(s.date)}</td><td>${s.sRPE}</td><td>${s.durationMin}</td><td>${sessionLoad(s.sRPE, s.durationMin)}</td></tr>`,
  ).join('');
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Интеллект тренировки — сводка ${esc(summary.generatedAt)}</title></head><body>` +
    `<h1>⚡ Интеллект тренировки — сводка</h1>` +
    `<p>ACWR ${esc(summary.acwr)} (${esc(summary.acwrZone)}) · Recovery ${esc(summary.recovery)} · PRI ${esc(summary.pri)}</p>` +
    `<p>Коррекция: объём ×${summary.volumeMult} · RIR +${summary.rirShift}${summary.deload ? ' · deload' : ''} · Прогноз: ${esc(summary.forecast)}</p>` +
    `<table border="1" cellpadding="4"><thead><tr><th>Дата</th><th>sRPE</th><th>Мин</th><th>AU</th></tr></thead><tbody>${rows}</tbody></table>` +
    `<p><small>ACWR — эвристика мониторинга, не предсказание травмы. Сгенерировано локально ${esc(summary.generatedAt)}.</small></p>` +
    `</body></html>`;
}

/** ICS: одна недельная deload-метка с понедельника следующей недели (только при deload=true). */
export function buildIntelDeloadIcs(deload: boolean, referenceDate = new Date()): string | null {
  if (!deload) return null;
  const d = new Date(referenceDate);
  const dow = (d.getDay() + 6) % 7; // Пн=0
  d.setDate(d.getDate() + (7 - dow));
  const fmt = (x: Date) => x.toISOString().slice(0, 10).replace(/-/g, '');
  const end = new Date(d);
  end.setDate(end.getDate() + 7);
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//intel-hub//deload//RU', 'BEGIN:VEVENT',
    `UID:intel-deload-${fmt(d)}@local`, `DTSTART:${fmt(d)}`, `DTEND:${fmt(end)}`,
    'SUMMARY:Deload-неделя (Интеллект тренировки)', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
}
