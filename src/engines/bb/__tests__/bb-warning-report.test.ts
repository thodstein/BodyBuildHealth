import { describe, expect, it } from 'vitest';
import { buildBBPlanReport } from '../bb-report.engine';

describe('BB warning report contract', () => {
  it('keeps validation warning counts export-safe', () => {
    const report = buildBBPlanReport({ pattern: { name: 'test', sessionsPerRotation: 1 }, weeks: [{ week: 1, sessions: [] }], weeklyVolume: {}, fatigueReport: [], rotationMuscleVolume: {}, rationale: [], validation: { valid: true, issues: [{ level: 'warning', code: 'target_volume_deficit', message: 'deficit' }] }, rotationReport: { primaryByMuscle: {}, accessoryPatternsByMuscle: {}, issues: [] } } as any);
    expect(report.validationValid).toBe(true);
    expect(report.validationWarnings).toBe(1);
  });
});
