import { describe, expect, it } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import { SPLIT_PATTERNS } from '../bb-split-patterns';

const workMax = { chest: 100, back: 120, shoulders: 60, arms: 50, quads: 140, hamstrings: 100, glutes: 140, calves: 80, abs: 60, traps: 80, forearms: 40 };

describe('BB exercise-count benchmark', () => {
  it('keeps natural plans within session caps across every split', () => {
    for (const pattern of SPLIT_PATTERNS) {
      const plan = buildBBPlan({ patternId: pattern.id, level: 'intermediate', goal: 'mass', weeks: 4, workMax });
      for (const week of plan.weeks) for (const session of week.sessions) {
        expect(session.exercises.length, pattern.id).toBeLessThanOrEqual(10);
        expect(session.exercises.reduce((sum, exercise) => sum + exercise.sets, 0), pattern.id).toBeLessThanOrEqual(24);
      }
    }
  }, 30000);

  it('allows enhanced detail only where PED volume is explicitly requested', () => {
    const natural = buildBBPlan({ patternId: 'upper_lower_4', level: 'intermediate', goal: 'mass', weeks: 4, workMax });
    const enhanced = buildBBPlan({ patternId: 'upper_lower_4', level: 'enhanced', goal: 'mass', weeks: 4, workMax, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' });
    const naturalMax = Math.max(...natural.weeks.flatMap(week => week.sessions.map(session => session.exercises.length)));
    const enhancedMax = Math.max(...enhanced.weeks.flatMap(week => week.sessions.map(session => session.exercises.length)));
    expect(enhancedMax).toBeGreaterThanOrEqual(naturalMax);
    expect(enhancedMax).toBeLessThanOrEqual(10);
  }, 30000);
});
