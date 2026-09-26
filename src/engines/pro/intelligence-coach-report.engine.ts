/**
 * intelligence-coach-report.engine.ts — E8: отчёт тренеру по хабу Интеллекта.
 *
 * Три независимые части (чистые функции + локальный журнал решений):
 *  1) `weeklyRollup`   — неделя vs предыдущая по ФАКТУ (нагрузка, монотонность, зоны,
 *                       готовность, авторегуляция, CMJ, wellness). Нет данных — нет строки,
 *                       а не «0» и не «среднее за 0 дней».
 *  2) `IntelDecision`  — журнал «применено/отклонено» (`he_intelligence_history_v1`),
 *                       нужен тренеру: за неделю видно, что следовало сделать и что решили не делать.
 *  3) `buildCoachReportHtml/Csv` — экспорт ВСЕХ 5 секций хаба + roll-up + чек-лист решений.
 *
 * Границы честности:
 *  - ACWR — эвристика мониторинга, не предсказание травмы.
 *  - Wellness/CMJ — сигналы, НЕ диагнозы (Meeusen 2013).
 *  - Внешняя нагрузка (GPS/IMU) в контуре отсутствует — в отчёте так и написано.
 */
import { ACWR_ZONE_META, acuteChronicRatio, type DayLoad } from './training-load.engine';
import { cmjScreen, type CmjEntry } from './intelligence-cmj.engine';
import { wellnessReport, type WellnessEntry } from './intelligence-wellness.engine';
import { csvCell } from './intelligence-export.engine';

// ── 1. ЛОКАЛЬНЫЕ ДАТЫ (UTC → «вчера» недопустим) ────────────────────────────
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
  t.setDate(t.getDate() + n);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ── 2. ЖУРНАЛ РЕШЕНИЙ (E8: «применено / отклонено») ─────────────────────────
export type IntelDecisionKind = 'pri' | 'deload' | 'declined' | 'accepted' | 'note';
export interface IntelDecision {
  date: string;              // YYYY-MM-DD (локальная)
  kind: IntelDecisionKind;   // что именно: коррекция объёма, deload, отказ, ручная отметка
  applied: boolean;          // false = решение принято «не применять»
  label: string;             // короткое human-readable
  detail?: string;           // объём ×множитель / RIR / причина отказа
}

const HISTORY_KEY = 'he_intelligence_history_v1';
const MAX_DECISIONS = 60;

function sanitizeDecision(raw: any): IntelDecision | null {
  if (!raw) return null;
  const date = String(raw.date ?? '');
  if (!DATE_RE.test(date)) return null;
  const kind = raw.kind as IntelDecisionKind;
  if (kind !== 'pri' && kind !== 'deload' && kind !== 'declined' && kind !== 'accepted' && kind !== 'note') return null;
  const label = String(raw.label ?? '').slice(0, 200).trim();
  if (!label) return null;
  return {
    date, kind, applied: raw.applied !== false,
    label,
    detail: raw.detail == null ? undefined : String(raw.detail).slice(0, 300),
  };
}

export function loadIntelHistory(): IntelDecision[] {
  try {
    const raw = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return raw.map(sanitizeDecision).filter((d): d is IntelDecision => d != null);
  } catch { return []; }
}

export function saveIntelDecision(d: IntelDecision): IntelDecision[] {
  const clean = sanitizeDecision(d);
  if (!clean) return loadIntelHistory();
  const prev = loadIntelHistory().filter(x => !(x.date === clean.date && x.kind === clean.kind && x.label === clean.label));
  const merged = [...prev, clean].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-MAX_DECISIONS);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(merged)); } catch { /* квота */ }
  return merged;
}

export function clearIntelHistory(): void {
  try { localStorage.removeItem(HISTORY_KEY); } catch { /* noop */ }
}

