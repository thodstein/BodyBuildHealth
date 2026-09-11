/**
 * armlifting-diagnostics.engine.ts — диагностика армлифтинга (PRO-3 W-AL + PRO-4).
 * Отдельный дом снарядов: раньше жили гостем в табе «Хват» арм-хаба.
 * PRO-4: честные WR (A1), pinch кг+сек (A2), Silver Bullet (A3), L/R (A7),
 * новые снаряды фактом без % (A6), раздельный avg (A9), тренд/рецепт (A10).
 * Без выдуманных чисел: WR — существующий PLATFORM_WR (`arm-platform`, сверен с IronMind:
 * RT Тюкалов 130.5/2013, Apollon Майерско 237.5/Гайдученко 137.9, Hub Толонен 44.80/Кулагина 28.51),
 * pinch-сек/CoC/Silver — внутренние ориентиры, несверенные снаряды — факт без %.
 */
import { platformWrFor, planAttempts } from './arm-platform.engine';

export type ArmliftSex = 'male' | 'female';

export interface ArmliftInput {
  rtKg?: number;
  /** PRO-4 A7: по-рукам (приоритетнее общего rtKg). */
  rtL?: number;
  rtR?: number;
  axleKg?: number;
  axleImpl?: string; // 'saxon' | 'apollon'
  pinchSec?: number;
  /** PRO-4 A2: силовой щипок в кг (турнирный), отдельно от удержания. */
  pinchKg?: number;
  cocLevel?: number; // 0 Trainer, 1 №1 140lb, 1.5, 2, 2.5, 3 280lb
  /** PRO-4 A3: удержание Silver Bullet (с) + гриппер. */
  silverSec?: number;
  silverGripper?: string; // '2' | '3' | '4'
  excalKg?: number;
  hubKg?: number;
  /** PRO-4 A7: хаб по-рукам. */
  hubL?: number;
  hubR?: number;
  /** PRO-4 A6: хиты 2025–2026 — факт без % до сверки с лидербордами. */
  raptorKg?: number;
  crushKg?: number;
  clockKg?: number;
  anvilKg?: number;
  saxonMedleyKg?: number;
  sex?: string;
}

export interface ArmliftRow {
  implement: string;
  label: string;
  display: string;
  /** % от WR/ориентира или null (Excalibur/несверенные/Silver — нет числа). */
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
  /** Худший снаряд среди ВСЕХ оценённых (совместимость; включает ориентиры). */
  weakest: string | null;
  /** PRO-4 A9: худший среди %WR (без ориентиров). */
  weakestWr: string | null;
  /** Среднее % по оценённым снарядам (legacy: все scored; = avgWr+internal вперемешку). */
  avgPct: number | null;
  /** PRO-4 A9: среднее только по %WR (без ориентиров). */
  avgWrPct: number | null;
  /** PRO-4 A9: среднее только по внутренним ориентирам. */
  avgInternalPct: number | null;
  /** PRO-4 A7: асимметрия RT/Hub в % (|R−L|/max), null — нет пары. */
  rtAsymPct: number | null;
  hubAsymPct: number | null;
  totalKg: number;
  verdict: string;
  /** PRO-4 A10: рецепт по слабейшему (строки CoC FAQ / pinch-протокола, без новой математики). */
  prescription: string;
}

