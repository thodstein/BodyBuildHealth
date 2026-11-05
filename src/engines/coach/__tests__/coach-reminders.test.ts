import { describe, expect, it } from 'vitest';
import {
  COACH_REMINDERS_KEY,
  emptyCoachReminderSettings,
  parseCoachReminderSettings,
  readCoachReminderSettings,
  setCoachRemindersEnabled,
  writeCoachReminderSettings,
} from '../coach-reminders.engine';

const memory = () => {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, v); },
    dump: () => map,
  };
};

describe('напоминания тренера: настройка', () => {
  it('по умолчанию выключено — уведомления не ставятся без согласия', () => {
    const s = readCoachReminderSettings(memory());
    expect(s.enabled).toBe(false);
    expect(s.enabledAt).toBeNull();
  });

  it('включение фиксирует время, выключение его снимает', () => {
    const on = setCoachRemindersEnabled(emptyCoachReminderSettings(), true, { now: '2026-11-04T10:00:00.000Z' });
    expect(on.enabled).toBe(true);
    expect(on.enabledAt).toBe('2026-11-04T10:00:00.000Z');
    const off = setCoachRemindersEnabled(on, false);
    expect(off.enabled).toBe(false);
    expect(off.enabledAt).toBeNull();
  });

  it('запись и чтение через хранилище', () => {
    const storage = memory();
    writeCoachReminderSettings(storage, setCoachRemindersEnabled(emptyCoachReminderSettings(), true));
    expect(storage.dump().has(COACH_REMINDERS_KEY)).toBe(true);
    expect(readCoachReminderSettings(storage).enabled).toBe(true);
  });

  it('битый JSON и чужая версия → выключено, без исключений', () => {
    expect(parseCoachReminderSettings('{oops').enabled).toBe(false);
    expect(parseCoachReminderSettings(JSON.stringify({ version: 2, enabled: true })).enabled).toBe(false);
    expect(parseCoachReminderSettings(null).enabled).toBe(false);
  });

  it('недоделанная запись (enabled без enabledAt) читается как выключенная подпись', () => {
    expect(parseCoachReminderSettings(JSON.stringify({ version: 1, enabled: true })).enabledAt).toBeNull();
  });

  it('хранилище без методов и с исключениями не ломает экран', () => {
    expect(readCoachReminderSettings(null).enabled).toBe(false);
    const throwing = { getItem: () => { throw new Error('boom'); }, setItem: () => { throw new Error('quota'); } };
    expect(readCoachReminderSettings(throwing).enabled).toBe(false);
    expect(() => writeCoachReminderSettings(throwing, emptyCoachReminderSettings())).not.toThrow();
  });
});
