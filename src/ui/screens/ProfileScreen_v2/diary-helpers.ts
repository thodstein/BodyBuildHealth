/**
 * diary-helpers.ts — чистые хелперы для встроенных дневников.
 * Без React, без UI, без localStorage. Импортируются тестами и компонентом.
 */

export type DiaryEntryLike = { id?: string; date: string; fields: { label: string; value: string; unit: string }[] };

export type DiaryKey =
  | 'sleep' | 'bp' | 'weight' | 'measurements'
   | 'injection' | 'health' | 'symptoms' | 'pain' | 'neuro' | 'acne' | 'hemato' | 'cardio';

export const PAIN_ZONE_LIST = [
  { id: 'shoulders', label: 'Плечи' }, { id: 'elbows', label: 'Локти' },
  { id: 'wrists', label: 'Запястья' }, { id: 'lower_back', label: 'Поясница' },
  { id: 'hips', label: 'ТБС' }, { id: 'knees', label: 'Колени' },
  { id: 'ankles', label: 'Голеностоп' },
] as const;

export interface PainZoneStat { zoneId: string; label: string; avg: number; last: number; trend: 'up' | 'down' | 'same'; }

export const computeZoneBreakdown = (entries: Array<{ zones?: Record<string, number> }>): PainZoneStat[] => PAIN_ZONE_LIST.map(zone => {
  const values = entries.map(e => e.zones?.[zone.id]).filter((v): v is number => Number.isFinite(v));
  const last = values.at(-1) ?? 0;
  const previous = values.at(-2) ?? last;
  return { zoneId: zone.id, label: zone.label, avg: values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0, last, trend: last > previous + 0.3 ? 'up' : last < previous - 0.3 ? 'down' : 'same' };
});

export const getMostPainfulZone = (entries: Array<{ zones?: Record<string, number> }>): { label: string; score: number } | null => {
  const stats = computeZoneBreakdown(entries);
  const worst = stats.reduce<PainZoneStat | null>((best, current) => !best || current.avg > best.avg ? current : best, null);
  return worst && worst.avg > 0 ? { label: worst.label, score: Math.round(worst.avg * 10) / 10 } : null;
};

export const computePainImprovementStreak = (entries: Array<{ totalScore: number }>): { streak: number; trend: 'improving' | 'stable' | 'worsening' } => {
  if (entries.length < 2) return { streak: entries.length, trend: 'stable' };
  let streak = 1;
  let direction: 'improving' | 'worsening' | 'stable' = 'stable';
  for (let i = entries.length - 1; i > 0; i--) {
    const delta = entries[i].totalScore - entries[i - 1].totalScore;
    const next = delta < 0 ? 'improving' : delta > 0 ? 'worsening' : 'stable';
    if (next === 'stable' || (direction !== 'stable' && next !== direction)) break;
    direction = next;
    streak++;
  }
  return { streak, trend: direction };
};

export const computeTimeOfDayBreakdown = (entries: Array<{ timeOfDay?: string; totalScore: number }>) => {
  const groups = new Map<string, number[]>();
  entries.forEach(e => { if (e.timeOfDay) groups.set(e.timeOfDay, [...(groups.get(e.timeOfDay) || []), e.totalScore]); });
  return [...groups].map(([label, values]) => ({ label, avgScore: values.reduce((s, v) => s + v, 0) / values.length, count: values.length })).sort((a, b) => b.avgScore - a.avgScore);
};

export const computeTriggerFrequency = (entries: Array<{ triggers?: string[] }>) => {
  const total = entries.length || 1; const counts = new Map<string, number>();
  entries.flatMap(e => e.triggers || []).forEach(t => counts.set(t, (counts.get(t) || 0) + 1));
  return [...counts].map(([trigger, count]) => ({ trigger, count, pct: Math.round(count / total * 100) })).sort((a, b) => b.count - a.count);
};

export const computePainTypeDistribution = (entries: Array<{ painType?: string; totalScore: number }>) => {
  const groups = new Map<string, number[]>();
  entries.forEach(e => { if (e.painType) groups.set(e.painType, [...(groups.get(e.painType) || []), e.totalScore]); });
  return [...groups].map(([type, values]) => ({ type, count: values.length, avgScore: values.reduce((s, v) => s + v, 0) / values.length })).sort((a, b) => b.count - a.count);
};

export const computeReliefEffectiveness = (entries: Array<{ relief?: string[]; totalScore: number }>) => {
  const groups = new Map<string, number[]>();
  entries.forEach(e => (e.relief || []).forEach(method => groups.set(method, [...(groups.get(method) || []), e.totalScore])));
  return [...groups].map(([method, values]) => ({ method, count: values.length, avgScore: values.reduce((s, v) => s + v, 0) / values.length, pctWithRelief: Math.round(values.filter(v => v <= 3).length / values.length * 100) })).sort((a, b) => b.pctWithRelief - a.pctWithRelief);
};

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

