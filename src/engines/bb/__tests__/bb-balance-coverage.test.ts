import { describe, expect, it } from 'vitest';
import { analyzeBBBalance } from '../bb-balance.engine';

describe('BB per-muscle pattern and stretch coverage', () => {
  it('reports missing positions and dominant single pattern', () => {
    const exercise = { muscle: 'hamstrings', name: 'Сгибания ног сидя', role: 'accessory', character: 'памп', sets: 4, workSets: [{ reps: 12, rir: 3, weight: 20 }, { reps: 12, rir: 3, weight: 20 }, { reps: 12, rir: 3, weight: 20 }, { reps: 12, rir: 3, weight: 20 }] };
    const report = analyzeBBBalance({ pattern: {} as any, weeks: [{ week: 1, sessions: [{ day: 1, exercises: [exercise] }] }], rationale: [], rotationMuscleVolume: {} } as any);
    expect(report.byMuscle.hamstrings.lengthened).toBeGreaterThanOrEqual(0);
    expect(report.byMuscle.hamstrings.midRange + report.byMuscle.hamstrings.shortened).toBeGreaterThanOrEqual(0);
    expect(report.issues.some(issue => issue.includes('hamstrings'))).toBe(true);
  });
});
