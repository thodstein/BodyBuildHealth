import { describe, expect, it } from 'vitest';
import { applyPostPhaseProcessing } from '../bb-autocoach.engine';

const makePlan = () => ({
  pattern: {} as any,
  rationale: [],
  weeks: [
    { week: 1, phase: 'accumulation', sessions: [{ day: 1, exercises: [{ muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 3, repsRange: [8, 10], rir: 2, workSets: [{ reps: 8, rir: 2, weight: 80 }] }] }] },
    { week: 2, phase: 'peaking', sessions: [{ day: 1, exercises: [{ muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 3, repsRange: [8, 10], rir: 2, workSets: [{ reps: 8, rir: 2, weight: 80 }] }] }] },
    { week: 3, phase: 'deload', deload: true, sessions: [{ day: 1, exercises: [{ muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 3, repsRange: [8, 10], rir: 2, workSets: [{ reps: 8, rir: 2, weight: 80 }] }] }] },
  ],
});

describe('BB phase source of truth', () => {
  it('uses explicit week phases for every source', () => {
    const result = applyPostPhaseProcessing({ plan: makePlan() as any, totalWeeks: 3, workMax: { chest: 100 }, skipPhaseRedistribution: true });
    expect(result.weeks[1].sessions[0].exercises[0].comment).toContain('Пик');
    expect(result.weeks[2].sessions[0].exercises[0].comment).toContain('Разгрузка');
  });
});
