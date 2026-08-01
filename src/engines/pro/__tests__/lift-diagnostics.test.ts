import { describe, expect, it } from 'vitest';
import { diagnoseLift, stickingPhases, barPathAnalysis } from '../lift-diagnostics.engine';

describe('lift-diagnostics', () => {
  it('returns detailed diagnosis for supported sticking point', () => {
    const result = diagnoseLift('bench', 'lockout');
    expect(result).not.toBeNull();
    expect(result!.angleRangeDeg).toEqual([90, 180]);
    expect(result!.corrections.length).toBeGreaterThan(0);
    expect(result!.assistance.length).toBeGreaterThan(0);
  });
  it('returns no detailed diagnosis for unsupported phase', () => {
    expect(diagnoseLift('ohp', 'mid')).toBeNull();
  });
  it('lists phases and maps bar path issues', () => {
    expect(stickingPhases('squat')).toContain('bottom');
    const result = barPathAnalysis('deadlift', ['forward_drift', 'asymmetric']);
    expect(result.diagnoses).toHaveLength(2);
    expect(result.diagnoses[0].correction).toContain('RDL');
  });
});
