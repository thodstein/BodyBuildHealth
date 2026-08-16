import { describe, expect, it } from 'vitest';
import {
  detectWeakMusclesByE1rm, groupOfExerciseName, WEAK_MUSCLE_GROUP_LABELS,
  type WeakMuscleSession,
} from '../weak-muscle-detection.engine';

function daysAgo(n: number): string {
  return new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
}

function session(date: string, exercises: Array<{ name: string; weightKg: number; reps: number }>): WeakMuscleSession {
  return {
    date,
    exercises: exercises.map(e => ({
      exerciseName: e.name,
      sets: [{ setNumber: 1, weightKg: e.weightKg, reps: e.reps, rpe: 8 }],
    })),
  };
}

describe('groupOfExerciseName — классификация упражнений по группам', () => {
  it('присед/жим ногами → legs, жим лёжа → chest, жим стоя → shoulders (порядок алиасов)', () => {
    expect(groupOfExerciseName('Приседания со штангой')).toBe('legs');
    expect(groupOfExerciseName('Жим ногами')).toBe('legs');
    expect(groupOfExerciseName('Жим штанги лёжа')).toBe('chest');
    expect(groupOfExerciseName('Жим стоя')).toBe('shoulders');
    expect(groupOfExerciseName('Жим гантелей на наклонной')).toBe('chest');
  });
  it('тяги → back, становая → back (консистентно с LIFT_TO_GROUP карточки)', () => {
    expect(groupOfExerciseName('Становая тяга')).toBe('back');
    expect(groupOfExerciseName('Тяга штанги в наклоне')).toBe('back');
    expect(groupOfExerciseName('Подтягивания')).toBe('back');
  });
  it('разгибание ног → legs, разгибание рук/французский → arms', () => {
    expect(groupOfExerciseName('Разгибание ног в тренажёре')).toBe('legs');
    expect(groupOfExerciseName('Французский жим')).toBe('arms');
    expect(groupOfExerciseName('Сгибание рук со штангой')).toBe('arms');
  });
  it('неизвестные/пустые → null', () => {
    expect(groupOfExerciseName('')).toBeNull();
    expect(groupOfExerciseName('Кардио велосипед')).toBe('core');
  });
});

describe('detectWeakMusclesByE1rm — авто-детекция слабых групп', () => {
  it('падение e1RM → weak; рост → без сигнала', () => {
    const sessions = [
      session(daysAgo(40), [{ name: 'Жим штанги лёжа', weightKg: 100, reps: 5 }]),
      session(daysAgo(10), [{ name: 'Жим штанги лёжа', weightKg: 90, reps: 5 }]),
    ];
    const signals = detectWeakMusclesByE1rm(sessions);
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({ group: 'chest', status: 'weak' });
    expect(signals[0].deltaPct).toBeLessThan(0);
  });

  it('плато: рост ≤1% при ≥2 сессиях → plateau', () => {
    const sessions = [
      session(daysAgo(40), [{ name: 'Присед', weightKg: 120, reps: 5 }]),
      session(daysAgo(10), [{ name: 'Присед', weightKg: 120, reps: 5 }]),
      session(daysAgo(3), [{ name: 'Присед', weightKg: 120, reps: 5 }]),
    ];
    const signals = detectWeakMusclesByE1rm(sessions);
    expect(signals.find(s => s.group === 'legs')?.status).toBe('plateau');
  });

  it('рост e1RM >1% — группа не попадает в сигналы', () => {
    const sessions = [
      session(daysAgo(40), [{ name: 'Жим штанги лёжа', weightKg: 90, reps: 5 }]),
      session(daysAgo(5), [{ name: 'Жим штанги лёжа', weightKg: 95, reps: 5 }]),
    ];
    expect(detectWeakMusclesByE1rm(sessions)).toHaveLength(0);
  });

  it('без предыдущего окна: ≥2 сессий в текущем → plateau (нет сравнения)', () => {
    const sessions = [
      session(daysAgo(5), [{ name: 'Тяга верхнего блока', weightKg: 60, reps: 8 }]),
      session(daysAgo(2), [{ name: 'Тяга верхнего блока', weightKg: 60, reps: 8 }]),
    ];
    const signals = detectWeakMusclesByE1rm(sessions);
    expect(signals.find(s => s.group === 'back')?.status).toBe('plateau');
  });

  it('лучший e1RM в окне (не последний сет) и несколько групп сортируются от худшей', () => {
    const sessions = [
      session(daysAgo(40), [
        { name: 'Жим штанги лёжа', weightKg: 100, reps: 5 },
        { name: 'Присед', weightKg: 140, reps: 5 },
      ]),
      session(daysAgo(10), [
        { name: 'Жим штанги лёжа', weightKg: 80, reps: 5 },
        { name: 'Жим штанги лёжа', weightKg: 95, reps: 5 },
        { name: 'Присед', weightKg: 145, reps: 5 },
      ]),
    ];
    const signals = detectWeakMusclesByE1rm(sessions);
    const chest = signals.find(s => s.group === 'chest')!;
    expect(chest.status).toBe('weak');
    expect(chest.currentE1rm).toBeGreaterThan(95);
    expect(signals[0].group).toBe('chest');
  });

  it('пустой дневник / без данных — пусто', () => {
    expect(detectWeakMusclesByE1rm([])).toEqual([]);
    expect(detectWeakMusclesByE1rm([{ date: daysAgo(1), exercises: [] }])).toEqual([]);
  });

  it('все группы имеют русские лейблы', () => {
    for (const group of Object.keys(WEAK_MUSCLE_GROUP_LABELS)) {
      expect(WEAK_MUSCLE_GROUP_LABELS[group].length).toBeGreaterThan(0);
    }
  });
});
