import { describe, expect, it, beforeEach } from 'vitest';
import { getMdupProfile, updateMdupProfile, getAllMdupProfiles, clearMdupProfiles } from '../bb-mdup';

describe('bb-mdup', () => {
  beforeEach(() => { clearMdupProfiles(); });

  it('returns default profile for muscle', () => {
    const p = getMdupProfile('chest');
    expect(p.muscle).toBe('chest');
    expect(p.heavy.pct).toBeGreaterThan(0);
    expect(p.heavy.rir).toBeGreaterThanOrEqual(0);
  });

  it('updates and retrieves profile', () => {
    updateMdupProfile('back', { pct: 0.92, rir: 1 }, { pct: 0.82, rir: 2 }, { pct: 0.72, rir: 3 });
    const p = getMdupProfile('back');
    expect(p.heavy.pct).toBe(0.92);
    expect(p.medium.rir).toBe(2);
  });

  it('clamps values to valid range', () => {
    const p = updateMdupProfile('chest', { pct: 1.5, rir: 10 }, { pct: 0.3, rir: -2 }, { pct: 0.7, rir: 3 });
    expect(p.heavy.pct).toBe(1.0);
    expect(p.heavy.rir).toBe(5);
    expect(p.medium.pct).toBe(0.5);
    expect(p.medium.rir).toBe(0);
  });

  it('returns all profiles', () => {
    updateMdupProfile('chest', { pct: 0.9, rir: 1 }, { pct: 0.8, rir: 2 }, { pct: 0.7, rir: 3 });
    updateMdupProfile('back', { pct: 0.9, rir: 1 }, { pct: 0.8, rir: 2 }, { pct: 0.7, rir: 3 });
    expect(getAllMdupProfiles()).toHaveLength(2);
  });

  it('clears all profiles', () => {
    updateMdupProfile('chest', { pct: 0.9, rir: 1 }, { pct: 0.8, rir: 2 }, { pct: 0.7, rir: 3 });
    clearMdupProfiles();
    expect(getAllMdupProfiles()).toHaveLength(0);
  });
});
