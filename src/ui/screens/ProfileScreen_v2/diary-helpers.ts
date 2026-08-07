/**
 * diary-helpers.ts — чистые хелперы для встроенных дневников.
 * Без React, без UI, без localStorage. Импортируются тестами и компонентом.
 */

export type DiaryEntryLike = { date: string; fields: { label: string; value: string; unit: string }[] };

export type DiaryKey =
  | 'sleep' | 'bp' | 'weight' | 'measurements'
  | 'injection' | 'symptoms' | 'pain' | 'neuro' | 'acne' | 'hemato';

export const todayIso = (): string => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const localDateKey = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const computeStreak = (
  entries: { date: string }[]
): { current: number; best: number; totalDays: number } => {
  if (entries.length === 0) return { current: 0, best: 0, totalDays: 0 };
  const sorted = [...entries].map(e => e.date).sort();
  const unique = Array.from(new Set(sorted));
  const todayMs = Date.now();
  const dayMs = 86400000;
  let current = 0;
  const startCursor = new Date(todayMs);
  startCursor.setHours(0, 0, 0, 0);
  let cursor: Date = new Date(startCursor);
  while (unique.includes(localDateKey(cursor))) {
    current += 1;
    cursor = new Date(cursor.getTime() - dayMs);
  }
  if (current === 0) {
    const last = unique[unique.length - 1];
    const lastMs = Date.parse(last);
    if (Number.isFinite(lastMs)) {
      const diffDays = Math.floor((todayMs - lastMs) / dayMs);
      if (diffDays <= 2) {
        const lastDate = new Date(lastMs);
        lastDate.setHours(0, 0, 0, 0);
        cursor = new Date(lastDate);
        current = 0;
        while (unique.includes(localDateKey(cursor))) {
          current += 1;
          cursor = new Date(cursor.getTime() - dayMs);
        }
      }
    }
  }
  let best = 0;
  let run = 1;
  for (let i = 1; i < unique.length; i++) {
    const prev = Date.parse(unique[i - 1]);
    const cur = Date.parse(unique[i]);
    if (Number.isFinite(prev) && Number.isFinite(cur) && cur - prev === dayMs) {
      run += 1;
    } else {
      if (run > best) best = run;
      run = 1;
    }
  }
  if (run > best) best = run;
  return { current, best, totalDays: unique.length };
};

const extractValue = (
  key: DiaryKey,
  e: DiaryEntryLike
): number | null => {
  if (key === 'sleep') {
    const f = e.fields.find(x => x.label === 'Часы');
    if (!f) return null;
    const v = parseFloat(f.value);
    return Number.isFinite(v) ? v : null;
  }
  if (key === 'weight') {
    const f = e.fields.find(x => x.label === 'Вес');
    if (!f) return null;
    const v = parseFloat(f.value);
    return Number.isFinite(v) ? v : null;
  }
  if (key === 'pain' || key === 'acne') {
    const f = e.fields.find(x => x.label === 'Суммарно');
    if (!f) return null;
    const v = parseFloat(f.value);
    return Number.isFinite(v) ? v : null;
  }
  if (key === 'neuro' || key === 'hemato') {
    const f = e.fields.find(x => x.label === 'Симптомов');
    if (!f) return null;
    const v = parseFloat(f.value);
    return Number.isFinite(v) ? v : null;
  }
  if (key === 'bp') {
    const sys = e.fields.find(x => x.label === 'Систола');
    const dia = e.fields.find(x => x.label === 'Диастола');
    if (!sys || !dia) return null;
    const s = parseFloat(sys.value);
    const d = parseFloat(dia.value);
    if (!Number.isFinite(s) || !Number.isFinite(d)) return null;
    return (s + d) / 2;
  }
  return null;
};

