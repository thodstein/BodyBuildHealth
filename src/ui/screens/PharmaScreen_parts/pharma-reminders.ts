/**
 * pharma-reminders.ts — напоминания о днях инъекций (ТОЛЬКО APK).
 * Чистая логика: префы, построение недельных повторов, id.
 * Сам шедулинг — native-bridge (scheduleWeeklyReminders/cancelScheduledReminders).
 */
import { jsDayToCapacitorWeekday, type WeeklyReminder } from '../../../core/native-bridge';

export const REMINDER_KEY = 'he_pharma_remind_v1';
/** База id (день Пн=0…Вс=6 → BASE+idx). */
export const REMINDER_ID_BASE = 41000;
export const REMINDER_DAYS_RU = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export interface RemindPrefs {
  enabled: boolean;
  /** 'HH:MM'. */
  time: string;
  /** Дни Пн=0…Вс=6. */
  days: number[];
}

export function defaultRemindPrefs(): RemindPrefs {
  return { enabled: false, time: '09:00', days: [0, 3] };
}

export function loadRemindPrefs(): RemindPrefs {
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    if (!raw) return defaultRemindPrefs();
    const p = JSON.parse(raw) as Partial<RemindPrefs>;
    const time = typeof p.time === 'string' && /^\d{1,2}:\d{2}$/.test(p.time) ? p.time : '09:00';
    const days = Array.isArray(p.days)
      ? [...new Set(p.days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
      : [0, 3];
    return { enabled: p.enabled === true, time, days };
  } catch {
    return defaultRemindPrefs();
  }
}

export function saveRemindPrefs(p: RemindPrefs): void {
  try {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(p));
  } catch {
    /* quota — состояние останется в памяти */
  }
}

export function reminderIdForDay(dayIdx: number): number {
  return REMINDER_ID_BASE + dayIdx;
}

export function allReminderIds(): number[] {
  return [0, 1, 2, 3, 4, 5, 6].map(reminderIdForDay);
}

function parseTime(time: string): { hour: number; minute: number } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  const hour = m ? Math.max(0, Math.min(23, parseInt(m[1], 10))) : 9;
  const minute = m ? Math.max(0, Math.min(59, parseInt(m[2], 10))) : 0;
  return { hour, minute };
}

/** Построить недельные повторы из префов (пусто — нечего шедулить). */
export function buildReminderItems(p: RemindPrefs, title: string, body: string): WeeklyReminder[] {
  if (!p.enabled || p.days.length === 0) return [];
  const { hour, minute } = parseTime(p.time);
  return p.days.map((d) => ({
    id: reminderIdForDay(d),
    weekday: jsDayToCapacitorWeekday(d),
    hour,
    minute,
    title,
    body,
  }));
}
