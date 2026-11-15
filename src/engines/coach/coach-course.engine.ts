/**
 * coach-course.engine.ts — назначение КУРСА (фарма) подопечному.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ ДВИЖОК. Рацион и БАДы лежат в localStorage, поэтому их
 * назначение — снимок сырых ключей. Курс живёт в IndexedDB (`course_log`), и
 * «выдать» его значит записать строки в базу пространства атлета. Здесь —
 * чистая часть этой операции: проверка плана, строки курса, человеческое
 * описание. Запись в базу — отдельный тонкий модуль (`coach-course-store`),
 * потому что вкладка тренера не имеет права тянуть `core/db` статически.
 *
 * ГРАНИЦЫ:
 *  • это ПЛАН (что и сколько недель), а не дневник инъекций: факт приёма
 *    остаётся у атлета;
 *  • приложение не назначает лечение и не считает «безопасную дозу»: дозировку
 *    и длительность задаёт тренер, лимиты здесь — только технические;
 *  • строки, выданные тренером, имеют префикс `coach_course_` в id: повторная
 *    выдача заменяет ТОЛЬКО их и никогда не трогает строки, созданные атлетом
 *    или прошлым курсом вручную.
 */
import { localIsoDate } from '../../core/local-date';

export const COURSE_PLAN_VERSION = 1;
/** Больше 20 препаратов в один курс — почти наверняка ошибка ввода. */
export const COURSE_ITEMS_MAX = 20;
/** Префикс id строк, которыми владеет тренер: по нему идёт замена. */
export const COACH_COURSE_ID_PREFIX = 'coach_course_';
export const COURSE_NOTE_MAX = 300;
export const COURSE_NAME_MAX = 60;
export const COURSE_DOSE_MAX = 5000;
export const COURSE_WEEK_MAX = 104;

export interface CoursePlanItem {
  /** id вещества из каталога приложения; `''` — препарат введён названием. */
  substanceId: string;
  name: string;
  doseValue: number;
  /** мг, мкг, МЕ, таб… */
  doseUnit: string;
  /** Приёмов в неделю (число) или текстом («каждый день», «через день»). */
  frequency: number | string;
  /** Недели курса, с 1. */
  startWeek: number;
  endWeek: number;
  /** Дни инъекций, 0 = понедельник…6 = воскресенье. */
  injectionDays?: number[];
}

export interface CoachCoursePlan {
  version: typeof COURSE_PLAN_VERSION;
  /** Дата старта `YYYY-MM-DD`; `''` — «с даты выдачи». */
  startDate: string;
  items: CoursePlanItem[];
  note: string;
}

export type CoursePlanError = 'not-object' | 'version' | 'empty' | 'item' | 'limit' | null;

export interface CoursePlanParse {
  plan: CoachCoursePlan | null;
  error: CoursePlanError;
}

const clean = (v: unknown, max: number): string =>
  typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';

const num = (v: unknown): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const isIsoDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v);

export function emptyCoursePlan(startDate = ''): CoachCoursePlan {
  return { version: COURSE_PLAN_VERSION, startDate: isIsoDate(startDate) ? startDate : '', items: [], note: '' };
}

function cleanItem(raw: unknown): CoursePlanItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const name = clean(r.name, COURSE_NAME_MAX);
  const substanceId = clean(r.substanceId, 60);
  if (!name && !substanceId) return null;
  const doseValue = num(r.doseValue);
  if (!(doseValue > 0) || doseValue > COURSE_DOSE_MAX) return null;
  const startWeek = Math.max(0, Math.min(COURSE_WEEK_MAX, Math.trunc(num(r.startWeek))));
  const endWeek = Math.max(startWeek, Math.min(COURSE_WEEK_MAX, Math.trunc(num(r.endWeek))));
  const frequencyRaw = r.frequency;
  const frequency = typeof frequencyRaw === 'number'
    ? Math.max(0, Math.min(21, Math.trunc(frequencyRaw)))
    : clean(frequencyRaw, 24);
  const daysRaw = Array.isArray(r.injectionDays) ? r.injectionDays : [];
  const injectionDays = [...new Set(
    daysRaw
      .map(v => Math.trunc(num(v)))
      .filter(v => v >= 0 && v <= 6),
  )].sort((a, b) => a - b);
  return {
    substanceId,
    name: name || substanceId,
    doseValue: Math.round(doseValue * 100) / 100,
    doseUnit: clean(r.doseUnit, 8) || 'мг',
    frequency: frequency === '' ? 1 : frequency,
    startWeek,
    endWeek,
    ...(injectionDays.length ? { injectionDays } : {}),
  };
}

/** Один препарат из формы: проверка та же, что при импорте плана. */
export function makeCourseItem(input: {
  substanceId?: string;
  name: string;
  doseValue: number | string;
  doseUnit: string;
  frequency: number | string;
  startWeek: number | string;
  endWeek: number | string;
  injectionDays?: number[];
}): CoursePlanItem | null {
  return cleanItem(input);
}

