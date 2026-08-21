import { describe, expect, it } from 'vitest';
import { VOLUME_LANDMARKS, getLandmark, optimalFrequency, auditFoundation, HYPERTROPHY_PILLARS } from '../bb-foundation.engine';

describe('BB-foundation — основа бодибилдинга', () => {
  it('5 пилларов гипертрофии определены', () => {
    expect(HYPERTROPHY_PILLARS.length).toBe(5);
    expect(HYPERTROPHY_PILLARS.map(p=>p.id)).toEqual(['tension','stress','damage','progression','recovery']);
  });
  it('landmarks монотонны MEV ≤ MAV ≤ MRV для advanced', () => {
    for (const [m, lm] of Object.entries(VOLUME_LANDMARKS.advanced)) {
      expect(lm.mev, m).toBeLessThanOrEqual(lm.mavLow);
      expect(lm.mavLow, m).toBeLessThanOrEqual(lm.mavHigh);
      expect(lm.mavHigh, m).toBeLessThanOrEqual(lm.mrv);
    }
  });
  it('enhanced > advanced по спине', () => {
    expect(getLandmark('enhanced','back')!.mrv).toBeGreaterThan(getLandmark('advanced','back')!.mrv);
  });
  it('optimalFrequency: beginner 1, intermediate 2', () => {
    expect(optimalFrequency('beginner',0)).toBe(1);
    expect(optimalFrequency('intermediate',2)).toBe(2);
    expect(optimalFrequency('enhanced',8)).toBe(2);
  });
  it('auditFoundation ловит перебор MRV и недобор MEV', () => {
    const a = auditFoundation({ weeklyVolume:{ chest:30 }, frequency:{ chest:2 }, level:'intermediate', heavySets:10, pumpSets:10, recoveryScore:80 });
    expect(a.warnings.some(w=>w.includes('MRV'))).toBe(true);
    const b = auditFoundation({ weeklyVolume:{ chest:4 }, frequency:{ chest:2 }, level:'intermediate', heavySets:10, pumpSets:10, recoveryScore:80 });
    expect(b.warnings.some(w=>w.includes('MEV'))).toBe(true);
  });
  it('auditFoundation recovery <50 даёт warning', () => {
    const r = auditFoundation({ weeklyVolume:{ back:16 }, frequency:{ back:2 }, level:'intermediate', heavySets:8, pumpSets:8, recoveryScore:40 });
    expect(r.recoveryOk).toBe(false);
  });
});
