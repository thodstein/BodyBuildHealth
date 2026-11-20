/**
 * lab-diary.engine.ts — Дневник анализов (лабскрин)
 *
 * Автоматически собирает результаты анализов из IndexedDB (labs_log),
 * хранит историю в localStorage, предоставляет статистику, тренды и данные для графиков.
 */

// Дата записи анализа и окна «за N дней» — по локальному канону (core/local-date):
// в вечернее время UTC+3…+12 UTC-ключ уезжал на «вчера» и попадал не в ту выборку.
import { localIsoDate, localIsoDateOffset } from '../core/local-date';
// Проход 142: знак границы бланка («>1000») и вывод о стороне отклонения —
// по общему правилу core/lab-bound, а не по сравнению числа с нормой.
import { boundProvesSide, type LabBound } from '../core/lab-bound';
// Проход 161: нормы для вердикта дневника — из единственного резолвера.
import { getLabNorm } from './lab-norms.engine';

export interface LabDiaryEntry {
  date: string;           // YYYY-MM-DD
  markers: LabDiaryMarker[];
  totalMarkers: number;
  abnormalCount: number;  // количество маркеров вне нормы (только доказанных)
  note?: string;
}

export interface LabDiaryMarker {
  code: string;
  name: string;
  value: number;
  unit: string;
  lln?: number;
  uln?: number;
  /**
   * Проход 142: знак границы бланка. Дневник получал только число, поэтому
   * «>1000» на графике и в карточке выглядел точным измерением.
   */
  bound?: LabBound;
  /**
   * В норме?
   *
   * `true` — в норме доказано, `false` — отклонение доказано, `undefined` —
   * не доказано ни то, ни другое: нормы нет в реестре (или в бланке не было
   * референса), либо число обрезано границей («>5» при верхней границе 400:
   * истинное значение может быть и в норме, и выше неё). Раньше поле было
   * boolean, и оба случая выглядели как «в норме» — зелёным.
   */
  inRange?: boolean;
}

/**
 * Вердикт «в норме» по записи бланка.
 *
 * Нет ни одной границы нормы — судить не о чем. Есть граница бланка — «в норме»
 * не доказывается вовсе (открытая сторона ничем не ограничена), а отклонение
 * доказывается только в сторону, которую граница подтверждает
 * (`boundProvesSide`).
 */
