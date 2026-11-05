/**
 * coach-week.engine.ts — недельный вид тренера: задачи по дням + факты атлетов.
 *
 * ЗАЧЕМ. Планер уже умеет хранить задачи, а сводки — показывать, что было у
 * атлета. Но тренер открывает вкладку утром с вопросом «что сегодня и у кого».
 * Недельный вид отвечает на него, не заставляя листать 20 карточек.
 *
 * ГЛАВНОЕ ЧЕСТНОЕ ОГРАНИЧЕНИЕ. Программа атлета не хранит «в какой день недели
 * какая тренировка» — в рантайме есть только список дней программы. Поэтому мы
 * НЕ раскладываем будущие тренировки по дням (это была бы выдумка), а показываем:
 *  • задачи тренера — по их датам (это его собственные данные);
 *  • кто РЕАЛЬНО тренировался в этот день — по датам из дневника;
 *  • обзор недели: у кого нет программы, у кого не выполнена прошлая неделя,
 *    у кого нет чек-ина на этой неделе, какие есть комментарии к неделе.
 *
 * Напоминания (`planCoachReminders`) — opt-in и только по задачам, у которых
 * указано время: без времени «напомнить» не о чем, а придумывать время нельзя.
 */
import { parseLocalIsoDate, shiftIsoDate } from '../../core/local-date';
import type { CoachTask } from './coach-planner.engine';
import type { AthleteSnapshot } from './coach-athlete-snapshot.engine';
import type { AdherenceResult } from './coach-adherence.engine';
import type { CoachNote } from './coach-notes.engine';

export interface WeekAthleteFact {
  athleteId: string;
  athleteName: string;
}

export interface CoachWeekDay {
  date: string;
  /** 0 = понедельник … 6 = воскресенье. */
  weekdayIndex: number;
  /** Короткая подпись «Пн 02.11». */
  label: string;
  isToday: boolean;
  isPast: boolean;
  /** Задачи тренера на этот день (включая выполненные: история не прячется). */
  tasks: CoachTask[];
  /** Кто реально тренировался в этот день (факт из дневника). */
  trained: WeekAthleteFact[];
}

export interface WeekMissed {
  athleteId: string;
  athleteName: string;
  done: number;
  planned: number;
}

export interface WeekCheckinGap extends WeekAthleteFact {
  /** Дата последнего чек-ина `YYYY-MM-DD`. */
  lastCheckin: string;
}

export interface WeekReview {
  /** В работе, но программы нет — тренировать нечего. */
  withoutPlan: WeekAthleteFact[];
  /** Прошлая неделя не выполнена (закончилась). */
  lastWeekMissed: WeekMissed[];
  /** Чек-ин был, но не на этой неделе. */
  noCheckinThisWeek: WeekCheckinGap[];
  /** Комментарии тренера к этой неделе. */
  comments: { athleteId: string; athleteName: string; body: string }[];
}

export interface CoachWeek {
  weekStart: string;
  weekEnd: string;
  days: CoachWeekDay[];
  review: WeekReview;
  /** Задачи на неделю (для подписи «7 задач, 2 закрыты»). */
  tasksTotal: number;
  tasksDone: number;
  /** Задачи, которые ещё не закрыты и дата уже прошла. */
  overdue: CoachTask[];
}

export interface WeekAthleteRow {
  athlete: { id: string; name: string; status: 'active' | 'paused' | 'archived' };
  snapshot?: AthleteSnapshot;
  adherence?: AdherenceResult;
}

export interface WeekInput {
  today: string;
  weekStart: string;
  tasks: readonly CoachTask[];
  athletes: readonly WeekAthleteRow[];
  /** Заметки тренера (для комментариев к неделе). */
  notes: readonly CoachNote[];
}

const WEEKDAY_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** 0 = понедельник … 6 = воскресенье. */
export function weekdayIndexOf(iso: string): number {
  const d = parseLocalIsoDate(iso);
  if (!d) return 0;
  return (d.getDay() + 6) % 7;
}

export function weekDayLabel(iso: string): string {
  return `${WEEKDAY_SHORT[weekdayIndexOf(iso)]} ${iso.slice(8, 10)}.${iso.slice(5, 7)}`;
}

