/**
 * coach-agenda.engine.ts — автоподтягивание контента приложения в календарь-планер.
 *
 * ЗАЧЕМ. Планер (вкладка «Планер» профиля) умел только личные задачи. Человек
 * просил, чтобы туда сами приезжали инъекции, приём БАДов, приёмы еды, закупки
 * продуктов/БАДов/фармы, тренировки и анализы — и чтобы он сам выбирал, что
 * показывать.
 *
 * КАК УСТРОЕНО.
 *  • `collectAgenda` — чистое чтение localStorage: ничего не пишет в чужие
 *    хранилища и не меняет планы. Любой источник может отсутствовать/быть
 *    битым — адаптер молча отдаёт пусто (одна кривая запись не должна ронять
 *    весь календарь).
 *  • Выбор пользователя живёт отдельно (`he_coach_planner_sources`), задачи
 *    планера (`he_coach_planner`) не трогаются: авто-события не дублируются в
 *    задачи и не «закрываются» как задачи.
 *  • Время источника можно поправить локально (`he_coach_planner_times`):
 *    поправка хранится по id события и применяется только при сборке — чужая
 *    схема/план не перезаписывается.
 *  • «Образ жизни» из калькулятора поддержки (вода, шаги, отказ от курения)
 *    идёт отдельным источником, а не строками «БАДы · в любой приём».
 *  • Даты — только канон `core/local-date` (см. даты ниже: UTC-срез в UTC+10
 *    вечером даёт вчера и уводит событие на сутки).
 *
 * ЧЕГО СОЗНАТЕЛЬНО НЕ ДЕЛАЕМ.
 *  • Не выдумываем то, чего нет в приложении: нет плана тренировок — нет
 *    тренировок; нет плана БАДов — нет приёма БАДов; пустая корзина — нет
 *    закупки. Профиль по умолчанию (пустой `he_profile_v2`) тоже не считается
 *    «настроенным»: без него события не строятся.
 *  • Не придумываем периодичность закупок, кроме одной честной опоры — активный
 *    рацион: продуктовый список покрывает его цикл (неделю), поэтому закупка
 *    стоит на старте каждого цикла.
 */
import { localIsoDate, parseLocalIsoDate, shiftIsoDate } from '../../core/local-date';
import { supportNameRu } from '../../data/support-names';
import { cardioSessionsForDate, type CardioCycle } from '../lms/cardio.engine';
import {
  buildSupplementTiming,
  type SuppSlotKey,
  type SuppTimingMeal,
} from '../../ui/screens/NutritionScreen_parts/IndividualPlan/planner-supplement-timing.engine';
import { generateLabSchedule } from '../labs-schedule.engine';

export const AGENDA_SOURCES_KEY = 'he_coach_planner_sources';
/** Правки времени авто-событий: id события → HH:MM (планёр только хранит). */
export const AGENDA_TIME_KEY = 'he_coach_planner_times';
export const AGENDA_TIME_MAX = 500;

/** Источники, которые планёр умеет подтягивать сам. */
export type AgendaSourceId =
  | 'training'
  | 'cardio'
  | 'injections'
  | 'supplements'
  | 'lifestyle'
  | 'meals'
  | 'food_shop'
  | 'supp_shop'
  | 'pharma_shop'
  | 'labs'
  | 'weigh'
  | 'habits';

export interface AgendaSourceMeta {
  id: AgendaSourceId;
  label: string;
  /** Короткая подпись в сетке/строке. */
  short: string;
  icon: string;
  color: string;
  /** Что именно подтягиваем — чтобы человек понимал, откуда событие. */
  hint: string;
}

export const AGENDA_SOURCES: readonly AgendaSourceMeta[] = [
  {
    id: 'training',
    label: 'Тренировки',
    short: 'Трен.',
    icon: '🏋️',
    color: '#38bdf8',
    hint: 'Дни по графику тренировок и упражнения из активного плана («Тренировки»).',
  },
  {
    id: 'cardio',
    label: 'Кардио',
    short: 'Кардио',
    icon: '🏃',
    color: '#22d3ee',
    hint: 'Запланированные кардио-сессии активного цикла («Тренировки» → Кардио).',
  },
  {
    id: 'injections',
    label: 'Инъекции',
    short: 'Инъек.',
    icon: '💉',
    color: '#f472b6',
    hint: 'Недельное расписание инъекций из дневника инъекций.',
  },
  {
    id: 'supplements',
    label: 'Приём БАДов',
    short: 'БАДы',
    icon: '💊',
    color: '#22c55e',
    hint: 'Слоты приёма (утро/день/вечер) из плана БАДов, время — по приёмам еды.',
  },
  {
    id: 'lifestyle',
    label: 'Образ жизни',
    short: 'ОЖ',
    icon: '🌿',
    color: '#84cc16',
    hint: 'Водный режим, шаги, отказ от курения/алкоголя из плана поддержки — отдельно от БАДов.',
  },
  {
    id: 'meals',
    label: 'Приёмы пищи',
    short: 'Еда',
    icon: '🍽️',
    color: '#f59e0b',
    hint: 'Меню активного рациона по времени каждого приёма.',
  },
  {
    id: 'food_shop',
    label: 'Закупка продуктов',
    short: 'Продукты',
    icon: '🛒',
    color: '#f97316',
    hint: 'Закупка на цикл активного рациона (старт каждого цикла).',
  },
  {
    id: 'supp_shop',
    label: 'Закупка БАДов',
    short: 'Купить БАДы',
    icon: '🧺',
    color: '#14b8a6',
    hint: 'Позиции из корзины БАДов — напоминание на ближайший понедельник.',
  },
  {
    id: 'pharma_shop',
    label: 'Фарма / закупка',
    short: 'Фарма',
    icon: '🧪',
    color: '#ef4444',
    hint: 'Позиции из корзины фармы, дата старта курса и подготовка к нему.',
  },
  {
    id: 'labs',
    label: 'Анализы',
    short: 'Анализы',
    icon: '🔬',
    color: '#a78bfa',
    hint: 'Контрольные точки анализов от даты старта курса (фаза из профиля).',
  },
  {
    id: 'weigh',
    label: 'Взвешивание',
    short: 'Вес',
    icon: '⚖️',
    color: '#e879f9',
    hint: 'Включённое напоминание о взвешивании; факт — из дневника веса.',
  },
  {
    id: 'habits',
    label: 'Привычки',
    short: 'Привычки',
    icon: '✅',
    color: '#2dd4bf',
    hint: 'Ежедневные привычки из трекера привычек (вода, шаги, сон и т.п.).',
  },
];

