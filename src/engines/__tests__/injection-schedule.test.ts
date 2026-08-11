/**
 * injection-schedule.test.ts — расписание инъекций: CRUD, дни недели,
 * соблюдение графика, «сегодня по плану», пропущенные, следующая дата.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
})();
vi.stubGlobal('localStorage', localStorageMock);

import {
  SCHEDULE_WEEKDAYS,
  addScheduleItem,
  computeScheduleAdherence,
  getDueToday,
  getInjectionSchedule,
  getMissedInjections,
  getNextScheduledDate,
  getScheduleSummary,
  mondayDayOf,
  nextDateWithWeekday,
  removeScheduleItem,
  saveInjectionSchedule,
  shiftDate,
  updateScheduleItem,
  type InjectionScheduleItem,
} from '../injection-schedule.engine';

const MONDAY = '2026-08-10'; // понедельник

function scheduleItem(overrides: Partial<InjectionScheduleItem> = {}): InjectionScheduleItem {
  return {
    id: `sch_test_${Math.random().toString(36).slice(2, 8)}`,
    substance: 'Тест энантат',
    dose: '250 мг',
    daysOfWeek: [0, 2], // Пн, Ср
    zone: 'glute_dorsal',
    side: 'left',
    technique: 'im',
    needleGauge: '23G',
    volumeMl: 1,
    active: true,
    ...overrides,
  };
}

beforeEach(() => {
  localStorageMock.clear();
});

describe('injection-schedule.engine', () => {
  describe('Дни недели', () => {
    it('SCHEDULE_WEEKDAYS: Пн=0 … Вс=6', () => {
      expect(SCHEDULE_WEEKDAYS).toEqual(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']);
    });

    it('mondayDayOf: 2026-08-10 — понедельник (0)', () => {
      expect(mondayDayOf(MONDAY)).toBe(0);
    });

    it('mondayDayOf: воскресенье = 6', () => {
      expect(mondayDayOf('2026-08-16')).toBe(6);
    });

    it('nextDateWithWeekday находит ближайший нужный день', () => {
      expect(nextDateWithWeekday(2, MONDAY)).toBe('2026-08-12'); // Ср
      expect(nextDateWithWeekday(0, MONDAY)).toBe('2026-08-10'); // сегодня
    });

    it('shiftDate корректно сдвигает даты', () => {
      expect(shiftDate(MONDAY, 1)).toBe('2026-08-11');
      expect(shiftDate(MONDAY, -1)).toBe('2026-08-09');
    });
  });

  describe('CRUD', () => {
    it('пустое расписание по умолчанию', () => {
      expect(getInjectionSchedule()).toEqual([]);
    });

    it('addScheduleItem добавляет с id', () => {
      const updated = addScheduleItem(scheduleItem());
      expect(updated).toHaveLength(1);
      expect(updated[0].id).toMatch(/^sch_/);
    });

    it('saveInjectionSchedule перезаписывает полностью', () => {
      const items = [scheduleItem({ id: 'a' }), scheduleItem({ id: 'b' })];
      saveInjectionSchedule(items);
      expect(getInjectionSchedule().map((e) => e.id)).toEqual(['a', 'b']);
    });

    it('updateScheduleItem патчит по id', () => {
      addScheduleItem(scheduleItem());
      const id = getInjectionSchedule()[0].id;
      const updated = updateScheduleItem(id, { dose: '300 мг', active: false });
      expect(updated[0].dose).toBe('300 мг');
      expect(updated[0].active).toBe(false);
    });

    it('removeScheduleItem удаляет по id', () => {
      addScheduleItem(scheduleItem());
      const id = getInjectionSchedule()[0].id;
      expect(removeScheduleItem(id)).toEqual([]);
    });
  });

  describe('getDueToday', () => {
    it('возвращает пункты с днём недели = сегодня', () => {
      const items = [
        scheduleItem({ id: 'mon', daysOfWeek: [0] }),
        scheduleItem({ id: 'tue', daysOfWeek: [1] }),
      ];
      const due = getDueToday(items, MONDAY);
      expect(due.map((e) => e.id)).toEqual(['mon']);
    });

    it('неактивные пункты не учитываются', () => {
      const items = [scheduleItem({ id: 'mon', daysOfWeek: [0], active: false })];
      expect(getDueToday(items, MONDAY)).toEqual([]);
    });
  });

  describe('getNextScheduledDate', () => {
    it('ближайшая плановая дата (включая сегодня)', () => {
      const item = scheduleItem({ daysOfWeek: [2] }); // Ср
      expect(getNextScheduledDate(item, MONDAY)).toBe('2026-08-12');
    });

    it('сегодняшний день недели учитывается', () => {
      const item = scheduleItem({ daysOfWeek: [0] }); // Пн
      expect(getNextScheduledDate(item, MONDAY)).toBe(MONDAY);
    });

    it('неактивный → null', () => {
      expect(getNextScheduledDate(scheduleItem({ active: false }), MONDAY)).toBeNull();
    });
  });

  describe('computeScheduleAdherence', () => {
    const entries = [
      { date: '2026-08-10', substance: 'Тест энантат' }, // Пн — сделано
      // Ср 2026-08-12 — пропущено
    ];

    it('считает planned/actual/pct за 1 неделю', () => {
      const rows = computeScheduleAdherence(entries, [scheduleItem({ daysOfWeek: [0, 2] })], 1, MONDAY);
      expect(rows).toHaveLength(1);
      expect(rows[0].planned).toBe(2);
      expect(rows[0].actual).toBe(1);
      expect(rows[0].pct).toBe(50);
    });

    it('100% при полном соблюдении', () => {
      const full = [...entries, { date: '2026-08-05', substance: 'Тест энантат' }]; // Ср в окне
      const rows = computeScheduleAdherence(full, [scheduleItem({ daysOfWeek: [0, 2] })], 1, MONDAY);
      expect(rows[0].pct).toBe(100);
    });

    it('0% без инъекций', () => {
      const rows = computeScheduleAdherence([], [scheduleItem({ daysOfWeek: [0, 2] })], 1, MONDAY);
      expect(rows[0].pct).toBe(0);
    });

    it('сравнение препарата регистронезависимо', () => {
      const rows = computeScheduleAdherence(
        [{ date: '2026-08-10', substance: 'ТЕСТ ЭНАНТАТ ' }],
        [scheduleItem({ daysOfWeek: [0] })],
        1,
        MONDAY,
      );
      expect(rows[0].actual).toBe(1);
    });

    it('неактивные пункты пропускаются', () => {
      const rows = computeScheduleAdherence([], [scheduleItem({ active: false })], 1, MONDAY);
      expect(rows).toEqual([]);
    });

    it('сортировка по убыванию соблюдения (худшие первыми)', () => {
      const rows = computeScheduleAdherence(
        [{ date: '2026-08-10', substance: 'Тест энантат' }],
        [
          scheduleItem({ id: 'a', substance: 'Тест энантат', daysOfWeek: [0] }), // 100%
          scheduleItem({ id: 'b', substance: 'Нандролон', daysOfWeek: [0] }),   // 0%
        ],
        1,
        MONDAY,
      );
      expect(rows[0].item.id).toBe('b');
    });
  });

  describe('getMissedInjections', () => {
    it('находит пропущенные плановые даты', () => {
      const entries = [{ date: '2026-08-10', substance: 'Тест энантат' }]; // Пн сделано
      const missed = getMissedInjections(entries, [scheduleItem({ daysOfWeek: [0, 2] })], 7, MONDAY);
      expect(missed).toEqual([
        { item: expect.objectContaining({ substance: 'Тест энантат' }), date: '2026-08-05' },
      ]);
    });

    it('не считает пропуском сделанные даты', () => {
      const entries = [
        { date: '2026-08-05', substance: 'Тест энантат' },
        { date: '2026-08-10', substance: 'Тест энантат' },
      ];
      expect(getMissedInjections(entries, [scheduleItem({ daysOfWeek: [0, 2] })], 7, MONDAY)).toEqual([]);
    });

    it('игнорирует неактивные пункты', () => {
      const missed = getMissedInjections([], [scheduleItem({ active: false })], 7, MONDAY);
      expect(missed).toEqual([]);
    });
  });

  describe('getScheduleSummary', () => {
    it('пусто → hasSchedule=false', () => {
      const s = getScheduleSummary();
      expect(s.hasSchedule).toBe(false);
      expect(s.dueToday).toEqual([]);
      expect(s.missed).toEqual([]);
    });

    it('с пунктами → dueToday/missed/adherence', () => {
      saveInjectionSchedule([scheduleItem({ id: 'mon_wed', daysOfWeek: [0, 2] })]);
      const s = getScheduleSummary();
      expect(s.hasSchedule).toBe(true);
      expect(s.adherence).toHaveLength(1);
      expect(s.missed.length).toBeGreaterThanOrEqual(0);
    });
  });
});
