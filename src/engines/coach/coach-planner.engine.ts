/**
 * coach-planner.engine.ts — календарь-планировщик профиля (в духе TickTick).
 *
 * Задачи/события по дням: «в 18:00 присед у Ивана», «сдать ферритин», «созвон».
 * Что важно и что сознательно НЕ делаем:
 *  • даты — ТОЛЬКО календарные (канон `core/local-date`): `toISOString()` в UTC+10
 *    вечером даёт вчерашний день, и задача уезжает на сутки;
 *  • «повторяющиеся» задачи не выдумываем: серия появляется только после
 *    закрытия вхождения и только по выбранному правилу (день/через день/дни
 *    недели/интервал) — без фантомных будущих задач;
 *  • лимит 2000 задач и 140 символов заголовка: localStorage не резиновый,
 *    при переполнении возвращаем ошибку, а не выкидываем чужие задачи;
 *  • просроченные задачи не «сгорают»: они остаются в дне, пока их не закрыли;
 *    UI показывает их отдельным блоком «просрочено».
 *
 * TickTick-паритет (локальный, без облака и совместного доступа):
 *  • теги, подзадачи, заметка, приоритет, закрепление (pin), ручной порядок;
 *  • smart lists «Сегодня / Завтра / 7 дней / Просрочено / Входящие»;
 *  • сохранённые фильтры (вместе с видом/группировкой/сортировкой), список,
 *    канбан и матрица;
 *  • быстрый ввод с разбором «завтра в 8 вечера #здоровье !высокий», включая
 *    «каждый вторник» и «через 3 дня»;
 *  • «напоминание» — только время-подсказка в карточке: планёр не отправляет
 *    пуши и локальные уведомления;
 *  • снятая галочка убирает только что созданное вхождение серии, но не трогает
 *    вхождение, которое человек уже изменил или сдвинул;
 *  • «следующее вхождение» сдвигает серию без отметки «сделано», а удаление
 *    можно отменить — задача возвращается с тем же id;
 *  • «Дублировать» создаёт копию с новым id: без галочки, порядка дня и
 *    «хвоста» серии, чеклист начинается заново.
 */
import { localIsoDate, parseLocalIsoDate, shiftIsoDate } from '../../core/local-date';

export const COACH_PLANNER_KEY = 'he_coach_planner';
export const COACH_PLANNER_MAX = 2000;
export const COACH_TASK_TITLE_MAX = 140;
export const COACH_TASK_NOTE_MAX = 2000;

export type CoachTaskPriority = 'none' | 'low' | 'medium' | 'high';
/**
 * Повтор задачи. `weekdays` — выбранные дни недели (`repeatDays`),
 * `custom` — свой интервал в днях (`repeatInterval`). Старые сохранённые
 * значения (`daily/weekly/monthly/none`) читаются как раньше.
 */
export type CoachRepeat =
  'none' | 'daily' | 'eod' | 'weekdays' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';
export type CoachTaskList = 'inbox' | 'training' | 'health' | 'work' | 'personal';

export const COACH_PRIORITY_LABELS: Record<CoachTaskPriority, string> = {
  none: 'Обычная',
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
};

export const COACH_REPEAT_LABELS: Record<CoachRepeat, string> = {
  none: 'Один раз',
  daily: 'Каждый день',
  eod: 'Через день',
  weekdays: 'Дни недели',
  weekly: 'Каждую неделю',
  biweekly: 'Каждые 2 недели',
  monthly: 'Каждый месяц',
  yearly: 'Каждый год',
  custom: 'Свой интервал',
};

export const COACH_TASK_LIST_LABELS: Record<CoachTaskList, string> = {
  inbox: 'Входящие',
  training: 'Тренировки',
  health: 'Здоровье',
  work: 'Работа',
  personal: 'Личное',
};

export const COACH_TASK_LISTS: readonly CoachTaskList[] = ['inbox', 'training', 'health', 'work', 'personal'];
export const COACH_PRIORITIES: readonly CoachTaskPriority[] = ['none', 'low', 'medium', 'high'];
export const COACH_REPEATS: readonly CoachRepeat[] = [
  'none',
  'daily',
  'eod',
  'weekdays',
  'weekly',
  'biweekly',
  'monthly',
  'yearly',
  'custom',
];

/** Границы своего интервала повтора (дни). */
export const COACH_REPEAT_INTERVAL_MIN = 1;
export const COACH_REPEAT_INTERVAL_MAX = 365;
export const COACH_REPEAT_INTERVAL_DEFAULT = 2;

/** Границы тегов и подзадач — чтобы localStorage не разрастался. */
export const COACH_TAGS_MAX = 10;
export const COACH_TAG_MAX = 24;
export const COACH_SUBTASKS_MAX = 30;
export const COACH_SUBTASK_TITLE_MAX = 120;

export interface CoachSubtask {
  id: string;
  title: string;
  done: boolean;
}

/**
 * Умные списки (TickTick: Today / Tomorrow / Next 7 Days / Inbox).
 * Ничего не хранят — считаются из задач на каждый рендер.
 */
export type CoachSmartListId = 'all' | 'today' | 'tomorrow' | 'next7' | 'overdue' | 'inbox' | 'done';

export const COACH_SMART_LISTS: readonly {
  id: CoachSmartListId;
  label: string;
  hint: string;
}[] = [
  { id: 'all', label: 'Все', hint: 'Все задачи планера' },
  { id: 'today', label: 'Сегодня', hint: 'Задачи на сегодня' },
  { id: 'tomorrow', label: 'Завтра', hint: 'Задачи на завтра' },
  { id: 'next7', label: '7 дней', hint: 'Сегодня и ближайшие 6 дней' },
  { id: 'overdue', label: 'Просрочено', hint: 'Незакрытые задачи до сегодня' },
  { id: 'inbox', label: 'Входящие', hint: 'Задачи без своего списка' },
  { id: 'done', label: 'Сделано', hint: 'Выполненные задачи' },
];

/** Группировка карточек (TickTick: Group by list/priority/tag/time). */
export type CoachGroupBy = 'none' | 'list' | 'priority' | 'tag' | 'date';
/** Сортировка внутри группы (TickTick: Group & Sort). */
export type CoachSortBy = 'smart' | 'date' | 'priority' | 'created' | 'updated' | 'title' | 'manual';
/** Вид отображения задач. */
export type CoachPlannerView = 'list' | 'kanban' | 'matrix';
export const COACH_PLANNER_VIEWS: readonly CoachPlannerView[] = ['list', 'kanban', 'matrix'];
export const COACH_GROUP_BYS: readonly CoachGroupBy[] = ['none', 'list', 'priority', 'tag', 'date'];
export const COACH_SORT_BYS: readonly CoachSortBy[] = [
  'smart',
  'date',
  'priority',
  'created',
  'updated',
  'title',
  'manual',
];

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
  /** Приоритет (TickTick-подобный). Опционален для задач из старых версий. */
  priority?: CoachTaskPriority;
  /** Повтор: при закрытии задачи создаётся следующее вхождение. */
  repeat?: CoachRepeat;
  /** Дни недели для `repeat: 'weekdays'`: 0 = Пн … 6 = Вс. */
  repeatDays?: number[];
  /** Интервал в днях для `repeat: 'custom'`: 1..365. */
  repeatInterval?: number;
  /** Список/папка задачи. */
  list?: CoachTaskList;
  /** Теги (TickTick tag), без `#`, без дублей. */
  tags?: string[];
  /** Подзадачи-чеклист. Прогресс показывается в карточке. */
  subtasks?: CoachSubtask[];
  /** Закрепление: такие задачи держатся сверху своего дня. */
  pinned?: boolean;
  /** Ручной порядок внутри дня (после перетаскивания). */
  order?: number;
  /** Время-подсказка в карточке, `HH:MM`. Планёр не отправляет уведомлений. */
  reminder?: string | null;
  /** Когда задачу закрыли (ISO-время) — для честной статистики. */
  completedAt?: string;
  /**
   * id задачи, из которой серия создала это вхождение. Нужен, чтобы снятая
   * галочка у предыдущего вхождения убирала только что созданный дубль, но не
   * трогала уже начатую/изменённую задачу.
   */
  spawnedFrom?: string;
}

export const coachTaskPriority = (t: CoachTask): CoachTaskPriority => t.priority ?? 'none';
export const coachTaskRepeat = (t: CoachTask): CoachRepeat => t.repeat ?? 'none';
export const coachTaskList = (t: CoachTask): CoachTaskList => t.list ?? 'inbox';

