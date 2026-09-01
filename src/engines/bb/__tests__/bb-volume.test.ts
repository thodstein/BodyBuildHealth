import { describe, expect, it } from 'vitest';
import { aggregateBBVolume, buildBBVolumeTarget, exerciseVolumeContributions, normalizeBBMuscle, computeMrvMult, computeRegimeMrvMult } from '../bb-volume.engine';

describe('BB volume model', () => {
  it('normalizes granular shoulder keys to the canonical group', () => {
    expect(normalizeBBMuscle(' Shoulders ')).toBe('shoulders');
    expect(normalizeBBMuscle('delts')).toBe('shoulders');
  });

  it('PPL per-head: delt_rear остаётся гранулярным ключом (не коллапсирует)', () => {
    // PPL fix (fabdc8245): объём плеч считается по головкам (delt_front/mid/rear),
    // а не суммой в shoulders — иначе 4×/нед плеч в PPL дают ложный overflow.
    expect(normalizeBBMuscle('delt_rear')).toBe('delt_rear');
    expect(normalizeBBMuscle('delt_mid')).toBe('delt_mid');
    expect(normalizeBBMuscle('delt_front')).toBe('delt_front');
  });

  it('keeps direct sets and adds conservative indirect contribution', () => {
    const contributions = exerciseVolumeContributions({
      name: 'Жим штанги лёжа', muscle: 'chest', type: 'compound', sets: 4,
    });
    expect(contributions[0]).toMatchObject({ muscle: 'chest', directSets: 4, effectiveSets: 4 });
    // triceps от жимов: 4 × 0.45 = 1.8
    expect(contributions.find(c => c.muscle === 'triceps')?.effectiveSets).toBeCloseTo(1.8);
  });

  it('does not add indirect volume to isolation', () => {
    const contributions = exerciseVolumeContributions({
      name: 'Разгибание рук на блоке', muscle: 'triceps', type: 'isolation', sets: 3,
    });
    expect(contributions).toHaveLength(1);
  });

  it('aggregates direct and effective volume separately', () => {
    const totals = aggregateBBVolume([{ exercises: [
      { name: 'Жим лёжа', muscle: 'chest', type: 'compound', sets: 4 },
      { name: 'Разгибание рук на блоке', muscle: 'triceps', type: 'isolation', sets: 3 },
    ] }]);
    expect(totals.chest.directSets).toBe(4);
    expect(totals.triceps.directSets).toBe(3);
    // 3 direct + 4×0.45 от жима = 4.8
    expect(totals.triceps.effectiveSets).toBeCloseTo(4.8);
  });

  it('builds a capped target before exercise selection', () => {
    const target = buildBBVolumeTarget({
      muscle: 'chest', frequency: 2, landmarks: { mev: 8, mav: 14, mrv: 20 },
      volumeGoal: 'mav', weakPoint: true, recoveryMultiplier: 0.8,
    });
    expect(target.targetSets).toBeLessThanOrEqual(16);
    expect(target.targetSets).toBeGreaterThanOrEqual(target.mev);
    expect(target.minSetsPerSession).toBeGreaterThanOrEqual(2);
    expect(target.rationale).toContain('weak-point multiplier ×1.2');
  });
});


describe('computeMrvMult — единый MRV-конвейер (Фаза 2.11)', () => {
  it('натурал → 1.0', () => {
    expect(computeMrvMult({ onCourse: false })).toBe(1.0);
  });
  it('на курсе без doseAware → плоский ×2.0 (прежнее поведение)', () => {
    expect(computeMrvMult({ onCourse: true })).toBe(2.0);
    expect(computeMrvMult({ onCourse: true })).toBe(computeRegimeMrvMult({ onCourse: true }));
  });
  it('на курсе с doseAware → отслеживает PED-кривую (нижний флор 1.9)', () => {
    expect(computeMrvMult({ onCourse: true, doseAwareMrv: 2.0 })).toBe(2.0);
    expect(computeMrvMult({ onCourse: true, doseAwareMrv: 1.3 })).toBe(1.9);
  });
  it('не на курсе, но doseAware передан → 1.0', () => {
    expect(computeMrvMult({ onCourse: false, doseAwareMrv: 2.0 })).toBe(1.0);
  });
  it('тяжёлая интенсивность даёт чуть выше (≤2.15)', () => {
    expect(computeMrvMult({ onCourse: true, courseIntensity: 'heavy' })).toBeLessThanOrEqual(2.15);
    expect(computeMrvMult({ onCourse: true, courseIntensity: 'heavy' })).toBeGreaterThan(2.0);
  });
});
