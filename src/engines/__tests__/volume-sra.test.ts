import { describe, expect, it } from 'vitest';
import { sraForMuscle, sraFrequencyCheck, SRA_BASE_HOURS } from '../volume-sra.engine';

describe('sra: окна RP', () => {
  it('грудь 24–48, спина 48–72, квадрицепсы 48–96, икры 12–24', () => {
    expect(SRA_BASE_HOURS.chest).toEqual({ min: 24, max: 48 });
    expect(SRA_BASE_HOURS.back).toEqual({ min: 48, max: 72 });
    expect(SRA_BASE_HOURS.quads).toEqual({ min: 48, max: 96 });
    expect(SRA_BASE_HOURS.calves).toEqual({ min: 12, max: 24 });
  });
  it('RU-алиасы маппятся (грудь → chest)', () => {
    const a = sraForMuscle('грудь', 'intermediate', 10, 0);
    expect(a.baseMin).toBe(24);
    expect(a.baseMax).toBe(48);
  });
});

describe('sra: оценка восстановления', () => {
  it('пустая неделя → минимум окна', () => {
    expect(sraForMuscle('chest', 'intermediate', 0, 0).recoveryHours).toBe(24);
  });
  it('объём у MRV → около максимума', () => {
    const r = sraForMuscle('chest', 'intermediate', 20, 0);
    expect(r.recoveryHours).toBeGreaterThanOrEqual(40);
    expect(r.recoveryHours).toBeLessThanOrEqual(60);
  });
  it('тяжёлые удлиняют: те же сеты с heavy=все vs heavy=0', () => {
    const light = sraForMuscle('back', 'intermediate', 12, 0);
    const heavy = sraForMuscle('back', 'intermediate', 12, 12);
    expect(heavy.recoveryHours).toBeGreaterThan(light.recoveryHours);
  });
  it('монотонность: рост объёма — рост часов', () => {
    const a = sraForMuscle('quads', 'intermediate', 8, 0);
    const b = sraForMuscle('quads', 'intermediate', 18, 2);
    expect(b.recoveryHours).toBeGreaterThan(a.recoveryHours);
  });
});

describe('sra: частота vs окно', () => {
  it('грудь 2×/нед (84ч) при SRA ~40ч — ok', () => {
    expect(sraFrequencyCheck('chest', 2, 40).kind).toBe('ok');
  });
  it('ноги 3×/нед (56ч) при окне min 48 — warning/critical по часам', () => {
    const v = sraFrequencyCheck('quads', 3, 80);
    expect(v.kind).not.toBe('ok');
    expect(v.message).toContain('56');
  });
  it('ежедневно грудь (24ч) при min 24 — граница: interval < min? 24<24 false → дальше', () => {
    const v = sraFrequencyCheck('chest', 7, 40, 'Грудь');
    expect(v.kind).toBe('warning');
  });
  it('7× при окне min 48 — critical', () => {
    expect(sraFrequencyCheck('back', 7, 60).kind).toBe('critical');
  });
  it('0 сессий — ok без требований', () => {
    expect(sraFrequencyCheck('chest', 0, 40).kind).toBe('ok');
  });
});
