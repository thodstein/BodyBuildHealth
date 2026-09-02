import { describe, expect, it } from 'vitest';
import { planFrequency } from '../frequency-planner.engine';

describe('frequency-planner', () => {
  it('under MEV → under, perSession = total', () => {
    const p = planFrequency('chest', 4, 4, 'intermediate');
    expect(p.status).toBe('under');
    expect(p.frequency).toBe(1);
    expect(p.perSession[0]).toBe(4);
  });
  it('optimal → 1-2×', () => {
    const p = planFrequency('chest', 10, 4, 'intermediate');
    expect(p.status).toBe('optimal');
    expect(p.frequency).toBeGreaterThanOrEqual(1);
  });
  it('high volume → frequency 2-3', () => {
    const p = planFrequency('legs', 18, 4, 'intermediate');
    expect(p.frequency).toBeGreaterThanOrEqual(2);
    expect(p.perSession.reduce((a,b)=>a+b,0)).toBe(18);
  });
  it('days limit caps frequency', () => {
    const p = planFrequency('back', 20, 1, 'intermediate');
    expect(p.frequency).toBe(1);
  });
});
