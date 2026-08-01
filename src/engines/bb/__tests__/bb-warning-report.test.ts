import { describe, expect, it } from 'vitest';
import { buildBBPlanReport } from '../bb-report.engine';

describe('BB warning report contract', () => {
  it('keeps validation warning counts export-safe', () => {
    const report = buildBBPlanReport({ pattern: { name: 'test', sessionsPerRotation: 1 }, weeks: [{ week: 1, sessions: [] }], weeklyVolume: {}, fatigueReport: [], rotationMuscleVolume: {}, rationale: [], validation: { valid: true, issues: [{ level: 'warning', code: 'target_volume_deficit', message: 'deficit' }] }, rotationReport: { primaryByMuscle: {}, accessoryPatternsByMuscle: {}, issues: [] } } as any);
    expect(report.validationValid).toBe(true);
    expect(report.validationWarnings).toBe(1);
  });

  it('keeps balance diagnostics in the export report', () => {
    const report = buildBBPlanReport({ pattern: { name: 'test', sessionsPerRotation: 1 }, weeks: [{ week: 1, sessions: [] }], weeklyVolume: {}, fatigueReport: [], rotationMuscleVolume: {}, rationale: [], balanceReport: { press: 4, pull: 2, raise: 0, upperPress: 4, upperPull: 2, pullPressRatio: 0.5, compound: 4, isolation: 0, lengthened: 2, midRange: 2, shortened: 0, patterns: {}, issues: ['imbalance'] } } as any);
    expect(report.balance?.pullPressRatio).toBe(0.5);
  });
});