/** Локальный ISO-ключ даты (YYYY-MM-DD). Экспортирован для компонентов, группирующих по неделям. */
export const toLocalIso = (d: Date): string => localDateKey(d);

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
       if (diffDays <= 1) {
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
    // HealthDiary v2 использует label «Боль»/«Акне», legacy — «Суммарно»
    const f = e.fields.find(x => x.label === 'Суммарно' || x.label === 'Боль' || x.label === 'Акне');
    if (!f) return null;
    const v = parseFloat(f.value);
    return Number.isFinite(v) ? v : null;
  }
  if (key === 'neuro' || key === 'hemato') {
    // HealthDiary v2 использует label «Нейро»/«Гемат», legacy — «Симптомов»
    const f = e.fields.find(x => x.label === 'Симптомов' || x.label === 'Нейро' || x.label === 'Гемат');
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
    const key = localDateKey(startOfWeek);
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

      // Body fat analysis
      const bfEntries = entries
        .map(e => e.fields.find(f => f.label === '% жира'))
        .filter((f): f is { label: string; value: string; unit: string } => !!f && Number.isFinite(parseFloat(f.value)))
        .map(f => parseFloat(f.value));
      if (bfEntries.length) {
        const lastBf = bfEntries[0];
        const firstBf = bfEntries[bfEntries.length - 1];
        const bfDelta = lastBf - firstBf;
        out.push({ label: '% жира (текущий)', value: `${lastBf.toFixed(1)}%`, color: '#f59e0b' });
        out.push({ label: 'Δ % жира', value: `${bfDelta > 0 ? '+' : ''}${bfDelta.toFixed(1)}%`, color: bfDelta < 0 ? '#22c55e' : bfDelta > 0 ? '#ef4444' : '#f59e0b' });
      }

      // Lean mass analysis
      const lmEntries = entries
        .map(e => e.fields.find(f => f.label === 'Мышечная масса'))
        .filter((f): f is { label: string; value: string; unit: string } => !!f && Number.isFinite(parseFloat(f.value)))
        .map(f => parseFloat(f.value));
      if (lmEntries.length) {
        const lastLm = lmEntries[0];
        const firstLm = lmEntries[lmEntries.length - 1];
        const lmDelta = lastLm - firstLm;
        out.push({ label: 'Мышечная масса', value: `${lastLm.toFixed(1)} кг`, color: '#3b82f6' });
        out.push({ label: 'Δ мышц', value: `${lmDelta > 0 ? '+' : ''}${lmDelta.toFixed(1)} кг`, color: lmDelta > 0 ? '#22c55e' : lmDelta < 0 ? '#ef4444' : '#3b82f6' });
      }

      // Waist analysis
      const waistEntries = entries
        .map(e => e.fields.find(f => f.label === 'Талия'))
        .filter((f): f is { label: string; value: string; unit: string } => !!f && Number.isFinite(parseFloat(f.value)))
        .map(f => parseFloat(f.value));
      if (waistEntries.length) {
        const lastWaist = waistEntries[0];
        const firstWaist = waistEntries[waistEntries.length - 1];
        const waistDelta = lastWaist - firstWaist;
        out.push({ label: 'Талия', value: `${lastWaist.toFixed(1)} см`, color: '#8b5cf6' });
        out.push({ label: 'Δ талия', value: `${waistDelta > 0 ? '+' : ''}${waistDelta.toFixed(1)} см`, color: waistDelta < 0 ? '#22c55e' : waistDelta > 0 ? '#ef4444' : '#8b5cf6' });
      }

      // Weekly rate of change
      if (entries.length >= 2) {
        const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
        const daysDiff = (Date.parse(sorted[sorted.length - 1].date) - Date.parse(sorted[0].date)) / 86400000;
        if (daysDiff > 0) {
          const weeklyRate = (delta / daysDiff) * 7;
          out.push({ label: 'Темп/нед', value: `${weeklyRate > 0 ? '+' : ''}${weeklyRate.toFixed(2)} кг/нед`, color: weeklyRate > 0.5 ? '#ef4444' : weeklyRate < -0.5 ? '#f59e0b' : '#22c55e' });
        }
      }
    }
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
  if (key === 'weight') {
    // Скачки веса между соседними днями (в пределах 2 дней) и нереалистичные значения
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const vals: { date: string; w: number }[] = [];
    for (const e of sorted) {
      const w = extractValue('weight', e);
      if (w !== null && Number.isFinite(w)) vals.push({ date: e.date, w });
    }
    for (let i = 1; i < vals.length; i++) {
      const prevMs = Date.parse(vals[i - 1].date);
      const curMs = Date.parse(vals[i].date);
      if (!Number.isFinite(prevMs) || !Number.isFinite(curMs)) continue;
      const dayDiff = (curMs - prevMs) / 86400000;
      if (dayDiff <= 0 || dayDiff > 2) continue; // пропуски в ведении не считаем скачком
      const delta = vals[i].w - vals[i - 1].w;
      const pct = vals[i - 1].w > 0 ? (Math.abs(delta) / vals[i - 1].w) * 100 : 0;
      if (pct >= 5 || Math.abs(delta) >= 5) {
        issues.push({ date: vals[i].date, severity: 'danger', message: `Скачок веса ${delta > 0 ? '+' : ''}${delta.toFixed(1)} кг за день` });
      } else if (pct >= 2 || Math.abs(delta) >= 2) {
        issues.push({ date: vals[i].date, severity: 'warn', message: `Скачок веса ${delta > 0 ? '+' : ''}${delta.toFixed(1)} кг за день` });
      }
    }
    for (const e of sorted) {
      const w = extractValue('weight', e);
      if (w !== null && (w < 25 || w > 350)) {
        issues.push({ date: e.date, severity: 'warn', message: `Вес ${w.toFixed(1)} кг вне правдоподобного диапазона (25–350)` });
      }
    }
    return issues;
  }
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
      const quality = parseFloat(e.fields.find(x => x.label === 'Качество')?.value || 'NaN');
      const latency = parseFloat(e.fields.find(x => x.label === 'Латентность')?.value || 'NaN');
      const alcohol = e.fields.find(x => x.label === 'Алкоголь')?.value === 'да';
      if (Number.isFinite(hours) && hours < 5) issues.push({ date: e.date, severity: 'danger', message: `Сон ${hours.toFixed(1)} ч (очень мало)` });
      else if (Number.isFinite(hours) && hours < 6) issues.push({ date: e.date, severity: 'warn', message: `Сон ${hours.toFixed(1)} ч (мало)` });
      if (Number.isFinite(quality) && quality <= 1) issues.push({ date: e.date, severity: 'danger', message: 'Качество сна 1/5 (критично низкое)' });
      else if (Number.isFinite(quality) && quality === 2) issues.push({ date: e.date, severity: 'warn', message: 'Качество сна 2/5 (низкое)' });
      if (Number.isFinite(latency) && latency > 45) issues.push({ date: e.date, severity: 'warn', message: `Засыпание ${latency.toFixed(0)} мин (долгое)` });
      if (alcohol && Number.isFinite(quality) && quality <= 2)
        issues.push({ date: e.date, severity: 'warn', message: 'Алкоголь + плохое качество сна' });
    } else if (key === 'pain') {
      const total = extractValue('pain', e);
      if (total !== null && total >= 60) issues.push({ date: e.date, severity: 'danger', message: `Боль Σ=${total.toFixed(0)}/70 (критично)` });
      else if (total !== null && total >= 40) issues.push({ date: e.date, severity: 'warn', message: `Боль Σ=${total.toFixed(0)}/70 (выражено)` });
    } else if (key === 'neuro') {
      const sc = extractValue('neuro', e);
      if (sc !== null && sc >= 6) issues.push({ date: e.date, severity: 'danger', message: `Нейро Σ=${sc.toFixed(0)}/10 (тяжёлое)` });
      else if (sc !== null && sc >= 4) issues.push({ date: e.date, severity: 'warn', message: `Нейро Σ=${sc.toFixed(0)}/10 (умеренно)` });
    } else if (key === 'acne') {
      const total = extractValue('acne', e);
      if (total !== null && total >= 9) issues.push({ date: e.date, severity: 'danger', message: `Акне Σ=${total.toFixed(0)}/12 (тяжёлое)` });
      else if (total !== null && total >= 7) issues.push({ date: e.date, severity: 'warn', message: `Акне Σ=${total.toFixed(0)}/12 (выражено)` });
    } else if (key === 'hemato') {
      const sc = extractValue('hemato', e);
      if (sc !== null && sc >= 3) issues.push({ date: e.date, severity: 'danger', message: `Гемат Σ=${sc.toFixed(0)}/8 (требуется ОАК)` });
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

// ─── Сравнение с прошлой неделей ──────────────────────────────────────────

export const compareWithLastWeek = (
  entries: { date: string; value: number }[]
): { thisWeek: { mean: number; count: number } | null; lastWeek: { mean: number; count: number } | null; delta: number | null; pct: number | null; better: 'up' | 'down' | 'same' | null } => {
  if (entries.length < 2) return { thisWeek: null, lastWeek: null, delta: null, pct: null, better: null };
  const now = Date.now();
  const weekAgoStart = now - 7 * 86400000;
  const twoWeeksAgoStart = now - 14 * 86400000;
  const thisWeekValues: number[] = [];
  const lastWeekValues: number[] = [];
  for (const e of entries) {
    const t = Date.parse(e.date);
    if (!Number.isFinite(t) || !Number.isFinite(e.value)) continue;
    if (t >= weekAgoStart) thisWeekValues.push(e.value);
    else if (t >= twoWeeksAgoStart) lastWeekValues.push(e.value);
  }
  if (thisWeekValues.length === 0 && lastWeekValues.length === 0) {
    return { thisWeek: null, lastWeek: null, delta: null, pct: null, better: null };
  }
  const avg = (arr: number[]) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null;
  const thisMean = avg(thisWeekValues);
  const lastMean = avg(lastWeekValues);
  const delta = thisMean !== null && lastMean !== null ? thisMean - lastMean : null;
  const pct = delta !== null && lastMean !== null && lastMean !== 0 ? (delta / lastMean) * 100 : null;
  let better: 'up' | 'down' | 'same' | null = null;
  if (delta === null || Math.abs(delta) < 0.05) better = 'same';
  else better = delta > 0 ? 'up' : 'down';
  return {
    thisWeek: thisMean !== null ? { mean: thisMean, count: thisWeekValues.length } : null,
    lastWeek: lastMean !== null ? { mean: lastMean, count: lastWeekValues.length } : null,
    delta,
    pct,
    better,
  };
};

// ─── Сортировка и пагинация для таблицы ──────────────────────────────────

export type SortDir = 'asc' | 'desc';
export interface SortState { key: string; dir: SortDir; }

export const sortEntries = (
  entries: DiaryEntryLike[],
  sort: SortState
): DiaryEntryLike[] => {
  const sorted = [...entries];
  sorted.sort((a, b) => {
    let av: number | string = a.date;
    let bv: number | string = b.date;
    if (sort.key === 'date') {
      av = a.date; bv = b.date;
    } else {
      const af = a.fields.find(f => f.label === sort.key);
      const bf = b.fields.find(f => f.label === sort.key);
      const an = af ? parseFloat(af.value) : NaN;
      const bn = bf ? parseFloat(bf.value) : NaN;
      if (Number.isFinite(an) && Number.isFinite(bn)) {
        av = an; bv = bn;
      } else {
        av = af?.value || ''; bv = bf?.value || '';
      }
    }
    if (av < bv) return sort.dir === 'asc' ? -1 : 1;
    if (av > bv) return sort.dir === 'asc' ? 1 : -1;
    return 0;
  });
  return sorted;
};

export const paginate = <T,>(items: T[], page: number, pageSize: number): { pageItems: T[]; totalPages: number; pageStart: number; pageEnd: number; total: number } => {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, total);
  return { pageItems: items.slice(pageStart, pageEnd), totalPages, pageStart, pageEnd, total };
};

