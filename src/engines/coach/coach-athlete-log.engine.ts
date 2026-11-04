/**
 * coach-athlete-log.engine.ts — журнал атлета в режиме тренера.
 *
 * Зачем: карточка атлета без результатов — это записная книжка с именами. Тренеру
 * нужно фиксировать «присед 3×5×120, RPE 8» и «вес тела 82.5» по датам, и видеть
 * по ним арифметику.
 *
 * ЧЕСТНЫЕ ГРАНИЦЫ (то, чего здесь СОЗНАТЕЛЬНО НЕТ):
 *  • никаких нормативов, процентов от ПМ, «оценок формы» и прогнозов — в приложении
 *    нет справочника для таких оценок по произвольным упражнениям, а выдумывать
 *    числа нельзя. Считаем только то, что следует из записей:
 *    тоннаж = Σ(подходы × повторы × вес), лучший подход = максимальный вес;
 *  • «лучший подход» — это не «лучший результат спортсмена вообще», а максимум
 *    среди записанного; UI обязан говорить это прямо;
 *  • журнал не связан с тренировочным планом устройства и не меняет его;
 *  • лимит 5000 записей: при переполнении — отказ с объяснением, а не тихое
 *    вытеснение чужих записей;
 *  • даты — канон `core/local-date` (никаких UTC-сдвигов), «31 февраля» отклоняется.
 */
import { parseLocalIsoDate, shiftIsoDate, localIsoDate } from '../../core/local-date';
import { isValidCoachDate } from './coach-planner.engine';

export const COACH_LOG_KEY = 'he_coach_athlete_log';
export const COACH_LOG_MAX = 5000;
const EXERCISE_MAX = 80;
const NOTE_MAX = 300;

/** Здравый смысл полей, не нормативы: защита от опечаток. */
const SETS_MIN = 1;
const SETS_MAX = 50;
const REPS_MIN = 1;
const REPS_MAX = 100;
const WEIGHT_MIN = 0.5;
const WEIGHT_MAX = 600;
const RPE_MIN = 1;
const RPE_MAX = 10;

export type CoachLogKind = 'lift' | 'bodyweight';

export interface CoachLogEntry {
  id: string;
  athleteId: string;
  /** Локальная дата YYYY-MM-DD. */
  date: string;
  kind: CoachLogKind;
  /** Упражнение (для kind='lift'); пусто для веса тела. */
  exercise: string;
  /** Подходы/повторы (для 'lift'); 0 для 'bodyweight'. */
  sets: number;
  reps: number;
  /** Вес снаряда (null — без веса) или вес тела. */
  weightKg: number | null;
  /** RPE 1..10 с шагом 0.5; null — не указан. */
  rpe: number | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoachLogStore {
  version: 1;
  items: CoachLogEntry[];
}

export const COACH_LOG_HINT =
  'Здесь только ваши записи и арифметика по ним: тоннаж = подходы × повторы × вес. ' +
  'Нормативов, процентов от максимума и прогнозов приложение не считает.';

export function emptyCoachLog(): CoachLogStore {
  return { version: 1, items: [] };
}

const nowIso = (): string => new Date().toISOString();
const text = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);

const intInRange = (v: unknown, min: number, max: number): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  if (!Number.isFinite(n)) return null;
  const i = Math.round(n);
  if (i < min || i > max) return null;
  return i;
};

const weightOrNull = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < WEIGHT_MIN || n > WEIGHT_MAX) return null;
  return Math.round(n * 10) / 10;
};

const rpeOrNull = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v);
  if (!Number.isFinite(n)) return null;
  if (n < RPE_MIN || n > RPE_MAX) return null;
  return Math.round(n * 2) / 2;
};

function normalizeEntry(raw: unknown): CoachLogEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const e = raw as Partial<CoachLogEntry> & Record<string, unknown>;
  const id = text(e.id, 80);
  const athleteId = text(e.athleteId, 80);
  const date = text(e.date, 10);
  if (!id || !athleteId || !isValidCoachDate(date)) return null;
  const kind: CoachLogKind = e.kind === 'bodyweight' ? 'bodyweight' : 'lift';
  const createdAt = text(e.createdAt, 40) || nowIso();
  const base = {
    id,
    athleteId,
    date,
    kind,
    note: text(e.note, NOTE_MAX),
    createdAt,
    updatedAt: text(e.updatedAt, 40) || createdAt,
  };
  if (kind === 'bodyweight') {
    const weightKg = weightOrNull(e.weightKg);
    if (weightKg === null) return null; // «вес тела» без веса — бессмысленная запись
    return { ...base, exercise: '', sets: 0, reps: 0, weightKg, rpe: null };
  }
  const exercise = text(e.exercise, EXERCISE_MAX);
  const sets = intInRange(e.sets, SETS_MIN, SETS_MAX);
  const reps = intInRange(e.reps, REPS_MIN, REPS_MAX);
  if (!exercise || sets === null || reps === null) return null;
  return { ...base, exercise, sets, reps, weightKg: weightOrNull(e.weightKg), rpe: rpeOrNull(e.rpe) };
}

