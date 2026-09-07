/**
 * risk-recommendations-fix.test.tsx — P0: RISK_SYSTEM_MAP без liver/heart/kidney → рекомендации 0
 */
import { describe, it, expect } from 'vitest';
import { RISK_SYSTEM_MAP, RECOMMENDATIONS_DB } from '../../data/support-category-data';

function mapRiskSystem(s: string): string {
  return (RISK_SYSTEM_MAP as any)[s] || s;
}

describe('Risk recommendations P0 fix', () => {
  it('liver → hepatic, kidney → renal, heart → cardio', () => {
    expect(mapRiskSystem('liver')).toBe('hepatic');
    expect(mapRiskSystem('kidney')).toBe('renal');
    expect(mapRiskSystem('heart')).toBe('cardio');
  });

  it('hepatic риск HIGH должен находить рекомендацию LIVER_*', () => {
    const sys = 'hepatic';
    const level = 'HIGH';
    const ms = mapRiskSystem(sys.toLowerCase());
    const match = RECOMMENDATIONS_DB.find(
      (r) => r.type === 'RISK' && mapRiskSystem((r.riskId || '').split('_')[0].toLowerCase()) === ms && r.level === level,
    );
    expect(match).toBeDefined();
    expect(match!.riskId).toContain('LIVER');
  });

  it('до фикса liver не маппился → 0 рекомендаций', () => {
    const oldMap: Record<string, string> = {
      metabolic: 'metabolic',
      structural: 'hepatic',
    };
    const oldMapFn = (s: string) => (oldMap as any)[s] || s;
    expect(oldMapFn('liver')).toBe('liver');
    const sys = 'hepatic';
    const ms = oldMapFn(sys);
    const match = RECOMMENDATIONS_DB.find(
      (r) => r.type === 'RISK' && oldMapFn((r.riskId || '').split('_')[0].toLowerCase()) === ms && r.level === 'HIGH',
    );
    expect(match).toBeUndefined();
  });
});
