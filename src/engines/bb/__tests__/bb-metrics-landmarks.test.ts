import { describe, expect, it } from 'vitest';
import { calcBBPlanMetrics } from '../bb-metrics.engine';

describe('BB metrics final landmarks parity', () => {
  it('uses final plan landmarks over a recalculated PED fallback', () => {
    const plan: any = {
      level: 'intermediate',
      pattern: { name: 'Test', sessionsPerRotation: 1 },
      weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [{
        muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 10,
        repsRange: [6, 8], rir: 2,
        workSets: Array.from({ length: 10 }, () => ({ reps: 8, rir: 2, weight: 80 })),
      }] }] }],
      volumeLandmarks: [{ group: 'chest', label: 'Грудь', sets: 10, mev: 5, mav: 7, mrv: 9, status: 'exceeding_mrv' }],
    };
    const chest = calcBBPlanMetrics(plan, 1.5).perMuscle.find(item => item.muscle === 'chest');
    expect(chest?.mev).toBe(5);
    expect(chest?.mav).toBe(7);
    expect(chest?.mrv).toBe(9);
    expect(chest?.status).toBe('exceeding_mrv');
  });

  it('treats effective volume exactly at MRV as approaching, not exceeding', () => {
    const plan: any = {
      level: 'intermediate',
      pattern: { name: 'Test', sessionsPerRotation: 1 },
      weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [{
        muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 9,
        repsRange: [6, 8], rir: 2,
        workSets: Array.from({ length: 9 }, () => ({ reps: 8, rir: 2, weight: 80 })),
      }] }] }],
      volumeLandmarks: [{ group: 'chest', label: 'Грудь', sets: 9, mev: 5, mav: 7, mrv: 9, status: 'approaching_mrv' }],
    };
    const chest = calcBBPlanMetrics(plan, 1.5).perMuscle.find(item => item.muscle === 'chest');
    expect(chest?.effectiveSets).toBe(9);
    expect(chest?.status).toBe('approaching_mrv');
  });

  it('classifies effective volume at MEV/MAV/MRV boundaries canonically', () => {
    // Границы канона checkVolumeStatus: < MEV — недотрен, MEV..MAV включительно —
    // оптимум, MAV..MRV включительно — около MRV, выше MRV — перегруз. План собираем
    // только с `sets`: effectiveSets в этом пути равен числу сетов.
    const plan = (sets: number): any => ({
      level: 'intermediate',
      pattern: { name: 'Test', sessionsPerRotation: 1 },
      weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'тяж', exercises: [{
        muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets,
        repsRange: [6, 8], rir: 2,
      }] }] }],
      volumeLandmarks: [{ group: 'chest', label: 'Грудь', sets, mev: 5, mav: 7, mrv: 9, status: 'optimal' }],
    });
    const cases: Array<[number, string]> = [
      [4.9, 'below_mev'],
      [5, 'optimal'],
      [6, 'optimal'],
      [7, 'optimal'],
      [7.1, 'approaching_mrv'],
      [9, 'approaching_mrv'],
      [9.1, 'exceeding_mrv'],
    ];
    for (const [sets, expected] of cases) {
      const chest = calcBBPlanMetrics(plan(sets)).perMuscle.find(item => item.muscle === 'chest');
      expect(chest?.effectiveSets, `effective sets ${sets}`).toBe(sets);
      expect(chest?.status, `status for effective sets ${sets}`).toBe(expected);
    }
  });

  it('seeded delt heads получают канон-статус вместо литерала below_mev', () => {
    // Изоляция на бицепс: косвенной нагрузки на плечи нет, поэтому все три
    // головки создаются fallback-веткой (shoulders-generic отсутствует).
    const plan = (landmarks?: any): any => ({
      level: 'intermediate',
      pattern: { name: 'Test', sessionsPerRotation: 1 },
      weeks: [{ week: 1, sessions: [{ day: 1, weekOffset: 1, character: 'памп', exercises: [{
        muscle: 'biceps', name: 'Подъём гантелей на бицепс', role: 'primary', character: 'памп', sets: 3,
        repsRange: [8, 12], rir: 2,
      }] }] }],
      ...(landmarks ? { volumeLandmarks: landmarks } : {}),
    });
    const normal = calcBBPlanMetrics(plan()).perMuscle;
    for (const head of ['delt_mid', 'delt_rear'] as const) {
      const row = normal.find(item => item.muscle === head)!;
      expect(row.mev, head).toBeGreaterThan(0);
      expect(row.effectiveSets, head).toBe(0);
      expect(row.status, head).toBe('below_mev');
    }
    // Вырожденные ориентиры {0,0,0}: 0 сетов не «ниже MEV», а ровно оптимум.
    const zero = calcBBPlanMetrics(plan([
      { group: 'delt_front', label: 'Передняя дельта', sets: 0, mev: 0, mav: 0, mrv: 0, status: 'optimal' },
      { group: 'delt_mid', label: 'Средняя дельта', sets: 0, mev: 0, mav: 0, mrv: 0, status: 'optimal' },
      { group: 'delt_rear', label: 'Задняя дельта', sets: 0, mev: 0, mav: 0, mrv: 0, status: 'optimal' },
    ])).perMuscle;
    for (const head of ['delt_front', 'delt_mid', 'delt_rear'] as const) {
      const row = zero.find(item => item.muscle === head)!;
      expect(row.status, head).toBe('optimal');
    }
  });
});
