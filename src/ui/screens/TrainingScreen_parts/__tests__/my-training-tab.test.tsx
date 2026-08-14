/**
 * my-training-tab.test.tsx — регрессия переноса «Мои тренировки» в дневник:
 * - компонент принимает ВСЕ входы (customExercises/setCustomExercises/goal/
 *   level/daysPerWeek/mesoLength/onLoadToConstructor) без ошибок;
 * - рендер кнопок и toast-контейнера;
 * - сохранение плана/цикла работает без ошибок (try/catch localStorage).
 */
import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import { MyTrainingTab } from '../MyTrainingTab';
import { TrainingDiaryHub } from '../TrainingDiaryHub';

const exs = [{ name: 'Жим лёжа', sets: 4, reps: 8, rir: 2 }];

const baseProps = {
  diary: { checkProgressionAlerts: async () => [], saveWorkoutLog: async () => {}, saveStrengthLog: async () => {}, deleteWorkoutLog: async () => {}, updateWorkoutLog: async () => {} } as any,
  diaryStats: [], diaryProgress: [], historyWorkouts: [], macrocycle: null, selectedWeek: 1,
  level: 'intermediate', onRefresh: () => {}, trainingOutput: null, goal: 'bulk', daysPerWeek: 4,
  splitType: 'auto', periodizationType: 'auto', mesoLength: 12,
  tprofile: { weakPoints: [], bodyWeight: 80, onCourse: false, courseIntensity: 1, goal: 'bulk', level: 'intermediate' },
  linked: { profile: { settings: { personal: { height: 175 } } } },
};

describe('MyTrainingTab (перенесён в дневник)', () => {
  beforeEach(() => { try { localStorage.clear(); } catch {} });

  it('принимает все входы без ошибок (SSR)', () => {
    const html = renderToStaticMarkup(
      <MyTrainingTab
        customExercises={exs}
        setCustomExercises={() => {}}
        goal="bulk" level="intermediate" daysPerWeek={4} mesoLength={6}
        onLoadToConstructor={(plan: any) => { void plan; }}
      />
    );
    expect(html).toContain('Моя тренировка');
    expect(html).toContain('Упражнения');
    expect(html).toContain('Планы');
    expect(html).toContain('Циклы');
    expect(html).toContain('Жим лёжа');
  });

  it('без onLoadToConstructor тоже рендерится (опциональный вход)', () => {
    const html = renderToStaticMarkup(
      <MyTrainingTab customExercises={[]} setCustomExercises={() => {}} />
    );
    expect(html).toContain('Моя тренировка');
  });

  it('подвкладка «⭐ Мои тренировки» доступна в дневнике (SSR) и рендерит MyTrainingTab', () => {
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="mytraining" />);
    expect(html).toContain('Моя тренировка');
    expect(html).toContain('Упражнения');
    expect(html).toContain('Планы');
  });

  it('сохранение плана: работает и показывает toast о месте сохранения', () => {
    render(<MyTrainingTab customExercises={exs} setCustomExercises={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Сохранить план/ }));
    expect(screen.getByText(/сохранён во вкладке «Планы»/)).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem('myTrainingPlans') || '[]');
    expect(Array.isArray(saved)).toBe(true);
    expect(saved.length).toBe(1);
    expect(saved[0].exercises.length).toBe(1);
  });

  it('пустой список: кнопка сохранения скрыта (guard), ничего не пишется', () => {
    render(<MyTrainingTab customExercises={[]} setCustomExercises={() => {}} />);
    expect(screen.queryByRole('button', { name: /Сохранить план/ })).toBeNull();
    expect(localStorage.getItem('myTrainingPlans')).toBeNull();
  });

  it('сохранение цикла: toast + запись в localStorage', () => {
    render(<MyTrainingTab customExercises={exs} setCustomExercises={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /Циклы/ }));
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    expect(screen.getByText(/сохранён во вкладке «Циклы»/)).toBeTruthy();
    const saved = JSON.parse(localStorage.getItem('myTrainingCycles') || '[]');
    expect(Array.isArray(saved)).toBe(true);
    expect(saved.length).toBe(1);
  });
});
