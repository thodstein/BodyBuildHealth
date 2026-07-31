import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';

describe('BB lower-body angle diversity', () => {
  it('keeps lower-body generation valid with expanded hamstring/glute classes', () => {
    const plan = buildBBPlan({ patternId: 'upper_lower_4', level: 'advanced', goal: 'mass', weeks: 4, workMax: { quads: 140, hamstrings: 100, glutes: 140, calves: 80 } });
    const lower = plan.weeks.flatMap(week => week.sessions).filter(session => /lower|legs/i.test(session.sessionTag || ''));
    expect(lower.length).toBeGreaterThan(0);
    expect(lower.flatMap(session => session.exercises).every(exercise => exercise.sets >= 1 && exercise.workSets.length === exercise.sets)).toBe(true);
  });
});
