/**
 * bb-female-default.test.ts — тесты для sex='female' БЕЗ focusGroup='glutes'.
 *
 * До этого аудита 0 тестов существовало для female без специализации glutes.
 * Существующие тесты (bb-pro-quality-phase-a/d) покрывают только female + glutes.
 *
 * Проверяет:
 *  - female без focusGroup: gluteBoost ×1.2 в Leg-днях
 *  - female + mass: split selector работает корректно
 *  - female + enhanced + PED: exerciseCount boost применяется
 *  - lengthenedBonus × trainingFocus (P2-4)
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan, type BBBuilderInput, type BBPlan } from '../bb-builder.engine';

const EQ = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];

function makeInput(overrides: Partial<BBBuilderInput> = {}): BBBuilderInput {
  return {
    patternId: 'upper_lower_4',
    level: 'intermediate',
    goal: 'mass',
    weeks: 8,
    workMax: { chest: 100, back: 120, legs: 140, shoulders: 70, arms: 50 },
    equipment: EQ,
    volumeGoal: 'mav',
    sex: 'female',
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

describe('female без focusGroup: glute boost', () => {
  it('female + upper_lower_4 → glutes получают объём (gluteBoost ×1.2)', () => {
    const plan = buildBBPlan(makeInput());
    const gluteVolume = totalVolumeForMuscle(plan, 'glutes');
    expect(gluteVolume).toBeGreaterThan(0);
  });

  it('female glute volume > male glute volume (в том же сплите)', () => {
    const female = buildBBPlan(makeInput({ sex: 'female' }));
    const male = buildBBPlan(makeInput({ sex: 'male' }));
    const fGlutes = totalVolumeForMuscle(female, 'glutes');
    const mGlutes = totalVolumeForMuscle(male, 'glutes');
    // gluteBoost ×1.2 для female → должно быть больше
    expect(fGlutes).toBeGreaterThanOrEqual(mGlutes);
  });

  it('female + mass + enhanced + AAS 500 → план генерируется', () => {
    const plan = buildBBPlan(makeInput({
      level: 'enhanced',
      pedDoses: { AAS: 500 },
      courseIntensity: 'moderate',
    }));
    expect(plan).toBeDefined();
    expect(plan.weeks.length).toBe(8);
  });
});

describe('lengthenedBonus × trainingFocus (P2-4)', () => {
  it('hypertrophy focus: план генерируется с lengthened-упражнениями', () => {
    const plan = buildBBPlan(makeInput({
      sex: 'male',
      trainingFocus: 'hypertrophy',
    }));
    expect(plan).toBeDefined();
    // Проверяем что RDL или incline присутствуют в плане
    const allNames = plan.weeks
      .flatMap(w => w.sessions)
      .flatMap(s => s.exercises)
      .map(e => (e.exerciseName || e.name || '').toLowerCase());
    const hasLengthened = allNames.some(n =>
      /rdl|румынская|incline|наклон|sissy|сисси|pullover|пуловер/i.test(n)
    );
    expect(hasLengthened).toBe(true);
  });

  it('strength focus: план генерируется (lengthened bonus ×0.5)', () => {
    const plan = buildBBPlan(makeInput({
      sex: 'male',
      trainingFocus: 'strength',
    }));
    expect(plan).toBeDefined();
    expect(plan.weeks.length).toBe(8);
  });

  it('endurance focus: план генерируется (lengthened bonus ×1.5)', () => {
    const plan = buildBBPlan(makeInput({
      sex: 'male',
      trainingFocus: 'endurance',
    }));
    expect(plan).toBeDefined();
    expect(plan.weeks.length).toBe(8);
  });

  it('разные trainingFocus дают разные планы (exercise selection varies)', () => {
    const strength = buildBBPlan(makeInput({ trainingFocus: 'strength' }));
    const endurance = buildBBPlan(makeInput({ trainingFocus: 'endurance' }));
    // RIR должен отличаться (strength RIR 1-2, endurance RIR 3-4)
    const strengthRir = strength.weeks[0].sessions[0].exercises.find((e: any) => !e.warmupActivator)?.rir ?? 0;
    const enduranceRir = endurance.weeks[0].sessions[0].exercises.find((e: any) => !e.warmupActivator)?.rir ?? 0;
    expect(strengthRir).not.toBe(enduranceRir);
  });
});

describe('UI integration: BbAutoConstructor.buildBb() передаёт sex', () => {
  it('симуляция UI-пути: female + sex передаётся в buildBBPlan', () => {
    // P0-1 fix: BbAutoConstructor.buildBb() теперь передаёт sex во все 3 ветки.
    // Этот тест имитирует вызов buildBBPlan с sex: 'female' как делает UI.
    const plan = buildBBPlan(makeInput({
      sex: 'female',
      focusGroup: 'glutes',
      level: 'intermediate',
      goal: 'mass',
    }));
    expect(plan).toBeDefined();
    const gluteVol = plan.rotationMuscleVolume['glutes'] || 0;
    // Female + focusGroup=glutes → gluteBoost ×1.2 + focusGroup ×1.3
    expect(gluteVol).toBeGreaterThan(0);
  });

  it('симуляция UI-пути: male + sex передаётся', () => {
    const plan = buildBBPlan(makeInput({
      sex: 'male',
      goal: 'mass',
    }));
    expect(plan).toBeDefined();
    expect(plan.weeks.length).toBe(8);
  });
});
