import { describe, it, expect } from 'vitest';
import { smCondGoalFor, smCondSessionFor, allSMCondSessions } from '../strength-sport-sm-conditioning.engine';

describe('SM PRO v3d: conditioning', () => {
  it('ручной goal приоритетнее', () => {
    expect(smCondGoalFor({ goal: 'aerobic', conditioningFail: true })).toBe('aerobic');
  });
  it('провал medley → lactic', () => {
    expect(smCondGoalFor({ conditioningFail: true })).toBe('lactic');
    expect(smCondGoalFor({ medleyTimeS: 75, medleyCapS: 60 })).toBe('lactic');
  });
  it('декремент MHV >15% → alactic', () => {
    expect(smCondGoalFor({ mhvDecrementPct: 18 })).toBe('alactic');
    expect(smCondGoalFor({ mhvDecrementPct: 10 })).toBe('aerobic');
  });
  it('протоколы Jamieson', () => {
    const a = smCondSessionFor({ goal: 'alactic' });
    expect(a.sets).toBe(8);
    expect(a.rest).toContain('50');
    const l = smCondSessionFor({ goal: 'lactic' });
    expect(l.sets).toBe(5);
    expect(l.work).toContain('60');
    const ae = smCondSessionFor({});
    expect(ae.goal).toBe('aerobic');
    expect(ae.hrZone).toContain('130-150');
  });
  it('все три системы', () => {
    expect(allSMCondSessions().map((s) => s.goal)).toEqual(['alactic', 'lactic', 'aerobic']);
  });
});
