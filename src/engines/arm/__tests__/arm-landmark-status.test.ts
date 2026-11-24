import { describe, expect, it } from 'vitest';
import { armLandmarkStatus } from '../arm-volume-landmarks.engine';
import { checkVolumeStatus, type MuscleVolumeLandmarks } from '../../volume-landmarks.engine';

describe('armLandmarkStatus canonical parity', () => {
  const lm: MuscleVolumeLandmarks = { mev: 5, mav: 7, mrv: 9 };
  const values = [0, 4.9, 5, 6, 7, 7.1, 9, 9.1, 12];

  it('matches checkVolumeStatus for every boundary value', () => {
    for (const sets of values) {
      expect(armLandmarkStatus(sets, lm)).toBe(checkVolumeStatus(sets, lm));
    }
  });

  it('treats exactly MRV as approaching_mrv', () => {
    expect(armLandmarkStatus(9, lm)).toBe('approaching_mrv');
    expect(armLandmarkStatus(9.1, lm)).toBe('exceeding_mrv');
  });
});
