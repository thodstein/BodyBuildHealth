/**
 * armlifting-diagnostics.engine.ts — диагностика армлифтинга (PRO-3 W-AL).
 * Отдельный дом снарядов: раньше жили гостем в табе «Хват» арм-хаба.
 * Без выдуманных чисел: WR — существующий PLATFORM_WR (`arm-platform`),
 * pinch — внутренний ориентир 15 с, CoC — ordinal + фунт-ориентир IronMind,
 * Excalibur — факт без % (классовая таблица SAR к числу не сводится).
 */
import { platformWrFor, planAttempts } from './arm-platform.engine';

export type ArmliftSex = 'male' | 'female';

export interface ArmliftInput {
  rtKg?: number;
  axleKg?: number;
  axleImpl?: string; // 'saxon' | 'apollon'
  pinchSec?: number;
  cocLevel?: number; // 0 Trainer, 1 №1 140lb, 1.5, 2, 2.5, 3 280lb
  excalKg?: number;
  hubKg?: number;
  sex?: string;
}

export interface ArmliftRow {
  implement: string;
  label: string;
  display: string;
  /** % от WR/ориентира или null (Excalibur — нет числа). */
  scorePct: number | null;
  /** true → внутренний ориентир хаба, не норма федерации. */
  internal: boolean;
  level: 'none' | 'base' | 'comp' | 'elite';
  attempts: number[];
  note: string;
}

export interface ArmliftingReport {
  rows: ArmliftRow[];
  filled: number;
  /** Худший снаряд среди оценённых (куда бить). */
  weakest: string | null;
  /** Среднее % по оценённым снарядам (многоборье). */
  avgPct: number | null;
  totalKg: number;
  verdict: string;
}

const IMPLEMENT_LABEL: Record<string, string> = {
  rolling_thunder: 'Rolling Thunder',
  apollon_axle: 'Apollon Axle',
  saxon_bar: 'Saxon Bar',
  pinch_block: 'Pinch-блок',
  coc_gripper: 'CoC гриппер',
  excalibur: 'Excalibur 50мм',
  hub: 'IronMind Hub',
};

function lvlOf(pct: number | null): ArmliftRow['level'] {
  if (pct == null) return 'none';
  if (pct >= 90) return 'elite';
  if (pct >= 70) return 'comp';
  return 'base';
}

/** CoC-уровень → грубая оценка % от №3 (280lb): ordinal, не калибровка. */
export function cocLevelToPct(level: number): number | null {
  if (!Number.isFinite(level) || level < 0) return null;
  if (level >= 3) return 100;
  if (level >= 2.5) return 85;
  if (level >= 2) return 70;
  if (level >= 1.5) return 60;
  if (level >= 1) return 50;
  if (level > 0) return 36;
  return null;
}

function pctOf(valueKg: number, wrKg: number): number {
  return Math.round((valueKg / wrKg) * 1000) / 10;
}

export function buildArmliftingReport(input: ArmliftInput): ArmliftingReport {
  const sex: ArmliftSex = (input.sex || '').toLowerCase() === 'female' ? 'female' : 'male';
  const rows: ArmliftRow[] = [];
  const num = (v: number | undefined): number | null =>
    v != null && Number.isFinite(v) && v > 0 ? v : null;

  const rt = num(input.rtKg);
  if (rt != null) {
    const wr = platformWrFor('rolling_thunder', sex);
    rows.push({
      implement: 'rolling_thunder', label: IMPLEMENT_LABEL.rolling_thunder,
      display: `${rt} кг`, scorePct: pctOf(rt, wr), internal: false,
      level: lvlOf(pctOf(rt, wr)), attempts: planAttempts(rt),
      note: `WR ${wr} кг`,
    });
  }
  const ax = num(input.axleKg);
  if (ax != null) {
    const apollon = (input.axleImpl || 'saxon') === 'apollon';
    const impl = apollon ? 'apollon_axle' : 'saxon_bar';
    const wr = platformWrFor(impl, sex);
    rows.push({
      implement: impl, label: IMPLEMENT_LABEL[impl],
      display: `${ax} кг`, scorePct: pctOf(ax, wr), internal: !apollon,
      level: lvlOf(pctOf(ax, wr)), attempts: planAttempts(ax),
      note: apollon ? `Apollon WR ${wr} кг` : `Saxon-ориентир ${wr} кг (внутренний)`,
    });
  }
  const pin = num(input.pinchSec);
  if (pin != null) {
    const pct = Math.round((pin / 15) * 1000) / 10;
    rows.push({
      implement: 'pinch_block', label: IMPLEMENT_LABEL.pinch_block,
      display: `${pin} с`, scorePct: pct, internal: true,
      level: lvlOf(pct), attempts: [],
      note: 'норма 15 с (внутренний ориентир)',
    });
  }
  const coc = num(input.cocLevel);
  if (coc != null) {
    const pct = cocLevelToPct(coc);
    rows.push({
      implement: 'coc_gripper', label: IMPLEMENT_LABEL.coc_gripper,
      display: `№${coc}`, scorePct: pct, internal: true,
      level: lvlOf(pct), attempts: [],
      note: 'фунт-рейтинг IronMind — ordinal, не калибровка',
    });
  }
  const hub = num(input.hubKg);
  if (hub != null) {
    const wr = platformWrFor('hub', sex);
    rows.push({
      implement: 'hub', label: IMPLEMENT_LABEL.hub,
      display: `${hub} кг`, scorePct: pctOf(hub, wr), internal: false,
      level: lvlOf(pctOf(hub, wr)), attempts: planAttempts(hub),
      note: `ориентир ${wr} кг`,
    });
  }
  const ex = num(input.excalKg);
  if (ex != null) {
    rows.push({
      implement: 'excalibur', label: IMPLEMENT_LABEL.excalibur,
      display: `${ex} кг`, scorePct: null, internal: false,
      level: 'none', attempts: planAttempts(ex),
      note: 'норматив SAR по весовой (ред. 01.07.2025) — к % не сводится',
    });
  }

  const scored = rows.filter((r) => r.scorePct != null);
  let weakest: string | null = null;
  let avgPct: number | null = null;
  if (scored.length) {
    const w = scored.reduce((a, b) => ((b.scorePct as number) < (a.scorePct as number) ? b : a));
    weakest = w.implement;
    avgPct = Math.round((scored.reduce((s, r) => s + (r.scorePct as number), 0) / scored.length) * 10) / 10;
  }
  const parts: Array<number | null> = [rt, ax, hub, ex];
  const totalKg = Math.round(
    parts.reduce<number>((s, v) => s + (v || 0), 0) * 10,
  ) / 10;
  let verdict: string;
  if (!rows.length) {
    verdict = 'Введи замеры снарядов — посчитаем %WR и слабейший снаряд';
  } else if (weakest) {
    const w = rows.find((r) => r.implement === weakest)!;
    verdict = `Отстаёт: ${w.label} (${w.scorePct}%) — бить его. Многоборье: среднее ${avgPct}% по ${scored.length} сн.`;
  } else {
    verdict = `Только Excalibur (${ex} кг) — добавь RT/Axle/Pinch для %WR`;
  }
  return { rows, filled: rows.length, weakest, avgPct, totalKg, verdict };
}

