/**
 * intelligence-cmj.engine.ts — CMJ-скрининг нейромышечной усталости (E7).
 *
 * Что это: относительная просадка прыжка в серии. Используется в спорте как признак
 * НЕЙРОМЫШЕЧНОЙ УСТАЛОСТИ (Hughes 2022, Heishman 2020): падение высоты/мощности при
 * неизменной нагрузке отражает ухудшение возбуждения/рекрутирования.
 *
 * Границы честности (важно, чтобы не превратить скрининг в приговор):
 *  - Это СКРИНИНГ УСТАЛОСТИ, а НЕ тест готовности к тренировке и не диагноз.
 *  - Пороги зон — рабочие ориентиры из практики CMJ, а не валидированный протокол:
 *    они зависят от протокола, времени суток, фазы цикла, разогрева и точности замера.
 *  - Метрика НИКОГДА не блокирует тренировку: `blocking: false` — решение всегда за пользователем.
 *  - Если высоту посчитали из времени полёта — это производная величина (g·t²/8), её погрешность
 *    заметно выше, чем у тензодатчика; такая запись помечается `measured: 'flight_time'`.
 */
export const CMJ_METHODS = ['height', 'flight_time', 'power'] as const;
export type CmjMethod = typeof CMJ_METHODS[number];

export interface CmjEntry {
  date: string;
  /** Высота прыжка, см (приоритетный ввод). */
  heightCm?: number;
  /** Время полёта, мс → высота = g·t²/8. */
  flightTimeMs?: number;
  /** Мощность, Вт (или Вт/кг) — если измеряется прибором. */
  powerW?: number;
  /** Вес тела, кг — нужен для нормировки мощности. */
  bodyweightKg?: number;
}

export interface CmjPoint {
  date: string;
  /** Высота, см (из входа). */
  heightCm: number | null;
  /** Удельная мощность, Вт/кг — сопоставима между днями разного веса. */
  powerPerKg: number | null;
  /** Отношение к лучшему результату серии, % (0–100). */
  vsSeriesBestPct: number | null;
  /** Просадка относительно лучшего, % (>=0). */
  dropFromBestPct: number | null;
  /** Дельта к среднему прошлых 7 дней, % (отрицательное = стало ниже). */
  deltaVsBaselinePct: number | null;
  method: CmjMethod | 'unknown';
  measured: 'height' | 'flight_time' | 'power' | 'unknown';
}

export type CmjZone = 'green' | 'yellow' | 'red' | 'no_data';

export const CMJ_ZONE_THRESHOLDS = { yellowDropPct: 5, redDropPct: 10 } as const;

export const CMJ_SCREENING_NOTE =
  'CMJ-скрининг — признак нейромышечной усталости, НЕ тест готовности и не диагноз. Пороги — рабочие ориентиры, а не валидированный протокол (зависят от времени замера, фазы цикла, разогрева и точности прибора).';

export const CMJ_NON_BLOCKING_NOTE = 'Метрика не блокирует тренировку автоматически (не автоблокировка) — решение остаётся за вами.';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const G = 9.81;
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Высота прыжка из времени полёта: h = g·t²/8 (в метрах). */
export function jumpHeightCmFromFlight(flightTimeMs: number): number | null {
  const t = Number(flightTimeMs);
  if (!Number.isFinite(t) || t <= 0 || t > 2000) return null;
  return round1((G * Math.pow(t / 1000, 2) / 8) * 100);
}

function addDays(dateStr: string, n: number): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(p => !Number.isFinite(p))) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface NormalizedEntry { date: string; heightCm: number | null; powerPerKg: number | null; method: CmjMethod | 'unknown'; measured: CmjPoint['measured']; }

function normalize(entries: CmjEntry[]): NormalizedEntry[] {
  const out: NormalizedEntry[] = [];
  for (const e of entries ?? []) {
    if (!e || !DATE_RE.test(String(e.date))) continue;
    const bw = Number(e.bodyweightKg);
    const bwOk = Number.isFinite(bw) && bw > 0;
    let heightCm: number | null = null;
    let method: CmjMethod | 'unknown' = 'unknown';
    let measured: CmjPoint['measured'] = 'unknown';
    const h = Number(e.heightCm);
    if (Number.isFinite(h) && h > 0 && h < 150) { heightCm = h; method = 'height'; measured = 'height'; }
    else {
      const fromFlight = jumpHeightCmFromFlight(e.flightTimeMs as number);
      if (fromFlight != null) { heightCm = fromFlight; method = 'flight_time'; measured = 'flight_time'; }
    }
    let powerPerKg: number | null = null;
    const p = Number(e.powerW);
    if (Number.isFinite(p) && p > 0) {
      powerPerKg = bwOk ? round1(p / bw) : round1(p); // без веса — абсолютная мощность, помечаем метод
      if (method === 'unknown') { method = 'power'; measured = 'power'; }
    }
    if (heightCm == null && powerPerKg == null) continue; // запись без измеримого — не мусор в серии
    out.push({ date: e.date, heightCm, powerPerKg, method, measured });
  }
  return out.sort((a, b) => a.date < b.date ? -1 : 1);
}

/** Основная величина сравнения: удельная мощность, если есть вес; иначе высота. */
function comparable(p: NormalizedEntry): number | null {
  return p.powerPerKg != null ? p.powerPerKg : p.heightCm;
}

/**
 * Нормировка на лучший результат серии + дельта к 7-дневной базе + зона усталости.
 */
