/**
 * planner-refeed-calendar.test.ts — календарь рефидов/диет-брейков.
 */
import { describe, it, expect } from 'vitest';
import { buildRefeedCalendar } from '../planner-refeed-calendar.engine';

describe('Календарь рефидов/диет-брейков', () => {
  it('сушка: рефиды каждые ~7–14 дней, диет-брейк каждые N недель', () => {
    const cal = buildRefeedCalendar({ goal: 'cutting', startDate: '2026-03-02', horizonWeeks: 8, bodyFatPct: 8 });
    expect(cal.mode).toBe('cut');
    expect(cal.weeks).toHaveLength(8);
    // BF 8 → рефид каждые 7 дней, диет-брейк каждые 8 недель → 8-я неделя брейк.
    expect(cal.weeks[7].isDietBreak).toBe(true);
    expect(cal.weeks[7].refeedDates).toEqual([]);
    expect(cal.dietBreakWeeks).toBe(1);
    // Рефиды есть в неделях 2–7 (offset 7,14,21,28,35,42).
    expect(cal.refeedCount).toBeGreaterThanOrEqual(5);
    // Даты рефидов внутри диапазона своей недели.
    for (const w of cal.weeks) for (const d of w.refeedDates) { expect(d >= w.dateStart).toBe(true); expect(d <= w.dateEnd).toBe(true); }
  });

  it('рекомпозиция: режим recomp, календарь строится', () => {
    const cal = buildRefeedCalendar({ goal: 'recomposition', startDate: '2026-03-02', horizonWeeks: 4, bodyFatPct: 16 });
    expect(cal.mode).toBe('recomp');
    expect(cal.weeks.length).toBe(4);
  });

  it('масса/поддержание: режим none, пусто + нота', () => {
    for (const g of ['mass', 'maintenance', 'strength', 'health']) {
      const cal = buildRefeedCalendar({ goal: g, startDate: '2026-03-02', horizonWeeks: 4, bodyFatPct: 14 });
      expect(cal.mode).toBe('none');
      expect(cal.weeks).toHaveLength(0);
    }
  });

  it('невалидная дата → пусто; детерминизм', () => {
    expect(buildRefeedCalendar({ goal: 'cutting', startDate: 'bad', horizonWeeks: 4 }).weeks).toHaveLength(0);
    const a = buildRefeedCalendar({ goal: 'cutting', startDate: '2026-03-02', horizonWeeks: 8, bodyFatPct: 12 });
    const b = buildRefeedCalendar({ goal: 'cutting', startDate: '2026-03-02', horizonWeeks: 8, bodyFatPct: 12 });
    expect(a).toEqual(b);
  });
});
