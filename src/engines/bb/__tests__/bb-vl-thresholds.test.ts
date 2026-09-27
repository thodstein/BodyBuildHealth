import { describe, expect, it, beforeEach } from 'vitest';
import {
  getVlThreshold,
  updateVlThreshold,
  isVlAcceptable,
  getAllVlThresholds,
  clearVlThresholds,
} from '../bb-vl-thresholds';

describe('bb-vl-thresholds', () => {
  beforeEach(() => {
    clearVlThresholds();
  });

  it('returns default threshold for unknown muscle', () => {
    const t = getVlThreshold('unknown');
    expect(t.muscle).toBe('unknown');
    expect(t.confidence).toBe(0);
  });

  it('returns known default values', () => {
    const t = getVlThreshold('chest');
    expect(t.strengthVl).toBe(0.20);
    expect(t.hypertrophyVl).toBe(0.25);
  });

  it('updates threshold and increments confidence', () => {
    const t1 = updateVlThreshold('chest', 0.18, 0.28);
    expect(t1.confidence).toBe(0.1);
    
    const t2 = updateVlThreshold('chest', 0.19, 0.29);
    expect(t2.confidence).toBe(0.2);
  });

  it('clamps values to valid range', () => {
    const t = updateVlThreshold('chest', 0.05, 0.70);
    expect(t.strengthVl).toBe(0.10);
    expect(t.hypertrophyVl).toBe(0.60);
  });

  it('checks if VL is acceptable for strength', () => {
    updateVlThreshold('chest', 0.20, 0.25);
    expect(isVlAcceptable('chest', 0.18, 'strength')).toBe(true);
    expect(isVlAcceptable('chest', 0.22, 'strength')).toBe(false);
  });

  it('checks if VL is acceptable for hypertrophy', () => {
    updateVlThreshold('chest', 0.20, 0.25);
    expect(isVlAcceptable('chest', 0.24, 'hypertrophy')).toBe(true);
    expect(isVlAcceptable('chest', 0.28, 'hypertrophy')).toBe(false);
  });

  it('returns all thresholds', () => {
    updateVlThreshold('chest', 0.18, 0.28);
    updateVlThreshold('back', 0.19, 0.29);
    expect(getAllVlThresholds()).toHaveLength(2);
  });

  it('clears all thresholds', () => {
    updateVlThreshold('chest', 0.18, 0.28);
    clearVlThresholds();
    expect(getAllVlThresholds()).toHaveLength(0);
  });
});