export function buildCoachWeek(input: WeekInput): CoachWeek {
  const { today, weekStart, tasks, athletes, notes } = input;
  const weekEnd = shiftIsoDate(weekStart, 6);

  const days: CoachWeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = shiftIsoDate(weekStart, i);
    days.push({
      date,
      weekdayIndex: i,
      label: weekDayLabel(date),
      isToday: date === today,
      isPast: date < today,
      tasks: tasks
        .filter(t => t.date === date)
        .sort((a, b) => {
          // Задачи со временем — по времени; «на весь день» — после них.
          if (a.time && b.time) return a.time.localeCompare(b.time);
          if (a.time) return -1;
          if (b.time) return 1;
          return a.title.localeCompare(b.title, 'ru');
        }),
      trained: [],
    });
  }

  const dayByDate = new Map(days.map(d => [d.date, d]));
  const live = athletes.filter(r => r.athlete.status !== 'archived');

  for (const row of live) {
    for (const date of row.snapshot?.sessionDates ?? []) {
      const day = dayByDate.get(date);
      if (!day) continue;
      if (day.trained.some(f => f.athleteId === row.athlete.id)) continue;
      day.trained.push({ athleteId: row.athlete.id, athleteName: row.athlete.name });
    }
  }
  for (const day of days) day.trained.sort((a, b) => a.athleteName.localeCompare(b.athleteName, 'ru'));

  const withoutPlan: WeekAthleteFact[] = [];
  const lastWeekMissed: WeekMissed[] = [];
  const noCheckinThisWeek: WeekCheckinGap[] = [];

  for (const row of live) {
    const { athlete, snapshot, adherence } = row;
    if (snapshot && !snapshot.hasPlan) {
      withoutPlan.push({ athleteId: athlete.id, athleteName: athlete.name });
    }
    if (adherence?.previous.state === 'behind') {
      lastWeekMissed.push({
        athleteId: athlete.id,
        athleteName: athlete.name,
        done: adherence.previous.done,
        planned: adherence.previous.planned,
      });
    }
    // «Пора чекиниться» без выдуманной частоты: говорим только то, что чек-ин
    // существует, но он раньше этой недели.
    if (snapshot?.lastCheckin && snapshot.lastCheckin < weekStart) {
      noCheckinThisWeek.push({
        athleteId: athlete.id,
        athleteName: athlete.name,
        lastCheckin: snapshot.lastCheckin,
      });
    }
  }

  const comments = notes
    .filter(n => n.week === weekStart && n.athleteId)
    .map(n => ({
      athleteId: n.athleteId as string,
      athleteName: live.find(r => r.athlete.id === n.athleteId)?.athlete.name ?? '',
      body: n.body,
    }))
    .filter(c => c.athleteName)
    .slice(0, 20);

  const weekTasks = tasks.filter(t => t.date >= weekStart && t.date <= weekEnd);
  const overdue = tasks
    .filter(t => !t.done && t.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    weekStart,
    weekEnd,
    days,
    review: { withoutPlan, lastWeekMissed, noCheckinThisWeek, comments },
    tasksTotal: weekTasks.length,
    tasksDone: weekTasks.filter(t => t.done).length,
    overdue,
  };
}

/* ------------------------------------------------------------------ */
/* Напоминания (opt-in)                                                */
/* ------------------------------------------------------------------ */

export interface PlannedCoachReminder {
  /** Стабильный ключ задачи и дня — для отладки и дедупликации. */
  key: string;
  /** 0 = понедельник … 6 = воскресенье (перевод в Capacitor — в UI). */
  weekdayIndex: number;
  hour: number;
  minute: number;
  title: string;
  body: string;
}

const TIME_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Какие задачи станут еженедельными напоминаниями.
 *
 * Правила:
 *  • только незакрытые задачи с временем;
 *  • только сегодня и будущее (прошлое напоминать бессмысленно);
 *  • один и тот же день+время+заголовок — одно напоминание (иначе телефон
 *    покажет два одинаковых);
 *  • не больше `max` (технический лимит ОС/плагина, а не «норма»).
 */
export function planCoachReminders(
  tasks: readonly CoachTask[],
  opts: { today: string; max?: number },
): PlannedCoachReminder[] {
  const max = Math.max(1, Math.min(40, Math.trunc(opts.max ?? 20)));
  const out: PlannedCoachReminder[] = [];
  const seen = new Set<string>();
  const sorted = [...tasks]
    .filter(t => !t.done && t.time && t.date >= opts.today)
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')));

  for (const task of sorted) {
    const m = TIME_RE.exec(task.time ?? '');
    if (!m) continue;
    const key = `${task.date}:${task.time}:${task.title.trim().toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      key,
      weekdayIndex: weekdayIndexOf(task.date),
      hour: Number(m[1]),
      minute: Number(m[2]),
      title: 'Тренер: задача',
      body: task.title,
    });
    if (out.length >= max) break;
  }
  return out;
}