export function parseCoachLog(raw: string | null | undefined): CoachLogStore {
  if (!raw) return emptyCoachLog();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return emptyCoachLog();
    const obj = parsed as Partial<CoachLogStore> & Record<string, unknown>;
    if (obj.version !== 1 || !Array.isArray(obj.items)) return emptyCoachLog();
    const seen = new Set<string>();
    const items: CoachLogEntry[] = [];
    for (const row of obj.items) {
      const entry = normalizeEntry(row);
      if (!entry || seen.has(entry.id)) continue;
      seen.add(entry.id);
      items.push(entry);
      if (items.length >= COACH_LOG_MAX) break;
    }
    return { version: 1, items };
  } catch {
    return emptyCoachLog();
  }
}

export function serializeCoachLog(store: CoachLogStore): string {
  return JSON.stringify({ version: 1, items: store.items });
}

export function readCoachLog(storage: { getItem: (k: string) => string | null } | null | undefined): CoachLogStore {
  if (!storage) return emptyCoachLog();
  try {
    return parseCoachLog(storage.getItem(COACH_LOG_KEY));
  } catch {
    return emptyCoachLog();
  }
}

export function writeCoachLog(
  storage: { setItem?: (k: string, v: string) => void } | null | undefined,
  store: CoachLogStore,
): CoachLogStore {
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(COACH_LOG_KEY, serializeCoachLog(store));
    } catch {
      /* ignore quota */
    }
  }
  return store;
}

export type CoachLogError = 'limit' | 'athlete' | 'date' | 'exercise' | 'sets' | 'reps' | 'weight' | null;

export interface AddCoachLogResult {
  store: CoachLogStore;
  entry: CoachLogEntry | null;
  error: CoachLogError;
}

export interface CoachLogInput {
  athleteId?: string;
  date?: string;
  kind?: CoachLogKind;
  exercise?: string;
  sets?: number | string;
  reps?: number | string;
  weightKg?: number | string | null;
  rpe?: number | string | null;
  note?: string;
}

export function addCoachLogEntry(
  store: CoachLogStore,
  input: CoachLogInput,
  opts: { id?: string; now?: string } = {},
): AddCoachLogResult {
  const athleteId = text(input.athleteId, 80);
  if (!athleteId) return { store, entry: null, error: 'athlete' };
  const date = text(input.date, 10) || localIsoDate();
  if (!isValidCoachDate(date)) return { store, entry: null, error: 'date' };
  if (store.items.length >= COACH_LOG_MAX) return { store, entry: null, error: 'limit' };
  const kind: CoachLogKind = input.kind === 'bodyweight' ? 'bodyweight' : 'lift';
  const now = opts.now ?? nowIso();
  const id = opts.id ?? `l_${now.replace(/[^0-9]/g, '').slice(0, 14)}_${store.items.length + 1}`;

  let entry: CoachLogEntry;
  if (kind === 'bodyweight') {
    const weightKg = weightOrNull(input.weightKg);
    if (weightKg === null) return { store, entry: null, error: 'weight' };
    entry = {
      id,
      athleteId,
      date,
      kind,
      exercise: '',
      sets: 0,
      reps: 0,
      weightKg,
      rpe: null,
      note: text(input.note, NOTE_MAX),
      createdAt: now,
      updatedAt: now,
    };
  } else {
    const exercise = text(input.exercise, EXERCISE_MAX);
    if (!exercise) return { store, entry: null, error: 'exercise' };
    const sets = intInRange(input.sets, SETS_MIN, SETS_MAX);
    if (sets === null) return { store, entry: null, error: 'sets' };
    const reps = intInRange(input.reps, REPS_MIN, REPS_MAX);
    if (reps === null) return { store, entry: null, error: 'reps' };
    entry = {
      id,
      athleteId,
      date,
      kind,
      exercise,
      sets,
      reps,
      weightKg: weightOrNull(input.weightKg),
      rpe: rpeOrNull(input.rpe),
      note: text(input.note, NOTE_MAX),
      createdAt: now,
      updatedAt: now,
    };
  }
  return { store: { version: 1, items: [...store.items, entry] }, entry, error: null };
}

export function updateCoachLogEntry(
  store: CoachLogStore,
  id: string,
  patch: CoachLogInput,
  opts: { now?: string } = {},
): CoachLogStore {
  const idx = store.items.findIndex(e => e.id === id);
  if (idx < 0) return store;
  const prev = store.items[idx];
  const merged = normalizeEntry({
    ...prev,
    date: patch.date === undefined ? prev.date : text(patch.date, 10),
    kind: patch.kind === undefined ? prev.kind : patch.kind,
    exercise: patch.exercise === undefined ? prev.exercise : text(patch.exercise, EXERCISE_MAX),
    sets: patch.sets === undefined ? prev.sets : patch.sets,
    reps: patch.reps === undefined ? prev.reps : patch.reps,
    weightKg: patch.weightKg === undefined ? prev.weightKg : patch.weightKg,
    rpe: patch.rpe === undefined ? prev.rpe : patch.rpe,
    note: patch.note === undefined ? prev.note : text(patch.note, NOTE_MAX),
    updatedAt: opts.now ?? nowIso(),
  });
  if (!merged) return store;
  const items = [...store.items];
  items[idx] = merged;
  return { version: 1, items };
}

