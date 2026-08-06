import { describe, expect, it } from 'vitest';
import { detectLift, expandCycleWeeks, lmsCycleToSchedule } from '../lms-to-pl';
import { getCycleById } from '../../../data/lms-cycles/lms-cycle-index';

describe('LMS to PL conversion', () => {
  it('detects the three competition lifts and ignores accessories', () => {
    expect(detectLift('Жим лёжа', 'ЖМ')).toBe('bench');
    expect(detectLift('Присед со штангой', 'ПР')).toBe('squat');
    expect(detectLift('Становая тяга', 'ТГ')).toBe('dead');
    expect(detectLift('Разгибание рук', 'Ср')).toBeNull();
  });

  it('expands explicit weeks without silently replacing them', () => {
    const cycle = getCycleById('cycle-01');
    expect(cycle).toBeTruthy();
    const weeks = expandCycleWeeks(cycle!);
    expect(weeks.length).toBeGreaterThan(0);
    expect(weeks[0]).toBe(cycle!.week1);
  });

  it('returns a schedule with rounded main-lift weights', () => {
    const cycle = getCycleById('cycle-01');
    expect(cycle).toBeTruthy();
    const schedule = lmsCycleToSchedule('cycle-01', { squat: 200, bench: 140, dead: 220 });
    expect(schedule.length).toBe(cycle!.week1.length);
    const sets = schedule.flatMap(day => day.exercises.flatMap(ex => ex.sets));
    expect(sets.length).toBeGreaterThan(0);
    expect(sets.every(set => set.weight % 2.5 === 0)).toBe(true);
  });

  it('returns the selected original week, including every source percentage row', () => {
    const cycle = getCycleById('cycle-01')!;
    const schedule = lmsCycleToSchedule('cycle-01', { squat: 200, bench: 140, dead: 220 }, {}, 2);
    const source = cycle.weeks![1];
    expect(schedule).toHaveLength(source.length);
    expect(schedule[0].exercises[0].sets.map(({ pct, reps, sets }) => ({ pct, reps, sets })))
      .toEqual(source[0].exercises[0].sets);
  });
});
