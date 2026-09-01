import { describe, expect, it } from 'vitest';
import {
  collectPlanExercises,
  recalibratePlanWeights,
  autoCalibrateFromStored,
} from '../bb-weight-calibration.engine';
import type { BBPlan } from '../bb-types';

const plan = (): BBPlan => ({
  pattern: {} as any,
  rotationMuscleVolume: {},
  rationale: [],
  weeks: [
    {
      week: 1,
      phase: 'accumulation',
      sessions: [
        {
          day: 1,
          weekOffset: 1,
          character: 'тяж',
          sessionTag: 'Chest',
          exercises: [
            {
              muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 3,
              repsRange: [6, 8], rir: 2,
              workSets: [
                { reps: 8, rir: 2, weight: 80 },
                { reps: 8, rir: 2, weight: 82.5 },
                { reps: 8, rir: 2, weight: 85 },
              ],
              warmupSets: [{ load: 40, reps: 10 }],
            },
            {
              muscle: 'chest', name: 'Разводка гантелей лёжа', role: 'accessory', character: 'памп', sets: 2,
              repsRange: [12, 15], rir: 3,
              workSets: [
                { reps: 15, rir: 3, weight: 20 },
                { reps: 15, rir: 3, weight: 22.5 },
              ],
            },
          ],
        },
      ],
    },
    {
      week: 2,
      phase: 'intensification',
      sessions: [
        {
          day: 1,
          weekOffset: 2,
          character: 'тяж',
          sessionTag: 'Chest',
          exercises: [
            {
              muscle: 'chest', name: 'Жим лёжа', role: 'primary', character: 'тяж', sets: 3,
              repsRange: [4, 6], rir: 1,
              workSets: [
                { reps: 6, rir: 1, weight: 90 },
                { reps: 6, rir: 1, weight: 92.5 },
                { reps: 6, rir: 1, weight: 95 },
              ],
              warmupSets: [{ load: 50, reps: 8 }],
            },
          ],
        },
      ],
    },
  ],
});

describe('bb-weight-calibration.engine', () => {
  it('collectPlanExercises собирает уникальные упражнения с максимальным справочным весом', () => {
    const entries = collectPlanExercises(plan());
    expect(entries).toHaveLength(2);
    const bench = entries.find((e) => e.name === 'Жим лёжа')!;
    expect(bench.muscle).toBe('chest');
    expect(bench.role).toBe('primary');
    expect(bench.referenceWeight).toBe(95); // макс по всем неделям
    expect(bench.actualWeight).toBeNull();
    // сортировка: primary раньше accessory в одной мышце
    expect(entries[0].role).toBe('primary');
  });

  it('collectPlanExercises пустой план → []', () => {
    expect(collectPlanExercises(null)).toEqual([]);
  });

  it('recalibratePlanWeights масштабирует к фактическому весу, сохраняя прогрессию', () => {
    // Жим: макс 95 → фактический 100 → ratio = 100/95 ≈ 1.0526
    const entries = collectPlanExercises(plan()).map((e) =>
      e.name === 'Жим лёжа' ? { ...e, actualWeight: 100 } : e,
    );
    const res = recalibratePlanWeights(plan(), entries);
    expect(res.applied).toBe(2); // «Жим лёжа» в нед1 + нед2
    expect(res.skipped).toBe(1); // разводка без фактического
    // Справочный (макс) теперь = 100, прогрессия 85→95 (нед1) и 90→100 (нед2) сохранена
    const weeks = res.plan.weeks;
    const benchW1 = weeks[0].sessions[0].exercises.find((e) => e.name === 'Жим лёжа')!;
    const benchW2 = weeks[1].sessions[0].exercises.find((e) => e.name === 'Жим лёжа')!;
    expect(benchW2.workSets[2].weight).toBe(100);
    // ratio = 100/95
    const ratio = 100 / 95;
    expect(benchW1.workSets[0].weight).toBeCloseTo(80 * ratio, 1);
    expect(benchW1.workSets[2].weight).toBeCloseTo(85 * ratio, 1);
    expect(benchW1.warmupSets![0].load).toBeCloseTo(40 * ratio, 1);
    // разводка не тронута
    const fly = weeks[0].sessions[0].exercises.find((e) => e.name === 'Разводка гантелей лёжа')!;
    expect(fly.workSets[1].weight).toBe(22.5);
  });

  it('recalibratePlanWeights не мутирует исходный план', () => {
    const original = plan();
    const before = original.weeks[1].sessions[0].exercises[0].workSets[2].weight;
    const entries = collectPlanExercises(original).map((e) => ({ ...e, actualWeight: 120 }));
    recalibratePlanWeights(original, entries);
    expect(original.weeks[1].sessions[0].exercises[0].workSets[2].weight).toBe(before);
  });

  it('autoCalibrateFromStored применяет сохранённые веса и пропускает bodyweight', () => {
    const p = plan();
    const res = autoCalibrateFromStored(p, { 'Жим лёжа': 110 }, (name) => name.includes('Подтягивания'));
    expect(res.applied).toBe(2);
    const bench = res.plan.weeks[1].sessions[0].exercises.find((e) => e.name === 'Жим лёжа')!;
    expect(bench.workSets[2].weight).toBe(110);
  });

  it('autoCalibrateFromStored без данных не меняет план', () => {
    const p = plan();
    const res = autoCalibrateFromStored(p, undefined);
    expect(res.applied).toBe(0);
    expect(res.plan).toBe(p);
  });

  // Фаза 0 UI-flow: collect → calibrate round-trip сохраняет структуру и применяет реальные веса.
  it('round-trip: collectPlanExercises → recalibratePlanWeights применяет вес к плану', () => {
    const p = plan();
    const entries = collectPlanExercises(p);
    expect(entries.length).toBeGreaterThan(0);
    const targetId = entries[0].id;
    const res = recalibratePlanWeights(p, [{ id: targetId, name: entries[0].name, muscle: entries[0].muscle, role: entries[0].role, plannedWeight: entries[0].plannedWeight, actualWeight: 130 }]);
    expect(res.applied).toBeGreaterThan(0);
    // Все недели/сессии/упражнения сохранены (структура не тронута).
    expect(res.plan.weeks).toHaveLength(2);
    expect(res.plan.weeks[0].sessions[0].exercises).toHaveLength(2);
    // Вес применён где-то в плане.
    const flat = res.plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises);
    expect(flat.some(e => e.workSets?.some(ws => ws.weight === 130))).toBe(true);
  });

  // UI читает UnifiedSettings-вложенный workMaxByExercise и передаёт плоскую карту.
  it('UI-seam: вложенный training.workMaxByExercise → autoCalibrateFromStored (плоская карта)', () => {
    const profile: any = { settings: { training: { workMaxByExercise: { 'Жим лёжа': 120, bench_bar: 125 } } } };
    const flat = profile.settings.training.workMaxByExercise; // ровно как getProfile().settings.training.workMaxByExercise
    const res = autoCalibrateFromStored(plan(), flat, () => false);
    expect(res.applied).toBeGreaterThan(0);
  });
});