// ─── Корреляция между двумя дневниками ──────────────────────────────────

export const pearsonCorrelation = (x: number[], y: number[]): { r: number; n: number } | null => {
  const n = Math.min(x.length, y.length);
  if (n < 3) return null;
  const xs = x.slice(0, n);
  const ys = y.slice(0, n);
  const xm = xs.reduce((s, v) => s + v, 0) / n;
  const ym = ys.reduce((s, v) => s + v, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - xm;
    const b = ys[i] - ym;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  const denom = Math.sqrt(dx * dy);
  if (denom === 0) return null;
  return { r: num / denom, n };
};

/** Корреляция между двумя дневниками по датам (только совпадающие даты). */
export const crossCorrelation = (
  a: { date: string; value: number }[],
  b: { date: string; value: number }[]
): { r: number; n: number; positive: boolean; strength: 'weak' | 'moderate' | 'strong' } | null => {
  const map = new Map(a.map(p => [p.date, p.value]));
  const pairs: { x: number; y: number }[] = [];
  for (const p of b) {
    const av = map.get(p.date);
    if (av !== undefined && Number.isFinite(av) && Number.isFinite(p.value)) {
      pairs.push({ x: av, y: p.value });
    }
  }
  if (pairs.length < 3) return null;
  const xs = pairs.map(p => p.x);
  const ys = pairs.map(p => p.y);
  const res = pearsonCorrelation(xs, ys);
  if (!res) return null;
  const ar = Math.abs(res.r);
  const strength: 'weak' | 'moderate' | 'strong' = ar >= 0.7 ? 'strong' : ar >= 0.4 ? 'moderate' : 'weak';
  return { r: res.r, n: res.n, positive: res.r > 0, strength };
};

/** Лагованная корреляция: как b в будущем связан с a в прошлом (lag дней). */
export const laggedCorrelation = (
  a: { date: string; value: number }[],
  b: { date: string; value: number }[],
  lagDays: number
): { r: number; n: number; positive: boolean; strength: 'weak' | 'moderate' | 'strong' } | null => {
  const aMap = new Map(a.map(p => [p.date, p.value]));
  const lagMs = lagDays * 86400000;
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of b) {
    const target = new Date(p.date).getTime() - lagMs;
    const targetDate = new Date(target).toISOString().slice(0, 10);
    const av = aMap.get(targetDate);
    if (av !== undefined && Number.isFinite(av) && Number.isFinite(p.value)) {
      xs.push(av);
      ys.push(p.value);
    }
  }
  const res = pearsonCorrelation(xs, ys);
  if (!res) return null;
  const ar = Math.abs(res.r);
  const strength: 'weak' | 'moderate' | 'strong' = ar >= 0.7 ? 'strong' : ar >= 0.4 ? 'moderate' : 'weak';
  return { r: res.r, n: res.n, positive: res.r > 0, strength };
};

