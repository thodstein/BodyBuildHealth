import { describe, it, expect } from 'vitest';
import { buildArmDiagnosticsReport } from '../arm-diagnostics-hub.engine';
import { diagnoseArmWeakDetailed, expandLegacyWeakPoints } from '../arm-weakpoint.engine';

describe('arm diagnostics detailed 12 точек', () => {
  it('weakPoints явные → biomechCards', () => {
    const r = buildArmDiagnosticsReport({
      weakTest:{},
      weakPoints:['cup_start','pron_lock'] as any,
      grip:{} as any, level:'intermediate', technique:'toproll', tableSessions:2, totalSessions:4, tendonSets:10,
      angles:{ elbowDeg:110, wristDeg:10, forearmDeg:140 }, hasVideo:true, hasVbt:true, hasGripHistory:true,
    } as any);
    expect(r.weakPoints).toContain('cup_start');
    expect(r.biomechCards?.length).toBe(2);
    expect(r.corrections?.length).toBe(2);
    expect(r.scoring).toBeTruthy();
  });
  it('legacy cup → cup_start+cup_hold', () => {
    const exp = expandLegacyWeakPoints(['cup']);
    expect(exp).toContain('cup_start');
    expect(exp).toContain('cup_hold');
  });
  it('diagnoseArmWeakDetailed merge legacy weakTest', () => {
    const d = diagnoseArmWeakDetailed({ weakTest:{ cupFails:true }, technique:'hook' });
    expect(d.weakPoints.length).toBeGreaterThan(0);
    expect(d.weakPoints).toContain('cup_start');
    expect(d.biomechCards.length).toBeGreaterThan(0);
  });
  it('scoring cap 49 при асимметрии 13', () => {
    const r = buildArmDiagnosticsReport({
      weakTest:{}, weakPoints:['side_pin'] as any,
      grip:{ leftKg:50, rightKg:65 } as any, level:'intermediate', technique:'press', tableSessions:2,totalSessions:4, tendonSets:10,
      hasVideo:true,
    } as any);
    // асимметрия из left/right = 65 vs 50 → (65-50)/65=23% → critical
    expect(r.asymmetryPct).toBeGreaterThanOrEqual(12);
    expect(r.scoring?.score).toBeLessThanOrEqual(49);
  });
  it('max 3 точки', () => {
    const d = diagnoseArmWeakDetailed({ weakPoints:['cup_start','cup_hold','rising_top','pron_open'] as any });
    expect(d.weakPoints.length).toBeLessThanOrEqual(3);
  });
  it('humerus finding есть при side', () => {
    const r = buildArmDiagnosticsReport({
      weakTest:{ sidePressureFails:true }, grip:{} as any, level:'intermediate', technique:'press', tableSessions:2,totalSessions:4, tendonSets:8,
    } as any);
    expect(r.findings.some(f=> f.text.includes('Side') || f.text.includes('side'))).toBe(true);
  });
  it('support RT<60 → contain_fingers с support-коррекцией', () => {
    const r = buildArmDiagnosticsReport({
      weakTest:{ gripSupportMaxKg: 50 } as any, grip:{} as any, level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:8,
    } as any);
    expect(r.weakMuscles).toContain('grip_support');
    expect(r.weakPoints).toContain('contain_fingers');
    expect(r.corrections?.find(c=> c.weakPoint==='contain_fingers')?.exercises).toContain('rolling_thunder');
  });
});
