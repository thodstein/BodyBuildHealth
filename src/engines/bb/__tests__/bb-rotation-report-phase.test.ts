import { describe, expect, it } from 'vitest';
import { analyzeBBRotation } from '../bb-rotation.engine';

describe('BB rotation report phase metadata', () => {
  it('exports phase on actionable rotation diagnostics', () => {
    const plan: any = { pattern: {}, rationale: [], rotationMuscleVolume: {}, weeks: [
      { week: 1, phase: 'accumulation', sessions: [{ day: 1, exercises: [{ muscle: 'chest', name: 'A', role: 'primary', character: 'тяж', sets: 2, workSets: [{ reps: 8, rir: 2, weight: 80 }] }] }] },
      { week: 2, phase: 'accumulation', sessions: [{ day: 1, exercises: [{ muscle: 'chest', name: 'B', role: 'primary', character: 'тяж', sets: 2, workSets: [{ reps: 8, rir: 2, weight: 80 }] }] }] },
    ] };
    const issue = analyzeBBRotation(plan).issues.find(item => item.code === 'primary_changed');
    expect(issue?.phase).toBe('accumulation');
  });
});
