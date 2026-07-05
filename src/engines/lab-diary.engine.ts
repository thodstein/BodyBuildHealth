/**
 * lab-diary.engine.ts — Дневник анализов (лабскрин)
 *
 * Автоматически собирает результаты анализов из IndexedDB (labs_log),
 * хранит историю в localStorage, предоставляет статистику, тренды и данные для графиков.
 */

export interface LabDiaryEntry {
  date: string;           // YYYY-MM-DD
  markers: LabDiaryMarker[];
  totalMarkers: number;
  abnormalCount: number;  // количество маркеров вне нормы
  note?: string;
}

export interface LabDiaryMarker {
  code: string;
  name: string;
  value: number;
  unit: string;
  lln?: number;
  uln?: number;
  inRange: boolean;
}

export interface LabDiaryStats {
  totalDays: number;
  totalMarkers: number;
  markerCodes: string[];
  lastDate: string;
  firstDate: string;
}

const DIARY_KEY = 'he_lab_diary';

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Загрузить дневник */
export function getLabDiary(): LabDiaryEntry[] {
  try { return JSON.parse(localStorage.getItem(DIARY_KEY) || '[]'); }
  catch { return []; }
}

/** Сохранить дневник */
function saveLabDiary(entries: LabDiaryEntry[]) {
  try { localStorage.setItem(DIARY_KEY, JSON.stringify(entries)); } catch {}
}

/** Добавить день с результатами анализов */
export function addLabDiaryDay(day: LabDiaryEntry): void {
  const diary = getLabDiary();
  const idx = diary.findIndex(e => e.date === day.date);
  if (idx >= 0) {
    diary[idx] = day;
  } else {
    diary.push(day);
  }
  diary.sort((a, b) => a.date.localeCompare(b.date));
  saveLabDiary(diary);
}

/** Удалить запись за дату */
export function removeLabDiaryDay(date: string): void {
  const diary = getLabDiary().filter(e => e.date !== date);
  saveLabDiary(diary);
}

/** Получить статистику по дневнику */
export function getLabDiaryStats(diary: LabDiaryEntry[]): LabDiaryStats {
  const markerCodes = new Set<string>();
  for (const day of diary) {
    for (const m of day.markers) markerCodes.add(m.code);
  }
  const dates = diary.map(d => d.date).sort();
  return {
    totalDays: diary.length,
    totalMarkers: markerCodes.size,
    markerCodes: Array.from(markerCodes).sort(),
    lastDate: dates[dates.length - 1] || '',
    firstDate: dates[0] || '',
  };
}

/** Получить историю по одному маркеру */
export function getMarkerHistory(diary: LabDiaryEntry[], code: string): { date: string; value: number; inRange: boolean; unit: string }[] {
  const result: { date: string; value: number; inRange: boolean; unit: string }[] = [];
  for (const day of diary) {
    const marker = day.markers.find(m => m.code === code);
    if (marker) {
      result.push({ date: day.date, value: marker.value, inRange: marker.inRange, unit: marker.unit });
    }
  }
  return result;
}

/** Получить данные для графика по маркеру */
export function getMarkerChartData(diary: LabDiaryEntry[], code: string): { labels: string[]; values: number[]; unit: string; lln?: number; uln?: number } {
  const history = getMarkerHistory(diary, code);
  const last = diary.flatMap(d => d.markers).find(m => m.code === code);
  return {
    labels: history.map(h => h.date),
    values: history.map(h => h.value),
    unit: last?.unit || '',
    lln: last?.lln,
    uln: last?.uln,
  };
}

/** Получить частоту сдачи анализов по дням за период */
export function getLabFrequency(diary: LabDiaryEntry[], days: number = 30): { date: string; count: number }[] {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return diary
    .filter(d => d.date >= cutoff)
    .map(d => ({ date: d.date, count: d.totalMarkers }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Получить маркеры с наибольшим количеством измерений */
export function getTopTestedMarkers(diary: LabDiaryEntry[], limit: number = 15): { code: string; name: string; count: number }[] {
  const countMap = new Map<string, { name: string; count: number }>();
  for (const day of diary) {
    for (const m of day.markers) {
      const existing = countMap.get(m.code);
      if (existing) {
        existing.count++;
      } else {
        countMap.set(m.code, { name: m.name, count: 1 });
      }
    }
  }
  return Array.from(countMap.entries())
    .map(([code, data]) => ({ code, name: data.name, count: data.count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** Получить аномальные маркеры (вне нормы) за последние N дней */
export function getRecentAbnormalMarkers(diary: LabDiaryEntry[], days: number = 90): { date: string; code: string; name: string; value: number; unit: string; lln?: number; uln?: number }[] {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  const result: { date: string; code: string; name: string; value: number; unit: string; lln?: number; uln?: number }[] = [];
  for (const day of diary) {
    if (day.date < cutoff) continue;
    for (const m of day.markers) {
      if (!m.inRange) {
        result.push({ date: day.date, code: m.code, name: m.name, value: m.value, unit: m.unit, lln: m.lln, uln: m.uln });
      }
    }
  }
  return result.sort((a, b) => b.date.localeCompare(a.date));
}

/** Получить сводку по дням за период */
export function getLabDiarySummary(diary: LabDiaryEntry[], days: number = 30): { date: string; total: number; abnormal: number; pct: number }[] {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10);
  return diary
    .filter(d => d.date >= cutoff)
    .map(d => ({
      date: d.date,
      total: d.totalMarkers,
      abnormal: d.abnormalCount,
      pct: d.totalMarkers > 0 ? Math.round((d.abnormalCount / d.totalMarkers) * 100) : 0,
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Импортировать результаты из IndexedDB LabPoint[] в дневник */
export function importLabsToDiary(labs: { id: string; code: string; name: string; value: number; unit: string; date: string }[], markerNorms: Record<string, { uln?: number; lln?: number }>): void {
  if (!labs || labs.length === 0) return;

  // группируем по датам
  const byDate = new Map<string, LabDiaryEntry>();
  for (const lab of labs) {
    if (!lab.date || lab.value === undefined || isNaN(lab.value)) continue;
    if (!byDate.has(lab.date)) {
      byDate.set(lab.date, { date: lab.date, markers: [], totalMarkers: 0, abnormalCount: 0 });
    }
    const day = byDate.get(lab.date)!;
    const norm = markerNorms[lab.code] || {};
    const inRange = (norm.lln === undefined || lab.value >= norm.lln) && (norm.uln === undefined || lab.value <= norm.uln);
    day.markers.push({
      code: lab.code, name: lab.name || lab.code,
      value: lab.value, unit: lab.unit || '',
      lln: norm.lln, uln: norm.uln, inRange,
    });
  }

  // пересчёт и сохранение
  const diary = getLabDiary();
  for (const [, day] of byDate) {
    day.totalMarkers = day.markers.length;
    day.abnormalCount = day.markers.filter(m => !m.inRange).length;
    const idx = diary.findIndex(e => e.date === day.date);
    if (idx >= 0) {
      diary[idx] = day;
    } else {
      diary.push(day);
    }
  }
  diary.sort((a, b) => a.date.localeCompare(b.date));
  saveLabDiary(diary);
}
