import { describe, it, expect } from 'vitest';
import { buildArmDiagnosticsReport } from '../arm-diagnostics-hub.engine';
import { estimateArmAngles, validateArmAngles, recommendAnglesForTechnique } from '../arm-motion-capture.engine';
import { recordGripForce, estimateForceVector } from '../arm-force-capture.engine';
import { diagnoseVbt } from '../arm-vbt-capture.engine';

describe('arm-diagnostics-hub PRO (механизм-ориентированная, без общего score)', () => {
  it('weak cup → wrist_flexors', () => {
    const r = buildArmDiagnosticsReport({ weakTest:{cupFails:true}, grip:{}, level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:8 });
    expect(r.weakMuscles).toContain('wrist_flexors');
    expect(r.findings.some(f=>f.text.includes('Сгибание'))).toBe(false); // generic
  });
  it('grip RT 50 vs 100', () => {
    const low = buildArmDiagnosticsReport({ weakTest:{}, grip:{rtKg:50}, level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:8 });
    const high = buildArmDiagnosticsReport({ weakTest:{}, grip:{rtKg:110}, level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:8 });
    expect(high.forceVector!.gripSupport).toBeGreaterThan(low.forceVector!.gripSupport);
  });
  it('table <30% → суставной finding warn', () => {
    const r = buildArmDiagnosticsReport({ weakTest:{}, grip:{}, level:'intermediate', technique:'balanced', tableSessions:0, totalSessions:4, tendonSets:8 });
    expect(r.findings.some(f=>f.text.includes('Table time'))).toBe(true);
    expect(r.tableRatio).toBe(0);
    expect(r.findings.find(f=>f.text.includes('Table time'))!.level).toBe('warn');
  });
  it('tendon → суставной finding', () => {
    const r = buildArmDiagnosticsReport({ weakTest:{}, grip:{}, level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:20 });
    const tf = r.findings.find(f=>f.text.includes('Tendon'));
    expect(tf).toBeTruthy();
    expect(['warn','critical']).toContain(tf!.level);
  });
  it('механизм-ориентированные риски есть, общего score нет', () => {
    const r = buildArmDiagnosticsReport({ weakTest:{cupFails:true, pronationFails:true, sidePressureFails:true}, grip:{rtKg:30}, level:'beginner', technique:'hook', tableSessions:0, totalSessions:4, tendonSets:20 });
    expect(r.findings.length).toBeGreaterThan(0);
    expect(r.findings.some(f=>f.level==='warn' || f.level==='critical')).toBe(true); // сустав/сухожилие
    expect(r.humerusWarnings.length).toBeGreaterThan(0);
    expect(r.info.length).toBeGreaterThan(0);
    // нет общего score/verification
    expect((r as any).score).toBeUndefined();
    expect((r as any).verification).toBeUndefined();
  });
  it('VBT stop — vbt zone stop и finding', () => {
    const r = buildArmDiagnosticsReport({ weakTest:{}, grip:{}, vbtRecords:[{weight:50,reps:5,velocityMs:0.8},{weight:50,reps:5,velocityMs:0.4}], level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:8 });
    expect(r.vbt?.zone).toBe('stop');
    expect(r.findings.some(f=>f.text.includes('VBT'))).toBe(true);
  });
  it('info содержит данные', () => {
    const r = buildArmDiagnosticsReport({ weakTest:{}, grip:{rtKg:60}, level:'intermediate', technique:'balanced', tableSessions:2, totalSessions:4, tendonSets:8 });
    expect(r.info).toBeDefined();
    expect(Array.isArray(r.info)).toBe(true);
  });
  it('side fail → humerusWarnings', () => {
    const r = buildArmDiagnosticsReport({ weakTest:{sidePressureFails:true}, grip:{}, level:'intermediate', technique:'press', tableSessions:2, totalSessions:4, tendonSets:8 });
    expect(r.humerusWarnings.length).toBeGreaterThan(0);
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
