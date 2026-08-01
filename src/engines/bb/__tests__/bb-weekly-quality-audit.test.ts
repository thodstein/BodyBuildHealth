import { describe, expect, it } from 'vitest';
import { validateBBPlan } from '../bb-validator.engine';
import { analyzeBBBalance } from '../bb-balance.engine';

describe('BB weekly quality audit', () => {
  it('catches MRV overflow on a non-peak week', () => {
    const exercise = { muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 30, repsRange: [6, 8], rir: 2, workSets: Array.from({ length: 30 }, () => ({ reps: 8, rir: 2, weight: 80 })) };
    const result = validateBBPlan({ pattern: {} as any, rationale: [], rotationMuscleVolume: {}, weeks: [
      { week: 1, phase: 'accumulation', sessions: [{ day: 1, exercises: [exercise] }] },
      { week: 2, phase: 'peaking', sessions: [{ day: 1, exercises: [exercise] }] },
    ] } as any, { level: 'beginner' });
    expect(result.issues.filter(issue => issue.code === 'effective_mrv_overflow').length).toBeGreaterThan(0);
    expect(result.issues.some(issue => issue.week === 1)).toBe(true);
  });

  it('uses working weeks for balance instead of deload-only volume', () => {
    const make = (phase: string, name: string) => ({ week: phase === 'deload' ? 2 : 1, phase, sessions: [{ day: 1, exercises: [{ muscle: 'chest', name, role: 'primary', character: 'тяж', sets: 2, workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }] }] }] });
    const report = analyzeBBBalance({ pattern: {} as any, rationale: [], rotationMuscleVolume: {}, weeks: [make('accumulation', 'Жим лёжа'), make('deload', 'Тяга горизонтального блока')] } as any);
    expect(report.peakWork?.press).toBe(2);
    expect(report.peakWork?.pull).toBe(0);
  });
});