/** Расширенная корреляция между парой дневников с интерпретацией. */
export interface CrossCorrResult {
  aKey: DiaryKey;
  bKey: DiaryKey;
  r: number;
  n: number;
  positive: boolean;
  strength: 'weak' | 'moderate' | 'strong';
  label: string;
  interpretation: string;
}

/** Предопределённые пары дневников для корреляционного анализа. */
export const CORRELATION_PAIRS: { a: DiaryKey; b: DiaryKey; label: string; description: string }[] = [
  { a: 'sleep', b: 'weight', label: 'Сон ↔ Вес', description: 'Недосып повышает кортизол → удержание воды/аппетит' },
  { a: 'sleep', b: 'bp', label: 'Сон ↔ АД', description: 'Мало сна → повышение систолического/диастолического' },
  { a: 'sleep', b: 'bp', label: 'Сон ↔ Пульс', description: 'Дефицит сна → повышение пульса в покое (HRV ↓)' },
  { a: 'sleep', b: 'pain', label: 'Сон ↔ Боль', description: 'Плохой сон → снижение порога боли / хроническая боль → бессонница' },
  { a: 'sleep', b: 'neuro', label: 'Сон ↔ Нейро', description: 'Качество сна ↔ когнитивная нагрузка / настроение' },
  { a: 'weight', b: 'bp', label: 'Вес ↔ АД', description: 'Избыточный вес → гипертензия; потеря веса → нормализация' },
  { a: 'weight', b: 'cardio', label: 'Вес ↔ Кардио', description: 'Кардио облегчает дефицит калорий → потеря веса' },
  { a: 'bp', b: 'cardio', label: 'АД ↔ Кардио', description: 'Регулярное кардио → снижение АД (пост-эффект)' },
  { a: 'sleep', b: 'cardio', label: 'Сон ↔ Кардио', description: 'Кардио улучшает качество сна; но позднее — может мешать' },
  { a: 'weight', b: 'pain', label: 'Вес ↔ Боль', description: 'Избыточный вес → нагрузка на суставы/поясницу' },
  { a: 'injection', b: 'pain', label: 'Инъекции ↔ Боль', description: 'Частые уколы в одной зоне → локальная воспаленность/боль' },
  { a: 'injection', b: 'health', label: 'Инъекции ↔ Здоровье', description: 'Побочные эффекты препаратов → симптомы здоровья' },
];

/** Вычисляет все заданные корреляции между дневниками. */
export const computeAllCorrelations = (
  diaries: Record<DiaryKey, { date: string; value: number }[]>,
  pairs: { a: DiaryKey; b: DiaryKey; label: string; description: string }[] = CORRELATION_PAIRS
): CrossCorrResult[] => {
  return pairs
    .map(({ a, b, label, description }) => {
      const dataA = diaries[a];
      const dataB = diaries[b];
      if (!dataA?.length || !dataB?.length) return null;
      const corr = crossCorrelation(dataA, dataB);
      if (!corr) return null;
      let interpretation = description;
      if (corr.strength === 'strong') interpretation += '. ' + (corr.positive ? 'Прямая связь' : 'Обратная связь') + ' (сильная)';
      else if (corr.strength === 'moderate') interpretation += '. ' + (corr.positive ? 'Прямая' : 'Обратная') + ' связь (умеренная)';
      else interpretation += '. Связь слабая / незначительна';
      return { ...corr, aKey: a, bKey: b, label, interpretation };
    })
    .filter((x): x is CrossCorrResult => x !== null && 'label' in x);
};

