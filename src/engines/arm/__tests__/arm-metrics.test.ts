import { describe, it, expect } from 'vitest';
import { calcArmMetrics, armMetricsSummary } from '../arm-metrics.engine';

/** Недельный гард: tendon 22 / side 9 — метрика обязана быть максимумом по неделям, не суммой плана. */
function syntheticPlan(tendonSetsPerWeek: number, sideSetsPerWeek = 0): any {
  const weeks = Array.from({ length: 8 }, (_, i) => ({
    week: i + 1,
    phase: 'accumulation',
    sessions: [
      {
        day: 1,
        sessionTag: 'test',
        character: 'тяж',
        exercises: [
          { id: 't', name: 'Wrist curl', muscle: 'wrist_flexors', sets: tendonSetsPerWeek, rir: 2, isTable: false },
          ...(sideSetsPerWeek > 0
            ? [
                {
                  id: 's',
                  name: 'Side pressure',
                  muscle: 'side_pressure',
                  sets: sideSetsPerWeek,
                  rir: 2,
                  isTable: false,
                },
              ]
            : []),
        ],
      },
    ],
  }));
  return { weeks };
}

describe('arm-metrics: недельные гарды', () => {
  it('было→стало: 8 нед × 8 tendon-сетов = пик 8, а не сумма 64', () => {
    const m = calcArmMetrics(syntheticPlan(8));
    expect(m.tendonLoad).toBe(8);
    expect(m.sidePressureLoad).toBe(0);
    expect(armMetricsSummary(m).join(' ')).toContain('пиковая неделя');
  });

  it('sidePressureLoad — тоже максимум по неделям', () => {
    const m = calcArmMetrics(syntheticPlan(4, 9));
    expect(m.sidePressureLoad).toBe(9);
  });
});
