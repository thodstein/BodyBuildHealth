/**
 * armlift-ics.engine.ts — ROUND-10: календарь спец-блока армлифтинга (.ics).
 * Parity с SM (`buildSMIcs`) и ТА (`buildTAIcs`): недели спец-блока → VEVENT
 * (понедельник недели, DATE — весь день), ICS-экранирование, чистый движок + download-хелпер.
 */
import type { ArmliftSpecWeek } from './armlift-correction.engine';

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
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate(), 12);
  const dow = (d.getDay() + 6) % 7; // Пн=0
  d.setDate(d.getDate() - dow + weekIdx * 7);
  return d;
}

export interface ArmliftIcsOpts {
  startDate?: string; // ISO yyyy-mm-dd — неделя 1 (дефолт сегодня)
  title?: string;
  implement?: string;
}

/**
 * Календарная дата «yyyy-mm-dd» → Date (локальный полдень, без UTC-сдвига).
 * Аудит 2026-10 было→стало: regex `^\d{4}-\d{2}-\d{2}$` пропускал «2026-13-45»,
 * а `new Date(2026, 12, 45)` НЕ даёт Invalid Date — JS молча перекатывает дату
 * в 2027-02-14, и гард `isFinite(getTime())` не срабатывал никогда. Событие
 * спец-блока уезжало в молча сдвинутую дату. Теперь компоненты проверяются.
 */
function parseIsoDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0);
  // защита от 31 февраля и подобного: пересобранная дата должна совпасть
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null;
  return dt;
}

export function buildArmliftIcs(spec: ArmliftSpecWeek[] | null | undefined, opts: ArmliftIcsOpts = {}): string | null {
  if (!Array.isArray(spec) || spec.length === 0) return null;
  let ref = parseIsoDate(opts.startDate || '') || (() => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12); })();
  const title = opts.title || 'Армлифтинг спец-блок';
  const stamp = toDateStr(new Date());
  const events = spec.map((w) => {
    const dt = toDateStr(mondayOfWeek(ref, w.week - 1));
    const sets = Object.entries(w.targetSets)
      .map(([k, v]) => `${k} ${v}×`)
      .join(', ');
    const summary = escIcs(`${title}: нед ${w.week} — ${sets || w.volume || 'техника'}`);
    const desc = escIcs(`${w.target}${opts.implement ? `\nСнаряд: ${opts.implement}` : ''}${w.detail ? `\n${w.detail}` : ''}`);
    return ['BEGIN:VEVENT', `UID:armlift-spec-w${w.week}-${stamp}@bodybuildhealth`, `DTSTAMP:${stamp}T000000`, `DTSTART;VALUE=DATE:${dt}`, `SUMMARY:${summary}`, `DESCRIPTION:${desc}`, 'END:VEVENT'].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BodyBuildHealth//Armlifting Spec//RU', ...events, 'END:VCALENDAR'].join('\r\n');
}

export function downloadArmliftIcs(ics: string, filename = 'armlift-spec-block.ics'): void {
  try {
    const blob = new Blob([ics], { type: 'text/calendar' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  } catch { /* noop */ }
}
