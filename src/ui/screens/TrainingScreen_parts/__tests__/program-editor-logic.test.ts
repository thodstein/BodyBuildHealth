import { describe, it, expect } from 'vitest';
import {
  addWeakToWeekLogic,
  calcW,
  allBlockIdsUnique,
  cloneWeekProgression,
  firstFreeTrainingDay,
  resizeTrainingSessions,
  sessionDayOfWeek,
  trainingDayForIndex,
  moveWeekScheduleDay,
  resetScheduleToRecommended,
  sessionUsesRecommendedDay,
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

describe('training day assignment', () => {
  it('assigns practical default days and skips occupied days', () => {
    expect(trainingDayForIndex(0)).toBe(0);
    expect(trainingDayForIndex(1)).toBe(2);
    expect(firstFreeTrainingDay([{ dayOfWeek: 0 }, { dayOfWeek: 2 }])).toBe(4);
    expect(firstFreeTrainingDay([{ dayOfWeek: 0 }, { dayOfWeek: 2 }, { dayOfWeek: 4 }])).toBe(1);
  });

  it('normalizes missing or invalid session days for display', () => {
    expect(sessionDayOfWeek({}, 1)).toBe(2);
    expect(sessionDayOfWeek({ dayOfWeek: 8 }, 1)).toBe(2);
    expect(sessionDayOfWeek({ dayOfWeek: 5 }, 1)).toBe(5);
  });

  it('resizes a week while preserving populated sessions', () => {
    const populated: UserWeek['sessions'][number] = {
      id: 'keep', name: 'Push', dayOfWeek: 2, focus: 'chest', blocks: [{ id: 'b', type: 'accessory', exerciseName: 'Bench', muscle: 'chest', role: 'accessory', sets: [{ reps: 8, rir: 2 }] }],
    };
    const result = resizeTrainingSessions([populated], 3);
    expect(result).toHaveLength(3);
    expect(result[0]).toBe(populated);
    expect(result[1].dayOfWeek).not.toBe(2);
    expect(resizeTrainingSessions(result, 1)[0]).toBe(populated);
  });

  it('creates explicit deload sessions for a deload week', () => {
    const result = resizeTrainingSessions([], 2, true);
    expect(result).toHaveLength(2);
    expect(result.every(session => session.focus === 'deload')).toBe(true);
    expect(result.every(session => session.blocks.length === 1)).toBe(true);
  });
});

describe('week schedule card (карточка «Неделя — расписание»)', () => {
  it('рекомендованный день сессии = стандартная раскладка Пн/Ср/Пт/Вт/Чт/Сб/Вс', () => {
    expect(trainingDayForIndex(0)).toBe(0);
    expect(trainingDayForIndex(1)).toBe(2);
    expect(trainingDayForIndex(2)).toBe(4);
    expect(trainingDayForIndex(3)).toBe(1);
    expect(trainingDayForIndex(4)).toBe(3);
    expect(trainingDayForIndex(5)).toBe(5);
    expect(trainingDayForIndex(6)).toBe(6);
  });

  it('sessionUsesRecommendedDay: сессия на рекомендованном дне или нет', () => {
    expect(sessionUsesRecommendedDay({}, 0)).toBe(true); // без dayOfWeek → Пн (рекомендован)
    expect(sessionUsesRecommendedDay({ dayOfWeek: 0 }, 0)).toBe(true);
    expect(sessionUsesRecommendedDay({ dayOfWeek: 3 }, 0)).toBe(false);
    expect(sessionUsesRecommendedDay({ dayOfWeek: 4 }, 2)).toBe(true);
    expect(sessionUsesRecommendedDay({ dayOfWeek: 9 }, 1)).toBe(true); // невалидный → рекомендация
  });

  it('moveWeekScheduleDay переносит сессию во ВСЕ недели (шаблон повторяется)', () => {
    const weeks = [makeWeek(1, false, 3), makeWeek(2, false, 3), makeWeek(3, true, 3)];
    const result = moveWeekScheduleDay(weeks, 1, 5);
    expect(result.every(w => w.sessions[1].dayOfWeek === 5)).toBe(true);
    expect(sessionDayOfWeek(result[0].sessions[0], 0)).toBe(0); // остальные не тронуты
    // несуществующий индекс сессии — недели не меняются
    const noop = moveWeekScheduleDay(weeks, 9, 5);
    expect(sessionDayOfWeek(noop[0].sessions[1], 1)).toBe(2);
    // неделя с меньшим числом сессий защищена границей
    const mixed = [makeWeek(1, false, 3), makeWeek(2, true, 1)];
    const mixedResult = moveWeekScheduleDay(mixed, 2, 5);
    expect(sessionDayOfWeek(mixedResult[1].sessions[0], 0)).toBe(0);
  });

  it('moveWeekScheduleDay нормализует невалидный день к рекомендации', () => {
    const weeks = [makeWeek(1, false, 2)];
    expect(moveWeekScheduleDay(weeks, 0, 9)[0].sessions[0].dayOfWeek).toBe(trainingDayForIndex(0));
    expect(moveWeekScheduleDay(weeks, 1, -3)[0].sessions[1].dayOfWeek).toBe(trainingDayForIndex(1));
    expect(moveWeekScheduleDay(weeks, 1, 2.5)[0].sessions[1].dayOfWeek).toBe(trainingDayForIndex(1));
  });

  it('moveWeekScheduleDay не мутирует исходные недели', () => {
    const weeks = [makeWeek(1, false, 2)];
    const snapshot = JSON.stringify(weeks);
    moveWeekScheduleDay(weeks, 0, 5);
    expect(JSON.stringify(weeks)).toBe(snapshot);
  });

  it('resetScheduleToRecommended расставляет рекомендованные дни по всем неделям', () => {
    const weeks = [makeWeek(1, false, 3), makeWeek(2, false, 3)];
    const moved = moveWeekScheduleDay(weeks, 0, 6);
    const result = resetScheduleToRecommended(moved);
    expect(result[0].sessions.map((s, i) => sessionDayOfWeek(s, i))).toEqual([0, 2, 4]);
    expect(result[1].sessions.map((s, i) => sessionDayOfWeek(s, i))).toEqual([0, 2, 4]);
    // явный нерекомендованный день тоже возвращается
    const custom = makeWeek(1, false, 1);
    custom.sessions[0].dayOfWeek = 5;
    expect(sessionDayOfWeek(resetScheduleToRecommended([custom])[0].sessions[0], 0)).toBe(0);
  });

  it('resetScheduleToRecommended не мутирует исходные недели', () => {
    const weeks = [makeWeek(1, false, 2)];
    const snapshot = JSON.stringify(weeks);
    resetScheduleToRecommended(weeks);
    expect(JSON.stringify(weeks)).toBe(snapshot);
  });
});

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
