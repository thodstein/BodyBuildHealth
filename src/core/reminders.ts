/**
 * reminders.ts — ежедневные напоминания АПК: взвешивание, приёмы пищи, тренировка.
 *
 * Чистая логика: префы, id, слоты расписания — покрыто тестами.
 * Шедулинг — `native-bridge` (LocalNotifications), сам экран — `RemindersCard`.
 *
 * Почему отдельно от `pharma-reminders`: там недельные дни инъекций со своей
 * базой id (41000). Здесь ежедневные слоты и своя база (42000), чтобы отмена
 * одного типа не снимала другой.
 */
import { jsDayToCapacitorWeekday } from './native-bridge';

export const REMINDERS_KEY = 'he_reminders_v1';
/** База id: 0 — вес, 1..3 — приёмы пищи, 4..10 — дни тренировки. */
export const REMINDERS_ID_BASE = 42000;

export interface WeightReminder {
  enabled: boolean;
  /** 'HH:MM'. */
  time: string;
}

export interface MealsReminder {
  enabled: boolean;
  /** Три времени: завтрак, обед, ужин. */
  times: string[];
}

export interface WorkoutReminder {
  enabled: boolean;
  time: string;
  /** Дни Пн=0…Вс=6. */
  days: number[];
}

export interface ReminderPrefs {
  weigh: WeightReminder;
  meals: MealsReminder;
  workout: WorkoutReminder;
}

export const REMINDER_DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const TIME_RE = /^(\d{1,2}):(\d{2})$/;

export function defaultReminderPrefs(): ReminderPrefs {
  return {
    weigh: { enabled: false, time: '08:00' },
    meals: { enabled: false, times: ['09:00', '13:00', '19:00'] },
    workout: { enabled: false, time: '18:00', days: [0, 2, 4] },
  };
}

export function parseReminderTime(time: string, fallbackHour = 9): { hour: number; minute: number } {
  const m = TIME_RE.exec((time || '').trim());
  if (!m) return { hour: fallbackHour, minute: 0 };
  return {
    hour: Math.max(0, Math.min(23, parseInt(m[1], 10))),
    minute: Math.max(0, Math.min(59, parseInt(m[2], 10))),
  };
}

function normalizeTime(time: unknown, fallback: string): string {
  return typeof time === 'string' && TIME_RE.test(time.trim()) ? time.trim() : fallback;
}

/** Терпит битый/частичный storage: недостающее берём из дефолтов. */
export function loadReminderPrefs(): ReminderPrefs {
  const d = defaultReminderPrefs();
  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    if (!raw) return d;
    const p = JSON.parse(raw) as Partial<ReminderPrefs> | null;
    if (!p || typeof p !== 'object') return d;
    const times = Array.isArray(p.meals?.times)
      ? p.meals!.times.map((t, i) => normalizeTime(t, d.meals.times[i] ?? '12:00')).slice(0, 3)
      : d.meals.times;
    while (times.length < 3) times.push(d.meals.times[times.length]);
    return {
      weigh: { enabled: p.weigh?.enabled === true, time: normalizeTime(p.weigh?.time, d.weigh.time) },
      meals: { enabled: p.meals?.enabled === true, times },
      workout: {
        enabled: p.workout?.enabled === true,
        time: normalizeTime(p.workout?.time, d.workout.time),
        days: Array.isArray(p.workout?.days)
          ? [...new Set(p.workout!.days.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort((a, b) => a - b)
          : d.workout.days,
      },
    };
  } catch {
    return d;
  }
}

export function saveReminderPrefs(p: ReminderPrefs): void {
  try {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify(p));
  } catch {
    /* quota — останется в памяти */
  }
}

export function weighId(): number {
  return REMINDERS_ID_BASE;
}

export function mealId(index: number): number {
  return REMINDERS_ID_BASE + 1 + index;
}

export function workoutId(dayIdx: number): number {
  return REMINDERS_ID_BASE + 4 + dayIdx;
}

/** Все id этого блока — чтобы снять старые перед постановкой новых. */
export function allReminderIds(): number[] {
  return [
    weighId(),
    mealId(0), mealId(1), mealId(2),
    ...([0, 1, 2, 3, 4, 5, 6] as const).map(workoutId),
  ];
}

export interface DailySlot {
  id: number;
  kind: 'weigh' | 'meal';
  /** Индекс приёма пищи (0..2); для взвешивания — 0. */
  index: number;
  hour: number;
  minute: number;
}

export interface WeeklySlot {
  id: number;
  weekday: number;
  hour: number;
  minute: number;
}

/** Ежедневные слоты из префов (взвешивание + включённые приёмы пищи). */
export function dailySlots(p: ReminderPrefs): DailySlot[] {
  const out: DailySlot[] = [];
  if (p.weigh.enabled) {
    const t = parseReminderTime(p.weigh.time, 8);
    out.push({ id: weighId(), kind: 'weigh', index: 0, hour: t.hour, minute: t.minute });
  }
  if (p.meals.enabled) {
    p.meals.times.slice(0, 3).forEach((time, i) => {
      const t = parseReminderTime(time, 12);
      out.push({ id: mealId(i), kind: 'meal', index: i, hour: t.hour, minute: t.minute });
    });
  }
  return out;
}

/** Недельные слоты тренировки: один повтор на каждый выбранный день. */
export function weeklySlots(p: ReminderPrefs): WeeklySlot[] {
  if (!p.workout.enabled || p.workout.days.length === 0) return [];
  const t = parseReminderTime(p.workout.time, 18);
  return p.workout.days.map((day) => ({
    id: workoutId(day),
    weekday: jsDayToCapacitorWeekday(day),
    hour: t.hour,
    minute: t.minute,
  }));
}
