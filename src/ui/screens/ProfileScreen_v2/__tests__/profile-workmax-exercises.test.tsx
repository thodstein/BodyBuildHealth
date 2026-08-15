/**
 * profile-workmax-exercises.test.tsx — рабочие максимумы по упражнениям в профиле:
 * категория (группа мышц) → упражнение → вес; workMax групп вычисляется автоматически.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, fireEvent, screen, act, cleanup, waitFor } from '@testing-library/react';
import { ProfileUserTab } from '../ProfileUserTab';
import { _resetProfileModuleStateForTests } from '../../../../core/profile-manager';
import { WORKMAX_CATEGORIES } from '../../../../engines/workmax-exercises';

const baseProfile = (): Record<string, any> => ({
  name: 'Тест',
  id: 't1',
  role: 'user',
  settings: {
    personal: { age: 30, sex: 'male', height: 180, weight: 85, bodyFat: 15 },
    training: {
      primaryGoal: 'bulk',
      daysPerWeek: 4,
      minutesPerSession: 70,
      weakPoints: [],
      equipment: ['barbell'],
      workMax: { chest: 100, back: 120 },
      pmSquat: 140,
      pmBench: 100,
      pmDeadlift: 180,
    },
    pharma: {},
    health: {},
    nutrition: {},
    lifestyle: {},
    system: {},
    goals: {},
    labs: { summary: [] },
    symptoms: { recent: [] },
  },
});

const openPM = () => {
  const btn = screen.getAllByRole('button', { name: /2\.2 Личные рекорды/ })[0];
  fireEvent.click(btn);
};

beforeEach(() => {
  localStorage.clear();
  _resetProfileModuleStateForTests();
  localStorage.setItem('he_profile_v2', JSON.stringify(baseProfile()));
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('TrainingPMSection — рабочие максимумы по упражнениям', () => {
  it('категория «Грудь» раскрыта по умолчанию, видно 7 упражнений с попапами', () => {
    render(<ProfileUserTab />);
    openPM();
    const chest = WORKMAX_CATEGORIES.find((c) => c.id === 'chest')!;
    expect(screen.getByText('Грудь')).toBeTruthy();
    expect(chest.exercises.length).toBe(7);
    expect(screen.getByText('Жим штанги лёжа')).toBeTruthy();
    expect(screen.getByText('Разводка гантелей лёжа')).toBeTruthy();
  });

  it('ввод веса упражнения → workMaxByExercise и workMax.chest пересчитаны', async () => {
    render(<ProfileUserTab />);
    openPM();
    // Клик по значению «Жим штанги лёжа» открывает попап ввода (синхронно)
    const benchEditor = screen.getByText('Жим штанги лёжа').closest('button')!;
    fireEvent.click(benchEditor);
    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '110' } });
    fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
    await act(async () => { vi.advanceTimersByTime(1200); });
    const saved = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    expect(saved.settings.training.workMaxByExercise).toMatchObject({ bench_bar: 110 });
    expect(saved.settings.training.workMax.chest).toBe(110);
  });

  it('вес мышцы = МАКСИМУМ среди её упражнений; незаполненные группы сохраняются', async () => {
    render(<ProfileUserTab />);
    openPM();
    // Грудь: жим лёжа 100, разводка 30
    for (const [label, val] of [['Жим штанги лёжа', '100'], ['Разводка гантелей лёжа', '30']] as const) {
      fireEvent.click(screen.getByText(label).closest('button')!);
      const input = screen.getByRole('spinbutton');
      fireEvent.change(input, { target: { value: val } });
      fireEvent.click(screen.getByRole('button', { name: /Сохранить/ }));
      await act(async () => { vi.advanceTimersByTime(300); });
    }
    await act(async () => { vi.advanceTimersByTime(1200); });
    const saved = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    expect(saved.settings.training.workMaxByExercise.bench_bar).toBe(100);
    expect(saved.settings.training.workMax.chest).toBe(100);
    expect(saved.settings.training.workMax.back).toBe(120); // не тронута
  });

  it('«Сбросить всё» в категории очищает её упражнения и удаляет мышцу из workMax', async () => {
    localStorage.setItem(
      'he_profile_v2',
      JSON.stringify({
        ...baseProfile(),
        settings: {
          ...baseProfile().settings,
          training: {
            ...baseProfile().settings.training,
            workMaxByExercise: { bench_bar: 110, fly_db: 30 },
            workMax: { chest: 110, back: 120 },
          },
        },
      }),
    );
    _resetProfileModuleStateForTests();
    render(<ProfileUserTab />);
    openPM();
    fireEvent.click(screen.getByRole('button', { name: /Очистить группу «Грудь»/ }));
    await act(async () => { vi.advanceTimersByTime(1200); });
    const saved = JSON.parse(localStorage.getItem('he_profile_v2') || '{}');
    expect(saved.settings.training.workMaxByExercise).not.toHaveProperty('bench_bar');
    expect(saved.settings.training.workMax).not.toHaveProperty('chest');
    expect(saved.settings.training.workMax.back).toBe(120);
  });
});
