import { describe, it, expect } from 'vitest';
import { buildArmPlan } from '../arm/arm-builder.engine';
import { validateArmPlan } from '../arm/arm-validator.engine';
import { ARM_CYCLE_LIBRARY } from '../arm/arm-cycle-library.engine';
import { buildSSCyclePlan } from '../strength-sport/strength-sport-ss-cycle-to-plan.engine';
import { SS_CYCLES } from '../../data/ss-cycles/ss-cycle-index';
import type { StrengthSportInput } from '../strength-sport/strength-sport.types';

/**
 * Ф1.3/Ф1.4 (CYCLE-SYSTEM-FULL-AUDIT): матрица всех именных циклов ARM (19)
 * и ТА·Стронг (15) через их билдеры с циклом-пресетом. Инварианты формы,
 * делодов и тапера.
 */

const armWorkMax = {
  tablePress: 60, wristCurl: 40, sidePressure: 35, cupHold: 40, pronation: 30,
  supination: 30, rising: 30, hook: 45, topRoll: 40, thumb: 25, backPressure: 45,
} as Record<string, number>;

const ssWorkMax = {
  snatch: 60, cleanJerk: 75, clean: 70, jerk: 75, frontSquat: 110, backSquat: 140,
  deadlift: 180, overheadPress: 70, logPress: 75, bench: 110,
  yokeWalk: 200, farmersWalk: 90, atlasStone: 110, axleDeadlift: 160,
  circusDbPress: 50, frameCarry: 160,
} as Record<string, number>;

function assertArmPlanShape(plan: ReturnType<typeof buildArmPlan>, tag: string) {
  const cyc = ARM_CYCLE_LIBRARY.find(c => c.id === (plan.inputSnapshot?.cycleId ?? '')) ?? null;
  if (cyc) expect(plan.weeks.length, `${tag}: weeks ${plan.weeks.length} != ${cyc.weeks}`).toBe(cyc.weeks);
  expect(plan.weeks.length, `${tag}: weeks>0`).toBeGreaterThan(0);
  for (const w of plan.weeks) {
    expect(w.sessions.length, `${tag} W${w.week}: sessions`).toBeGreaterThan(0);
    for (const s of w.sessions) {
      expect(s.exercises.length, `${tag} W${w.week} S${s.day}: exercises`).toBeGreaterThan(0);
      for (const ex of s.exercises) {
        expect(ex.sets, `${tag} W${w.week} ${ex.name}`).toBeGreaterThanOrEqual(1);
        expect(ex.sets, `${tag} W${w.week} ${ex.name} cap`).toBeLessThanOrEqual(8);
        expect((ex.workSets ?? []).length, `${tag} workSets`).toBe(ex.sets);
        for (const ws of ex.workSets ?? []) {
          expect(Number.isFinite(ws.reps) && ws.reps >= 1, `${tag} reps`).toBe(true);
        }
      }
    }
  }
  const validation = validateArmPlan(plan, String(plan.level ?? 'intermediate'));
  expect(validation.errors.length, `${tag}: errors ${JSON.stringify(validation.errors)}`).toBe(0);
}

describe('Ф1.3: ARM-матрица (19 именных циклов через buildArmPlan)', () => {
  it('все 19 циклов собираются: форма, делоды, тапер, 0 ошибок валидатора', () => {
    expect(ARM_CYCLE_LIBRARY.length).toBe(19);
    for (const cyc of ARM_CYCLE_LIBRARY) {
      const plan = buildArmPlan({
        discipline: cyc.discipline === 'any' ? 'armwrestling' : cyc.discipline,
        patternId: 'arm_4_upper_lower',
        level: cyc.level.includes('beginner') ? 'beginner' : 'intermediate',
        goal: 'strength',
        technique: 'balanced',
        weeks: cyc.weeks,
        daysPerWeek: cyc.daysPerWeek,
        workMax: armWorkMax,
        cycleId: cyc.id,
      } as any);
      (plan as any).inputSnapshot = { ...(plan.inputSnapshot ?? {}), cycleId: cyc.id };
      assertArmPlanShape(plan, cyc.id);
      const validation = validateArmPlan(plan, String(plan.level ?? 'intermediate'));
      expect(validation.errors.length, `${cyc.id}: errors ${JSON.stringify(validation.errors)}`).toBe(0);
      // Делоды: циклы с фазой deload должны иметь deload-неделю
      const deloadDeclared = Object.values(cyc.phases).some(p => p === 'deload');
      const deloadActual = plan.weeks.some(w => w.phase === 'deload' || w.deload === true);
      if (deloadDeclared) expect(deloadActual, `${cyc.id}: заявленный делод отсутствует в плане`).toBe(true);
    }
  });
});

const ssInput: StrengthSportInput = {
  mode: 'strongman',
  goal: 'strength',
  level: 'intermediate',
  weeks: 8,
  daysPerWeek: 3,
  workMax: ssWorkMax,
  bodyweight: 90,
  sex: 'male',
  equipment: ['barbell', 'dumbbell', 'machine', 'cable', 'specialty'],
} as StrengthSportInput;

describe('Ф1.4: SS-матрица (15 циклов ТА·Стронг через buildSSCyclePlan)', () => {
  it('все 15 циклов собираются: форма/математика без NaN', () => {
    expect(SS_CYCLES.length).toBe(15);
    for (const t of SS_CYCLES) {
      const plan = buildSSCyclePlan(t, { ...ssInput, mode: t.meta.mode as any, weeks: t.meta.weeks } as StrengthSportInput);
      expect(plan.weeksData.length, `${t.meta.id}: weeks ${plan.weeksData.length} != ${t.meta.weeks}`).toBe(t.meta.weeks);
      for (const w of plan.weeksData) {
        for (const s of w.sessions) {
          for (const ex of s.exercises) {
            expect(ex.sets, `${t.meta.id} W${w.week} ${ex.name}`).toBeGreaterThanOrEqual(1);
            expect((ex.workSets ?? []).length, `${t.meta.id} workSets`).toBe(ex.sets);
          }
        }
      }
      expect((plan.validation?.errors ?? []).length, `${t.meta.id}: errors ${JSON.stringify(plan.validation?.errors)}`).toBe(0);
    }
  });
});
