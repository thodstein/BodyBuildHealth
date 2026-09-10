/**
 * bb-spec-ics.engine.ts — PRO-3 R7: календарь спец-блока (.ics) + рабочие веса-ориентиры.
 *
 * ICS — тот же паттерн, что SM/TA (`strength-sport-sm-ics`/`ta-ics`): недели → VEVENT
 * понедельниками, экранирование backslash/;/,/переводов. Чистый движок + download-хелпер.
 *
 * Рабочие веса — ОРИЕНТИР, не назначение (у ББ нет помоста): e1RM (по скорости или
 * дневнику) × коридор цели. Коридоры — стандартные ACSM: масса 65–80%, сила 80–90%.
 */

export interface BbSpecWeekLite {
  week: number;
  targetSets: Record<string, number>;
  note: string;
}

function escIcs(s: string): string {
  return String(s ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

function mondayOfWeek(ref: Date, weekIdx: number): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + weekIdx * 7);
  return d;
}

export interface BBSpecIcsOpts {
  startDate?: string; // ISO yyyy-mm-dd — неделя 1 (дефолт сегодня)
  title?: string;
}

export function buildBBSpecIcs(
  spec: { weeks: BbSpecWeekLite[]; weakZones?: string[] } | null | undefined,
  opts: BBSpecIcsOpts = {},
): string | null {
  if (!spec || !Array.isArray(spec.weeks) || spec.weeks.length === 0) return null;
  let ref = new Date();
  if (opts.startDate && /^\d{4}-\d{2}-\d{2}$/.test(opts.startDate)) {
    const p = opts.startDate.split('-').map(Number);
    const cand = new Date(p[0], p[1] - 1, p[2]);
    if (Number.isFinite(cand.getTime())) ref = cand;
  }
  const title = opts.title || 'ББ спец-блок';
  const stamp = toDateStr(new Date());
  const events = spec.weeks.map((w) => {
    const dt = toDateStr(mondayOfWeek(ref, w.week - 1));
    const sets = Object.entries(w.targetSets || {})
      .map(([k, v]) => `${k} ${v}`)
      .join(', ');
    const summary = escIcs(`${title}: нед ${w.week} — ${sets || 'баланс'}`);
    const desc = escIcs(`${w.note || ''}\nЦели: ${(spec.weakZones || []).join(', ') || '—'}`);
    return ['BEGIN:VEVENT', `UID:bb-spec-w${w.week}-${stamp}@bodybuildhealth`, `DTSTAMP:${stamp}T000000`, `DTSTART;VALUE=DATE:${dt}`, `SUMMARY:${summary}`, `DESCRIPTION:${desc}`, 'END:VEVENT'].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BodyBuildHealth//BB Spec//RU', ...events, 'END:VCALENDAR'].join('\r\n');
}

export function downloadBBSpecIcs(ics: string, filename = 'bb-spec-block.ics'): void {
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

export interface BbWorkingRange {
  low: number;
  high: number;
  text: string;
}

/**
 * Рабочий коридор от e1RM (ориентир для ББ-упражнений, шаг 2.5 кг).
 * Масса 65–80% / сила 80–90% (ACSM). e1RM ≤ 0 — честно null.
 */
export function bbWorkingRange(e1rm: number, goal: 'mass' | 'strength' = 'mass'): BbWorkingRange | null {
  const e = Number(e1rm);
  if (!Number.isFinite(e) || e <= 0) return null;
  const [lo, hi] = goal === 'strength' ? [0.8, 0.9] : [0.65, 0.8];
  const q = (v: number) => Math.round((v / 2.5)) * 2.5;
  const low = q(e * lo);
  const high = q(e * hi);
  return {
    low,
    high,
    text: goal === 'strength'
      ? `Ориентир силы: ${low}–${high} кг (80–90% от e1RM ${e} кг) — вес держит технику, отказ не нужен`
      : `Ориентир массы: ${low}–${high} кг (65–80% от e1RM ${e} кг) — последние повторы тяжёлые, но с запасом`,
  };
}
