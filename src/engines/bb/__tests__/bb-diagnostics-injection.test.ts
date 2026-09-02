import { describe, it, expect } from 'vitest';
import { injectBBWeakPoints, computeBudgetBBFallback } from '../bb-diagnostics-injection.engine';
import type { BBPlan } from '../bb-builder.engine';

function mockPlan(setsPerWeek = 80, level = 'intermediate'): BBPlan {
  return {
    pattern: { id: 'test', name: 'Test', sessionsPerRotation: 4 } as any,
    weeks: [
      { week: 1, sessions: [
        { day: 1, weekOffset: 0, character: 'heavy' as any, exercises: [{ muscle: 'chest', name: 'Жим штанги лёжа', sets: 4, role: 'primary' as const, exerciseName: 'bench_bar', workSets: [{ reps: 8, rir: 2, weight: 80 } as any, { reps: 8, rir: 2, weight: 80 } as any, { reps: 8, rir: 2, weight: 80 } as any, { reps: 8, rir: 2, weight: 80 } as any] } as any] } as any,
        { day: 2, weekOffset: 1, character: 'pump' as any, exercises: [{ muscle: 'back', name: 'Тяга штанги', sets: 4, role: 'primary' as const, exerciseName: 'row_bar', workSets: [{ reps: 10, rir: 2, weight: 60 } as any, { reps: 10, rir: 2, weight: 60 } as any, { reps: 10, rir: 2, weight: 60 } as any, { reps: 10, rir: 2, weight: 60 } as any] } as any] } as any,
      ] } as any,
    ],
    rationale: [],
    level,
  } as any;
}

describe('bb-diagnostics-injection', () => {
  it('injects delt_mid correction 3×10', () => {
    const plan = mockPlan(40, 'intermediate');
    const res = injectBBWeakPoints(plan, ['delt_mid']);
    expect(res.injected).toBe(1);
    expect(res.plan.weeks[0].sessions.some(s => s.exercises.some(e => e.name.toLowerCase().includes('мах') || e.name.toLowerCase().includes('lateral')))).toBe(true);
  });
  it('dedup prevents duplicate', () => {
    const plan = mockPlan();
    // add lateral_raise already
    (plan.weeks[0].sessions[0] as any).exercises.push({ muscle: 'shoulders', name: 'Махи гантелями в стороны', sets: 3, exerciseName: 'lateral_raise', workSets: [] } as any);
    const res = injectBBWeakPoints(plan, ['delt_mid']);
    expect(res.skippedDup).toBe(1);
    expect(res.injected).toBe(0);
  });
  it('budget cap skips when over', () => {
    const plan = mockPlan(200, 'beginner'); // budget for beginner ~110, current 8 sets +3 > budget? Actually weeklySets is 8, not 200. Need to set high current sets.
    // fake large weeklySets by adding many exercises
    const bigPlan = mockPlan();
    // fill to near budget
    for (let i = 0; i < 10; i++) (bigPlan.weeks[0].sessions[0] as any).exercises.push({ muscle: 'chest', name: `Ex${i}`, sets: 5, exerciseName: `ex${i}`, workSets: [] } as any);
    const res = injectBBWeakPoints(bigPlan, ['chest_upper'], { budget: 10 });
    expect(res.skippedBudget).toBe(1);
  });
  it('handles 2 zones same muscle', () => {
    const plan = mockPlan();
    const res = injectBBWeakPoints(plan, ['delt_mid', 'delt_rear']);
    expect(res.injected).toBe(2);
  });
  it('budget fallback level', () => {
    expect(computeBudgetBBFallback('beginner')).toBeGreaterThan(0);
    expect(computeBudgetBBFallback('enhanced')).toBeGreaterThan(computeBudgetBBFallback('beginner'));
  });
});
