import { describe, expect, it } from 'vitest';
import { velocityAttempts } from '../attempt-calculator.engine';

describe('attempt-calculator', () => {
  it('velocityAttempts: opener < second <= third, velocity 0.37>0.30>MVT', () => {
    const a = velocityAttempts(200, 'squat', 'balanced');
    expect(a.opener.weight).toBeLessThan(a.second.weight);
    expect(a.second.weight).toBeLessThanOrEqual(a.third.weight);
    expect(a.opener.velocity).toBeGreaterThan(a.second.velocity);
    expect(a.third.velocity).toBeGreaterThan(0.2);
  });
});