/** Дни недели повтора (пустой массив, если повтор не «по дням»). */
export const coachTaskRepeatDays = (t: CoachTask): number[] => t.repeatDays ?? [];
/** Теги задачи (пустой массив для старых записей). */
export const coachTaskTags = (t: CoachTask): string[] => t.tags ?? [];
/** Подзадачи задачи. */
export const coachTaskSubtasks = (t: CoachTask): CoachSubtask[] => t.subtasks ?? [];
/** Прогресс по подзадачам: «2/3». */
export function coachSubtaskProgress(t: CoachTask): { done: number; total: number } {
  const list = coachTaskSubtasks(t);
  return { done: list.filter((s) => s.done).length, total: list.length };
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
const text = (v: unknown, max: number): string =>
  String(v ?? '')
    .trim()
    .slice(0, max);
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

export function normalizePriority(v: unknown): CoachTaskPriority {
  return COACH_PRIORITIES.includes(v as CoachTaskPriority) ? (v as CoachTaskPriority) : 'none';
}

export function normalizeRepeat(v: unknown): CoachRepeat {
  return COACH_REPEATS.includes(v as CoachRepeat) ? (v as CoachRepeat) : 'none';
}

/** 0 = Пн … 6 = Вс для локальной ISO-даты (невалидная дата → Пн). */
export function coachWeekdayIndex(iso: string): number {
  const d = parseLocalIsoDate(iso);
  return d ? (d.getDay() + 6) % 7 : 0;
}

/** Дни недели повтора: уникальные 0..6, по возрастанию; всё прочее отбрасываем. */
export function normalizeRepeatDays(v: unknown): number[] {
  const out = new Set<number>();
  for (const raw of Array.isArray(v) ? v : []) {
    const n = Number(raw);
    if (Number.isInteger(n) && n >= 0 && n <= 6) out.add(n);
  }
  return [...out].sort((a, b) => a - b);
}

/** Свой интервал повтора в днях: 1..365, иначе значение по умолчанию. */
export function normalizeRepeatInterval(v: unknown): number {
  const n = Math.trunc(Number(v));
  if (!Number.isFinite(n) || n <= 0) return COACH_REPEAT_INTERVAL_DEFAULT;
  return Math.min(COACH_REPEAT_INTERVAL_MAX, Math.max(COACH_REPEAT_INTERVAL_MIN, n));
}

/**
 * Теги: без `#`, без пустых, уникальные без учёта регистра (первый вариант
 * побеждает) — порядок ввода сохраняется, чтобы чипы не прыгали.
 */
export function normalizeTags(v: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(v) ? v : []) {
    const tag = String(raw ?? '')
      .replace(/^#+/, '')
      .trim()
      .slice(0, COACH_TAG_MAX);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= COACH_TAGS_MAX) break;
  }
  return out;
}

/** Подзадачи: валидный заголовок, уникальный id, не больше лимита. */
export function normalizeSubtasks(v: unknown): CoachSubtask[] {
  const out: CoachSubtask[] = [];
  const seen = new Set<string>();
  for (const raw of Array.isArray(v) ? v : []) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const title = text(row.title, COACH_SUBTASK_TITLE_MAX);
    if (!title) continue;
    let id = text(row.id, 60) || `s_${out.length + 1}`;
    if (seen.has(id)) id = `${id}_${out.length + 1}`;
    seen.add(id);
    out.push({ id, title, done: row.done === true });
    if (out.length >= COACH_SUBTASKS_MAX) break;
  }
  return out;
}

/** Человекочитаемый тег для чипа: `#здоровье`. */
export const formatCoachTag = (tag: string): string => `#${tag}`;

/* ═══════════════════════════════════════════════════════════════════════
   Быстрый ввод (TickTick NLP): «завтра 18:30 #здоровье !высокий @работа»
   ═══════════════════════════════════════════════════════════════════════ */

export interface CoachQuickAdd {
  /** Заголовок без распознанных кусков. */
  title: string;
  /** Локальная дата или null, если дату не называли. */
  date: string | null;
  time: string | null;
  tags: string[];
  priority: CoachTaskPriority | null;
  list: CoachTaskList | null;
  repeat: CoachRepeat | null;
  repeatDays: number[] | null;
  /** Интервал для `repeat: 'custom'`. */
  repeatInterval?: number;
  /** Всё после `//`. */
  note: string;
  /** Что распознали — для подсказки под полем. */
  matched: string[];
}

const WEEKDAY_STEMS: readonly (readonly [string, number])[] = [
  ['пон', 0],
  ['втор', 1],
  ['сред', 2],
  ['четвер', 3],
  ['пятниц', 4],
  ['суббот', 5],
  ['воскрес', 6],
];

function weekdayFromWord(word: string): number | null {
  const w = word.toLowerCase();
  if (w === 'пн') return 0;
  if (w === 'вт') return 1;
  if (w === 'ср') return 2;
  if (w === 'чт') return 3;
  if (w === 'пт') return 4;
  if (w === 'сб') return 5;
  if (w === 'вс') return 6;
  for (const [stem, index] of WEEKDAY_STEMS) if (w.startsWith(stem)) return index;
  return null;
}

function listFromWord(word: string): CoachTaskList | null {
  const w = word.toLowerCase();
  if (w.startsWith('вход') || w === 'inbox') return 'inbox';
  if (w.startsWith('трен') || w === 'training') return 'training';
  if (w.startsWith('здор') || w === 'health') return 'health';
  if (w.startsWith('работ') || w === 'work') return 'work';
  if (w.startsWith('личн') || w === 'personal') return 'personal';
  return null;
}

function priorityFromWord(word: string): CoachTaskPriority {
  const w = word.toLowerCase();
  if (w.startsWith('высок')) return 'high';
  if (w.startsWith('средн')) return 'medium';
  if (w.startsWith('низк')) return 'low';
  return 'none';
}

const MONTH_STEMS: readonly string[] = [
  'янв',
  'фев',
  'мар',
  'апр',
  'ма',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
];

function monthFromWord(word: string): number | null {
  const w = word.toLowerCase();
  for (let i = 0; i < MONTH_STEMS.length; i++) {
    if (w.startsWith(MONTH_STEMS[i])) {
      // «ма» — только май/мая, чтобы не поймать «март».
      if (MONTH_STEMS[i] === 'ма' && !/^ма[йя]/.test(w)) continue;
      return i;
    }
  }
  return null;
}

/** Дата «YYYY-MM-DD» из дня/месяца; невалидная (31 февраля) → null. */
function dateFromParts(year: number, month: number, day: number): string | null {
  if (day < 1 || day > 31) return null;
  const d = new Date(year, month, day);
  if (d.getMonth() !== month || d.getDate() !== day) return null;
  return localIsoDate(d);
}

