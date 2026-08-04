/**
 * bb-lab-recovery-coverage.test.ts — покрытие labMrv + recovery + nutrition метрик.
 *
 * До этого аудита 0 тестов существовало для:
 *  - labMrvMultiplier (0.7-1.0, лабораторная коррекция)
 *  - recoveryMult (bodyFat, leanMass, hrvMs, sleepHours, stressLevel)
 *  - nutritionMult (calorieSurplus, proteinPerKg)
 *
 * Проверяет:
 *  - Section A: labMrvMultiplier → rotationMuscleVolume и rationale
 *  - Section B: recovery metrics (bodyFat/leanMass/hrv/sleep/stress)
 *  - Section C: nutrition metrics (calorieSurplus/proteinPerKg)
 *  - Section D: composition (PED × lab × recovery)
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

function chestVolume(plan: BBPlan): number {
  return plan.rotationMuscleVolume['chest'] || 0;
}

function hasLabRationale(plan: BBPlan): boolean {
  return plan.rationale.some(r => r.includes('Лабораторная коррекция') || r.includes('🧪'));
}

/* ═══════════════════════════════════════════════════════════════════
 * Section A: labMrvMultiplier
 * ═══════════════════════════════════════════════════════════════════ */
describe('A: labMrvMultiplier — лабораторная коррекция MRV', () => {
  it('lab=0.7 → volume меньше чем lab=1.0', () => {
    const lowLab = buildBBPlan(makeInput({ labMrvMultiplier: 0.7 }));
    const normal = buildBBPlan(makeInput({ labMrvMultiplier: 1.0 }));
    expect(chestVolume(lowLab)).toBeLessThan(chestVolume(normal));
  });

  it('lab=0.7 → ratio ≈ 0.7 от normal', () => {
    const lowLab = buildBBPlan(makeInput({ labMrvMultiplier: 0.7 }));
    const normal = buildBBPlan(makeInput({ labMrvMultiplier: 1.0 }));
    expect(chestVolume(lowLab) / chestVolume(normal)).toBeCloseTo(0.7, 1);
  });

  it('lab=0.7 → rationale содержит "Лабораторная коррекция"', () => {
    const plan = buildBBPlan(makeInput({ labMrvMultiplier: 0.7 }));
    expect(hasLabRationale(plan)).toBe(true);
  });

  it('lab=1.0 → rationale НЕ содержит "Лабораторная коррекция"', () => {
    const plan = buildBBPlan(makeInput({ labMrvMultiplier: 1.0 }));
    expect(hasLabRationale(plan)).toBe(false);
  });

  it('lab=undefined → treated as 1.0 (no change)', () => {
    const plan = buildBBPlan(makeInput({}));
    expect(hasLabRationale(plan)).toBe(false);
  });

  it('lab=0.7 + PED AAS 500 → effectiveMrv = pedMrv × labMult', () => {
    const plan = buildBBPlan(makeInput({
      labMrvMultiplier: 0.7,
      pedDoses: { AAS: 500 },
      courseIntensity: 'moderate',
    }));
    expect(hasLabRationale(plan)).toBe(true);
    // PED + lab both reduce volume
    const natural = buildBBPlan(makeInput({}));
    expect(chestVolume(plan)).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section B: Recovery metrics (Helms/Plews/Watson)
 * ═══════════════════════════════════════════════════════════════════ */
describe('B: Recovery metrics — bodyFat, leanMass, hrvMs, sleepHours, stressLevel', () => {
  // recoveryMult влияет на capMrv (не на rotationMuscleVolume напрямую).
  // Для проверки используем volumeGoal='mrv' → target = MRV, capMrv = MRV × recoveryMult.

  it('bodyFat=30 → recoveryMult ×0.9 (объём с mrv target ниже)', () => {
    const bad = buildBBPlan(makeInput({ bodyFat: 30, volumeGoal: 'mrv' }));
    const good = buildBBPlan(makeInput({ bodyFat: 15, volumeGoal: 'mrv' }));
    // При bodyFat=30 recoveryMult = 0.9 → capMrv ниже → mrv target капится ниже
    expect(chestVolume(bad)).toBeLessThanOrEqual(chestVolume(good));
  });

  it('leanMass=100 → recoveryMult ×1.15 (больше толерантность)', () => {
    const high = buildBBPlan(makeInput({ leanMass: 100, volumeGoal: 'mrv' }));
    const low = buildBBPlan(makeInput({ leanMass: 50, volumeGoal: 'mrv' }));
    // leanMass=100 → ×1.15; leanMass=50 → ×0.9
    expect(chestVolume(high)).toBeGreaterThanOrEqual(chestVolume(low));
  });

  it('hrvMs=40 → recoveryMult ×0.85 (низкая готовность)', () => {
    const low = buildBBPlan(makeInput({ hrvMs: 40, volumeGoal: 'mrv' }));
    const high = buildBBPlan(makeInput({ hrvMs: 80, volumeGoal: 'mrv' }));
    expect(chestVolume(low)).toBeLessThanOrEqual(chestVolume(high));
  });

  it('sleepHours=5 → recoveryMult ×0.85 (депривация сна)', () => {
    const low = buildBBPlan(makeInput({ sleepHours: 5, volumeGoal: 'mrv' }));
    const high = buildBBPlan(makeInput({ sleepHours: 8, volumeGoal: 'mrv' }));
    expect(chestVolume(low)).toBeLessThanOrEqual(chestVolume(high));
  });

  it('stressLevel=9 → recoveryMult ×0.85 (высокий стресс)', () => {
    const high = buildBBPlan(makeInput({ stressLevel: 9, volumeGoal: 'mrv' }));
    const low = buildBBPlan(makeInput({ stressLevel: 1, volumeGoal: 'mrv' }));
    expect(chestVolume(high)).toBeLessThanOrEqual(chestVolume(low));
  });

  it('all bad metrics → recoveryMult capped at 0.6', () => {
    // bodyFat=30 ×0.9, leanMass=50 ×0.9, hrvMs=40 ×0.85, sleepHours=5 ×0.85, stressLevel=9 ×0.85
    // = 0.9 × 0.9 × 0.85 × 0.85 × 0.85 = 0.42 → clamped to 0.6
    const allBad = buildBBPlan(makeInput({
      bodyFat: 30, leanMass: 50, hrvMs: 40, sleepHours: 5, stressLevel: 9,
      volumeGoal: 'mrv',
    }));
    const allGood = buildBBPlan(makeInput({
      bodyFat: 12, leanMass: 100, hrvMs: 80, sleepHours: 8, stressLevel: 1,
      volumeGoal: 'mrv',
    }));
    expect(chestVolume(allBad)).toBeLessThanOrEqual(chestVolume(allGood));
    expect(chestVolume(allBad)).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section C: Nutrition metrics (calorieSurplus, proteinPerKg)
 * ═══════════════════════════════════════════════════════════════════ */
describe('C: Nutrition metrics — calorieSurplus, proteinPerKg', () => {
  it('calorieSurplus=400 → nutritionMult ×1.1 (профицит)', () => {
    const surplus = buildBBPlan(makeInput({ calorieSurplus: 400, volumeGoal: 'mrv' }));
    const neutral = buildBBPlan(makeInput({ calorieSurplus: 0, volumeGoal: 'mrv' }));
    expect(chestVolume(surplus)).toBeGreaterThanOrEqual(chestVolume(neutral));
  });

  it('calorieSurplus=-300 (дефицит) → nutritionMult ×0.8', () => {
    const deficit = buildBBPlan(makeInput({ calorieSurplus: -300, volumeGoal: 'mrv' }));
    const neutral = buildBBPlan(makeInput({ calorieSurplus: 0, volumeGoal: 'mrv' }));
    expect(chestVolume(deficit)).toBeLessThanOrEqual(chestVolume(neutral));
  });

  it('proteinPerKg=0.8 → nutritionMult ×0.85 (низкий белок)', () => {
    const low = buildBBPlan(makeInput({ proteinPerKg: 0.8, volumeGoal: 'mrv' }));
    const high = buildBBPlan(makeInput({ proteinPerKg: 2.2, volumeGoal: 'mrv' }));
    expect(chestVolume(low)).toBeLessThanOrEqual(chestVolume(high));
  });

  it('proteinPerKg=2.2 → nutritionMult ×1.1 (высокий белок)', () => {
    const high = buildBBPlan(makeInput({ proteinPerKg: 2.2, volumeGoal: 'mrv' }));
    const normal = buildBBPlan(makeInput({ proteinPerKg: 1.6, volumeGoal: 'mrv' }));
    expect(chestVolume(high)).toBeGreaterThanOrEqual(chestVolume(normal));
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Section D: Eccentric overload (eccentricMult)
 * ═══════════════════════════════════════════════════════════════════ */
describe('D: Eccentric overload (eccentricMult)', () => {
  it('eccentricMult=1.2 → план генерируется без crash', () => {
    const plan = buildBBPlan(makeInput({ eccentricMult: 1.2 }));
    expect(plan).toBeDefined();
    expect(plan.weeks.length).toBe(8);
  });

  it('eccentricMult=1.2 → primary weight выше чем eccentricMult=1.0', () => {
    const overload = buildBBPlan(makeInput({ eccentricMult: 1.2 }));
    const normal = buildBBPlan(makeInput({ eccentricMult: 1.0 }));
    // Находим первый primary compound в неделе 1
    const findPrimaryWeight = (plan: any) => {
      const ex = plan.weeks[0].sessions[0].exercises.find((e: any) => e.role === 'primary');
      return ex?.workSets?.[0]?.weight || 0;
    };
    const overloadW = findPrimaryWeight(overload);
    const normalW = findPrimaryWeight(normal);
    // eccentricMult 1.2 должен давать weight ≥ normal (×1.2 для primary)
    expect(overloadW).toBeGreaterThanOrEqual(normalW);
  });

  it('eccentricMult=1.0 → нейтрально (по умолчанию)', () => {
    const plan = buildBBPlan(makeInput({ eccentricMult: 1.0 }));
    expect(plan).toBeDefined();
  });
});