/** Группирует корреляции по силе для удобного отображения. */
export const groupCorrelationsByStrength = (corrs: CrossCorrResult[]): Record<'strong' | 'moderate' | 'weak', CrossCorrResult[]> => ({
  strong: corrs.filter(c => c.strength === 'strong'),
  moderate: corrs.filter(c => c.strength === 'moderate'),
  weak: corrs.filter(c => c.strength === 'weak'),
});

// ─── Заполненность дневников за сегодня ──────────────────────────────────

export const dailyCompletion = (
  keys: { key: DiaryKey; hasEntry: boolean; lastDate?: string }[]
): { filled: number; total: number; pct: number; missing: DiaryKey[] } => {
  const today = todayIso();
  const isoToday = new Date().toISOString().slice(0, 10);
  const isToday = (date?: string) => date === today || date === isoToday;
  const filled = keys.filter(k => k.hasEntry && isToday(k.lastDate)).length;
  const missing = keys.filter(k => !k.hasEntry || !isToday(k.lastDate)).map(k => k.key);
  return { filled, total: keys.length, pct: keys.length > 0 ? Math.round((filled / keys.length) * 100) : 0, missing };
};

// ─── Темп-цели: «спать ≥7ч минимум 5 дней из 7 последних» ─────────────

export interface PaceTarget {
  weeklyDays: number;   // сколько дней за неделю (1..7)
  windowDays: number;   // сколько дней рассматриваем (обычно 7)
}

export const PACE_TARGETS: Partial<Record<DiaryKey, PaceTarget>> = {
  sleep: { weeklyDays: 5, windowDays: 7 },
  weight: { weeklyDays: 3, windowDays: 7 },
  bp: { weeklyDays: 3, windowDays: 7 },
  pain: { weeklyDays: 3, windowDays: 7 },
  neuro: { weeklyDays: 3, windowDays: 7 },
  acne: { weeklyDays: 3, windowDays: 7 },
  hemato: { weeklyDays: 3, windowDays: 7 },
};

export const computePace = (
  key: DiaryKey,
  entries: { date: string }[]
): { target: PaceTarget | null; achieved: number; needed: number; pct: number; ok: boolean } | null => {
  const t = PACE_TARGETS[key];
  if (!t) return null;
  const now = Date.now();
  const cutoff = now - t.windowDays * 86400000;
  const inWindow = entries.filter(e => {
    const d = Date.parse(e.date);
    return Number.isFinite(d) && d >= cutoff;
  });
  // Считаем уникальные дни
  const uniqDays = new Set(inWindow.map(e => e.date));
  return {
    target: t,
    achieved: uniqDays.size,
    needed: t.weeklyDays,
    pct: Math.round((uniqDays.size / t.weeklyDays) * 100),
    ok: uniqDays.size >= t.weeklyDays,
  };
};

// ─── Streak (серия дней подряд) — алиас для обратной совместимости ──────
/** @deprecated используйте computeStreak(entries).current — единая реализация */
export const currentStreak = (entries: { date: string }[]): number => computeStreak(entries).current;

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

export interface WeeklyHistogramGoal {
  key: DiaryKey;
  target: number;
  label: string;
  color: string;
}

export interface WeeklyHistogramEntry {
  weekStart: string;
  count: number;
  sum: number;
  mean: number;
  min: number;
  max: number;
  goal?: WeeklyHistogramGoal;
  goalStatus?: 'above' | 'below' | 'met' | 'exceeded';
}

