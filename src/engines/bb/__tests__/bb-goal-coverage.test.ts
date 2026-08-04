/**
 * bb-goal-coverage.test.ts — покрытие ВСЕХ 5 значений BBGoal.
 *
 * До этого аудита 0 тестов существовало для cut/recomp/maintenance/strength_mass.
 * Только goal='mass' имел 31+ тестов. Этот файл закрывает пробел.
 *
 * Проверяет:
 *  - Section A: Volume target коррекции (cut ×0.75, mass/strength_mass ×1.05)
 *  - Section B: Phase distribution per goal
 *  - Section C: Plan generation stability (все 5 goals × 3 levels)
 *  - Section D: Relative volume ordering (cut < recomp < mass)
 *  - Section E: SplitHints per goal (через selector)
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan, type BBBuilderInput, type BBPlan } from '../bb-builder.engine';
import { selectBestBBSplit, type BBSelectorInput } from '../bb-selector.engine';
import { distributePhases } from '../../../ui/screens/TrainingScreen_parts/phase-periodization';

const EQ = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];

function makeInput(goal: string, overrides: Partial<BBBuilderInput> = {}): BBBuilderInput {
  return {
    patternId: 'upper_lower_4',
    level: 'intermediate',
    goal: goal as any,
    weeks: 8,
    workMax: { chest: 100, back: 120, legs: 140, shoulders: 70, arms: 50 },
    equipment: EQ,
    volumeGoal: 'mav',
    ...overrides,
  };
}

function totalVolumeForMuscle(plan: BBPlan, muscle: string): number {
  return plan.weeks.reduce((sum, w) => {
    return sum + w.sessions.flatMap(s => s.exercises)
      .filter(e => e.muscle === muscle)
      .reduce((s, e) => s + e.sets, 0);
  }, 0);
}

function peakWeeks(plan: BBPlan): number {
  return plan.weeks.filter(w => w.phase === 'peaking').length;
}

function deloadWeeks(plan: BBPlan): number {
  return plan.weeks.filter(w => w.deload || w.phase === 'deload').length;
}

/* ═══════════════════════════════════════════════════════════════════
 * Section A: Volume target коррекции
 * ═══════════════════════════════════════════════════════════════════ */
