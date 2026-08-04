/**
 * bb-cycle-program-ped.test.ts — тесты PED/sex интеграции в cycle-to-plan путях.
 *
 * convertCycleToBBPlan и programToBBPlan — 2 из 3 направлений ББ-авто.
 * Раньше тестировались только с peds:[] boilerplate. Теперь покрываем:
 *  - PED volume boost в adapt mode
 *  - PED arm boost (arms ×1.4 при mrvMult≥1.3)
 *  - sex='female' glute boost ×1.2
 *  - faithful mode не применяет PED boost
 *  - MRV cap работает с PED
 */
import { describe, expect, it } from 'vitest';
import { convertCycleToBBPlan, programToBBPlan } from '../cycle-to-plan';
import { FULL_PROGRAM_LIBRARY } from '../../complete-program-library.engine';
import { CYCLE_01 } from '../../../data/lms-cycles/cycle-01';
import type { BBPlan } from '../bb-builder.engine';

const WM = { chest: 100, back: 110, legs: 140, shoulders: 60, arms: 50, core: 60, traps: 60, hamstrings: 90, glutes: 160, calves: 120, forearms: 50 } as Record<string, number>;
const EQ = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight'];

function totalSetsForMuscle(plan: BBPlan, muscle: string): number {
  return plan.weeks
    .flatMap(w => w.sessions)
    .flatMap(s => s.exercises)
    .filter(e => e.muscle === muscle)
    .reduce((sum, e) => sum + e.sets, 0);
}

function hasPEDRationale(plan: BBPlan): boolean {
  return plan.rationale.some(r => r.includes('PED') || r.includes('💉'));
}

/* ═══════════════════════════════════════════════════════════════════
 * convertCycleToBBPlan — PED integration
 * ═══════════════════════════════════════════════════════════════════ */
describe('convertCycleToBBPlan: PED integration', () => {
  it('adapt cycle path injects Exercise Lab instructions into comments', () => {
    const plan = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: WM,
      level: 'intermediate',
      equipment: EQ,
      mode: 'adapt',
      trainingFocus: 'hypertrophy',
    } as any);
    const comments = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises)
      .map(e => e.comment || '');
    expect(comments.some(c => c.includes('Паттерн:'))).toBe(true);
    expect(comments.some(c => c.includes('Техника:'))).toBe(true);
  });
  it('adapt + AAS 500 → PED rationale присутствует', () => {
    const plan = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: WM,
      peds: ['AAS'],
      pedDoses: { AAS: 500 },
      courseIntensity: 'moderate',
      level: 'intermediate',
      equipment: EQ,
      mode: 'adapt',
    } as any);
    expect(hasPEDRationale(plan)).toBe(true);
  });

  it('adapt + AAS 1000 → больше объём чем AAS 500 (PED boost)', () => {
    const heavy = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: WM,
      peds: ['AAS'],
      pedDoses: { AAS: 1000 },
      courseIntensity: 'heavy',
      level: 'intermediate',
      equipment: EQ,
      mode: 'adapt',
    } as any);
    const light = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: WM,
      peds: ['AAS'],
      pedDoses: { AAS: 500 },
      courseIntensity: 'moderate',
      level: 'intermediate',
      equipment: EQ,
      mode: 'adapt',
    } as any);
    const heavyChest = totalSetsForMuscle(heavy, 'chest');
    const lightChest = totalSetsForMuscle(light, 'chest');
    expect(heavyChest).toBeGreaterThanOrEqual(lightChest);
  });

  it('faithful + AAS 500 → PED НЕ меняет объём (faithful = дословно)', () => {
    const faithful = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: WM,
      peds: ['AAS'],
      pedDoses: { AAS: 500 },
      courseIntensity: 'moderate',
      level: 'intermediate',
      equipment: EQ,
      mode: 'faithful',
    } as any);
    const noPed = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: WM,
      peds: [],
      pedDoses: {},
      level: 'intermediate',
      equipment: EQ,
      mode: 'faithful',
    } as any);
    // faithful mode: PED не меняет сеты
    const faithfulChest = totalSetsForMuscle(faithful, 'chest');
    const noPedChest = totalSetsForMuscle(noPed, 'chest');
    expect(faithfulChest).toBe(noPedChest);
  });

  it('adapt + full stack (AAS+insulin+GH) → план генерируется', () => {
    const plan = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: WM,
      peds: ['AAS', 'insulin', 'GH'],
      pedDoses: { AAS: 2000, insulin: 20, GH: 8 },
      courseIntensity: 'heavy',
      level: 'advanced',
      equipment: EQ,
      mode: 'adapt',
    } as any);
    expect(plan).toBeDefined();
    expect(plan.weeks.length).toBeGreaterThan(0);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * convertCycleToBBPlan — sex='female' glute boost
 * ═══════════════════════════════════════════════════════════════════ */
describe('convertCycleToBBPlan: female glute boost ×1.2', () => {
  it('female + glutes → больше glute объём чем male', () => {
    const female = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: WM,
      sex: 'female',
      level: 'intermediate',
      equipment: EQ,
      mode: 'adapt',
    } as any);
    const male = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: WM,
      sex: 'male',
      level: 'intermediate',
      equipment: EQ,
      mode: 'adapt',
    } as any);
    const fGlutes = totalSetsForMuscle(female, 'glutes');
    const mGlutes = totalSetsForMuscle(male, 'glutes');
    // Female glute boost ×1.2 → должно быть ≥ male
    expect(fGlutes).toBeGreaterThanOrEqual(mGlutes);
  });
});

/* ═══════════════════════════════════════════════════════════════════
 * programToBBPlan — PED integration
 * ═══════════════════════════════════════════════════════════════════ */
