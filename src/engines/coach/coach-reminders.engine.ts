/**
 * coach-reminders.engine.ts — настройка напоминаний тренера (opt-in).
 *
 * Почему отдельный ключ и почему он УСТРОЙСТВЕННЫЙ (`he_coach_*`): напоминания
 * ставит телефон, на котором открыт профиль. Они не часть данных атлета и не
 * должны переключаться вместе с пространством — иначе, войдя в данные ученика,
 * тренер выключил бы себе напоминания.
 *
 * По умолчанию выключено: приложение не имеет права ставить уведомления без
 * явного согласия. Никакого «мы решили за вас».
 */
export const COACH_REMINDERS_KEY = 'he_coach_reminders';

export interface CoachReminderSettings {
  version: 1;
  /** true — тренер сам включил напоминания о задачах со временем. */
  enabled: boolean;
  /** Когда включено (ISO-событие), для честной подписи «включено …». */
  enabledAt: string | null;
}

export function emptyCoachReminderSettings(): CoachReminderSettings {
  return { version: 1, enabled: false, enabledAt: null };
}

export function parseCoachReminderSettings(raw: string | null | undefined): CoachReminderSettings {
  if (!raw) return emptyCoachReminderSettings();
  try {
    const parsed = JSON.parse(raw) as Partial<CoachReminderSettings> | null;
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) {
      return emptyCoachReminderSettings();
    }
    const enabled = parsed.enabled === true;
    return {
      version: 1,
      enabled,
      enabledAt: enabled && typeof parsed.enabledAt === 'string' ? parsed.enabledAt : null,
    };
  } catch {
    return emptyCoachReminderSettings();
  }
}

export function readCoachReminderSettings(
  storage: { getItem?: (k: string) => string | null } | null | undefined,
): CoachReminderSettings {
  if (!storage || typeof storage.getItem !== 'function') return emptyCoachReminderSettings();
  try {
    return parseCoachReminderSettings(storage.getItem(COACH_REMINDERS_KEY));
  } catch {
    return emptyCoachReminderSettings();
  }
}

export function writeCoachReminderSettings(
  storage: { setItem?: (k: string, v: string) => void } | null | undefined,
  settings: CoachReminderSettings,
): CoachReminderSettings {
  if (storage && typeof storage.setItem === 'function') {
    try {
      storage.setItem(COACH_REMINDERS_KEY, JSON.stringify(settings));
    } catch {
      /* ignore quota */
    }
  }
  return settings;
}

export function setCoachRemindersEnabled(
  settings: CoachReminderSettings,
  enabled: boolean,
  opts: { now?: string } = {},
): CoachReminderSettings {
  return {
    version: 1,
    enabled,
    enabledAt: enabled ? (opts.now ?? new Date().toISOString()) : null,
  };
}