// ── PRO-3 W5c: экспорт вердикта (HTML/CSV) ──────────────────────────────

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

/** BOM для Excel (явный код, без невидимых литералов — прецедент arm-diagnostics-export). */
const EXCEL_BOM = String.fromCharCode(65279);

export interface ArmliftExportData {
  date: string;
  sex: string;
  report: ArmliftingReport;
}

export function buildArmliftingHtml(data: ArmliftExportData): string {
  const r = data.report;
  const rows = r.rows
    .map(
      (x) =>
        '<tr><td>' +
        esc(x.label) +
        '</td><td>' +
        esc(x.display) +
        '</td><td>' +
        esc(x.scorePct != null ? x.scorePct + '%' : '—') +
        '</td><td>' +
        esc(x.level === 'none' ? 'факт' : x.level) +
        '</td><td>' +
        esc(x.attempts.length ? x.attempts.join('/') : '—') +
        '</td><td>' +
        esc(x.note) +
        '</td></tr>',
    )
    .join('');
  const body = rows || '<tr><td colspan="6">Замеров нет</td></tr>';
  const head =
    '<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Армлифтинг-диагностика ' +
    esc(data.date) +
    '</title><style>body{font-family:system-ui,sans-serif;max-width:960px;margin:0 auto;padding:24px;color:#0f172a}table{border-collapse:collapse;width:100%;font-size:12px}th{background:#0f172a;color:#fff;text-align:left;padding:8px 10px}td{border:1px solid #e2e8f0;padding:7px 10px}.meta{font-size:12px;color:#334155;margin:8px 0}</style></head><body>';
  const meta =
    '<h1>Армлифтинг-диагностика — ' +
    esc(data.date) +
    '</h1><div class="meta">Пол: ' +
    esc(data.sex) +
    ' · снарядов: ' +
    r.filled +
    (r.avgPct != null ? ' · среднее ' + esc(r.avgPct) + '%' : '') +
    ' · тотал ' +
    esc(r.totalKg) +
    ' кг</div><div class="meta"><b>' +
    esc(r.verdict) +
    '</b></div>';
  const foot = '<p class="meta">Скрининг, не диагноз. WR-ориентиры: IronMind/Armlifting USA; pinch/CoC — внутренние ориентиры хаба.</p></body></html>';
  return (
    head +
    meta +
    '<table><thead><tr><th>Снаряд</th><th>Замер</th><th>%WR</th><th>Уровень</th><th>Попытки</th><th>Норма</th></tr></thead><tbody>' +
    body +
    '</tbody></table>' +
    foot
  );
}

export function buildArmliftingCsv(data: ArmliftExportData): string {
  const head = 'implement;label;value;wr_pct;level;attempts';
  const lines = data.report.rows.map((x) =>
    [x.implement, x.label, x.display, x.scorePct ?? '', x.level, x.attempts.join('/')].map(csvCell).join(';'),
  );
  const verdict = '\nverdict;' + csvCell(data.report.verdict);
  return EXCEL_BOM + head + '\n' + lines.join('\n') + '\n' + verdict.replace(/^\n/, '') + '\n';
}
