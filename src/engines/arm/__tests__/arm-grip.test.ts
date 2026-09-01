import { describe, it, expect } from 'vitest';
import { GRIP_IMPLEMENTS, getGripSpec, gripVolumeFor, gripProgression, estimateGripMax } from '../arm-grip.engine';

describe('arm-grip', () => {
  it('Rolling Thunder spec', () => {
    const rt = GRIP_IMPLEMENTS.rolling_thunder;
    expect(rt.diameterMm).toBe(60);
    expect(rt.rotating).toBe(true);
    expect(rt.allowedGrips).toEqual(['DOH']);
    expect(rt.strapsAllowed).toBe(false);
  });
  it('Axle 58mm DOH no straps', () => {
    const ax = GRIP_IMPLEMENTS.apollon_axle;
    expect(ax.diameterMm).toBe(58);
    expect(ax.strapsAllowed).toBe(false);
  });
  it('Saxon pinch', () => {
    const s = GRIP_IMPLEMENTS.saxon_bar;
    expect(s.gripType).toBe('pinch');
  });
  it('getGripSpec', () => {
    expect(getGripSpec('rolling_thunder')?.name).toMatch(/Rolling Thunder/);
    expect(getGripSpec('unknown')).toBeUndefined();
  });
  it('volumeFor: support vs pinch', () => {
    const sup = gripVolumeFor('rolling_thunder','intermediate');
    const pinch = gripVolumeFor('saxon_bar','intermediate');
    expect(sup.sets).toBeGreaterThanOrEqual(pinch.sets);
  });
  it('progression: +2.5%/нед', () => {
    const w1 = gripProgression(1,100,'rolling_thunder');
    const w3 = gripProgression(3,100,'rolling_thunder');
    expect(w3).toBeGreaterThan(w1);
    expect(w1).toBe(100);
  });
  it('estimateGripMax', () => {
    expect(estimateGripMax(100,10,'rolling_thunder')).toBe(100);
    expect(estimateGripMax(100,20,'rolling_thunder')).toBeGreaterThan(100);
  });
});
