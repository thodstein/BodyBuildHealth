/**
 * diary-record-legacy.test.tsx — воспроизведение ошибки дневника тренировок:
 * форма «Подробно» (DiaryRecordingForm) падает, если в истории есть legacy-запись
 * без поля exercises.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DiaryRecordingForm } from '../DiaryRecordingForm';
import type { WorkoutLog } from '../../../core/types';

const legacyWorkout = {
  id: 'legacy_1',
  date: '2025-01-01',
  duration: 60,
  overallRPE: 7,
  recoveryBefore: 5,
  split: 'fullbody',
  notes: 'старая запись без упражнений',
  // exercises отсутствует — legacy-данные
} as WorkoutLog;

const brokenExercisesWorkout = {
  id: 'legacy_2',
  date: '2025-02-01',
  duration: 60,
  overallRPE: 7,
  recoveryBefore: 5,
  split: 'fullbody',
  notes: 'старая запись с битым exercises',
  exercises: {} as any, // не массив и не undefined — самый коварный legacy-кейс
} as WorkoutLog;

const normalWorkout = {
  id: 'normal_1',
  date: '2026-08-10',
  duration: 65,
  overallRPE: 7,
  recoveryBefore: 5,
  split: 'PPL',
  notes: '',
  exercises: [
    {
      id: 'n1', date: '2026-08-10', exerciseId: 'bench_press', exerciseName: 'Жим штанги лёжа', isCompound: true, weekNumber: 1,
      sets: [{ weight: 80, reps: 8, rir: 2, rpe: 7 }],
      totalVolume: 640, estimated1RM: 100,
    },
  ],
} as WorkoutLog;

describe('DiaryRecordingForm с legacy-данными', () => {
  it('форма НЕ падает при открытии, если в истории есть запись без exercises', () => {
    expect(() => {
      render(
        <DiaryRecordingForm
          diary={{ saveWorkoutLog: async () => {}, saveStrengthLog: async () => {} } as any}
          selectedWeek={1}
          onSave={() => {}}
          historyWorkouts={[normalWorkout, legacyWorkout]}
        />
      );
    }).not.toThrow();
  });

  it('НЕ падает при ДОБАВЛЕНИИ упражнения с legacy-историей (getPreviousWorkoutData)', async () => {
    const { container } = render(
      <DiaryRecordingForm
        diary={{ saveWorkoutLog: async () => {}, saveStrengthLog: async () => {} } as any}
        selectedWeek={1}
        onSave={() => {}}
        historyWorkouts={[normalWorkout, legacyWorkout, brokenExercisesWorkout]}
      />
    );
    const { fireEvent, screen } = await import('@testing-library/react');
    const search = container.querySelector('input[data-ex-search]') as HTMLInputElement;
    fireEvent.change(search, { target: { value: 'жим' } });
    const result = screen.getByText('Жим штанги лёжа');
    expect(() => {
      fireEvent.click(result);
    }).not.toThrow();
  });

  it('VBT: скорость подхода из ручной формы пишется в дневник (§5-quat)', async () => {
    const rtl = await import('@testing-library/react');
    const saved: any[] = [];
    const { container } = rtl.render(
      <DiaryRecordingForm
        diary={{ saveWorkoutLog: async (log: any) => { saved.push(log); }, saveStrengthLog: async () => {} } as any}
        selectedWeek={1}
        onSave={() => {}}
        historyWorkouts={[]}
      />
    );
    // Добавляем упражнение из каталога (как в тесте выше).
    const search = container.querySelector('input[data-ex-search]') as HTMLInputElement;
    rtl.fireEvent.change(search, { target: { value: 'жим' } });
    rtl.fireEvent.click(rtl.screen.getByText('Жим штанги лёжа'));
    // Заполняем вес (иначе пустой подход не попадает в запись).
    const weight = container.querySelectorAll('input[data-set-input="1"]')[0] as HTMLInputElement;
    rtl.fireEvent.change(weight, { target: { value: '100' } });
    // Вводим скорость первого подхода.
    const vel = container.querySelector('input[placeholder="v"]') as HTMLInputElement;
    expect(vel).toBeTruthy();
    rtl.fireEvent.change(vel, { target: { value: '0.85' } });
    rtl.fireEvent.click(rtl.screen.getByText('💾 Сохранить тренировку'));
    // Даём микротаск на resolve async-сохранения.
    await new Promise(r => setTimeout(r, 30));
    expect(saved.length).toBeGreaterThan(0);
    const ex = saved[0].exercises[0];
    expect(ex.sets[0].velocity).toBe(0.85);
  });

  it('VBT: пустая/мусорная скорость → undefined (не калечит статистику)', async () => {
    const rtl = await import('@testing-library/react');
    const saved: any[] = [];
    const { container } = rtl.render(
      <DiaryRecordingForm
        diary={{ saveWorkoutLog: async (log: any) => { saved.push(log); }, saveStrengthLog: async () => {} } as any}
        selectedWeek={1}
        onSave={() => {}}
        historyWorkouts={[]}
      />
    );
    const search = container.querySelector('input[data-ex-search]') as HTMLInputElement;
    rtl.fireEvent.change(search, { target: { value: 'жим' } });
    rtl.fireEvent.click(rtl.screen.getByText('Жим штанги лёжа'));
    const weight = container.querySelectorAll('input[data-set-input="1"]')[0] as HTMLInputElement;
    rtl.fireEvent.change(weight, { target: { value: '100' } });
    const vel = container.querySelector('input[placeholder="v"]') as HTMLInputElement;
    rtl.fireEvent.change(vel, { target: { value: '42' } });   // 42 м/с — опечатка
    rtl.fireEvent.change(vel, { target: { value: '' } });      // и очистка
    rtl.fireEvent.click(rtl.screen.getByText('💾 Сохранить тренировку'));
    await new Promise(r => setTimeout(r, 30));
    expect(saved.length).toBeGreaterThan(0);
    expect(saved[0].exercises[0].sets[0].velocity).toBeUndefined();
  });
});
