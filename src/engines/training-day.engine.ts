/**
 * training-day.engine.ts — ОДИН источник «какой день плана соответствует дате».
 *
 * До этого файла правило было продублировано трижды: `coach-agenda.engine.ts`
 * (канон для агенды), `ui/native/widget-sync.ts` (виджет) и
 * `TrainingCalendarTab.tsx` (календарь). Копии расходились:
 *  - в виджете `positions.indexOf(next) % planDays` не показывал дни 4–5 плана
 *    при 3 тренировках в неделю (индекс всегда 0..2);
 *  - `pattern` («работа/отдых») считался в виджете только ротацией по числу
 *    сессий, поэтому тренировка объявлялась в день отдыха;
 *  - календарь не знал дат дней плана вовсе и на реальном `he_pl_runtime`
 *    не рисовал план.
 *
 * ЯКОРЬ. У плана теперь есть `startDate` (локальная ISO-дата, которую пишут
 * продюсеры `he_pl_runtime` при сохранении). День плана N — это N-й
 * ТРЕНИРОВОЧНЫЙ день, считая от `startDate` по графику профиля. Такой якорь
 * даёт одно и то же «сегодня» плееру, виджету, календарю и агенде, и работает
 * для плана любой длины (48 дней BB-цикла при 4 тренировках в неделю).
 *
 * БЕЗ ЯКОРЯ поведение прежнее (дата → позиция дня недели в графике), потому
 * что `startDate` пишут только новые записи: старые payload'ы и тесты на них
 * не должны менять смысл.
 *
 * Даты — только через `core/local-date` (локальный календарь): `new Date('YYYY-MM-DD')`
 * берёт полночь UTC и к западу от UTC даёт вчера.
 */
import { localIsoDate, parseLocalIsoDate, shiftIsoDate } from '../core/local-date';

export interface TrainingScheduleLike {
  enabled?: boolean;
  scheduleType?: 'weekly' | 'eod' | 'pattern' | string;
  weeklyDays?: unknown[];
  pattern?: { work?: unknown; off?: unknown } | null;
  startTime?: string;
}

export interface TrainingSettingsLike {
  daysPerWeek?: unknown;
  schedule?: TrainingScheduleLike | null;
}

/** Раскладка «N тренировок в неделю» по дням (0=Пн), когда графика нет. */
const WEEKDAY_PATTERN: Record<number, number[]> = {
  1: [2],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};

/** Эпоха фазы «работа/отдых», если якоря плана нет (канон агенды). */
const PATTERN_EPOCH = '2024-01-01';

/** Предохранитель перебора дат: 5 лет дневного шага. */
const MAX_SCAN_DAYS = 1830;

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

/** ISO-дата YYYY-MM-DD или null: произвольную строку датой не считаем.
 *  `2026-13-99` / `2026-02-31` тоже не даты: `new Date` такие значения молча
 *  переносит на другой месяц, и календарь показал бы план не в тот день. */
function validIso(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const iso = value.slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const d = parseLocalIsoDate(iso);
  if (!d) return null;
  const same = d.getFullYear() === Number(m[1]) && d.getMonth() + 1 === Number(m[2]) && d.getDate() === Number(m[3]);
  return same ? iso : null;
}

/** Индекс дня недели 0=Пн…6=Вс для локальной даты YYYY-MM-DD. */
export function mondayIndex(iso: string): number {
  const d = parseLocalIsoDate(String(iso ?? '').slice(0, 10));
  if (!d) return 0;
  return (d.getDay() + 6) % 7;
}

/** Полдень локальной даты: разница в сутках без сдвигов DST. */
function localNoon(iso: string): number {
  const d = parseLocalIsoDate(iso);
  if (!d) return NaN;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0).getTime();
}

