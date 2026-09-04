import { describe, it, expect } from 'vitest';
import { planTAAttempts, roundDownKg } from '../strength-sport-ta-attempts.engine';

describe('TA attempts E12', () => {
  it('90/96/102 от 100', () => {
    const p = planTAAttempts({ declaredMaxKg: 100 });
    expect(p?.attempts).toEqual([90, 96, 102]);
    expect(p?.readinessCut).toBe(false);
  });
  it('conservative 0.97', () => {
    const p = planTAAttempts({ declaredMaxKg: 100, strategy: 'conservative' });
    expect(p?.attempts).toEqual([87, 93, 98]);
  });
  it('readiness: просадка 0.2 → −2.5кг', () => {
    const p = planTAAttempts({ declaredMaxKg: 100, peakVelStandard: 1.9, peakVelToday: 1.7 });
    expect(p?.readinessCut).toBe(true);
    expect(p?.attempts).toEqual([87, 93, 99]); // (100−2.5)×0.9=87.75→87, ×0.96=93.6→93, ×1.02=99.45→99
    expect(p?.readinessNote).toContain('0.2');
  });
  it('просадка 0.1 — без среза', () => {
    const p = planTAAttempts({ declaredMaxKg: 100, peakVelStandard: 1.9, peakVelToday: 1.8 });
    expect(p?.readinessCut).toBe(false);
    expect(p?.attempts).toEqual([90, 96, 102]);
  });
  it('нет заявки → null; округление вниз', () => {
    expect(planTAAttempts({})).toBeNull();
    expect(planTAAttempts({ declaredMaxKg: -5 })).toBeNull();
    expect(roundDownKg(87.9)).toBe(87);
  });
});
