/**
 * coach-planner.engine.ts — календарь-планировщик профиля (в духе TickTick).
 *
 * Задачи/события по дням: «в 18:00 присед у Ивана», «сдать ферритин», «созвон».
 * Что важно и что сознательно НЕ делаем:
 *  • даты — ТОЛЬКО календарные (канон `core/local-date`): `toISOString()` в UTC+10
 *    вечером даёт вчерашний день, и задача уезжает на сутки;
 *  • «повторяющиеся» задачи не выдумываем: без честного механизма серий лучше
 *    не обещать; вместо этого — быстрые кнопки «сегодня/завтра»;
 *  • лимит 2000 задач и 140 символов заголовка: localStorage не резиновый,
 *    при переполнении возвращаем ошибку, а не выкидываем чужие задачи;
 *  • просроченные задачи не «сгорают»: они остаются в дне, пока их не закрыли;
 *    UI показывает их отдельным блоком «просрочено».
 */
import { localIsoDate, parseLocalIsoDate } from '../../core/local-date';

export const COACH_PLANNER_KEY = 'he_coach_planner';
export const COACH_PLANNER_MAX = 2000;
export const COACH_TASK_TITLE_MAX = 140;
export const COACH_TASK_NOTE_MAX = 2000;

export interface CoachTask {
  id: string;
  title: string;
  /** Дата YYYY-MM-DD (локальная). */
  date: string;
  /** Время HH:MM или null — «на весь день». */
  time: string | null;
  athleteId: string | null;
  done: boolean;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoachPlannerStore {
  version: 1;
  items: CoachTask[];
}

export const COACH_PLANNER_HINT =
  'Планер — это ваш распорядок, он не меняет тренировочный план и не отправляет уведомления сам по себе.';

export function emptyCoachPlanner(): CoachPlannerStore {
  return { version: 1, items: [] };
}

const nowIso = (): string => new Date().toISOString();
const text = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidCoachDate(v: unknown): boolean {
  const s = String(v ?? '');
  if (!ISO_DATE_RE.test(s)) return false;
  const d = parseLocalIsoDate(s);
  // parseLocalIsoDate терпит 2026-02-31 (Date «перекатит» в март) — проверяем обратно.
  return !!d && localIsoDate(d) === s;
}

export function normalizeCoachTime(v: unknown): string | null {
  const s = String(v ?? '').trim();
  return TIME_RE.test(s) ? s : null;
}

function normalizeTask(raw: unknown): CoachTask | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Partial<CoachTask> & Record<string, unknown>;
  const id = text(t.id, 80);
  const title = text(t.title, COACH_TASK_TITLE_MAX);
  const date = text(t.date, 10);
  if (!id || !title || !isValidCoachDate(date)) return null;
  const createdAt = text(t.createdAt, 40) || nowIso();
  return {
    id,
    title,
    date,
    time: normalizeCoachTime(t.time),
    athleteId: text(t.athleteId, 80) || null,
    done: t.done === true,
    note: text(t.note, COACH_TASK_NOTE_MAX),
    createdAt,
    updatedAt: text(t.updatedAt, 40) || createdAt,
  };
}

export function parseCoachPlanner(raw: string | null | undefined): CoachPlannerStore {
  if (!raw) return emptyCoachPlanner();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return emptyCoachPlanner();
    const obj = parsed as Partial<CoachPlannerStore> & Record<string, unknown>;
    if (obj.version !== 1 || !Array.isArray(obj.items)) return emptyCoachPlanner();
    const seen = new Set<string>();
    const items: CoachTask[] = [];
    for (const row of obj.items) {
      const task = normalizeTask(row);
      if (!task || seen.has(task.id)) continue;
      seen.add(task.id);
      items.push(task);
      if (items.length >= COACH_PLANNER_MAX) break;
    }
    return { version: 1, items };
  } catch {
    return emptyCoachPlanner();
  }
}

export function serializeCoachPlanner(store: CoachPlannerStore): string {
  return JSON.stringify({ version: 1, items: store.items });
}

export function readCoachPlanner(storage: { getItem: (k: string) => string | null } | null | undefined): CoachPlannerStore {
  if (!storage) return emptyCoachPlanner();
  try {
    return parseCoachPlanner(storage.getItem(COACH_PLANNER_KEY));
  } catch {
    return emptyCoachPlanner();
  }
}

export function writeCoachPlanner(
  storage: { setItem?: (k: string, v: string) => void } | null | undefined,
  store: CoachPlannerStore,
): CoachPlannerStore {
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(COACH_PLANNER_KEY, serializeCoachPlanner(store));
    } catch {
      /* ignore quota */
    }
  }
  return store;
}

export type CoachTaskError = 'limit' | 'title' | 'date' | null;

export interface AddCoachTaskResult {
  store: CoachPlannerStore;
  task: CoachTask | null;
  error: CoachTaskError;
}

export function addCoachTask(
  store: CoachPlannerStore,
  input: { title?: string; date?: string; time?: string | null; athleteId?: string | null; note?: string },
  opts: { id?: string; now?: string } = {},
): AddCoachTaskResult {
  const title = text(input.title, COACH_TASK_TITLE_MAX);
  if (!title) return { store, task: null, error: 'title' };
  const date = text(input.date, 10) || localIsoDate();
  if (!isValidCoachDate(date)) return { store, task: null, error: 'date' };
  if (store.items.length >= COACH_PLANNER_MAX) return { store, task: null, error: 'limit' };
  const now = opts.now ?? nowIso();
  const task: CoachTask = {
    id: opts.id ?? `t_${now.replace(/[^0-9]/g, '').slice(0, 14)}_${store.items.length + 1}`,
    title,
    date,
    time: normalizeCoachTime(input.time),
    athleteId: text(input.athleteId, 80) || null,
    done: false,
    note: text(input.note, COACH_TASK_NOTE_MAX),
    createdAt: now,
    updatedAt: now,
  };
  return { store: { version: 1, items: [...store.items, task] }, task, error: null };
}