/** Решения за неделю (для чек-листа тренера). */
export function decisionsForWeek(decisions: IntelDecision[], referenceDate: string, offset = 0): IntelDecision[] {
  const to = addDays(referenceDate, -7 * offset);
  const from = addDays(to, -6);
  return load_safe(decisions).filter(d => d.date >= from && d.date <= to);
}
const load_safe = (a: IntelDecision[]) => Array.isArray(a) ? a : [];

// ── 3. WEEKLY ROLL-UP (неделя vs предыдущая) ────────────────────────────────
export interface WeeklyRollupRow {
  key: string;            // machine-stable id строки
  label: string;          // RU
  unit: string;
  current: number | null; // null = данных нет
  previous: number | null;
  deltaPct: number | null;
  note?: string;          // честная оговорка (напр. «<2 недель — базы нет»)
}

export interface WeeklyRollupInput {
  dailyLoads: DayLoad[];
  /** sRPE-журнал нужен для объёма/числа сессий: у DayLoad только дата+AU. */
  sessions?: { date: string; sRPE: number; durationMin: number }[];
  readinessHistory?: { date: string; recovery: number; fatigue: number }[];
  cmj?: CmjEntry[];
  wellness?: WellnessEntry[];
  autoRegSignals?: string[];
  decisions?: IntelDecision[];
  referenceDate?: string;
}

