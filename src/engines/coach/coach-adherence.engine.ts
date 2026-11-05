/**
 * coach-adherence.engine.ts — «план против факта» по неделе, без выдуманных норм.
 *
 * ЗАЧЕМ. Тренер видит, что атлет что-то записал в дневник, но не видит главного:
 * выполнен ли план недели. Считать это «на глаз» нельзя, а придумывать нормативы
 * («должно быть 4 тренировки») — тем более: у каждого своя программа.
 *
 * ОТКУДА БЕРЁТСЯ ПЛАН. Только из самого приложения: `he_pl_runtime` — то, что
 * человек реально открыл в «Тренировках» (дни программы). Сколько дней с
 * упражнениями — столько сессий в неделю и запланировано. Если рантайма нет —
 * честное «плана нет, не считаем», а не «0%».
 *
 * ОТКУДА ФАКТ. Даты тренировок из его дневника (`training_log`/`workout_log`,
 * читает `coach-athlete-snapshot.engine`). Один день = одна сессия, даже если
 * записей по упражнениям несколько.
 *
 * ЧЕГО ЗДЕСЬ НЕТ: порогов «хорошо/плохо», процентов от максимума, прогнозов.
 * `percent` — это просто done/planned, и он null, когда считать нечего.
 */
import { parseLocalIsoDate, shiftIsoDate } from '../../core/local-date';

/** План, восстановленный из рантайма тренировок атлета. */
export interface AdherencePlan {
  /** Сколько сессий в неделю задаёт программа (дни с упражнениями). */
  sessionsPerWeek: number;
  /** Название программы/фокуса — как записано в рантайме. */
  focus: string;
  track: string;
}

/**
 * Состояние недели:
 *  • no-plan — плана нет, выполнение не считаем;
 *  • no-sessions — в дневнике нет ни одной тренировки за всё время;
 *  • in-progress — неделя ещё идёт (оценивать рано);
 *  • done — запланированное выполнено (или перевыполнено);
 *  • behind — неделя закончилась, сессий меньше плана.
 */
export type AdherenceWeekState = 'no-plan' | 'no-sessions' | 'in-progress' | 'done' | 'behind';

export interface WeekAdherence {
  /** Понедельник недели, `YYYY-MM-DD`. */
  weekStart: string;
  /** Воскресенье недели, `YYYY-MM-DD`. */
  weekEnd: string;
  planned: number;
  done: number;
  /** done/planned в процентах; null — считать нечего. Может быть >100 (сверх плана). */
  percent: number | null;
  state: AdherenceWeekState;
  /** Неделя целиком в прошлом (все её дни раньше сегодняшнего). */
  finished: boolean;
}

export interface AdherenceResult extends WeekAdherence {
  plan: AdherencePlan | null;
  /** Предыдущая неделя — для отчётов и сравнения (та же арифметика). */
  previous: WeekAdherence;
  /** Готовая строка для карточки. Без оценок и «норм». */
  line: string;
  /** Пункт для инбокса внимания; null — повода нет. */
  attention: string | null;
}

const text = (v: unknown, max: number): string => String(v ?? '').trim().slice(0, max);
const DAY_MS = 86_400_000;

const isoDay = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
};

/** Понедельник недели, в которую попадает дата. */
export function weekStartOf(iso: string): string {
  const d = parseLocalIsoDate(iso);
  if (!d) return iso;
  const offset = (d.getDay() + 6) % 7; // 0 = понедельник
  return shiftIsoDate(iso, -offset);
}

/**
 * План из `he_pl_runtime`. Возвращает null, если рантайма нет, он битый или в нём
 * нет ни одного дня с упражнениями — тогда честно «плана нет».
 */
