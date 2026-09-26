/**
 * intelligence-load-alt.engine.ts — альтернативные метрики нагрузки (E5).
 *
 * Граница честности (важно): это **альтернативы**, а не замена канону ACWR.
 *  - `sacwr` — EWMA-острая / EWMA-хроническая (7/28, α=2/(N+1), Williams 2017). В литературе
 *    обсуждается как способ сгладить «дозвонки» стандартного ACWR, но единого канона нет:
 *    Cloosterman 2024 (J Athl Train) и Tysoe 2020 показывают, что ни одна форма не предсказывает
 *    травму лучше других. Поэтому функция возвращает СВОЙ объект и честную пометку метода,
 *    а `training-load.engine.acuteChronicRatio` остаётся единственным источником зон ACWR.
 *  - `loadClassification` — только описание нагрузки (недотрен/норма/высокая/всплеск), без
 *    медицинских утверждений: Meeusen 2013 прямо против «диагнозов перетренированности».
 *  - `differentialLoad` — прирост нагрузки относительно предыдущего окна (1/7/28д).
 */
import { ewma, toDailyLoads, type DayLoad, type TrainingSession } from './training-load.engine';

/** Честная оговорка метода — показывается в UI рядом с числом, а не прячется в комментарий. */
export const SACWR_METHOD_NOTE =
  'sACWR (EWMA 7/28) — альтернативная форма, НЕ канон: в литературе единого «правильного» ACWR нет, связь с травмами не доказана (Cloosterman 2024, Tysoe 2020). Это средство анализа, а не гейт.';

export const LOAD_CLASS_NOTE =
  'Классификация нагрузки — описание текущего объёма, а не диагноз и не прогноз травмы.';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function addDays(dateStr: string, n: number): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(p => !Number.isFinite(p))) {
    const d = new Date(dateStr); d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const sumRange = (byDate: Record<string, number>, ref: string, days: number): number => {
  const start = addDays(ref, -(days - 1));
  let sum = 0;
  for (const d of Object.keys(byDate)) if (d >= start && d <= ref) sum += byDate[d];
  return sum;
};

export interface DifferentialLoad {
  referenceDate: string;
  windows: { days: number; current: number; previous: number; delta: number; deltaPct: number | null }[];
  /** Средние по дням (нулевые дни входят в знаменатель — иначе «отпуск» считается ростом). */
  perDay: { days: number; current: number; previous: number; deltaPct: number | null }[];
  note: string;
}

/** Прирост нагрузки по окнам 1/7/28 дней к предыдущему такому же окну. */
export function differentialLoad(dailyLoads: DayLoad[], referenceDate?: string): DifferentialLoad {
  const sorted = [...dailyLoads].sort((a, b) => a.date < b.date ? -1 : 1);
  const byDate: Record<string, number> = {};
  for (const d of sorted) if (DATE_RE.test(d.date)) byDate[d.date] = (byDate[d.date] || 0) + d.load;
  const ref = referenceDate || (sorted.length ? sorted[sorted.length - 1].date : '');
  const windows = [1, 7, 28].map(days => {
    const current = sumRange(byDate, ref, days);
    const previous = sumRange(byDate, addDays(ref, -days), days);
    return { days, current, previous, delta: current - previous, deltaPct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null };
  });
  const perDay = [1, 7, 28].map(days => {
    const current = sumRange(byDate, ref, days) / days;
    const previous = sumRange(byDate, addDays(ref, -days), days) / days;
    return { days, current, previous, deltaPct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null };
  });
  return {
    referenceDate: ref,
    windows,
    perDay,
    note: 'Дельта нагрузки к предыдущему окну; нулевые дни входят в базу, поэтому отпуск читается как спад, а не как рост.',
  };
}

export interface SacwrResult {
  acuteEwma: number;
  chronicEwma: number;
  ratio: number;
  /** Отличие от классического ACWR — чтобы в UI не выдавать их за одно и то же. */
  vsCoupledRa: number | null;
  method: 'sacwr_ewma';
  note: string;
}

/** sACWR: EWMA-острая (7д) / EWMA-хроническая (28д) по полному ряду с нулями. */
export function sacwr(
  dailyLoads: DayLoad[],
  referenceDate?: string,
  coupledRatio?: number,
): SacwrResult | null {
  const sorted = [...dailyLoads].sort((a, b) => a.date < b.date ? -1 : 1);
  if (sorted.length === 0) return null;
  const byDate: Record<string, number> = {};
  for (const d of sorted) if (DATE_RE.test(d.date)) byDate[d.date] = (byDate[d.date] || 0) + d.load;
  const ref = referenceDate || sorted[sorted.length - 1].date;
  const series: number[] = [];
  for (let i = 27; i >= 0; i--) series.push(byDate[addDays(ref, -i)] || 0);
  const acuteEwma = ewma(series.slice(21), 2 / 8);
  const chronicEwma = ewma(series, 2 / 29);
  const ratio = chronicEwma > 0 ? acuteEwma / chronicEwma : (acuteEwma > 0 ? 2 : 0);
  return {
    acuteEwma: Math.round(acuteEwma * 10) / 10,
    chronicEwma: Math.round(chronicEwma * 10) / 10,
    ratio: Math.round(ratio * 100) / 100,
    vsCoupledRa: typeof coupledRatio === 'number' && Number.isFinite(coupledRatio) && coupledRatio > 0
      ? Math.round((ratio - coupledRatio) * 100) / 100
      : null,
    method: 'sacwr_ewma',
    note: SACWR_METHOD_NOTE,
  };
}

export type LoadClass = 'undertrained' | 'normal' | 'high' | 'spike';

export interface LoadClassification {
  class: LoadClass;
  label: string;
  hint: string;
  note: string;
}

const CLASS_RU: Record<LoadClass, { label: string; hint: string }> = {
  undertrained: { label: 'Недотрен', hint: 'нагрузка ниже своей хронической — скорее всего, объём можно поднимать' },
  normal: { label: 'Норма', hint: 'текущий объём близок к своей хронической базе' },
  high: { label: 'Выше базы', hint: 'объём выше хронического — следите за восстановлением' },
  spike: { label: 'Всплеск', hint: 'резкий скачок объёма относительно базы' },
};

/** Классификация по sACWR-отношению + дельте 7 дней. Только описание объёма. */
export function loadClassification(sacwrRatio: number, delta7dPct: number | null): LoadClassification {
  const r = Number.isFinite(sacwrRatio) ? sacwrRatio : 0;
  const d7 = delta7dPct == null ? 0 : delta7dPct;
  let cls: LoadClass;
  if (d7 >= 50) cls = 'spike';
  else if (r < 0.8) cls = 'undertrained';
  else if (r <= 1.3) cls = 'normal';
  else cls = 'high';
  return { class: cls, label: CLASS_RU[cls].label, hint: CLASS_RU[cls].hint, note: LOAD_CLASS_NOTE };
}

/** Удобная точка входа: из сессий sRPE. */
export function loadAltFromSessions(
  sessions: TrainingSession[],
  referenceDate?: string,
  coupledRatio?: number,
): { diff: DifferentialLoad; sacwr: SacwrResult | null; classification: LoadClassification | null } {
  const dailyLoads = toDailyLoads(sessions);
  const diff = differentialLoad(dailyLoads, referenceDate);
  const s = sacwr(dailyLoads, referenceDate, coupledRatio);
  return { diff, sacwr: s, classification: s ? loadClassification(s.ratio, diff.windows.find(w => w.days === 7)?.deltaPct ?? null) : null };
}
