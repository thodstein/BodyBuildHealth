/**
 * planner-cycle-calendar.test.ts — Эпик 7 (NUTRITION-PROFESSIONAL-PLAN):
 * календарный расчёт фазы цикла (средняя длина + лог начал) + EA-действие.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  cyclePhaseForDate, inferCycleLength, saveCyclePeriod, getCycleLog, clearCycleLog, autoCyclePhase,
} from '../planner-cycle-calendar';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

vi.stubGlobal('localStorage', localStorageMock);

describe('cyclePhaseForDate — фаза по дню цикла', () => {
  it('дни 1-5 — менструация', () => {
    expect(cyclePhaseForDate('2026-08-01', 28, '2026-08-01')).toBe('menstrual');
    expect(cyclePhaseForDate('2026-08-01', 28, '2026-08-05')).toBe('menstrual');
  });
  it('дни 6-13 — фолликулярная', () => {
    expect(cyclePhaseForDate('2026-08-01', 28, '2026-08-06')).toBe('follicular');
    expect(cyclePhaseForDate('2026-08-01', 28, '2026-08-13')).toBe('follicular');
  });
  it('дни 14-16 — овуляция', () => {
    expect(cyclePhaseForDate('2026-08-01', 28, '2026-08-14')).toBe('ovulation');
    expect(cyclePhaseForDate('2026-08-01', 28, '2026-08-16')).toBe('ovulation');
  });
  it('дни 17+ — лютеиновая, цикл заворачивается', () => {
    expect(cyclePhaseForDate('2026-08-01', 28, '2026-08-17')).toBe('luteal');
    expect(cyclePhaseForDate('2026-08-01', 28, '2026-08-28')).toBe('luteal');
    expect(cyclePhaseForDate('2026-08-01', 28, '2026-08-29')).toBe('menstrual'); // новый цикл
  });
  it('короткий цикл 21 дн масштабируется', () => {
    expect(cyclePhaseForDate('2026-08-01', 21, '2026-08-19')).toBe('luteal');
    expect(cyclePhaseForDate('2026-08-01', 21, '2026-08-21')).toBe('luteal');
    expect(cyclePhaseForDate('2026-08-01', 21, '2026-08-22')).toBe('menstrual');
  });
  it('битые даты — none', () => {
    expect(cyclePhaseForDate('bad', 28, '2026-08-01')).toBe('none');
    expect(cyclePhaseForDate('2026-08-01', 28, '')).toBe('none');
  });
});

describe('inferCycleLength — медиана интервалов', () => {
  it('ровные интервалы 28 дн', () => {
    expect(inferCycleLength(['2026-01-01', '2026-01-29', '2026-02-26'])).toBe(28);
  });
  it('отклонения в 21-35 учитываются, вне — игнорируются', () => {
    expect(inferCycleLength(['2026-01-01', '2026-01-29', '2026-03-30'])).toBe(28); // 28, 60→игнор
  });
  it('меньше 2 отметок — дефолт 28', () => {
    expect(inferCycleLength([])).toBe(28);
    expect(inferCycleLength(['2026-01-01'])).toBe(28);
  });
  it('медиана чётного числа интервалов', () => {
    // 28 и 30 → 29
    expect(inferCycleLength(['2026-01-01', '2026-01-29', '2026-02-28'])).toBe(29);
  });
});

describe('saveCyclePeriod/getCycleLog/clearCycleLog', () => {
  beforeEach(() => localStorageMock.clear());
  it('сохраняет и сортирует, дедуп по дате', () => {
    saveCyclePeriod('2026-08-10');
    saveCyclePeriod('2026-08-01');
    saveCyclePeriod('2026-08-10');
    expect(getCycleLog()).toEqual(['2026-08-01', '2026-08-10']);
  });
  it('битая дата игнорируется', () => {
    saveCyclePeriod('bad');
    expect(getCycleLog()).toEqual([]);
  });
  it('clear удаляет лог', () => {
    saveCyclePeriod('2026-08-10');
    clearCycleLog();
    expect(getCycleLog()).toEqual([]);
  });
  it('битый JSON — пустой лог без бросков', () => {
    localStorage.setItem('he_cycle_log', 'not json');
    expect(getCycleLog()).toEqual([]);
  });
});

describe('autoCyclePhase — авто-фаза из лога', () => {
  beforeEach(() => localStorageMock.clear());
  it('без лога — none', () => {
    const r = autoCyclePhase([], '2026-08-10');
    expect(r.phase).toBe('none');
    expect(r.source).toBe('none');
  });
  it('фаза из последнего начала + средняя длина', () => {
    saveCyclePeriod('2026-08-01');
    saveCyclePeriod('2026-08-29');
    // средняя 28 → 05-09 = день 8 от 29-08 (фолликулярная)
    const r = autoCyclePhase(getCycleLog(), '2026-09-05');
    expect(r.length).toBe(28);
    expect(r.lastStart).toBe('2026-08-29');
    expect(r.phase).toBe('follicular');
  });
});