/**
 * bb-athlete-context.test.ts — свойство женского контекста BB-auto:
 *  - athleteMode/athleteContext не меняют объём, RIR, капы и состав плана;
 *  - контекст прозрачно сохраняется в плане и добавляет rationale/safety-подсказки;
 *  - legacy-вызовы (без context) остаются без новых полей.
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
    ...overrides,
  };
}

function totalVolume(plan: BBPlan): number {
  return plan.weeks.reduce((sum, w) => {
    return sum + w.sessions.flatMap(s => s.exercises)
      .filter(e => !(e as any).warmupActivator)
      .reduce((s, e) => s + e.sets, 0);
  }, 0);
}

function totalExercises(plan: BBPlan): number {
  return plan.weeks.reduce((sum, w) => sum + w.sessions.reduce((s, d) => s + d.exercises.length, 0), 0);
}

describe('female_context: no hidden volume/RIR change', () => {
  it('female_context не меняет объём/состав женского плана (только rationale)', () => {
    const base = buildBBPlan(makeInput({ sex: 'female' }));
    const ctx = buildBBPlan(makeInput({
      sex: 'female',
      athleteMode: 'female_context',
      athleteContext: { sex: 'female', athleteMode: 'female_context', trainingYears: 3 },
    }));
    expect(totalVolume(ctx)).toBe(totalVolume(base));
    expect(totalExercises(ctx)).toBe(totalExercises(base));
    expect(JSON.stringify(ctx.weeks)).toBe(JSON.stringify(base.weeks));
    expect(ctx.athleteMode).toBe('female_context');
    expect(ctx.rationale.some(r => r.includes('Женский контекст'))).toBe(true);
  });

  it('female_context на мужском профиле нормализуется в standard (без эффекта)', () => {
    const base = buildBBPlan(makeInput({ sex: 'male' }));
    const ctx = buildBBPlan(makeInput({
      sex: 'male',
      athleteMode: 'female_context',
      athleteContext: { sex: 'male', athleteMode: 'female_context' },
    }));
    expect(JSON.stringify(ctx.weeks)).toBe(JSON.stringify(base.weeks));
  });

  it('legacy-вызов без контекста не добавляет новые поля', () => {
    const plan = buildBBPlan(makeInput({ sex: 'female' }));
    expect(plan.athleteMode).toBeUndefined();
    expect(plan.athleteContext).toBeUndefined();
  });

  it('PED/recovery/стаж продолжают работать вместе с контекстом', () => {
    const plan = buildBBPlan(makeInput({
      sex: 'female',
      athleteMode: 'female_context',
      athleteContext: { sex: 'female', athleteMode: 'female_context', trainingYears: 5 },
      trainingYears: 5,
      pedDoses: { AAS: 500 },
      courseIntensity: 'moderate',
      hrvMs: 65,
      sleepHours: 7.5,
      stressLevel: 3,
      bodyFat: 22,
    }));
    expect(plan).toBeDefined();
    expect(plan.weeks.length).toBe(8);
    expect(plan.athleteMode).toBe('female_context');
    // Специфичная проверка: контекст не создаёт MRV-overflow в валидации.
    expect(plan.validation?.valid ?? true).toBe(true);
  });
});