export const SOURCE_BY_ID: Readonly<Record<AgendaSourceId, AgendaSourceMeta>> = AGENDA_SOURCES.reduce(
  (acc, src) => ({ ...acc, [src.id]: src }),
  {} as Record<AgendaSourceId, AgendaSourceMeta>,
);

export const agendaSourceMeta = (id: AgendaSourceId): AgendaSourceMeta => SOURCE_BY_ID[id];

export interface CoachAgendaEvent {
  /** Стабильный id: одна и та же запись не «мигает» между рендерами. */
  id: string;
  source: AgendaSourceId;
  /** Локальная дата YYYY-MM-DD. */
  date: string;
  /** Время HH:MM; '' — на весь день. */
  time: string;
  title: string;
  detail: string;
  /** Факт уже отмечен в своём модуле (дневник/тренировка). Планёр это не меняет. */
  done: boolean;
}

export interface AgendaStorage {
  getItem(key: string): string | null;
}

export interface CollectAgendaOptions {
  /** Первая дата диапазона (включительно), YYYY-MM-DD. */
  from: string;
  /** Последняя дата диапазона (включительно), YYYY-MM-DD. */
  to: string;
  /** Включённые источники; по умолчанию — все. */
  sources?: readonly AgendaSourceId[];
  /** Опорная «сегодня» (для тестов и пересчёта через полночь). */
  today?: string;
}

/* ═══════════════════════════════════════════════════════════════════════
   Настройки источников
   ═══════════════════════════════════════════════════════════════════════ */

const ALL_SOURCE_IDS: AgendaSourceId[] = AGENDA_SOURCES.map(s => s.id);
const KNOWN_SOURCES = new Set<string>(ALL_SOURCE_IDS);

/** Все источники включены — так планёр «из коробки» показывает распорядок. */
export function defaultAgendaSources(): AgendaSourceId[] {
  return [...ALL_SOURCE_IDS];
}

export function sanitizeAgendaSources(value: unknown): AgendaSourceId[] {
  if (!Array.isArray(value)) return defaultAgendaSources();
  const seen = new Set<AgendaSourceId>();
  for (const raw of value) {
    if (typeof raw !== 'string' || !KNOWN_SOURCES.has(raw)) continue;
    seen.add(raw as AgendaSourceId);
  }
  // Сохраняем порядок каталога, а не пользовательский: чипы не прыгают.
  return ALL_SOURCE_IDS.filter(id => seen.has(id));
}

export function readAgendaSources(storage: AgendaStorage | null | undefined): AgendaSourceId[] {
  if (!storage) return defaultAgendaSources();
  let raw: string | null = null;
  try {
    raw = storage.getItem(AGENDA_SOURCES_KEY);
  } catch {
    return defaultAgendaSources();
  }
  if (!raw) return defaultAgendaSources();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return defaultAgendaSources();
    const obj = parsed as Record<string, unknown>;
    if (obj.version !== 1) return defaultAgendaSources();
    return sanitizeAgendaSources(obj.enabled);
  } catch {
    return defaultAgendaSources();
  }
}

export function writeAgendaSources(
  storage: { setItem?: (key: string, value: string) => void } | null | undefined,
  enabled: readonly AgendaSourceId[],
): AgendaSourceId[] {
  const next = sanitizeAgendaSources(enabled);
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(AGENDA_SOURCES_KEY, JSON.stringify({ version: 1, enabled: next }));
    } catch {
      /* quota/private — выбор не критичен для чтения данных */
    }
  }
  return next;
}

/* ═══════════════════════════════════════════════════════════════════════
   Утилиты чтения/валидации
   ═══════════════════════════════════════════════════════════════════════ */

type JsonRecord = Record<string, unknown>;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DAY_MS = 86_400_000;

const isRecord = (v: unknown): v is JsonRecord => !!v && typeof v === 'object' && !Array.isArray(v);
const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const text = (v: unknown, max = 120): string => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const validIso = (v: unknown): string | null => {
  const s = text(v, 10);
  if (!ISO_DATE_RE.test(s)) return null;
  const d = parseLocalIsoDate(s);
  return d && localIsoDate(d) === s ? s : null;
};

const validTime = (v: unknown): string => {
  const s = text(v, 5);
  return TIME_RE.test(s) ? s : '';
};

/** 0 = Пн … 6 = Вс для локальной даты. */
function mondayIndex(iso: string): number {
  const d = parseLocalIsoDate(iso);
  if (!d) return 0;
  return (d.getDay() + 6) % 7;
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = parseLocalIsoDate(fromIso);
  const b = parseLocalIsoDate(toIso);
  if (!a || !b) return 0;
  return Math.round((b.getTime() - a.getTime()) / DAY_MS);
}

