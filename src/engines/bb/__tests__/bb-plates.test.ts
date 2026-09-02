import { describe, it, expect } from 'vitest';
import { normalizePlates, isWeightReachable, roundToAvailablePlates, recommendPlatePreset, applyPlateRoundingToPlan, PLATE_SET_PRESETS } from '../bb-plates.engine';

const STANDARD = PLATE_SET_PRESETS.find(p => p.id === 'standard')!.plates; // [20,15,10,5,2.5,1.25]

describe('bb-plates', () => {
  it('normalizePlates: desc, dedup, убирает <=0', () => {
    expect(normalizePlates([5, 20, 5, 0, -1, 10])).toEqual([20, 10, 5]);
    expect(normalizePlates([])).toEqual([]);
    expect(normalizePlates(undefined)).toEqual([]);
  });

  it('isWeightReachable: 60 = 20+2×20, 62.5 = +2×1.25; 61 недостижим на стандарте', () => {
    expect(isWeightReachable(60, STANDARD, 20)).toBe(true);  // 60-20=40 → 20/side ×2
    expect(isWeightReachable(62.5, STANDARD, 20)).toBe(true); // 42.5 → 20+1.25
    expect(isWeightReachable(61, STANDARD, 20)).toBe(false);
  });

  it('roundToAvailablePlates: 61 → 60, 62 → 62.5, 100 → 100', () => {
    expect(roundToAvailablePlates(61, STANDARD, 20)).toBe(60);
    expect(roundToAvailablePlates(62, STANDARD, 20)).toBe(62.5);
    expect(roundToAvailablePlates(100, STANDARD, 20)).toBe(100);
  });

  it('roundToAvailablePlates: без пластин → fallback 2.5', () => {
    expect(roundToAvailablePlates(61, [], 20)).toBe(60);
    expect(roundToAvailablePlates(63, [], 20)).toBe(62.5);
  });

  it('recommendPlatePreset: машины → machine, штанга → standard', () => {
    expect(recommendPlatePreset(['штанга']).id).toBe('standard');
    expect(recommendPlatePreset(['машина', 'блок']).id).toBe('machine');
  });

  it('applyPlateRoundingToPlan: округляет веса, машины/без-пластин no-op', () => {
    const plan = { weeks: [{ sessions: [{ exercises: [
      { workSets: [{ weight: 61 }, { weight: 100 }] },
      { workSets: [{ weight: 62 }] },
    ] }] }] };
    const r = applyPlateRoundingToPlan(plan as any, STANDARD, 20);
    expect(r.changed).toBe(2); // 61→60, 62→62.5
    expect(plan.weeks[0].sessions[0].exercises[0].workSets![0].weight).toBe(60);
    expect(plan.weeks[0].sessions[0].exercises[1].workSets![0].weight).toBe(62.5);
    expect(plan.weeks[0].sessions[0].exercises[0].workSets![1].weight).toBe(100);
    // no-op без пластин
    expect(applyPlateRoundingToPlan(plan as any, undefined, 20).changed).toBe(0);
  });
});
