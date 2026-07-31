import { describe, expect, it } from 'vitest';
import { buildBBPlanReport } from '../bb-report.engine';

describe('BB plan report', () => {
  it('builds an export-safe summary from final plan fields', () => {
    const plan: any = {
      pattern: { name: 'Test', sessionsPerRotation: 3 }, weeks: [{ week: 1 }],
      weeklyVolume: { 1: { chest: { directSets: 10, effectiveSets: 14 } } },
      fatigueReport: [{ week: 1, sessions: [{ timeSeconds: 3600, axial: 4 }] }],
      rotationReport: { issues: [] },
      validation: { valid: false, issues: [{ level: 'error', code: 'x', message: 'bad' }, { level: 'warning', code: 'y', message: 'warn' }, { level: 'warning', code: 'session_muscle_leak', message: 'leak' }] },
    };
    const report = buildBBPlanReport(plan);
    expect(report.totalDirectSets).toBe(10);
    expect(report.peakVolume.chest.effectiveSets).toBe(14);
    expect(report.maxSessionMinutes).toBe(60);
    expect(report.validationValid).toBe(false);
    expect(report.validationErrors).toBe(1);
    expect(report.validationWarnings).toBe(2);
    expect(report.sessionLeakWarnings).toBe(1);
  });
});