export function cmjScreen(entries: CmjEntry[], referenceDate?: string): {
  referenceDate: string;
  points: CmjPoint[];
  current: CmjPoint | null;
  /** Текущий замер в % от лучшего в серии (null — нечего сравнивать). */
  seriesBestPct: number | null;
  /** Абсолютное лучшее значение серии (Вт/кг, если замерена мощность, иначе см). */
  seriesBestValue: number | null;
  zone: CmjZone;
  signals: string[];
  blocking: false;
  note: string;
} {
  const clean = normalize(entries);
  const ref = referenceDate || (clean.length ? clean[clean.length - 1].date : '');
  const values = clean.map(comparable).filter((v): v is number => v != null);
  const best = values.length ? Math.max(...values) : null;

  const baselineFor = (date: string) => {
    const from = addDays(date, -7), to = addDays(date, -1);
    const past = clean.filter(p => p.date >= from && p.date <= to).map(comparable).filter((v): v is number => v != null);
    return past.length ? past.reduce((a, b) => a + b, 0) / past.length : null;
  };

  const points: CmjPoint[] = clean.map(p => {
    const cur = comparable(p);
    const vsBest = best != null && cur != null && best > 0 ? Math.round((cur / best) * 1000) / 10 : null;
    const base = baselineFor(p.date);
    const delta = base != null && cur != null && base !== 0 ? Math.round(((cur - base) / Math.abs(base)) * 1000) / 10 : null;
    return {
      date: p.date, heightCm: p.heightCm, powerPerKg: p.powerPerKg,
      vsSeriesBestPct: vsBest,
      dropFromBestPct: vsBest == null ? null : Math.round((100 - vsBest) * 10) / 10,
      deltaVsBaselinePct: delta,
      method: p.method, measured: p.measured,
    };
  });

  const current = points.length ? points[points.length - 1] : null;
  const drop = current?.dropFromBestPct ?? null;
  // Один замер не может показать просадку: drop тренда при 1 точке тривиально 0%.
  // Поэтому зона требует ≥2 измерений, иначе честный no_data.
  let zone: CmjZone = 'no_data';
  if (drop != null && values.length >= 2) {
    if (drop >= CMJ_ZONE_THRESHOLDS.redDropPct) zone = 'red';
    else if (drop >= CMJ_ZONE_THRESHOLDS.yellowDropPct) zone = 'yellow';
    else zone = 'green';
  }

  const signals: string[] = [];
  if (zone === 'red') signals.push(`Просадка ${drop}% от лучшего в серии (порог красного: ${CMJ_ZONE_THRESHOLDS.redDropPct}%) — вероятна нейромышечная усталость.`);
  else if (zone === 'yellow') signals.push(`Просадка ${drop}% от лучшего (жёлтый ориентир: от ${CMJ_ZONE_THRESHOLDS.yellowDropPct}%) — следите за самочувствием.`);
  else if (zone === 'green') signals.push(`Просадка ${drop}% — в пределах обычного разброса.`);
  if (current?.measured === 'flight_time') signals.push('Высота посчитана из времени полёта: погрешность выше, чем у тензодатчика.');
  if (current?.powerPerKg == null && current?.heightCm != null) signals.push('Мощность без веса тела не считается — сравнение только по высоте.');
  if (values.length < 3) signals.push(`Мало замеров (${values.length}) — зона ориентировочная, для нормировки на лучший результат нужен минимум 3.`);
  if (values.length < 2) signals.push('Один замер не показывает динамику — зона не определяется.');

  return {
    referenceDate: ref, points, current,
    // ИМЯ = СМЫСЛ: процент текущего замера от лучшего в серии (абсолютное значение — рядом).
    seriesBestPct: current?.vsSeriesBestPct ?? null,
    seriesBestValue: best,
    zone, signals, blocking: false,
    note: `${CMJ_SCREENING_NOTE} ${CMJ_NON_BLOCKING_NOTE}`,
  };
}

/** Пустая ли серия (хаб рисует честную пустую карточку). */
export function cmjIsEmpty(entries: CmjEntry[]): boolean {
  return normalize(entries).length === 0;
}

// ── журнал замеров (локальный, по дате = один замер) ──
const KEY = 'he_intelligence_cmj_v1';
const MAX_ENTRIES = 120;

function sanitizeEntries(raw: unknown): CmjEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: CmjEntry[] = [];
  for (const e of raw) {
    if (!e || !DATE_RE.test(String((e as any).date))) continue;
    const clean: CmjEntry = { date: String((e as any).date) };
    const h = Number((e as any).heightCm);
    if (Number.isFinite(h) && h > 0 && h < 150) clean.heightCm = h;
    const ft = Number((e as any).flightTimeMs);
    if (Number.isFinite(ft) && ft > 0 && ft < 2000) clean.flightTimeMs = ft;
    const p = Number((e as any).powerW);
    if (Number.isFinite(p) && p > 0 && p < 5000) clean.powerW = p;
    const bw = Number((e as any).bodyweightKg);
    if (Number.isFinite(bw) && bw > 20 && bw < 300) clean.bodyweightKg = bw;
    if (clean.heightCm == null && clean.flightTimeMs == null && clean.powerW == null) continue;
    out.push(clean);
  }
  return out;
}

export function loadCmj(): CmjEntry[] {
  try { return sanitizeEntries(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return []; }
}

export function saveCmj(entry: CmjEntry): CmjEntry[] {
  const date = String(entry?.date ?? '');
  if (!DATE_RE.test(date)) return loadCmj();
  const rest = loadCmj().filter(e => e.date !== date);
  const clean = sanitizeEntries([{ ...entry, date }])[0];
  if (!clean) return loadCmj(); // запись без измеримых значений не сохраняется (не «нулевой прыжок»)
  const merged = [...rest, clean].sort((a, b) => a.date < b.date ? -1 : 1).slice(-MAX_ENTRIES);
  try { localStorage.setItem(KEY, JSON.stringify(merged)); } catch { /* квота */ }
  return merged;
}

export function clearCmj(): void {
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
}