function readJson(storage: AgendaStorage | null | undefined, key: string): unknown {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function readArray(storage: AgendaStorage | null | undefined, key: string): unknown[] {
  const parsed = readJson(storage, key);
  return Array.isArray(parsed) ? parsed : [];
}

/* ═══════════════════════════════════════════════════════════════════════
   Контекст: один проход по хранилищу на весь диапазон
   ═══════════════════════════════════════════════════════════════════════ */

interface MealPlanLike {
  date: string;
  dayPlan?: unknown;
  threeDayPlan?: unknown;
  weekPlan?: unknown;
  shoppingList?: unknown;
}

interface TrainingScheduleLike {
  enabled?: boolean;
  scheduleType?: string;
  weeklyDays?: unknown;
  startTime?: unknown;
  pattern?: { work?: unknown; off?: unknown };
}

interface AgendaContext {
  today: string;
  /** Настроенный профиль (только если `he_profile_v2` реально существует). */
  profile: { training: JsonRecord | null; pharma: JsonRecord | null; personal: JsonRecord | null } | null;
  runtime: JsonRecord | null;
  runtimeDays: unknown[];
  sessionDates: Set<string>;
  supplementPlan: string[];
  supportDiary: Map<string, JsonRecord>;
  injectionSchedule: unknown[];
  injectionDone: Set<string>;
  nutritionPlan: MealPlanLike | null;
  foodDiary: JsonRecord | null;
  cart: JsonRecord[];
  /** Активный кардио-цикл; без валидного старта серии «съезжают» каждый день. */
  cardioCycle: CardioCycle | null;
  cardioDone: Set<string>;
  /** Включённое напоминание о взвешивании (`he_reminders_v1`). */
  weighReminder: { time: string } | null;
  weightDone: Set<string>;
  habits: JsonRecord[];
}

function isMealPlan(value: unknown): value is MealPlanLike {
  return isRecord(value) && typeof value.date === 'string' && ISO_DATE_RE.test(value.date);
}

function readNutritionPlan(storage: AgendaStorage | null | undefined): MealPlanLike | null {
  const active = readJson(storage, 'he_nutrition_active_plan_v1');
  if (isMealPlan(active)) return active;
  // Старый ключ сохранённых рационов и отдельный архив планировщика: у людей
  // данные остались в одном из них, и «активный» мог ещё не создаться.
  for (const key of ['he_saved_nutrition_plans', 'he_saved_nutrition_plans_archive_v1']) {
    for (const row of readArray(storage, key)) {
      if (isMealPlan(row)) return row;
    }
  }
  return null;
}

function readSessionDates(storage: AgendaStorage | null | undefined): Set<string> {
  const out = new Set<string>();
  // v2 — основной журнал; остальные — legacy, которые ещё встречаются у людей.
  for (const key of ['he_workout_log_v2', 'he_workout_log', 'he_training_log']) {
    const rows = readArray(storage, key);
    for (const row of rows) {
      if (!isRecord(row)) continue;
      const iso = validIso(row.date);
      if (iso) out.add(iso);
    }
  }
  return out;
}

function readSupportDiary(storage: AgendaStorage | null | undefined): Map<string, JsonRecord> {
  const out = new Map<string, JsonRecord>();
  for (const row of readArray(storage, 'he_support_diary')) {
    if (!isRecord(row)) continue;
    const iso = validIso(row.date);
    if (!iso) continue;
    const subs = isRecord(row.substances) ? row.substances : {};
    out.set(iso, subs);
  }
  return out;
}

function readSupplementPlan(storage: AgendaStorage | null | undefined): string[] {
  const parsed = readJson(storage, 'he_support_plan_result');
  if (!Array.isArray(parsed)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of parsed) {
    if (typeof raw !== 'string') continue;
    const id = text(raw, 80);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.slice(0, 80);
}

function readInjectionDone(storage: AgendaStorage | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const row of readArray(storage, 'he_injection_diary')) {
    if (!isRecord(row)) continue;
    const iso = validIso(row.date);
    const substance = text(row.substance, 60).toLowerCase();
    if (iso && substance) out.add(`${iso}|${substance}`);
  }
  return out;
}

/**
 * Активный кардио-цикл — только с валидной датой старта. Без старта
 * `cardioSessionsForDate` считает неделей 1 «сегодня», и серии ползут вперёд
 * каждый день: это была бы выдумка, а не план.
 */
function readActiveCardioCycle(storage: AgendaStorage | null | undefined): CardioCycle | null {
  const raw = readJson(storage, 'he_active_cardio_cycle');
  if (!isRecord(raw) || !Array.isArray(raw.weeks) || raw.weeks.length === 0) return null;
  if (!validIso(raw.startDate)) return null;
  return raw as unknown as CardioCycle;
}

function readCardioDone(storage: AgendaStorage | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const row of readArray(storage, 'he_cardio_sessions')) {
    if (!isRecord(row)) continue;
    const iso = validIso(row.date);
    if (iso) out.add(iso);
  }
  return out;
}

function readWeighReminder(storage: AgendaStorage | null | undefined): { time: string } | null {
  const prefs = readJson(storage, 'he_reminders_v1');
  if (!isRecord(prefs) || !isRecord(prefs.weigh) || prefs.weigh.enabled !== true) return null;
  return { time: validTime(prefs.weigh.time) };
}

function readWeightDone(storage: AgendaStorage | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const row of readArray(storage, 'he_weight_log')) {
    if (!isRecord(row)) continue;
    const iso = validIso(row.date);
    if (iso) out.add(iso);
  }
  return out;
}

function readHabits(storage: AgendaStorage | null | undefined): JsonRecord[] {
  return readArray(storage, 'he_habits')
    .filter((row): row is JsonRecord => isRecord(row) && text(row.name, 60) !== '')
    .slice(0, 20);
}

