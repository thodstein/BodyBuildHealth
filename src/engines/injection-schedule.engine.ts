/**
 * injection-schedule.engine.ts — планирование инъекций и соблюдение графика.
 *
 * Расписание: препарат + доза + дни недели (Пн=0 … Вс=6). Отдельное хранилище
 * `he_injection_schedule`. Соблюдение (adherence) считается по фактическому
 * дневнику инъекций (`he_injection_diary`) за последние N недель.
 */

import { getInjectionDiary } from './injection-diary.engine';

const STORAGE_KEY = 'he_injection_schedule';

export const SCHEDULE_WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

export interface InjectionScheduleItem {
  id: string;
  substance: string;
  dose: string;
  /** Дни недели, Пн=0 … Вс=6. */
  daysOfWeek: number[];
  zone?: string;
  side?: 'left' | 'right';
  technique?: string;
  needleGauge?: string;
  volumeMl?: number;
  notes?: string;
  active?: boolean;
}

export interface ScheduleAdherenceRow {
  item: InjectionScheduleItem;
  planned: number;
  actual: number;
  pct: number | null;
}

export interface MissedInjection {
  item: InjectionScheduleItem;
  date: string;
}

/* ── Даты и дни недели ── */

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

export function localDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Сдвиг даты на N дней (отрицательный — в прошлое). */
export function shiftDate(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return localDateKey(d);
}

/** День недели в формате Пн=0…Вс=6 (JS getDay(): 0=Вс). */
export function mondayDayOf(dateStr: string): number {
  const jsDay = new Date(`${dateStr}T00:00:00`).getDay();
  return (jsDay + 6) % 7;
}

/** Ближайшая дата >= fromDate с нужным днём недели (ищет до 14 дней вперёд). */
export function nextDateWithWeekday(mondayDay: number, fromDate: string): string | null {
  for (let i = 0; i < 14; i++) {
    const candidate = shiftDate(fromDate, i);
    if (mondayDayOf(candidate) === mondayDay) return candidate;
  }
  return null;
}

/* ── CRUD ── */

function readRawStorage(): unknown[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readStorage(): InjectionScheduleItem[] {
  return readRawStorage().filter(
    (e): e is InjectionScheduleItem =>
      !!e &&
      typeof e === 'object' &&
      typeof (e as InjectionScheduleItem).substance === 'string' &&
      Array.isArray((e as InjectionScheduleItem).daysOfWeek),
  );
}

function writeStorage(items: InjectionScheduleItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // quota: пробуем очистить и повторить
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-20)));
    } catch {
      /* noop */
    }
  }
}

export function getInjectionSchedule(): InjectionScheduleItem[] {
  return readStorage();
}

export function saveInjectionSchedule(items: InjectionScheduleItem[]): InjectionScheduleItem[] {
  writeStorage(items);
  return items;
}

export function addScheduleItem(item: Omit<InjectionScheduleItem, 'id'>): InjectionScheduleItem[] {
  const current = readStorage();
  const next: InjectionScheduleItem = {
    ...item,
    id: `sch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  };
  const updated = [...current, next];
  writeStorage(updated);
  return updated;
}

export function updateScheduleItem(id: string, patch: Partial<InjectionScheduleItem>): InjectionScheduleItem[] {
  const updated = readStorage().map((e) => (e.id === id ? { ...e, ...patch } : e));
  writeStorage(updated);
  return updated;
}

export function removeScheduleItem(id: string): InjectionScheduleItem[] {
  const updated = readStorage().filter((e) => e.id !== id);
  writeStorage(updated);
  return updated;
}

/* ── Соблюдение и напоминания ── */

function matchesSubstance(entrySubstance: string, itemSubstance: string): boolean {
  return String(entrySubstance || '').trim().toLowerCase() === String(itemSubstance || '').trim().toLowerCase();
}

/** Плановые инъекции на сегодня. */
export function getDueToday(items: InjectionScheduleItem[], fromDate?: string): InjectionScheduleItem[] {
  const date = fromDate || localDateKey(new Date());
  const todayDay = mondayDayOf(date);
  return items.filter((e) => e.active !== false && e.daysOfWeek.includes(todayDay));
}

/** Ближайшая плановая дата для пункта расписания (включая сегодня). */
export function getNextScheduledDate(item: InjectionScheduleItem, fromDate?: string): string | null {
  if (item.active === false) return null;
  const date = fromDate || localDateKey(new Date());
  let best: string | null = null;
  for (const day of [...item.daysOfWeek].sort((a, b) => a - b)) {
    const next = nextDateWithWeekday(day, date);
    if (!next) continue;
    if (!best || next < best) best = next;
  }
  return best;
}

/** Соблюдение графика за последние `weeks` недель: плановые vs фактические инъекции. */
export function computeScheduleAdherence(
  entries: Array<{ date: string; substance: string }>,
  items: InjectionScheduleItem[],
  weeks: number = 4,
  fromDate?: string,
): ScheduleAdherenceRow[] {
  const end = fromDate || localDateKey(new Date());
  const start = shiftDate(end, -(weeks * 7 - 1));
  const rows: ScheduleAdherenceRow[] = [];
  for (const item of items) {
    if (item.active === false || item.daysOfWeek.length === 0) continue;
    let planned = 0;
    for (let d = start; d <= end; d = shiftDate(d, 1)) {
      if (item.daysOfWeek.includes(mondayDayOf(d))) planned++;
    }
    const actual = entries.filter((e) => e.date >= start && e.date <= end && matchesSubstance(e.substance, item.substance)).length;
    rows.push({
      item,
      planned,
      actual,
      pct: planned > 0 ? Math.min(100, Math.round((actual / planned) * 100)) : null,
    });
  }
  return rows.sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101));
}

/** Пропущенные плановые инъекции за последние `days` дней (включая сегодня). */
export function getMissedInjections(
  entries: Array<{ date: string; substance: string }>,
  items: InjectionScheduleItem[],
  days: number = 7,
  fromDate?: string,
): MissedInjection[] {
  const end = fromDate || localDateKey(new Date());
  const start = shiftDate(end, -(days - 1));
  const missed: MissedInjection[] = [];
  for (const item of items) {
    if (item.active === false || item.daysOfWeek.length === 0) continue;
    for (let d = start; d <= end; d = shiftDate(d, 1)) {
      if (!item.daysOfWeek.includes(mondayDayOf(d))) continue;
      const done = entries.some((e) => e.date === d && matchesSubstance(e.substance, item.substance));
      if (!done) missed.push({ item, date: d });
    }
  }
  return missed.sort((a, b) => a.date.localeCompare(b.date));
}

/** Сводка для UI: сегодня по плану + пропущенные за неделю. */
export function getScheduleSummary(): {
  dueToday: InjectionScheduleItem[];
  missed: MissedInjection[];
  adherence: ScheduleAdherenceRow[];
  hasSchedule: boolean;
} {
  const items = getInjectionSchedule();
  const entries = getInjectionDiary();
  return {
    dueToday: getDueToday(items),
    missed: getMissedInjections(entries, items),
    adherence: computeScheduleAdherence(entries, items),
    hasSchedule: items.some((e) => e.active !== false),
  };
}
