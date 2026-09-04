/**
 * strength-sport-ta-ics.engine.ts — КАЛЕНДАРЬ СПЕЦ-БЛОКА ТА (.ics) (E15 PRO-v2)
 *
 * Недели спец-блока → события VEVENT (понедельник недели, длительность 60мин-заглушка
 * весь день — используем DATE, не DATETIME, чтобы не врать про время тренировки).
 * Экранирование ICS: backslash, точка с запятой, запятая, переводы строк.
 * Чистый движок + download-хелпер (try/catch).
 */

import type { TASpecBlock } from './strength-sport-ta-spec-block.engine';

function escIcs(s: string): string {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

function mondayOfWeek(ref: Date, weekIdx: number): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const dow = (d.getDay() + 6) % 7; // Пн=0
  d.setDate(d.getDate() - dow + weekIdx * 7);
  return d;
}

export interface TAIcsOpts {
  startDate?: string; // ISO yyyy-mm-dd — неделя 1 (дефолт сегодня)
  title?: string;
}

export function buildTAIcs(spec: TASpecBlock | null | undefined, opts: TAIcsOpts = {}): string | null {
  if (!spec || !Array.isArray(spec.weeks) || spec.weeks.length === 0) return null;
  let ref = new Date();
  if (opts.startDate && /^\d{4}-\d{2}-\d{2}$/.test(opts.startDate)) {
    const p = opts.startDate.split('-').map(Number);
    ref = new Date(p[0], p[1] - 1, p[2]);
    if (!Number.isFinite(ref.getTime())) ref = new Date();
  }
  const title = opts.title || 'ТА спец-блок';
  const stamp = toDateStr(new Date());
  const events = spec.weeks.map((w, i) => {
    const dt = toDateStr(mondayOfWeek(ref, i));
    const sets = Object.entries(w.targetSets).map(([k, v]) => `${k} ${v}×5`).join(', ');
    const summary = escIcs(`${title}: нед ${w.week} — ${sets || 'техника'}`);
    const desc = escIcs(`${w.note}\nФазы: ${spec.weakPoints.join(', ') || '—'}`);
    return ['BEGIN:VEVENT', `UID:ta-spec-w${w.week}-${stamp}@bodybuildhealth`, `DTSTAMP:${stamp}T000000`, `DTSTART;VALUE=DATE:${dt}`, `SUMMARY:${summary}`, `DESCRIPTION:${desc}`, 'END:VEVENT'].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BodyBuildHealth//TA Spec//RU', ...events, 'END:VCALENDAR'].join('\r\n');
}

export function downloadTAIcs(ics: string, filename = 'ta-spec-block.ics'): void {
  try {
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch { /* noop */ }
}
