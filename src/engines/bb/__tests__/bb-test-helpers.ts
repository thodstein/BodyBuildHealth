/**
 * bb-test-helpers.ts — общие тестовые утилиты для BB-auto.
 *
 * Раньше makeInput() дублировался в 12+ тест-файлах с одинаковыми дефолтами.
 * Теперь — единая фабрика с overrides.
 */
import { expect } from 'vitest';
import { buildBBPlan } from '../bb-builder.engine';
import type { BBBuilderInput, BBPlan } from '../bb-builder.engine';

const DEFAULT_EQ = ['barbell', 'dumbbell', 'cable', 'machine', 'bodyweight'];

const DEFAULT_WORKMAX: Record<string, number> = {
  chest: 100,
  back: 120,
  quads: 140,
  hamstrings: 100,
  glutes: 120,
  shoulders: 70,
  biceps: 50,
  triceps: 60,
  forearms: 35,
  calves: 80,
  abs: 40,
};

/**
 * Создать валидный BBBuilderInput с дефолтными значениями.
 * @param overrides — переопределения любых полей
 */
export function makeInput(overrides: Partial<BBBuilderInput> = {}): BBBuilderInput {
  return {
    patternId: 'upper_lower_4',
    level: 'intermediate',
    goal: 'mass',
    weeks: 8,
    workMax: { ...DEFAULT_WORKMAX },
    equipment: DEFAULT_EQ,
    volumeGoal: 'mav',
    sex: 'male',
    ...overrides,
  };
}

/**
 * Создать mock предыдущего плана для cross-mesocycle тестов.
 */
export function makeMockPreviousPlan(overrides: Partial<BBBuilderInput> = {}): BBPlan {
  return buildBBPlan(makeInput({ weeks: 8, ...overrides }));
}

/**
 * Посчитать total sets для конкретной мышцы в плане.
 */
export function totalSetsForMuscle(plan: BBPlan, muscle: string): number {
  let total = 0;
  for (const w of plan.weeks) {
    for (const s of w.sessions) {
      for (const ex of s.exercises) {
        if (ex.muscle === muscle || ex.muscle.includes(muscle) || muscle.includes(ex.muscle)) {
          total += ex.sets;
        }
      }
    }
  }
  return total;
}

/**
 * Получить все имена упражнений в плане.
 */
export function allExerciseNames(plan: BBPlan): string[] {
  const names: string[] = [];
  for (const w of plan.weeks) {
    for (const s of w.sessions) {
      for (const ex of s.exercises) {
        if (ex.name) names.push(ex.name);
      }
    }
  }
  return [...new Set(names)];
}

/**
 * Получить все ID упражнений в плане.
 */
export function allExerciseIds(plan: BBPlan): string[] {
  const ids: string[] = [];
  for (const w of plan.weeks) {
    for (const s of w.sessions) {
      for (const ex of s.exercises) {
        if (ex.exerciseName) ids.push(ex.exerciseName);
      }
    }
  }
  return [...new Set(ids)];
}

/**
 * Проверить, что план структурно валиден.
 */
export function expectValidPlan(plan: BBPlan): void {
  expect(plan).toBeDefined();
  expect(plan.pattern).toBeDefined();
  expect(plan.weeks).toBeInstanceOf(Array);
  expect(plan.weeks.length).toBeGreaterThan(0);
  for (const w of plan.weeks) {
    expect(w.sessions).toBeInstanceOf(Array);
    for (const s of w.sessions) {
      expect(s.exercises).toBeInstanceOf(Array);
      for (const ex of s.exercises) {
        expect(ex.name).toBeTruthy();
        expect(ex.muscle).toBeTruthy();
        expect(ex.sets).toBeGreaterThanOrEqual(1);
        expect(ex.workSets).toBeInstanceOf(Array);
      }
    }
  }
}

/**
 * Малые мышцы для тестов прогрессии.
 */
export const SMALL_MUSCLES = new Set([
  'biceps', 'triceps', 'forearms', 'calves', 'abs', 'traps',
  'delt_front', 'delt_mid', 'delt_rear',
]);

/**
 * Большие мышцы для тестов прогрессии.
 */
export const BIG_MUSCLES = new Set([
  'chest', 'back', 'quads', 'hamstrings', 'glutes', 'shoulders',
]);