function diaryRangeVerdict(
  value: number,
  lln: number | undefined,
  uln: number | undefined,
  bound: LabBound | undefined,
): boolean | undefined {
  if (lln === undefined && uln === undefined) return undefined;
  if (boundProvesSide(bound, value, lln, uln)) return false;
  if (bound) return undefined;
  return (lln === undefined || value >= lln) && (uln === undefined || value <= uln);
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
  return localIsoDate();
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
export function getMarkerHistory(diary: LabDiaryEntry[], code: string): { date: string; value: number; bound?: LabBound; inRange?: boolean; unit: string }[] {
  const result: { date: string; value: number; bound?: LabBound; inRange?: boolean; unit: string }[] = [];
  for (const day of diary) {
    const marker = day.markers.find(m => m.code === code);
    if (marker) {
      // Проход 142: точка графика — это значение вместе со знаком и вердиктом,
      // а не одно число: иначе «>1000» рисуется как 1000.
      result.push({ date: day.date, value: marker.value, bound: marker.bound, inRange: marker.inRange, unit: marker.unit });
    }
  }
  return result;
}

/**
 * Получить данные для графика по маркеру.
 *
 * `bounds` и `inRange` выровнены с `values` по индексу: график печатает знак
 * границы у точки и красит столбик в нейтральный цвет, когда сторона не
 * доказана.
 */
export function getMarkerChartData(diary: LabDiaryEntry[], code: string): { labels: string[]; values: number[]; bounds: Array<LabBound | undefined>; inRange: Array<boolean | undefined>; unit: string; lln?: number; uln?: number } {
  const history = getMarkerHistory(diary, code);
  const last = diary.flatMap(d => d.markers).find(m => m.code === code);
  return {
    labels: history.map(h => h.date),
    values: history.map(h => h.value),
    bounds: history.map(h => h.bound),
    inRange: history.map(h => h.inRange),
    unit: last?.unit || '',
    lln: last?.lln,
    uln: last?.uln,
  };
}


/** Получить частоту сдачи анализов по дням за период */
export function getLabFrequency(diary: LabDiaryEntry[], days: number = 30): { date: string; count: number }[] {
  const cutoff = localIsoDateOffset(-days);
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
export function getRecentAbnormalMarkers(diary: LabDiaryEntry[], days: number = 90): { date: string; code: string; name: string; value: number; bound?: LabBound; unit: string; lln?: number; uln?: number }[] {
  const cutoff = localIsoDateOffset(-days);
  const result: { date: string; code: string; name: string; value: number; bound?: LabBound; unit: string; lln?: number; uln?: number }[] = [];
  for (const day of diary) {
    if (day.date < cutoff) continue;
    for (const m of day.markers) {
      // Проход 142: только доказанное отклонение. Обрезанное «>5» при верхней
      // границе 400 в аномалии не попадает — сторону граница не доказала.
      if (m.inRange === false) {
        result.push({ date: day.date, code: m.code, name: m.name, value: m.value, bound: m.bound, unit: m.unit, lln: m.lln, uln: m.uln });
      }
    }
  }
  return result.sort((a, b) => b.date.localeCompare(a.date));
}

/** Получить сводку по дням за период */
export function getLabDiarySummary(diary: LabDiaryEntry[], days: number = 30): { date: string; total: number; abnormal: number; pct: number }[] {
  const cutoff = localIsoDateOffset(-days);
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
export function importLabsToDiary(labs: { id: string; code: string; name: string; value: number; unit: string; date: string; bound?: LabBound }[], markerNorms: Record<string, { uln?: number; lln?: number }>): void {
  if (!labs || labs.length === 0) return;
  const before = JSON.stringify(getLabDiary());

  // группируем по датам
  const byDate = new Map<string, LabDiaryEntry>();
  for (const lab of labs) {
    if (!lab.date || lab.value === undefined || isNaN(lab.value)) continue;
    if (!byDate.has(lab.date)) {
      byDate.set(lab.date, { date: lab.date, markers: [], totalMarkers: 0, abnormalCount: 0 });
    }
    const day = byDate.get(lab.date)!;
    const norm = markerNorms[lab.code] || {};
    // Проход 142: вердикт «в норме» — только если он доказан (см. diaryRangeVerdict).
    const inRange = diaryRangeVerdict(lab.value, norm.lln, norm.uln, lab.bound);
    const marker: LabDiaryMarker = {
      code: lab.code, name: lab.name || lab.code,
      value: lab.value, unit: lab.unit || '',
      lln: norm.lln, uln: norm.uln, bound: lab.bound, inRange,
    };
    // P0 fix: дедуп по коду на одну дату — последняя запись побеждает (иначе ×2 маркера и ×2 аномалии)
    const existingIdx = day.markers.findIndex(m => m.code === lab.code);
    if (existingIdx >= 0) day.markers[existingIdx] = marker;
    else day.markers.push(marker);
  }

  // пересчёт и сохранение
  const diary = getLabDiary();
  for (const [, day] of byDate) {
    day.totalMarkers = day.markers.length;
    day.abnormalCount = day.markers.filter(m => m.inRange === false).length;
    const idx = diary.findIndex(e => e.date === day.date);
    if (idx >= 0) {
      diary[idx] = day;
    } else {
      diary.push(day);
    }
  }
  diary.sort((a, b) => a.date.localeCompare(b.date));
  // Проход 161: зеркало пишется при каждом изменении склада (его обновляет
  // `data-link`), поэтому запись без изменений — не работа и не событие.
  if (JSON.stringify(diary) === before) return;
  saveLabDiary(diary);
}

/**
 * Зеркало дневника из склада — одно правило для экрана «Дневник» и `data-link`.
 *
 * Проход 161: раньше зеркало обновлялось только при открытии вкладки «Дневник»,
 * хотя отчёт (`comprehensive-report.engine`) читает именно зеркало: отчёт,
 * созданный в этой сессии, не видел бланки, введённые после последнего открытия
 * дневника. Нормы для вердикта берутся из единственного резолвера `getLabNorm`,
 * а не собираются каждой поверхностью отдельно.
 */
export function syncLabsToDiary(
  labs: { id: string; code: string; name: string; value: number; unit: string; date: string; bound?: LabBound }[],
  sex?: 'male' | 'female',
): void {
  if (!labs || labs.length === 0) return;
  const markerNorms: Record<string, { uln?: number; lln?: number }> = {};
  for (const lab of labs) {
    const key = (lab.code || '').toUpperCase();
    if (markerNorms[key]) continue;
    const norm = getLabNorm(key, sex);
    markerNorms[key] = norm ? { lln: norm.lln, uln: norm.uln } : { lln: undefined, uln: undefined };
  }
  importLabsToDiary(labs, markerNorms);
}
