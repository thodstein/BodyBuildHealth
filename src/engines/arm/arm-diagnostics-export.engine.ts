/**
 * arm-diagnostics-export.engine.ts — экспорт арм-диагностики (E14 P2).
 * Parity: bb `bb-diagnostics-export` (HTML+CSV, XSS-esc, BOM для Excel).
 * Чистые функции + downloadArmFile (Blob+a.click, browser-only с try/catch).
 * Стиль: плоская конкатенация строк, без вложенных шаблонных литералов.
 */

export interface ArmExportPoint {
  weakPoint: string;
  label: string;
  angleRangeDeg?: [number, number];
  keyJoint?: string;
  cause?: string;
  causeFix?: string;
  topCorrections?: Array<{ id: string; score: number }>;
  simDelta?: string;
  specSetsWeek1?: number;
}

export interface ArmExportData {
  date: string;
  level: string;
  technique: string;
  score?: number | null;
  scoreLevel?: string | null;
  verificationPct?: number | null;
  floors?: string[];
  asymmetryPct?: number | null;
  forceTotal?: number | null;
  dynamicTactic?: string | null;
  acwr?: number | null;
  tendonAcwr?: number | null;
  points: ArmExportPoint[];
  injectionNotes?: string[];
  disclaimer?: string;
}

function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function csvCell(s: unknown): string {
  const v = String(s ?? '');
  return /[",\n;]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}

function td(s: unknown): string {
  const v = s == null || s === '' ? '—' : String(s);
  return '<td>' + esc(v) + '</td>';
}

function li(s: unknown): string {
  return '<li>' + esc(s) + '</li>';
}

function pointRow(p: ArmExportPoint): string {
  const angle = p.angleRangeDeg
    ? p.angleRangeDeg[0] + '-' + p.angleRangeDeg[1] + ' deg ' + (p.keyJoint || '')
    : 'угол н/п';
  const tops = (p.topCorrections || [])
    .map(function (t) { return t.id + ' (' + t.score + ')'; })
    .join(', ');
  return '<tr>' + td(p.weakPoint) + td(p.label) + td(angle) + td(p.cause) + td(p.causeFix) + td(tops) + td(p.simDelta) + '</tr>';
}

export function buildArmDiagnosticsHtml(data: ArmExportData): string {
  const rows = data.points.map(pointRow).join('');
  const floors = (data.floors || []).map(li).join('');
  const notes = (data.injectionNotes || []).map(li).join('');
  let meta = 'Уровень ' + esc(data.level) + ' · техника ' + esc(data.technique);
  if (data.score != null) {
    meta += ' · RSS ' + esc(data.score) + ' (' + esc(data.scoreLevel || '') + ', v' + esc(data.verificationPct ?? 0) + '%)';
  }
  if (data.asymmetryPct != null) meta += ' · асимметрия ' + esc(data.asymmetryPct) + '%';
  if (data.forceTotal != null) meta += ' · force ' + esc(data.forceTotal);
  if (data.acwr != null) meta += ' · ACWR ' + esc(data.acwr);
  if (data.tendonAcwr != null) meta += ' · tendon ACWR ' + esc(data.tendonAcwr);
  const tactic = data.dynamicTactic ? '<div class="meta">Тактика: ' + esc(data.dynamicTactic) + '</div>' : '';
  const floorBlock = floors ? '<div class="crit">Floors:</div><ul>' + floors + '</ul>' : '';
  const body = rows || '<tr><td colspan="7">Точек нет — баланс</td></tr>';
  const injectBlock = notes ? '<h2>Инъекция</h2><ul>' + notes + '</ul>' : '';
  const head = '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Арм-диагностика ' + esc(data.date) + '</title><style>body{font-family:sans-serif;max-width:900px;margin:0 auto;padding:16px;color:#111}table{border-collapse:collapse;width:100%;font-size:12px}td,th{border:1px solid #999;padding:4px 6px;text-align:left}.meta{font-size:12px;color:#333;margin:8px 0}.crit{color:#b00;font-weight:bold}</style></head><body>';
  const foot = '<p class="meta">' + esc(data.disclaimer || 'Скрининг, не диагноз. Боль/онемение/щелчок — к врачу.') + '</p></body></html>';
  return head + '<h1>Арм-диагностика — ' + esc(data.date) + '</h1><div class="meta">' + meta + '</div>' + tactic + floorBlock + '<h2>Мёртвые точки (' + data.points.length + ')</h2><table><tr><th>Точка</th><th>Карточка</th><th>Угол</th><th>Причина</th><th>Фикс</th><th>Топ-3</th><th>Дельта</th></tr>' + body + '</table>' + injectBlock + foot;
}

export function buildArmDiagnosticsCsv(data: ArmExportData): string {
  const head = 'weak_point;label;angle;cause;fix;top3;delta';
  const lines = data.points.map(function (p) {
    const angle = p.angleRangeDeg ? p.angleRangeDeg[0] + '-' + p.angleRangeDeg[1] + ' ' + (p.keyJoint || '') : 'n/a';
    const tops = (p.topCorrections || [])
      .map(function (t) { return t.id + '(' + t.score + ')'; })
      .join(', ');
    return [p.weakPoint, p.label, angle, p.cause || '', p.causeFix || '', tops, p.simDelta || '']
      .map(csvCell)
      .join(';');
  });
  return EXCEL_BOM + head + '\n' + lines.join('\n') + '\n';
}

/** BOM для Excel (явный код, без невидимых литералов). */
const EXCEL_BOM = String.fromCharCode(65279);

export function downloadArmFile(filename: string, content: string, mime: string): void {
  try {
    const blob = new Blob([content], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      try {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch { /* noop */ }
    }, 500);
  } catch { /* noop */ }
}
