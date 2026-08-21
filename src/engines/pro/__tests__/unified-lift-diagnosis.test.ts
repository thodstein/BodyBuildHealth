import { describe, expect, it } from 'vitest';
import { unifiedLiftDiagnosis } from '../unified-lift-diagnosis.engine';

describe('unified-lift-diagnosis', () => {
  it('bench master содержит 9 геометрий + слабые фазы', () => {
    const d = unifiedLiftDiagnosis({ lift: 'bench', sessions: [] });
    expect(d.lift).toBe('bench');
    expect(d.limiter.techniqueGeometry.length).toBe(9);
    expect(d.phases.phases.length).toBeGreaterThan(0);
    expect(d.barPath.applicableIssues.length).toBeGreaterThan(0);
  });
  it('headerHint содержит lift и геометрию', () => {
    const d = unifiedLiftDiagnosis({ lift: 'bench', sessions: [] });
    expect(d.headerHint).toContain('Жим');
    expect(d.headerHint).toContain('геометрия');
  });
  it('все 9 движений имеют геометрию (row/pulldown/incline/biceps тоже)', () => {
    expect(unifiedLiftDiagnosis({ lift: 'squat', sessions: [] }).limiter.techniqueGeometry.length).toBe(5);
    expect(unifiedLiftDiagnosis({ lift: 'deadlift', sessions: [] }).limiter.techniqueGeometry.length).toBe(4);
    expect(unifiedLiftDiagnosis({ lift: 'sumo', sessions: [] }).limiter.techniqueGeometry.length).toBe(3);
    expect(unifiedLiftDiagnosis({ lift: 'ohp', sessions: [] }).limiter.techniqueGeometry.length).toBe(3);
    expect(unifiedLiftDiagnosis({ lift: 'row', sessions: [] }).limiter.techniqueGeometry.length).toBe(3);
    expect(unifiedLiftDiagnosis({ lift: 'pulldown', sessions: [] }).limiter.techniqueGeometry.length).toBe(3);
    expect(unifiedLiftDiagnosis({ lift: 'incline_press', sessions: [] }).limiter.techniqueGeometry.length).toBe(3);
    expect(unifiedLiftDiagnosis({ lift: 'biceps', sessions: [] }).limiter.techniqueGeometry.length).toBe(3);
  });
  it('VBT диагностика появляется при вводе скоростей', () => {
    const d = unifiedLiftDiagnosis({ lift: 'bench', vbtBest:'0.6', vbtLast:'0.4', vbtWeight:'100', sessions:[] });
    expect(d.vbt.diagnosis).not.toBeNull();
    expect(d.vbt.diagnosis!.lossPct).toBeGreaterThan(20);
  });
  it('parity: effectivePhase совпадает с diagnoseMovement', () => {
    const d = unifiedLiftDiagnosis({ lift:'bench', phase:'mid', sessions:[] });
    expect(d.phases.effectivePhase).toBe('mid');
    expect(d.phases.movement?.weakPoint.label).toBeTruthy();
  });
});
