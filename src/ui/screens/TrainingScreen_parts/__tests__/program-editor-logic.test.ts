import { describe, it, expect } from 'vitest';
import {
  addWeakToWeekLogic,
  calcW,
  allBlockIdsUnique,
  cloneWeekProgression,
} from '../program-editor-logic';
import type { UserWeek, TrainingProfile } from '../../../../engines/user-program/user-program.types';
import { newId } from '../../../../engines/user-program/user-program.types';

function makeWeek(week: number, deload: boolean, sessionCount = 1): UserWeek {
  return {
    week,
    phase: deload ? 'deload' : 'accumulation',
    deload,
    sessions: Array.from({ length: sessionCount }, (_, i) => ({
      id: newId('ses'),
      name: `Day ${i + 1}`,
      focus: '',
      blocks: [],
    })),
  };
}

function makeProfile(): TrainingProfile {
  return {
    bodyWeight: 80,
    goal: 'hypertrophy',
    level: 'intermediate',
    trainingYears: 3,
    daysPerWeek: 4,
    recovery: 7,
    fatigue: 3,
    sleepHours: 7,
    stressLevel: 5,
    weakPoints: ['chest'],
    equipment: ['barbell', 'dumbbell'],
    favoriteExercises: [],
    excludedExercises: [],
    avoidAxialLoad: false,
    pmSquat: 140,
    pmBench: 100,
    pmDead: 180,
    workMax: { chest: 100, back: 110, legs: 140 },
    loadStrategy: 'double_progression',
    planMode: 'generic_split',
    bbCycleId: '',
    onCourse: false,
    courseIntensity: 'moderate',
    bbPeds: [],
    pharmaCoursesCount: 0,
    monthsSinceLastCourse: 0,
    totalYearsOnPharma: 0,
    injuries: [],
  } as TrainingProfile;
}

describe('program-editor-logic', () => {
  describe('addWeakToWeekLogic', () => {
    it('добавляет блоки во все недели, кроме deload', () => {
      const weeks = [
        makeWeek(1, false),
        makeWeek(2, false),
        makeWeek(3, true),  // deload — не должен получить блоки
        makeWeek(4, false),
      ];
      const result = addWeakToWeekLogic({
        weeks,
        muscle: 'chest',
        level: 'intermediate',
        profile: makeProfile(),
      });
      expect(result[0].sessions[0].blocks.length).toBeGreaterThan(0);
      expect(result[1].sessions[0].blocks.length).toBeGreaterThan(0);
      expect(result[2].sessions[0].blocks.length).toBe(0); // deload
      expect(result[3].sessions[0].blocks.length).toBeGreaterThan(0);
    });

    it('каждый блок имеет уникальный id', () => {
      const weeks = [makeWeek(1, false), makeWeek(2, false)];
      const result = addWeakToWeekLogic({
        weeks,
        muscle: 'chest',
        level: 'intermediate',
        profile: makeProfile(),
      });
      expect(allBlockIdsUnique(result)).toBe(true);
    });

    it('возвращает исходный массив, если упражнения не найдены', () => {
      const weeks = [makeWeek(1, false)];
      const profile = makeProfile();
      // несуществующая мышца → suggestExercisesForGroup вернёт []
      const result = addWeakToWeekLogic({
        weeks,
        muscle: 'nonexistent_muscle_group',
        level: 'intermediate',
        profile,
      });
      expect(result[0].sessions[0].blocks.length).toBe(0);
    });
  });

  describe('calcW', () => {
    const wm = { squat: 140, bench: 100, dead: 180 };

    it('возвращает null для accessory', () => {
      expect(calcW(0.7, 'accessory', wm)).toBeNull();
    });

    it('считает вес для squat', () => {
      expect(calcW(0.7, 'squat', wm)).toBe(97.5); // округление к шагу 2.5 кг
    });

    it('считает вес для bench', () => {
      expect(calcW(0.7, 'bench', wm)).toBe(70);
    });

    it('считает вес для dead', () => {
      expect(calcW(0.7, 'dead', wm)).toBe(125); // округление к шагу 2.5 кг
    });

    it('возвращает null при отсутствии PM', () => {
      expect(calcW(0.7, 'squat', {})).toBeNull();
    });

    it('возвращает null при PM <= 0', () => {
      expect(calcW(0.7, 'squat', { squat: 0 })).toBeNull();
    });
  });

  describe('cloneWeekProgression', () => {
    it('округляет до 2.5кг', () => {
      expect(cloneWeekProgression(100)).toBe(102.5);
    });

    it('не меняет нулевой вес', () => {
      expect(cloneWeekProgression(0)).toBe(0);
    });
  });
});