export function readAdherencePlan(runtimeRaw: string | null | undefined): AdherencePlan | null {
  if (!runtimeRaw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(runtimeRaw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  const days = Array.isArray(obj.days) ? obj.days : [];
  const sessions = days.filter(day => {
    if (!day || typeof day !== 'object') return false;
    const d = day as Record<string, unknown>;
    const exercises = Array.isArray(d.exercises) ? d.exercises : [];
    return exercises.length > 0;
  }).length;
  if (!sessions) return null;
  return {
    // Технический потолок, не «норматив»: неделя из 14+ «дней» — это испорченные
    // данные, и процент по ним был бы бессмысленным.
    sessionsPerWeek: Math.min(sessions, 14),
    focus: text(obj.focus, 60),
    track: text(obj.track, 10),
  };
}

interface WeekInput {
  weekStart: string;
  planned: number;
  /** Уникальные даты тренировок (неважно, в каком порядке). */
  sessionDates: readonly string[];
  today: string;
  hasAnySessions: boolean;
}

function computeWeek(input: WeekInput): WeekAdherence {
  const { weekStart, planned, sessionDates, today, hasAnySessions } = input;
  const weekEnd = shiftIsoDate(weekStart, 6);
  const finished = weekEnd < today;
  const unique = new Set<string>();
  for (const raw of sessionDates) {
    const day = isoDay(raw);
    if (!day) continue;
    if (day < weekStart || day > weekEnd) continue;
    if (day > today) continue; // будущее — не факт
    unique.add(day);
  }
  const done = unique.size;
  // Ноль процентов без единой записи в дневнике — это не «провал», а «нечего
  // считать»: человек мог не пользоваться приложением. Поэтому null.
  const percent = planned > 0 && hasAnySessions ? Math.round((done / planned) * 100) : null;

  let state: AdherenceWeekState;
  if (planned <= 0) state = 'no-plan';
  else if (!hasAnySessions) state = 'no-sessions';
  else if (!finished) state = 'in-progress';
  else state = done >= planned ? 'done' : 'behind';

  return { weekStart, weekEnd, planned, done, percent, state, finished };
}

export interface AdherenceInput {
  /** `he_pl_runtime` пространства атлета (сырой JSON). */
  runtimeRaw: string | null | undefined;
  /** Даты тренировок из дневника (`YYYY-MM-DD`), любые окна. */
  sessionDates: readonly string[];
  /** Сегодняшняя календарная дата `YYYY-MM-DD`. */
  today: string;
}

export function computeAdherence(input: AdherenceInput): AdherenceResult {
  const plan = readAdherencePlan(input.runtimeRaw);
  const planned = plan?.sessionsPerWeek ?? 0;
  const sessionDates = input.sessionDates;
  const hasAnySessions = sessionDates.some(d => isoDay(d) != null);

  const weekStart = weekStartOf(input.today);
  const current = computeWeek({ weekStart, planned, sessionDates, today: input.today, hasAnySessions });
  const previous = computeWeek({
    weekStart: shiftIsoDate(weekStart, -7),
    planned,
    sessionDates,
    today: input.today,
    hasAnySessions,
  });

  let attention: string | null = null;
  if (current.state === 'no-plan') attention = 'нет программы — выполнение не считаем';
  else if (current.state === 'behind') {
    attention = `план недели не выполнен: ${current.done} из ${current.planned}`;
  }

  return {
    ...current,
    plan,
    previous,
    line: adherenceLine(current),
    attention,
  };
}

export function adherenceLine(w: WeekAdherence | undefined): string {
  if (!w) return '';
  if (w.state === 'no-plan') return 'выполнение: плана нет — не считаем';
  if (w.state === 'no-sessions') return 'выполнение: в дневнике нет тренировок';
  const tail = w.finished ? '' : ' (неделя не закончена)';
  return `выполнение: ${w.done} из ${w.planned} за неделю${w.percent == null ? '' : `, ${w.percent}%`}${tail}`;
}

/** Середина недели и воскресенье — для подписи «неделя 04.11–10.11». */
export function weekRangeLine(w: WeekAdherence): string {
  return `${w.weekStart.slice(8, 10)}.${w.weekStart.slice(5, 7)}–${w.weekEnd.slice(8, 10)}.${w.weekEnd.slice(5, 7)}`;
}

/** Сколько календарных дней недели уже прошло (1..7). Нужен для «идёт 3-й день». */
export function weekDayIndex(weekStart: string, today: string): number {
  const a = parseLocalIsoDate(weekStart);
  const b = parseLocalIsoDate(today);
  if (!a || !b) return 1;
  const diff = Math.round((b.getTime() - a.getTime()) / DAY_MS);
  return Math.min(7, Math.max(1, diff + 1));
}
