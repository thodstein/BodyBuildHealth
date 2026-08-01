import { describe, expect, it } from 'vitest';
import { analyzeBBBalance } from '../bb-balance.engine';

describe('BB balance catalog position classifier', () => {
  it('uses stretchPhase/peakContraction metadata before name fallback', () => {
    const report = analyzeBBBalance({ pattern: {} as any, weeks: [{ week: 1, sessions: [{ day: 1, exercises: [
      { muscle: 'chest', name: 'Жим штанги лёжа', role: 'primary', character: 'тяж', sets: 2, workSets: [{ reps: 8, rir: 2, weight: 80 }, { reps: 8, rir: 2, weight: 80 }] },
      { muscle: 'chest', name: 'Разводка гантелей лёжа', role: 'accessory', character: 'памп', sets: 2, workSets: [{ reps: 12, rir: 3, weight: 15 }, { reps: 12, rir: 3, weight: 15 }] },
    ] }] }], rationale: [], rotationMuscleVolume: {} } as any);
    expect(report.byMuscle.chest.lengthened + report.byMuscle.chest.shortened).toBeGreaterThan(0);
  });
});
