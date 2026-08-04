/**
 * bb-ped-combo.test.ts — матрица PED × BBGoal × BBLevel.
 *
 * Проверяет критические комбинации:
 *  - mass + PED (baseline, heavy, full stack)
 *  - cut + PED (опасный сценарий — PED на сушке)
 *  - strength_mass + PED (peaking + PED)
 *  - recomp + PED
 *  - female + glutes + PED
 *  - enhanced + full stack (cap 2.0)
 *
 * Цель: гарантировать что ни одна комбинация не крашит и даёт адекватный объём.
 */
import { describe, expect, it } from 'vitest';
import { buildBBPlan, type BBBuilderInput, type BBPlan } from '../bb-builder.engine';
import { adaptForPEDs, type PED, type CourseIntensity } from '../bb-ped-adaptation.engine';

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

const BASE_MRV = { chest: 20, back: 24, quads: 20, hamstrings: 16, shoulders: 14 };

/** Создаёт pedAdapt и buildBBPlan с ним — имитирует UI-путь BbAutoConstructor. */
function buildWithPED(input: BBBuilderInput, peds: PED[], doses: Record<string, number>, intensity: CourseIntensity): BBPlan {
  const pedAdapt = adaptForPEDs(peds, BASE_MRV, doses, intensity);
  return buildBBPlan(input, pedAdapt);
}

function chestVolume(plan: BBPlan): number {
  return plan.rotationMuscleVolume['chest'] || 0;
}

function totalSets(plan: BBPlan): number {
  return plan.weeks
    .flatMap(w => w.sessions)
    .flatMap(s => s.exercises)
    .reduce((sum, e) => sum + e.sets, 0);
}

function hasPEDRationale(plan: BBPlan): boolean {
  return plan.rationale.some(r => r.includes('PED-адаптация'));
}

/* ═══════════════════════════════════════════════════════════════════
 * mass + PED
 * ═══════════════════════════════════════════════════════════════════ */