export const computePeriodDelta = (
  key: DiaryKey,
  entries: DiaryEntryLike[]
): { label: string; value: string; delta: number; color: string } | null => {
  if (entries.length < 4) return null;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const half = Math.floor(sorted.length / 2);
  const earlier = sorted.slice(0, half);
  const recent = sorted.slice(half);
  const avg = (arr: DiaryEntryLike[]) => {
    const vals = arr.map(e => extractValue(key, e)).filter((v): v is number => v !== null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };
  const avgEarlier = avg(earlier);
  const avgRecent = avg(recent);
  if (avgEarlier === null || avgRecent === null) return null;
  const delta = avgRecent - avgEarlier;
  const direction = delta > 0.05 ? '↑' : delta < -0.05 ? '↓' : '=';
  const isPositiveWhenRising = key === 'sleep';
  const isImprovement = isPositiveWhenRising ? delta > 0 : delta < 0;
  const isNeutral = key === 'weight' || key === 'bp';
  const trendColor = Math.abs(delta) < 0.05
    ? '#6b7280'
    : (isNeutral ? '#60a5fa' : (isImprovement ? '#22c55e' : '#ef4444'));
  return {
    label: `Тренд ${half} vs ${sorted.length - half}`,
    value: `${direction} ${Math.abs(delta).toFixed(1)}`,
    delta,
    color: trendColor,
  };
};

export const computeExtremes = (
  key: DiaryKey,
  entries: DiaryEntryLike[]
): { min: { date: string; value: number } | null; max: { date: string; value: number } | null } => {
  const result: { min: { date: string; value: number } | null; max: { date: string; value: number } | null } = { min: null, max: null };
  if (entries.length === 0) return result;
  for (const e of entries) {
    const v = extractValue(key, e);
    if (v === null) continue;
    if (!result.min || v < result.min.value) result.min = { date: e.date, value: v };
    if (!result.max || v > result.max.value) result.max = { date: e.date, value: v };
  }
  return result;
};

export const groupEntriesByPeriod = (
  entries: DiaryEntryLike[]
): { label: string; entries: DiaryEntryLike[] }[] => {
  if (entries.length === 0) return [];
  const groups: Record<string, DiaryEntryLike[]> = {};
  const order: string[] = [];
  for (const e of entries) {
    const d = new Date(e.date);
    if (isNaN(d.getTime())) continue;
    const startOfWeek = new Date(d);
    startOfWeek.setHours(0, 0, 0, 0);
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    startOfWeek.setDate(d.getDate() - dow);
    const key = startOfWeek.toISOString().slice(0, 10);
    if (!groups[key]) { groups[key] = []; order.push(key); }
    groups[key].push(e);
  }
  return order.reverse().map(k => {
    const start = new Date(k);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
    return {
      label: `Неделя ${fmt(start)} – ${fmt(end)}`,
      entries: groups[k],
    };
  });
};

export const buildSparkline = (
  key: DiaryKey,
  entries: DiaryEntryLike[]
): { date: string; value: number }[] => {
  const out: { date: string; value: number }[] = [];
  for (const e of entries) {
    const v = extractValue(key, e);
    if (v !== null) out.push({ date: e.date, value: v });
  }
  return out;
};

export interface DiaryGoals { sleepHours: number; weightKg: number; systolicTarget: number; }

export const defaultGoals = (): DiaryGoals => ({ sleepHours: 0, weightKg: 0, systolicTarget: 0 });

export const computeSummary = (
  key: DiaryKey,
  entries: DiaryEntryLike[]
): { label: string; value: string; color: string }[] | null => {
  if (entries.length === 0) return null;
  const out: { label: string; value: string; color: string }[] = [];
  if (key === 'sleep') {
    const hours = entries.map(e => extractValue('sleep', e)).filter((v): v is number => v !== null);
    if (hours.length) {
      const avg = hours.reduce((s, v) => s + v, 0) / hours.length;
      out.push({ label: 'Записей', value: String(hours.length), color: '#a78bfa' });
      out.push({ label: 'Среднее', value: `${avg.toFixed(1)} ч`, color: '#a78bfa' });
      out.push({ label: 'Мин/Макс', value: `${Math.min(...hours).toFixed(1)} / ${Math.max(...hours).toFixed(1)}`, color: '#a78bfa' });
    }
  } else if (key === 'bp') {
    const sys = entries.map(e => parseFloat(e.fields.find(x => x.label === 'Систола')?.value || 'NaN')).filter(Number.isFinite);
    const dia = entries.map(e => parseFloat(e.fields.find(x => x.label === 'Диастола')?.value || 'NaN')).filter(Number.isFinite);
    if (sys.length) {
      out.push({ label: 'Записей', value: String(sys.length), color: '#ef4444' });
      out.push({ label: 'Ср. сист.', value: `${(sys.reduce((s, v) => s + v, 0) / sys.length).toFixed(0)}`, color: '#ef4444' });
    }
    if (dia.length) {
      out.push({ label: 'Ср. диаст.', value: `${(dia.reduce((s, v) => s + v, 0) / dia.length).toFixed(0)}`, color: '#ef4444' });
    }
  } else if (key === 'weight') {
    const w = entries.map(e => extractValue('weight', e)).filter((v): v is number => v !== null);
    if (w.length) {
      const first = w[w.length - 1];
      const last = w[0];
      const delta = last - first;
      out.push({ label: 'Записей', value: String(w.length), color: '#22c55e' });
      out.push({ label: 'Текущий', value: `${last.toFixed(1)} кг`, color: '#22c55e' });
      out.push({ label: 'Δ за период', value: `${delta > 0 ? '+' : ''}${delta.toFixed(1)} кг`, color: delta > 0 ? '#22c55e' : delta < 0 ? '#ef4444' : '#22c55e' });
    }
  } else if (key === 'measurements') {
    out.push({ label: 'Записей', value: String(entries.length), color: '#3b82f6' });
    const last = entries[0];
    const waist = last.fields.find(x => x.label === 'Талия')?.value;
    const bf = last.fields.find(x => x.label === '% жира')?.value;
    if (waist) out.push({ label: 'Талия', value: `${waist} см`, color: '#3b82f6' });
    if (bf && Number(bf) > 0) out.push({ label: '% жира', value: `${bf}%`, color: '#3b82f6' });
  } else if (key === 'injection' || key === 'symptoms') {
    out.push({ label: 'Записей', value: String(entries.length), color: '#f59e0b' });
    if (entries[0]) out.push({ label: 'Последняя', value: new Date(entries[0].date).toLocaleDateString('ru-RU'), color: '#f59e0b' });
  } else if (key === 'pain' || key === 'acne') {
    const totals = entries.map(e => extractValue(key, e)).filter((v): v is number => v !== null);
    if (totals.length) {
      const avg = totals.reduce((s, v) => s + v, 0) / totals.length;
      const colorByLevel = avg < (key === 'pain' ? 20 : 4) ? '#22c55e' : avg < (key === 'pain' ? 40 : 7) ? '#f59e0b' : avg < (key === 'pain' ? 60 : 9) ? '#f97316' : '#ef4444';
      const max = key === 'pain' ? 70 : 12;
      out.push({ label: 'Записей', value: String(totals.length), color: colorByLevel });
      out.push({ label: 'Ср. Σ', value: `${avg.toFixed(1)}/${max}`, color: colorByLevel });
      out.push({ label: 'Макс Σ', value: `${Math.max(...totals).toFixed(0)}/${max}`, color: colorByLevel });
    }
  } else if (key === 'neuro' || key === 'hemato') {
    const scores = entries.map(e => extractValue(key, e)).filter((v): v is number => v !== null);
    if (scores.length) {
      const avg = scores.reduce((s, v) => s + v, 0) / scores.length;
      const max = key === 'neuro' ? 10 : 8;
      const warnLevel = key === 'neuro' ? 2 : 1;
      const dangerLevel = key === 'neuro' ? 4 : 2;
      const colorByLevel = avg >= dangerLevel ? '#ef4444' : avg >= warnLevel ? '#f59e0b' : '#22c55e';
      out.push({ label: 'Записей', value: String(scores.length), color: colorByLevel });
      out.push({ label: 'Ср. симптомов', value: `${avg.toFixed(1)}/${max}`, color: colorByLevel });
      out.push({ label: 'Макс', value: `${Math.max(...scores)}/${max}`, color: colorByLevel });
    }
  }
  return out;
};

export const targetHit = (
  key: DiaryKey,
  entries: DiaryEntryLike[],
  goals: DiaryGoals
): { onTarget: boolean; details: string } | null => {
  const last = entries[0];
  if (!last) return null;
  if (key === 'sleep' && goals.sleepHours > 0) {
    const hours = extractValue('sleep', last);
    if (hours === null) return null;
    const onTarget = hours >= goals.sleepHours;
    return { onTarget, details: `${hours.toFixed(1)} ч / цель ${goals.sleepHours} ч` };
  }
  if (key === 'weight' && goals.weightKg > 0) {
    const w = extractValue('weight', last);
    if (w === null) return null;
    const diff = w - goals.weightKg;
    const onTarget = Math.abs(diff) <= 0.5;
    return { onTarget, details: `${w.toFixed(1)} кг / цель ${goals.weightKg} кг (Δ ${diff > 0 ? '+' : ''}${diff.toFixed(1)})` };
  }
  if (key === 'bp' && goals.systolicTarget > 0) {
    const sys = last.fields.find(x => x.label === 'Систола')?.value;
    if (!sys) return null;
    const n = parseFloat(sys);
    if (!Number.isFinite(n)) return null;
    return { onTarget: n <= goals.systolicTarget, details: `${n.toFixed(0)} / цель ≤ ${goals.systolicTarget}` };
  }
  return null;
};

export const detectAnomalies = (
  key: DiaryKey,
  entries: DiaryEntryLike[]
): { date: string; severity: 'warn' | 'danger'; message: string }[] => {
  const issues: { date: string; severity: 'warn' | 'danger'; message: string }[] = [];
  if (entries.length === 0) return issues;
  for (const e of entries) {
    if (key === 'bp') {
      const sys = parseFloat(e.fields.find(x => x.label === 'Систола')?.value || 'NaN');
      const dia = parseFloat(e.fields.find(x => x.label === 'Диастола')?.value || 'NaN');
      const pulse = parseFloat(e.fields.find(x => x.label === 'Пульс')?.value || 'NaN');
      if (Number.isFinite(sys) && sys >= 160) issues.push({ date: e.date, severity: 'danger', message: `АД ${sys.toFixed(0)} (высокая систола)` });
      else if (Number.isFinite(sys) && sys >= 140) issues.push({ date: e.date, severity: 'warn', message: `АД ${sys.toFixed(0)} (умеренно повышено)` });
      if (Number.isFinite(dia) && dia >= 100) issues.push({ date: e.date, severity: 'danger', message: `Диастола ${dia.toFixed(0)} (высокая)` });
      else if (Number.isFinite(dia) && dia >= 90) issues.push({ date: e.date, severity: 'warn', message: `Диастола ${dia.toFixed(0)} (умеренно повышено)` });
      if (Number.isFinite(pulse) && pulse >= 100) issues.push({ date: e.date, severity: 'warn', message: `Пульс ${pulse.toFixed(0)} (тахикардия)` });
      if (Number.isFinite(pulse) && pulse < 50 && pulse > 0) issues.push({ date: e.date, severity: 'warn', message: `Пульс ${pulse.toFixed(0)} (брадикардия)` });
    } else if (key === 'sleep') {
      const hours = parseFloat(e.fields.find(x => x.label === 'Часы')?.value || 'NaN');
      if (Number.isFinite(hours) && hours < 5) issues.push({ date: e.date, severity: 'danger', message: `Сон ${hours.toFixed(1)} ч (очень мало)` });
      else if (Number.isFinite(hours) && hours < 6) issues.push({ date: e.date, severity: 'warn', message: `Сон ${hours.toFixed(1)} ч (мало)` });
    } else if (key === 'pain') {
      const total = parseFloat(e.fields.find(x => x.label === 'Суммарно')?.value || 'NaN');
      if (Number.isFinite(total) && total >= 60) issues.push({ date: e.date, severity: 'danger', message: `Боль Σ=${total.toFixed(0)}/70 (критично)` });
      else if (Number.isFinite(total) && total >= 40) issues.push({ date: e.date, severity: 'warn', message: `Боль Σ=${total.toFixed(0)}/70 (выражено)` });
    } else if (key === 'neuro') {
      const sc = parseFloat(e.fields.find(x => x.label === 'Симптомов')?.value || 'NaN');
      if (Number.isFinite(sc) && sc >= 6) issues.push({ date: e.date, severity: 'danger', message: `Нейро Σ=${sc}/10 (тяжёлое)` });
      else if (Number.isFinite(sc) && sc >= 4) issues.push({ date: e.date, severity: 'warn', message: `Нейро Σ=${sc}/10 (умеренно)` });
    } else if (key === 'acne') {
      const total = parseFloat(e.fields.find(x => x.label === 'Суммарно')?.value || 'NaN');
      if (Number.isFinite(total) && total >= 9) issues.push({ date: e.date, severity: 'danger', message: `Акне Σ=${total.toFixed(0)}/12 (тяжёлое)` });
      else if (Number.isFinite(total) && total >= 7) issues.push({ date: e.date, severity: 'warn', message: `Акне Σ=${total.toFixed(0)}/12 (выражено)` });
    } else if (key === 'hemato') {
      const sc = parseFloat(e.fields.find(x => x.label === 'Симптомов')?.value || 'NaN');
      if (Number.isFinite(sc) && sc >= 3) issues.push({ date: e.date, severity: 'danger', message: `Гемат Σ=${sc}/8 (требуется ОАК)` });
    }
  }
  return issues;
};

export const filterByRange = (
  entries: DiaryEntryLike[],
  rangeDays: 'all' | '7' | '30' | '90'
): DiaryEntryLike[] => {
  if (rangeDays === 'all') return entries;
  const cutoff = Date.now() - Number(rangeDays) * 86400000;
  return entries.filter(e => {
    const d = Date.parse(e.date);
    if (Number.isNaN(d)) return true;
    return d >= cutoff;
  });
};

// ─── Статистика распределения ──────────────────────────────────────────────

export interface DistributionStats {
  count: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  stdDev: number;
  p25: number;
  p75: number;
  iqr: number;
}

export const computeDistribution = (values: number[]): DistributionStats | null => {
  const v = values.filter(x => Number.isFinite(x));
  if (v.length < 2) return null;
  const sorted = [...v].sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const sum = v.reduce((s, x) => s + x, 0);
  const mean = sum / v.length;
  const variance = v.reduce((s, x) => s + (x - mean) ** 2, 0) / v.length;
  const stdDev = Math.sqrt(variance);
  const q = (p: number) => {
    const idx = (sorted.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    if (lo === hi) return sorted[lo];
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  };
  const median = q(0.5);
  const p25 = q(0.25);
  const p75 = q(0.75);
  return { count: v.length, min, max, mean, median, stdDev, p25, p75, iqr: p75 - p25 };
};

// ─── Зоны нормы по типу дневника ───────────────────────────────────────────

export interface NormalRange {
  low: number;
  high: number;
  warnLow?: number;
  warnHigh?: number;
  unit: string;
  description: string;
}

const NORMAL_RANGES: Partial<Record<DiaryKey, NormalRange>> = {
  sleep: { low: 7, high: 9, warnLow: 6, warnHigh: 10, unit: 'ч', description: 'Норма сна для взрослого: 7–9 ч' },
  bp: { low: 90, high: 120, warnLow: 80, warnHigh: 140, unit: 'мм рт.ст.', description: 'Норма систолического АД: 90–120' },
  weight: { low: 50, high: 120, unit: 'кг', description: 'Вес в пределах нормы ИМТ' },
  measurements: { low: 60, high: 100, unit: 'см', description: 'Талия в пределах нормы' },
  pain: { low: 0, high: 20, warnLow: 0, warnHigh: 40, unit: '/70', description: 'Боль в суставах: ≤20 из 70' },
  neuro: { low: 0, high: 1, warnLow: 0, warnHigh: 4, unit: '/10', description: 'Нейросимптомы: ≤1 из 10' },
  acne: { low: 0, high: 3, warnLow: 0, warnHigh: 7, unit: '/12', description: 'Акне: ≤3 из 12' },
  hemato: { low: 0, high: 1, warnLow: 0, warnHigh: 2, unit: '/8', description: 'Гематологические симптомы: ≤1 из 8' },
};

export const getNormalRange = (key: DiaryKey): NormalRange | null => NORMAL_RANGES[key] || null;

export const classifyValue = (key: DiaryKey, value: number): 'normal' | 'warn' | 'danger' | 'unknown' => {
  const r = NORMAL_RANGES[key];
  if (!r) return 'unknown';
  if (value >= r.low && value <= r.high) return 'normal';
  if (r.warnLow !== undefined && value < r.warnLow) return 'danger';
  if (r.warnHigh !== undefined && value > r.warnHigh) return 'danger';
  return 'warn';
};

// ─── Гистограмма по неделям ────────────────────────────────────────────────

export const buildWeeklyHistogram = (
  values: { date: string; value: number }[]
): { weekStart: string; count: number; sum: number; mean: number; min: number; max: number }[] => {
  if (values.length === 0) return [];
  const groups: Record<string, number[]> = {};
  for (const v of values) {
    const d = new Date(v.date);
    if (isNaN(d.getTime())) continue;
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    start.setDate(d.getDate() - dow);
    const key = start.toISOString().slice(0, 10);
    if (!groups[key]) groups[key] = [];
    if (Number.isFinite(v.value)) groups[key].push(v.value);
  }
  const result: { weekStart: string; count: number; sum: number; mean: number; min: number; max: number }[] = [];
  for (const k of Object.keys(groups).sort()) {
    const arr = groups[k];
    if (arr.length === 0) continue;
    result.push({
      weekStart: k,
      count: arr.length,
      sum: arr.reduce((s, v) => s + v, 0),
      mean: arr.reduce((s, v) => s + v, 0) / arr.length,
      min: Math.min(...arr),
      max: Math.max(...arr),
    });
  }
  return result;
};

// ─── Распределение по часам суток (для дневников с полем «время») ─────────

export const buildHourDistribution = (dates: string[]): { hour: number; count: number }[] => {
  const counts = new Array(24).fill(0);
  for (const d of dates) {
    const date = new Date(d);
    if (isNaN(date.getTime())) continue;
    counts[date.getHours()]++;
  }
  return counts.map((c, i) => ({ hour: i, count: c }));
};

// ─── Экспорт SVG в PNG через Canvas ────────────────────────────────────────

export const exportSvgAsPng = (svgEl: SVGSVGElement, filename: string) => {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgEl);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const w = svgEl.clientWidth || svgEl.viewBox.baseVal.width || 600;
    const h = svgEl.clientHeight || svgEl.viewBox.baseVal.height || 200;
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = w * scale;
    canvas.height = h * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) { URL.revokeObjectURL(url); return; }
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((pngBlob) => {
      if (!pngBlob) { URL.revokeObjectURL(url); return; }
      const pngUrl = URL.createObjectURL(pngBlob);
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => { URL.revokeObjectURL(pngUrl); URL.revokeObjectURL(url); }, 500);
    }, 'image/png');
  };
  img.onerror = () => URL.revokeObjectURL(url);
  img.src = url;
};

// ─── Экспорт SVG как файл ──────────────────────────────────────────────────

export const exportSvgAsFile = (svgEl: SVGSVGElement, filename: string) => {
  const serializer = new XMLSerializer();
  const svgString = serializer.serializeToString(svgEl);
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
};