function buildContext(storage: AgendaStorage | null | undefined, today: string): AgendaContext {
  const profileRaw = readJson(storage, 'he_profile_v2');
  let profile: AgendaContext['profile'] = null;
  if (isRecord(profileRaw)) {
    const settings = isRecord(profileRaw.settings) ? profileRaw.settings : {};
    profile = {
      training: isRecord(settings.training) ? settings.training : null,
      pharma: isRecord(settings.pharma) ? settings.pharma : isRecord(profileRaw.pharma) ? profileRaw.pharma : null,
      personal: isRecord(settings.personal) ? settings.personal : null,
    };
  }

  const runtimeRaw = readJson(storage, 'he_pl_runtime');
  const runtime = isRecord(runtimeRaw) ? runtimeRaw : null;
  const runtimeDays = asArray(runtime?.days).filter(
    day => isRecord(day) && Array.isArray(day.exercises),
  );

  const foodDiaryRaw = readJson(storage, 'he_diary_v2');

  return {
    today,
    profile,
    runtime,
    runtimeDays,
    sessionDates: readSessionDates(storage),
    supplementPlan: readSupplementPlan(storage),
    supportDiary: readSupportDiary(storage),
    injectionSchedule: readArray(storage, 'he_injection_schedule'),
    injectionDone: readInjectionDone(storage),
    nutritionPlan: readNutritionPlan(storage),
    foodDiary: isRecord(foodDiaryRaw) ? foodDiaryRaw : null,
    cart: readArray(storage, 'supportCart').filter(isRecord),
    cardioCycle: readActiveCardioCycle(storage),
    cardioDone: readCardioDone(storage),
    weighReminder: readWeighReminder(storage),
    weightDone: readWeightDone(storage),
    habits: readHabits(storage),
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Общий помощник: дни диапазона
   ═══════════════════════════════════════════════════════════════════════ */

function eachDate(from: string, to: string, visit: (iso: string) => void): void {
  let iso = from;
  // Ограничение от зависшего календаря: максимум 3 года.
  for (let guard = 0; guard < 1100 && iso <= to; guard++) {
    visit(iso);
    iso = shiftIsoDate(iso, 1);
  }
}

const pushEvent = (
  out: CoachAgendaEvent[],
  event: Omit<CoachAgendaEvent, 'title' | 'detail'> & { title: string; detail?: string },
): void => {
  const title = text(event.title, 120);
  if (!title) return;
  out.push({
    id: event.id,
    source: event.source,
    date: event.date,
    time: validTime(event.time),
    title,
    detail: text(event.detail, 160),
    done: event.done === true,
  });
};

/* ═══════════════════════════════════════════════════════════════════════
   1. Тренировки
   ═══════════════════════════════════════════════════════════════════════ */

const WEEKDAY_PATTERN: Record<number, number[]> = {
  1: [2],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.trunc(num(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/**
 * Дни недели по графику профиля. `null` — график «work/off», его считаем по дате.
 * Возвращает null и когда в профиле нет осмысленного расписания.
 */
function trainingWeekdays(training: JsonRecord | null): boolean[] | null {
  const schedule = isRecord(training?.schedule) ? (training!.schedule as TrainingScheduleLike) : null;
  if (schedule && schedule.enabled === true) {
    if (schedule.scheduleType === 'pattern') return null; // считается по циклу work/off
    if (schedule.scheduleType === 'weekly') {
      const list = asArray(schedule.weeklyDays);
      if (list.length === 7) return list.map(v => v === true);
    } else if (schedule.scheduleType === 'eod') {
      // Пн/Ср/Пт/Вс — «через день» от понедельника.
      return [0, 1, 2, 3, 4, 5, 6].map(i => i % 2 === 0);
    }
  }
  // Нет включённого графика (или он неполный) — раскладка по daysPerWeek.
  const perWeek = clampInt(training?.daysPerWeek, 1, 7, 3);
  const days = WEEKDAY_PATTERN[perWeek] ?? WEEKDAY_PATTERN[3];
  return Array.from({ length: 7 }, (_, i) => days.includes(i));
}

/** Цикл «работа/отдых»: тренировочный ли день. */
function patternTrainingToday(training: JsonRecord | null, iso: string): boolean {
  const schedule = isRecord(training?.schedule) ? (training!.schedule as TrainingScheduleLike) : null;
  const pattern = isRecord(schedule?.pattern) ? schedule!.pattern! : null;
  const work = clampInt(pattern?.work, 1, 14, 2);
  const off = clampInt(pattern?.off, 0, 14, 1);
  if (off === 0) return true;
  const epoch = Date.UTC(2024, 0, 1);
  const [y, m, d] = iso.split('-').map(Number);
  const dayMs = Date.UTC(y, m - 1, d) - epoch;
  const pos = ((Math.floor(dayMs / DAY_MS) % (work + off)) + (work + off)) % (work + off);
  return pos < work;
}

function isTrainingDayFor(training: JsonRecord | null, iso: string): boolean {
  if (!training) return false;
  const schedule = isRecord(training.schedule) ? (training.schedule as TrainingScheduleLike) : null;
  if (schedule?.enabled === true && schedule.scheduleType === 'pattern') {
    return patternTrainingToday(training, iso);
  }
  const weekly = trainingWeekdays(training);
  return !!weekly?.[mondayIndex(iso)];
}

/** Какой день плана (`he_pl_runtime.days`) соответствует дате. */
function pickTrainingDayIndex(ctx: AgendaContext, training: JsonRecord, iso: string, planDays: number): number {
  if (planDays <= 0) return 0;
  const schedule = isRecord(training.schedule) ? (training.schedule as TrainingScheduleLike) : null;
  if (schedule?.enabled === true && schedule.scheduleType === 'pattern') {
    const weekStart = shiftIsoDate(iso, -mondayIndex(iso));
    let done = 0;
    for (const date of ctx.sessionDates) {
      if (date >= weekStart && date <= iso) done += 1;
    }
    return done % planDays;
  }
  const weekly = trainingWeekdays(training);
  if (!weekly) return 0;
  const positions = weekly.map((v, i) => (v ? i : -1)).filter(i => i >= 0);
  if (positions.length === 0) return 0;
  const dow = mondayIndex(iso);
  const exact = positions.indexOf(dow);
  if (exact >= 0) return exact % planDays;
  // Отдых: показываем ближайший тренировочный день программы (по кругу).
  const next = positions.find(p => p > dow) ?? positions[0];
  return positions.indexOf(next) % planDays;
}

function trainingEvents(ctx: AgendaContext, from: string, to: string): CoachAgendaEvent[] {
  const training = ctx.profile?.training;
  // Без профиля и без рантайма плана — не выдумываем тренировки.
  if (!training || ctx.runtimeDays.length === 0) return [];
  const schedule = isRecord(training.schedule) ? (training.schedule as TrainingScheduleLike) : null;
  const startTime = validTime(schedule?.startTime);
  const focus = text(ctx.runtime?.focus, 60);
  const out: CoachAgendaEvent[] = [];

  eachDate(from, to, iso => {
    if (!isTrainingDayFor(training, iso)) return;
    const idx = pickTrainingDayIndex(ctx, training, iso, ctx.runtimeDays.length);
    const day = ctx.runtimeDays[idx % ctx.runtimeDays.length];
    if (!isRecord(day)) return;
    const label = text(day.label, 40) || 'Тренировка';
    const exercises = asArray(day.exercises).filter(isRecord);
    const sets = exercises.reduce(
      (sum, ex) => sum + asArray(ex.targetSets).length,
      0,
    );
    const title = focus && focus !== label ? `${focus} · ${label}` : label;
    const detail = [
      exercises.length > 0 ? `${exercises.length} упр.` : '',
      sets > 0 ? `${sets} подх.` : '',
    ].filter(Boolean).join(' · ');
    pushEvent(out, {
      id: `agenda:training:${iso}`,
      source: 'training',
      date: iso,
      time: startTime,
      title,
      detail,
      done: ctx.sessionDates.has(iso),
    });
  });

  return out;
}

/* ═══════════════════════════════════════════════════════════════════════
   1b. Кардио (активный кардио-цикл)
   ═══════════════════════════════════════════════════════════════════════ */

const CARDIO_TYPE_LABEL: Record<string, string> = {
  zone2: 'Zone 2',
  hiit: 'HIIT',
  miss: 'MISS',
  recovery: 'Recovery',
};

function cardioEvents(ctx: AgendaContext, from: string, to: string): CoachAgendaEvent[] {
  const cycle = ctx.cardioCycle;
  if (!cycle) return [];
  const out: CoachAgendaEvent[] = [];
  eachDate(from, to, iso => {
    let scheduled: ReturnType<typeof cardioSessionsForDate> = null;
    try {
      scheduled = cardioSessionsForDate(cycle, iso);
    } catch {
      return;
    }
    if (!scheduled || scheduled.sessions.length === 0) return;
    scheduled.sessions.forEach((session, i) => {
      const type = text(session.type, 20);
      const label = CARDIO_TYPE_LABEL[type] ?? (type || 'Кардио');
      const minutes = Math.max(0, Math.round(num(session.durationMin)));
      const equipment = text(session.equipment, 20);
      pushEvent(out, {
        id: `agenda:cardio:${iso}:${i}`,
        source: 'cardio',
        date: iso,
        time: '',
        title: `${label}${minutes > 0 ? ` · ${minutes} мин` : ''}`,
        detail: [text(session.purpose, 100), equipment].filter(Boolean).join(' · '),
        done: ctx.cardioDone.has(iso),
      });
    });
  });
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════
   2. Инъекции
   ═══════════════════════════════════════════════════════════════════════ */

function injectionEvents(ctx: AgendaContext, from: string, to: string): CoachAgendaEvent[] {
  const out: CoachAgendaEvent[] = [];
  for (const [idx, raw] of ctx.injectionSchedule.entries()) {
    if (!isRecord(raw) || raw.active === false) continue;
    const substance = text(raw.substance, 60);
    if (!substance) continue;
    const days = asArray(raw.daysOfWeek)
      .map(d => Number(d))
      .filter(d => Number.isInteger(d) && d >= 0 && d <= 6);
    if (days.length === 0) continue;
    const dose = text(raw.dose, 20);
    const time = validTime(raw.time);

    eachDate(from, to, iso => {
      if (!days.includes(mondayIndex(iso))) return;
      pushEvent(out, {
        // idx — чтобы две схемы с одинаковым названием не дали один React-ключ.
        id: `agenda:injections:${idx}:${iso}`,
        source: 'injections',
        date: iso,
        time,
        title: `Инъекция · ${substance}${dose ? ` ${dose}` : ''}`,
        detail: [text(raw.zone, 40), text(raw.notes, 80)].filter(Boolean).join(' · '),
        done: ctx.injectionDone.has(`${iso}|${substance.toLowerCase()}`),
      });
    });
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════
   3. Приёмы пищи + 4. Закупка продуктов (общий источник — активный рацион)
   ═══════════════════════════════════════════════════════════════════════ */

const DEFAULT_MEAL_TIMES: Record<string, string> = {
  breakfast: '08:00',
  lunch: '13:00',
  dinner: '19:00',
  snack: '16:00',
  presleep: '22:00',
  preworkout: '07:00',
  postworkout: '10:00',
  intra: '09:30',
};

const FALLBACK_MEAL_TIMES = ['08:00', '13:00', '19:00', '16:00', '22:00'];

/** День рациона, соответствующий дате (недельный/3-дневный цикл от даты плана). */
function planDayForDate(plan: MealPlanLike | null, iso: string): JsonRecord | null {
  if (!plan) return null;
  const base = validIso(plan.date);
  const week = isRecord(plan.weekPlan) ? asArray(plan.weekPlan.days) : [];
  const three = isRecord(plan.threeDayPlan) ? asArray(plan.threeDayPlan.days) : [];
  const cycle = week.length > 0 ? week : three;
  if (base && cycle.length > 0) {
    const diff = daysBetween(base, iso);
    const idx = ((diff % cycle.length) + cycle.length) % cycle.length;
    const picked = cycle[idx];
    if (isRecord(picked)) return picked;
  }
  return isRecord(plan.dayPlan) ? plan.dayPlan : null;
}

function mealTimeOf(meal: JsonRecord, index: number): string {
  const direct = validTime(meal.time);
  if (direct) return direct;
  const type = text(meal.type, 24).toLowerCase();
  return DEFAULT_MEAL_TIMES[type] ?? FALLBACK_MEAL_TIMES[Math.min(index, FALLBACK_MEAL_TIMES.length - 1)] ?? '';
}

function mealsForDate(ctx: AgendaContext, iso: string): { meals: SuppTimingMeal[]; day: JsonRecord | null } {
  const day = planDayForDate(ctx.nutritionPlan, iso);
  const rawMeals = asArray(day?.meals).filter(isRecord);
  const meals: SuppTimingMeal[] = rawMeals.map((m, i) => ({
    type: text(m.type, 24),
    label: text(m.label, 40) || `Приём ${i + 1}`,
    time: mealTimeOf(m, i),
    items: asArray(m.items).filter(isRecord).map(it => ({
      id: text(it.id, 40),
      name: text(it.name, 60),
      f: num(it.f),
    })),
  }));
  return { meals, day };
}

function mealLogged(ctx: AgendaContext, iso: string, type: string): boolean {
  if (!ctx.foodDiary) return false;
  const day = ctx.foodDiary[iso];
  if (!isRecord(day) || !isRecord(day.meals)) return false;
  const key = type || 'meal';
  const items = day.meals[key];
  return Array.isArray(items) && items.length > 0;
}

function mealEvents(ctx: AgendaContext, from: string, to: string): CoachAgendaEvent[] {
  if (!ctx.nutritionPlan) return [];
  const out: CoachAgendaEvent[] = [];
  eachDate(from, to, iso => {
    const { meals, day } = mealsForDate(ctx, iso);
    const rawMeals = asArray(day?.meals).filter(isRecord);
    meals.forEach((meal, i) => {
      if (!meal.items || meal.items.length === 0) return;
      const totals = isRecord(rawMeals[i]?.totals) ? (rawMeals[i].totals as JsonRecord) : null;
      const kcal = num(totals?.kcal);
      const names = meal.items.map(it => text(it.name, 60)).filter(Boolean);
      const shown = names.slice(0, 3).join(', ');
      const rest = names.length > 3 ? ` +${names.length - 3}` : '';
      const detailParts = [shown + rest];
      if (kcal > 0) detailParts.push(`${Math.round(kcal)} ккал`);
      pushEvent(out, {
        id: `agenda:meals:${iso}:${i}`,
        source: 'meals',
        date: iso,
        time: meal.time,
        title: meal.label,
        detail: detailParts.filter(Boolean).join(' · '),
        done: mealLogged(ctx, iso, meal.type),
      });
    });
  });
  return out;
}

function foodShopEvents(ctx: AgendaContext, from: string, to: string): CoachAgendaEvent[] {
  const plan = ctx.nutritionPlan;
  if (!plan) return [];
  const items = asArray(plan.shoppingList)
    .filter(isRecord)
    .filter(it => text(it.name, 60) !== '');
  if (items.length === 0) return [];

  // Список покрывает цикл рациона: неделю — ставим на старт недели,
  // 3 дня — на старт трёхдневки, дневной — раз в неделю (иначе шум каждый день).
  const week = isRecord(plan.weekPlan) ? asArray(plan.weekPlan.days) : [];
  const three = isRecord(plan.threeDayPlan) ? asArray(plan.threeDayPlan.days) : [];
  const cycleDays = week.length > 0 ? 7 : three.length > 0 ? 3 : 7;
  const base = validIso(plan.date) ?? shiftIsoDate(ctx.today, -mondayIndex(ctx.today));
  const names = items.map(it => text(it.name, 40)).filter(Boolean);
  const detail = `${names.slice(0, 4).join(', ')}${names.length > 4 ? ` +${names.length - 4}` : ''}`;

  const out: CoachAgendaEvent[] = [];
  eachDate(from, to, iso => {
    const diff = daysBetween(base, iso);
    if (((diff % cycleDays) + cycleDays) % cycleDays !== 0) return;
    pushEvent(out, {
      id: `agenda:food_shop:${iso}`,
      source: 'food_shop',
      date: iso,
      time: '',
      title: `Закупка продуктов · ${items.length} поз.`,
      detail,
      done: false,
    });
  });
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════
   5. Приём БАДов · 5b. Образ жизни (отдельно от БАДов)
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * «Образ жизни» из калькулятора поддержки (`FOUNDATION_ITEMS`, kind=lifestyle).
 * Электролиты — минерал, остаются в БАДах: это всё-таки приём, а не привычка.
 */
const LIFESTYLE_SUPPORT_IDS: ReadonlySet<string> = new Set([
  'hydration',
  'cardio_aerobic',
  'daily_steps',
  'no_smoking',
  'no_alcohol',
]);

export const isLifestyleSupportId = (id: string): boolean =>
  LIFESTYLE_SUPPORT_IDS.has(String(id ?? '').trim().toLowerCase());

const SUPP_SLOT_TITLE: Record<SuppSlotKey, string> = {
  preWO: 'перед тренировкой',
  intra: 'во время тренировки',
  postWO: 'после тренировки',
  breakfast: 'завтрак',
  lunch: 'обед',
  dinner: 'ужин',
  presleep: 'перед сном',
  anytime: 'в течение дня',
};

function takenSubstances(ctx: AgendaContext, iso: string): Set<string> {
  const out = new Set<string>();
  const subs = ctx.supportDiary.get(iso);
  if (!subs) return out;
  for (const [id, raw] of Object.entries(subs)) {
    if (isRecord(raw) && raw.taken === true) out.add(id);
  }
  return out;
}

function supplementEvents(ctx: AgendaContext, from: string, to: string): CoachAgendaEvent[] {
  // «Образ жизни» — не приём БАДов: у него свой источник и своя строка.
  const planIds = ctx.supplementPlan.filter(id => !isLifestyleSupportId(id));
  if (planIds.length === 0) return [];
  const training = ctx.profile?.training ?? null;
  const personal = ctx.profile?.personal ?? null;
  const weightKg = Math.max(30, num(personal?.weight) || 80);
  const sex = text(personal?.sex, 10) === 'female' ? 'female' : 'male';
  const goal = text(training?.primaryGoal, 20) || undefined;

  const supplements = planIds.map(id => ({ id, nameRu: supportNameRu(id) }));
  const out: CoachAgendaEvent[] = [];

  eachDate(from, to, iso => {
    const { meals } = mealsForDate(ctx, iso);
    let timing;
    try {
      timing = buildSupplementTiming({
        supplements,
        meals,
        isTrainingDay: isTrainingDayFor(training, iso),
        weightKg,
        sex,
        goal,
      });
    } catch {
      return;
    }
    if (!timing || timing.slots.length === 0) return;
    const taken = takenSubstances(ctx, iso);
    for (const slot of timing.slots) {
      const names = slot.items.map(it => text(it.name, 60)).filter(Boolean);
      if (names.length === 0) continue;
      const done = slot.items.every(it => taken.has(it.id));
      pushEvent(out, {
        id: `agenda:supplements:${iso}:${slot.slot}`,
        source: 'supplements',
        date: iso,
        time: validTime(slot.time),
        title: `БАДы · ${SUPP_SLOT_TITLE[slot.slot] ?? 'приём'}`,
        detail: names.join(', '),
        done,
      });
    }
  });

  return out;
}

/* ═══════════════════════════════════════════════════════════════════════
   5c. Образ жизни — ежедневные привычки из плана поддержки
   ═══════════════════════════════════════════════════════════════════════ */

function lifestyleEvents(ctx: AgendaContext, from: string, to: string): CoachAgendaEvent[] {
  const ids = ctx.supplementPlan.filter(isLifestyleSupportId);
  if (ids.length === 0) return [];
  const out: CoachAgendaEvent[] = [];
  eachDate(from, to, iso => {
    const taken = takenSubstances(ctx, iso);
    for (const id of ids) {
      pushEvent(out, {
        id: `agenda:lifestyle:${iso}:${id}`,
        source: 'lifestyle',
        date: iso,
        time: '',
        title: supportNameRu(id),
        detail: 'Из плана поддержки · ежедневно',
        done: taken.has(id),
      });
    }
  });
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════
   5d. Взвешивание и привычки (трекеры)
   ═══════════════════════════════════════════════════════════════════════ */

function weighEvents(ctx: AgendaContext, from: string, to: string): CoachAgendaEvent[] {
  const reminder = ctx.weighReminder;
  if (!reminder) return [];
  const out: CoachAgendaEvent[] = [];
  eachDate(from, to, iso => {
    pushEvent(out, {
      id: `agenda:weigh:${iso}`,
      source: 'weigh',
      date: iso,
      time: reminder.time,
      title: 'Взвешивание',
      detail: 'Напоминание из «Напоминаний» · факт из дневника веса',
      done: ctx.weightDone.has(iso),
    });
  });
  return out;
}

function habitsEvents(ctx: AgendaContext, from: string, to: string): CoachAgendaEvent[] {
  if (ctx.habits.length === 0) return [];
  const out: CoachAgendaEvent[] = [];
  eachDate(from, to, iso => {
    for (const habit of ctx.habits) {
      const name = text(habit.name, 60);
      if (!name) continue;
      const habitId = text(habit.id, 60) || name;
      const done = asArray(habit.completions).some(
        row => isRecord(row) && validIso(row.date) === iso && row.done === true,
      );
      pushEvent(out, {
        id: `agenda:habits:${iso}:${habitId}`,
        source: 'habits',
        date: iso,
        time: '',
        title: name,
        detail: text(habit.target, 40),
        done,
      });
    }
  });
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════
   6. Закупка БАДов / фармы (корзина + старт курса) + 7. Анализы
   ═══════════════════════════════════════════════════════════════════════ */
function isPharmaCartItem(item: JsonRecord): boolean {
  const category = text(item.category, 20).toLowerCase();
  if (category === 'pharma') return true;
  if (category === 'supplement' || category === 'vitamin') return false;
  const id = text(item.id, 80).toLowerCase();
  return id.startsWith('pharma_') || id.includes('injection');
}

/** Позиция корзины без id/названия — мусор из старых версий, её не показываем. */
function isCartItem(item: JsonRecord): boolean {
  return typeof item.id === 'string' ? text(item.id, 80) !== '' : text(item.name, 60) !== '';
}

function cartNames(items: JsonRecord[]): string {
  const names = items.map(it => text(it.name, 40) || supportNameRu(text(it.id, 80))).filter(Boolean);
  return `${names.slice(0, 4).join(', ')}${names.length > 4 ? ` +${names.length - 4}` : ''}`;
}

/** Ближайшие понедельники (день закупок) в диапазоне, не раньше сегодня. */
function mondayShopDates(ctx: AgendaContext, from: string, to: string): string[] {
  const out: string[] = [];
  const start = from > ctx.today ? from : ctx.today;
  eachDate(start, to, iso => {
    if (mondayIndex(iso) === 0) out.push(iso);
  });
  return out;
}

function cartShopEvents(ctx: AgendaContext, from: string, to: string): CoachAgendaEvent[] {
  const items = ctx.cart.filter(isCartItem);
  const supp = items.filter(it => !isPharmaCartItem(it));
  const pharma = items.filter(isPharmaCartItem);
  if (supp.length === 0 && pharma.length === 0) return [];
  const dates = mondayShopDates(ctx, from, to);
  const out: CoachAgendaEvent[] = [];
  for (const iso of dates) {
    if (supp.length > 0) {
      pushEvent(out, {
        id: `agenda:supp_shop:${iso}`,
        source: 'supp_shop',
        date: iso,
        time: '',
        title: `Закупка БАДов · ${supp.length} поз.`,
        detail: cartNames(supp),
        done: false,
      });
    }
    if (pharma.length > 0) {
      pushEvent(out, {
        id: `agenda:pharma_shop:${iso}:cart`,
        source: 'pharma_shop',
        date: iso,
        time: '',
        title: `Закупка фармы · ${pharma.length} поз.`,
        detail: cartNames(pharma),
        done: false,
      });
    }
  }
  return out;
}

function pharmaCourseEvents(ctx: AgendaContext, from: string, to: string): CoachAgendaEvent[] {
  const start = validIso(ctx.profile?.pharma?.courseStartDate);
  if (!start) return [];
  const out: CoachAgendaEvent[] = [];
  if (start >= from && start <= to) {
    pushEvent(out, {
      id: `agenda:pharma_shop:${start}:start`,
      source: 'pharma_shop',
      date: start,
      time: '',
      title: 'Старт курса фармы',
      detail: 'Дата из профиля (фарма → старт курса).',
      done: false,
    });
  }
  const prep = shiftIsoDate(start, -7);
  if (prep >= from && prep <= to) {
    pushEvent(out, {
      id: `agenda:pharma_shop:${prep}:prep`,
      source: 'pharma_shop',
      date: prep,
      time: '',
      title: 'Подготовить фарму к курсу',
      detail: 'За неделю до старта: проверьте наличие и дозы.',
      done: false,
    });
  }
  return out;
}

function labEvents(ctx: AgendaContext, from: string, to: string): CoachAgendaEvent[] {
  const pharma = ctx.profile?.pharma;
  const start = validIso(pharma?.courseStartDate);
  if (!start) return [];
  const phase = text(pharma?.phase, 20) || 'baseline';
  let schedule;
  try {
    schedule = generateLabSchedule({ phase, courseStartDate: start, courseEntries: [] });
  } catch {
    return [];
  }
  const out: CoachAgendaEvent[] = [];
  for (const item of schedule) {
    const week = clampInt((item as { week?: unknown }).week, 0, 520, 0);
    const iso = shiftIsoDate(start, week * 7);
    if (iso < from || iso > to) continue;
    const labs = Array.isArray(item.labs) ? item.labs : [];
    const label = text(item.label, 60) || 'Контроль';
    pushEvent(out, {
      id: `agenda:labs:${start}:${week}:${label}`,
      source: 'labs',
      date: iso,
      time: '',
      title: `Анализы · ${label}`,
      detail: `${labs.slice(0, 5).join(', ')}${labs.length > 5 ? ` +${labs.length - 5}` : ''}`,
      done: false,
    });
  }
  return out;
}

/* ═══════════════════════════════════════════════════════════════════════
   Правки времени авто-событий
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Время, которое человек поправил в планёре, поверх времени источника.
 * Ключ — id конкретного события (он включает дату): правка «на этот день»,
 * а не тихая подмена всей серии. Источник при этом не меняется — планёр
 * лишь хранит поправку и применяет её при сборке.
 */
export function readAgendaTimeOverrides(
  storage: AgendaStorage | null | undefined,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!storage) return out;
  const parsed = readJson(storage, AGENDA_TIME_KEY);
  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.times)) return out;
  for (const [rawId, rawTime] of Object.entries(parsed.times)) {
    const id = text(rawId, 160);
    const time = validTime(rawTime);
    if (id && time) out[id] = time;
  }
  return out;
}

/**
 * Поставить/сбросить время события. `null` или `''` — вернуть время источника.
 * Возвращает актуальную карту (для состояния UI).
 */
export function writeAgendaTimeOverride(
  storage: { getItem?: (key: string) => string | null; setItem?: (key: string, value: string) => void } | null | undefined,
  eventId: string,
  time: string | null,
): Record<string, string> {
  const id = text(eventId, 160);
  const next = readAgendaTimeOverrides(storage as AgendaStorage | null | undefined);
  const valid = time ? validTime(time) : '';
  if (!id) return next;
  if (valid) next[id] = valid;
  else delete next[id];
  // localStorage не резиновый: старые поправки не должны расти вечно.
  const keys = Object.keys(next);
  if (keys.length > AGENDA_TIME_MAX) {
    for (const stale of keys.slice(0, keys.length - AGENDA_TIME_MAX)) delete next[stale];
  }
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(AGENDA_TIME_KEY, JSON.stringify({ version: 1, times: next }));
    } catch {
      /* quota/private — поправка не критична для чтения данных */
    }
  }
  return next;
}

/** Применить поправки времени (и вернуть новые объекты только там, где меняли). */
export function applyAgendaTimeOverrides(
  events: readonly CoachAgendaEvent[],
  overrides: Record<string, string> | null | undefined,
): CoachAgendaEvent[] {
  if (!overrides) return [...events];
  return events.map(ev => {
    const time = overrides[ev.id];
    return time ? { ...ev, time } : ev;
  });
}

/* ═══════════════════════════════════════════════════════════════════════
   Публичный сбор
   ═══════════════════════════════════════════════════════════════════════ */

function byDateThenTime(a: CoachAgendaEvent, b: CoachAgendaEvent): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.time || '99:99').localeCompare(b.time || '99:99') ||
    a.title.localeCompare(b.title, 'ru')
  );
}

/**
 * Собрать авто-события за диапазон дат.
 *
 * Ничего не пишет и не бросает: каждый источник изолирован — кривые данные
 * одного модуля не должны оставить человека без календаря.
 */
export function collectAgenda(
  storage: AgendaStorage | null | undefined,
  opts: CollectAgendaOptions,
): CoachAgendaEvent[] {
  const from = validIso(opts.from) ?? localIsoDate();
  const toCandidate = validIso(opts.to) ?? from;
  const to = toCandidate < from ? from : toCandidate;
  const today = validIso(opts.today) ?? localIsoDate();
  const enabled = new Set<AgendaSourceId>(
    opts.sources ? sanitizeAgendaSources(opts.sources) : defaultAgendaSources(),
  );

  let ctx: AgendaContext;
  try {
    ctx = buildContext(storage, today);
  } catch {
    return [];
  }

  const out: CoachAgendaEvent[] = [];
  const safely = (run: () => CoachAgendaEvent[]): void => {
    try {
      out.push(...run());
    } catch {
      /* источник недоступен — остальные продолжают работать */
    }
  };

  if (enabled.has('training')) safely(() => trainingEvents(ctx, from, to));
  if (enabled.has('cardio')) safely(() => cardioEvents(ctx, from, to));
  if (enabled.has('injections')) safely(() => injectionEvents(ctx, from, to));
  if (enabled.has('supplements')) safely(() => supplementEvents(ctx, from, to));
  if (enabled.has('lifestyle')) safely(() => lifestyleEvents(ctx, from, to));
  if (enabled.has('meals')) safely(() => mealEvents(ctx, from, to));
  if (enabled.has('food_shop')) safely(() => foodShopEvents(ctx, from, to));
  if (enabled.has('supp_shop') || enabled.has('pharma_shop')) {
    safely(() => cartShopEvents(ctx, from, to).filter(ev => enabled.has(ev.source)));
  }
  if (enabled.has('pharma_shop')) safely(() => pharmaCourseEvents(ctx, from, to));
  if (enabled.has('labs')) safely(() => labEvents(ctx, from, to));
  if (enabled.has('weigh')) safely(() => weighEvents(ctx, from, to));
  if (enabled.has('habits')) safely(() => habitsEvents(ctx, from, to));

  // Поправки времени — после сборки: сортировка дня учитывает именно то
  // время, которое человек видит в строках.
  const withTimes = applyAgendaTimeOverrides(out, readAgendaTimeOverrides(storage));
  return withTimes.sort(byDateThenTime);
}

/** Сгруппировать события по дате (ключ — YYYY-MM-DD). */
export function groupAgendaByDate(events: readonly CoachAgendaEvent[]): Record<string, CoachAgendaEvent[]> {
  const out: Record<string, CoachAgendaEvent[]> = {};
  for (const ev of events) {
    if (!out[ev.date]) out[ev.date] = [];
    out[ev.date].push(ev);
  }
  return out;
}

/** Сколько авто-событий на каждом дне — для точек в сетке календаря. */
export function countAgendaByDate(events: readonly CoachAgendaEvent[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const ev of events) out[ev.date] = (out[ev.date] ?? 0) + 1;
  return out;
}

/** Сколько событий даёт каждый включённый источник — для подписей в чипах. */
export function countAgendaBySource(
  events: readonly CoachAgendaEvent[],
): Record<AgendaSourceId, number> {
  const out = {} as Record<AgendaSourceId, number>;
  for (const src of AGENDA_SOURCES) out[src.id] = 0;
  for (const ev of events) out[ev.source] += 1;
  return out;
}
