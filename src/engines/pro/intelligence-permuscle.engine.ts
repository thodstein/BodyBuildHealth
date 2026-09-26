/**
 * intelligence-permuscle.engine.ts — нагрузка по мышцам и перекос (E5).
 *
 * Зачем: недельный объём по мышцам есть только в ББ-хабе, а динамики (растёт/падает/перекос)
 * не было ни в одном хабе. Считаем прокси, а не «объём работы»:
 *   нагрузка мышцы = Σ (сеты × коэффициент близости к отказу)
 * Коэффициент от RIR: RIR 0 → 1.0, RIR 1 → 0.95, RIR 2 → 0.9, RIR 3 → 0.8, RIR 4+ → 0.7.
 * Это прокси интенсивности (Sandoval/Shaw-выводы о том, что близость к отказу отражает
 * нейромышечную нагрузку лучше, чем просто объём), а не физиологическое измерение.
 *
 * Граница честности: перекос — это описание распределения нагрузки, НЕ диагноз и не
 * рекомендация «добавьте подъёмы». Meeusen 2013 против «диагнозов перетренированности».
 */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function addDays(dateStr: string, n: number): string {
  const parts = dateStr.split('-').map(Number);
  if (parts.length !== 3 || parts.some(p => !Number.isFinite(p))) return dateStr;
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Коэффициент близости к отказу: чем ближе, тем «тяжелее» сет для нагрузки. */
export function rirIntensityFactor(rir?: number): number {
  const r = Number.isFinite(rir as number) ? (rir as number) : 2;
  if (r <= 0) return 1.0;
  if (r <= 1) return 0.95;
  if (r <= 2) return 0.9;
  if (r <= 3) return 0.8;
  return 0.7;
}

export interface MuscleSetEntry {
  date: string;
  muscle: string;
  sets: number;
  avgRir?: number;
  /** rir не указан у всех сетов — тогда коэффициент берётся нейтральный (0.9) и флаг честности. */
  rirKnown: boolean;
}

/** Нормализация входа: мусорные мышцы/даты/сеты отбрасываются, а не превращаются в NaN. */
export function normalizeMuscleEntries(entries: MuscleSetEntry[]): MuscleSetEntry[] {
  const out: MuscleSetEntry[] = [];
  for (const e of entries ?? []) {
    if (!e || typeof e.muscle !== 'string') continue;
    const muscle = e.muscle.trim();
    if (!muscle || !DATE_RE.test(String(e.date))) continue;
    const sets = Number(e.sets);
    if (!Number.isFinite(sets) || sets <= 0) continue;
    const rirKnown = Number.isFinite(e.avgRir as number);
    out.push({ date: e.date, muscle, sets, avgRir: rirKnown ? e.avgRir : undefined, rirKnown });
  }
  return out;
}

export interface MuscleLoad {
  muscle: string;
  load: number;          // Σ (сеты × коэффициент RIR), округлено до 0.1
  sets: number;          // фактические подходы (без коэффициента)
  delta7dPct: number | null;
  delta28dPct: number | null;
  rirKnownShare: number; // доля сетов с известным RIR (честность прокси)
}

export interface ImbalanceItem {
  muscle: string;
  load: number;
  /** Доля от суммы по всем мышцам, % */
  sharePct: number;
  /** Насколько мышца «выступает» над медианой (×) — 1 = типичная, 2 = вдвое выше медианы. */
  vsMedian: number;
}

export interface MuscleLoadReport {
  referenceDate: string;
  muscles: MuscleLoad[];
  totalLoad: number;
  totalSets: number;
  imbalance: {
    /** 0 = равномерно, 100 = вся нагрузка в одной мышце. */
    score: number;
    label: string;
    top: ImbalanceItem[];
    note: string;
  };
  note: string;
}

export const PER_MUSCLE_NOTE =
  'Нагрузка по мышцам — прокси «сеты × близость к отказу», не измерение работы мышцы. Перекос — описание распределения, не диагноз.';

const round1 = (v: number) => Math.round(v * 10) / 10;

/** Свод по мышцам: недельная нагрузка, дельта к 7/28-дневной базе, индекс перекоса. */
export function muscleLoadReport(entries: MuscleSetEntry[], referenceDate?: string): MuscleLoadReport {
  const clean = normalizeMuscleEntries(entries);
  const ref = referenceDate || (clean.length ? clean[clean.length - 1].date : '');
  const inRange = (d: string, from: string, to: string) => DATE_RE.test(d) && d >= from && d <= to;

  const byMuscle = new Map<string, { load: number; sets: number; rirKnown: number }>();
  const totals = { load: 0, sets: 0, rirKnown: 0 };
  const add = (muscle: string, sets: number, factor: number, rirKnown: boolean) => {
    const cur = byMuscle.get(muscle) ?? { load: 0, sets: 0, rirKnown: 0 };
    cur.load += sets * factor; cur.sets += sets; if (rirKnown) cur.rirKnown += sets;
    byMuscle.set(muscle, cur);
    totals.load += sets * factor; totals.sets += sets; if (rirKnown) totals.rirKnown += sets;
  };
  for (const e of clean) {
    if (!inRange(e.date, addDays(ref, -6), ref)) continue; // окно 7 дней
    add(e.muscle, e.sets, rirIntensityFactor(e.avgRir), e.rirKnown);
  }
  // базы 7/28 — предыдущие окна той же длины
  const windowSum = (from: string, to: string) => {
    const m = new Map<string, number>();
    for (const e of clean) if (inRange(e.date, from, to)) m.set(e.muscle, (m.get(e.muscle) ?? 0) + e.sets * rirIntensityFactor(e.avgRir));
    return m;
  };
  const prev7 = windowSum(addDays(ref, -13), addDays(ref, -7));
  const prev28 = windowSum(addDays(ref, -34), addDays(ref, -6));

  const muscles: MuscleLoad[] = [...byMuscle.entries()].map(([muscle, v]) => {
    const p7 = prev7.get(muscle) ?? 0;
    const p28 = prev28.get(muscle) ?? 0;
    return {
      muscle,
      load: round1(v.load),
      sets: v.sets,
      delta7dPct: p7 > 0 ? Math.round(((v.load - p7) / p7) * 100) : null,
      delta28dPct: p28 > 0 ? Math.round(((v.load - p28) / p28) * 100) : null,
      rirKnownShare: v.sets > 0 ? Math.round((v.rirKnown / v.sets) * 100) / 100 : 0,
    };
  }).sort((a, b) => b.load - a.load);

  // Индекс перекоса: доля нагрузки верхней трети мышц (иначе 3 мышцы из 20 «перекосят» всегда).
  const sum = muscles.reduce((s, m) => s + m.load, 0);
  const median = medianOf(muscles.map(m => m.load));
  const topThird = Math.max(1, Math.ceil(muscles.length / 3));
  const topLoad = muscles.slice(0, topThird).reduce((s, m) => s + m.load, 0);
  const score = sum > 0 ? Math.round((topLoad / sum) * 100) : 0;
  const top: ImbalanceItem[] = muscles.slice(0, topThird).map(m => ({
    muscle: m.muscle,
    load: m.load,
    sharePct: sum > 0 ? Math.round((m.load / sum) * 1000) / 10 : 0,
    vsMedian: median > 0 ? Math.round((m.load / median) * 100) / 100 : 0,
  }));

  return {
    referenceDate: ref,
    muscles,
    totalLoad: round1(totals.load),
    totalSets: totals.sets,
    imbalance: {
      score,
      label: score >= 70 ? 'выраженный перекос' : score >= 55 ? 'умеренный перекос' : 'распределение ровное',
      top,
      note: PER_MUSCLE_NOTE,
    },
    note: PER_MUSCLE_NOTE,
  };
}

function medianOf(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Совмещение недельного объёма ББ-плана с этой нагрузкой — для честного «план vs факт» по мышцам. */
export function planVsActualPerMuscle(
  actual: MuscleLoadReport,
  planSetsByMuscle: Record<string, number>,
): { muscle: string; planSets: number; actualSets: number; deltaSets: number; deltaPct: number | null }[] {
  const names = new Set<string>([...actual.muscles.map(m => m.muscle), ...Object.keys(planSetsByMuscle ?? {})]);
  return [...names].map(muscle => {
    const planSets = Math.max(0, Math.round(Number(planSetsByMuscle?.[muscle]) || 0));
    const actualSets = actual.muscles.find(m => m.muscle === muscle)?.sets ?? 0;
    return {
      muscle, planSets, actualSets,
      deltaSets: actualSets - planSets,
      deltaPct: planSets > 0 ? Math.round(((actualSets - planSets) / planSets) * 100) : null,
    };
  }).sort((a, b) => Math.abs(b.deltaSets) - Math.abs(a.deltaSets));
}

/** Ряд дневной нагрузки, разобранный по мышцам (для графика «мышца × день»). */
export function muscleDailyMatrix(entries: MuscleSetEntry[], referenceDate?: string, days = 28): { dates: string[]; muscles: string[]; rows: Record<string, number[]> } {
  const clean = normalizeMuscleEntries(entries);
  const ref = referenceDate || (clean.length ? clean[clean.length - 1].date : '');
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) dates.push(addDays(ref, -i));
  const muscles = [...new Set(clean.map(e => e.muscle))].sort();
  const rows: Record<string, number[]> = {};
  for (const m of muscles) rows[m] = new Array(days).fill(0);
  for (const e of clean) {
    const idx = dates.indexOf(e.date);
    if (idx >= 0) rows[e.muscle][idx] += e.sets;
  }
  return { dates, muscles, rows };
}