/** Короткая дата для подсказки: `22.11`. */
export function fmtCoachDateShort(iso: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}.${iso.slice(5, 7)}` : iso;
}

/**
 * Дата группы/подписи: «Ср, 22.11», а для другого года — «Ср, 22.11.2027».
 * Год нужен, чтобы список через декабрь не показывал две одинаковые «22.11».
 */
export function fmtCoachDateLabel(iso: string, today = localIsoDate()): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const weekday = COACH_WEEKDAY_LABELS[coachWeekdayIndex(iso)];
  const short = fmtCoachDateShort(iso);
  return iso.slice(0, 4) === today.slice(0, 4) ? `${weekday}, ${short}` : `${weekday}, ${short}.${iso.slice(0, 4)}`;
}

/** Разница дней между локальными датами (`to − from`); null — если дата битая. */
export function daysBetweenIso(from: string, to: string): number | null {
  const a = parseLocalIsoDate(from);
  const b = parseLocalIsoDate(to);
  if (!a || !b) return null;
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

/**
 * Разбор быстрой строки. Ничего не выдумывает: непонятное остаётся в
 * заголовке, а UI показывает только реально распознанные поля.
 */
export function parseCoachQuickAdd(input: string, today = localIsoDate()): CoachQuickAdd {
  let work = String(input ?? '');
  const matched: string[] = [];

  // `//` — заметка (как в TickTick).
  let note = '';
  const noteIdx = work.indexOf('//');
  if (noteIdx >= 0) {
    note = work
      .slice(noteIdx + 2)
      .trim()
      .slice(0, COACH_TASK_NOTE_MAX);
    work = work.slice(0, noteIdx);
  }

  // `#тег`.
  const tags: string[] = [];
  work = work.replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (_m, space: string, tag: string) => {
    tags.push(tag);
    matched.push(formatCoachTag(tag));
    return space;
  });

  // `@список`.
  let list: CoachTaskList | null = null;
  work = work.replace(/(^|\s)@([\p{L}\p{N}_-]+)/gu, (m, space: string, word: string) => {
    const found = listFromWord(word);
    if (!found || list !== null) return m;
    list = found;
    matched.push(COACH_TASK_LIST_LABELS[found]);
    return space;
  });

  // `!высокий` / `!!` (2 — средний, 3 и больше — высокий).
  let priority: CoachTaskPriority | null = null;
  work = work.replace(/(^|\s)!(высок\p{L}*|средн\p{L}*|низк\p{L}*)(?=\s|$)/giu, (m, space: string, word: string) => {
    if (priority !== null) return m;
    priority = priorityFromWord(word);
    matched.push(`приоритет: ${COACH_PRIORITY_LABELS[priority]}`);
    return space;
  });
  if (priority === null) {
    work = work.replace(/(^|\s)(!{1,3})(?=\s|$)/g, (m, space: string, marks: string) => {
      if (priority !== null) return m;
      priority = marks.length >= 3 ? 'high' : marks.length === 2 ? 'medium' : 'low';
      matched.push(`приоритет: ${COACH_PRIORITY_LABELS[priority]}`);
      return space;
    });
  }

  // Повтор. Фразы — до дат: «через день» — это не «через 1 день».
  let repeat: CoachRepeat | null = null;
  let repeatDays: number[] | null = null;
  let repeatInterval: number | undefined;
  // «каждый понедельник» / «по вторникам» — это повтор, а не разовая дата.
  let repeatWeekday: number | null = null;
  work = work.replace(
    /(^|\s)(?:каждый|каждую|каждое|по)\s+(понедельник\p{L}*|вторник\p{L}*|сред\p{L}*|четверг\p{L}*|пятниц\p{L}*|суббот\p{L}*|воскресен\p{L}*|пн|вт|ср|чт|пт|сб|вс)(?=\s|$)/giu,
    (m, space: string, word: string) => {
      if (repeat !== null) return m;
      const day = weekdayFromWord(word);
      if (day === null) return m;
      repeat = 'weekdays';
      repeatDays = [day];
      repeatWeekday = day;
      matched.push(`${COACH_REPEAT_LABELS.weekdays}: ${COACH_WEEKDAY_LABELS[day]}`);
      return space;
    },
  );
  const repeatRules: readonly { re: RegExp; repeat: CoachRepeat; days?: number[] }[] = [
    { re: /(^|\s)(каждый день|ежедневно|каждодневно)(?=\s|$)/giu, repeat: 'daily' },
    { re: /(^|\s)(через день|раз в два дня)(?=\s|$)/giu, repeat: 'eod' },
    {
      re: /(^|\s)(по будням|по рабочим дням|каждый будний день)(?=\s|$)/giu,
      repeat: 'weekdays',
      days: [0, 1, 2, 3, 4],
    },
    { re: /(^|\s)(каждую неделю|еженедельно|раз в неделю)(?=\s|$)/giu, repeat: 'weekly' },
    { re: /(^|\s)(каждые две недели|каждые 2 недели|раз в две недели|раз в 2 недели)(?=\s|$)/giu, repeat: 'biweekly' },
    { re: /(^|\s)(каждый месяц|ежемесячно|раз в месяц)(?=\s|$)/giu, repeat: 'monthly' },
    { re: /(^|\s)(каждый год|ежегодно|раз в год)(?=\s|$)/giu, repeat: 'yearly' },
  ];
  for (const rule of repeatRules) {
    work = work.replace(rule.re, (m, space: string) => {
      if (repeat !== null) return m;
      repeat = rule.repeat;
      repeatDays = rule.days ?? null;
      matched.push(COACH_REPEAT_LABELS[rule.repeat]);
      return space;
    });
    if (repeat !== null) break;
  }
  if (repeat === null) {
    work = work.replace(
      /(^|\s)(каждые|раз в)\s+(\d{1,3})\s+дн\p{L}*(?=\s|$)/giu,
      (m, space: string, _w: string, num: string) => {
        if (repeat !== null) return m;
        repeat = 'custom';
        repeatInterval = normalizeRepeatInterval(num);
        matched.push(`Каждые ${repeatInterval} дн.`);
        return space;
      },
    );
  }

  // Даты. Первая распознанная побеждает, остальные остаются в заголовке.
  let date: string | null = null;
  const rememberDate = (iso: string): void => {
    if (date !== null) return;
    date = iso;
    matched.push(iso === today ? 'сегодня' : iso === shiftIsoDate(today, 1) ? 'завтра' : fmtCoachDateShort(iso));
  };

  work = work.replace(/(^|\s)(послезавтра|завтра|сегодня)(?=\s|$)/giu, (m, space: string, word: string) => {
    if (date !== null) return m;
    const w = word.toLowerCase();
    const iso = w === 'завтра' ? shiftIsoDate(today, 1) : w === 'послезавтра' ? shiftIsoDate(today, 2) : today;
    rememberDate(iso);
    return space;
  });

  work = work.replace(/(^|\s)через\s+(\d{1,3})\s+дн\p{L}*(?=\s|$)/giu, (m, space: string, num: string) => {
    if (date !== null) return m;
    rememberDate(shiftIsoDate(today, Math.max(1, Math.trunc(Number(num)))));
    return space;
  });

  work = work.replace(/(^|\s)через\s+неделю(?=\s|$)/giu, (m, space: string) => {
    if (date !== null) return m;
    rememberDate(shiftIsoDate(today, 7));
    return space;
  });

  work = work.replace(
    /(^|\s)(?:(?:в|во)\s+(?:эту|этот|это|ближайш\p{L}*|следующ\p{L}*)\s+)?(?:(?:в|во)\s+)?(пн|вт|ср|чт|пт|сб|вс|понед\p{L}*|вторн\p{L}*|сред\p{L}*|четвер\p{L}*|пятниц\p{L}*|суббот\p{L}*|воскрес\p{L}*)(?=\s|$)/giu,
    (m, space: string, word: string) => {
      if (date !== null) return m;
      const target = weekdayFromWord(word);
      if (target === null) return m;
      const delta = (target - coachWeekdayIndex(today) + 7) % 7;
      rememberDate(shiftIsoDate(today, delta));
      return space;
    },
  );

  work = work.replace(
    /(^|\s)(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?(?=\s|$)/g,
    (m, space: string, dRaw: string, mRaw: string, yRaw?: string) => {
      if (date !== null) return m;
      const todayDate = new Date(`${today}T00:00:00`);
      const day = Number(dRaw);
      const month = Number(mRaw) - 1;
      let year = yRaw ? (yRaw.length === 2 ? 2000 + Number(yRaw) : Number(yRaw)) : todayDate.getFullYear();
      let iso = dateFromParts(year, month, day);
      if (!iso) return m;
      // Год не назвали, а дата уже прошла — значит, следующий год.
      if (!yRaw && iso < today) {
        year += 1;
        iso = dateFromParts(year, month, day);
      }
      if (!iso) return m;
      rememberDate(iso);
      return space;
    },
  );

  work = work.replace(
    /(^|\s)(\d{1,2})\s+(январ\p{L}*|феврал\p{L}*|март\p{L}*|апрел\p{L}*|ма[йя]|июн\p{L}*|июл\p{L}*|август\p{L}*|сентябр\p{L}*|октябр\p{L}*|ноябр\p{L}*|декабр\p{L}*)(?:\s+(\d{4}))?(?=\s|$)/giu,
    (m, space: string, dRaw: string, monthWord: string, yRaw?: string) => {
      if (date !== null) return m;
      const month = monthFromWord(monthWord);
      if (month === null) return m;
      const todayDate = new Date(`${today}T00:00:00`);
      const day = Number(dRaw);
      let year = yRaw ? Number(yRaw) : todayDate.getFullYear();
      let iso = dateFromParts(year, month, day);
      if (!iso) return m;
      if (!yRaw && iso < today) {
        year += 1;
        iso = dateFromParts(year, month, day);
      }
      if (!iso) return m;
      rememberDate(iso);
      return space;
    },
  );

  // «Каждый вторник» без явной даты — ближайший такой день, включая сегодня.
  if (date === null && repeatWeekday !== null) {
    rememberDate(shiftIsoDate(today, (repeatWeekday - coachWeekdayIndex(today) + 7) % 7));
  }

  // Время: «18:30», «в 9», «9 ч».
  let time: string | null = null;
  const takeTime = (hRaw: string, mRaw?: string): string | null => {
    const h = Number(hRaw);
    const min = mRaw === undefined ? 0 : Number(mRaw);
    if (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(min) || min < 0 || min > 59) return null;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  };

  // «в 8 вечера», «9 часов утра», «в полдень» — время суток, а не число.
  const applyPeriod = (hRaw: string, mRaw: string | undefined, period: string): string | null => {
    if (/^полд/i.test(period)) return '12:00';
    if (/^полноч/i.test(period)) return '00:00';
    const base = takeTime(hRaw, mRaw);
    if (base === null) return null;
    let h = Number(base.slice(0, 2));
    const p = period.toLowerCase();
    if (p.startsWith('ноч')) h = h === 12 ? 0 : h < 12 ? h + 12 : h;
    else if (p.startsWith('вечер') || p.startsWith('дн')) h = h < 12 ? h + 12 : h;
    else if (p.startsWith('утр')) h = h === 12 ? 0 : h;
    return `${String(h).padStart(2, '0')}:${base.slice(3)}`;
  };

  work = work.replace(/(^|\s)(?:в\s+|к\s+)?(полдень|полночь)(?=\s|$)/giu, (m, space: string, word: string) => {
    if (time !== null) return m;
    time = applyPeriod('12', undefined, word);
    if (time === null) return m;
    matched.push(time);
    return space;
  });
  if (time === null) {
    work = work.replace(
      /(^|\s)(?:в\s+|к\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:час\p{L}*|ч\.?)?\s*(утра|утром|вечера|вечером|ночи|ночью)(?=\s|$)/giu,
      (m, space: string, h: string, min: string | undefined, period: string) => {
        if (time !== null) return m;
        time = applyPeriod(h, min, period);
        if (time === null) return m;
        matched.push(time);
        return space;
      },
    );
  }
  if (time === null) {
    work = work.replace(
      /(^|\s)(?:в\s+|к\s+)?(\d{1,2})(?::(\d{2}))?\s*(?:час\p{L}*|ч\.?)\s*(дня|днём|днем)(?=\s|$)/giu,
      (m, space: string, h: string, min: string | undefined, period: string) => {
        if (time !== null) return m;
        time = applyPeriod(h, min, period);
        if (time === null) return m;
        matched.push(time);
        return space;
      },
    );
  }
  if (time === null) {
    work = work.replace(
      /(^|\s)(?:в\s+|к\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s|$)/g,
      (m, space: string, h: string, min: string) => {
        if (time !== null) return m;
        time = takeTime(h, min);
        if (time === null) return m;
        matched.push(time);
        return space;
      },
    );
  }
  if (time === null) {
    work = work.replace(
      /(^|\s)(?:в|к)\s+(\d{1,2})(?::(\d{2}))?(?=\s|$)/giu,
      (m, space: string, h: string, min?: string) => {
        if (time !== null) return m;
        time = takeTime(h, min);
        if (time === null) return m;
        matched.push(time);
        return space;
      },
    );
  }
  if (time === null) {
    work = work.replace(/(^|\s)(\d{1,2})\s*(?:ч|час\p{L}*)(?=\s|$)/giu, (m, space: string, h: string) => {
      if (time !== null) return m;
      time = takeTime(h);
      if (time === null) return m;
      matched.push(time);
      return space;
    });
  }

  const title = work
    .replace(/\s+/g, ' ')
    .replace(/^[\s,;:.–—-]+|[\s,;:–—-]+$/g, '')
    .slice(0, COACH_TASK_TITLE_MAX)
    .trim();

  return {
    title,
    date,
    time,
    tags: normalizeTags(tags),
    priority,
    list,
    repeat,
    repeatDays,
    note,
    matched,
    ...(repeat === 'custom' && repeatInterval !== undefined ? { repeatInterval } : {}),
  };
}

