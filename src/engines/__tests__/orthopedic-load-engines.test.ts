import { describe, expect, it } from 'vitest';
import { computeOrthopedicConstraints } from '../orthopedic-load-engines';

describe('orthopedic constraints', () => {
  it('normalizes aliases and returns blocked patterns', () => {
    const result = computeOrthopedicConstraints({ injuryHistory: ['lower back'], jointLimitations: {}, techniqueIssues: [], currentPain: [] });
    expect(result.blockedPatterns).toContain('hinge');
    expect(result.phase).not.toBe('maintenance');
  });

  it('severe shoulder limitation blocks pressing and lowers stress', () => {
    const result = computeOrthopedicConstraints({ injuryHistory: [], jointLimitations: { shoulder: 'severe' }, techniqueIssues: [], currentPain: [] });
    expect(result.blockedPatterns).toContain('vertical_push');
    expect(result.jointStressLimits.shoulder).toBe(1);
  });

  it('pain and technique issues produce safety recommendations', () => {
    const result = computeOrthopedicConstraints({ injuryHistory: [], jointLimitations: {}, techniqueIssues: ['rounding_back'], currentPain: ['knee'] });
    expect(result.blockedPatterns).toContain('hinge');
    expect(result.blockedPatterns).toContain('squat');
    expect(result.recommendations.length).toBeGreaterThan(0);
  });
});