export function weeklyRollup(input: WeeklyRollupInput): { from: string; to: string; rows: WeeklyRollupRow[]; decisions: IntelDecision[] } {
  const ref = input.referenceDate || todayIso();
  const to = ref, from = addDays(ref, -6);
  const prevTo = addDays(ref, -7), prevFrom = addDays(ref, -13);
  const inWin = <T extends { date: string }>(rows: T[], a: string, b: string): T[] =>
    (rows || []).filter(r => r && DATE_RE.test(String(r.date)) && r.date >= a && r.date <= b);
  const sumLoad = (rows: { load: number }[]) => rows.reduce((acc, r) => acc + (Number(r.load) || 0), 0);
  const sumDur = (rows: { durationMin: number }[]) => rows.reduce((acc, r) => acc + (Number(r.durationMin) || 0), 0);
  const avg = (rows: { v: number }[]) => (rows.length ? rows.reduce((a, r) => a + r.v, 0) / rows.length : null);

  const cur = inWin(input.dailyLoads ?? [], from, to);
  const prev = inWin(input.dailyLoads ?? [], prevFrom, prevTo);
  const sess = input.sessions || [];
  const curSess = inWin(sess, from, to);
  const prevSess = inWin(sess, prevFrom, prevTo);
  const monotony = (rows: DayLoad[]) => {
    if (rows.length < 2) return null;
    const vals = rows.map(r => Number(r.load) || 0);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    if (mean <= 0) return null;
    const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
    return Math.round((sd / mean) * 100) / 100;
  };
  const readyRows = (a: string, b: string) => inWin(input.readinessHistory ?? [], a, b)
    .map(r => ({ v: Number(r.recovery) }))
    .filter(r => Number.isFinite(r.v));

  const curReady = readyRows(from, to), prevReady = readyRows(prevFrom, prevTo);
  const row = (key: string, label: string, unit: string, c: number | null, p: number | null, note?: string): WeeklyRollupRow => {
    const deltaPct = c != null && p != null && p !== 0 ? Math.round(((c - p) / Math.abs(p)) * 1000) / 10 : null;
    return { key, label, unit, current: c, previous: p, deltaPct, note };
  };
  const noData = (key: string, label: string, unit: string, note: string) => row(key, label, unit, null, null, note);

  const rows: WeeklyRollupRow[] = [];
  // 1) нагрузка
  if (cur.length) rows.push(row('load', 'Нагрузка', 'AU', Math.round(sumLoad(cur)), prev.length ? Math.round(sumLoad(prev)) : null,
    prev.length ? undefined : 'предыдущей недели нет'));
  else rows.push(noData('load', 'Нагрузка', 'AU', 'нет ни одной сессии sRPE за неделю'));
  // 2) объём
  if (curSess.length) rows.push(row('volume', 'Тренировочный объём', 'мин', Math.round(sumDur(curSess)), prevSess.length ? Math.round(sumDur(prevSess)) : null,
    prevSess.length ? undefined : 'предыдущей недели нет'));
  else rows.push(noData('volume', 'Тренировочный объём', 'мин', 'нет данных'));
  // 3) число сессий
  rows.push(curSess.length
    ? row('sessions', 'Сессий', 'шт', curSess.length, prevSess.length || null, prevSess.length ? undefined : 'предыдущей недели нет')
    : noData('sessions', 'Сессий', 'шт', 'нет данных'));
  // 4) монотонность
  rows.push(row('monotony', 'Монотонность', 'SD/сред', monotony(cur), prev.length ? monotony(prev) : null,
    cur.length < 2 ? 'нужно ≥2 сессии за неделю' : undefined));
  // 5) ACWR (зона — по всей доступной базе, сравнение с прошлой неделей НЕ считается)
  const dailyLoads = input.dailyLoads || [];
  if (dailyLoads.length) {
    const acwr = acuteChronicRatio(dailyLoads);
    rows.push(row('acwr', 'ACWR', '×', Math.round(acwr.ratio * 100) / 100, null,
      `зона: ${ACWR_ZONE_META[acwr.zone].label} · сравнение с прошлой неделей не считается (нужна база 28д)`));
  } else rows.push(noData('acwr', 'ACWR', '×', 'нет сессий'));
  // 6) готовность
  rows.push(row('readiness', 'Готовность (среднее)', '0–100', curReady.length ? Math.round(avg(curReady)!) : null, prevReady.length ? Math.round(avg(prevReady)!) : null,
    curReady.length ? (curReady.length < 3 ? 'меньше 3 точек — ориентир' : undefined) : 'нет истории готовности'));
  // 6) усталость
  const curFat = inWin(input.readinessHistory ?? [], from, to).map(r => ({ v: Number(r.fatigue) })).filter(r => Number.isFinite(r.v));
  const prevFat = inWin(input.readinessHistory ?? [], prevFrom, prevTo).map(r => ({ v: Number(r.fatigue) })).filter(r => Number.isFinite(r.v));
  rows.push(row('fatigue', 'Усталость (средняя)', '0–100', curFat.length ? Math.round(avg(curFat)!) : null, prevFat.length ? Math.round(avg(prevFat)!) : null,
    curFat.length ? undefined : 'нет истории усталости'));
  // 8) CMJ — ПОСЛЕДНИЙ замер за неделю (не «лучший»: тренер видит факт, а не рекорд)
  const cmj = cmjScreen(input.cmj || [], to);
  const cmjIsPower = cmj.points.some(p => p.powerPerKg != null);
  rows.push(row('cmj', 'CMJ (последний за 7д)', cmjIsPower ? 'Вт/кг' : 'см',
    cmjIsPower ? (cmj.current?.powerPerKg ?? null) : (cmj.current?.heightCm ?? null), null,
    cmj.points.length ? `зона: ${cmj.zone === 'no_data' ? 'мало замеров' : cmj.zone} · скрининг, не тест готовности` : 'замеров CMJ нет'));
  // 8) wellness
  const wl = wellnessReport(input.wellness || [], to);
  rows.push(row('wellness', 'Wellness (светофор)', '0–100', wl.score, null,
    wl.zone === 'no_data' ? 'нет отметок wellness' : `зона: ${wl.zone} · тревожных сигналов ${wl.alarmSignals} из ${wl.itemsFilled} · не диагноз`));
  // 9) авторегуляция
  const signals = input.autoRegSignals || [];
  rows.push(row('autoreg', 'Сигналов авторегуляции', 'шт', signals.length, null, signals.length ? undefined : 'решения не применялись'));
  // 10) решения
  const decisions = decisionsForWeek(input.decisions || [], ref, 0);
  const appliedCount = decisions.filter(d => d.applied).length;
  rows.push(row('decisions', 'Решений: применено / отклонено', 'шт', appliedCount, null,
    decisions.length ? `всего решений: ${decisions.length} (отклонено ${decisions.length - appliedCount})` : 'решений за неделю не было'));

  return { from, to, rows, decisions };
}

