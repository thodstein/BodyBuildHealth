import { describe, it, expect } from 'vitest';
import { attemptBaseDivergence, TA_BASE_RMSE_SNATCH, SNATCH_PREDICTORS, CJ_PREDICTORS } from '../strength-sport-ta-strength-base.engine';

describe('ta-strength-base (W7)', () => {
  it('внутри RMSE — не флаг', () => {
    const r = attemptBaseDivergence(100, 102, 'snatch');
    expect(r.divergent).toBe(false);
    expect(r.diffKg).toBe(2);
    expect(TA_BASE_RMSE_SNATCH).toBe(3);
  });
  it('вне RMSE — флаг с направлением', () => {
    const hi = attemptBaseDivergence(100, 110, 'snatch');
    expect(hi.divergent).toBe(true);
    expect(hi.text).toContain('выше модели');
    const lo = attemptBaseDivergence(110, 100, 'cj');
    expect(lo.divergent).toBe(true);
    expect(lo.text).toContain('запас');
  });
  it('пусто — не флаг без throw', () => {
    expect(attemptBaseDivergence(null, 100).divergent).toBe(false);
    expect(attemptBaseDivergence(100, NaN).divergent).toBe(false);
    expect(attemptBaseDivergence(-5, 100).divergent).toBe(false);
  });
  it('предикторы для контекста тренера', () => {
    expect(SNATCH_PREDICTORS[0]).toContain('тяга');
    expect(CJ_PREDICTORS[1]).toContain('фронт');
  });
});
