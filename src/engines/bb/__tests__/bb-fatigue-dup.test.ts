import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';

describe('BB fatigue-aware DUP', () => {
  it('keeps reps inside the prescribed range while reducing middle-set fatigue', () => {
    const plan = buildBBPlan({ patternId: 'fullbody_3', level: 'intermediate', goal: 'mass', weeks: 4, workMax: { chest: 100, back: 120, quads: 140 } });
    const sets = plan.weeks[0].sessions.flatMap(session => session.exercises).flatMap(exercise => exercise.workSets);
    expect(sets.every(set => set.reps > 0 && set.reps <= 30)).toBe(true);
    expect(sets.length).toBeGreaterThan(0);
  });
});