/** Проверить план курса из файла, шаблона или черновика. Ничего не пишет. */
export function normalizeCoursePlan(value: unknown): CoursePlanParse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { plan: null, error: 'not-object' };
  const obj = value as Record<string, unknown>;
  if (obj.version !== COURSE_PLAN_VERSION) return { plan: null, error: 'version' };
  if (!Array.isArray(obj.items)) return { plan: null, error: 'item' };
  if (!obj.items.length) return { plan: null, error: 'empty' };
  if (obj.items.length > COURSE_ITEMS_MAX) return { plan: null, error: 'limit' };
  const items: CoursePlanItem[] = [];
  for (const raw of obj.items) {
    const item = cleanItem(raw);
    if (!item) return { plan: null, error: 'item' };
    items.push(item);
  }
  const startDate = typeof obj.startDate === 'string' && isIsoDate(obj.startDate) ? obj.startDate : '';
  return {
    plan: { version: COURSE_PLAN_VERSION, startDate, items, note: clean(obj.note, COURSE_NOTE_MAX) },
    error: null,
  };
}

/** «Тестостерон энантат 500 мг · 2/нед · недели 1–12». */
export function courseItemLine(item: CoursePlanItem): string {
  const dose = `${item.doseValue} ${item.doseUnit}`;
  const head = item.name ? `${item.name} ${dose}` : dose;
  const freq = typeof item.frequency === 'string'
    ? item.frequency
    : item.frequency > 0
      ? `${item.frequency}/нед`
      : '';
  const weeks = item.startWeek === item.endWeek
    ? `неделя ${item.startWeek}`
    : `недели ${item.startWeek}–${item.endWeek}`;
  return [head, freq, weeks].filter(Boolean).join(' · ');
}

export interface CoursePlanSummary {
  items: number;
  /** Длительность в неделях (по самому длинному препарату). */
  weeks: number;
  lines: string[];
}

export function describeCoursePlan(plan: CoachCoursePlan): CoursePlanSummary {
  const maxEnd = plan.items.reduce((m, i) => Math.max(m, i.endWeek), 0);
  const minStart = plan.items.reduce((m, i) => Math.min(m, i.startWeek), Number.POSITIVE_INFINITY);
  // Недели считаем включительно: 1–12 — это двенадцать недель, а не одиннадцать.
  const weeks = plan.items.length
    ? Math.max(1, maxEnd - (Number.isFinite(minStart) ? minStart : 0) + 1)
    : 0;
  return {
    items: plan.items.length,
    weeks,
    lines: plan.items.map(courseItemLine),
  };
}

export interface CoachCourseRow {
  id: string;
  substanceId: string;
  /** Имя на момент выдачи: каталог может поменяться. */
  name: string;
  doseValue: number;
  doseUnit: string;
  frequency: number | string;
  startWeek: number;
  endWeek: number;
  startDate?: string;
  injectionDays?: number[];
  /** Пометка источника: строку создал тренер, а не атлет. */
  source: 'coach';
}

/**
 * Строки для `course_log`. id детерминированный (`coach_course_1`, …): повторная
 * выдача того же плана перезаписывает те же строки, а не плодит дубли.
 */
export function courseRowsFor(plan: CoachCoursePlan, opts: { startDate?: string } = {}): CoachCourseRow[] {
  const startDate = opts.startDate ?? plan.startDate;
  return plan.items.map((item, index) => ({
    id: `${COACH_COURSE_ID_PREFIX}${index + 1}`,
    substanceId: item.substanceId || item.name,
    name: item.name,
    doseValue: item.doseValue,
    doseUnit: item.doseUnit,
    frequency: item.frequency,
    startWeek: item.startWeek,
    endWeek: item.endWeek,
    ...(isIsoDate(startDate) ? { startDate } : {}),
    ...(item.injectionDays?.length ? { injectionDays: item.injectionDays } : {}),
    source: 'coach' as const,
  }));
}

/** План из строк курса (например, снятый у атлета, чтобы выдать другому). */
export function planFromCourseRows(rows: readonly unknown[]): CoachCoursePlan {
  const items: CoursePlanItem[] = [];
  for (const raw of rows) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const item = cleanItem({
      substanceId: r.substanceId,
      name: r.name ?? r.substanceId,
      doseValue: r.doseValue,
      doseUnit: r.doseUnit,
      frequency: r.frequency,
      startWeek: r.startWeek,
      endWeek: r.endWeek,
      injectionDays: r.injectionDays,
    });
    if (item) items.push(item);
    if (items.length >= COURSE_ITEMS_MAX) break;
  }
  const firstDate = rows
    .map(r => (r && typeof r === 'object' ? (r as Record<string, unknown>).startDate : null))
    .find(v => typeof v === 'string' && isIsoDate(v));
  return {
    version: COURSE_PLAN_VERSION,
    startDate: typeof firstDate === 'string' ? firstDate : '',
    items,
    note: '',
  };
}

export function coursePlanErrorText(error: CoursePlanError): string {
  switch (error) {
    case 'not-object':
      return 'Это не план курса.';
    case 'version':
      return 'План курса сделан другой версией приложения.';
    case 'empty':
      return 'В курсе нет ни одного препарата.';
    case 'item':
      return 'В курсе есть препарат без дозы или названия.';
    case 'limit':
      return `В курсе больше ${COURSE_ITEMS_MAX} препаратов — это почти наверняка ошибка.`;
    default:
      return '';
  }
}

/** Сегодняшняя дата — чтобы UI не собирал её по-своему. */
export function courseToday(): string {
  return localIsoDate();
}