/** Готовые подписи распознанного — для чипов под полем ввода. */
export function coachQuickAddHints(q: CoachQuickAdd, today = localIsoDate()): string[] {
  const out: string[] = [];
  if (q.date) {
    const tomorrow = shiftIsoDate(today, 1);
    out.push(q.date === today ? 'сегодня' : q.date === tomorrow ? 'завтра' : fmtCoachDateShort(q.date));
  }
  if (q.time) out.push(q.time);
  if (q.priority) out.push(`приоритет: ${COACH_PRIORITY_LABELS[q.priority]}`);
  if (q.list) out.push(COACH_TASK_LIST_LABELS[q.list]);
  if (q.repeat) {
    const days = q.repeat === 'weekdays' ? (q.repeatDays ?? []) : [];
    out.push(
      days.length > 0 ? `Дни: ${days.map((d) => COACH_WEEKDAY_LABELS[d]).join(', ')}` : COACH_REPEAT_LABELS[q.repeat],
    );
  }
  for (const tag of q.tags) out.push(formatCoachTag(tag));
  if (q.note) out.push('заметка');
  return out;
}

/** Человекочитаемая подпись повтора — для бейджа в задаче. */
export function coachRepeatLabel(t: CoachTask): string {
  const repeat = coachTaskRepeat(t);
  if (repeat === 'weekdays') {
    const days = coachTaskRepeatDays(t);
    if (days.length === 0) return COACH_REPEAT_LABELS.weekdays;
    return `Дни: ${days.map((d) => COACH_WEEKDAY_LABELS[d]).join(', ')}`;
  }
  if (repeat === 'custom') {
    return `Каждые ${t.repeatInterval ?? COACH_REPEAT_INTERVAL_DEFAULT} дн.`;
  }
  return COACH_REPEAT_LABELS[repeat];
}

export function normalizeList(v: unknown): CoachTaskList {
  return COACH_TASK_LISTS.includes(v as CoachTaskList) ? (v as CoachTaskList) : 'inbox';
}

function normalizeTask(raw: unknown): CoachTask | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Partial<CoachTask> & Record<string, unknown>;
  const id = text(t.id, 80);
  const title = text(t.title, COACH_TASK_TITLE_MAX);
  const date = text(t.date, 10);
  if (!id || !title || !isValidCoachDate(date)) return null;
  const createdAt = text(t.createdAt, 40) || nowIso();
  const repeat = normalizeRepeat(t.repeat);
  const repeatDays = normalizeRepeatDays(t.repeatDays);
  const tags = normalizeTags(t.tags);
  const subtasks = normalizeSubtasks(t.subtasks);
  const reminder = normalizeCoachTime(t.reminder);
  const order = Number.isFinite(Number(t.order)) && Number(t.order) >= 0 ? Math.trunc(Number(t.order)) : undefined;
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
    priority: normalizePriority(t.priority),
    repeat,
    ...(repeat === 'weekdays' ? { repeatDays: repeatDays.length > 0 ? repeatDays : [coachWeekdayIndex(date)] } : {}),
    ...(repeat === 'custom' ? { repeatInterval: normalizeRepeatInterval(t.repeatInterval) } : {}),
    list: normalizeList(t.list),
    ...(tags.length > 0 ? { tags } : {}),
    ...(subtasks.length > 0 ? { subtasks } : {}),
    ...(t.pinned === true ? { pinned: true } : {}),
    ...(order !== undefined ? { order } : {}),
    ...(reminder ? { reminder } : {}),
    ...(t.completedAt ? { completedAt: text(t.completedAt, 40) } : {}),
    ...(text(t.spawnedFrom, 80) ? { spawnedFrom: text(t.spawnedFrom, 80) } : {}),
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

export function readCoachPlanner(
  storage: { getItem: (k: string) => string | null } | null | undefined,
): CoachPlannerStore {
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
  input: {
    title?: string;
    date?: string;
    time?: string | null;
    athleteId?: string | null;
    note?: string;
    priority?: CoachTaskPriority;
    repeat?: CoachRepeat;
    repeatDays?: readonly number[];
    repeatInterval?: number;
    list?: CoachTaskList;
    tags?: readonly string[];
    subtasks?: readonly CoachSubtask[];
    pinned?: boolean;
    reminder?: string | null;
    order?: number;
  },
  opts: { id?: string; now?: string } = {},
): AddCoachTaskResult {
  const title = text(input.title, COACH_TASK_TITLE_MAX);
  if (!title) return { store, task: null, error: 'title' };
  const date = text(input.date, 10) || localIsoDate();
  if (!isValidCoachDate(date)) return { store, task: null, error: 'date' };
  if (store.items.length >= COACH_PLANNER_MAX) return { store, task: null, error: 'limit' };
  const now = opts.now ?? nowIso();
  const repeat = normalizeRepeat(input.repeat);
  const repeatDays = normalizeRepeatDays(input.repeatDays);
  const tags = normalizeTags(input.tags);
  const subtasks = normalizeSubtasks(input.subtasks);
  const reminder = normalizeCoachTime(input.reminder);
  // Новую карточку кладём в конец ручного порядка, если он уже задан в дне.
  const sameDayOrders = store.items
    .filter((t) => t.date === date && typeof t.order === 'number')
    .map((t) => t.order as number);
  const order =
    input.order !== undefined && Number.isFinite(Number(input.order))
      ? Math.max(0, Math.trunc(Number(input.order)))
      : sameDayOrders.length > 0
        ? Math.max(...sameDayOrders) + 1
        : undefined;
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
    priority: normalizePriority(input.priority),
    repeat,
    ...(repeat === 'weekdays' ? { repeatDays: repeatDays.length > 0 ? repeatDays : [coachWeekdayIndex(date)] } : {}),
    ...(repeat === 'custom' ? { repeatInterval: normalizeRepeatInterval(input.repeatInterval) } : {}),
    list: normalizeList(input.list),
    ...(tags.length > 0 ? { tags } : {}),
    ...(subtasks.length > 0 ? { subtasks } : {}),
    ...(input.pinned === true ? { pinned: true } : {}),
    ...(order !== undefined ? { order } : {}),
    ...(reminder ? { reminder } : {}),
  };
  return { store: { version: 1, items: [...store.items, task] }, task, error: null };
}

