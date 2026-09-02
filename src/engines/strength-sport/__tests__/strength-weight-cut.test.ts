import { describe, it, expect } from 'vitest';
import { buildWeightCutProtocolSS, weightCutNutritionForWeekSS, validateWeightCutProtocolSS } from '../strength-sport-weight-cut.engine';

describe('strength weight-cut SS ltape', () => {
  it('build SS: carb stable, water load_cut', () => {
    const p = buildWeightCutProtocolSS(4, { startWeightKg:90 } as any)!;
    expect(p.carbMode).toBe('stable');
    expect(p.waterMode).toBe('load_cut');
    expect(p.fiberGPerDay).toBe(10);
  });
  it('SS same-day forces stable', () => {
    const p = buildWeightCutProtocolSS(4, { startWeightKg:80, discipline:'wrestling' } as any)!;
    expect(p.weighInType).toBe('same_day_2h');
    expect(p.waterMode).toBe('stable');
  });
  it('SS nutrition TA not 1g carbs fight week', () => {
    const p = buildWeightCutProtocolSS(4, { startWeightKg:80 } as any)!;
    const nut = weightCutNutritionForWeekSS(4,4,p,80,'male');
    expect(nut.carbsG).toBeGreaterThanOrEqual(300); // 4g/kg stable, not 1g
    expect(nut.fiberG).toBe(10);
  });
  it('SS validate female 5%', () => {
    const p = buildWeightCutProtocolSS(4, { startWeightKg:60 } as any)!;
    const e = validateWeightCutProtocolSS(p, { bodyweightKg:60, sex:'female' });
    expect(e.some(x=> x.includes('5%'))).toBe(true);
  });
  it('SS confirm gate', () => {
    const un = buildWeightCutProtocolSS(6, { startWeightKg:80, confirmedManipulation:false } as any)!;
    expect(un.waterMode).toBe('stable');
    const co = buildWeightCutProtocolSS(6, { startWeightKg:80, confirmedManipulation:true, waterMode:'load_cut' } as any)!;
    expect(co.waterMode).toBe('load_cut');
  });
});
