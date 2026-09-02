import { describe, it, expect } from 'vitest';
import { bodyCompVolumeFactor, bodyCompStrategyNote, defaultTargetBodyFat } from '../bb-bodycomp.engine';

describe('bb-bodycomp', () => {
  it('mass/recomp не-modulated без цели или не cut', () => {
    expect(bodyCompVolumeFactor(20, 10, 'mass')).toBe(1.0);
    expect(bodyCompVolumeFactor(undefined, 10, 'cut')).toBe(1.0);
    expect(bodyCompVolumeFactor(20, undefined, 'cut')).toBe(1.0);
  });

  it('cut: далеко от цели → 0.95, близко → 1.0, на цели → 1.0', () => {
    expect(bodyCompVolumeFactor(20, 10, 'cut')).toBe(0.95); // осталось 10%
    expect(bodyCompVolumeFactor(12, 10, 'cut')).toBe(1.0);  // осталось 2%
    expect(bodyCompVolumeFactor(10, 10, 'cut')).toBe(1.0);  // на цели
    expect(bodyCompVolumeFactor(14, 10, 'cut')).toBe(0.97); // осталось 4%
  });

  it('strategyNote отражает дистанцию', () => {
    const n = bodyCompStrategyNote(20, 10, 'cut');
    expect(n).toContain('далеко');
    expect(bodyCompStrategyNote(20, 10, 'mass')).toBeNull();
    expect(bodyCompStrategyNote(undefined, 10, 'cut')).toBeNull();
  });

  it('defaultTargetBodyFat по полу', () => {
    expect(defaultTargetBodyFat('male', 'cut')).toBe(10);
    expect(defaultTargetBodyFat('female', 'cut')).toBe(18);
    expect(defaultTargetBodyFat('male', 'mass')).toBeUndefined();
  });
});
