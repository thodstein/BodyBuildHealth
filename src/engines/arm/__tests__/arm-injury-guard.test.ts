import { describe, it, expect } from 'vitest';
import { isWristStressExercise, isSidePressureExercise, checkHumerusGuard, checkWristBalance } from '../arm-injury-guard.engine';

describe('arm-injury-guard', () => {
  it('isWristStress', () => {
    expect(isWristStressExercise({ muscle:'wrist_flexors' })).toBe(true);
    expect(isWristStressExercise({ substitutionGroup:'pronation' })).toBe(true);
    expect(isWristStressExercise({ muscle:'grip_support' })).toBe(false);
  });
  it('isSidePressure', () => {
    expect(isSidePressureExercise({ muscle:'side_pressure' })).toBe(true);
    expect(isSidePressureExercise({ substitutionGroup:'side_press' })).toBe(true);
    expect(isSidePressureExercise({ muscle:'wrist_flexors' })).toBe(false);
  });
  it('humerus guard: >6 первые 4 нед', () => {
    const plan: any = { weeks: [{ week:1, sessions:[{ exercises:[{ muscle:'side_pressure', sets:8 }] }] }] };
    expect(checkHumerusGuard(plan).length).toBeGreaterThan(0);
  });
  it('humerus guard: progression >10%', () => {
    const plan: any = { weeks: [
      { week:1, sessions:[{ exercises:[{ muscle:'side_pressure', sets:4 }] }] },
      { week:2, sessions:[{ exercises:[{ muscle:'side_pressure', sets:6 }] }] },
    ]};
    // 4→6 = +50% >10%
    expect(checkHumerusGuard(plan).some(s=>s.includes('прогрессия'))).toBe(true);
  });
  it('humerus guard: ok 4/4', () => {
    const plan: any = { weeks: [{ week:1, sessions:[{ exercises:[{ muscle:'side_pressure', sets:3 }] }] }] };
    expect(checkHumerusGuard(plan).length).toBe(0);
  });
  it('wrist balance pron/sup >1.5', () => {
    const plan: any = { weeks: [{ week:1, sessions:[{ exercises:[{ muscle:'pronators', sets:6 },{ muscle:'supinators', sets:2 }] }] }] };
    expect(checkWristBalance(plan).length).toBeGreaterThan(0);
  });
  it('wrist balance ok', () => {
    const plan: any = { weeks: [{ week:1, sessions:[{ exercises:[{ muscle:'pronators', sets:4 },{ muscle:'supinators', sets:4 }] }] }] };
    expect(checkWristBalance(plan).length).toBe(0);
  });
});
