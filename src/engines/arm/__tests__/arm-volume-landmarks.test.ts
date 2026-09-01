import { describe, it, expect } from 'vitest';
import { ARM_VOLUME_LANDMARKS_DB, getArmLandmarks, getArmLandmarksForRotation, isTendonMuscle } from '../arm-volume-landmarks.engine';

describe('arm-volume-landmarks', () => {
  it('MEV<MAV<MRV для всех мышц и уровней', () => {
    for (const lvl of ['beginner','intermediate','advanced','enhanced'] as const) {
      for (const mus of Object.keys(ARM_VOLUME_LANDMARKS_DB[lvl])) {
        const lm = ARM_VOLUME_LANDMARKS_DB[lvl][mus];
        expect(lm.mev, `${lvl}/${mus} mev`).toBeLessThan(lm.mav);
        expect(lm.mav, `${lvl}/${mus} mav`).toBeLessThan(lm.mrv);
      }
    }
  });
  it('tendonCap: wrist/pronator — tendon', () => {
    expect(isTendonMuscle('wrist_flexors')).toBe(true);
    expect(isTendonMuscle('pronators')).toBe(true);
    expect(isTendonMuscle('brachialis')).toBe(false);
    expect(isTendonMuscle('grip_support')).toBe(false);
  });
  it('side_pressure — самый низкий MRV (humerus)', () => {
    const side = getArmLandmarks('intermediate','side_pressure');
    const back = getArmLandmarks('intermediate','back_pressure');
    expect(side.mrv).toBeLessThan(back.mrv);
  });
  it('rotation scaling: 5 дней > 2 дня', () => {
    const low = getArmLandmarksForRotation('wrist_flexors','intermediate',2);
    const high = getArmLandmarksForRotation('wrist_flexors','intermediate',5);
    expect(high.mrv).toBeGreaterThan(low.mrv);
  });
  it('enhanced > beginner для всех', () => {
    for (const mus of ['wrist_flexors','brachialis','grip_support']) {
      expect(getArmLandmarks('enhanced',mus).mrv).toBeGreaterThan(getArmLandmarks('beginner',mus).mrv);
    }
  });
});