export function updateCoachTask(
  store: CoachPlannerStore,
  id: string,
  patch: {
    title?: string;
    date?: string;
    time?: string | null;
    athleteId?: string | null;
    done?: boolean;
    note?: string;
    priority?: CoachTaskPriority;
    repeat?: CoachRepeat;
    /** Пустой массив/undefined — дни не выбраны (для «по дням» возьмём день задачи). */
    repeatDays?: readonly number[];
    repeatInterval?: number;
    list?: CoachTaskList;
    tags?: readonly string[];
    subtasks?: readonly CoachSubtask[];
    pinned?: boolean;
    reminder?: string | null;
    order?: number;
  },
  opts: { now?: string } = {},
): CoachPlannerStore {
  const idx = store.items.findIndex((t) => t.id === id);
  if (idx < 0) return store;
  const prev = store.items[idx];
  const title = patch.title === undefined ? prev.title : text(patch.title, COACH_TASK_TITLE_MAX);
  if (!title) return store;
  const date = patch.date === undefined ? prev.date : text(patch.date, 10);
  if (!isValidCoachDate(date)) return store;
  const repeat = patch.repeat === undefined ? coachTaskRepeat(prev) : normalizeRepeat(patch.repeat);
  const repeatDays = patch.repeatDays === undefined ? coachTaskRepeatDays(prev) : normalizeRepeatDays(patch.repeatDays);
  const repeatInterval =
    patch.repeatInterval === undefined
      ? (prev.repeatInterval ?? COACH_REPEAT_INTERVAL_DEFAULT)
      : normalizeRepeatInterval(patch.repeatInterval);
  const tags = patch.tags === undefined ? coachTaskTags(prev) : normalizeTags(patch.tags);
  const subtasks = patch.subtasks === undefined ? coachTaskSubtasks(prev) : normalizeSubtasks(patch.subtasks);
  const reminder = patch.reminder === undefined ? (prev.reminder ?? null) : normalizeCoachTime(patch.reminder);
  const pinned = patch.pinned === undefined ? prev.pinned === true : patch.pinned === true;
  const dateChanged = date !== prev.date;
  const order =
    patch.order === undefined
      ? prev.order
      : Number.isFinite(Number(patch.order))
        ? Math.max(0, Math.trunc(Number(patch.order)))
        : undefined;
  const next: CoachTask = {
    ...prev,
    title,
    date,
    time: patch.time === undefined ? prev.time : normalizeCoachTime(patch.time),
    athleteId: patch.athleteId === undefined ? prev.athleteId : text(patch.athleteId, 80) || null,
    done: patch.done === undefined ? prev.done : patch.done === true,
    note: patch.note === undefined ? prev.note : text(patch.note, COACH_TASK_NOTE_MAX),
    priority: patch.priority === undefined ? coachTaskPriority(prev) : normalizePriority(patch.priority),
    repeat,
    list: patch.list === undefined ? coachTaskList(prev) : normalizeList(patch.list),
    updatedAt: opts.now ?? nowIso(),
  };
  // Выключаем повтор / меняем тип — не тащим «хвосты» прошлой настройки.
  delete next.repeatDays;
  delete next.repeatInterval;
  if (repeat === 'weekdays') {
    next.repeatDays = repeatDays.length > 0 ? repeatDays : [coachWeekdayIndex(date)];
  } else if (repeat === 'custom') {
    next.repeatInterval = repeatInterval;
  }
  // Теги/подзадачи/закрепление/напоминание/порядок: пустые не храним.
  delete next.tags;
  delete next.subtasks;
  delete next.pinned;
  delete next.reminder;
  delete next.order;
  if (tags.length > 0) next.tags = tags;
  if (subtasks.length > 0) next.subtasks = subtasks;
  if (pinned) next.pinned = true;
  if (reminder) next.reminder = reminder;
  // Отключили повтор — вхождение больше не «хвост» серии: снимать его нельзя.
  if (repeat === 'none') delete next.spawnedFrom;
  // Ручной порядок — свойство конкретного дня: перенос на другой день его не тащит.
  if (order !== undefined && !dateChanged) next.order = order;
  if (patch.done !== undefined) {
    if (next.done) next.completedAt = next.updatedAt;
    else delete next.completedAt;
  }
  const items = [...store.items];
  items[idx] = next;
  return { version: 1, items };
}

export interface CoachRepeatConfig {
  /** Дни недели для `weekdays` (0 = Пн … 6 = Вс). */
  days?: readonly number[];
  /** Интервал в днях для `custom`. */
  interval?: number;
}

/**
 * Следующее вхождение повтора (локальная дата), либо null.
 * Для `weekdays` — ближайший выбранный день после текущего (сканируем 1..7),
 * для `custom` — через `interval` дней.
 */
export function nextRepeatDate(iso: string, repeat: CoachRepeat, config: CoachRepeatConfig = {}): string | null {
  if (!isValidCoachDate(iso) || repeat === 'none') return null;
  const d = parseLocalIsoDate(iso);
  if (!d) return null;
  const plus = (days: number): string => localIsoDate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
  // Месяц/год: 31 января + 1 месяц = 28/29 февраля, а не «3 марта».
  const plusMonths = (months: number): string => {
    const y = d.getFullYear();
    const m = d.getMonth() + months;
    const lastDay = new Date(y, m + 1, 0).getDate();
    return localIsoDate(new Date(y, m, Math.min(d.getDate(), lastDay)));
  };
  switch (repeat) {
    case 'daily':
      return plus(1);
    case 'eod':
      return plus(2);
    case 'weekly':
      return plus(7);
    case 'biweekly':
      return plus(14);
    case 'custom':
      return plus(normalizeRepeatInterval(config.interval));
    case 'weekdays': {
      const days = normalizeRepeatDays(config.days);
      const chosen = new Set(days.length > 0 ? days : [coachWeekdayIndex(iso)]);
      for (let step = 1; step <= 7; step++) {
        const candidate = plus(step);
        if (chosen.has(coachWeekdayIndex(candidate))) return candidate;
      }
      return null;
    }
    case 'monthly':
      return plusMonths(1);
    case 'yearly':
      return plusMonths(12);
    default:
      return null;
  }
}

/**
 * Закрыть/открыть задачу. Повторяющаяся задача при закрытии создаёт
 * следующее вхождение (без дублей: одно и то же название + дата не плодим).
 */
export function completeCoachTask(
  store: CoachPlannerStore,
  id: string,
  opts: { now?: string } = {},
): CoachPlannerStore {
  const idx = store.items.findIndex((t) => t.id === id);
  if (idx < 0) return store;
  const prev = store.items[idx];
  const nextDone = !prev.done;
  const now = opts.now ?? nowIso();
  const items = [...store.items];
  const toggled: CoachTask = { ...prev, done: nextDone, updatedAt: now };
  if (nextDone) toggled.completedAt = now;
  else delete toggled.completedAt;
  items[idx] = toggled;
  const repeat = coachTaskRepeat(prev);
  const repeatConfig = { days: prev.repeatDays, interval: prev.repeatInterval };
  // Снятая галочка: если серия только что создала вхождение и его ещё не
  // трогали, убираем его — иначе «передумал» оставляет фантомную задачу.
  if (!nextDone && repeat !== 'none') {
    const expected = nextRepeatDate(prev.date, repeat, repeatConfig);
    const remove = new Set<string>();
    let grew = true;
    while (grew) {
      grew = false;
      for (const t of items) {
        if (t.id === prev.id || t.done || remove.has(t.id)) continue;
        const parent = t.spawnedFrom;
        if (!parent || (parent !== prev.id && !remove.has(parent))) continue;
        // Прямого ребёнка удаляем, только если его не сдвинули и не переименовали:
        // изменённую человеком задачу серия не имеет права стирать.
        if (
          parent === prev.id &&
          (t.title !== prev.title ||
            coachTaskList(t) !== coachTaskList(prev) ||
            (expected !== null && t.date !== expected))
        ) {
          continue;
        }
        remove.add(t.id);
        grew = true;
      }
    }
    if (remove.size > 0) {
      return { version: 1, items: items.filter((t) => !remove.has(t.id)) };
    }
  }
  if (nextDone && repeat !== 'none') {
    const nextDate = nextRepeatDate(prev.date, repeat, repeatConfig);
    const exists = nextDate
      ? items.some((t) => t.date === nextDate && t.title === prev.title && coachTaskList(t) === coachTaskList(prev))
      : false;
    if (nextDate && !exists && items.length < COACH_PLANNER_MAX) {
      const nextSubtasks = coachTaskSubtasks(prev).map((s) => ({ ...s, done: false }));
      const spawned: CoachTask = {
        ...prev,
        id: `t_${now.replace(/[^0-9]/g, '').slice(0, 14)}_${items.length + 1}_r`,
        date: nextDate,
        done: false,
        createdAt: now,
        updatedAt: now,
        // Новое вхождение серии начинает чеклист заново.
        ...(nextSubtasks.length > 0 ? { subtasks: nextSubtasks } : {}),
        tags: [...coachTaskTags(prev)],
        spawnedFrom: prev.id,
      };
      // Ручной порядок — свойство конкретного дня, а не серии.
      delete spawned.order;
      delete spawned.completedAt;
      items.push(spawned);
    }
  }
  return { version: 1, items };
}

/** Перенос задачи на другой день (без изменения остальных полей). */
export function moveCoachTask(
  store: CoachPlannerStore,
  id: string,
  date: string,
  opts: { now?: string } = {},
): CoachPlannerStore {
  if (!isValidCoachDate(date)) return store;
  return updateCoachTask(store, id, { date }, opts);
}

/**
 * Пропустить текущее вхождение серии: следующая дата повтора, без отметки
 * «сделано». Задача без повтора (или уже закрытая) не меняется.
 *
 * Перенос — это новое вхождение: чеклист начинается заново (как при закрытии
 * серии), ручной порядок не тащится — он принадлежит конкретному дню.
 */
export function skipCoachRepeat(
  store: CoachPlannerStore,
  id: string,
  opts: { now?: string; times?: number } = {},
): CoachPlannerStore {
  const idx = store.items.findIndex((t) => t.id === id);
  if (idx < 0) return store;
  const task = store.items[idx];
  if (task.done) return store;
  const repeat = coachTaskRepeat(task);
  if (repeat === 'none') return store;
  const times = Math.max(1, Math.trunc(Number(opts.times ?? 1)) || 1);
  let date = task.date;
  for (let i = 0; i < times; i += 1) {
    const next = nextRepeatDate(date, repeat, {
      days: task.repeatDays,
      interval: task.repeatInterval,
    });
    if (!next) return store;
    date = next;
  }
  if (date === task.date) return store;
  const next: CoachTask = {
    ...task,
    date,
    done: false,
    updatedAt: opts.now ?? nowIso(),
  };
  delete next.completedAt;
  delete next.order;
  const subtasks = coachTaskSubtasks(task).map((s) => ({ ...s, done: false }));
  if (subtasks.length > 0) next.subtasks = subtasks;
  else delete next.subtasks;
  const items = [...store.items];
  items[idx] = next;
  return { version: 1, items };
}

