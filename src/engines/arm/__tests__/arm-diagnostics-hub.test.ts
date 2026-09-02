import { describe, it, expect } from 'vitest';
import { buildArmDiagnosticsReport } from '../arm-diagnostics-hub.engine';
import { estimateArmAngles, validateArmAngles, recommendAnglesForTechnique } from '../arm-motion-capture.engine';
import { recordGripForce, estimateForceVector } from '../arm-force-capture.engine';
import { diagnoseVbt } from '../arm-vbt-capture.engine';

describe('arm-diagnostics-hub PRO (без рисков)', () => {
  it('weak cup → wrist_flexors', () => {
    const r = buildArmDiagnosticsReport({ weakTest:{cupFails:true}, grip:{}, level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:8 });
    expect(r.weakMuscles).toContain('wrist_flexors');
    expect(r.details.some(f=>f.text.includes('Сгибание'))).toBe(false); // generic
  });
  it('grip RT 50 vs 100', () => {
    const low = buildArmDiagnosticsReport({ weakTest:{}, grip:{rtKg:50}, level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:8 });
    const high = buildArmDiagnosticsReport({ weakTest:{}, grip:{rtKg:110}, level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:8 });
    expect(high.forceVector!.gripSupport).toBeGreaterThan(low.forceVector!.gripSupport);
  });
  it('table <30% → detail', () => {
    const r = buildArmDiagnosticsReport({ weakTest:{}, grip:{}, level:'intermediate', technique:'balanced', tableSessions:0, totalSessions:4, tendonSets:8 });
    expect(r.details.some(f=>f.text.includes('Table time'))).toBe(true);
    expect(r.tableRatio).toBe(0);
  });
  it('tendon → detail', () => {
    const r = buildArmDiagnosticsReport({ weakTest:{}, grip:{}, level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:20 });
    expect(r.details.some(f=>f.text.includes('Tendon'))).toBe(true);
  });
  it('details инфо без рисков', () => {
    const r = buildArmDiagnosticsReport({ weakTest:{cupFails:true, pronationFails:true, sidePressureFails:true}, grip:{rtKg:30}, level:'beginner', technique:'hook', tableSessions:0, totalSessions:4, tendonSets:20 });
    expect(r.details.length).toBeGreaterThan(0);
    expect(r.info.length).toBeGreaterThan(0);
    // нет score/verification/humerusWarnings как рисков
    expect((r as any).score).toBeUndefined();
    expect((r as any).verification).toBeUndefined();
    expect((r as any).humerusWarnings).toBeUndefined();
  });
  it('VBT stop — vbt zone stop и деталь', () => {
    const r = buildArmDiagnosticsReport({ weakTest:{}, grip:{}, vbtRecords:[{weight:50,reps:5,velocityMs:0.8},{weight:50,reps:5,velocityMs:0.4}], level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:8 });
    expect(r.vbt?.zone).toBe('stop');
    expect(r.details.some(f=>f.text.includes('VBT'))).toBe(true);
  });
  it('info содержит данные без verification', () => {
    const r = buildArmDiagnosticsReport({ weakTest:{}, grip:{rtKg:60}, level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:8 });
    expect(r.info).toBeDefined();
    expect(Array.isArray(r.info)).toBe(true);
  });
  it('side fail → info', () => {
    const r = buildArmDiagnosticsReport({ weakTest:{sidePressureFails:true}, grip:{}, level:'intermediate', technique:'press', tableSessions:2, totalSessions:4, tendonSets:8 });
    expect(r.info.some(t=>t.includes('Side pressure'))).toBe(true);
  });
});

describe('arm-motion-capture', () => {
  it('estimate 90°', () => {
    const a = estimateArmAngles({ elbowDeg:92, forearmDeg:90, wristDeg:10, direction:'to_middle' });
    expect(a.elbowDeg).toBe(90);
    expect(a.pronDeg).toBe(0);
  });
  it('pron 140 → pronDeg 50', () => {
    const a = estimateArmAngles({ elbowDeg:110, forearmDeg:140, wristDeg:0, direction:'to_little' });
    expect(a.pronDeg).toBe(50);
  });
  it('validate ok', () => {
    const a = estimateArmAngles({ elbowDeg:90, forearmDeg:90, wristDeg:10, direction:'to_middle' });
    expect(validateArmAngles(a).valid).toBe(true);
  });
  it('recommend hook', () => {
    expect(recommendAnglesForTechnique('hook').elbowDeg).toBe(90);
    expect(recommendAnglesForTechnique('toproll').direction).toBe('to_little');
  });
});

describe('arm-force-capture', () => {
  it('RT 55 → ~50', () => {
    const v = estimateForceVector(recordGripForce({ rtKg:55 }));
    expect(v.gripSupport).toBeGreaterThanOrEqual(45);
    expect(v.gripSupport).toBeLessThanOrEqual(55);
  });
  it('pinch 15 → 100', () => {
    const v = estimateForceVector({ pinchSec:15 });
    expect(v.gripPinch).toBe(100);
  });
});

describe('arm-vbt-capture', () => {
  it('loss 50% → stop', () => {
    const v = diagnoseVbt([{weight:50,reps:5,velocityMs:1.0},{weight:50,reps:5,velocityMs:0.5}]);
    expect(v.velocityLossPct).toBe(50);
    expect(v.zone).toBe('stop');
  });
  it('single → ok', () => {
    const v = diagnoseVbt([{weight:50,reps:5,velocityMs:0.8}]);
    expect(v.zone).toBe('ok');
  });
  it('e1RM', () => {
    const v = diagnoseVbt([{weight:100,reps:5,velocityMs:0.8}]);
    expect(v.e1RM).toBe(117);
  });
});
