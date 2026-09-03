import { describe, it, expect } from 'vitest';
import { scoreArm } from '../arm-scoring.engine';

describe('arm-scoring RSS (PRO оверлей)', () => {
  it('0 слабых → 100 ок', () => {
    const s = scoreArm({ weakCount: 0, hasVideo:false, hasVbt:false, hasGripHistory:false });
    expect(s.score).toBe(100);
    expect(s.level).toBe('ok');
  });
  it('1 слабая → ~88 warn', () => {
    const s = scoreArm({ weakCount: 1 });
    expect(s.score).toBeGreaterThan(80);
    expect(s.score).toBeLessThan(100);
  });
  it('3 слабые → ниже 80', () => {
    const s = scoreArm({ weakCount: 3 });
    expect(s.score).toBeLessThan(80);
  });
  it('асимметрия ≥12 cap 49', () => {
    const s = scoreArm({ weakCount: 0, asymmetryPct: 13 });
    expect(s.score).toBeLessThanOrEqual(49);
    expect(s.floors.length).toBeGreaterThan(0);
  });
  it('tendon >22 cap 49', () => {
    const s = scoreArm({ weakCount:0, tendonSets:24, tendonLimit:16 });
    expect(s.score).toBeLessThanOrEqual(49);
  });
  it('verification 0/0.35/0.70/1.0', () => {
    expect(scoreArm({weakCount:0}).verification).toBe(0);
    expect(scoreArm({weakCount:0, hasVideo:true}).verification).toBe(0.35);
    expect(scoreArm({weakCount:0, hasVideo:true, hasVbt:true}).verification).toBe(0.70);
    expect(scoreArm({weakCount:0, hasVideo:true, hasVbt:true, hasGripHistory:true}).verification).toBe(1);
  });
  it('side >9 cap 49', () => {
    const s = scoreArm({ weakCount:0, sideSetsWeek1:10 });
    expect(s.score).toBeLessThanOrEqual(49);
  });
  it('grip-ветка: bench beginner + 2 точки → warn', () => {
    const s = scoreArm({ weakCount: 2, gripLevel: 'beginner' });
    expect(s.findings.some(f => f.text.includes('Bench'))).toBe(true);
    expect(s.score).toBeLessThan(88);
  });
  it('grip-ветка молчит при advanced и при 1 точке', () => {
    expect(scoreArm({ weakCount: 2, gripLevel: 'advanced' }).findings.some(f => f.text.includes('Bench'))).toBe(false);
    expect(scoreArm({ weakCount: 1, gripLevel: 'beginner' }).findings.some(f => f.text.includes('Bench'))).toBe(false);
  });
});