// ── 4. ОТЧЁТ ТРЕНЕРУ (HTML + CSV) ───────────────────────────────────────────
export interface CoachSectionLine { label: string; value: string; }
export interface CoachSection {
  id: 'load' | 'recovery' | 'autoreg' | 'forecast' | 'recommendations';
  title: string;
  lines: CoachSectionLine[];
}

export interface CoachReportInput {
  generatedAt: string;             // локальные дата+время для подписи
  sections: CoachSection[];        // ровно 5 секций хаба
  rollup: ReturnType<typeof weeklyRollup>;
  cmjNote?: string;
  wellnessNote?: string;
  bbRecommendations?: string[];    // рекомендации ББ-хаба, если они есть в контуре
}

export const COACH_SECTION_ORDER: CoachSection['id'][] = ['load', 'recovery', 'autoreg', 'forecast', 'recommendations'];

function esc(v: unknown): string {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Чек-лист тренера: что применялось, что сознательно отклонено. */
export function coachChecklistLines(decisions: IntelDecision[]): CoachSectionLine[] {
  if (!decisions.length) return [{ label: 'Решений за неделю нет', value: '—' }];
  return decisions.map(d => ({
    label: `${d.applied ? '✅ Применено' : '⛔ Отклонено'} · ${d.kind}`,
    value: d.detail ? `${d.label} — ${d.detail}` : d.label,
  }));
}

export function buildCoachChecklist(input: CoachReportInput): CoachSection {
  return { id: 'recommendations', title: '🧾 Чек-лист решений тренера', lines: coachChecklistLines(input.rollup.decisions) };
}

/** HTML-отчёт: все 5 секций + roll-up + чек-лист, `@page`/`thead` для печати. */
export function buildCoachReportHtml(input: CoachReportInput): string {
  const sectionHtml = (s: CoachSection) =>
    `<h2>${esc(s.title)}</h2><table><thead><tr><th>Показатель</th><th>Значение</th></tr></thead><tbody>` +
    s.lines.map(l => `<tr><td>${esc(l.label)}</td><td>${esc(l.value)}</td></tr>`).join('') +
    `</tbody></table>`;

  const rollupRows = input.rollup.rows.map(r =>
    `<tr><td>${esc(r.label)}</td><td>${r.current == null ? '—' : esc(`${r.current} ${r.unit}`)}</td>` +
    `<td>${r.previous == null ? '—' : esc(`${r.previous} ${r.unit}`)}</td>` +
    `<td>${r.deltaPct == null ? '—' : esc(`${r.deltaPct > 0 ? '+' : ''}${r.deltaPct}%`)}</td>` +
    `<td>${esc(r.note || '')}</td></tr>`).join('');

  const checklist = buildCoachChecklist(input);
  const bbRecs = input.bbRecommendations ?? [];
  const bbLines = bbRecs.length
    ? `<h2>🏋️ Рекомендации ББ-хаба</h2><ul>${bbRecs.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`
    : `<p class="muted">Рекомендации ББ-хаба в этом контуре не собраны — раздел пуст (не выдумываем).</p>`;

  const missing = COACH_SECTION_ORDER.filter(id => !input.sections.some(s => s.id === id));
  return `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"><title>Интеллект тренировки — отчёт тренеру</title><style>
  body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#111;margin:18px;line-height:1.4}
  h1{font-size:20px;margin:0 0 6px} h2{font-size:15px;margin:18px 0 6px}
  table{border-collapse:collapse;width:100%;margin-bottom:8px} th,td{border:1px solid #ccc;padding:4px 6px;font-size:11px;text-align:left;vertical-align:top}
  th{background:#f3f4f6} thead{display:table-header-group} tr{break-inside:avoid}
  .muted{color:#666;font-size:11px} .note{font-size:10px;color:#555}
  @page{margin:12mm}
  @media print{.no-print{display:none}}
  </style></head><body>
  <h1>⚡ Интеллект тренировки — отчёт тренеру</h1>
  <p class="muted">Неделя ${esc(input.rollup.from)} … ${esc(input.rollup.to)} · сгенерировано ${esc(input.generatedAt)}</p>
  <h2>📈 Неделя vs предыдущая</h2>
  <table><thead><tr><th>Показатель</th><th>Неделя</th><th>Прошлая</th><th>Δ</th><th>Оговорка</th></tr></thead><tbody>${rollupRows}</tbody></table>
  ${input.sections.map(sectionHtml).join('')}
  ${checklist.id === 'recommendations' && !input.sections.some(s => s.title === checklist.title) ? '' : ''}
  <h2>🧾 ${esc(checklist.title.replace(/^🧾\s*/, ''))}</h2>
  <table><thead><tr><th>Решение</th><th>Детали</th></tr></thead><tbody>${checklist.lines.map(l => `<tr><td>${esc(l.label)}</td><td>${esc(l.value)}</td></tr>`).join('')}</tbody></table>
  ${bbLines}
  <p class="note">Границы: ACWR — эвристика мониторинга, не предсказание травмы. Wellness и CMJ — сигналы, не диагнозы (Meeusen 2013). Внешняя нагрузка (GPS/IMU/PlayerLoad) в этом контуре отсутствует.</p>
  ${missing.length ? `<p class="note">Пустые секции: ${esc(missing.join(', '))}</p>` : ''}
  </body></html>`;
}

/** CSV: roll-up + все секции + чек-лист. BOM + защита от формул. */
export function buildCoachReportCsv(input: CoachReportInput): string {
  const rows: string[] = ['\uFEFFblock,label,value_current,value_previous,delta_pct,note'];
  for (const r of input.rollup.rows) {
    rows.push(['rollup', csvCell(r.label), r.current == null ? '' : String(r.current), r.previous == null ? '' : String(r.previous),
      r.deltaPct == null ? '' : String(r.deltaPct), csvCell(r.note || '')].join(','));
  }
  for (const s of input.sections) {
    for (const l of s.lines) rows.push([csvCell(s.id), csvCell(l.label), csvCell(l.value), '', '', ''].join(','));
  }
  for (const l of buildCoachChecklist(input).lines) rows.push(['decisions', csvCell(l.label), csvCell(l.value), '', '', ''].join(','));
  for (const r of input.bbRecommendations || []) rows.push(['bb_rec', csvCell(r), '', '', '', ''].join(','));
  return rows.join('\n');
}

/** Текстовый дайджест для Share/буфера (АПК). */
export function buildCoachDigestText(input: CoachReportInput): string {
  const lines: string[] = [`⚡ Интеллект тренировки — неделя ${input.rollup.from}…${input.rollup.to}`];
  for (const r of input.rollup.rows) {
    const cur = r.current == null ? '—' : `${r.current} ${r.unit}`;
    const prev = r.previous == null ? '—' : `${r.previous} ${r.unit}`;
    const d = r.deltaPct == null ? '—' : `${r.deltaPct > 0 ? '+' : ''}${r.deltaPct}%`;
    lines.push(`• ${r.label}: ${cur} (было ${prev}, ${d})${r.note ? ` — ${r.note}` : ''}`);
  }
  const chk = buildCoachChecklist(input);
  if (chk.lines[0]?.label !== 'Решений за неделю нет') {
    lines.push('Решения:');
    for (const l of chk.lines) lines.push(`  ${l.label}: ${l.value}`);
  }
  lines.push('ACWR — эвристика мониторинга, не предсказание травмы. Wellness/CMJ — сигналы, не диагнозы.');
  return lines.join('\n');
}
