import { describe, expect, it } from 'vitest';
import { aggregateBBVolume, exerciseVolumeContributions } from '../bb-volume.engine';

describe('BB fatigue-weighted volume parity', () => {
  it('weights low-RIR direct and indirect work consistently', () => {
    const exercise = { name: 'Жим лёжа', muscle: 'chest', sets: 4, rir: 0, type: 'compound' };
    const contributions = exerciseVolumeContributions(exercise);
    const chest = contributions.find(item => item.muscle === 'chest');
    expect(chest?.fatigueWeightedSets).toBe(5.6);

    const totals = aggregateBBVolume([{ exercises: [exercise] }]);
    expect(totals.chest.fatigueWeightedSets).toBe(chest?.fatigueWeightedSets);
    expect(totals.triceps.fatigueWeightedSets).toBe(2.8);
  });
});
