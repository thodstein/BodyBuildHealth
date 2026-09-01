import { describe, it, expect } from 'vitest';
import { createBlank, isUserProgramShape, validateProgram } from '../../user-program/program-store';

describe('arm program store', () => {
  it('createBlank arm', () => {
    const p = createBlank('arm' as any);
    expect(p.meta.direction).toBe('arm');
    expect((p as any).arm).toBeDefined();
    expect((p as any).arm.weeks.length).toBeGreaterThan(0);
  });
  it('isUserProgramShape arm', () => {
    const p = createBlank('arm' as any);
    expect(isUserProgramShape(p)).toBe(true);
    const bad: any = { ...p, meta: { ...p.meta, direction: 'unknown' } };
    expect(isUserProgramShape(bad)).toBe(false);
  });
  it('validateProgram arm — no errors for blank', () => {
    const p = createBlank('arm' as any);
    const issues = validateProgram(p);
    const errors = issues.filter(i=>i.level==='error');
    expect(errors.length).toBe(0);
  });
  it('migrate arm weeks', () => {
    const p: any = createBlank('arm' as any);
    // simulate old shape without deload flag
    p.arm.weeks[0].phase = 'accumulation';
    expect(isUserProgramShape(p)).toBe(true);
  });
});