export function toggleCoachTaskDone(store: CoachPlannerStore, id: string): CoachPlannerStore {
  const idx = store.items.findIndex((t) => t.id === id);
  if (idx < 0) return store;
  const items = [...store.items];
  const prev = items[idx];
  const done = !prev.done;
  const now = nowIso();
  const next: CoachTask = { ...prev, done, updatedAt: now };
  if (done) next.completedAt = now;
  else delete next.completedAt;
  items[idx] = next;
  return { version: 1, items };
}

export function removeCoachTask(store: CoachPlannerStore, id: string): CoachPlannerStore {
  const items = store.items.filter((t) => t.id !== id);
  return items.length === store.items.length ? store : { version: 1, items };
}

/**
 * Вернуть удалённую задачу как была (тот же id, те же поля) — отмена удаления.
 * Ничего не дублирует: занятый id или лимит оставляют store без изменений.
 */
export function restoreCoachTask(store: CoachPlannerStore, task: CoachTask): CoachPlannerStore {
  if (!task || !task.id || store.items.some((t) => t.id === task.id)) return store;
  if (store.items.length >= COACH_PLANNER_MAX) return store;
  if (!isValidCoachDate(task.date) || !text(task.title, COACH_TASK_TITLE_MAX)) return store;
  return { version: 1, items: [...store.items, { ...task }] };
}

/**
 * Дублировать задачу (как в TickTick): копия с теми же полями, но новым id.
 * Галочки не наследуются — копия это «сделать ещё раз»; чеклист начинается
 * заново, ручной порядок дня не копируется (это свойство конкретной строки).
 * Лимит задач и отсутствие оригинала оставляют store без изменений.
 */
export function duplicateCoachTask(
  store: CoachPlannerStore,
  id: string,
  opts: { now?: string; id?: string } = {},
): CoachPlannerStore {
  const src = store.items.find((t) => t.id === id);
  if (!src) return store;
  if (store.items.length >= COACH_PLANNER_MAX) return store;
  const now = opts.now ?? nowIso();
  const subtasks = coachTaskSubtasks(src).map((s) => ({ ...s, done: false }));
  const copy: CoachTask = {
    ...src,
    id: opts.id ?? `t_${now.replace(/[^0-9]/g, '').slice(0, 14)}_${store.items.length + 1}_c`,
    done: false,
    createdAt: now,
    updatedAt: now,
  };
  delete copy.completedAt;
  delete copy.spawnedFrom;
  delete copy.order;
  delete copy.subtasks;
  if (subtasks.length > 0) copy.subtasks = subtasks;
  return { version: 1, items: [...store.items, copy] };
}

/* ═══════════════════════════════════════════════════════════════════════
   Подзадачи, закрепление, ручной порядок
   ═══════════════════════════════════════════════════════════════════════ */

/** Добавить подзадачу в чеклист задачи. Пустой заголовок — no-op. */
export function addCoachSubtask(
  store: CoachPlannerStore,
  taskId: string,
  title: string,
  opts: { id?: string } = {},
): CoachPlannerStore {
  const idx = store.items.findIndex((t) => t.id === taskId);
  if (idx < 0) return store;
  const prev = store.items[idx];
  const subtasks = coachTaskSubtasks(prev);
  if (subtasks.length >= COACH_SUBTASKS_MAX) return store;
  const clean = text(title, COACH_SUBTASK_TITLE_MAX);
  if (!clean) return store;
  const used = new Set(subtasks.map((s) => s.id));
  let id = text(opts.id, 60) || `s_${Date.now().toString(36)}_${subtasks.length + 1}`;
  while (used.has(id)) id = `${id}_x`;
  const items = [...store.items];
  items[idx] = {
    ...prev,
    subtasks: [...subtasks, { id, title: clean, done: false }],
    updatedAt: nowIso(),
  };
  return { version: 1, items };
}

export function toggleCoachSubtask(store: CoachPlannerStore, taskId: string, subtaskId: string): CoachPlannerStore {
  const idx = store.items.findIndex((t) => t.id === taskId);
  if (idx < 0) return store;
  const prev = store.items[idx];
  const subtasks = coachTaskSubtasks(prev);
  if (!subtasks.some((s) => s.id === subtaskId)) return store;
  const items = [...store.items];
  items[idx] = {
    ...prev,
    subtasks: subtasks.map((s) => (s.id === subtaskId ? { ...s, done: !s.done } : s)),
    updatedAt: nowIso(),
  };
  return { version: 1, items };
}

export function removeCoachSubtask(store: CoachPlannerStore, taskId: string, subtaskId: string): CoachPlannerStore {
  const idx = store.items.findIndex((t) => t.id === taskId);
  if (idx < 0) return store;
  const prev = store.items[idx];
  const subtasks = coachTaskSubtasks(prev);
  const left = subtasks.filter((s) => s.id !== subtaskId);
  if (left.length === subtasks.length) return store;
  const next: CoachTask = { ...prev, updatedAt: nowIso() };
  delete next.subtasks;
  if (left.length > 0) next.subtasks = left;
  const items = [...store.items];
  items[idx] = next;
  return { version: 1, items };
}

/** Закрепить/открепить задачу (TickTick «Pin»). */
export function setCoachTaskPinned(
  store: CoachPlannerStore,
  id: string,
  pinned: boolean,
  opts: { now?: string } = {},
): CoachPlannerStore {
  const idx = store.items.findIndex((t) => t.id === id);
  if (idx < 0) return store;
  const prev = store.items[idx];
  if ((prev.pinned === true) === pinned) return store;
  const next: CoachTask = { ...prev, updatedAt: opts.now ?? nowIso() };
  if (pinned) next.pinned = true;
  else delete next.pinned;
  const items = [...store.items];
  items[idx] = next;
  return { version: 1, items };
}

/**
 * Ручной порядок (TickTick drag & drop): переносит `movedId` перед
 * `beforeId` (null — в конец дня) и нумерует порядок задач этого дня.
 */
export function reorderCoachTasks(
  store: CoachPlannerStore,
  movedId: string,
  beforeId: string | null,
  opts: { now?: string } = {},
): CoachPlannerStore {
  const moved = store.items.find((t) => t.id === movedId);
  if (!moved || movedId === beforeId) return store;
  const ordered = sortCoachTasks(store.items.filter((t) => t.date === moved.date)).filter((t) => t.id !== movedId);
  const idx = beforeId === null ? ordered.length : ordered.findIndex((t) => t.id === beforeId);
  const position = idx < 0 ? ordered.length : idx;
  ordered.splice(position, 0, moved);
  const orderById = new Map(ordered.map((t, i) => [t.id, i]));
  const now = opts.now ?? nowIso();
  const items = store.items.map((t) =>
    orderById.has(t.id) ? { ...t, order: orderById.get(t.id)!, updatedAt: now } : t,
  );
  return { version: 1, items };
}

/* ═══════════════════════════════════════════════════════════════════════
   Статистика
   ═══════════════════════════════════════════════════════════════════════ */

export interface CoachPlannerStats {
  total: number;
  open: number;
  done: number;
  overdue: number;
  todayTotal: number;
  todayDone: number;
  /** Выполнено сегодня (по `completedAt`, а не по дате задачи). */
  completedToday: number;
  /** Выполнено за последние 7 дней включительно. */
  completed7: number;
  /** Доля закрытых вовремя среди задач с известным временем закрытия. */
  onTimeRate: number;
  /** Сколько задач вообще можно судить по времени закрытия (для «—» в UI). */
  onTimeKnown: number;
}

/**
 * Честная статистика: «выполнено» считается по времени закрытия, а не по
 * дате задачи; задачи без `completedAt` (старые записи) в счётчики закрытия
 * и в «вовремя» не попадают — их просто нечем судить.
 */
export function coachPlannerStats(store: CoachPlannerStore, today = localIsoDate()): CoachPlannerStats {
  const total = store.items.length;
  const done = store.items.filter((t) => t.done).length;
  const overdue = store.items.filter((t) => t.date < today && !t.done).length;
  const todayTotal = store.items.filter((t) => t.date === today).length;
  const todayDone = store.items.filter((t) => t.date === today && t.done).length;
  const weekFrom = shiftIsoDate(today, -6);
  let completedToday = 0;
  let completed7 = 0;
  let closedKnown = 0;
  let closedOnTime = 0;
  for (const t of store.items) {
    // completedAt — момент времени (UTC), а день закрытия — локальный: в UTC+10
    // утреннее закрытие иначе считалось бы вчерашним.
    const closedAt = t.completedAt ? new Date(t.completedAt) : null;
    const at = closedAt && Number.isFinite(closedAt.getTime()) ? localIsoDate(closedAt) : '';
    if (!at) continue;
    if (at === today) completedToday += 1;
    if (at >= weekFrom && at <= today) completed7 += 1;
    if (t.done) {
      closedKnown += 1;
      if (at <= t.date) closedOnTime += 1;
    }
  }
  return {
    total,
    open: total - done,
    done,
    overdue,
    todayTotal,
    todayDone,
    completedToday,
    completed7,
    onTimeRate: closedKnown > 0 ? closedOnTime / closedKnown : 0,
    onTimeKnown: closedKnown,
  };
}

/* ═══════════════════════════════════════════════════════════════════════
   Сохранённые фильтры (TickTick «Filters»)
   ═══════════════════════════════════════════════════════════════════════ */

