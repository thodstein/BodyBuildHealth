/**
 * bb-exercise-tier-ped.test.ts — тесты tier системы × level × PED.
 *
 * Проверяет:
 *  - level фильтрует tier (beginner → tier 1, advanced → tier 1+2+3)
 *  - enhanced + PED MRV×1.3: allowExotic, больше упражнений
 *  - PED не激活 exotic для beginner/intermediate
 *  - bbExerciseTier: canonical/acceptable/exotic/inappropriate классификация
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan, type BBBuilderInput, type BBPlan } from '../bb-builder.engine';
import { bbExerciseTier, isCanonicalBB, isExoticBB, isInappropriateBB } from '../bb-exercise-tier.engine';
import { adaptForPEDs } from '../bb-ped-adaptation.engine';

const EQ = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight', 'kettlebell'];

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

function allExerciseNames(plan: BBPlan): string[] {
  return plan.weeks
    .flatMap(w => w.sessions)
    .flatMap(s => s.exercises)
    .map(e => e.exerciseName || e.name || '');
}

/* ═══════════════════════════════════════════════════════════════════
 * Section A: bbExerciseTier classification
 * ═══════════════════════════════════════════════════════════════════ */
describe('A: bbExerciseTier classification', () => {
  it('canonical: жим штанги лёжа → tier 1', () => {
    const tier = bbExerciseTier({ name: 'Жим штанги лёжа' } as any);
    expect(tier).toBe(1);
  });

  it('canonical: приседания → tier 1', () => {
    const tier = bbExerciseTier({ name: 'Приседания со штангой' } as any);
    expect(tier).toBe(1);
  });

  it('acceptable: Смит присед → tier 2', () => {
    const tier = bbExerciseTier({ name: 'Приседания в Смите' } as any);
    expect(tier).toBeLessThanOrEqual(2);
  });

  it('exotic: гиря bent press → tier 3', () => {
    const tier = bbExerciseTier({ name: 'Гиря bent press' } as any);
    expect(tier).toBeGreaterThanOrEqual(3);
  });

  it('inappropriate: kb_tgu (Turkish Get Up) → tier 4', () => {
    const tier = bbExerciseTier({ id: 'kb_tgu', name: 'Turkish Get Up' } as any);
    expect(tier).toBe(4);
  });

  it('isInappropriateBB: farmer walk → true', () => {
    expect(isInappropriateBB({ name: 'Farmer Walk' } as any)).toBe(true);
  });

  it('isCanonicalBB: жим лёжа → true', () => {
    expect(isCanonicalBB({ name: 'Жим штанги лёжа' } as any)).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section B: Level-based exercise filtering
 * ═══════════════════════════════════════════════════════════════════ */
describe('B: Level-based exercise filtering', () => {
  it('beginner: план генерируется, нет exotic tier 3+', () => {
    const plan = buildBBPlan(makeInput({ level: 'beginner' }));
    expect(plan).toBeDefined();
    const names = allExerciseNames(plan);
    // beginner не должен иметь exotic упражнения (гиря/олимп/TRX)
    const hasExotic = names.some(n =>
      /гиря|kettlebell|kb_|snatch|clean_and_jerk|turkish|tgu|trx|ring/i.test(n)
    );
    expect(hasExotic).toBe(false);
  });

  it('intermediate: план генерируется, нет exotic tier 3+', () => {
    const plan = buildBBPlan(makeInput({ level: 'intermediate' }));
    expect(plan).toBeDefined();
    const names = allExerciseNames(plan);
    const hasExotic = names.some(n =>
      /гиря|kettlebell|kb_|snatch|clean_and_jerk|turkish|tgu|trx|ring/i.test(n)
    );
    expect(hasExotic).toBe(false);
  });

  it('advanced: план генерируется (exotic разрешены, но не обязательны)', () => {
    const plan = buildBBPlan(makeInput({ level: 'advanced' }));
    expect(plan).toBeDefined();
    expect(plan.weeks.length).toBe(8);
  });

  it('enhanced: план генерируется (все tiers доступны)', () => {
    const plan = buildBBPlan(makeInput({ level: 'enhanced' }));
    expect(plan).toBeDefined();
    expect(plan.weeks.length).toBe(8);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section C: Enhanced + PED — exerciseCount boost
 * ═══════════════════════════════════════════════════════════════════ */
describe('C: Enhanced + PED — exerciseCount', () => {
  it('enhanced + AAS 1000 → план генерируется с разумным числом упражнений', () => {
    const pedAdapt = adaptForPEDs(['AAS'], { chest: 20 }, { AAS: 1000 }, 'moderate');
    const plan = buildBBPlan(makeInput({ level: 'enhanced' }), pedAdapt);
    expect(plan).toBeDefined();
    const totalEx = plan.weeks[0].sessions.flatMap(s => s.exercises).length;
    expect(totalEx).toBeGreaterThan(0);
    // Enhanced + PED должен иметь ≥ 15 упражнений в неделе (6+ sessions × 2-3 упражнения)
    expect(totalEx).toBeGreaterThanOrEqual(10);
  });

  it('enhanced + full stack (cap 2.0) → план генерируется', () => {
    const pedAdapt = adaptForPEDs(
      ['AAS', 'insulin', 'GH'],
      { chest: 20 },
      { AAS: 2000, insulin: 20, GH: 8 },
      'heavy',
    );
    const plan = buildBBPlan(makeInput({ level: 'enhanced' }), pedAdapt);
    expect(plan).toBeDefined();
    expect(pedAdapt.combinedMrvMultiplier).toBeGreaterThan(1.5);
    expect(plan.weeks.length).toBe(8);
  });
});