export function updateCoachTask(
  store: CoachPlannerStore,
  id: string,
  patch: { title?: string; date?: string; time?: string | null; athleteId?: string | null; done?: boolean; note?: string },
  opts: { now?: string } = {},
): CoachPlannerStore {
  const idx = store.items.findIndex(t => t.id === id);
  if (idx < 0) return store;
  const prev = store.items[idx];
  const title = patch.title === undefined ? prev.title : text(patch.title, COACH_TASK_TITLE_MAX);
  if (!title) return store;
  const date = patch.date === undefined ? prev.date : text(patch.date, 10);
  if (!isValidCoachDate(date)) return store;
  const items = [...store.items];
  items[idx] = {
    ...prev,
    title,
    date,
    time: patch.time === undefined ? prev.time : normalizeCoachTime(patch.time),
    athleteId: patch.athleteId === undefined ? prev.athleteId : (text(patch.athleteId, 80) || null),
    done: patch.done === undefined ? prev.done : patch.done === true,
    note: patch.note === undefined ? prev.note : text(patch.note, COACH_TASK_NOTE_MAX),
    updatedAt: opts.now ?? nowIso(),
  };
  return { version: 1, items };
}

export function toggleCoachTaskDone(store: CoachPlannerStore, id: string): CoachPlannerStore {
  const idx = store.items.findIndex(t => t.id === id);
  if (idx < 0) return store;
  const items = [...store.items];
  items[idx] = { ...items[idx], done: !items[idx].done, updatedAt: nowIso() };
  return { version: 1, items };
}

export function removeCoachTask(store: CoachPlannerStore, id: string): CoachPlannerStore {
  const items = store.items.filter(t => t.id !== id);
  return items.length === store.items.length ? store : { version: 1, items };
}

const timeRank = (t: CoachTask): string => t.time ?? '99:99';

/** Сортировка: по дате, внутри дня — по времени, «на весь день» после задач со временем. */
export function sortCoachTasks(items: CoachTask[]): CoachTask[] {
  return [...items].sort((a, b) =>
    a.date.localeCompare(b.date) ||
    timeRank(a).localeCompare(timeRank(b)) ||
    a.title.localeCompare(b.title),
  );
}

export function tasksForDate(store: CoachPlannerStore, date: string): CoachTask[] {
  return sortCoachTasks(store.items.filter(t => t.date === date));
}

export function tasksInRange(store: CoachPlannerStore, from: string, to: string): CoachTask[] {
  return sortCoachTasks(store.items.filter(t => t.date >= from && t.date <= to));
}

/** Сколько задач на каждом дне диапазона — для точек в сетке календаря. */
export function countTasksByDate(store: CoachPlannerStore, from: string, to: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of store.items) {
    if (t.date < from || t.date > to) continue;
    out[t.date] = (out[t.date] ?? 0) + 1;
  }
  return out;
}

/** Незакрытые задачи начиная с `from` (по умолчанию — с сегодня). */
export function upcomingCoachTasks(
  store: CoachPlannerStore,
  opts: { from?: string; limit?: number; includeDone?: boolean } = {},
): CoachTask[] {
  const from = opts.from && isValidCoachDate(opts.from) ? opts.from : localIsoDate();
  const limit = Math.max(1, Math.trunc(opts.limit ?? 10));
  const items = store.items.filter(t => t.date >= from && (opts.includeDone === true || !t.done));
  return sortCoachTasks(items).slice(0, limit);
}

/** Просроченные — до `today` и не закрыты. Отдельным блоком, а не «сгорели». */
export function overdueCoachTasks(store: CoachPlannerStore, today = localIsoDate()): CoachTask[] {
  return sortCoachTasks(store.items.filter(t => t.date < today && !t.done));
}

export interface CoachMonthCell {
  /** YYYY-MM-DD (локальная дата). */
  iso: string;
  /** День месяца 1..31. */
  day: number;
  /** Принадлежит отображаемому месяцу (иначе — хвост соседнего). */
  inMonth: boolean;
  isToday: boolean;
  /** 0 = понедельник … 6 = воскресенье. */
  weekday: number;
}

/**
 * Сетка месяца, недели с понедельника (как в российском календаре).
 * `month` — 0..11, как в Date. Выход — строки недель по 7 ячеек.
 */
export function buildCoachMonthGrid(year: number, month: number, today = localIsoDate()): CoachMonthCell[][] {
  const first = new Date(year, month, 1);
  const y = first.getFullYear();
  const m = first.getMonth();
  const offset = (first.getDay() + 6) % 7; // Пн = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const rows = Math.ceil((offset + daysInMonth) / 7);
  const grid: CoachMonthCell[][] = [];
  for (let r = 0; r < rows; r++) {
    const week: CoachMonthCell[] = [];
    for (let c = 0; c < 7; c++) {
      const d = new Date(y, m, 1 - offset + r * 7 + c);
      const iso = localIsoDate(d);
      week.push({
        iso,
        day: d.getDate(),
        inMonth: d.getMonth() === m && d.getFullYear() === y,
        isToday: iso === today,
        weekday: c,
      });
    }
    grid.push(week);
  }
  return grid;
}

/** Сдвиг месяца (для «← / →» в шапке календаря). */
export function shiftCoachMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month + Math.trunc(delta), 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

export const COACH_WEEKDAY_LABELS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

export const COACH_MONTH_LABELS = [
  'Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь',
  'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь',
] as const;
