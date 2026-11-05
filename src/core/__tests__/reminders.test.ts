/**
 * reminders.test.ts — ежедневные напоминания: префы, id, слоты расписания.
 *
 * Контракт: id этого блока не пересекаются с напоминаниями курса (41000), а
 * выключенное напоминание не оставляет «фантомных» слотов после пересохранения.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import {
  REMINDERS_ID_BASE,
  REMINDERS_KEY,
  allReminderIds,
  dailySlots,
  defaultReminderPrefs,
  loadReminderPrefs,
  mealId,
  parseReminderTime,
  saveReminderPrefs,
  weighId,
  weeklySlots,
  workoutId,
  type ReminderPrefs,
} from '../reminders';

function prefs(patch: Partial<ReminderPrefs> = {}): ReminderPrefs {
  return { ...defaultReminderPrefs(), ...patch };
}

beforeEach(() => {
  localStorage.clear();
});

describe('префы напоминаний', () => {
  it('по умолчанию всё выключено', () => {
    const d = defaultReminderPrefs();
    expect(d.weigh.enabled).toBe(false);
    expect(d.meals.enabled).toBe(false);
    expect(d.workout.enabled).toBe(false);
  });

  it('битый storage не роняет чтение', () => {
    localStorage.setItem(REMINDERS_KEY, '{не json');
    const p = loadReminderPrefs();
    expect(p.weigh.time).toBe('08:00');
    expect(p.meals.times).toHaveLength(3);
  });

  it('частичный storage добивается дефолтами', () => {
    localStorage.setItem(REMINDERS_KEY, JSON.stringify({ weigh: { enabled: true, time: '07:30' } }));
    const p = loadReminderPrefs();
    expect(p.weigh).toEqual({ enabled: true, time: '07:30' });
    expect(p.meals.times).toEqual(['09:00', '13:00', '19:00']);
    expect(p.workout.days).toEqual([0, 2, 4]);
  });

  it('save → load сохраняет значения', () => {
    const next = prefs({
      weigh: { enabled: true, time: '06:45' },
      workout: { enabled: true, time: '19:30', days: [1, 3] },
    });
    saveReminderPrefs(next);
    expect(loadReminderPrefs()).toEqual(next);
  });
});

describe('время', () => {
  it('парсит HH:MM и ограничивает диапазон', () => {
    expect(parseReminderTime('07:05')).toEqual({ hour: 7, minute: 5 });
    expect(parseReminderTime('99:99')).toEqual({ hour: 23, minute: 59 });
    expect(parseReminderTime('мусор', 8)).toEqual({ hour: 8, minute: 0 });
  });
});

describe('id и слоты', () => {
  it('id уникальны и не пересекаются с напоминаниями курса (41000)', () => {
    const ids = allReminderIds();
    expect(new Set(ids).size).toBe(ids.length);
    expect(Math.min(...ids)).toBe(REMINDERS_ID_BASE);
    // 41000..41006 — дни инъекций
    expect(ids.every((id) => id >= 42000)).toBe(true);
  });

  it('взвешивание — один ежедневный слот', () => {
    const slots = dailySlots(prefs({ weigh: { enabled: true, time: '08:15' } }));
    expect(slots).toHaveLength(1);
    expect(slots[0]).toMatchObject({ id: weighId(), kind: 'weigh', hour: 8, minute: 15 });
  });

  it('приёмы пищи — три ежедневных слота со своими временами', () => {
    const slots = dailySlots(
      prefs({ meals: { enabled: true, times: ['07:00', '12:30', '18:45'] } }),
    );
    expect(slots.map((s) => s.id)).toEqual([mealId(0), mealId(1), mealId(2)]);
    expect(slots.map((s) => `${s.hour}:${s.minute}`)).toEqual(['7:0', '12:30', '18:45']);
  });

  it('выключенные напоминания не дают слотов', () => {
    expect(dailySlots(prefs())).toEqual([]);
    expect(weeklySlots(prefs())).toEqual([]);
  });

  it('тренировка — по слоту на каждый выбранный день, Пн=0 → Capacitor 2', () => {
    const slots = weeklySlots(
      prefs({ workout: { enabled: true, time: '18:00', days: [0, 6] } }),
    );
    expect(slots).toHaveLength(2);
    expect(slots[0]).toMatchObject({ id: workoutId(0), weekday: 2, hour: 18, minute: 0 });
    expect(slots[1]).toMatchObject({ id: workoutId(6), weekday: 1 });
  });
});