export const COACH_FILTERS_KEY = 'he_coach_planner_filters';
export const COACH_FILTERS_MAX = 30;
export const COACH_FILTER_NAME_MAX = 40;

export interface CoachSavedFilter {
  id: string;
  name: string;
  smart: CoachSmartListId;
  list: CoachTaskList | 'all';
  priority: CoachTaskPriority | 'all';
  tags: string[];
  query: string;
  includeDone: boolean;
  /** Как смотреть результат. У старых фильтров полей нет — вид остаётся текущим. */
  view?: CoachPlannerView;
  groupBy?: CoachGroupBy;
  sortBy?: CoachSortBy;
}

export interface CoachFilterStore {
  version: 1;
  items: CoachSavedFilter[];
}

export const emptyCoachFilters = (): CoachFilterStore => ({ version: 1, items: [] });

function normalizeSavedFilter(raw: unknown): CoachSavedFilter | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const id = text(row.id, 60);
  const name = text(row.name, COACH_FILTER_NAME_MAX);
  if (!id || !name) return null;
  const smart = COACH_SMART_LISTS.some((s) => s.id === row.smart) ? (row.smart as CoachSmartListId) : 'all';
  const list =
    row.list === 'all' || COACH_TASK_LISTS.includes(row.list as CoachTaskList)
      ? (row.list as CoachTaskList | 'all')
      : 'all';
  const priority =
    row.priority === 'all' || COACH_PRIORITIES.includes(row.priority as CoachTaskPriority)
      ? (row.priority as CoachTaskPriority | 'all')
      : 'all';
  const view = COACH_PLANNER_VIEWS.includes(row.view as CoachPlannerView) ? (row.view as CoachPlannerView) : undefined;
  const groupBy = COACH_GROUP_BYS.includes(row.groupBy as CoachGroupBy) ? (row.groupBy as CoachGroupBy) : undefined;
  const sortBy = COACH_SORT_BYS.includes(row.sortBy as CoachSortBy) ? (row.sortBy as CoachSortBy) : undefined;
  return {
    id,
    name,
    smart,
    list,
    priority,
    tags: normalizeTags(row.tags),
    query: text(row.query, 200),
    includeDone: row.includeDone !== false,
    ...(view ? { view } : {}),
    ...(groupBy ? { groupBy } : {}),
    ...(sortBy ? { sortBy } : {}),
  };
}

export function parseCoachFilters(raw: string | null | undefined): CoachFilterStore {
  if (!raw) return emptyCoachFilters();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') return emptyCoachFilters();
    const obj = parsed as Record<string, unknown>;
    if (obj.version !== 1 || !Array.isArray(obj.items)) return emptyCoachFilters();
    const seen = new Set<string>();
    const items: CoachSavedFilter[] = [];
    for (const row of obj.items) {
      const filter = normalizeSavedFilter(row);
      if (!filter || seen.has(filter.id)) continue;
      seen.add(filter.id);
      items.push(filter);
      if (items.length >= COACH_FILTERS_MAX) break;
    }
    return { version: 1, items };
  } catch {
    return emptyCoachFilters();
  }
}

export function readCoachFilters(
  storage: { getItem: (k: string) => string | null } | null | undefined,
): CoachFilterStore {
  if (!storage) return emptyCoachFilters();
  try {
    return parseCoachFilters(storage.getItem(COACH_FILTERS_KEY));
  } catch {
    return emptyCoachFilters();
  }
}

export function writeCoachFilters(
  storage: { setItem?: (k: string, v: string) => void } | null | undefined,
  store: CoachFilterStore,
): CoachFilterStore {
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(COACH_FILTERS_KEY, JSON.stringify({ version: 1, items: store.items }));
    } catch {
      /* quota */
    }
  }
  return store;
}

export interface AddCoachFilterResult {
  store: CoachFilterStore;
  filter: CoachSavedFilter | null;
  error: 'name' | 'limit' | null;
}

export function addCoachFilter(
  store: CoachFilterStore,
  input: {
    name?: string;
    smart?: CoachSmartListId;
    list?: CoachTaskList | 'all';
    priority?: CoachTaskPriority | 'all';
    tags?: readonly string[];
    query?: string;
    includeDone?: boolean;
    view?: CoachPlannerView;
    groupBy?: CoachGroupBy;
    sortBy?: CoachSortBy;
  },
  opts: { id?: string } = {},
): AddCoachFilterResult {
  const name = text(input.name, COACH_FILTER_NAME_MAX);
  if (!name) return { store, filter: null, error: 'name' };
  if (store.items.length >= COACH_FILTERS_MAX) return { store, filter: null, error: 'limit' };
  const view = COACH_PLANNER_VIEWS.includes(input.view as CoachPlannerView)
    ? (input.view as CoachPlannerView)
    : undefined;
  const groupBy = COACH_GROUP_BYS.includes(input.groupBy as CoachGroupBy) ? (input.groupBy as CoachGroupBy) : undefined;
  const sortBy = COACH_SORT_BYS.includes(input.sortBy as CoachSortBy) ? (input.sortBy as CoachSortBy) : undefined;
  const filter: CoachSavedFilter = {
    id: opts.id ?? `f_${Date.now().toString(36)}_${store.items.length + 1}`,
    name,
    smart: COACH_SMART_LISTS.some((s) => s.id === input.smart) ? input.smart! : 'all',
    list: input.list ?? 'all',
    priority: input.priority ?? 'all',
    tags: normalizeTags(input.tags),
    query: text(input.query, 200),
    includeDone: input.includeDone !== false,
    ...(view ? { view } : {}),
    ...(groupBy ? { groupBy } : {}),
    ...(sortBy ? { sortBy } : {}),
  };
  return { store: { version: 1, items: [...store.items, filter] }, filter, error: null };
}

export function removeCoachFilter(store: CoachFilterStore, id: string): CoachFilterStore {
  const items = store.items.filter((f) => f.id !== id);
  return items.length === store.items.length ? store : { version: 1, items };
}

export function applyCoachFilter(
  store: CoachPlannerStore,
  filter: CoachSavedFilter,
  today = localIsoDate(),
): CoachTask[] {
  return filterCoachTasks(store, {
    smart: filter.smart,
    list: filter.list,
    priority: filter.priority,
    tags: filter.tags,
    query: filter.query,
    includeDone: filter.includeDone,
    today,
  });
}

const timeRank = (t: CoachTask): string => t.time ?? '99:99';
const orderRank = (t: CoachTask): number => (typeof t.order === 'number' ? t.order : Number.MAX_SAFE_INTEGER);
const priorityRank = (t: CoachTask): number => {
  switch (coachTaskPriority(t)) {
    case 'high':
      return 0;
    case 'medium':
      return 1;
    case 'low':
      return 2;
    default:
      return 3;
  }
};

/**
 * Сортировка: по дате, закреплённые сверху дня, затем ручной порядок
 * (если задан), затем время; «на весь день» — после задач со временем.
 */
export function sortCoachTasks(items: CoachTask[]): CoachTask[] {
  return [...items].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.pinned === true ? 0 : 1) - (b.pinned === true ? 0 : 1) ||
      orderRank(a) - orderRank(b) ||
      timeRank(a).localeCompare(timeRank(b)) ||
      priorityRank(a) - priorityRank(b) ||
      a.title.localeCompare(b.title),
  );
}

/** Задачи умного списка (TickTick smart list). `done` — все выполненные. */
export function smartListTasks(
  store: CoachPlannerStore,
  smart: CoachSmartListId,
  today = localIsoDate(),
  opts: { includeDone?: boolean } = {},
): CoachTask[] {
  const includeDone = opts.includeDone !== false;
  const open = (t: CoachTask): boolean => includeDone || !t.done;
  switch (smart) {
    case 'today':
      return sortCoachTasks(store.items.filter((t) => t.date === today && open(t)));
    case 'tomorrow': {
      const tomorrow = shiftIsoDate(today, 1);
      return sortCoachTasks(store.items.filter((t) => t.date === tomorrow && open(t)));
    }
    case 'next7': {
      // «7 дней» — сегодня и следующие шесть, а не восемь суток.
      const to = shiftIsoDate(today, 6);
      return sortCoachTasks(store.items.filter((t) => t.date >= today && t.date <= to && open(t)));
    }
    case 'overdue':
      return sortCoachTasks(store.items.filter((t) => t.date < today && !t.done));
    case 'inbox':
      return sortCoachTasks(store.items.filter((t) => coachTaskList(t) === 'inbox' && open(t)));
    case 'done':
      // Свежие закрытия сверху; без времени закрытия — в конце, стабильно.
      return [...store.items.filter((t) => t.done)].sort((a, b) => {
        const at = (t: CoachTask): string => t.completedAt ?? '';
        return at(b).localeCompare(at(a)) || a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
      });
    case 'all':
    default:
      return sortCoachTasks(store.items.filter(open));
  }
}

/** Сколько задач в умном списке — для счётчика на чипе. */
export function countSmartList(
  store: CoachPlannerStore,
  smart: CoachSmartListId,
  today = localIsoDate(),
  opts: { includeDone?: boolean } = {},
): number {
  return smartListTasks(store, smart, today, opts).length;
}

