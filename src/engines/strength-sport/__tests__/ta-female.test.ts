import { describe, it, expect } from 'vitest';
import { scoreTA } from '../strength-sport-scoring.engine';
import { TA_VTHRES_NORMS, TA_VTHRES_NORMS_F, taVthresNorms } from '../strength-sport-vbt.engine';

describe('TA female norms E10', () => {
  it('мужская петля — crit-penalty 18 (поведение сохранено)', () => {
    const m = scoreTA({ weakCount: 0, barPathDeviation: 'loop', mobilityFails: 0 });
    expect(m.penalties).toContain(18);
    expect(m.findings.some(x => x.level === 'critical')).toBe(true);
  });
  it('женская петля — warn 10, мягче мужской', () => {
    const m = scoreTA({ weakCount: 0, barPathDeviation: 'loop', mobilityFails: 0 });
    const f = scoreTA({ weakCount: 0, barPathDeviation: 'loop', mobilityFails: 0, sex: 'female' });
    expect(f.penalties).toContain(10);
    expect(f.penalties).not.toContain(18);
    expect(f.findings.some(x => x.level === 'critical')).toBe(false);
    expect(f.findings.some(x => x.text.includes('Hiskia'))).toBe(true);
    expect(f.score).toBeGreaterThan(m.score);
  });
  it('женщина без loop — поведение как раньше', () => {
    const f = scoreTA({ weakCount: 0, mobilityFails: 0, sex: 'female' });
    expect(f.score).toBe(100);
    expect(f.level).toBe('ok');
  });
  it('нормы F ниже M', () => {
    expect(TA_VTHRES_NORMS_F.snatch.optimal).toBeLessThan(TA_VTHRES_NORMS.snatch.optimal);
    expect(TA_VTHRES_NORMS_F.clean.max).toBeLessThanOrEqual(1.6);
    expect(taVthresNorms('female')).toBe(TA_VTHRES_NORMS_F);
    expect(taVthresNorms(null)).toBe(TA_VTHRES_NORMS);
    expect(taVthresNorms('male')).toBe(TA_VTHRES_NORMS);
  });
});
