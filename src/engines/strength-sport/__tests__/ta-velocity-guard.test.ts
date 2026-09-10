import { describe, it, expect } from 'vitest';
import { isSystemVelocitySuspect, guardVbtPair, BARBELL_VELOCITY_UNIT } from '../strength-sport-ta-velocity-guard.engine';

describe('ta-velocity-guard (W3)', () => {
  it('нормальные barbell-скорости — не suspect', () => {
    expect(isSystemVelocitySuspect(1.85, 'snatch').suspect).toBe(false);
    expect(isSystemVelocitySuspect(1.5, 'clean').suspect).toBe(false);
    expect(isSystemVelocitySuspect(2.0, 'jerk').suspect).toBe(false);
  });
  it('system-скорость >3.0 — suspect с причиной', () => {
    const r = isSystemVelocitySuspect(3.4, 'snatch');
    expect(r.suspect).toBe(true);
    expect(r.reason).toContain('system');
  });
  it('выше потолка лифта и мусор — suspect; пусто — не suspect', () => {
    expect(isSystemVelocitySuspect(2.6, 'clean').suspect).toBe(true);
    expect(isSystemVelocitySuspect(0.1, 'snatch').suspect).toBe(true);
    expect(isSystemVelocitySuspect(null, 'snatch').suspect).toBe(false);
    expect(isSystemVelocitySuspect(NaN, 'snatch').suspect).toBe(false);
    expect(guardVbtPair(1.9, 1.55, 'snatch').suspect).toBe(false);
    expect(guardVbtPair(3.5, 1.55, 'snatch').suspect).toBe(true);
    expect(BARBELL_VELOCITY_UNIT).toContain('штанга');
  });
});