const IMPLEMENT_LABEL: Record<string, string> = {
  rolling_thunder: 'Rolling Thunder',
  rolling_thunder_L: 'RT левая',
  rolling_thunder_R: 'RT правая',
  apollon_axle: 'Apollon Axle',
  saxon_bar: 'Saxon Bar',
  pinch_block: 'Pinch-блок кг',
  pinch_hold: 'Pinch-удержание',
  coc_gripper: 'CoC гриппер',
  silver_bullet: 'Silver Bullet',
  excalibur: 'Excalibur 50мм',
  hub: 'IronMind Hub',
  hub_L: 'Hub левая',
  hub_R: 'Hub правая',
  raptor_175: 'Raptor 1.75"',
  country_crush: 'Country Crush 2"',
  grandfather_clock: 'Grandfather Clock',
  anvil: 'Anvil (SSE)',
  saxon_medley: 'Saxon 2×5 medley',
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

/**
 * Опорные времена Silver Bullet (добивка PRO-4, IronMind/APL, не нормативы):
 * М №3 ~55.6с Суховаров 2017, М №4 ~7.2с Суховаров 2017, Ж №2 ~45.4с Уоттлз 2014.
 */
export function silverRefNote(gripper: string): string {
  const g = String(gripper || '3');
  if (g === '4') return 'опорное время М №4 ~7.2с (Суховаров 2017) — личный рекорд и лидерборд';
  if (g === '2') return 'опорное время Ж №2 ~45.4с (Уоттлз 2014) — личный рекорд и лидерборд';
  return 'опорное время М №3 ~55.6с (Суховаров 2017) — личный рекорд и лидерборд';
}

function asymPct(l: number | null, r: number | null): number | null {
  if (l == null || r == null) return null;
  const m = Math.max(l, r);
  if (!(m > 0)) return null;
  return Math.round((Math.abs(r - l) / m) * 1000) / 10;
}

/** PRO-4 A10: рецепт по слабейшему снаряду (только строки, без математики). */
export function prescriptionForWeakest(weakest: string | null): string {
  if (!weakest) return '';
  if (weakest.startsWith('rolling_thunder') || weakest === 'apollon_axle') {
    return 'Support отстаёт: толстый гриф/RT-объём первым в неделе, crush и pinch после (приоритет IronMind).';
  }
  if (weakest === 'saxon_bar' || weakest === 'pinch_block' || weakest === 'pinch_hold'
    || weakest === 'hub' || weakest.startsWith('hub_')
    || weakest === 'raptor_175' || weakest === 'country_crush'
    || weakest === 'grandfather_clock' || weakest === 'anvil' || weakest === 'saxon_medley') {
    return 'Pinch отстаёт: plate pinch 3×20–30 с, 2–3×/нед, шаг +2.5–5% в 1–2 нед (ожидание +15–30% за 8–12 нед).';
  }
  if (weakest === 'coc_gripper' || weakest === 'silver_bullet') {
    return 'Crush отстаёт: warm 10–12 → work 5–7 до отказа 1–3 сета → challenge частички/негативы/холды, 2–3×/нед (CoC FAQ).';
  }
  if (weakest === 'excalibur') {
    return 'Excalibur — факт без %: сверься с классовой таблицей SAR своей весовой, добивка support+pinch.';
  }
  return '';
}

/** PRO-4 A8: чек-лист «замер по правилам» (5 чеков IronMind). */
export function assessLiftRules(checks: Array<boolean | undefined>): { official: boolean; note: string } {
  const arr = Array.isArray(checks) ? checks.slice(0, 5) : [];
  while (arr.length < 5) arr.push(undefined);
  if (arr.some((c) => c === false)) {
    return { official: false, note: 'замер тренировочный, не зачётный (есть «нет» в чек-листе правил)' };
  }
  if (arr.every((c) => c === true)) {
    return { official: true, note: 'замер по правилам (оригинал, DOH, без лямок/hook, мел+протирка, калибровка)' };
  }
  return { official: false, note: 'чек-лист правил не заполнен — замер тренировочный' };
}

export interface LiftTrendPoint {
  implement: string;
  deltaKg: number;
  deltaPct: number;
  firstKg: number;
  lastKg: number;
  n: number;
}

/** PRO-4 A10: тренд по журналу (первые ≤3 успеха vs последние ≤3). Чистая функция. */
export function liftTrendFromLog(
  log: Array<{ implement?: string; weightKg?: number; success?: boolean }>,
): LiftTrendPoint[] {
  const by: Record<string, number[]> = {};
  for (const e of log || []) {
    if (!e || e.success !== true) continue;
    const w = Number(e.weightKg);
    if (!Number.isFinite(w) || w <= 0) continue;
    const k = String(e.implement || 'rolling_thunder');
    (by[k] ||= []).push(w);
  }
  const out: LiftTrendPoint[] = [];
  for (const [implement, arr] of Object.entries(by)) {
    if (arr.length < 2) continue;
    const head = arr.slice(0, 3);
    const tail = arr.slice(-3);
    const first = head.reduce((s, v) => s + v, 0) / head.length;
    const last = tail.reduce((s, v) => s + v, 0) / tail.length;
    const deltaKg = Math.round((last - first) * 10) / 10;
    const deltaPct = first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : 0;
    out.push({ implement, deltaKg, deltaPct, firstKg: Math.round(first * 10) / 10, lastKg: Math.round(last * 10) / 10, n: arr.length });
  }
  return out;
}

export function buildArmliftingReport(input: ArmliftInput): ArmliftingReport {
  const sex: ArmliftSex = (input.sex || '').toLowerCase() === 'female' ? 'female' : 'male';
  const rows: ArmliftRow[] = [];
  const num = (v: number | undefined): number | null =>
    v != null && Number.isFinite(v) && v > 0 ? v : null;

  // RT: по-рукам приоритетнее общего (A7)
  const rtL = num(input.rtL);
  const rtR = num(input.rtR);
  const rtAsymPct = asymPct(rtL, rtR);
  if (rtL != null || rtR != null) {
    const wr = platformWrFor('rolling_thunder', sex);
    const push = (v: number | null, impl: string) => {
      if (v == null) return;
      const p = pctOf(v, wr);
      rows.push({
        implement: impl, label: IMPLEMENT_LABEL[impl] || impl,
        display: `${v} кг`, scorePct: p, internal: false,
        level: lvlOf(p), attempts: planAttempts(v),
        note: `WR ${wr} кг (Тюкалов 130.5, 2013)`,
      });
    };
    push(rtL, 'rolling_thunder_L');
    push(rtR, 'rolling_thunder_R');
  } else {
    const rt = num(input.rtKg);
    if (rt != null) {
      const wr = platformWrFor('rolling_thunder', sex);
      const p = pctOf(rt, wr);
      rows.push({
        implement: 'rolling_thunder', label: IMPLEMENT_LABEL.rolling_thunder,
        display: `${rt} кг`, scorePct: p, internal: false,
        level: lvlOf(p), attempts: planAttempts(rt),
        note: `WR ${wr} кг`,
      });
    }
  }
  const ax = num(input.axleKg);
  if (ax != null) {
    const apollon = (input.axleImpl || 'saxon') === 'apollon';
    const impl = apollon ? 'apollon_axle' : 'saxon_bar';
    const wr = platformWrFor(impl, sex);
    const p = pctOf(ax, wr);
    rows.push({
      implement: impl, label: IMPLEMENT_LABEL[impl],
      display: `${ax} кг`, scorePct: p, internal: !apollon,
      level: lvlOf(p), attempts: planAttempts(ax),
      note: apollon
        ? `Apollon WR ${wr} кг (М Майерско 237.5, 2022 / Ж Гайдученко 137.9, 2019)`
        : `Saxon-ориентир ${wr} кг (внутренний, сверяется с Saxon 3×4 лидербордом)`,
    });
  }
  // Pinch кг отдельно от удержания (A2 + добивка: единого WR нет —
  // рекорды зависят от ширины/1H-2H/федерации, Gods of Grip 2024–2025,
  // поэтому 80/45 — внутренний ориентир, в avgWR не входит)
  const pinchKg = num(input.pinchKg);
  if (pinchKg != null) {
    const wr = platformWrFor('pinch_block', sex);
    const p = pctOf(pinchKg, wr);
    rows.push({
      implement: 'pinch_block', label: IMPLEMENT_LABEL.pinch_block,
      display: `${pinchKg} кг`, scorePct: p, internal: true,
      level: lvlOf(p), attempts: planAttempts(pinchKg),
      note: `внутренний ориентир ${wr} кг (единого WR нет — ширина/1H-2H/федерация)`,
    });
  }
  const pin = num(input.pinchSec);
  if (pin != null) {
    const pct = Math.round((pin / 15) * 1000) / 10;
    rows.push({
      implement: 'pinch_hold', label: IMPLEMENT_LABEL.pinch_hold,
      display: `${pin} с`, scorePct: pct, internal: true,
      level: lvlOf(pct), attempts: [],
      note: 'норма 15 с (внутренний ориентир, в avgWR не входит)',
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
  // Silver Bullet — время отдельно (A3 + добивка: опорные времена IronMoney/APL)
  const sil = num(input.silverSec);
  if (sil != null) {
    const grip = String(input.silverGripper || '3');
    rows.push({
      implement: 'silver_bullet', label: IMPLEMENT_LABEL.silver_bullet,
      display: `${sil} с (№${grip})`, scorePct: null, internal: true,
      level: 'none', attempts: [],
      note: `Silver Bullet: ${silverRefNote(grip)}`,
    });
  }
  // Hub: по-рукам приоритетнее (A7)
  const hubL = num(input.hubL);
  const hubR = num(input.hubR);
  const hubAsymPct = asymPct(hubL, hubR);
  if (hubL != null || hubR != null) {
    const wr = platformWrFor('hub', sex);
    const push = (v: number | null, impl: string) => {
      if (v == null) return;
      const p = pctOf(v, wr);
      rows.push({
        implement: impl, label: IMPLEMENT_LABEL[impl] || impl,
        display: `${v} кг`, scorePct: p, internal: false,
        level: lvlOf(p), attempts: planAttempts(v),
        note: `Hub WR ${wr} кг (М Толонен 44.80, 2019 / Ж Кулагина 28.51, 2021)`,
      });
    };
    push(hubL, 'hub_L');
    push(hubR, 'hub_R');
  } else {
    const hub = num(input.hubKg);
    if (hub != null) {
      const wr = platformWrFor('hub', sex);
      const p = pctOf(hub, wr);
      rows.push({
        implement: 'hub', label: IMPLEMENT_LABEL.hub,
        display: `${hub} кг`, scorePct: p, internal: false,
        level: lvlOf(p), attempts: planAttempts(hub),
        note: `Hub WR ${wr} кг (М Толонен 44.80, 2019 / Ж Кулагина 28.51, 2021)`,
      });
    }
  }
  const ex = num(input.excalKg);
  if (ex != null) {
    rows.push({
      implement: 'excalibur', label: IMPLEMENT_LABEL.excalibur,
      display: `${ex} кг`, scorePct: null, internal: false,
      level: 'none', attempts: planAttempts(ex),
      note: 'открытый класс ЧМ APL 2017: М125/Ж83; норматив SAR по весовой (ред. 01.07.2025) — к % не сводится',
    });
  }
  // PRO-4 A6: новые снаряды — факт без % (честно, без выдуманных WR)
  const factNoPct = (
    v: number | null, impl: string, note: string,
  ) => {
    if (v == null) return;
    rows.push({
      implement: impl, label: IMPLEMENT_LABEL[impl] || impl,
      display: `${v} кг`, scorePct: null, internal: false,
      level: 'none', attempts: planAttempts(v), note,
    });
  };
  factNoPct(num(input.raptorKg), 'raptor_175', 'Raptor 1.75": лидерборд Armlifting USA — к % не сводим (факт)');
  factNoPct(num(input.crushKg), 'country_crush', 'Country Crush 2": лидерборд Armlifting USA — к % не сводим (факт)');
  factNoPct(num(input.clockKg), 'grandfather_clock', 'Grandfather Clock: лидерборд Armlifting USA — к % не сводим (факт)');
  factNoPct(num(input.anvilKg), 'anvil', 'Anvil SSE: лидерборд Armlifting USA — к % не сводим (факт)');
  factNoPct(num(input.saxonMedleyKg), 'saxon_medley', 'Saxon 2×5 medley: лидерборд Armlifting USA — к % не сводим (факт)');

  const scored = rows.filter((r) => r.scorePct != null);
  const wrScored = scored.filter((r) => !r.internal);
  const intScored = scored.filter((r) => r.internal);
  const avg = (arr: ArmliftRow[]): number | null =>
    arr.length ? Math.round((arr.reduce((s, r) => s + (r.scorePct as number), 0) / arr.length) * 10) / 10 : null;
  let weakest: string | null = null;
  let weakestWr: string | null = null;
  let avgPct: number | null = null;
  let avgWrPct: number | null = null;
  let avgInternalPct: number | null = null;
  if (scored.length) {
    const w = scored.reduce((a, b) => ((b.scorePct as number) < (a.scorePct as number) ? b : a));
    weakest = w.implement;
    avgPct = avg(scored);
  }
  if (wrScored.length) {
    const w = wrScored.reduce((a, b) => ((b.scorePct as number) < (a.scorePct as number) ? b : a));
    weakestWr = w.implement;
    avgWrPct = avg(wrScored);
  }
  avgInternalPct = avg(intScored);
  // PRO-4 A9: тотал — только кг одной природы (секунды/CoC-уровни не суммируем)
  const kgParts: Array<number | null> = [
    rtL, rtR, num(input.rtKg), ax, pinchKg, hubL, hubR, num(input.hubKg), ex,
    num(input.raptorKg), num(input.crushKg), num(input.clockKg), num(input.anvilKg), num(input.saxonMedleyKg),
  ];
  const totalKg = Math.round(
    kgParts.reduce<number>((s, v) => s + (v || 0), 0) * 10,
  ) / 10;
  const prescription = prescriptionForWeakest(weakestWr || weakest);
  let verdict: string;
  if (!rows.length) {
    verdict = 'Введи замеры снарядов — посчитаем %WR и слабейший снаряд';
  } else if (weakest) {
    const w = rows.find((r) => r.implement === weakest)!;
    const wrPart = avgWrPct != null ? ` · WR-среднее ${avgWrPct}% по ${wrScored.length} сн.` : '';
    const intPart = avgInternalPct != null ? ` · ориентиры ${avgInternalPct}%` : '';
    const asymPart = rtAsymPct != null ? ` · RT-асимметрия ${rtAsymPct}%` : '';
    verdict = `Отстаёт: ${w.label} (${w.scorePct}%) — бить его. Многоборье: среднее ${avgPct}% по ${scored.length} сн.${wrPart}${intPart}${asymPart}`;
  } else {
    verdict = `Только факты без % (${rows.map((r) => r.label).join(', ')}) — добавь RT/Hub/Pinch-кг для %WR`;
  }
  return { rows, filled: rows.length, weakest, weakestWr, avgPct, avgWrPct, avgInternalPct, rtAsymPct, hubAsymPct, totalKg, verdict, prescription };
}

// ── PRO-3 W5c + PRO-4: экспорт вердикта (HTML/CSV) ─────────────────────────

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
  /** PRO-4: лесенка last-man-standing по слабейшему кг-снаряду (опционально). */
  lmsAttempts?: number[];
  lmsLabel?: string;
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
  const avgLine =
    (r.avgWrPct != null ? ' · WR-среднее ' + esc(r.avgWrPct) + '%' : '') +
    (r.avgInternalPct != null ? ' · ориентиры ' + esc(r.avgInternalPct) + '%' : '');
  const meta =
    '<h1>Армлифтинг-диагностика — ' +
    esc(data.date) +
    '</h1><div class="meta">Пол: ' +
    esc(data.sex) +
    ' · снарядов: ' +
    r.filled +
    (r.avgPct != null ? ' · среднее ' + esc(r.avgPct) + '%' : '') +
    avgLine +
    ' · тотал ' +
    esc(r.totalKg) +
    ' кг</div><div class="meta"><b>' +
    esc(r.verdict) +
    '</b></div>' +
    (r.prescription ? '<div class="meta">Рецепт: ' + esc(r.prescription) + '</div>' : '') +
    (data.lmsAttempts && data.lmsAttempts.length
      ? '<div class="meta">Last-man-standing' +
        (data.lmsLabel ? ' (' + esc(data.lmsLabel) + ')' : '') +
        ': ' + esc(data.lmsAttempts.join(' → ')) + ' (промах = выбыл, вниз нельзя)</div>'
      : '');
  const foot = '<p class="meta">Скрининг, не диагноз. WR-ориентиры: IronMind/Armlifting USA; pinch-сек/CoC/Silver — внутренние ориентиры хаба; несверенные снаряды — факт без %.</p></body></html>';
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
  const verdict = 'verdict;' + csvCell(data.report.verdict);
  const recipe = data.report.prescription ? '\nprescription;' + csvCell(data.report.prescription) : '';
  const lms = data.lmsAttempts && data.lmsAttempts.length
    ? '\nlast_man_standing;' + csvCell(data.lmsAttempts.join('>'))
    : '';
  return EXCEL_BOM + head + '\n' + lines.join('\n') + '\n' + verdict + recipe + lms + '\n';
}