/** Целых суток от `from` до `to` (знак сохраняется). */
export function daysBetween(from: string, to: string): number {
  const a = localNoon(from);
  const b = localNoon(to);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

export function isPatternSchedule(training: TrainingSettingsLike | null | undefined): boolean {
  const sched = training?.schedule;
  return sched?.enabled === true && sched.scheduleType === 'pattern';
}

/** Цикл «работа/отдых» профиля: сколько дней работать и сколько отдыхать. */
export function patternCycle(training: TrainingSettingsLike | null | undefined): { work: number; off: number } {
  const pattern = training?.schedule?.pattern;
  return {
    work: clampInt(pattern?.work, 1, 14, 2),
    off: clampInt(pattern?.off, 0, 14, 1),
  };
}

/**
 * Тренировочные дни недели (0=Пн…6=Вс). Для `pattern` это раскладка по
 * `daysPerWeek` — «есть ли в неделе тренировки», а не фаза цикла: фазу считает
 * `isTrainingDayFor`.
 */
export function weeklyTrainingDays(training: TrainingSettingsLike | null | undefined): boolean[] {
  const fromList = (list: number[]) => Array.from({ length: 7 }, (_, i) => list.includes(i));
  const sched = training?.schedule;
  if (sched?.enabled === true) {
    if (sched.scheduleType === 'weekly' && Array.isArray(sched.weeklyDays) && sched.weeklyDays.length === 7) {
      return sched.weeklyDays.map((v) => v === true);
    }
    if (sched.scheduleType === 'eod') return fromList([0, 2, 4, 6]);
  }
  // `daysPerWeek: 0` — «не задано», а не «одна тренировка в среду»: прежние
  // копии расходились ровно здесь (виджет — 3 дня, агенда — 1).
  const raw = Math.trunc(Number(training?.daysPerWeek));
  const perWeek = Number.isFinite(raw) && raw > 0 ? Math.min(7, raw) : 3;
  return fromList(WEEKDAY_PATTERN[perWeek] ?? WEEKDAY_PATTERN[3]);
}

/**
 * Тренировочный ли день по графику профиля.
 *
 * `anchorIso` — якорь цикла «работа/отдых» (старт плана). С ним фаза считается
 * от якоря: так виджет, плеер и календарь понимают цикл одинаково и тренировка
 * не объявляется в день отдыха. Без якоря фаза считается от `2024-01-01` —
 * прежний канон агенды (`coach-agenda.engine.ts`), поведение не меняется.
 */
export function isTrainingDayFor(
  training: TrainingSettingsLike | null | undefined,
  iso: string,
  anchorIso?: unknown,
): boolean {
  if (!training) return false;
  const date = validIso(iso);
  if (!date) return false;
  if (isPatternSchedule(training)) {
    const { work, off } = patternCycle(training);
    if (off <= 0) return true;
    const anchor = validIso(anchorIso) ?? PATTERN_EPOCH;
    const period = work + off;
    const pos = ((daysBetween(anchor, date) % period) + period) % period;
    return pos < work;
  }
  return !!weeklyTrainingDays(training)[mondayIndex(date)];
}

export interface PlanDayIndexArgs {
  /** Дата, для которой нужен день плана. */
  iso: string;
  training?: TrainingSettingsLike | null;
  /** Сколько дней в плане (`he_pl_runtime.days.length`). */
  planDays: number;
  /** Якорь плана: ISO-дата первого дня (`he_pl_runtime.startDate`). */
  startDate?: unknown;
  /** Сколько сессий уже сделано на этой неделе — только для старого пути без якоря. */
  sessionsThisWeek?: number;
}

/**
 * День плана (0-based) для даты.
 *
 * С якорем: N-й тренировочный день от `startDate`. В день отдыха — следующая
 * тренировка (это то, что показывает виджет «что делать дальше»); в календаре
 * дни отдыха и не запрашиваются.
 *
 * Без якоря: позиция дня недели в графике профиля (прежнее поведение).
 */
export function pickPlanDayIndex({
  iso,
  training,
  planDays,
  startDate,
  sessionsThisWeek = 0,
}: PlanDayIndexArgs): number {
  const total = Math.trunc(Number(planDays));
  if (!(total > 0)) return 0;
  const date = validIso(iso) ?? localIsoDate();
  const start = validIso(startDate);

  if (start && training) {
    const anchored = anchoredPlanDayIndex(date, training, total, start);
    if (anchored !== null) return anchored;
  }

  return legacyPlanDayIndex(date, training, total, sessionsThisWeek);
}

/** Индекс дня плана по якорю; null — перебор не дошёл до даты (битые данные). */
function anchoredPlanDayIndex(
  iso: string,
  training: TrainingSettingsLike,
  planDays: number,
  startDate: string,
): number | null {
  if (iso < startDate) return 0; // дата раньше старта плана — план ещё не начался
  let count = 0;
  let cursor = startDate;
  for (let guard = 0; guard <= MAX_SCAN_DAYS; guard += 1) {
    const trainingDay = isTrainingDayFor(training, cursor, startDate);
    if (trainingDay) count += 1;
    if (cursor === iso) {
      // Сегодня тренировка — это `count`-й день плана; отдых — следующий.
      return (trainingDay ? count - 1 : count) % planDays;
    }
    cursor = shiftIsoDate(cursor, 1);
    if (cursor > iso) return 0;
  }
  return null;
}

/** Прежнее поведение (payload без `startDate`): позиция дня недели в графике. */
function legacyPlanDayIndex(
  iso: string,
  training: TrainingSettingsLike | null | undefined,
  planDays: number,
  sessionsThisWeek: number,
): number {
  const rotation = () => {
    const done = Math.max(0, Math.trunc(Number(sessionsThisWeek) || 0));
    return done % planDays;
  };
  if (!training) return rotation();
  if (isPatternSchedule(training)) return rotation();
  const weekly = weeklyTrainingDays(training);
  const positions = weekly.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  if (positions.length === 0) return rotation();
  const dow = mondayIndex(iso);
  const exact = positions.indexOf(dow);
  if (exact >= 0) return exact % planDays;
  // Отдых: ближайшая тренировка вперёд (по кругу).
  const next = positions.find((p) => p > dow) ?? positions[0];
  return positions.indexOf(next) % planDays;
}

export interface PlanDatesArgs {
  planDays: number;
  startDate?: unknown;
  training?: TrainingSettingsLike | null;
}

/**
 * Даты дней плана по якорю: `planDays` ближайших тренировочных дней от
 * `startDate`. null — якоря нет или график не даёт тренировочных дней:
 * выдумывать даты по индексу массива (1/2/3-е число) нельзя, календарь
 * объявил бы такие дни «пропущено».
 */
export function planDatesForIndexes({ planDays, startDate, training }: PlanDatesArgs): string[] | null {
  const total = Math.trunc(Number(planDays));
  const start = validIso(startDate);
  if (!(total > 0) || !start || !training) return null;
  const out: string[] = [];
  let cursor = start;
  for (let guard = 0; guard <= MAX_SCAN_DAYS && out.length < total; guard += 1) {
    if (isTrainingDayFor(training, cursor, start)) out.push(cursor);
    cursor = shiftIsoDate(cursor, 1);
  }
  return out.length > 0 ? out : null;
}
