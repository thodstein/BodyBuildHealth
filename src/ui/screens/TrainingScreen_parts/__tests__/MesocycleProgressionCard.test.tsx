import { describe, expect, it } from 'vitest';
import { LMS_CYCLES, normalizeCycleDirection } from '../../../../data/lms-cycles/lms-cycle-index';
import { buildLMSPlan, originalCycleWeeks } from '../../../../engines/lms/lms-builder.engine';
import { sourceWeekColor, summarizeSourceCycleWeeks } from '../MesocycleProgressionCard';

describe('PL original mesocycle calendar', () => {
  it('uses the explicit source week count for every PL cycle', () => {
    const plCycles = LMS_CYCLES.filter(cycle => normalizeCycleDirection(cycle.meta.direction) !== 'bodybuilding');

    expect(plCycles.length).toBeGreaterThan(0);
    for (const cycle of plCycles) {
      const expected = cycle.weeks && cycle.weeks.length > 0 ? cycle.weeks.length : cycle.meta.weeks;
      expect(originalCycleWeeks(cycle), cycle.meta.id).toBe(expected);
    }
  });

  it('summarizes source sets and percentages without a generated phase curve', () => {
    const weeks = [[
      { exercises: [{ name: 'Присед', group: 'ПР', coef: 1, mnosz: 1, sets: [{ pct: 0.6, reps: 5, sets: 3, rir: 2 }] }] },
    ]];

    expect(summarizeSourceCycleWeeks(weeks)).toEqual([{
      week: 1,
      volumeSets: 3,
      intensityPct: 0.6,
      rir: 2,
      phase: 'base',
      phaseOrigin: 'inferred',
    }]);
  });

  it('keeps different original weeks different in the calendar data', () => {
    const cycle = LMS_CYCLES.find(candidate => candidate.weeks && candidate.weeks.length > 1);
    expect(cycle?.weeks).toBeDefined();
    const source = summarizeSourceCycleWeeks(cycle!.weeks!);

    expect(source).toHaveLength(cycle!.weeks!.length);
    expect(source.some((week, index) => index > 0 && week.volumeSets !== source[0].volumeSets)).toBe(true);
  });

  it('assigns calendar colors from the original weekly load, not generic phases', () => {
    const weeks = [
      { week: 1, volumeSets: 12, intensityPct: 0.45, rir: 3 },
      { week: 2, volumeSets: 20, intensityPct: 0.75, rir: 2 },
      { week: 3, volumeSets: 16, intensityPct: 0.9, rir: 1 },
    ];

    expect(new Set(weeks.map(week => sourceWeekColor(week, weeks))).size).toBe(3);
  });

  it('marks a real source volume drop as deload', () => {
    const weeks = [
      [{ exercises: [{ name: 'Присед', group: 'ПР', coef: 1, mnosz: 1, sets: [{ pct: 0.65, reps: 5, sets: 10 }] }] }],
      [{ exercises: [{ name: 'Присед', group: 'ПР', coef: 1, mnosz: 1, sets: [{ pct: 0.55, reps: 5, sets: 5 }] }] }],
    ];

    expect(summarizeSourceCycleWeeks(weeks)[1].phase).toBe('deload');
  });

  it('prefers explicit source phase blocks over inferred load phases', () => {
    const weeks = [
      [{ exercises: [{ name: 'Присед', group: 'ПР', coef: 1, mnosz: 1, sets: [{ pct: 0.65, reps: 5, sets: 10 }] }] }],
      [{ exercises: [{ name: 'Присед', group: 'ПР', coef: 1, mnosz: 1, sets: [{ pct: 0.55, reps: 5, sets: 5 }] }] }],
    ];

    expect(summarizeSourceCycleWeeks(weeks, 'strength', [{ weekStart: 1, weekEnd: 2, phase: 'peak', title: 'Интенсификация' }]))
      .toEqual([
        expect.objectContaining({ phase: 'peak', phaseOrigin: 'original' }),
        expect.objectContaining({ phase: 'peak', phaseOrigin: 'original' }),
      ]);
  });

  it('preserves the source layout for every PL cycle when building the program', () => {
    const plCycles = LMS_CYCLES.filter(cycle => normalizeCycleDirection(cycle.meta.direction) !== 'bodybuilding');

    for (const cycle of plCycles) {
      const sourceWeeks = cycle.weeks && cycle.weeks.length > 0
        ? cycle.weeks
        : Array.from({ length: originalCycleWeeks(cycle) }, () => cycle.week1);
      const plan = buildLMSPlan({
        template: cycle,
        pmMap: { Присед: 150, 'Жим лежа': 110, 'Становая тяга': 180 },
        fallbackPm: 80,
        faithful: true,
        progressionEnabled: false,
        weeksOverride: sourceWeeks.length,
      });

      expect(plan.weeks, cycle.meta.id).toHaveLength(sourceWeeks.length);
      expect(plan.weeks.map(week => week.sourcePhase)).toEqual(
        summarizeSourceCycleWeeks(sourceWeeks, cycle.meta.period).map(week => week.phase),
      );
      expect(plan.weeks.every(week => week.sourcePhaseOrigin === 'inferred')).toBe(true);
      for (let weekIndex = 0; weekIndex < sourceWeeks.length; weekIndex += 1) {
        const sourceWeek = sourceWeeks[weekIndex];
        const planWeek = plan.weeks[weekIndex];
        expect(planWeek.days, `${cycle.meta.id} week ${weekIndex + 1}`).toHaveLength(sourceWeek.length);
        for (let dayIndex = 0; dayIndex < sourceWeek.length; dayIndex += 1) {
          const sourceDay = sourceWeek[dayIndex];
          const planDay = planWeek.days[dayIndex];
          expect(planDay.exercises, `${cycle.meta.id} week ${weekIndex + 1} day ${dayIndex + 1}`).toHaveLength(sourceDay.exercises.length);
          for (let exerciseIndex = 0; exerciseIndex < sourceDay.exercises.length; exerciseIndex += 1) {
            const sourceExercise = sourceDay.exercises[exerciseIndex];
            const planExercise = planDay.exercises[exerciseIndex];
            expect(planExercise.name).toBe(sourceExercise.name);
            expect(planExercise.workSets.map(set => ({ pct: set.pct, reps: set.reps, sets: set.sets })))
              .toEqual(sourceExercise.sets.map(set => ({ pct: set.pct, reps: set.reps, sets: set.sets })));
          }
        }
      }
    }
  });
});
