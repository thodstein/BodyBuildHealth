import { describe, it, expect, beforeEach } from 'vitest';
import { buildCardioCycle } from '../cardio.engine';
import {
  loadCardioLog, saveCardioLogEntry, removeCardioLogEntry, clearCardioLog,
  cardioLogStats, dateDaysAgo, weekStartIso,
  cardioWeekAdherence, cardioAdherenceSummary, computeCardioAdvice,
  type CardioLogEntry,
} from '../cardio-diary.engine';

const LOG_KEY = 'he_cardio_sessions';
const REF = '2026-01-05T00:00:00.000Z';

function entry(patch: Partial<CardioLogEntry>): CardioLogEntry {
  return { id: 'e' + Math.random(), date: '2026-01-05', type: 'zone2', durationMin: 30, completed: true, ...patch };
}

beforeEach(() => {
  try { localStorage.removeItem(LOG_KEY); } catch { /* ignore */ }
});

describe('CRUD журнала', () => {
  it('save → load (сортировка DESC по дате)', () => {
    saveCardioLogEntry(entry({ date: '2026-01-05' }));
    saveCardioLogEntry(entry({ date: '2026-01-07' }));
    const log = loadCardioLog();
    expect(log).toHaveLength(2);
    expect(log[0].date).toBe('2026-01-07');
  });

  it('remove удаляет по id; повреждённые данные → []', () => {
    const e = entry({});
    saveCardioLogEntry(e);
    removeCardioLogEntry(e.id);
    expect(loadCardioLog()).toHaveLength(0);
    try { localStorage.setItem(LOG_KEY, '{bad'); } catch { /* ignore */ }
    expect(loadCardioLog()).toEqual([]);
  });

  it('cap: 500 записей', () => {
    for (let i = 0; i < 505; i++) saveCardioLogEntry(entry({ id: 'e' + i, date: '2026-01-01' }));
    expect(loadCardioLog()).toHaveLength(500);
  });

  it('clear удаляет всё', () => {
    saveCardioLogEntry(entry({}));
    clearCardioLog();
    expect(loadCardioLog()).toHaveLength(0);
  });
});

describe('статистика', () => {
  it('cardioLogStats 7 дней: только выполненные и в окне', () => {
    saveCardioLogEntry(entry({ date: '2026-01-05', durationMin: 30, rpe: 6, avgHr: 130, calories: 200, completed: true }));
    saveCardioLogEntry(entry({ date: '2026-01-06', durationMin: 15, type: 'hiit', rpe: 9, avgHr: 160, calories: 220, completed: true }));
    saveCardioLogEntry(entry({ date: '2025-12-01', durationMin: 999, completed: true }));
    saveCardioLogEntry(entry({ date: '2026-01-07', durationMin: 10, completed: false }));
    const s = cardioLogStats(loadCardioLog(), 7, REF);
    expect(s.sessions).toBe(2);
    expect(s.minutes).toBe(45);
    expect(s.avgRpe).toBe(7.5);
    expect(s.avgHr).toBe(145);
    expect(s.kcal).toBe(420);
  });

  it('dateDaysAgo/weekStartIso работают локально (независимо от TZ)', () => {
    expect(dateDaysAgo(0, REF)).toBe('2026-01-05');
    expect(dateDaysAgo(7, REF)).toBe('2025-12-29');
    expect(weekStartIso(1, REF)).toBe('2026-01-05');
    expect(weekStartIso(2, REF)).toBe('2026-01-12');
  });
});

describe('adherence', () => {
  it('cardioWeekAdherence: план vs факт', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4, daysAvailable: 3 });
    saveCardioLogEntry(entry({ date: '2026-01-05', durationMin: 30, completed: true }));
    saveCardioLogEntry(entry({ date: '2026-01-06', durationMin: 25, completed: true }));
    const a = cardioWeekAdherence(c, 1, loadCardioLog(), REF);
    expect(a.plannedSessions).toBeGreaterThanOrEqual(2);
    expect(a.doneSessions).toBe(2);
    expect(a.plannedMinutes).toBeGreaterThan(0);
    expect(a.doneMinutes).toBe(55);
  });

  it('cardioAdherenceSummary считает средние по неделям', () => {
    const c = buildCardioCycle({ goal: 'health', totalWeeks: 4 });
    const log = [entry({ date: '2026-01-05', durationMin: 30, completed: true })];
    const s = cardioAdherenceSummary(c, log, 2, REF);
    expect(s.weeks).toHaveLength(2);
    expect(s.avgPctSessions).toBeGreaterThanOrEqual(0);
    expect(s.totalDone).toBe(1);
  });
});

describe('computeCardioAdvice', () => {
  const c = buildCardioCycle({ goal: 'cut', totalWeeks: 8 });

  it('опасный ACWR → reduce', () => {
    const a = computeCardioAdvice(c, [], { acwr: 1.6 });
    expect(a.action).toBe('reduce');
    expect(a.reason).toContain('ACWR');
  });

  it('низкое восстановление → reduce', () => {
    const a = computeCardioAdvice(c, [], { recoveryLow: true });
    expect(a.action).toBe('reduce');
  });

  it('нет данных → keep с подсказкой', () => {
    const a = computeCardioAdvice(c, [], {});
    expect(a.action).toBe('keep');
    expect(a.reason).toContain('не записано');
  });

  it('выполнено <60% плана → increase', () => {
    const log = [entry({ date: '2026-01-05', durationMin: 15, completed: true })];
    const a = computeCardioAdvice(c, log, { referenceIso: REF });
    expect(a.action).toBe('increase');
  });

  it('RPE ≥ 8 → reduce', () => {
    const log = [entry({ date: '2026-01-05', durationMin: 60, rpe: 9, completed: true })];
    const a = computeCardioAdvice(c, log, { referenceIso: REF });
    expect(a.action).toBe('reduce');
    expect(a.reason).toContain('RPE');
  });

  it('нагрузка в норме → keep', () => {
    const log = [
      entry({ date: '2026-01-05', durationMin: 40, rpe: 6, completed: true }),
      entry({ date: '2026-01-06', durationMin: 40, rpe: 6, completed: true }),
      entry({ date: '2026-01-07', durationMin: 40, rpe: 6, completed: true }),
    ];
    const a = computeCardioAdvice(c, log, { referenceIso: REF });
    expect(a.action).toBe('keep');
  });
});
