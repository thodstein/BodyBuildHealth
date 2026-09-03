import { describe, it, expect } from 'vitest';
import { planAttempts, scorePlatform, platformRotationForWeek, platformWrFor } from '../arm-platform.engine';

describe('arm-platform (эпик J)', () => {
  it('попытки 90/96/102%', () => {
    expect(planAttempts(100)).toEqual([90, 96, 102]);
    expect(planAttempts(0)).toEqual([]);
  });
  it('лучшая + %WR', () => {
    const r = scorePlatform({
      implement: 'rolling_thunder',
      sex: 'male',
      attempts: [
        { attempt: 1, weightKg: 90, success: true },
        { attempt: 2, weightKg: 100, success: true },
        { attempt: 3, weightKg: 110, success: false },
      ],
    });
    expect(r.bestKg).toBe(100);
    expect(r.wrPct).toBeCloseTo((100 / 130.5) * 100, 0);
    expect(r.attemptsUsed).toBe(3);
  });
  it('баранка — подсказка', () => {
    const r = scorePlatform({ implement: 'hub', sex: 'male', attempts: [{ attempt: 1, weightKg: 40, success: false }] });
    expect(r.bestKg).toBe(0);
    expect(r.note).toMatch(/85%/);
  });
  it('ротация support/pinch/crush', () => {
    expect(platformRotationForWeek(1)).toBe('support');
    expect(platformRotationForWeek(2)).toBe('pinch');
    expect(platformRotationForWeek(3)).toBe('crush');
    expect(platformRotationForWeek(4)).toBe('support');
  });
  it('женский WR ниже', () => {
    expect(platformWrFor('rolling_thunder', 'female')).toBe(77.2);
    expect(platformWrFor('rolling_thunder', 'male')).toBe(130.5);
  });
});