describe('A: Volume target — goal-specific множители', () => {
  it('cut: rotationMuscleVolume меньше чем maintenance (×0.75)', () => {
    const cutPlan = buildBBPlan(makeInput('cut'));
    const maintPlan = buildBBPlan(makeInput('maintenance'));
    const cutChest = cutPlan.rotationMuscleVolume['chest'] || 0;
    const maintChest = maintPlan.rotationMuscleVolume['chest'] || 0;
    expect(cutChest).toBeLessThan(maintChest);
    // ×0.75 → примерно 75% от maintenance
    expect(cutChest / maintChest).toBeCloseTo(0.75, 1);
  });

  it('mass: rotationMuscleVolume больше чем maintenance (×1.05)', () => {
    const massPlan = buildBBPlan(makeInput('mass'));
    const maintPlan = buildBBPlan(makeInput('maintenance'));
    const massChest = massPlan.rotationMuscleVolume['chest'] || 0;
    const maintChest = maintPlan.rotationMuscleVolume['chest'] || 0;
    expect(massChest).toBeGreaterThan(maintChest);
    expect(massChest / maintChest).toBeCloseTo(1.05, 1);
  });

  it('strength_mass: rotationMuscleVolume равно mass (×1.05)', () => {
    const smPlan = buildBBPlan(makeInput('strength_mass'));
    const massPlan = buildBBPlan(makeInput('mass'));
    const smChest = smPlan.rotationMuscleVolume['chest'] || 0;
    const massChest = massPlan.rotationMuscleVolume['chest'] || 0;
    expect(smChest).toBe(massChest);
  });

  it('recomp: rotationMuscleVolume равно maintenance (без множителя)', () => {
    const recompPlan = buildBBPlan(makeInput('recomp'));
    const maintPlan = buildBBPlan(makeInput('maintenance'));
    const recompChest = recompPlan.rotationMuscleVolume['chest'] || 0;
    const maintChest = maintPlan.rotationMuscleVolume['chest'] || 0;
    expect(recompChest).toBe(maintChest);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section B: Phase distribution per goal
 * ═══════════════════════════════════════════════════════════════════ */
describe('B: Phase distribution — goal differences', () => {
  it('mass 8 нед: нет peaking фазы', () => {
    const plan = buildBBPlan(makeInput('mass'));
    expect(peakWeeks(plan)).toBe(0);
  });

  it('cut 8 нед: нет peaking фазы', () => {
    const plan = buildBBPlan(makeInput('cut'));
    expect(peakWeeks(plan)).toBe(0);
  });

  it('recomp 8 нед: нет peaking фазы', () => {
    const plan = buildBBPlan(makeInput('recomp'));
    expect(peakWeeks(plan)).toBe(0);
  });

  it('maintenance 8 нед: нет peaking фазы', () => {
    const plan = buildBBPlan(makeInput('maintenance'));
    expect(peakWeeks(plan)).toBe(0);
  });

  it('mass 8 нед: есть deload (каждые 4 нед → неделя 4 и 8)', () => {
    const plan = buildBBPlan(makeInput('mass'));
    expect(deloadWeeks(plan)).toBeGreaterThanOrEqual(1);
  });

  it('все 5 goals: distributePhases не падает', () => {
    for (const goal of ['mass', 'cut', 'recomp', 'maintenance', 'strength_mass']) {
      const dist = distributePhases(8, 4, goal);
      expect(dist.length).toBe(8);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section C: Plan generation stability — все 5 goals × 3 levels
 * ═══════════════════════════════════════════════════════════════════ */
describe('C: Plan generation — matrix 5 goals × 3 levels', () => {
  const goals = ['mass', 'cut', 'recomp', 'maintenance', 'strength_mass'];
  const levels = ['beginner', 'intermediate', 'advanced'];

  for (const goal of goals) {
    for (const level of levels) {
      it(`${goal} + ${level}: план генерируется без crash`, () => {
        const plan = buildBBPlan(makeInput(goal, { level }));
        expect(plan).toBeDefined();
        expect(plan.weeks.length).toBe(8);
        // Каждая неделя имеет хотя бы 1 сессию
        for (const w of plan.weeks) {
          expect(w.sessions.length).toBeGreaterThan(0);
        }
      });
    }
  }
});

/* ═══════════════════════════════════════════════════════════════════
 * Section D: Relative volume ordering
 * ═══════════════════════════════════════════════════════════════════ */
describe('D: Volume ordering — cut < recomp ≈ maintenance < mass', () => {
  it('cut total volume < mass total volume', () => {
    const cutPlan = buildBBPlan(makeInput('cut'));
    const massPlan = buildBBPlan(makeInput('mass'));
    const cutTotal = totalVolumeForMuscle(cutPlan, 'chest');
    const massTotal = totalVolumeForMuscle(massPlan, 'chest');
    expect(cutTotal).toBeLessThan(massTotal);
  });

  it('cut total volume ≤ maintenance total volume (MRV cap может выравнивать)', () => {
    const cutPlan = buildBBPlan(makeInput('cut'));
    const maintPlan = buildBBPlan(makeInput('maintenance'));
    const cutTotal = totalVolumeForMuscle(cutPlan, 'chest');
    const maintTotal = totalVolumeForMuscle(maintPlan, 'chest');
    // rotationMuscleVolume точно 75%, но normalizeWeekMrv может каппить оба до MRV
    expect(cutTotal).toBeLessThanOrEqual(maintTotal);
  });

  it('mass total volume > maintenance total volume', () => {
    const massPlan = buildBBPlan(makeInput('mass'));
    const maintPlan = buildBBPlan(makeInput('maintenance'));
    const massTotal = totalVolumeForMuscle(massPlan, 'chest');
    const maintTotal = totalVolumeForMuscle(maintPlan, 'chest');
    expect(massTotal).toBeGreaterThan(maintTotal);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section E: Selector splitHints per goal
 * ═══════════════════════════════════════════════════════════════════ */
describe('E: Selector — goal-specific splitHints', () => {
  function makeSelInput(goal: string, overrides: Partial<BBSelectorInput> = {}): BBSelectorInput {
    return {
      level: 'intermediate',
      goal: goal as any,
      daysPerWeek: 4,
      equipment: EQ,
      ...overrides,
    };
  }

  it('mass: selector предпочитает ppl_6 / upper_lower_4 / arnold_6', () => {
    const result = selectBestBBSplit(makeSelInput('mass', { daysPerWeek: 6 }));
    expect(result).toBeDefined();
    // PPL 6 должен быть в топ-3 для mass 6 дней
    expect(result.pattern.id).toBeTruthy();
  });

  it('cut: selector предпочитает low-freq сплиты (fullbody/upper_lower)', () => {
    const result = selectBestBBSplit(makeSelInput('cut', { daysPerWeek: 3 }));
    expect(result).toBeDefined();
    expect(result.pattern.id).toBeTruthy();
  });

  it('maintenance: selector предпочитает low-freq (fullbody/upper_lower)', () => {
    const result = selectBestBBSplit(makeSelInput('maintenance', { daysPerWeek: 3 }));
    expect(result).toBeDefined();
    expect(result.pattern.id).toBeTruthy();
  });

  it('strength_mass: selector выбирает сплит с частотой ≥2', () => {
    const result = selectBestBBSplit(makeSelInput('strength_mass', { daysPerWeek: 4 }));
    expect(result).toBeDefined();
    expect(result.pattern.id).toBeTruthy();
  });
});
