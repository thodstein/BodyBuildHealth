/**
 * diary-hub-competition-mode.test.tsx — регрессия: дневник тренировок
 * рендерится без падений после добавления подвкладки «🏁 Соревнования»
 * (mode 'competition') и переключателя в режиме записи.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { render, screen, fireEvent } from '@testing-library/react';
import { TrainingDiaryHub } from '../TrainingDiaryHub';

const baseProps = {
  diary: {
    checkProgressionAlerts: async () => [],
    saveWorkoutLog: async () => {},
    saveStrengthLog: async () => {},
    deleteWorkoutLog: async () => {},
    updateWorkoutLog: async () => {},
  } as any,
  diaryStats: [],
  diaryProgress: [],
  historyWorkouts: [],
  macrocycle: null,
  selectedWeek: 1,
  level: 'intermediate',
  onRefresh: () => {},
  trainingOutput: null,
  goal: 'bulk',
  daysPerWeek: 4,
  splitType: 'auto',
  periodizationType: 'auto',
  mesoLength: 12,
  tprofile: { weakPoints: [], bodyWeight: 80, onCourse: false, courseIntensity: 1, goal: 'bulk', level: 'intermediate' },
  linked: { profile: { settings: { personal: { height: 175 } } } },
};

describe('Дневник тренировок — режим «Соревнования» (регрессия после подвкладки)', () => {
  it('SSR: mode record рендерится с переключателем подвкладок', () => {
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="record" />);
    expect(html).toContain('Запись тренировки');
    expect(html).toContain('Соревнования');
    expect(html).toContain('Сегодня');
  });

  it('SSR: mode competition рендерится без ошибок (пустое состояние)', () => {
    const html = renderToStaticMarkup(<TrainingDiaryHub {...baseProps} initialMode="competition" />);
    expect(html).toContain('Пока нет сохранённых соревновательных циклов');
  });

  it('CSR: открытие подвкладки «Соревнования» не роняет дневник', async () => {
    render(<TrainingDiaryHub {...baseProps} initialMode="record" />);
    expect(screen.getByText(/Запись тренировки/)).toBeTruthy();
    const btn = screen.getByRole('button', { name: /Соревнования/ });
    fireEvent.click(btn);
    expect(await screen.findByText(/Пока нет сохранённых соревновательных циклов/)).toBeTruthy();
  });

  it('legacy-запись без exercises НЕ роняет дневник при открытии («Сегодня») и при фильтре истории', () => {
    const legacy = { id: 'legacy_1', date: '2025-01-01', duration: 60, overallRPE: 7, recoveryBefore: 5, split: 'fullbody', notes: 'старая запись' } as any;
    const props = { ...baseProps, historyWorkouts: [legacy] as any };
    expect(() => {
      render(<TrainingDiaryHub {...props} initialMode="record" />);
    }).not.toThrow();
    expect(screen.getByText(/Последняя:/)).toBeTruthy();
    // «Сегодня» показывает 0 упр. вместо краша
    expect(screen.getByText(/0 упр\./)).toBeTruthy();
  });

  it('legacy-запись с exercises={} (объект, не массив) НЕ роняет дневник при открытии', () => {
    // exercises={} — самый опасный legacy-кейс: truthy, но не итерируемый (крашит .reduce/.forEach)
    const legacy = { id: 'legacy_2', date: '2025-06-01', duration: 60, overallRPE: 7, recoveryBefore: 5, split: 'fullbody', notes: 'старая запись', exercises: {} } as any;
    const props = { ...baseProps, historyWorkouts: [legacy] as any };
    expect(() => {
      render(<TrainingDiaryHub {...props} initialMode="record" />);
    }).not.toThrow();
    expect(screen.getByText(/Последняя:/)).toBeTruthy();
    expect(screen.getByText(/0 упр\./)).toBeTruthy();
  });

  it('битая история не-массивом НЕ роняет дневник при открытии', () => {
    const props = { ...baseProps, historyWorkouts: {} as any };
    expect(() => render(<TrainingDiaryHub {...props} initialMode="record" />)).not.toThrow();
    expect(screen.getByText(/Сегодня/)).toBeTruthy();
  });
});
