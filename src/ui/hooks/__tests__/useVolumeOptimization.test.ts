import { describe, it, expect } from 'vitest';
import { computeMuscleStats, computeIntensityByDay, computeFreqByMuscle, type VolRow } from '../useVolumeOptimization';

const rows: VolRow[] = [
  { exerciseId: 'bench_bar', weight: 80, reps: 5, sets: 4, day: 1 },
  { exerciseId: 'row_bar', weight: 60, reps: 8, sets: 3, day: 2 },
  { exerciseId: 'bench_bar', weight: 70, reps: 8, sets: 3, day: 4 },
];

describe('useVolumeOptimization — чистые расчёты', () => {
  it('computeMuscleStats: сеты + MEV/MAV/MRV из справочника (английские группы)', () => {
    const m = computeMuscleStats(rows, 'intermediate');
    expect(m.chest).toBeDefined();
    expect(m.chest.sets).toBe(7); // 4 + 3
    expect(m.chest.mev).toBe(8);
    expect(m.chest.mav).toBe(14);
    expect(m.chest.mrv).toBe(20);
    expect(m.back.sets).toBe(3);
  });

  it('computeIntensityByDay: зоны %1RM по дням', () => {
    const d = computeIntensityByDay(rows, () => 100);
    expect(d[1].heavy).toBe(1600); // 80*5*4
    expect(d[2].medium).toBe(1440); // 60*8*3
    expect(d[4].medium).toBe(1680); // 70*8*3 (0.7 -> medium)
    expect(d[1].medium).toBe(0);
    expect(d[3].heavy).toBe(0);
  });

  it('computeFreqByMuscle: число дней на мышцу', () => {
    const f = computeFreqByMuscle(rows);
    expect(f.chest).toBe(2); // day1 + day4
    expect(f.back).toBe(1);
  });
});