export function removeCoachLogEntry(store: CoachLogStore, id: string): CoachLogStore {
  const items = store.items.filter(e => e.id !== id);
  return items.length === store.items.length ? store : { version: 1, items };
}

/* ------------------------------------------------------------------ */
/* Выборки и арифметика                                                */
/* ------------------------------------------------------------------ */

const dateDesc = (a: CoachLogEntry, b: CoachLogEntry): number =>
  b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id);

/** Записи атлета, свежие сверху. */
export function entriesForAthlete(store: CoachLogStore, athleteId: string): CoachLogEntry[] {
  return store.items.filter(e => e.athleteId === athleteId).sort(dateDesc);
}

/** Все упражнения атлета (по алфавиту, без повторов). */
export function exercisesForAthlete(store: CoachLogStore, athleteId: string): string[] {
  const set = new Set<string>();
  for (const e of store.items) {
    if (e.athleteId === athleteId && e.kind === 'lift' && e.exercise) set.add(e.exercise);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export interface CoachBestSet {
  entry: CoachLogEntry;
  weightKg: number;
  /** Сколько записей с этим весом — чтобы «личный рекорд» не выглядел случайностью. */
  times: number;
}

/**
 * Максимальный вес среди записанных подходов по упражнению.
 * null — записей с весом нет (никаких «расчётных максимумов»).
 */
export function bestSetFor(store: CoachLogStore, athleteId: string, exercise: string): CoachBestSet | null {
  const target = exercise.trim().toLowerCase();
  const rows = store.items.filter(
    e => e.athleteId === athleteId && e.kind === 'lift' && e.exercise.toLowerCase() === target && e.weightKg !== null,
  );
  if (rows.length === 0) return null;
  let best = rows[0];
  let times = 1;
  for (const e of rows.slice(1)) {
    const w = e.weightKg as number;
    const bw = best.weightKg as number;
    if (w > bw || (w === bw && e.reps > best.reps)) {
      best = e;
      times = 1;
    } else if (w === bw) {
      times++;
    }
  }
  return { entry: best, weightKg: best.weightKg as number, times };
}

/**
 * Тоннаж за диапазон: Σ(подходы × повторы × вес). Записи без веса не учитываются —
 * иначе «тоннаж» превратился бы в выдумку.
 */
export function tonnageInRange(store: CoachLogStore, athleteId: string, from: string, to: string): number {
  let sum = 0;
  for (const e of store.items) {
    if (e.athleteId !== athleteId || e.kind !== 'lift' || e.weightKg === null) continue;
    if (e.date < from || e.date > to) continue;
    sum += e.sets * e.reps * e.weightKg;
  }
  return Math.round(sum * 10) / 10;
}

export interface CoachWeightTrend {
  from: CoachLogEntry;
  to: CoachLogEntry;
  deltaKg: number;
}

/** Динамика веса тела за последние `days` дней; null — меньше двух записей. */
export function bodyweightTrend(
  store: CoachLogStore,
  athleteId: string,
  today = localIsoDate(),
  days = 30,
): CoachWeightTrend | null {
  const from = shiftIsoDate(today, -Math.max(1, Math.trunc(days)));
  const rows = store.items
    .filter(e => e.athleteId === athleteId && e.kind === 'bodyweight' && e.date >= from && e.date <= today)
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt));
  if (rows.length < 2) return null;
  const first = rows[0];
  const last = rows[rows.length - 1];
  const delta = Math.round(((last.weightKg as number) - (first.weightKg as number)) * 10) / 10;
  return { from: first, to: last, deltaKg: delta };
}

export interface CoachLogSummary {
  entries: number;
  lifts: number;
  bodyweights: number;
  /** Тоннаж за 30 дней (арифметика по весу в записях). */
  tonnage30: number;
  lastDate: string | null;
}

export function logSummaryFor(store: CoachLogStore, athleteId: string, today = localIsoDate()): CoachLogSummary {
  const rows = store.items.filter(e => e.athleteId === athleteId);
  const from = shiftIsoDate(today, -30);
  return {
    entries: rows.length,
    lifts: rows.filter(e => e.kind === 'lift').length,
    bodyweights: rows.filter(e => e.kind === 'bodyweight').length,
    tonnage30: tonnageInRange(store, athleteId, from, today),
    lastDate: rows.length ? rows.map(e => e.date).sort((a, b) => b.localeCompare(a))[0] : null,
  };
}

/** Проверка даты — переиспользуем канон планировщика (31 февраля не существует). */
export const isValidLogDate = (v: unknown): boolean => {
  const s = String(v ?? '');
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && parseLocalIsoDate(s) !== null && isValidCoachDate(s);
};