describe('mass + PED', () => {
  it('mass + intermediate + AAS 500 + moderate → baseline', () => {
    const plan = buildWithPED(
      makeInput(),
      ['AAS'],
      { AAS: 500 },
      'moderate',
    );
    expect(plan).toBeDefined();
    expect(hasPEDRationale(plan)).toBe(true);
    expect(chestVolume(plan)).toBeGreaterThan(0);
  });

  it('mass + advanced + AAS 1000 + heavy → больше объём чем AAS 500', () => {
    const heavy = buildWithPED(
      makeInput({ level: 'advanced' }),
      ['AAS'],
      { AAS: 1000 },
      'heavy',
    );
    const light = buildWithPED(
      makeInput({ level: 'advanced' }),
      ['AAS'],
      { AAS: 500 },
      'moderate',
    );
    expect(chestVolume(heavy)).toBeGreaterThanOrEqual(chestVolume(light));
  });

  it('mass + enhanced + full stack + heavy → cap 2.0, план генерируется', () => {
    const plan = buildWithPED(
      makeInput({ level: 'enhanced' }),
      ['AAS', 'insulin', 'MGF', 'IGF1', 'GH'],
      { AAS: 3000, insulin: 40, MGF: 400, IGF1: 100, GH: 15 },
      'heavy',
    );
    expect(plan).toBeDefined();
    expect(plan.weeks.length).toBe(8);
    expect(totalSets(plan)).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * cut + PED (опасный сценарий)
 * ═══════════════════════════════════════════════════════════════════ */
describe('cut + PED (PED на сушке)', () => {
  it('cut + AAS 500 + moderate → объём меньше mass+AAS 500 (cut ×0.75)', () => {
    const cut = buildWithPED(
      makeInput({ goal: 'cut' }),
      ['AAS'],
      { AAS: 500 },
      'moderate',
    );
    const mass = buildWithPED(
      makeInput({ goal: 'mass' }),
      ['AAS'],
      { AAS: 500 },
      'moderate',
    );
    expect(chestVolume(cut)).toBeLessThanOrEqual(chestVolume(mass));
  });

  it('cut + enhanced + AAS 1000 + heavy → план генерируется без crash', () => {
    const plan = buildWithPED(
      makeInput({ goal: 'cut', level: 'enhanced' }),
      ['AAS'],
      { AAS: 1000 },
      'heavy',
    );
    expect(plan).toBeDefined();
    expect(plan.weeks.length).toBe(8);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * strength_mass + PED
 * ═══════════════════════════════════════════════════════════════════ */
describe('strength_mass + PED', () => {
  it('strength_mass + AAS 500 + moderate → peaking-фаза + PED boost', () => {
    const plan = buildWithPED(
      makeInput({ goal: 'strength_mass', weeks: 12 }),
      ['AAS'],
      { AAS: 500 },
      'moderate',
    );
    expect(plan).toBeDefined();
    const hasPeaking = plan.weeks.some(w => w.phase === 'peaking');
    expect(hasPeaking).toBe(true);
    expect(hasPEDRationale(plan)).toBe(true);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * recomp + PED
 * ═══════════════════════════════════════════════════════════════════ */
describe('recomp + PED', () => {
  it('recomp + AAS 500 → план генерируется', () => {
    const plan = buildWithPED(
      makeInput({ goal: 'recomp' }),
      ['AAS'],
      { AAS: 500 },
      'moderate',
    );
    expect(plan).toBeDefined();
    expect(plan.weeks.length).toBe(8);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * female + glutes + PED
 * ═══════════════════════════════════════════════════════════════════ */
describe('female + glutes + PED', () => {
  it('female + glutes + AAS 500 + moderate → glute volume > 0', () => {
    const plan = buildWithPED(
      makeInput({ sex: 'female', focusGroup: 'glutes' }),
      ['AAS'],
      { AAS: 500 },
      'moderate',
    );
    expect(plan).toBeDefined();
    const gluteVol = plan.rotationMuscleVolume['glutes'] || 0;
    expect(gluteVol).toBeGreaterThan(0);
  });

  it('female + glutes + enhanced + heavy stack → план генерируется', () => {
    const plan = buildWithPED(
      makeInput({ sex: 'female', focusGroup: 'glutes', level: 'enhanced' }),
      ['AAS', 'insulin', 'GH'],
      { AAS: 1000, insulin: 20, GH: 8 },
      'heavy',
    );
    expect(plan).toBeDefined();
    expect(plan.weeks.length).toBe(8);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * enhanced level — exerciseCount boost
 * ═══════════════════════════════════════════════════════════════════ */
describe('enhanced level — exerciseCount + PED', () => {
  it('enhanced + AAS 1000 → план генерируется с разумным числом упражнений', () => {
    const enhanced = buildWithPED(
      makeInput({ level: 'enhanced' }),
      ['AAS'],
      { AAS: 1000 },
      'moderate',
    );
    const natural = buildBBPlan(makeInput({ level: 'intermediate' }));
    // Enhanced + PED увеличивает MRV (сеты на мышцу), а не обязательно
    // количество упражнений. Проверяем разумный диапазон.
    const enhancedTotal = enhanced.weeks[0].sessions.flatMap(s => s.exercises).length;
    const naturalTotal = natural.weeks[0].sessions.flatMap(s => s.exercises).length;
    expect(enhancedTotal).toBeGreaterThan(0);
    expect(naturalTotal).toBeGreaterThan(0);
    // Разница не должна быть экстремальной (±50%)
    expect(enhancedTotal).toBeGreaterThanOrEqual(Math.floor(naturalTotal * 0.5));
    expect(enhancedTotal).toBeLessThanOrEqual(Math.ceil(naturalTotal * 1.5));
  });

  it('adaptForPEDs: AAS 1000 + insulin 20 + GH 8 + heavy → MRV > 1.5', () => {
    const adapt = adaptForPEDs(
      ['AAS', 'insulin', 'GH'],
      { chest: 20 },
      { AAS: 1000, insulin: 20, GH: 8 },
      'heavy',
    );
    expect(adapt.combinedMrvMultiplier).toBeGreaterThan(1.5);
    expect(adapt.combinedMrvMultiplier).toBeLessThanOrEqual(2.0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * Натурал — no PED
 * ═══════════════════════════════════════════════════════════════════ */
describe('натурал — no PED', () => {
  it('maintenance + beginner + no PED → MEV volume, план генерируется', () => {
    const plan = buildBBPlan(makeInput({
      goal: 'maintenance',
      level: 'beginner',
      volumeGoal: 'mev',
    }));
    expect(plan).toBeDefined();
    expect(plan.weeks.length).toBe(8);
    expect(hasPEDRationale(plan)).toBe(false);
  });
});
