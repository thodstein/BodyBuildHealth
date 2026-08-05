import { describe, expect, it } from 'vitest';
import { competitionAttempts } from '../competition-attempts';

describe('competitionAttempts', () => {
  it('creates opener, second and third attempts from PM', () => {
    expect(competitionAttempts(200)).toMatchObject({
      opener: 175, second: 185, third: 200,
      openerRange: [170, 180], secondRange: [180, 190], thirdRange: [190, 210],
    });
  });

  it('keeps attempt ranges inside the requested percentages', () => {
    const attempts = competitionAttempts(180);
    expect(attempts.openerRange[0]).toBe(152.5);
    expect(attempts.openerRange[1]).toBe(162.5);
    expect(attempts.secondRange[0]).toBe(162.5);
    expect(attempts.secondRange[1]).toBe(170);
    expect(attempts.thirdRange[0]).toBe(170);
    expect(attempts.thirdRange[1]).toBe(190);
  });
});
