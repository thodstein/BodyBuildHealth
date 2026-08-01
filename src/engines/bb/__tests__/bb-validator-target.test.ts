import { describe, expect, it } from 'vitest';
import { validateBBPlan } from '../bb-validator.engine';

describe('BB target/session validator diagnostics', () => {
  it('explains MEV deficit without blocking the plan', () => {
    const result = validateBBPlan({
      pattern: {} as any, rationale: [], rotationMuscleVolume: {},
      volumeTargets: { chest: { muscle: 'chest', frequency: 2, mev: 8, mav: 12, mrv: 16, targetSets: 10, minSetsPerSession: 2, maxSetsPerSession: 4, rationale: [] } },
      weeklyVolume: { 1: { chest: { directSets: 2, effectiveSets: 2, fatigueWeightedSets: 2 } } },
      weeks: [{ week: 1, sessions: [{ day: 1, sessionTag: 'Chest', character: 'тяж', exercises: [] }] }],
    } as any, { level: 'intermediate' });
    expect(result.valid).toBe(true);
    expect(result.issues.some(issue => issue.code === 'target_volume_deficit')).toBe(true);
  });
});
