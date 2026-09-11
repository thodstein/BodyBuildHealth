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
  /** PRO-3 P4: red-flags скрининга (метки) — в отчёт тренеру/врачу. */
  redFlags?: string[];
  // TOP wave-10: матчап + Table-IQ + rehab
  matchup?: { note: string; priority?: string[]; gameplan?: string[] } | null;
  tableIq?: { note: string; levers?: string[]; trend?: string } | null;
  rehab?: { note: string; phase?: number; title?: string } | null;
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
  // PRO-3 P4: red-flags — красной секцией (скрининг, не диагноз)
  const redList = (data.redFlags || []).filter((s) => s);
  const redBlock = redList.length
    ? '<h2>Red-flags (стоп-тесты — к врачу)</h2><ul>' + redList.map(li).join('') + '</ul>'
    : '';
  let topBlock = '';
  if (data.matchup) {
    topBlock += '<h2>Матчап</h2><div class="meta">' + esc(data.matchup.note) + '</div>';
    if (data.matchup.priority && data.matchup.priority.length) topBlock += '<div class="meta">Приоритет: ' + esc(data.matchup.priority.join(', ')) + '</div>';
    if (data.matchup.gameplan && data.matchup.gameplan.length) topBlock += '<ul>' + data.matchup.gameplan.map(li).join('') + '</ul>';
  }
  if (data.tableIq) {
    topBlock += '<h2>Table-IQ</h2><div class="meta">' + esc(data.tableIq.note) + '</div>';
    if (data.tableIq.trend) topBlock += '<div class="meta">' + esc(data.tableIq.trend) + '</div>';
    if (data.tableIq.levers && data.tableIq.levers.length) topBlock += '<ul>' + data.tableIq.levers.map(li).join('') + '</ul>';
  }
  if (data.rehab) {
    topBlock += '<h2>Return-to-pull</h2><div class="meta">' + esc(data.rehab.note) + '</div>';
  }
  const head = '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Арм-диагностика ' + esc(data.date) + '</title><style>body{font-family:system-ui,-apple-system,sans-serif;max-width:960px;margin:0 auto;padding:24px;color:#0f172a;background:#fff}h1{font-size:22px;letter-spacing:-.5px;margin:0}h2{font-size:14px;margin:18px 0 8px;padding-bottom:6px;border-bottom:2px solid #f59e0b}table{border-collapse:collapse;width:100%;font-size:12px}thead th{background:#0f172a;color:#fff;text-align:left;padding:8px 10px}thead th:first-child{border-radius:8px 0 0 0}thead th:last-child{border-radius:0 8px 0 0}td{border:1px solid #e2e8f0;padding:7px 10px;vertical-align:top}tbody tr:nth-child(even){background:#f8fafc}.meta{font-size:12px;color:#334155;margin:8px 0;line-height:1.7}.hero{background:linear-gradient(135deg,#fffbeb,#fef3c7);border:1px solid #fde68a;border-radius:12px;padding:14px 16px;margin-bottom:8px}.chips{display:flex;gap:6px;flex-wrap:wrap;margin:10px 0}.chips span{font-size:11px;font-weight:700;background:#f1f5f9;border:1px solid #e2e8f0;border-radius:999px;padding:3px 10px;color:#334155}.card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:12px 14px;margin:10px 0}.crit{color:#b00;font-weight:bold}ul{font-size:12px;color:#334155;line-height:1.7}.hero h1{letter-spacing:-.5px}.card{box-shadow:0 1px 3px rgba(15,23,42,.08)}table tbody tr:hover{background:#eef2ff}td.num{white-space:nowrap;font-variant-numeric:tabular-nums}@page{margin:12mm}::selection{background:#fde68a}@media print{body{padding:10px}.card,.hero{break-inside:avoid}}</style></head><body>';
  const foot = '<p class="meta">' + esc(data.disclaimer || 'Скрининг, не диагноз. Боль/онемение/щелчок — к врачу.') + '</p></body></html>';
  return head + '<div class="hero"><h1>Арм-диагностика — ' + esc(data.date) + '</h1><div class="meta">' + meta + '</div></div>' + tactic + redBlock + floorBlock + '<h2>Мёртвые точки (' + data.points.length + ')</h2><table><thead><tr><th>Точка</th><th>Карточка</th><th>Угол</th><th>Причина</th><th>Фикс</th><th>Топ-3</th><th>Дельта</th></tr></thead><tbody>' + body + '</tbody></table>' + injectBlock + topBlock + foot;
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
  let extra = '';
  // PRO-3 P4: red-flags строкой (скрининг)
  if (data.redFlags && data.redFlags.length) extra += '\nredflags;' + csvCell(data.redFlags.join(', '));
  if (data.matchup) extra += '\nmatchup;' + csvCell(data.matchup.note);
  if (data.tableIq) extra += '\ntableiq;' + csvCell(data.tableIq.note + (data.tableIq.trend ? ' ' + data.tableIq.trend : ''));
  if (data.rehab) extra += '\nrehab;' + csvCell(data.rehab.note);
  return EXCEL_BOM + head + '\n' + lines.join('\n') + '\n' + (extra ? extra.replace(/^\n/, '') + '\n' : '');
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