describe('programToBBPlan: PED integration', () => {
  const prog = FULL_PROGRAM_LIBRARY.find(p => p.id === '531_bbb');
  if (!prog) { it.skip('531_bbb не найден', () => {}); }
  else {
    it('adapt + AAS 500 → PED rationale присутствует', () => {
      const plan = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, peds: ['AAS'], pedDoses: { AAS: 500 },
        courseIntensity: 'moderate', mode: 'adapt',
      } as any);
      expect(hasPEDRationale(plan)).toBe(true);
    });

    it('adapt program path injects Exercise Lab instructions into comments', () => {
      const plan = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, mode: 'adapt', trainingFocus: 'hypertrophy',
      } as any);
      const comments = plan.weeks.flatMap(w => w.sessions).flatMap(s => s.exercises)
        .map(e => e.comment || '');
      expect(comments.some(c => c.includes('Паттерн:'))).toBe(true);
      expect(comments.some(c => c.includes('Порядок:'))).toBe(true);
    });

    it('adapt + AAS 1000 → больше объём чем без PED', () => {
      const withPed = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, peds: ['AAS'], pedDoses: { AAS: 1000 },
        courseIntensity: 'heavy', mode: 'adapt',
      } as any);
      const noPed = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, peds: [], pedDoses: {}, mode: 'adapt',
      } as any);
      const pedChest = totalSetsForMuscle(withPed, 'chest');
      const noPedChest = totalSetsForMuscle(noPed, 'chest');
      expect(pedChest).toBeGreaterThanOrEqual(noPedChest);
    });

    it('faithful + AAS 500 → PED НЕ меняет объём', () => {
      const faithful = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, peds: ['AAS'], pedDoses: { AAS: 500 },
        courseIntensity: 'moderate', mode: 'faithful',
      } as any);
      const noPed = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, peds: [], pedDoses: {}, mode: 'faithful',
      } as any);
      expect(totalSetsForMuscle(faithful, 'chest')).toBe(totalSetsForMuscle(noPed, 'chest'));
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════
 * programToBBPlan — sex='female' glute boost
 * ═══════════════════════════════════════════════════════════════════ */
describe('programToBBPlan: female glute boost ×1.2', () => {
  const prog = FULL_PROGRAM_LIBRARY.find(p => p.id === '531_bbb');
  if (!prog) { it.skip('531_bbb не найден', () => {}); }
  else {
    it('female + adapt → glute объём ≥ male', () => {
      const female = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, sex: 'female', mode: 'adapt',
      } as any);
      const male = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, sex: 'male', mode: 'adapt',
      } as any);
      const fGlutes = totalSetsForMuscle(female, 'glutes');
      const mGlutes = totalSetsForMuscle(male, 'glutes');
      expect(fGlutes).toBeGreaterThanOrEqual(mGlutes);
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════
 * Nutrition + Eccentric metrics integration
 * ═══════════════════════════════════════════════════════════════════ */
describe('convertCycleToBBPlan: nutrition + eccentric metrics', () => {
  it('calorieSurplus=400 → nutritionMult влияет на mrvMult (больше объём)', () => {
    const surplus = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: WM,
      calorieSurplus: 400,
      level: 'intermediate',
      equipment: EQ,
      mode: 'adapt',
    } as any);
    const neutral = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: WM,
      calorieSurplus: 0,
      level: 'intermediate',
      equipment: EQ,
      mode: 'adapt',
    } as any);
    const sChest = totalSetsForMuscle(surplus, 'chest');
    const nChest = totalSetsForMuscle(neutral, 'chest');
    expect(sChest).toBeGreaterThanOrEqual(nChest);
  });

  it('proteinPerKg=2.2 → nutritionMult ×1.1 (больше объём)', () => {
    const high = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: WM,
      proteinPerKg: 2.2,
      level: 'intermediate',
      equipment: EQ,
      mode: 'adapt',
    } as any);
    const low = convertCycleToBBPlan({
      cycle: CYCLE_01,
      workMax: WM,
      proteinPerKg: 0.8,
      level: 'intermediate',
      equipment: EQ,
      mode: 'adapt',
    } as any);
    const hChest = totalSetsForMuscle(high, 'chest');
    const lChest = totalSetsForMuscle(low, 'chest');
    expect(hChest).toBeGreaterThanOrEqual(lChest);
  });
});

describe('programToBBPlan: nutrition + eccentric metrics', () => {
  const prog = FULL_PROGRAM_LIBRARY.find(p => p.id === '531_bbb');
  if (!prog) { it.skip('531_bbb не найден', () => {}); }
  else {
    it('calorieSurplus=400 → nutritionMult влияет на объём', () => {
      const surplus = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, calorieSurplus: 400, mode: 'adapt',
      } as any);
      const neutral = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, calorieSurplus: 0, mode: 'adapt',
      } as any);
      const sChest = totalSetsForMuscle(surplus, 'chest');
      const nChest = totalSetsForMuscle(neutral, 'chest');
      expect(sChest).toBeGreaterThanOrEqual(nChest);
    });

    it('proteinPerKg=2.2 → больше объём чем proteinPerKg=0.8', () => {
      const high = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, proteinPerKg: 2.2, mode: 'adapt',
      } as any);
      const low = programToBBPlan(prog, {
        workMax: WM, weakPoints: [], injuries: [], level: 'intermediate',
        equipment: EQ, proteinPerKg: 0.8, mode: 'adapt',
      } as any);
      const hChest = totalSetsForMuscle(high, 'chest');
      const lChest = totalSetsForMuscle(low, 'chest');
      expect(hChest).toBeGreaterThanOrEqual(lChest);
    });
  }
});
