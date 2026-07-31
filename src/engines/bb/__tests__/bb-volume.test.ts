import { describe, expect, it } from 'vitest';
import { aggregateBBVolume, buildBBVolumeTarget, exerciseVolumeContributions, normalizeBBMuscle } from '../bb-volume.engine';

describe('BB volume model', () => {
  it('normalizes granular shoulder keys to the canonical group', () => {
    expect(normalizeBBMuscle('delt_rear')).toBe('shoulders');
    expect(normalizeBBMuscle(' Shoulders ')).toBe('shoulders');
  });

  it('keeps direct sets and adds conservative indirect contribution', () => {
    const contributions = exerciseVolumeContributions({
      name: 'Жим штанги лёжа', muscle: 'chest', type: 'compound', sets: 4,
    });
    expect(contributions[0]).toMatchObject({ muscle: 'chest', directSets: 4, effectiveSets: 4 });
    expect(contributions.find(c => c.muscle === 'triceps')?.effectiveSets).toBe(2);
  });

  it('does not add indirect volume to isolation', () => {
    const contributions = exerciseVolumeContributions({
      name: 'Разгибание рук на блоке', muscle: 'triceps', type: 'isolation', sets: 3,
    });
    expect(contributions).toHaveLength(1);
  });

  it('aggregates direct and effective volume separately', () => {
    const totals = aggregateBBVolume([{ exercises: [
      { name: 'Жим лёжа', muscle: 'chest', type: 'compound', sets: 4 },
      { name: 'Разгибание рук на блоке', muscle: 'triceps', type: 'isolation', sets: 3 },
    ] }]);
    expect(totals.chest.directSets).toBe(4);
    expect(totals.triceps.directSets).toBe(3);
    expect(totals.triceps.effectiveSets).toBe(5);
  });

  it('builds a capped target before exercise selection', () => {
    const target = buildBBVolumeTarget({
      muscle: 'chest', frequency: 2, landmarks: { mev: 8, mav: 14, mrv: 20 },
      volumeGoal: 'mav', weakPoint: true, recoveryMultiplier: 0.8,
    });
    expect(target.targetSets).toBeLessThanOrEqual(16);
    expect(target.targetSets).toBeGreaterThanOrEqual(target.mev);
    expect(target.minSetsPerSession).toBeGreaterThanOrEqual(2);
    expect(target.rationale).toContain('weak-point multiplier ×1.2');
  });
});
