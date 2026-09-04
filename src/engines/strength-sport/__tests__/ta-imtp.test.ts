import { describe, it, expect } from 'vitest';
import { diagnoseTAImtp } from '../strength-sport-ta-imtp.engine';

describe('TA IMTP/RFD E13', () => {
  it('дефицит базы: 2000Н при 90кг → 2.27×BW', () => {
    const r = diagnoseTAImtp({ peakForceN: 2000, bodyweightKg: 90, durationS: 4 });
    expect(r?.relForce).toBeCloseTo(2.27, 2);
    expect(r?.profile).toBe('strength_deficit');
    expect(r?.valid).toBe(true);
  });
  it('дефицит взрыва: сила есть, RFD низкий', () => {
    const r = diagnoseTAImtp({ peakForceN: 3000, bodyweightKg: 90, rfdNs: 4000 });
    expect(r?.profile).toBe('explosive_deficit');
  });
  it('баланс', () => {
    const r = diagnoseTAImtp({ peakForceN: 3000, bodyweightKg: 90, rfdNs: 9000 });
    expect(r?.profile).toBe('balanced');
  });
  it('dip → невалиден + warning', () => {
    const r = diagnoseTAImtp({ peakForceN: 3000, bodyweightKg: 90, countermovement: true });
    expect(r?.valid).toBe(false);
    expect(r?.warnings.some(w => w.includes('невалиден'))).toBe(true);
  });
  it('длительность: коротко/длинно — warnings', () => {
    expect(diagnoseTAImtp({ peakForceN: 2500, bodyweightKg: 80, durationS: 0.5 })?.warnings.length).toBeGreaterThan(0);
    expect(diagnoseTAImtp({ peakForceN: 2500, bodyweightKg: 80, durationS: 8 })?.warnings.length).toBeGreaterThan(0);
    expect(diagnoseTAImtp({ peakForceN: 2500, bodyweightKg: 80, durationS: 3 })?.warnings.length).toBe(0);
  });
  it('пусто → null; мусор без throw', () => {
    expect(diagnoseTAImtp({})).toBeNull();
    expect(diagnoseTAImtp({ peakForceN: NaN, bodyweightKg: 0 } as any)?.profile).toBe('unknown');
  });
});
