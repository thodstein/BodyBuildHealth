/**
 * labs-schedule-phase.test.ts — P0: on_cycle не маппилось → baseline план
 */
import { describe, it, expect } from 'vitest';
import { generateLabSchedule } from '../labs-schedule.engine';

describe('labs-schedule phase mapping P0', () => {
  it('on_cycle должен давать курс-план (не baseline)', () => {
    const base = generateLabSchedule({ phase: 'baseline', courseStartDate: '2026-08-01', courseEntries: [] });
    const on = generateLabSchedule({ phase: 'on_cycle', courseStartDate: '2026-08-01', courseEntries: [] });
    const course = generateLabSchedule({ phase: 'course', courseStartDate: '2026-08-01', courseEntries: [] });
    // baseline и on_cycle должны различаться (разные наборы)
    expect(base[0].phaseSegment).toBe('baseline');
    expect(on[0].phaseSegment).toBe('baseline'); // on_cycle всегда начинает с baseline сегмента (до курса)
    expect(on.length).toBeGreaterThan(base.length);
    // on_cycle и course должны быть идентичны
    expect(on.length).toBe(course.length);
    expect(on.map((s) => s.week)).toEqual(course.map((s) => s.week));
  });

  it('course с треном должен давать триггеры', () => {
    const withTren = generateLabSchedule({
      phase: 'on_cycle',
      courseStartDate: '2026-08-01',
      courseEntries: [{ substanceId: 'methand', doseValue: 30 } as any],
    });
    const without = generateLabSchedule({ phase: 'on_cycle', courseStartDate: '2026-08-01', courseEntries: [] });
    // oral_17aa триггер добавляет ALB/TP, которых нет в базе on_cycle
    const withCount = withTren.reduce((s, x) => s + x.labs.length, 0);
    const withoutCount = without.reduce((s, x) => s + x.labs.length, 0);
    expect(withCount).toBeGreaterThan(withoutCount);
  });
});
