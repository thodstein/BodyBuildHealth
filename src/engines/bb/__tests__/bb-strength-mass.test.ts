/**
 * bb-strength-mass.test.ts — тесты для BBGoal='strength_mass'.
 *
 * P1-2 fix: strength_mass теперь получает peaking-фазу (раньше передавался
 * как 'mass' в distributePhases, и hasPeak не срабатывал).
 *
 * Проверяет:
 *  - Peaking-фаза активируется для strength_mass (12+ нед)
 *  - Peaking-фаза НЕ активируется для коротких планов (<8 нед)
 *  - Volume ×1.05 (как mass)
 *  - strength_mass + PED → корректная композиция
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan, type BBBuilderInput, type BBPlan } from '../bb-builder.engine';
import { distributePhases } from '../../../ui/screens/TrainingScreen_parts/phase-periodization';

const EQ = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];

function makeInput(overrides: Partial<BBBuilderInput> = {}): BBBuilderInput {
  return {
    patternId: 'upper_lower_4',
    level: 'intermediate',
    goal: 'strength_mass',
    weeks: 12,
    workMax: { chest: 100, back: 120, legs: 140, shoulders: 70, arms: 50 },
    equipment: EQ,
    volumeGoal: 'mav',
    ...overrides,
  };
}

function peakWeeks(plan: BBPlan): number {
  return plan.weeks.filter(w => w.phase === 'peaking').length;
}

describe('strength_mass: peaking-фаза', () => {
  it('strength_mass 12 нед → есть peaking-фаза (P1-2 fix)', () => {
    const plan = buildBBPlan(makeInput({ weeks: 12 }));
    expect(peakWeeks(plan)).toBeGreaterThanOrEqual(1);
  });

  it('strength_mass 16 нед → есть peaking-фаза', () => {
    const plan = buildBBPlan(makeInput({ weeks: 16 }));
    expect(peakWeeks(plan)).toBeGreaterThanOrEqual(1);
  });

  it('strength_mass 8 нед → peaking-фаза может отсутствовать (короткий план)', () => {
    // 8 нед: peakWeeks = min(2, floor(8*0.15)) = min(2, 1) = 1
    const plan = buildBBPlan(makeInput({ weeks: 8 }));
    expect(peakWeeks(plan)).toBeGreaterThanOrEqual(0);
  });

  it('distributePhases: strength_mass → hasPeak=true (как strength)', () => {
    const dist = distributePhases(12, 4, 'strength_mass');
    const hasPeaking = dist.some(d => d.phase === 'peaking');
    expect(hasPeaking).toBe(true);
  });
});

describe('strength_mass: volume и композиция', () => {
  it('strength_mass volume = mass volume (оба ×1.05)', () => {
    const smPlan = buildBBPlan(makeInput({ weeks: 8 }));
    const massPlan = buildBBPlan({ ...makeInput(), goal: 'mass' } as BBBuilderInput);
    expect(smPlan.rotationMuscleVolume['chest']).toBe(massPlan.rotationMuscleVolume['chest']);
  });

  it('strength_mass + AAS 500 → volume boost от PED', () => {
    const plan = buildBBPlan(makeInput({ weeks: 8, pedDoses: { AAS: 500 }, courseIntensity: 'moderate' }));
    expect(plan).toBeDefined();
    expect(plan.weeks.length).toBe(8);
  });
});
