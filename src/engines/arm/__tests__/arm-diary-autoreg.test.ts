import { describe, it, expect } from 'vitest';
import { autoregArmFromDiary, armAcwrZone } from '../arm-diary-autoreg.engine';

describe('arm-diary-autoreg (эпик G)', () => {
  it('норма — без изменений', () => {
    const r = autoregArmFromDiary([{ dateIso: '2026-01-01', srpe: 6, elbowPain: 1, wristPain: 0 }]);
    expect(r.volumeMult).toBe(1);
    expect(r.rirShift).toBe(0);
    expect(r.replaceSideWithIso).toBe(false);
  });
  it('sRPE 9 — резка объёма', () => {
    const r = autoregArmFromDiary([{ dateIso: '2026-01-01', srpe: 9 }]);
    expect(r.volumeMult).toBeLessThanOrEqual(0.65);
    expect(r.rirShift).toBe(2);
  });
  it('боль ≥4 — замены', () => {
    const r = autoregArmFromDiary([{ dateIso: '2026-01-01', elbowPain: 5 }]);
    expect(r.replaceSideWithIso).toBe(true);
    expect(r.replaceHeavyPronWithPulses).toBe(true);
    expect(r.volumeMult).toBeLessThan(1);
  });
  it('боль ≥7 — жёсткая резка', () => {
    const r = autoregArmFromDiary([{ dateIso: '2026-01-01', wristPain: 8 }]);
    expect(r.volumeMult).toBe(0.5);
    expect(r.extraRestDays).toBe(2);
  });
  it('ACWR-зоны', () => {
    expect(armAcwrZone(20, 10)).toBe('danger');
    expect(armAcwrZone(14, 10)).toBe('caution');
    expect(armAcwrZone(10, 10)).toBe('ok');
  });
});