export const buildWeeklyHistogram = (
  values: { date: string; value: number }[],
  goals?: WeeklyHistogramGoal[]
): WeeklyHistogramEntry[] => {
  if (values.length === 0) return [];
  const groups: Record<string, number[]> = {};
  for (const v of values) {
    const d = new Date(v.date);
    if (isNaN(d.getTime())) continue;
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const dow = d.getDay() === 0 ? 6 : d.getDay() - 1;
    start.setDate(d.getDate() - dow);
    const key = localDateKey(start);
    if (!groups[key]) groups[key] = [];
    if (Number.isFinite(v.value)) groups[key].push(v.value);
  }
  const result: WeeklyHistogramEntry[] = [];
  for (const k of Object.keys(groups).sort()) {
    const arr = groups[k];
    if (arr.length === 0) continue;
    const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
    const goal = goals?.find(g => g.key === 'weight' || g.key === 'sleep' || g.key === 'bp' || g.key === 'cardio');
    let goalStatus: WeeklyHistogramEntry['goalStatus'] = undefined;
    if (goal && Number.isFinite(mean)) {
      if (mean >= goal.target * 1.1) goalStatus = 'exceeded';
      else if (mean >= goal.target) goalStatus = 'met';
      else if (mean >= goal.target * 0.8) goalStatus = 'below';
      else goalStatus = 'below';
    }
    result.push({
      weekStart: k,
      count: arr.length,
      sum: arr.reduce((s, v) => s + v, 0),
      mean,
      min: Math.min(...arr),
      max: Math.max(...arr),
      goal,
      goalStatus,
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

// ─── Сводный балл сна (0-100) ────────────────────────────────────────────

export interface SleepScoreBreakdown { label: string; pct: number; ok: boolean; detail: string; }
export interface SleepScore { score: number; breakdown: SleepScoreBreakdown[]; }
export interface SleepScoreGoals { targetHours: number; targetQuality: number; targetLatency: number; targetAwakenings: number; }

export const computeSleepScore = (entries: DiaryEntryLike[], goals: SleepScoreGoals): SleepScore | null => {
  if (entries.length === 0) return null;
  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
  const hoursVals = entries.map(e => extractValue('sleep', e)).filter((v): v is number => v !== null);
  if (hoursVals.length === 0) return null;
  const qualityVals = entries
    .map(e => parseFloat(e.fields.find(f => f.label === 'Качество')?.value || 'NaN'))
    .filter(Number.isFinite);
  const latencyVals = entries
    .map(e => parseFloat(e.fields.find(f => f.label === 'Латентность')?.value || 'NaN'))
    .filter(Number.isFinite);
  const awakeningVals = entries
    .map(e => parseFloat(e.fields.find(f => f.label === 'Пробуждений')?.value || 'NaN'))
    .filter(Number.isFinite);
  const avgHours = avg(hoursVals);
  const avgQuality = qualityVals.length ? avg(qualityVals) : 0;
  const avgLatency = latencyVals.length ? avg(latencyVals) : goals.targetLatency;
  const avgAwakenings = awakeningVals.length ? avg(awakeningVals) : goals.targetAwakenings;
  const clamp = (v: number) => Math.max(0, Math.min(100, v));
  const hoursPct = clamp((avgHours / Math.max(0.1, goals.targetHours)) * 100);
  const qualityPct = clamp((avgQuality / Math.max(0.1, goals.targetQuality)) * 100);
  const latencyPct = clamp((goals.targetLatency / Math.max(1, avgLatency)) * 100);
  const awakeningsPct = clamp((goals.targetAwakenings / Math.max(0.1, avgAwakenings)) * 100);
  const breakdown: SleepScoreBreakdown[] = [
    { label: 'Часы', pct: hoursPct, ok: avgHours >= goals.targetHours, detail: `${avgHours.toFixed(1)} / ${goals.targetHours} ч` },
    { label: 'Качество', pct: qualityPct, ok: avgQuality >= goals.targetQuality, detail: `${avgQuality.toFixed(1)} / ${goals.targetQuality}` },
    { label: 'Засыпание', pct: latencyPct, ok: avgLatency <= goals.targetLatency, detail: `${avgLatency.toFixed(0)} / ≤ ${goals.targetLatency} мин` },
    { label: 'Пробуждения', pct: awakeningsPct, ok: avgAwakenings <= goals.targetAwakenings, detail: `${avgAwakenings.toFixed(1)} / ≤ ${goals.targetAwakenings}` },
  ];
  return { score: Math.round(breakdown.reduce((s, b) => s + b.pct, 0) / 4), breakdown };
};

// ─── Средние по дням недели ──────────────────────────────────────────────

export interface WeekdayAvg { dayName: string; idx: number; avgHours: number | null; avgQuality: number | null; count: number; }

export const computeWeekdayAverages = (entries: DiaryEntryLike[]): WeekdayAvg[] => {
  const days: { dayName: string; idx: number; hours: number[]; quality: number[] }[] = [
    { dayName: 'Пн', idx: 1, hours: [], quality: [] },
    { dayName: 'Вт', idx: 2, hours: [], quality: [] },
    { dayName: 'Ср', idx: 3, hours: [], quality: [] },
    { dayName: 'Чт', idx: 4, hours: [], quality: [] },
    { dayName: 'Пт', idx: 5, hours: [], quality: [] },
    { dayName: 'Сб', idx: 6, hours: [], quality: [] },
    { dayName: 'Вс', idx: 0, hours: [], quality: [] },
  ];
  for (const e of entries) {
    const d = new Date(e.date);
    if (isNaN(d.getTime())) continue;
    const day = days.find(x => x.idx === d.getDay());
    if (!day) continue;
    const h = extractValue('sleep', e);
    const q = parseFloat(e.fields.find(f => f.label === 'Качество')?.value || 'NaN');
    if (h !== null) day.hours.push(h);
    if (Number.isFinite(q)) day.quality.push(q);
  }
  return days.map(d => ({
    dayName: d.dayName,
    idx: d.idx,
    avgHours: d.hours.length ? d.hours.reduce((s, v) => s + v, 0) / d.hours.length : null,
    avgQuality: d.quality.length ? d.quality.reduce((s, v) => s + v, 0) / d.quality.length : null,
    count: d.hours.length,
  }));
};

// ─── Календарь-хитмап сна ────────────────────────────────────────────────

export interface CalendarCell { date: string; hours: number | null; quality: number | null; }

export const buildSleepCalendar = (entries: DiaryEntryLike[], days: number): CalendarCell[] => {
  const out: CalendarCell[] = [];
  const byDate = new Map<string, DiaryEntryLike>();
  for (const e of entries) byDate.set(e.date, e);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = localDateKey(d);
    const e = byDate.get(key);
    let hours: number | null = null;
    let quality: number | null = null;
    if (e) {
      hours = extractValue('sleep', e);
      const q = parseFloat(e.fields.find(f => f.label === 'Качество')?.value || 'NaN');
      quality = Number.isFinite(q) ? q : null;
    }
    out.push({ date: key, hours, quality });
  }
  return out;
};

export type SleepCellLevel = 'none' | 'bad' | 'low' | 'good' | 'great' | 'high';

export const sleepCellLevel = (hours: number | null, quality: number | null): SleepCellLevel => {
  if (hours === null) return 'none';
  if (hours < 6) return 'bad';
  if (hours < 7) return 'low';
  if (hours <= 9) return quality !== null && quality >= 4 ? 'great' : 'good';
  return 'high';
};

// ─── Тренды метрик: эта неделя vs прошлая ────────────────────────────────

export interface MetricTrend { label: string; thisWeek: number | null; lastWeek: number | null; delta: number | null; betterWhenUp: boolean; }

export const computeSleepTrends = (entries: DiaryEntryLike[]): MetricTrend[] => {
  const metrics = ['Часы', 'Качество', 'Латентность', 'Пробуждений'] as const;
  const now = Date.now();
  const weekAgo = now - 7 * 86400000;
  const twoWeeks = now - 14 * 86400000;
  const avg = (arr: number[]) => (arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : null);
  return metrics.map(label => {
    const thisVals: number[] = [];
    const lastVals: number[] = [];
    for (const e of entries) {
      const t = Date.parse(e.date);
      if (!Number.isFinite(t)) continue;
      const f = e.fields.find(x => x.label === label);
      if (!f) continue;
      const v = parseFloat(f.value);
      if (!Number.isFinite(v)) continue;
      if (t >= weekAgo) thisVals.push(v);
      else if (t >= twoWeeks) lastVals.push(v);
    }
    const thisWeek = avg(thisVals);
    const lastWeek = avg(lastVals);
    const delta = thisWeek !== null && lastWeek !== null ? thisWeek - lastWeek : null;
    const betterWhenUp = label === 'Часы' || label === 'Качество';
    return { label, thisWeek, lastWeek, delta, betterWhenUp };
  });
};

/* ── Тренды веса: скользящее среднее и линейная регрессия (чистые функции) ── */

export interface TrendPoint { date: string; value: number }

/** Скользящее среднее по окну (trailing). Возвращает [] если точек < window. */
export function movingAverage(points: TrendPoint[], window: number): TrendPoint[] {
  if (window < 1 || !points.length || points.length < window) return [];
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const out: TrendPoint[] = [];
  for (let i = window - 1; i < sorted.length; i++) {
    let sum = 0;
    for (let j = i - window + 1; j <= i; j++) sum += sorted[j].value;
    out.push({ date: sorted[i].date, value: sum / window });
  }
  return out;
}

/** Линейная регрессия по датам (X в днях от первой точки). */
export function fitLinearTrend(points: TrendPoint[]): { slopePerDay: number; intercept: number; r2: number; startX: number; startY: number } | null {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.length < 2) return null;
  const x0 = +new Date(sorted[0].date) / 86400000;
  const days = sorted.map(p => +new Date(p.date) / 86400000 - x0);
  const n = days.length;
  const meanX = days.reduce((s, v) => s + v, 0) / n;
  const meanY = sorted.reduce((s, p) => s + p.value, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (days[i] - meanX) * (sorted[i].value - meanY);
    den += (days[i] - meanX) * (days[i] - meanX);
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = meanY - slope * meanX;
  let ssRes = 0, ssTot = 0;
  for (let i = 0; i < n; i++) {
    const pred = intercept + slope * days[i];
    ssRes += (sorted[i].value - pred) ** 2;
  }
  for (let i = 0; i < n; i++) ssTot += (sorted[i].value - meanY) ** 2;
  const r2 = ssTot === 0 ? 1 : 1 - ssRes / ssTot;
  return { slopePerDay: slope, intercept, r2, startX: x0, startY: sorted[0].value };
}

/** Прогноз значения на абсолютную дату (X = дни от эпохи). */
export function projectToDate(fit: { slopePerDay: number; intercept: number; startX: number }, dateIso: string): number {
  const x = +new Date(dateIso) / 86400000;
  return fit.intercept + fit.slopePerDay * (x - fit.startX);
}

/** Количество дней до достижения target (null если тренд не в ту сторону). */
export function daysToTarget(fit: { slopePerDay: number; intercept: number; startX: number }, todayIsoStr: string, target: number): number | null {
  if (Math.abs(fit.slopePerDay) < 1e-9) return null;
  const xToday = +new Date(todayIsoStr) / 86400000;
  const targetX = (target - fit.intercept) / fit.slopePerDay + fit.startX;
  const days = targetX - xToday;
  if (days < 0) return null;
  return Math.ceil(days);
}

/* ── Сводки по неделям/месяцам, темп к дате, heatmap веса ── */

/** Локальный ISO (без сдвига UTC). */
const localIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Понедельник недели для даты (ISO). */
export function weekStartOf(dateISO: string): string {
  const d = new Date(dateISO + 'T00:00:00');
  if (Number.isNaN(+d)) return dateISO;
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return localIso(d);
}

export interface WeekSummary {
  weekStart: string;
  count: number;
  mean: number;
  delta: number | null; // Δ к предыдущей (более ранней) неделе
}

/** Средний вес по неделям (понедельник → воскресенье), последние недели первыми. */
export function weeklySummaries(entries: { date: string; weight: number }[], weeks = 12): WeekSummary[] {
  const byWeek = new Map<string, { sum: number; count: number }>();
  for (const e of entries) {
    if (!e || !e.date || !Number.isFinite(e.weight) || e.weight <= 0) continue;
    const ws = weekStartOf(e.date);
    const cur = byWeek.get(ws) || { sum: 0, count: 0 };
    cur.sum += e.weight;
    cur.count += 1;
    byWeek.set(ws, cur);
  }
  const keys = [...byWeek.keys()].sort().reverse().slice(0, weeks);
  const out: WeekSummary[] = [];
  for (let i = 0; i < keys.length; i++) {
    const ws = keys[i];
    const { sum, count } = byWeek.get(ws)!;
    const mean = sum / count;
    const older = keys[i + 1];
    const delta = older !== undefined ? mean - byWeek.get(older)!.sum / byWeek.get(older)!.count : null;
    out.push({ weekStart: ws, count, mean, delta });
  }
  return out;
}

export interface MonthSummary {
  month: string; // 'YYYY-MM'
  count: number;
  mean: number;
  delta: number | null;
}

/** Средний вес по месяцам, последние месяцы первыми. */
export function monthlySummaries(entries: { date: string; weight: number }[], months = 6): MonthSummary[] {
  const byMonth = new Map<string, { sum: number; count: number }>();
  for (const e of entries) {
    if (!e || !e.date || !Number.isFinite(e.weight) || e.weight <= 0) continue;
    const m = e.date.slice(0, 7);
    const cur = byMonth.get(m) || { sum: 0, count: 0 };
    cur.sum += e.weight;
    cur.count += 1;
    byMonth.set(m, cur);
  }
  const keys = [...byMonth.keys()].sort().reverse().slice(0, months);
  const out: MonthSummary[] = [];
  for (let i = 0; i < keys.length; i++) {
    const m = keys[i];
    const { sum, count } = byMonth.get(m)!;
    const mean = sum / count;
    const older = keys[i + 1];
    const delta = older !== undefined ? mean - byMonth.get(older)!.sum / byMonth.get(older)!.count : null;
    out.push({ month: m, count, mean, delta });
  }
  return out;
}

/** Нужный темп (кг/нед) для достижения цели к дате. null если дата в прошлом или невалидна. */
export function paceToTarget(
  currentKg: number,
  targetKg: number,
  targetDate: string
): { kgPerWeek: number; kgTotal: number; days: number } | null {
  const days = Math.ceil((+new Date(targetDate + 'T00:00:00') - Date.now()) / 86400000);
  if (!Number.isFinite(days) || days <= 0) return null;
  const kgTotal = targetKg - currentKg;
  return { kgPerWeek: kgTotal / (days / 7), kgTotal, days };
}

export interface HeatmapCell {
  date: string;
  value: number;
  pct: number; // 0..1 относительно min/max всех значений
}

/** Календарная сетка веса: weeks × 7 дней (Пн..Вс), null = нет записи. */
export function weightHeatmap(
  entries: { date: string; weight: number }[],
  weeks = 12
): { cells: (HeatmapCell | null)[][]; min: number; max: number } | null {
  const byDate = new Map<string, number>();
  for (const e of entries) {
    if (e && e.date && Number.isFinite(e.weight) && e.weight > 0) byDate.set(e.date, e.weight);
  }
  const values = [...byDate.values()];
  if (!values.length) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const today = new Date();
  const todayIsoLoc = localIso(today);
  const todayDow = (today.getDay() + 6) % 7; // Пн=0
  const thisMonday = new Date(today);
  thisMonday.setDate(today.getDate() - todayDow);
  const cells: (HeatmapCell | null)[][] = [];
  for (let w = 0; w < weeks; w++) {
    const row: (HeatmapCell | null)[] = [];
    for (let d = 0; d < 7; d++) {
      const day = new Date(thisMonday);
      day.setDate(thisMonday.getDate() - (weeks - 1 - w) * 7 + d);
      const iso = localIso(day);
      if (iso > todayIsoLoc) { row.push(null); continue; }
      const value = byDate.get(iso);
      row.push(value !== undefined ? { date: iso, value, pct: span === 0 ? 0.5 : (value - min) / span } : null);
    }
    cells.push(row);
  }
  return { cells, min, max };
}

/* ── Unified PDF Export for All Diaries ────────────────────────────────────── */

export interface DiaryExportData {
  title: string;
  entries: DiaryEntryLike[];
  meta?: Record<string, string>;
}

const escHtml = (v: unknown): string => {
  const map: Record<string, string> = { '&': '&', '<': '<', '>': '>', '"': '"', "'": "'" };
  return String(v ?? '').replace(/[&<>"']/g, (x) => map[x] || x);
};

const entryToHtmlTable = (entries: DiaryEntryLike[], title: string): string => {
  if (!entries.length) return `<h3>${escHtml(title)}</h3><p>Нет записей</p>`;
  const allFields = new Set<string>();
  entries.forEach((e) => e.fields.forEach((f) => allFields.add(f.label)));
  const fields = [...allFields].sort();
  const rowsHtml = entries
    .map(
      (e) =>
        `<tr><td>${escHtml(e.date)}</td>${fields
          .map((f) => {
            const val = e.fields.find((x) => x.label === f)?.value ?? '—';
            return `<td>${escHtml(val)}</td>`;
          })
          .join('')}</tr>`
    )
    .join('');
  return `
    <h3>${escHtml(title)} (${entries.length} записей)</h3>
    <table style="border-collapse:collapse;width:100%;margin-bottom:24px;font-size:11px">
      <thead><tr style="background:#f3f4f6"><th style="border:1px solid #ddd;padding:6px">Дата</th>${fields
        .map((f) => `<th style="border:1px solid #ddd;padding:6px">${escHtml(f)}</th>`)
        .join('')}</tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
};

/** Экспорт всех дневников в один PDF через window.print() */
export const exportAllDiariesPdf = (diaries: DiaryExportData[], filename = 'diaries-all.pdf'): void => {
  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${escHtml(filename.replace('.pdf', ''))}</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 24px; color: #111; line-height: 1.4; }
    h1 { font-size: 20px; margin-bottom: 8px; color: #111; }
    h2 { font-size: 16px; margin: 20px 0 8px; color: #333; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    h3 { font-size: 14px; margin: 16px 0 8px; color: #374151; }
    p { margin: 8px 0; color: #6b7280; font-size: 12px; }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; page-break-after: auto; }
    td, th { border: 1px solid #ddd; padding: 5px 8px; vertical-align: top; }
    .meta { background: #f9fafb; padding: 12px; border-radius: 8px; margin-bottom: 16px; font-size: 12px; }
    .meta-row { display: flex; justify-content: space-between; margin: 4px 0; }
    .meta-label { color: #6b7280; }
    .meta-value { font-weight: 600; color: #111; }
    @media print {
      @page { margin: 16mm; }
      body { margin: 0; }
      h1, h2, h3 { page-break-after: avoid; }
    }
  </style>
</head>
<body>
  <h1>${escHtml(filename.replace('.pdf', ''))}</h1>
  <div class="meta">
    <div class="meta-row"><span class="meta-label">Дата создания:</span> <span class="meta-value">${new Date().toLocaleString('ru-RU')}</span></div>
    <div class="meta-row"><span class="meta-label">Всего дневников:</span> <span class="meta-value">${diaries.length}</span></div>
  </div>
  ${diaries.map((d) => entryToHtmlTable(d.entries, d.title)).join('')}
  ${diaries.flatMap((d) => Object.entries(d.meta || {}).map(([k, v]) => `<h2>${escHtml(k)}</h2><p>${escHtml(v)}</p>`)).join('')}
</body>
</html>
  `;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 100);
};

export const escapeHtml = (v: unknown): string =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] || c);
