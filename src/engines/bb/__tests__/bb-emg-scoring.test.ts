import { describe, expect, it, beforeEach } from 'vitest';
import { getEmgScoring, getEmgScoreForExercise, isHighActivationExercise, getAvailableMuscles, clearEmgCache } from '../bb-emg-scoring';

describe('bb-emg-scoring', () => {
  beforeEach(() => { clearEmgCache(); });

  it('returns sorted scores for known muscle', () => {
    const s = getEmgScoring('delts');
    expect(s.length).toBeGreaterThan(0);
    for (let i = 1; i < s.length; i++) expect(s[i - 1].activationPct).toBeGreaterThanOrEqual(s[i].activationPct);
  });

  it('returns 0 for unknown exercise', () => {
    expect(getEmgScoreForExercise('chest', 'Nonexistent')).toBe(0);
  });

  it('detects high activation exercise', () => {
    expect(isHighActivationExercise('delts', 'Lateral Raise (external rotation)')).toBe(true);
  });

  it('lists available muscles', () => {
    expect(getAvailableMuscles()).toContain('chest');
  });
});
