import { describe, it, expect } from 'vitest';
import { diagnoseTAAnthro } from '../strength-sport-ta-anthro.engine';

describe('TA anthro E9', () => {
  it('длинные руки → узкий хват + Everett', () => {
    const r = diagnoseTAAnthro({ heightCm: 180, armSpanCm: 188, shoulderCm: 42 });
    expect(r?.type).toBe('long');
    expect(r?.gripAdvice).toContain('уже');
    expect(r?.gripAdvice).toContain('Everett');
    expect(r?.startAdvice).toContain('42см');
    expect(r?.startAdvice).toContain('63см');
  });
  it('короткие руки → шире', () => {
    const r = diagnoseTAAnthro({ heightCm: 180, armSpanCm: 172 });
    expect(r?.type).toBe('short');
    expect(r?.gripAdvice).toContain('81см');
  });
  it('средние → стандарт', () => {
    const r = diagnoseTAAnthro({ heightCm: 180, armSpanCm: 181 });
    expect(r?.type).toBe('average');
  });
  it('границы ±5 включительно — average', () => {
    expect(diagnoseTAAnthro({ heightCm: 180, armSpanCm: 185 })?.type).toBe('average');
    expect(diagnoseTAAnthro({ heightCm: 180, armSpanCm: 175 })?.type).toBe('average');
  });
  it('нет данных → null', () => {
    expect(diagnoseTAAnthro({})).toBeNull();
    expect(diagnoseTAAnthro({ heightCm: 180 })).toBeNull();
    expect(diagnoseTAAnthro({ heightCm: NaN, armSpanCm: 180 })).toBeNull();
  });
});