/** Сортировка «как в TickTick» — отдельно от канонической дневной. */
export function sortCoachTasksBy(items: readonly CoachTask[], sort: CoachSortBy): CoachTask[] {
  const rows = [...items];
  switch (sort) {
    case 'date':
      return rows.sort(
        (a, b) =>
          a.date.localeCompare(b.date) || timeRank(a).localeCompare(timeRank(b)) || priorityRank(a) - priorityRank(b),
      );
    case 'priority':
      return rows.sort(
        (a, b) =>
          priorityRank(a) - priorityRank(b) || a.date.localeCompare(b.date) || timeRank(a).localeCompare(timeRank(b)),
      );
    case 'created':
      return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    case 'updated':
      return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    case 'title':
      return rows.sort((a, b) => a.title.localeCompare(b.title));
    case 'manual':
      return rows.sort(
        (a, b) => a.date.localeCompare(b.date) || orderRank(a) - orderRank(b) || timeRank(a).localeCompare(timeRank(b)),
      );
    case 'smart':
    default:
      return sortCoachTasks(rows);
  }
}

export interface CoachTaskGroup {
  key: string;
  label: string;
  items: CoachTask[];
}

const PRIORITY_GROUP_ORDER: CoachTaskPriority[] = ['high', 'medium', 'low', 'none'];

/** Группировка карточек: по списку, приоритету, тегу или дню. */
export function groupCoachTasks(items: readonly CoachTask[], by: CoachGroupBy): CoachTaskGroup[] {
  if (by === 'none') return [{ key: 'all', label: 'Все', items: [...items] }];
  const map = new Map<string, CoachTask[]>();
  // Тег в группе показываем так, как его ввели (а не в нижнем регистре ключа).
  const tagLabels = new Map<string, string>();
  const add = (key: string, task: CoachTask): void => {
    const list = map.get(key);
    if (list) list.push(task);
    else map.set(key, [task]);
  };
  for (const task of items) {
    if (by === 'list') add(coachTaskList(task), task);
    else if (by === 'priority') add(coachTaskPriority(task), task);
    else if (by === 'date') add(task.date, task);
    else {
      const tags = coachTaskTags(task);
      if (tags.length === 0) add('__none__', task);
      else {
        for (const tag of tags) {
          const key = `tag:${tag.toLowerCase()}`;
          if (!tagLabels.has(key)) tagLabels.set(key, tag);
          add(key, task);
        }
      }
    }
  }
  const keys = [...map.keys()];
  if (by === 'list')
    keys.sort((a, b) => COACH_TASK_LISTS.indexOf(a as CoachTaskList) - COACH_TASK_LISTS.indexOf(b as CoachTaskList));
  if (by === 'priority')
    keys.sort(
      (a, b) =>
        PRIORITY_GROUP_ORDER.indexOf(a as CoachTaskPriority) - PRIORITY_GROUP_ORDER.indexOf(b as CoachTaskPriority),
    );
  if (by === 'date') keys.sort((a, b) => a.localeCompare(b));
  if (by === 'tag') keys.sort((a, b) => (a === '__none__' ? 1 : b === '__none__' ? -1 : a.localeCompare(b)));
  return keys.map((key) => {
    const label =
      by === 'list'
        ? COACH_TASK_LIST_LABELS[key as CoachTaskList]
        : by === 'priority'
          ? COACH_PRIORITY_LABELS[key as CoachTaskPriority]
          : by === 'date'
            ? fmtCoachDateLabel(key)
            : key === '__none__'
              ? 'Без тегов'
              : formatCoachTag(tagLabels.get(key) ?? key.slice(4));
    const groupItems = map.get(key) ?? [];
    return { key, label, items: sortCoachTasks(groupItems) };
  });
}

/** Фильтр по списку/приоритету/поиску/тегам/умному списку. */
export function filterCoachTasks(
  store: CoachPlannerStore,
  opts: {
    query?: string;
    list?: CoachTaskList | 'all';
    priority?: CoachTaskPriority | 'all';
    from?: string;
    to?: string;
    includeDone?: boolean;
    /** Хотя бы один из тегов (без учёта регистра). */
    tags?: readonly string[];
    smart?: CoachSmartListId;
    today?: string;
    pinnedOnly?: boolean;
  } = {},
): CoachTask[] {
  const q = text(opts.query, 200).toLowerCase();
  const tagFilter = normalizeTags(opts.tags).map((t) => t.toLowerCase());
  let items =
    opts.smart && opts.smart !== 'all'
      ? smartListTasks(store, opts.smart, opts.today ?? localIsoDate(), { includeDone: opts.includeDone })
      : store.items;
  if (opts.list && opts.list !== 'all') items = items.filter((t) => coachTaskList(t) === opts.list);
  if (opts.priority && opts.priority !== 'all') items = items.filter((t) => coachTaskPriority(t) === opts.priority);
  if (opts.from && isValidCoachDate(opts.from)) items = items.filter((t) => t.date >= opts.from!);
  if (opts.to && isValidCoachDate(opts.to)) items = items.filter((t) => t.date <= opts.to!);
  if (opts.includeDone === false) items = items.filter((t) => !t.done);
  if (opts.pinnedOnly === true) items = items.filter((t) => t.pinned === true);
  if (tagFilter.length > 0) {
    items = items.filter((t) => {
      const tags = coachTaskTags(t).map((x) => x.toLowerCase());
      return tagFilter.some((tag) => tags.includes(tag));
    });
  }
  if (q) {
    items = items.filter((t) => {
      const hay = [
        t.title,
        t.note,
        coachTaskTags(t).join(' '),
        coachTaskSubtasks(t)
          .map((s) => s.title)
          .join(' '),
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }
  return sortCoachTasks(items);
}

/** Сколько задач в каждом списке — для чипов-фильтров. */
export function countTasksByList(
  store: CoachPlannerStore,
  opts: { includeDone?: boolean } = {},
): Record<CoachTaskList, number> {
  const out = { inbox: 0, training: 0, health: 0, work: 0, personal: 0 } as Record<CoachTaskList, number>;
  for (const t of store.items) {
    if (opts.includeDone === false && t.done) continue;
    out[coachTaskList(t)] += 1;
  }
  return out;
}

/** Все теги планера с количеством задач — для чипов-фильтров и панели тегов. */
export function collectCoachTags(
  store: CoachPlannerStore,
  opts: { includeDone?: boolean; from?: string; to?: string } = {},
): { tag: string; count: number }[] {
  const map = new Map<string, { tag: string; count: number }>();
  for (const t of store.items) {
    if (opts.includeDone === false && t.done) continue;
    if (opts.from && isValidCoachDate(opts.from) && t.date < opts.from) continue;
    if (opts.to && isValidCoachDate(opts.to) && t.date > opts.to) continue;
    for (const tag of coachTaskTags(t)) {
      const key = tag.toLowerCase();
      const row = map.get(key);
      if (row) row.count += 1;
      else map.set(key, { tag, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}

/* ═══════════════════════════════════════════════════════════════════════
   Матрица Эйзенхауэра (TickTick: Eisenhower Matrix)
   ═══════════════════════════════════════════════════════════════════════ */

export type CoachQuadrant = 'do' | 'plan' | 'delegate' | 'drop';

export const COACH_QUADRANTS: readonly {
  id: CoachQuadrant;
  label: string;
  hint: string;
  color: string;
}[] = [
  { id: 'do', label: 'Сделать сейчас', hint: 'Важно и срочно', color: '#ef4444' },
  { id: 'plan', label: 'Запланировать', hint: 'Важно, но не срочно', color: '#f59e0b' },
  { id: 'delegate', label: 'Разгрузить', hint: 'Срочно, но не важно', color: '#38bdf8' },
  { id: 'drop', label: 'Отложить', hint: 'Не важно и не срочно', color: '#64748b' },
];

/**
 * Квадрант задачи: «срочно» — дата сегодня или раньше, «важно» — средний и
 * высокий приоритет. Оценка грубая, но честная: она не меняет задачу.
 */
export function coachQuadrant(t: CoachTask, today = localIsoDate()): CoachQuadrant {
  const urgent = t.date <= today;
  const important = priorityRank(t) <= 1;
  if (urgent && important) return 'do';
  if (!urgent && important) return 'plan';
  if (urgent && !important) return 'delegate';
  return 'drop';
}

export function tasksForDate(store: CoachPlannerStore, date: string): CoachTask[] {
  return sortCoachTasks(store.items.filter((t) => t.date === date));
}

export function tasksInRange(store: CoachPlannerStore, from: string, to: string): CoachTask[] {
  return sortCoachTasks(store.items.filter((t) => t.date >= from && t.date <= to));
}

/** Сколько задач на каждом дне диапазона — для точек в сетке календаря. */
export function countTasksByDate(
  store: CoachPlannerStore,
  from: string,
  to: string,
  opts: { includeDone?: boolean } = {},
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of store.items) {
    if (opts.includeDone === false && t.done) continue;
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
  const items = store.items.filter((t) => t.date >= from && (opts.includeDone === true || !t.done));
  return sortCoachTasks(items).slice(0, limit);
}

/** Просроченные — до `today` и не закрыты. Отдельным блоком, а не «сгорели». */
export function overdueCoachTasks(store: CoachPlannerStore, today = localIsoDate()): CoachTask[] {
  return sortCoachTasks(store.items.filter((t) => t.date < today && !t.done));
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
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;
