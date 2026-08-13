import { describe, expect, it } from 'vitest';
import { competitionAttempts, meetAttemptsFor, MEET_STRATEGY_PCT } from '../competition-attempts';

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

describe('meetAttemptsFor (выход на пик как в тапер-калькуляторе)', () => {
  it('агрессивная стратегия: третья попытка 105% от ПМ', () => {
    const a = meetAttemptsFor(200, 'aggressive');
    expect(a.opener).toBe(185);  // 93% → 186 → 185 (до 2.5)
    expect(a.second).toBe(195);  // 97% → 194 → 195
    expect(a.third).toBe(210);   // 105% → 210
    expect(a.target).toBe(210);
  });

  it('сбалансированная: 92/96/102% (дефолт как в калькуляторе)', () => {
    const a = meetAttemptsFor(200);
    expect(a.opener).toBe(185);  // 92% → 184 → 185
    expect(a.second).toBe(192.5); // 96% → 192 → 192.5
    expect(a.third).toBe(205);   // 102% → 204 → 205
  });

  it('консервативная: 90/95.5/100%', () => {
    const a = meetAttemptsFor(200, 'conservative');
    expect(a.opener).toBe(180);
    expect(a.second).toBe(190);  // 95.5% → 191 → 190
    expect(a.third).toBe(200);
  });

  it('округление до ближайших 2.5 кг (шаг блинов)', () => {
    const a = meetAttemptsFor(183.5, 'aggressive');
    expect(a.third).toBe(192.5); // 183.5 × 1.05 = 192.675 → 192.5
  });

  it('MEET_STRATEGY_PCT содержит все три стратегии', () => {
    expect(MEET_STRATEGY_PCT.aggressive.third).toBe(1.05);
    expect(MEET_STRATEGY_PCT.balanced.third).toBe(1.02);
    expect(MEET_STRATEGY_PCT.conservative.third).toBe(1.0);
  });

  it('неизвестная стратегия → сбалансированная', () => {
    const a = meetAttemptsFor(200, 'unknown' as never);
    expect(a.third).toBe(meetAttemptsFor(200, 'balanced').third);
  });
});
