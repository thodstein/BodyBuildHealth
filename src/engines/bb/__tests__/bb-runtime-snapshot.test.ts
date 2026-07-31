import { describe, expect, it } from 'vitest';
import { finalizeBBPlan } from '../bb-finalize.engine';

function makePlan() {
  return {
    pattern: {} as any,
    rationale: [],
    safetyConstraints: { equipment: ['machine'] },
    weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж' as const, sessionTag: 'Chest', exercises: [{
      muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary' as const, character: 'тяж' as const,
      sets: 2, repsRange: [6, 8] as [number, number], rir: 2,
      workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }],
    }] }] }],
  };
}

describe('BB runtime snapshot boundary', () => {
  it('rebuilds validation and derived fields from the edited snapshot', () => {
    const result = finalizeBBPlan(makePlan() as any, {
      reorder: false,
      phaseSafety: true,
      level: 'intermediate',
      equipment: ['machine'],
    });

    expect(result.validation).toBeTruthy();
    expect(result.validation?.valid).toBe(false);
    expect(result.weeklyVolume?.[1]?.chest.directSets).toBe(2);
    expect(result.fatigueReport?.[0].sessions[0].exerciseCount).toBe(1);
    expect(result.report?.validationValid).toBe(false);
  });
});
