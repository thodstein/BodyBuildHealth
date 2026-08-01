import { describe, expect, it } from 'vitest';
import { generateMesocycleProgression, generateInterMesocycleProgression, taperCurve, phaseDistribution } from '../mesocycle-progression.engine';

describe('mesocycle progression', () => {
  it('generates phases, volume and intensity', () => {
    const weeks = generateMesocycleProgression({ weeks: 12, startVolumeSets: 12, startIntensityPct: 0.75, startRIR: 3, goal: 'strength' });
    expect(weeks).toHaveLength(12);
    expect(weeks[0].volumeSets).toBe(12);
    expect(weeks.every(w => w.volumeMultiplier >= 0.4 && w.volumeMultiplier <= 1.25)).toBe(true);
    const deload = weeks.find(w => w.phase === 'deload');
    expect(deload).toBeTruthy();
    expect(deload!.rir).toBe(4);
  });
  it('applies fatigue reduction', () => {
    const weeks = generateMesocycleProgression({ weeks: 6, startVolumeSets: 12, startIntensityPct: 0.75, startRIR: 3, goal: 'hypertrophy', fatigueTrajectory: [0, 0, 80, 0, 0, 0] });
    expect(weeks[2].fatigueAdjusted).toBe(true);
  });
  it('progresses between mesocycles and creates taper', () => {
    const inter = generateInterMesocycleProgression({ weeks: 4, startVolumeSets: 12, startIntensityPct: 0.75, startRIR: 3, goal: 'strength' }, 3);
    expect(inter).toHaveLength(3);
    expect(inter[2].startVolumeSets).toBeGreaterThan(inter[0].startVolumeSets);
    const taper = taperCurve(3);
    expect(taper).toHaveLength(3);
    expect(taper[2].volumePctOfPeak).toBeLessThan(taper[0].volumePctOfPeak);
  });
  it('distributes phases across weeks', () => {
    const dist = phaseDistribution(12);
    expect(Object.values(dist).reduce((a, b) => a + b, 0)).toBe(12);
  });
});
